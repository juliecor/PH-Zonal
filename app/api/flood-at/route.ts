import { NextResponse } from "next/server";
import { gridsForBounds, floodLevelAcross, sampleGrid, FLOOD_LABELS } from "../../lib/floodGrid";

export const runtime = "nodejs";

// POST { points:[{lat,lon}] } → { levels:[{level,label}|null] }  (batch, for scan)
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const points = Array.isArray(body?.points) ? body.points : [];
    const pts = points.map((p: any) => ({ lat: Number(p?.lat), lon: Number(p?.lon) }));
    const valid = pts.filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    if (!valid.length) return NextResponse.json({ ok: true, levels: pts.map(() => null) });

    // Load only the grids covering the batch's bounding box, once.
    const west = Math.min(...valid.map((p: any) => p.lon));
    const east = Math.max(...valid.map((p: any) => p.lon));
    const south = Math.min(...valid.map((p: any) => p.lat));
    const north = Math.max(...valid.map((p: any) => p.lat));
    const grids = await gridsForBounds(west, south, east, north);

    const levels = pts.map((p: any) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
      let best: number | null = null;
      for (const g of grids) {
        const s = sampleGrid(g, p.lat, p.lon);
        if (s === null) continue;
        best = best === null ? s : Math.max(best, s);
      }
      if (best === null) return null;
      return { level: best, label: best ? FLOOD_LABELS[best] || String(best) : "No flood" };
    });
    return NextResponse.json({ ok: true, levels });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "batch flood failed" }, { status: 500 });
  }
}

// GET ?lat=&lon= → flood level at a point (whichever province covers it)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ ok: false, error: "lat, lon required" }, { status: 400 });
    }
    const v = await floodLevelAcross(lat, lon);
    if (v === null) return NextResponse.json({ ok: true, found: false, inCoverage: false });
    if (!v) return NextResponse.json({ ok: true, found: true, inCoverage: true, level: 0, label: "No flood (100-yr)", return_period: 100 });
    return NextResponse.json({
      ok: true,
      found: true,
      inCoverage: true,
      level: v,
      label: FLOOD_LABELS[v] || String(v),
      return_period: 100,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "flood lookup failed" }, { status: 500 });
  }
}
