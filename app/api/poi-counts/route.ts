import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ─── Types ───────────────────────────────────────────────────────────────────

type PoiItem = {
  placeId: string;
  name: string;
  lat?: number;
  lon?: number;
  type: string;
  phone?: string | null;
  website?: string | null;
  photoUrl?: string | null;
  rating?: number | null;
  address?: string | null;
};

type PoiCategory =
  | "hospitals"
  | "schools"
  | "policeStations"
  | "fireStations"
  | "pharmacies"
  | "clinics";

// ─── In-memory cache ─────────────────────────────────────────────────────────

const POI_CACHE: Map<string, { ts: number; payload: any }> =
  (globalThis as any).__POI_CACHE__ ?? new Map();
(globalThis as any).__POI_CACHE__ = POI_CACHE;
const POI_TTL_MS = 1000 * 60 * 10; // 10 minutes

// ─── Google Places fetch (with pagination) ───────────────────────────────────

const PLACES_URL =
  "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

async function fetchAllPages(
  params: Record<string, string>,
  apiKey: string,
  maxPages = 3
): Promise<any[]> {
  const results: any[] = [];
  let pageToken: string | null = null;
  let page = 0;

  do {
    const url = new URL(PLACES_URL);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pagetoken", pageToken);

    // Google requires a short delay before using a page token
    if (pageToken) await new Promise((r) => setTimeout(r, 200));

    try {
      const res = await fetch(url.toString());
      const j: any = await res.json().catch(() => null);
      if (!j || j.status === "REQUEST_DENIED") break;
      if (Array.isArray(j.results)) results.push(...j.results);
      pageToken = j.next_page_token ?? null;
    } catch {
      break;
    }

    page++;
  } while (pageToken && page < maxPages);

  return results;
}

// ─── Build a photo URL from a Google photo reference ─────────────────────────

