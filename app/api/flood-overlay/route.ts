import { PNG } from "pngjs";
import { gridsForBounds, sampleGrid } from "../../lib/floodGrid";

export const runtime = "nodejs";

const WARM: Record<number, [number, number, number, number]> = {
  1: [234, 179, 8, 130],
  2: [234, 88, 12, 150],
  3: [220, 38, 38, 175],
};
const COOL: Record<number, [number, number, number, number]> = {
  1: [125, 211, 252, 150], // sky blue
  2: [56, 165, 245, 175],  // blue
  3: [3, 90, 175, 205],    // deep blue
};
const MAX_DIM = 1200;

function transparent(): Response {
  const png = new PNG({ width: 1, height: 1 });
  png.data.fill(0);
  return new Response(new Uint8Array(PNG.sync.write(png)), { headers: { "Content-Type": "image/png" } });
}

// GET ?minLat&maxLat&minLon&maxLon → colored flood PNG covering exactly that box
// (composited from every province that overlaps it). Used by the scan tool.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const minLat = Number(searchParams.get("minLat"));
  const maxLat = Number(searchParams.get("maxLat"));
  const minLon = Number(searchParams.get("minLon"));
  const maxLon = Number(searchParams.get("maxLon"));
  if ([minLat, maxLat, minLon, maxLon].some((v) => !Number.isFinite(v))) return transparent();

  // Blue palette on satellite (?sat=1) to match the flood tile layer; NOAH warm otherwise.
  const COLORS = searchParams.get("sat") === "1" ? COOL : WARM;

  const dLon = maxLon - minLon;
  const dLat = maxLat - minLat;
  if (dLon <= 0 || dLat <= 0) return transparent();

  const grids = await gridsForBounds(minLon, minLat, maxLon, maxLat);
  if (!grids.length) return transparent();

  // Output size at ~33 m, capped
  const res = 0.0003;
  let ow = Math.max(1, Math.round(dLon / res));
  let oh = Math.max(1, Math.round(dLat / res));
  const scale = Math.min(1, MAX_DIM / Math.max(ow, oh));
  ow = Math.max(1, Math.round(ow * scale));
  oh = Math.max(1, Math.round(oh * scale));

  const png = new PNG({ width: ow, height: oh });
  png.data.fill(0);

  for (let py = 0; py < oh; py++) {
    const lat = maxLat - ((py + 0.5) / oh) * dLat; // top→bottom
    for (let px = 0; px < ow; px++) {
      const lon = minLon + ((px + 0.5) / ow) * dLon;
      let v = 0;
      for (const g of grids) {
        const s = sampleGrid(g, lat, lon);
        if (s && s > v) v = s;
      }
      const c = COLORS[v];
      if (!c) continue;
      const idx = (py * ow + px) * 4;
      png.data[idx] = c[0];
      png.data[idx + 1] = c[1];
      png.data[idx + 2] = c[2];
      png.data[idx + 3] = c[3];
    }
  }

  return new Response(new Uint8Array(PNG.sync.write(png)), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=600" },
  });
}
