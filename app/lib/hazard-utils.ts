// lib/hazard-utils.ts
import * as turf from "@turf/turf";

export type HazardSummary = {
  flood: "Low" | "Moderate" | "High" | "Unknown";
  landslide: "Low" | "Moderate" | "High" | "Unknown";
  liquefaction: "Low" | "Moderate" | "High" | "Unknown";
  nearFaultMeters: number | null;
};

function levelFromFeature(f: any): "Low" | "Moderate" | "High" | "Unknown" {
  const p = f?.properties ?? {};
  const raw = String(
    p.level ??
      p.hazard ??
      p.HAZARD ??
      p.risk ??
      p.RISK ??
      p.category ??
      p.CATEGORY ??
      ""
  ).toLowerCase();

  if (!raw) return "Unknown";
  if (raw.includes("high") || raw === "3") return "High";
  if (raw.includes("moderate") || raw.includes("medium") || raw === "2") return "Moderate";
  if (raw.includes("low") || raw === "1") return "Low";
  return "Unknown";
}

export function summarizeHazards(args: {
  lat: number;
  lon: number;
  flood?: GeoJSON.FeatureCollection | null;
  landslide?: GeoJSON.FeatureCollection | null;
  liquefaction?: GeoJSON.FeatureCollection | null;
  faults?: GeoJSON.FeatureCollection | null;
}): HazardSummary {
  const pt = turf.point([args.lon, args.lat]);

  const hitLevel = (fc?: GeoJSON.FeatureCollection | null) => {
    if (!fc?.features?.length) return "Unknown" as const;
    for (const f of fc.features as any[]) {
      try {
        if (turf.booleanPointInPolygon(pt, f as any)) return levelFromFeature(f);
      } catch {
        // ignore invalid geometry
      }
    }
    return "Unknown" as const;
  };

  let nearFaultMeters: number | null = null;
  if (args.faults?.features?.length) {
    let best = Infinity;
    for (const f of args.faults.features as any[]) {
      try {
        const dKm = turf.pointToLineDistance(pt, f as any, { units: "kilometers" });
        best = Math.min(best, dKm * 1000);
      } catch {}
    }
    if (Number.isFinite(best)) nearFaultMeters = Math.round(best);
  }

  return {
    flood: hitLevel(args.flood),
    landslide: hitLevel(args.landslide),
    liquefaction: hitLevel(args.liquefaction),
    nearFaultMeters,
  };
}

export function hazardBullets(h: HazardSummary) {
  return [
    `Flood Risk: ${h.flood}`,
    `Landslide Risk: ${h.landslide}`,
    `Liquefaction Risk: ${h.liquefaction}`,
    `Nearest Fault: ${h.nearFaultMeters == null ? "Unknown" : `${h.nearFaultMeters} m`}`,
  ];
}
