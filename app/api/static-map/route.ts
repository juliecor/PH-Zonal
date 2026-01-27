import { NextResponse } from "next/server";

export const runtime = "nodejs";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function fetchWithTimeout(url: string, ms = 9000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ac.signal,
      headers: {
        // Some services behave better with a UA and Accept
        "User-Agent": "ZonalFinder/1.0 (repompojuliecor@gmail.com)",
        Accept: "image/png,image/*;q=0.9,*/*;q=0.8",
      },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));
    const zoom = clamp(Number(searchParams.get("zoom") ?? "16"), 1, 19);

    const w = clamp(Number(searchParams.get("w") ?? "900"), 200, 1200);
    const h = clamp(Number(searchParams.get("h") ?? "520"), 200, 900);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ ok: false, error: "lat/lon required" }, { status: 400 });
    }

    // Provider 1: staticmap.openstreetmap.de (widely used)
    const url1 =
      `https://staticmap.openstreetmap.de/staticmap.php` +
      `?center=${encodeURIComponent(`${lat},${lon}`)}` +
      `&zoom=${encodeURIComponent(String(zoom))}` +
      `&size=${encodeURIComponent(`${w}x${h}`)}` +
      `&markers=${encodeURIComponent(`${lat},${lon},red-pushpin`)}`;

    // Provider 2 (fallback): try http variant (sometimes SSL/proxy issues)
    const url2 =
      `http://staticmap.openstreetmap.de/staticmap.php` +
      `?center=${encodeURIComponent(`${lat},${lon}`)}` +
      `&zoom=${encodeURIComponent(String(zoom))}` +
      `&size=${encodeURIComponent(`${w}x${h}`)}` +
      `&markers=${encodeURIComponent(`${lat},${lon},red-pushpin`)}`;

    const candidates = [url1, url2];

    let lastErr: any = null;

    for (const url of candidates) {
      try {
        const res = await fetchWithTimeout(url, 12000);

        const ct = res.headers.get("content-type") || "";

        if (!res.ok) {
          // read small snippet to debug (rate limit/forbidden/etc)
          const txt = await res.text().catch(() => "");
          lastErr = `Upstream ${res.status} ${res.statusText} (${ct}) ${txt.slice(0, 140)}`;
          continue;
        }

        const buf = await res.arrayBuffer();

        // Sometimes upstream returns HTML even with 200 (bad gateway pages)
        if (!ct.toLowerCase().includes("image")) {
          const txt = Buffer.from(buf).toString("utf8");
          lastErr = `Upstream returned non-image (${ct}): ${txt.slice(0, 140)}`;
          continue;
        }

        return new NextResponse(buf, {
          status: 200,
          headers: {
            "Content-Type": ct || "image/png",
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (e: any) {
        lastErr = e?.name === "AbortError" ? "Timeout fetching static map" : (e?.message ?? String(e));
        continue;
      }
    }

    return NextResponse.json({ ok: false, error: lastErr ?? "Static map failed" }, { status: 502 });
  } catch (e: any) {
    // IMPORTANT: never crash with 500 without explanation
    return NextResponse.json({ ok: false, error: e?.message ?? "static-map route failed" }, { status: 500 });
  }
}
