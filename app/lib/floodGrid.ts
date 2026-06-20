import fs from "fs";
import path from "path";
import { fromFile } from "geotiff";

export type FloodGrid = {
  arr: any;
  width: number;
  height: number;
  originX: number;
  originY: number;
  resX: number;
  resY: number;
};

type ManifestEntry = { file: string; minLon: number; maxLon: number; minLat: number; maxLat: number };

const DATA_DIR = path.join(process.cwd(), "flood-data");
export const FLOOD_LABELS: Record<number, string> = { 1: "Low", 2: "Moderate", 3: "High" };

// Manifest = list of datasets + their bounds (tiny JSON). Re-read every 30s so
// newly-processed provinces appear without a restart.
function getManifest(): ManifestEntry[] {
  const g = globalThis as any;
  const c = g.__FLOOD_MANIFEST__ as { ts: number; entries: ManifestEntry[] } | undefined;
  if (c && Date.now() - c.ts < 30000) return c.entries;
  let entries: ManifestEntry[] = [];
  try {
    entries = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "manifest.json"), "utf8"));
  } catch {
    entries = [];
  }
  g.__FLOOD_MANIFEST__ = { ts: Date.now(), entries };
  return entries;
}

// Decode + cache a single province's raster (only when first needed).
function arrayCache(): Map<string, Promise<FloodGrid | null>> {
  const g = globalThis as any;
  if (!g.__FLOOD_ARRAYS__) g.__FLOOD_ARRAYS__ = new Map();
  return g.__FLOOD_ARRAYS__;
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

export function sampleGrid(grid: FloodGrid, lat: number, lon: number): number | null {
  const col = Math.floor((lon - grid.originX) / grid.resX);
  const row = Math.floor((grid.originY - lat) / Math.abs(grid.resY));
  if (col < 0 || col >= grid.width || row < 0 || row >= grid.height) return null;
  return Number(grid.arr[row * grid.width + col]) || 0;
}

// Load (cached) only the grids whose bbox intersects the requested bounds.
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

// Highest flood level across all datasets covering the point. null = not covered.
export async function floodLevelAcross(lat: number, lon: number): Promise<number | null> {
  const grids = await gridsForBounds(lon, lat, lon, lat);
  let best: number | null = null;
  for (const g of grids) {
    const v = sampleGrid(g, lat, lon);
    if (v === null) continue;
    best = best === null ? v : Math.max(best, v);
  }
  return best;
}
