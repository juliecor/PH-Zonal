import { PNG } from "pngjs";
import { gridsForBounds, type FloodGrid } from "../../../../../lib/floodGrid";

export const runtime = "nodejs";

const COLORS: Record<number, [number, number, number, number]> = {
  1: [234, 179, 8, 130],
  2: [234, 88, 12, 150],
  3: [220, 38, 38, 175],
};
const TILE = 256;
const SAMP = 4; // max-pool samples per axis within a pixel's footprint

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

  // Edge coordinates of the 256 pixels (257 edges)
  const lonEdges = new Float64Array(TILE + 1);
  for (let i = 0; i <= TILE; i++) lonEdges[i] = ((x + i / TILE) / n) * 360 - 180;
  const latEdges = new Float64Array(TILE + 1);
  for (let j = 0; j <= TILE; j++) latEdges[j] = mercYToLat((y + j / TILE) / n);

  // Per-grid precomputed column/row edges (so each pixel maps to a CELL BLOCK)
  const prep = grids.map((g: FloodGrid) => {
    const colEdge = new Int32Array(TILE + 1);
    for (let i = 0; i <= TILE; i++) colEdge[i] = Math.floor((lonEdges[i] - g.originX) / g.resX);
    const rowEdge = new Int32Array(TILE + 1);
    const absResY = Math.abs(g.resY);
    for (let j = 0; j <= TILE; j++) rowEdge[j] = Math.floor((g.originY - latEdges[j]) / absResY);
    return { g, colEdge, rowEdge };
  });

  const png = new PNG({ width: TILE, height: TILE });
  png.data.fill(0);

  for (let py = 0; py < TILE; py++) {
    for (let px = 0; px < TILE; px++) {
      let v = 0;
      for (const { g, colEdge, rowEdge } of prep) {
        let cA = colEdge[px], cB = colEdge[px + 1];
        let rA = rowEdge[py], rB = rowEdge[py + 1];
        if (cB < cA) [cA, cB] = [cB, cA];
        if (rB < rA) [rA, rB] = [rB, rA];
        const stepC = Math.max(1, Math.floor((cB - cA) / SAMP));
        const stepR = Math.max(1, Math.floor((rB - rA) / SAMP));
        // max-pool the cell block this pixel covers
        for (let r = rA; r <= rB; r += stepR) {
          if (r < 0 || r >= g.height) continue;
          const rowBase = r * g.width;
          for (let c = cA; c <= cB; c += stepC) {
            if (c < 0 || c >= g.width) continue;
            const s = Number(g.arr[rowBase + c]) || 0;
            if (s > v) v = s;
          }
          if (v === 3) break;
        }
        if (v === 3) break;
      }
      const col = COLORS[v];
      if (!col) continue;
      const idx = (py * TILE + px) * 4;
      png.data[idx] = col[0];
      png.data[idx + 1] = col[1];
      png.data[idx + 2] = col[2];
      png.data[idx + 3] = col[3];
    }
  }

  return new Response(new Uint8Array(PNG.sync.write(png)), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}
