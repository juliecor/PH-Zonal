import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CacheItem = { ts: number; data: any };
const POI_CACHE = new Map<string, CacheItem>();
const TTL_MS = 1000 * 60 * 30; // 30 minutes

function key(lat: number, lon: number, r: number) {
  // round for better cache hit rate
  const la = lat.toFixed(4);
  const lo = lon.toFixed(4);
  return `${la},${lo},${r}`;
}

async function overpass(query: string) {
  const url = "https://overpass-api.de/api/interpreter";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${text.slice(0, 140)}`);
  return JSON.parse(text);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    const radius = Math.max(100, Math.min(5000, Number(body.radius ?? 1500)));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ ok: false, error: "Invalid lat/lon" }, { status: 400 });
    }

    const k = key(lat, lon, radius);
    const cached = POI_CACHE.get(k);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      return NextResponse.json(cached.data);
    }

    // We query multiple amenity types in one request
    const q = `
[out:json][timeout:25];
(
  nwr(around:${radius},${lat},${lon})[amenity=hospital];
  nwr(around:${radius},${lat},${lon})[amenity=school];
  nwr(around:${radius},${lat},${lon})[amenity=police];
  nwr(around:${radius},${lat},${lon})[amenity=fire_station];
  nwr(around:${radius},${lat},${lon})[amenity=pharmacy];
  nwr(around:${radius},${lat},${lon})[amenity=clinic];
);
out tags;
`;

    const data = await overpass(q);
    const els = Array.isArray(data?.elements) ? data.elements : [];

    const counts = {
      hospitals: 0,
      schools: 0,
      policeStations: 0,
      fireStations: 0,
      pharmacies: 0,
      clinics: 0,
    };

    for (const el of els) {
      const a = el?.tags?.amenity;
      if (a === "hospital") counts.hospitals++;
      else if (a === "school") counts.schools++;
      else if (a === "police") counts.policeStations++;
      else if (a === "fire_station") counts.fireStations++;
      else if (a === "pharmacy") counts.pharmacies++;
      else if (a === "clinic") counts.clinics++;
    }

    const payload = { ok: true, counts };
    POI_CACHE.set(k, { ts: Date.now(), data: payload });

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "POI counts failed" },
      { status: 502 }
    );
  }
}
