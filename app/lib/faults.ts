import fs from "fs";
import path from "path";

// Active-fault lines (PHIVOLCS, via the open GEM Global Active Faults harmonization).
// Tiny GeoJSON (~0.14 MB), loaded once and cached. Powers the "distance to nearest
// active fault" check — PHIVOLCS advises avoiding building within ~5 m of a trace.

type Seg = { ax: number; ay: number; bx: number; by: number; name: string };

const DATA = path.join(process.cwd(), "fault-data", "ph_faults.geojson");

function buildSegments(): { segs: Seg[]; loaded: boolean } {
  let features: any[] = [];
  try {
    const gj = JSON.parse(fs.readFileSync(DATA, "utf8"));
    features = Array.isArray(gj?.features) ? gj.features : [];
  } catch {
    return { segs: [], loaded: false };
  }
  const segs: Seg[] = [];
  for (const f of features) {
    const name = String(f?.properties?.name || f?.properties?.catalog_name || "Active fault").trim();
    const g = f?.geometry;
    if (!g) continue;
    const lines: number[][][] =
      g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
    for (const line of lines) {
      for (let i = 0; i + 1 < line.length; i++) {
        const a = line[i], b = line[i + 1];
        if (a?.length >= 2 && b?.length >= 2) {
          segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], name });
        }
      }
    }
  }
  return { segs, loaded: true };
}

function getSegments(): { segs: Seg[]; loaded: boolean } {
  const g = globalThis as any;
  if (!g.__FAULT_SEGS__) g.__FAULT_SEGS__ = buildSegments();
  return g.__FAULT_SEGS__;
}

// Meters between a point and a lon/lat segment, via local equirectangular projection.
function pointSegMeters(lat: number, lon: number, s: Seg): number {
  const R = 111320; // m per degree lon at equator
  const coslat = Math.cos((lat * Math.PI) / 180);
  const px = lon * R * coslat, py = lat * 110540;
  const ax = s.ax * R * coslat, ay = s.ay * 110540;
  const bx = s.bx * R * coslat, by = s.by * 110540;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Nearest active fault to a point: { distance_m, name } or null if data missing.
export function nearestFault(lat: number, lon: number): { distance_m: number; name: string } | null {
  const { segs, loaded } = getSegments();
  if (!loaded || !segs.length) return null;
  // Coarse bbox pre-filter (±1.5°) to skip far segments; fall back to all if none near.
  const near = segs.filter((s) => Math.abs(s.ay - lat) < 1.5 && Math.abs(s.ax - lon) < 1.5);
  const pool = near.length ? near : segs;
  let best = Infinity, bestName = "";
  for (const s of pool) {
    const d = pointSegMeters(lat, lon, s);
    if (d < best) { best = d; bestName = s.name; }
  }
  if (!Number.isFinite(best)) return null;
  return { distance_m: Math.round(best), name: bestName };
}
