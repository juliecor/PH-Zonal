import { NextResponse } from "next/server";
import { gridsForBounds, stormSurgeLevelAcross, sampleGrid, STORMSURGE_LABELS } from "../../lib/stormSurgeGrid";

export const runtime = "nodejs";

// POST { points:[{lat,lon}] } → { levels:[{level,label}|null] }  (batch, for scan)
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const points = Array.isArray(body?.points) ? body.points : [];
    const pts = points.map((p: any) => ({ lat: Number(p?.lat), lon: Number(p?.lon) }));
    const valid = pts.filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    if (!valid.length) return NextResponse.json({ ok: true, levels: pts.map(() => null) });
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
      return { level: best, label: best ? STORMSURGE_LABELS[best] || String(best) : "No storm surge" };
    });
    return NextResponse.json({ ok: true, levels });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "batch storm surge failed" }, { status: 500 });
  }
}

// GET ?lat=&lon= → worst-case (SSA4) storm-surge hazard level at a point
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ ok: false, error: "lat, lon required" }, { status: 400 });
    }
    const v = await stormSurgeLevelAcross(lat, lon);
    if (v === null) return NextResponse.json({ ok: true, found: false, inCoverage: false });
    if (!v) return NextResponse.json({ ok: true, found: true, inCoverage: true, level: 0, label: "No storm surge" });
    return NextResponse.json({ ok: true, found: true, inCoverage: true, level: v, label: STORMSURGE_LABELS[v] || String(v), scenario: "SSA4" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "storm surge lookup failed" }, { status: 500 });
  }
}
