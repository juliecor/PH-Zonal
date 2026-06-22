import fs from "fs";
import path from "path";

export const runtime = "nodejs";

// Serves the PH active-fault lines GeoJSON for the map overlay (vector lines).
// Cached hard — fault lines don't change often.
export async function GET() {
  try {
    const data = fs.readFileSync(path.join(process.cwd(), "fault-data", "ph_faults.geojson"), "utf8");
    return new Response(data, {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new Response(JSON.stringify({ type: "FeatureCollection", features: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
