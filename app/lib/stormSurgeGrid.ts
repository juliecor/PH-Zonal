import fs from "fs";
import path from "path";
import { fromFile } from "geotiff";
import { sampleGrid, type FloodGrid } from "./floodGrid";

// Storm-surge (NOAH SSA4, worst-case >4m) rasters live in stormsurge-data/ with
// their own manifest. Reuses the flood grid shape + sampleGrid; separate caches.
// HAZ field 1/2/3 = Low/Moderate/High inundation depth, same scale as flood.
type ManifestEntry = { file: string; minLon: number; maxLon: number; minLat: number; maxLat: number };

const DATA_DIR = path.join(process.cwd(), "stormsurge-data");
export const STORMSURGE_LABELS: Record<number, string> = { 1: "Low", 2: "Moderate", 3: "High" };
export { sampleGrid };

function getManifest(): ManifestEntry[] {
  const g = globalThis as any;
  const c = g.__SS_MANIFEST__ as { ts: number; entries: ManifestEntry[] } | undefined;
  if (c && Date.now() - c.ts < 30000) return c.entries;
  let entries: ManifestEntry[] = [];
  try {
    entries = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "manifest.json"), "utf8"));
  } catch {
    entries = [];
  }
  g.__SS_MANIFEST__ = { ts: Date.now(), entries };
  return entries;
}

function arrayCache(): Map<string, Promise<FloodGrid | null>> {
  const g = globalThis as any;
  if (!g.__SS_ARRAYS__) g.__SS_ARRAYS__ = new Map();
  return g.__SS_ARRAYS__;
}
function loadArray(file: string): Promise<FloodGrid | null> {
  const cache = arrayCache();
  if (!cache.has(file)) {
    cache.set(
      file,
      (async () => {
        try {
          const tiff = await fromFile(path.join(DATA_DIR, file));
          const image = await tiff.getImage();
          const [originX, originY] = image.getOrigin();
          const [resX, resY] = image.getResolution();
          const rasters = await image.readRasters();
          return { arr: rasters[0], width: image.getWidth(), height: image.getHeight(), originX, originY, resX, resY };
        } catch {
          return null;
        }
      })()
    );
  }
  return cache.get(file)!;
}

export async function gridsForBounds(
  west: number,
  south: number,
  east: number,
  north: number
): Promise<FloodGrid[]> {
  const entries = getManifest().filter(
    (e) => !(east < e.minLon || west > e.maxLon || north < e.minLat || south > e.maxLat)
  );
  const grids = await Promise.all(entries.map((e) => loadArray(e.file)));
  return grids.filter(Boolean) as FloodGrid[];
}

export async function stormSurgeLevelAcross(lat: number, lon: number): Promise<number | null> {
  const grids = await gridsForBounds(lon, lat, lon, lat);
  let best: number | null = null;
  for (const g of grids) {
    const v = sampleGrid(g, lat, lon);
    if (v === null) continue;
    best = best === null ? v : Math.max(best, v);
  }
  return best;
}
