import { NextResponse } from "next/server";

export const runtime = "nodejs";

type HazardDataSource = {
  name: string;
  url: string;
  type: "flood" | "landslide" | "liquefaction" | "faults";
};

// Configure public hazard data sources
// These are sample URLs - replace with actual Philippine hazard mapping data
const HAZARD_SOURCES: HazardDataSource[] = [
  {
    name: "Philippine Flood Hazard Map",
    url: "https://mhews.dost.gov.ph/geojson/flood_hazard.geojson",
    type: "flood",
  },
  {
    name: "Philippine Landslide Hazard Map",
    url: "https://mhews.dost.gov.ph/geojson/landslide_hazard.geojson",
    type: "landslide",
  },
  {
    name: "Philippine Liquefaction Hazard Map",
    url: "https://mhews.dost.gov.ph/geojson/liquefaction_hazard.geojson",
    type: "liquefaction",
  },
  {
    name: "Philippine Fault Lines",
    url: "https://mhews.dost.gov.ph/geojson/faults.geojson",
    type: "faults",
  },
];

async function fetchHazardData(
  type: "flood" | "landslide" | "liquefaction" | "faults",
  timeout = 10000
): Promise<GeoJSON.FeatureCollection | null> {
  try {
    const source = HAZARD_SOURCES.find((s) => s.type === type);
    if (!source) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { Accept: "application/geo+json" },
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const data = await res.json();

    // Validate it's a valid GeoJSON FeatureCollection
    if (data?.type === "FeatureCollection" && Array.isArray(data?.features)) {
      return data as GeoJSON.FeatureCollection;
    }

    return null;
  } catch (err) {
    console.error(`Error fetching ${type} hazard data:`, err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lat = Number(body?.lat);
    const lon = Number(body?.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ ok: false, error: "lat/lon required" }, { status: 400 });
    }

    // Fetch all hazard types in parallel
    const [flood, landslide, liquefaction, faults] = await Promise.all([
      fetchHazardData("flood"),
      fetchHazardData("landslide"),
      fetchHazardData("liquefaction"),
      fetchHazardData("faults"),
    ]);

    return NextResponse.json({
      ok: true,
      lat,
      lon,
      hazards: {
        flood,
        landslide,
        liquefaction,
        faults,
      },
    });
  } catch (err) {
    console.error("Hazard API error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch hazard data" },
      { status: 500 }
    );
  }
}
