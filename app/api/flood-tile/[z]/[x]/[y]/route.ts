import { PNG } from "pngjs";
import { gridsForBounds, sampleGrid, type FloodGrid } from "../../../../../lib/floodGrid";

export const runtime = "nodejs";

// NOAH warm scale (street/terrain) and a cool blue scale (satellite, where blue
// pops on the imagery and reads as water). Chosen per-request via ?sat=1.
const WARM: Record<number, [number, number, number, number]> = {
  1: [234, 179, 8, 130],  // Low — yellow
  2: [234, 88, 12, 150],  // Moderate — orange
  3: [220, 38, 38, 175],  // High — red
};
const COOL: Record<number, [number, number, number, number]> = {
  1: [125, 211, 252, 150], // Low — sky blue
  2: [56, 165, 245, 175],  // Moderate — blue
  3: [3, 90, 175, 205],    // High — deep blue
};
function stopsFor(c: Record<number, [number, number, number, number]>): [number, number, number, number][] {
  return [[c[1][0], c[1][1], c[1][2], 0], c[1], c[2], c[3]];
}
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

// Bilinear-interpolated level at a point (max across overlapping grids). Smooth.
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

export async function GET(req: Request, ctx: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z: zs, x: xs, y: ys } = await ctx.params;
  const z = Number(zs), x = Number(xs), y = Number(ys);
  if (![z, x, y].every(Number.isFinite)) return transparentTile();

  // Palette: blue on satellite (?sat=1), NOAH warm otherwise.
  const COLORS = new URL(req.url).searchParams.get("sat") === "1" ? COOL : WARM;
  const STOPS = stopsFor(COLORS);

  const n = Math.pow(2, z);
  const tileWest = (x / n) * 360 - 180;
  const tileEast = ((x + 1) / n) * 360 - 180;
  const tileNorth = mercYToLat(y / n);
  const tileSouth = mercYToLat((y + 1) / n);

  const grids = await gridsForBounds(tileWest, tileSouth, tileEast, tileNorth);
  if (!grids.length) return transparentTile();

  const lonSpan = tileEast - tileWest;
  const resX0 = Math.abs(grids[0].resX) || 0.0003;
  const cellsPerPixel = lonSpan / resX0 / TILE; // >1 = zoomed out (many cells/pixel)

  const png = new PNG({ width: TILE, height: TILE });
  png.data.fill(0);

  if (cellsPerPixel <= 1) {
    // ZOOMED IN — magnify: bilinear interpolation between cells → smooth, not boxy.
    for (let py = 0; py < TILE; py++) {
      const lat = mercYToLat((y + (py + 0.5) / TILE) / n);
      for (let px = 0; px < TILE; px++) {
        const lon = ((x + (px + 0.5) / TILE) / n) * 360 - 180;
        const v = bilinearAt(grids, lat, lon);
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
    // ZOOMED OUT — minify: area-average the cells under each pixel (alpha-weighted),
    // exactly like the browser shrinking the scan overlay → thin rivers stay thin &
    // detailed instead of max-pool dilating them into one solid blob.
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
            for (const g of grids) {
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
