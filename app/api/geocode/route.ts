import { NextResponse } from "next/server";

export const runtime = "nodejs";

// -------------------- cache --------------------
const GEO_CACHE = new Map<string, { ts: number; lat: number; lon: number; label: string }>();
const POLY_CACHE = new Map<string, { ts: number; poly: string }>();

const GEO_TTL = 1000 * 60 * 60 * 24 * 14; // 14d
const POLY_TTL = 1000 * 60 * 60 * 24 * 30; // 30d

// -------------------- helpers --------------------
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
    .replace(/Ñ/gi, "N");
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

// Rough bounding box around anchor (km)
function mkViewbox(lat: number, lon: number, km = 6) {
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  const left = lon - dLon;
  const right = lon + dLon;
  const top = lat + dLat;
  const bottom = lat - dLat;
  return `${left},${top},${right},${bottom}`; // left,top,right,bottom
}

// area for ring coords [lon,lat]
function ringArea(coords: number[][]) {
  let sum = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

// Convert GeoJSON polygon/multipolygon to Overpass poly string ("lat lon lat lon ...")
function geojsonToPoly(geojson: any, maxPoints = 220): string | null {
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

  // pick largest ring
  let best = rings[0];
  let bestA = ringArea(best);
  for (const r of rings.slice(1)) {
    const a = ringArea(r);
    if (a > bestA) {
      best = r;
      bestA = a;
    }
  }

  // downsample
  const step = Math.max(1, Math.ceil(best.length / maxPoints));
  const sampled: number[][] = [];
  for (let i = 0; i < best.length; i += step) sampled.push(best[i]);

  // close ring
  const first = sampled[0];
  const last = sampled[sampled.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    sampled.push(first);
  }

  // Overpass poly wants "lat lon"
  return sampled.map(([lon, lat]) => `${lat} ${lon}`).join(" ");
}

// centroid from Overpass poly string ("lat lon lat lon ...")
function polyCentroid(poly: string): { lat: number; lon: number } | null {
  const parts = poly.trim().split(/\s+/);
  if (parts.length < 6) return null;

  // pairs: lat lon
  const pts: Array<{ lat: number; lon: number }> = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const lat = Number(parts[i]);
    const lon = Number(parts[i + 1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push({ lat, lon });
  }
  if (pts.length < 3) return null;

  // simple average centroid (stable and fast)
  let sumLat = 0;
  let sumLon = 0;
  for (const p of pts) {
    sumLat += p.lat;
    sumLon += p.lon;
  }
  return { lat: sumLat / pts.length, lon: sumLon / pts.length };
}

// -------------------- external calls --------------------
async function nominatimSearch(query: string, anchor?: { lat: number; lon: number } | null) {
  const base =
    `https://nominatim.openstreetmap.org/search` +
    `?format=jsonv2&addressdetails=1&limit=5&countrycodes=ph&q=${encodeURIComponent(query)}`;

  const url = anchor
    ? `${base}&viewbox=${encodeURIComponent(mkViewbox(anchor.lat, anchor.lon, 10))}&bounded=1`
    : base;

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
    return {
      ok: false as const,
      error: e?.name === "AbortError" ? "Timeout" : e?.message ?? "Fetch failed",
    };
  } finally {
    clearTimeout(t);
  }
}

// Get barangay polygon (Nominatim polygon_geojson), cache it.
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
  if (hit && Date.now() - hit.ts < POLY_TTL) return hit.poly;

  const q = c ? `${b}, ${c}, ${p}, Philippines` : `${b}, ${p}, Philippines`;

  const base =
    `https://nominatim.openstreetmap.org/search` +
    `?format=jsonv2&addressdetails=1&polygon_geojson=1&limit=3&countrycodes=ph` +
    `&q=${encodeURIComponent(q)}`;

  const url = args.anchor
    ? `${base}&viewbox=${encodeURIComponent(mkViewbox(args.anchor.lat, args.anchor.lon, 10))}&bounded=1`
    : base;

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

    // choose best by city/prov hints
    const best =
      data.find((x: any) => {
        const addr = x?.address ?? {};
        const cityLike = `${addr.city ?? ""} ${addr.town ?? ""} ${addr.municipality ?? ""} ${addr.county ?? ""}`;
        const stateLike = `${addr.state ?? ""} ${addr.region ?? ""}`;
        const okCity = c ? includesLoose(cityLike, c) : true;
        const okProv = p ? includesLoose(stateLike, p) : true;
        return okCity && okProv;
      }) ?? data[0];

    const poly = geojsonToPoly(best?.geojson, 220);
    if (!poly) return null;

    POLY_CACHE.set(key, { ts: Date.now(), poly });
    return poly;
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
  const safe = normalizePH(name);
  if (!safe) return null;

  // 1) streets/roads by name
  const qStreet = `
[out:json][timeout:18];
(
  way["highway"]["name"~"${safe}",i](poly:"${poly}");
  relation["highway"]["name"~"${safe}",i](poly:"${poly}");
);
out center 10;`;

  let data = await overpass(qStreet, 16000);
  if (data?.elements?.length) {
    const el = data.elements.find((x: any) => pickCenter(x)) ?? data.elements[0];
    const c = pickCenter(el);
    if (c) return { ...c, label: el?.tags?.name ? String(el.tags.name) : safe };
  }

  // 2) building/poi by name (condos etc)
  const qPoi = `
[out:json][timeout:18];
(
  nwr["name"~"${safe}",i](poly:"${poly}");
);
out center 10;`;

  data = await overpass(qPoi, 16000);
  if (data?.elements?.length) {
    const el = data.elements.find((x: any) => pickCenter(x)) ?? data.elements[0];
    const c = pickCenter(el);
    if (c) return { ...c, label: el?.tags?.name ? String(el.tags.name) : safe };
  }

  return null;
}

