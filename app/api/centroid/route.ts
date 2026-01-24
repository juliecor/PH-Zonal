import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE = new Map<string, { ts: number; lat: number; lon: number; label: string }>();
const TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

function cacheKey(city: string, barangay: string, province: string) {
  return `${province}|${city}|${barangay}`.toLowerCase().trim();
}

function cleanName(s: string) {
  return String(s ?? "")
    .replace(/\(.*?\)/g, "") // remove parentheses
    .replace(/\s+/g, " ")
    .trim();
}

async function overpass(query: string) {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${text.slice(0, 160)}`);
  return JSON.parse(text);
}

function pickCenter(elements: any[]) {
  for (const el of elements) {
    if (typeof el?.lat === "number" && typeof el?.lon === "number") {
      return { lat: el.lat, lon: el.lon };
    }
    if (typeof el?.center?.lat === "number" && typeof el?.center?.lon === "number") {
      return { lat: el.center.lat, lon: el.center.lon };
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const province = cleanName(body.province ?? "");
    const city = cleanName(body.city ?? "");
    const barangay = cleanName(body.barangay ?? "");

    if (!city) {
      return NextResponse.json({ ok: false, error: "city required" }, { status: 400 });
    }

    const key = cacheKey(city, barangay, province);
    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.ts < TTL) {
      return NextResponse.json({ ok: true, ...cached });
    }

    // Prefer barangay center, fallback to city center
    const targetName = barangay || city;

    const q = `
[out:json][timeout:25];
area["name"="Philippines"]->.ph;
(
  // admin boundaries
  relation(area.ph)["boundary"="administrative"]["name"~"^${targetName}$",i];
  relation(area.ph)["boundary"="administrative"]["name"~"${targetName}",i];

  // place nodes (barangay/quarter/suburb)
  node(area.ph)["place"]["name"~"^${targetName}$",i];
  node(area.ph)["place"]["name"~"${targetName}",i];

  // named ways
  way(area.ph)["name"~"^${targetName}$",i];
  way(area.ph)["name"~"${targetName}",i];
);
out center;
`;

    const data = await overpass(q);
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const center = pickCenter(elements);

    if (!center) {
      // fallback: city only
      if (barangay) {
        const q2 = `
[out:json][timeout:25];
area["name"="Philippines"]->.ph;
(
  relation(area.ph)["boundary"="administrative"]["name"~"^${city}$",i];
  relation(area.ph)["boundary"="administrative"]["name"~"${city}",i];
  node(area.ph)["place"]["name"~"^${city}$",i];
  node(area.ph)["place"]["name"~"${city}",i];
);
out center;
`;
        const data2 = await overpass(q2);
        const elements2 = Array.isArray(data2?.elements) ? data2.elements : [];
        const center2 = pickCenter(elements2);

        if (!center2) {
          return NextResponse.json({ ok: false, error: "No centroid found in OSM" }, { status: 404 });
        }

        const payload2 = { ts: Date.now(), lat: center2.lat, lon: center2.lon, label: city };
        CACHE.set(key, payload2);
        return NextResponse.json({ ok: true, ...payload2 });
      }

      return NextResponse.json({ ok: false, error: "No centroid found in OSM" }, { status: 404 });
    }

    const payload = {
      ts: Date.now(),
      lat: center.lat,
      lon: center.lon,
      label: barangay ? `${barangay}, ${city}` : city,
    };

    CACHE.set(key, payload);
    return NextResponse.json({ ok: true, ...payload });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "centroid failed" }, { status: 502 });
  }
}
