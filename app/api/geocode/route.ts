import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GEO_CACHE = new Map<string, { ts: number; lat: number; lon: number; label: string; boundary?: any }>();
const POLY_CACHE = new Map<string, { ts: number; poly: string; boundary: Array<[number, number]> | null }>();

const GEO_TTL = 1000 * 60 * 60 * 24 * 14; // 14d
const POLY_TTL = 1000 * 60 * 60 * 24 * 30; // 30d

function cleanName(s: any) {
  return String(s ?? "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^\p{L}\p{N}\s,.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePH(s: any) {
  return cleanName(s)
    .replace(/\bPOB\b/gi, "Poblacion")
    .replace(/\bSTO\b/gi, "Santo")
    .replace(/\bSTA\b/gi, "Santa")
    .replace(/NIÑO/gi, "Nino")
    .replace(/Ñ/gi, "N")
    .replace(/\bST\.?\b/gi, "Street")
    .replace(/\bRD\.?\b/gi, "Road")
    .replace(/\bAVE\.?\b/gi, "Avenue")
    .replace(/\bBLVD\.?\b/gi, "Boulevard")
    .replace(/\bDR\.?\b/gi, "Drive")
    .replace(/\bLN\.?\b/gi, "Lane");
}

function normLoose(s: any) {
  return normalizePH(s).toLowerCase();
}

function includesLoose(hay: any, needle: any) {
  const h = normLoose(hay);
  const n = normLoose(needle);
  if (!n) return true;
  return h.includes(n);
}

// Bounding box around anchor (km)
function mkViewbox(lat: number, lon: number, km = 6) {
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  const left = lon - dLon;
  const right = lon + dLon;
  const top = lat + dLat;
  const bottom = lat - dLat;
  return `${left},${top},${right},${bottom}`;
}

// Convert GeoJSON -> (a) boundary coords [lat,lon] (b) overpass poly string "lat lon ..."
function geojsonOuterRing(geojson: any) {
  if (!geojson) return null;

  let rings: number[][][] = [];

  if (geojson.type === "Polygon") {
    const outer = geojson.coordinates?.[0];
    if (Array.isArray(outer)) rings.push(outer);
  } else if (geojson.type === "MultiPolygon") {
    const polys = geojson.coordinates;
    if (Array.isArray(polys)) {
      for (const poly of polys) {
        const outer = poly?.[0];
        if (Array.isArray(outer)) rings.push(outer);
      }
    }
  } else {
    return null;
  }

  if (!rings.length) return null;

  // pick largest ring by rough area (shoelace)
  const area = (coords: number[][]) => {
    let sum = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const [x1, y1] = coords[i];
      const [x2, y2] = coords[i + 1];
      sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) / 2;
  };

  let best = rings[0];
  let bestA = area(best);
  for (const r of rings.slice(1)) {
    const a = area(r);
    if (a > bestA) {
      best = r;
      bestA = a;
    }
  }

  return best; // [ [lon,lat], ... ]
}

function downsampleRingLonLatToBoundary(ring: number[][], maxPoints = 220) {
  if (!ring?.length) return null;

  const step = Math.max(1, Math.ceil(ring.length / maxPoints));
  const sampled: number[][] = [];
  for (let i = 0; i < ring.length; i += step) sampled.push(ring[i]);

  const first = sampled[0];
  const last = sampled[sampled.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) sampled.push(first);

  // boundary for Leaflet wants [lat,lon]
  const boundary: Array<[number, number]> = sampled.map(([lon, lat]) => [lat, lon]);

  // poly string for Overpass wants "lat lon"
  const poly = boundary.map(([lat, lon]) => `${lat} ${lon}`).join(" ");

  return { boundary, poly };
}

