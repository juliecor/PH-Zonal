import { NextResponse } from "next/server";
import { nearestFault } from "../../lib/faults";

export const runtime = "nodejs";

// Risk band by distance to the nearest active fault (PHIVOLCS advises a ~5 m no-build
// buffer either side of a trace; within a few hundred m = on/near the fault zone).
function band(m: number): { level: number; label: string } {
  if (m <= 50) return { level: 3, label: "On/at the fault trace" };
  if (m <= 300) return { level: 2, label: "Very near a fault" };
  if (m <= 1000) return { level: 1, label: "Near a fault" };
  return { level: 0, label: "Not near a mapped fault" };
}

// POST { points:[{lat,lon}] } → batch (for scan)
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const points = Array.isArray(body?.points) ? body.points : [];
    const levels = points.map((p: any) => {
      const lat = Number(p?.lat), lon = Number(p?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const n = nearestFault(lat, lon);
      if (!n) return null;
      const b = band(n.distance_m);
      return { distance_m: n.distance_m, name: n.name, level: b.level, label: b.label };
    });
    return NextResponse.json({ ok: true, levels });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "batch fault failed" }, { status: 500 });
  }
}

// GET ?lat=&lon= → nearest active fault distance + name
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ ok: false, error: "lat, lon required" }, { status: 400 });
    }
    const n = nearestFault(lat, lon);
    if (!n) return NextResponse.json({ ok: true, found: false });
    const b = band(n.distance_m);
    return NextResponse.json({ ok: true, found: true, distance_m: n.distance_m, name: n.name, level: b.level, label: b.label });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "fault lookup failed" }, { status: 500 });
  }
}