function buildPhotoUrl(
  reference: string | undefined,
  apiKey: string
): string | null {
  if (!reference) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=320&photo_reference=${reference}&key=${apiKey}`;
}

// ─── Map a raw Google Places result to PoiItem ───────────────────────────────

function toPoiItem(raw: any, type: string, apiKey: string): PoiItem {
  const photoRef = raw.photos?.[0]?.photo_reference;
  return {
    placeId: String(raw.place_id ?? ""),
    name: String(raw.name ?? "").trim(),
    lat: raw.geometry?.location?.lat,
    lon: raw.geometry?.location?.lng,
    type,
    phone: null, // Nearby Search doesn't return phone; use Place Details if needed
    website: null,
    photoUrl: buildPhotoUrl(photoRef, apiKey),
    rating: raw.rating ?? null,
    address: raw.vicinity ?? null,
  };
}

// ─── Name-based filters ───────────────────────────────────────────────────────

const HOSPITAL_EXCLUDE = [
  "clinic", "birthing", "dental", "eye", "optometry",
  "veterinary", "surgery center", "dialysis", "rehab",
];
const CLINIC_EXCLUDE = ["hospital", "medical center", "general hospital"];

function isLikelyHospital(name: string) {
  const l = name.toLowerCase();
  return !HOSPITAL_EXCLUDE.some((kw) => l.includes(kw));
}
function isLikelyClinic(name: string) {
  const l = name.toLowerCase();
  return !CLINIC_EXCLUDE.some((kw) => l.includes(kw));
}

// ─── Fetch one category from Google Places ───────────────────────────────────

async function fetchCategory(
  category: PoiCategory,
  lat: number,
  lon: number,
  radius: number,
  apiKey: string
): Promise<Map<string, PoiItem>> {
  const map = new Map<string, PoiItem>();
  // Overscan by +150m to avoid boundary undercounts; cap at 5km
  const base = {
    location: `${lat},${lon}`,
    radius: String(Math.min(5000, radius + 150)),
  };

  let raw: any[] = [];

  switch (category) {
    case "hospitals": {
      raw = await fetchAllPages({ ...base, type: "hospital" }, apiKey);
      break;
    }
    case "schools": {
      // Fetch schools and universities separately then merge
      const [s, u] = await Promise.all([
        fetchAllPages({ ...base, type: "school" }, apiKey),
        fetchAllPages({ ...base, type: "university" }, apiKey),
      ]);
      raw = [...s, ...u];
      break;
    }
    case "policeStations": {
      raw = await fetchAllPages({ ...base, type: "police" }, apiKey);
      break;
    }
    case "fireStations": {
      raw = await fetchAllPages({ ...base, type: "fire_station" }, apiKey);
      break;
    }
    case "pharmacies": {
      raw = await fetchAllPages({ ...base, type: "pharmacy" }, apiKey);
      break;
    }
    case "clinics": {
      // "doctor" is the closest Google type to a clinic
      raw = await fetchAllPages({ ...base, type: "doctor" }, apiKey);
      break;
    }
  }

  for (const r of raw) {
    const placeId = String(r.place_id ?? "");
    if (!placeId) continue; // no place_id = skip
    if (map.has(placeId)) continue; // exact dedup by place_id

    const name = String(r.name ?? "").trim();

    // Apply name-based filters
    if (category === "hospitals" && !isLikelyHospital(name)) continue;
    if (category === "clinics" && !isLikelyClinic(name)) continue;

    const item = toPoiItem(r, category, apiKey);
    map.set(placeId, item);
  }

  return map;
}

// ─── Distance helper (metres) ─────────────────────────────────────────────────

function dist(
  aLat: number,
  aLon: number,
  bLat?: number,
  bLon?: number
): number {
  if (bLat == null || bLon == null) return Infinity;
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const a =
    s1 * s1 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Campus-level dedup ───────────────────────────────────────────────────────
//
// Google Places gives different place_ids to sub-parts of the same institution:
//   "SWU"  /  "SWU Entrance"  /  "SWU College of Medicine"
// We strip department/building noise to get a root campus key, then collapse
// anything with the same root key that is also within CAMPUS_RADIUS metres.
//
// The item kept per group is the one with the highest rating (most prominent
// in Google's eyes), falling back to the shortest name (main campus entry).

const CAMPUS_RADIUS = 400; // metres — typical max spread of one campus

// Words/phrases that indicate a sub-part of an institution, not a separate one
const STRIP_SUFFIXES = [
  // ── Dash separator: "Hospital Name - Department" or "Hospital Name – Wing"
  // This is the most common Google naming pattern for sub-parts
  /\s*[-\u2013\u2014]\s*.+$/,

  // ── "Department/College/School/Faculty OF ___"  (e.g. "College of Medicine")
  /\s+(college|school|department|dept|faculty|institute|center|centre|division|unit|wing|section|ward)\s+of\b.*/i,

  // ── Trailing standalone noise words (campus parts)
  /\s+(entrance|main\s+entrance|gate|annex|building|campus|quadrangle|gymnasium|gym|library|chapel|dormitory|dorm|hall|auditorium|cafeteria|canteen|infirmary|office|offices|administration|admin)\b.*/i,

  // ── Trailing hospital department / unit words
  /\s+(department|dept|ward|unit|wing|section|floor|level|tower|block|pavilion|outpatient|opd|ipd|emergency|er|icu|oru|nicu|operating\s+room|delivery\s+room|laboratory|lab|pharmacy|radiology|imaging|dialysis|rehabilitation|rehab)\b.*/i,

  // ── Medical specialty names as trailing words
  /\s+(pulmonology|pulmo|cardiology|cardio|neurology|neuro|oncology|orthopedics|orthopedic|ob-gyn|obstetrics|gynecology|pediatrics|pediatric|pedia|surgery|surgical|dermatology|derma|urology|nephrology|ophthalmology|ent|psychiatry|endocrinology|gastroenterology|hematology|rheumatology|geriatrics|anesthesiology)\b.*/i,

  // ── Compass / floor / unit suffix noise
  /\s+(north|south|east|west|upper|lower|old|new|main|\b[a-z]\b|\d+)$/i,
];

function extractCampusKey(name: string): string {
  let n = name.toLowerCase().trim();
  n = n.replace(/^the\s+/, "");                    // strip leading "The"
  for (const re of STRIP_SUFFIXES) n = n.replace(re, "");
  n = n.replace(/[^a-z0-9\s]/g, "").trim();        // strip punctuation
  n = n.replace(/\s+/g, " ");
  return n;
}

function deduplicateByCampus(items: PoiItem[]): PoiItem[] {
  // Items are expected to be pre-sorted by nearest-first.
  const sorted = items;
  const kept: PoiItem[] = [];

  for (const item of sorted) {
    const keyA = extractCampusKey(item.name);

    const isDuplicate = kept.some((k) => {
      const keyB = extractCampusKey(k.name);

      // Names match if one is a prefix of the other (handles acronym vs full name)
      const nameSimilar =
        keyA === keyB ||
        (keyA.length >= 3 && keyB.startsWith(keyA)) ||
        (keyB.length >= 3 && keyA.startsWith(keyB));

      const close =
        dist(item.lat ?? 0, item.lon ?? 0, k.lat, k.lon) < CAMPUS_RADIUS;

      return nameSimilar && close;
    });

    if (!isDuplicate) kept.push(item);
  }

  return kept;
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lat = Number(body?.lat);
    const lon = Number(body?.lon);
    const radius = Math.max(
      100,
      Math.min(5000, Math.round(Number(body?.radius ?? 1500)))
    );
    const limit = Math.max(0, Math.min(300, Number(body?.limit ?? 60)));

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json(
        { ok: false, error: "lat/lon required" },
        { status: 400 }
      );
    }

    const API_KEY =
      process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

    if (!API_KEY) {
      return NextResponse.json(
        { ok: false, error: "GOOGLE_MAPS_API_KEY is not set" },
        { status: 500 }
      );
    }

    // Cache key
    const cacheKey = `${lat.toFixed(4)}|${lon.toFixed(4)}|${radius}|${limit}`;
    const hit = POI_CACHE.get(cacheKey);
    if (hit && Date.now() - hit.ts < POI_TTL_MS) {
      return NextResponse.json(hit.payload);
    }

    // Fetch all 6 categories in parallel
    const [hospitals, schools, policeStations, fireStations, pharmacies, clinics] =
      await Promise.all([
        fetchCategory("hospitals", lat, lon, radius, API_KEY),
        fetchCategory("schools", lat, lon, radius, API_KEY),
        fetchCategory("policeStations", lat, lon, radius, API_KEY),
        fetchCategory("fireStations", lat, lon, radius, API_KEY),
        fetchCategory("pharmacies", lat, lon, radius, API_KEY),
        fetchCategory("clinics", lat, lon, radius, API_KEY),
      ]);

    // Sort by distance, collapse campus duplicates, apply limit
    const out = (m: Map<string, PoiItem>): PoiItem[] => {
      // 1) Strict radius filter (exact d <= radius)
      const within = Array.from(m.values()).filter(
        (i) => dist(lat, lon, i.lat, i.lon) <= radius
      );
      // 2) Nearest-first sort so campus dedup keeps the closest representative
      within.sort(
        (a, b) => dist(lat, lon, a.lat, a.lon) - dist(lat, lon, b.lat, b.lon)
      );
      // 3) Collapse campus duplicates
      const deduped = deduplicateByCampus(within);
      // 4) Limit
      return limit ? deduped.slice(0, limit) : deduped;
    };

    const outItems = {
      hospitals:      out(hospitals),
      schools:        out(schools),
      policeStations: out(policeStations),
      fireStations:   out(fireStations),
      pharmacies:     out(pharmacies),
      clinics:        out(clinics),
    };

    const payload = {
      ok: true,
      counts: {
        hospitals:      outItems.hospitals.length,
        schools:        outItems.schools.length,
        policeStations: outItems.policeStations.length,
        fireStations:   outItems.fireStations.length,
        pharmacies:     outItems.pharmacies.length,
        clinics:        outItems.clinics.length,
      },
      items: outItems,
    };

    POI_CACHE.set(cacheKey, { ts: Date.now(), payload });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "POI fetch failed" },
      { status: 500 }
    );
  }
}