function polyCentroid(boundary: Array<[number, number]>) {
  if (!boundary || boundary.length < 3) return null;
  let sumLat = 0;
  let sumLon = 0;
  for (const [lat, lon] of boundary) {
    sumLat += lat;
    sumLon += lon;
  }
  return { lat: sumLat / boundary.length, lon: sumLon / boundary.length };
}

// Build a regex that tolerates abbreviations and partial tokens
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeNameRegex(input: string) {
  const raw = normalizePH(input);
  if (!raw) return "";
  const parts = raw.split(/\s+/).filter(Boolean);

  const mapped = parts.map((tok) => {
    const t = tok.toUpperCase();

    // abbreviation tolerance
    if (t === "ST" || t === "STREET") return "(?:ST\\.?|STREET)";
    if (t === "RD" || t === "ROAD") return "(?:RD\\.?|ROAD)";
    if (t === "AVE" || t === "AVENUE") return "(?:AVE\\.?|AVENUE)";
    if (t === "BLVD" || t === "BOULEVARD") return "(?:BLVD\\.?|BOULEVARD)";
    if (t === "DR" || t === "DRIVE") return "(?:DR\\.?|DRIVE)";
    if (t === "LN" || t === "LANE") return "(?:LN\\.?|LANE)";

    // Allow partial: "MENDOZA" matches "AH Mendoza Street"
    // We'll match token as a substring inside a word boundary-ish pattern
    const safe = escapeRegex(tok);
    return `(?:${safe})`;
  });

  // allow other words between tokens
  return mapped.join(".*");
}

async function nominatimSearch(query: string, anchor?: { lat: number; lon: number } | null) {
  const base =
    `https://nominatim.openstreetmap.org/search` +
    `?format=jsonv2&addressdetails=1&limit=5&countrycodes=ph&q=${encodeURIComponent(query)}`;

  const url = anchor ? `${base}&viewbox=${encodeURIComponent(mkViewbox(anchor.lat, anchor.lon, 10))}&bounded=1` : base;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 9000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "BIR-Zonal-Lookup/1.0 (repompojuliecor@gmail.com)",
        "Accept-Language": "en",
      },
      signal: ac.signal,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false as const, error: `Nominatim ${res.status}` };
    if (!Array.isArray(data) || data.length === 0) return { ok: false as const, error: "No match" };
    return { ok: true as const, results: data };
  } catch (e: any) {
    return { ok: false as const, error: e?.name === "AbortError" ? "Timeout" : e?.message ?? "Fetch failed" };
  } finally {
    clearTimeout(t);
  }
}

async function getBarangayPoly(args: {
  barangay: string;
  city?: string;
  province?: string;
  anchor?: { lat: number; lon: number } | null;
}) {
  const b = normalizePH(args.barangay);
  if (!b) return null;

  const c = normalizePH(args.city ?? "");
  const p = normalizePH(args.province ?? "");
  const key = `${b}|${c}|${p}|${args.anchor?.lat ?? ""},${args.anchor?.lon ?? ""}`.toLowerCase();

  const hit = POLY_CACHE.get(key);
  if (hit && Date.now() - hit.ts < POLY_TTL) return hit;

  const q = c ? `${b}, ${c}, ${p}, Philippines` : `${b}, ${p}, Philippines`;

  const base =
    `https://nominatim.openstreetmap.org/search` +
    `?format=jsonv2&addressdetails=1&polygon_geojson=1&limit=3&countrycodes=ph` +
    `&q=${encodeURIComponent(q)}`;

  const url = args.anchor ? `${base}&viewbox=${encodeURIComponent(mkViewbox(args.anchor.lat, args.anchor.lon, 10))}&bounded=1` : base;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 9000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "BIR-Zonal-Lookup/1.0 (repompojuliecor@gmail.com)",
        "Accept-Language": "en",
      },
      signal: ac.signal,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data) || data.length === 0) return null;

    const best =
      data.find((x: any) => {
        const addr = x?.address ?? {};
        const cityLike = `${addr.city ?? ""} ${addr.town ?? ""} ${addr.municipality ?? ""} ${addr.county ?? ""}`;
        const stateLike = `${addr.state ?? ""} ${addr.region ?? ""}`;
        const okCity = c ? includesLoose(cityLike, c) : true;
        const okProv = p ? includesLoose(stateLike, p) : true;
        return okCity && okProv;
      }) ?? data[0];

    const ring = geojsonOuterRing(best?.geojson);
    if (!ring) return null;

    const pack = downsampleRingLonLatToBoundary(ring, 240);
    if (!pack) return null;

    const payload = { ts: Date.now(), poly: pack.poly, boundary: pack.boundary };

    POLY_CACHE.set(key, payload);
    return payload;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function overpass(query: string, timeoutMs = 16000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: query,
      signal: ac.signal,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.elements?.length) return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function pickCenter(el: any) {
  const lat = el?.center?.lat ?? el?.lat;
  const lon = el?.center?.lon ?? el?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  return { lat, lon };
}

