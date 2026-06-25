// Build the 6-hazard profile for a single map point (used by the establishment panel).
// Flood / landslide / storm-surge / fault come from the existing "-at" endpoints;
// liquefaction & tsunami are point-in-polygon tests against the vector hazard layers.

export type HazardCell = { level: number; label: string; note?: string }; // level: -1 no data, 0 none … 3 high
export type HazardProfile = {
  flood: HazardCell;
  landslide: HazardCell;
  stormsurge: HazardCell;
  fault: HazardCell;
  liquefaction: HazardCell;
  tsunami: HazardCell;
};

const NA: HazardCell = { level: -1, label: "No data" };

// cache the vector geojson so we only download each layer once per session
const geoCache: Record<string, any> = {};

function ringContains(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function polyContains(x: number, y: number, rings: number[][][]): boolean {
  if (!rings.length || !ringContains(x, y, rings[0])) return false;
  for (let h = 1; h < rings.length; h++) if (ringContains(x, y, rings[h])) return false; // hole
  return true;
}
async function inVectorLayer(lat: number, lon: number, url: string): Promise<boolean> {
  if (geoCache[url] === undefined) {
    try { geoCache[url] = await (await fetch(url)).json(); } catch { geoCache[url] = null; }
  }
  const gj = geoCache[url];
  if (!gj?.features) return false;
  for (const f of gj.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon" && polyContains(lon, lat, g.coordinates)) return true;
    if (g.type === "MultiPolygon") for (const poly of g.coordinates) if (polyContains(lon, lat, poly)) return true;
  }
  return false;
}

async function levelAt(path: string, lat: number, lon: number): Promise<HazardCell> {
  try {
    const d = await (await fetch(`/api/${path}?lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(8000) })).json();
    if (d?.ok && d.inCoverage) return { level: Number(d.level) || 0, label: String(d.label || "") };
  } catch {}
  return NA;
}

export async function loadHazardProfile(lat: number, lon: number): Promise<HazardProfile> {
  const faultAt = async (): Promise<HazardCell> => {
    try {
      const d = await (await fetch(`/api/fault-at?lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(8000) })).json();
      if (d?.ok && d.found) {
        const km = Number(d.distance_m) / 1000;
        return { level: Number(d.level) || 0, label: `${km < 1 ? `${Math.round(d.distance_m)} m` : `${km.toFixed(1)} km`} away`, note: d.name };
      }
    } catch {}
    return { level: 0, label: "No mapped fault nearby" };
  };

  const [flood, landslide, stormsurge, fault, liq, tsu] = await Promise.all([
    levelAt("flood-at", lat, lon),
    levelAt("landslide-at", lat, lon),
    levelAt("stormsurge-at", lat, lon),
    faultAt(),
    inVectorLayer(lat, lon, "/hazard/liquefaction_vec.geojson"),
    inVectorLayer(lat, lon, "/hazard/tsunami_vec.geojson"),
  ]);

  return {
    flood, landslide, stormsurge, fault,
    liquefaction: liq ? { level: 3, label: "Susceptible" } : { level: 0, label: "Not susceptible" },
    tsunami: tsu ? { level: 2, label: "Prone area" } : { level: 0, label: "Not prone" },
  };
}
