import { NextResponse } from "next/server";

export const runtime = "nodejs";

const KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Renders the drawn parcel as a satellite static map with a gold-filled outline.
export async function POST(req: Request) {
  try {
    if (!KEY) return NextResponse.json({ ok: false, error: "Google Maps key not configured" }, { status: 500 });

    const body = await req.json().catch(() => ({} as any));
    const pts = Array.isArray(body?.points) ? body.points : [];
    const valid = pts.filter((p: any) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));
    if (valid.length < 3) return NextResponse.json({ ok: false, error: "need at least 3 points" }, { status: 400 });

    const fmt = (p: any) => `${Number(p.lat).toFixed(6)},${Number(p.lng).toFixed(6)}`;
    const ring = valid.map(fmt).join("|");
    const pathStr = `fillcolor:0xC9A84C66|color:0x1E3A8AFF|weight:3|${ring}|${fmt(valid[0])}`;

    // Compute a tight center + zoom that frames the parcel closely (Google's
    // path auto-fit pads too much — this zooms in so the property is clear).
    const W = 600, H = 440;
    const lats = valid.map((p: any) => Number(p.lat));
    const lngs = valid.map((p: any) => Number(p.lng));
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const center = `${((minLat + maxLat) / 2).toFixed(6)},${((minLng + maxLng) / 2).toFixed(6)}`;
    const latRad = (lat: number) => { const s = Math.sin((lat * Math.PI) / 180); return Math.log((1 + s) / (1 - s)) / 2; };
    const zoomFor = (px: number, frac: number) => Math.floor(Math.log(px / 256 / Math.max(frac, 1e-9)) / Math.LN2);
    const latFraction = (latRad(maxLat) - latRad(minLat)) / Math.PI;
    let lngDiff = maxLng - minLng; const lngFraction = ((lngDiff < 0 ? lngDiff + 360 : lngDiff)) / 360;
    let zoom = Math.min(zoomFor(H, latFraction), zoomFor(W, lngFraction), 20);
    if (!Number.isFinite(zoom) || zoom < 1) zoom = 18;
    // Fit the parcel tightly (the floor in zoomFor already leaves a little margin).

    const url =
      `https://maps.googleapis.com/maps/api/staticmap` +
      `?maptype=satellite&size=${W}x${H}&scale=2` +
      `&center=${encodeURIComponent(center)}&zoom=${zoom}` +
      `&path=${encodeURIComponent(pathStr)}` +
      `&key=${KEY}`;

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10000);
    const res = await fetch(url, { signal: ac.signal }).finally(() => clearTimeout(t));
    const ct = res.headers.get("content-type") || "";

    if (!res.ok || !ct.toLowerCase().includes("image")) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json({ ok: false, error: `Static map failed: ${res.status} ${txt.slice(0, 140)}` }, { status: 502 });
    }

    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: { "Content-Type": ct || "image/png", "Cache-Control": "public, max-age=3600" },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "parcel-map failed" }, { status: 500 });
  }
}