async function overpassFindInsidePoly(name: string, poly: string) {
  const rx = makeNameRegex(name);
  if (!rx) return null;

  // 1) highways by name inside polygon
  const qStreet = `
[out:json][timeout:18];
(
  way["highway"]["name"~"${rx}",i](poly:"${poly}");
  relation["highway"]["name"~"${rx}",i](poly:"${poly}");
);
out center 10;`;

  let data = await overpass(qStreet, 16000);
  if (data?.elements?.length) {
    const el = data.elements.find((x: any) => pickCenter(x)) ?? data.elements[0];
    const c = pickCenter(el);
    if (c) return { ...c, label: el?.tags?.name ? String(el.tags.name) : name };
  }

  // 2) POIs/buildings by name inside polygon
  const qPoi = `
[out:json][timeout:18];
(
  nwr["name"~"${rx}",i](poly:"${poly}");
);
out center 10;`;

  data = await overpass(qPoi, 16000);
  if (data?.elements?.length) {
    const el = data.elements.find((x: any) => pickCenter(x)) ?? data.elements[0];
    const c = pickCenter(el);
    if (c) return { ...c, label: el?.tags?.name ? String(el.tags.name) : name };
  }

  return null;
}

async function overpassNearAnchor(name: string, anchor: { lat: number; lon: number }, radius = 3000) {
  const rx = makeNameRegex(name);
  if (!rx) return null;

  const q = `
[out:json][timeout:18];
(
  way(around:${radius},${anchor.lat},${anchor.lon})["highway"]["name"~"${rx}",i];
  relation(around:${radius},${anchor.lat},${anchor.lon})["highway"]["name"~"${rx}",i];
  nwr(around:${radius},${anchor.lat},${anchor.lon})["name"~"${rx}",i];
);
out center 10;`;

  const data = await overpass(q, 16000);
  if (!data?.elements?.length) return null;

  const el = data.elements.find((x: any) => pickCenter(x)) ?? data.elements[0];
  const c = pickCenter(el);
  if (!c) return null;

  return { ...c, label: el?.tags?.name ? String(el.tags.name) : name };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const query = normalizePH(body?.query ?? "");
    const hintBarangay = normalizePH(body?.hintBarangay ?? "");
    const hintCity = normalizePH(body?.hintCity ?? "");
    const hintProvince = normalizePH(body?.hintProvince ?? "");

    const anchorLat = body?.anchorLat != null ? Number(body.anchorLat) : null;
    const anchorLon = body?.anchorLon != null ? Number(body.anchorLon) : null;
    const anchor =
      anchorLat != null && anchorLon != null && Number.isFinite(anchorLat) && Number.isFinite(anchorLon)
        ? { lat: anchorLat, lon: anchorLon }
        : null;

    const street = normalizePH(body?.street ?? "");
    const vicinity = normalizePH(body?.vicinity ?? "");

    if (!query) return NextResponse.json({ ok: false, error: "query required" }, { status: 400 });

    const cacheKey =
      `${query}|${hintBarangay}|${hintCity}|${hintProvince}|${anchor?.lat ?? ""},${anchor?.lon ?? ""}|${street}|${vicinity}`.toLowerCase();

    const cached = GEO_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < GEO_TTL) {
      return NextResponse.json({ ok: true, lat: cached.lat, lon: cached.lon, displayName: cached.label, boundary: cached.boundary ?? null });
    }

    // STRICT: if we have barangay + anchor -> polygon lock
    if (hintBarangay && anchor) {
      const polyPack = await getBarangayPoly({
        barangay: hintBarangay,
        city: hintCity,
        province: hintProvince,
        anchor,
      });

      if (polyPack?.poly) {
        const nameToTry = street || vicinity || query;

        const inside = await overpassFindInsidePoly(nameToTry, polyPack.poly);
        if (inside) {
          const payload = {
            ts: Date.now(),
            lat: inside.lat,
            lon: inside.lon,
            label: `${inside.label} (inside ${hintBarangay})`,
            boundary: polyPack.boundary,
          };
          GEO_CACHE.set(cacheKey, payload);
          return NextResponse.json({ ok: true, lat: payload.lat, lon: payload.lon, displayName: payload.label, boundary: payload.boundary ?? null });
        }

        // centroid fallback BUT STILL inside barangay polygon
        if (polyPack.boundary?.length) {
          const c = polyCentroid(polyPack.boundary);
          if (c) {
            const label = [hintBarangay, hintCity, hintProvince].filter(Boolean).join(", ");
            const payload = {
              ts: Date.now(),
              lat: c.lat,
              lon: c.lon,
              label: label ? `${label} (centroid)` : "Barangay centroid",
              boundary: polyPack.boundary,
            };
            GEO_CACHE.set(cacheKey, payload);
            return NextResponse.json({ ok: true, lat: payload.lat, lon: payload.lon, displayName: payload.label, boundary: payload.boundary ?? null });
          }
        }
      }
    }

    // fallback: Overpass near anchor (still reduces jumping)
    if (anchor) {
      const nameToTry = street || vicinity || query;
      const near = await overpassNearAnchor(nameToTry, anchor, 3000);
      if (near) {
        const payload = { ts: Date.now(), lat: near.lat, lon: near.lon, label: `${near.label} (near anchor)` };
        GEO_CACHE.set(cacheKey, payload);
        return NextResponse.json({ ok: true, lat: payload.lat, lon: payload.lon, displayName: payload.label, boundary: null });
      }
    }

    // last fallback: bounded Nominatim
    const r = await nominatimSearch(query, anchor);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 404 });

    const best =
      r.results.find((x: any) => {
        const addr = x?.address ?? {};
        const cityLike = `${addr.city ?? ""} ${addr.town ?? ""} ${addr.municipality ?? ""} ${addr.county ?? ""}`;
        const stateLike = `${addr.state ?? ""} ${addr.region ?? ""}`;
        const suburbLike = `${addr.suburb ?? ""} ${addr.neighbourhood ?? ""} ${addr.quarter ?? ""}`;

        const okCity = hintCity ? includesLoose(cityLike, hintCity) : true;
        const okProv = hintProvince ? includesLoose(stateLike, hintProvince) : true;
        const okBrgy = hintBarangay ? includesLoose(suburbLike, hintBarangay) : true;

        return okCity && okProv && okBrgy;
      }) || r.results[0];

    const payload = {
      ts: Date.now(),
      lat: Number(best.lat),
      lon: Number(best.lon),
      label: String(best.display_name ?? query),
      boundary: null,
    };

    GEO_CACHE.set(cacheKey, payload);

    return NextResponse.json({ ok: true, lat: payload.lat, lon: payload.lon, displayName: payload.label, boundary: null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "geocode failed" }, { status: 500 });
  }
}