async function overpassNearAnchor(name: string, anchor: { lat: number; lon: number }, radius = 3000) {
  const safe = normalizePH(name);
  if (!safe) return null;

  const q = `
[out:json][timeout:18];
(
  way(around:${radius},${anchor.lat},${anchor.lon})["highway"]["name"~"${safe}",i];
  relation(around:${radius},${anchor.lat},${anchor.lon})["highway"]["name"~"${safe}",i];
  nwr(around:${radius},${anchor.lat},${anchor.lon})["name"~"${safe}",i];
);
out center 10;`;

  const data = await overpass(q, 16000);
  if (!data?.elements?.length) return null;

  const el = data.elements.find((x: any) => pickCenter(x)) ?? data.elements[0];
  const c = pickCenter(el);
  if (!c) return null;

  return { ...c, label: el?.tags?.name ? String(el.tags.name) : safe };
}

// -------------------- route --------------------
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
      return NextResponse.json({ ok: true, lat: cached.lat, lon: cached.lon, displayName: cached.label });
    }

    // ✅ STRICT MODE: polygon lock when we have barangay + anchor
    if (hintBarangay && anchor) {
      const poly = await getBarangayPoly({
        barangay: hintBarangay,
        city: hintCity,
        province: hintProvince,
        anchor,
      });

      if (poly) {
        // try street first, then vicinity, then query
        const nameToTry = street || vicinity || query;

        const inside = await overpassFindInsidePoly(nameToTry, poly);
        if (inside) {
          const payload = {
            ts: Date.now(),
            lat: inside.lat,
            lon: inside.lon,
            label: `${inside.label} (inside ${hintBarangay})`,
          };
          GEO_CACHE.set(cacheKey, payload);
          return NextResponse.json({ ok: true, lat: payload.lat, lon: payload.lon, displayName: payload.label });
        }

        // ✅ CENTROID FALLBACK (NEW): center inside polygon
        const c = polyCentroid(poly);
        if (c) {
          const label = [hintBarangay, hintCity, hintProvince].filter(Boolean).join(", ");
          const payload = {
            ts: Date.now(),
            lat: c.lat,
            lon: c.lon,
            label: label ? `${label} (centroid)` : "Barangay centroid",
          };
          GEO_CACHE.set(cacheKey, payload);
          return NextResponse.json({ ok: true, lat: payload.lat, lon: payload.lon, displayName: payload.label });
        }
      }
    }

    // ✅ fallback: Overpass near anchor (prevents huge jumps)
    if (anchor) {
      const nameToTry = street || vicinity || query;
      const near = await overpassNearAnchor(nameToTry, anchor, 3000);
      if (near) {
        const payload = { ts: Date.now(), lat: near.lat, lon: near.lon, label: `${near.label} (near anchor)` };
        GEO_CACHE.set(cacheKey, payload);
        return NextResponse.json({ ok: true, lat: payload.lat, lon: payload.lon, displayName: payload.label });
      }
    }

    // ✅ fallback: bounded Nominatim
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
    };

    GEO_CACHE.set(cacheKey, payload);

    return NextResponse.json({ ok: true, lat: payload.lat, lon: payload.lon, displayName: payload.label });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "geocode failed" }, { status: 500 });
  }
}
