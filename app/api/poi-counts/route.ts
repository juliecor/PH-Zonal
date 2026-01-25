import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PoiItem = { name: string; lat?: number; lon?: number; type?: string };

function pickName(tags: any) {
  return String(tags?.name ?? tags?.["name:en"] ?? "").trim();
}

function pushItem(map: Map<string, PoiItem>, it: PoiItem) {
  const key = (it.name || "").toLowerCase();
  if (!key) return;
  if (!map.has(key)) map.set(key, it);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lat = Number(body?.lat);
    const lon = Number(body?.lon);
    const radius = Math.max(200, Math.min(5000, Number(body?.radius ?? 1500)));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ ok: false, error: "lat/lon required" }, { status: 400 });
    }

    // We fetch elements for each category and return names.
    const q = `
[out:json][timeout:25];
(
  nwr(around:${radius},${lat},${lon})["amenity"="hospital"];
  nwr(around:${radius},${lat},${lon})["amenity"="school"];
  nwr(around:${radius},${lat},${lon})["amenity"="police"];
  nwr(around:${radius},${lat},${lon})["amenity"="fire_station"];
  nwr(around:${radius},${lat},${lon})["amenity"="pharmacy"];
  nwr(around:${radius},${lat},${lon})["amenity"="clinic"];
);
out center;
`;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: q,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.elements) {
      return NextResponse.json({ ok: false, error: "Overpass failed" }, { status: 502 });
    }

    // collect per type
    const hospitals = new Map<string, PoiItem>();
    const schools = new Map<string, PoiItem>();
    const policeStations = new Map<string, PoiItem>();
    const fireStations = new Map<string, PoiItem>();
    const pharmacies = new Map<string, PoiItem>();
    const clinics = new Map<string, PoiItem>();

    for (const el of data.elements as any[]) {
      const tags = el?.tags ?? {};
      const amenity = String(tags.amenity ?? "");
      const name = pickName(tags);

      const cLat = el?.center?.lat ?? el?.lat;
      const cLon = el?.center?.lon ?? el?.lon;

      const item: PoiItem = { name, lat: cLat, lon: cLon, type: amenity };

      if (amenity === "hospital") pushItem(hospitals, item);
      else if (amenity === "school") pushItem(schools, item);
      else if (amenity === "police") pushItem(policeStations, item);
      else if (amenity === "fire_station") pushItem(fireStations, item);
      else if (amenity === "pharmacy") pushItem(pharmacies, item);
      else if (amenity === "clinic") pushItem(clinics, item);
    }

    const out = (m: Map<string, PoiItem>) => Array.from(m.values()).slice(0, 30);

    return NextResponse.json({
      ok: true,
      counts: {
        hospitals: hospitals.size,
        schools: schools.size,
        policeStations: policeStations.size,
        fireStations: fireStations.size,
        pharmacies: pharmacies.size,
        clinics: clinics.size,
      },
      items: {
        hospitals: out(hospitals),
        schools: out(schools),
        policeStations: out(policeStations),
        fireStations: out(fireStations),
        pharmacies: out(pharmacies),
        clinics: out(clinics),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "POI failed" }, { status: 500 });
  }
}
