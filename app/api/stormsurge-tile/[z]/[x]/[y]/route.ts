import { PNG } from "pngjs";
import { gridsForBounds, sampleGrid } from "../../../../../lib/stormSurgeGrid";
import type { FloodGrid } from "../../../../../lib/floodGrid";

export const runtime = "nodejs";

// Violet palette so storm surge is distinct from flood (warm) and landslide (earthy).
const COLORS: Record<number, [number, number, number, number]> = {
  1: [196, 181, 253, 130], // Low — light violet
  2: [139, 92, 246, 155],  // Moderate — violet
  3: [109, 40, 217, 185],  // High — deep violet
};
const STOPS: [number, number, number, number][] = [
  [COLORS[1][0], COLORS[1][1], COLORS[1][2], 0],
  COLORS[1],
  COLORS[2],
  COLORS[3],
];
const TILE = 256;

function mercYToLat(yFrac: number): number {
  const n = Math.PI - 2 * Math.PI * yFrac;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
function transparentTile(): Response {
  const png = new PNG({ width: TILE, height: TILE });
  png.data.fill(0);
  return new Response(new Uint8Array(PNG.sync.write(png)), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}

function bilinearAt(grids: FloodGrid[], lat: number, lon: number): number {
  let best = 0;
  for (const g of grids) {
    const fx = (lon - g.originX) / g.resX - 0.5;
    const fy = (g.originY - lat) / Math.abs(g.resY) - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const s = (cx: number, cy: number) =>
      cx < 0 || cx >= g.width || cy < 0 || cy >= g.height ? 0 : Number(g.arr[cy * g.width + cx]) || 0;
    const v00 = s(x0, y0), v10 = s(x0 + 1, y0), v01 = s(x0, y0 + 1), v11 = s(x0 + 1, y0 + 1);
    const v = v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
    if (v > best) best = v;
  }
  return best;
}

export async function GET(_req: Request, ctx: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z: zs, x: xs, y: ys } = await ctx.params;
  const z = Number(zs), x = Number(xs), y = Number(ys);
  if (![z, x, y].every(Number.isFinite)) return transparentTile();

  const n = Math.pow(2, z);
  const tileWest = (x / n) * 360 - 180;
  const tileEast = ((x + 1) / n) * 360 - 180;
  const tileNorth = mercYToLat(y / n);
  const tileSouth = mercYToLat((y + 1) / n);

  const grids = await gridsForBounds(tileWest, tileSouth, tileEast, tileNorth);
  if (!grids.length) return transparentTile();

  const lonSpan = tileEast - tileWest;
  const resX0 = Math.abs((grids[0] as FloodGrid).resX) || 0.0003;
  const cellsPerPixel = lonSpan / resX0 / TILE;

  const png = new PNG({ width: TILE, height: TILE });
  png.data.fill(0);

  if (cellsPerPixel <= 1) {
    // Zoomed in — bilinear, smooth.
    for (let py = 0; py < TILE; py++) {
      const lat = mercYToLat((y + (py + 0.5) / TILE) / n);
      for (let px = 0; px < TILE; px++) {
        const lon = ((x + (px + 0.5) / TILE) / n) * 360 - 180;
        const v = bilinearAt(grids as FloodGrid[], lat, lon);
        if (v <= 0.02) continue;
        const lo = Math.min(3, Math.floor(v));
        const hi = Math.min(3, lo + 1);
        const t = v - Math.floor(v);
        const a = STOPS[lo], b = STOPS[hi];
        const idx = (py * TILE + px) * 4;
        png.data[idx] = Math.round(a[0] + (b[0] - a[0]) * t);
        png.data[idx + 1] = Math.round(a[1] + (b[1] - a[1]) * t);
        png.data[idx + 2] = Math.round(a[2] + (b[2] - a[2]) * t);
        png.data[idx + 3] = Math.round(a[3] + (b[3] - a[3]) * t);
      }
    }
  } else {
    // Zoomed out — area-average (detailed, no dilation).
    const SS = Math.max(2, Math.min(10, Math.round(cellsPerPixel)));
    const cnt = SS * SS;
    for (let py = 0; py < TILE; py++) {
      const latRow = new Float64Array(SS);
      for (let sy = 0; sy < SS; sy++) latRow[sy] = mercYToLat((y + (py + (sy + 0.5) / SS) / TILE) / n);
      for (let px = 0; px < TILE; px++) {
        let aSum = 0, rW = 0, gW = 0, bW = 0, wSum = 0;
        for (let sy = 0; sy < SS; sy++) {
          const lat = latRow[sy];
          for (let sx = 0; sx < SS; sx++) {
            const lon = ((x + (px + (sx + 0.5) / SS) / TILE) / n) * 360 - 180;
            let v = 0;
            for (const g of grids as FloodGrid[]) {
              const s = sampleGrid(g, lat, lon);
              if (s && s > v) v = s;
            }
            const c = COLORS[v];
            if (c) { aSum += c[3]; rW += c[0] * c[3]; gW += c[1] * c[3]; bW += c[2] * c[3]; wSum += c[3]; }
          }
        }
        const a = aSum / cnt;
        if (a < 1 || wSum === 0) continue;
        const idx = (py * TILE + px) * 4;
        png.data[idx] = Math.round(rW / wSum);
        png.data[idx + 1] = Math.round(gW / wSum);
        png.data[idx + 2] = Math.round(bW / wSum);
        png.data[idx + 3] = Math.round(a);
      }
    }
  }

  return new Response(new Uint8Array(PNG.sync.write(png)), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}
