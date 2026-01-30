import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PoiItem = { idKey: string; name: string; lat?: number; lon?: number; type?: string };

function pickName(tags: any) {
  return String(tags?.name ?? tags?.["name:en"] ?? "").trim();
}

function pushItem(map: Map<string, PoiItem>, it: PoiItem) {
  const key = it.idKey;
  if (!key) return;
  if (!map.has(key)) map.set(key, it);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lat = Number(body?.lat);
    const lon = Number(body?.lon);
    const radius = Math.max(100, Math.min(5000, Math.round(Number(body?.radius ?? 1500))));
    const limit = Math.max(0, Math.min(300, Number(body?.limit ?? 60)));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ ok: false, error: "lat/lon required" }, { status: 400 });
    }

    // Helper: distance in meters
    const dist = (aLat: number, aLon: number, bLat?: number, bLon?: number) => {
      if (bLat == null || bLon == null) return Number.POSITIVE_INFINITY;
      const R = 6371000;
      const dLat = ((bLat - aLat) * Math.PI) / 180;
      const dLon = ((bLon - aLon) * Math.PI) / 180;
      const s1 = Math.sin(dLat / 2);
      const s2 = Math.sin(dLon / 2);
      const c = s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
      return 2 * R * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
    };

    async function fetchAmenity(amenity: string) {
      const q = `
[out:json][timeout:25];
(
  nwr(around:${radius},${lat},${lon})["amenity"="${amenity}"];
);
out center;`;
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: q,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.elements) return [] as any[];
      return data.elements as any[];
    }

    // collect per type (split queries to avoid server caps)
    const hospitals = new Map<string, PoiItem>();
    const schools = new Map<string, PoiItem>();
    const policeStations = new Map<string, PoiItem>();
    const fireStations = new Map<string, PoiItem>();
    const pharmacies = new Map<string, PoiItem>();
    const clinics = new Map<string, PoiItem>();

    // dedup near-same-name within small distance to collapse node/way/relation triples
    function addWithNameNear(m: Map<string, PoiItem>, it: PoiItem) {
      const norm = it.name.toLowerCase();
      if (!norm) return pushItem(m, it);
      // scan small set (maps are small): if same name within 80m, skip
      for (const ex of m.values()) {
        if (ex.name.toLowerCase() === norm && dist(lat, lon, ex.lat, ex.lon) >= 0) {
          const d = dist(ex.lat ?? 0, ex.lon ?? 0, it.lat, it.lon);
          if (d < 80) return; // near duplicate
        }
      }
      pushItem(m, it);
    }

    async function collect(amenity: string, target: Map<string, PoiItem>) {
      const elements = await fetchAmenity(amenity);
      for (const el of elements) {
        const tags = el?.tags ?? {};
        const name = pickName(tags) || amenity.replace(/_/g, " ").replace(/\b\w/g, (m: string) => m.toUpperCase());
        const cLat = el?.center?.lat ?? el?.lat;
        const cLon = el?.center?.lon ?? el?.lon;
        const idKey = `${String(el?.type ?? 'n')}:${String(el?.id ?? '')}`;
        const item: PoiItem = { idKey, name, lat: cLat, lon: cLon, type: amenity };
        addWithNameNear(target, item);
      }
    }

    await collect("hospital", hospitals);
    await collect("school", schools);
    await collect("police", policeStations);
    await collect("fire_station", fireStations);
    await collect("pharmacy", pharmacies);
    await collect("clinic", clinics);

    const out = (m: Map<string, PoiItem>) => {
      const arr = Array.from(m.values());
      arr.sort((a, b) => dist(lat, lon, a.lat, a.lon) - dist(lat, lon, b.lat, b.lon));
      return limit ? arr.slice(0, limit) : arr;
    };

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
