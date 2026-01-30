import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GEO_CACHE = new Map<string, { ts: number; lat: number; lon: number; label: string; boundary?: any }>();
const POLY_CACHE = new Map<string, { ts: number; poly: string; boundary: Array<[number, number]> | null }>();

const GEO_TTL = 1000 * 60 * 60 * 24 * 14;
const POLY_TTL = 1000 * 60 * 60 * 24 * 30;

// ============================================================================
// GOOGLE MAPS API KEY
// ============================================================================
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_API_KEY) {
  console.warn("⚠️ WARNING: GOOGLE_MAPS_API_KEY not set in environment variables!");
}

// ============================================================================
// KEYWORD MATCHING (for incomplete street names)
// ============================================================================

function extractKeywords(text: string): string[] {
  let normalized = text.trim().toUpperCase();
  normalized = normalized.replace(/[^\w\s]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ');
  
  const words = normalized.split(' ').filter(w => w.length > 0);
  
  const stopWords = new Set([
    'ST', 'AVE', 'RD', 'BLVD', 'LN', 'DR', 'EXT', 'OLD', 'NEW',
    'NORTH', 'SOUTH', 'EAST', 'WEST', 'EXTENSION', 'STREET', 'AVENUE', 'ROAD',
    'EXTENSION', 'INTERIOR', 'EXTERIOR', 'PHASE', 'THE', 'OF', 'AND', 'OR', 'TO', 'FROM',
    'SUBD', 'SUBDIVISION', 'COMPLEX', 'SPORTS', 'CENTER', 'MALL', 'BUILDING'
  ]);
  
  return words.filter(w => !stopWords.has(w) && w.length > 2);
}

function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  return matrix[len2][len1];
}

function calculateSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  return 1 - (distance / maxLength);
}

function keywordMatch(userKeywords: string[], mapStreet: string): number {
  if (userKeywords.length === 0) return 0;
  
  const mapKeywords = extractKeywords(mapStreet);
  if (mapKeywords.length === 0) return 0;
  
  let matches = 0;
  let totalSimilarity = 0;
  
  for (const userKw of userKeywords) {
    if (mapKeywords.includes(userKw)) {
      matches++;
      totalSimilarity += 1.0;
    } else {
      for (const mapKw of mapKeywords) {
        const sim = calculateSimilarity(userKw, mapKw);
        if (sim > 0.75) {
          matches++;
          totalSimilarity += sim;
          break;
        }
      }
    }
  }
  
  if (matches === 0) return 0;
  return totalSimilarity / userKeywords.length;
}

function findBestStreetMatch(
  userStreet: string,
  availableStreets: string[],
  threshold: number = 0.45
): { street: string; similarity: number; method: string } | null {
  
  const userKeywords = extractKeywords(userStreet);
  const userNormalized = userStreet.trim().toUpperCase();
  
  if (userKeywords.length === 0) return null;
  
  let bestMatch: { street: string; similarity: number; method: string } | null = null;
  let bestScore = 0;
  
  for (const mapStreet of availableStreets) {
    const mapNormalized = mapStreet.trim().toUpperCase();
    
    if (userNormalized === mapNormalized) {
      return { street: mapStreet, similarity: 1.0, method: "exact" };
    }
    
    const keywordScore = keywordMatch(userKeywords, mapStreet);
    
    if (keywordScore > bestScore && keywordScore >= threshold) {
      bestScore = keywordScore;
      bestMatch = {
        street: mapStreet,
        similarity: parseFloat(keywordScore.toFixed(3)),
        method: "keyword"
      };
    }
    
    if (bestScore < 0.80) {
      const fuzzyScore = calculateSimilarity(userNormalized, mapNormalized);
      
      if (fuzzyScore > bestScore && fuzzyScore >= threshold) {
        bestScore = fuzzyScore;
        bestMatch = {
          street: mapStreet,
          similarity: parseFloat(fuzzyScore.toFixed(3)),
          method: "fuzzy"
        };
      }
    }
  }
  
  return bestMatch;
}

// ============================================================================
// UTILITIES
// ============================================================================

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
    .replace(/\bLN\.?\b/gi, "Lane")
    .replace(/\bEXT\.?\b/gi, "Extension");
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

function mkViewbox(lat: number, lon: number, km = 6) {
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
  const left = lon - dLon;
  const right = lon + dLon;
  const top = lat + dLat;
  const bottom = lat - dLat;
  return `${left},${top},${right},${bottom}`;
}

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

  return best;
}

function downsampleRingLonLatToBoundary(ring: number[][], maxPoints = 220) {
  if (!ring?.length) return null;

  const step = Math.max(1, Math.ceil(ring.length / maxPoints));
  const sampled: number[][] = [];
  for (let i = 0; i < ring.length; i += step) sampled.push(ring[i]);

  const first = sampled[0];
  const last = sampled[sampled.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) sampled.push(first);

  const boundary: Array<[number, number]> = sampled.map(([lon, lat]) => [lat, lon]);
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

function pointInBoundary(lat: number, lon: number, boundary: Array<[number, number]>): boolean {
  if (!boundary || boundary.length < 3) return false;
  let inside = false;
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const xi = boundary[i][1]; // lon
    const yi = boundary[i][0]; // lat
    const xj = boundary[j][1];
    const yj = boundary[j][0];
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
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

// ============================================================================
// MAIN GEOCODE ENDPOINT - GOOGLE MAPS + OPENSTREETMAP FALLBACK
// ============================================================================

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const query = normalizePH(body?.query ?? "");
    const hintBarangay = normalizePH(body?.hintBarangay ?? "");
    const hintCityAdjRaw = normalizeCityHintForOsm(body?.hintCity ?? "", body?.hintProvince ?? "");
    const hintCity = normalizePH(hintCityAdjRaw);
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
      console.log(`[CACHE HIT] Using cached result for ${query}`);
      return NextResponse.json({ ok: true, lat: cached.lat, lon: cached.lon, displayName: cached.label, boundary: cached.boundary ?? null });
    }

    // ========================================================================
    // TRY GOOGLE MAPS FIRST (if API key available)
    // ========================================================================
    if (GOOGLE_API_KEY) {
      console.log(`[GOOGLE] Trying Google Maps for: ${query}`);
      
      const googleAddress = [street || query, vicinity, hintBarangay, hintCityAdjRaw, hintProvince, "Philippines"]
        .filter(Boolean)
        .join(", ");

      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?` +
        `address=${encodeURIComponent(googleAddress)}&key=${GOOGLE_API_KEY}`;

      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 8000);

        const res = await fetch(googleUrl, { signal: ac.signal });
        const data = await res.json();
        clearTimeout(t);

        if (data.results?.length > 0) {
          const result = data.results[0];
          const { lat, lng } = result.geometry.location;

          console.log(`[GOOGLE] ✓ Found: ${result.formatted_address}`);

          let payload = {
            ts: Date.now(),
            lat: Number(lat),
            lon: Number(lng),
            label: String(result.formatted_address),
            boundary: null as Array<[number, number]> | null,
          };

          // If barangay hint provided, attach its polygon and keep location inside
          if (hintBarangay) {
            const polyPack = await getBarangayPoly({
              barangay: hintBarangay,
              city: hintCityAdjRaw,
              province: hintProvince,
              anchor: anchor,
            });
            if (polyPack?.boundary?.length) {
              payload.boundary = polyPack.boundary;
              const inside = pointInBoundary(payload.lat, payload.lon, polyPack.boundary);
              if (!inside) {
                const c = polyCentroid(polyPack.boundary);
                if (c) {
                  payload.lat = c.lat;
                  payload.lon = c.lon;
                  payload.label = `${payload.label} (adjusted to ${hintBarangay} centroid)`;
                }
              }

              // Refine: try to match exact street within barangay polygon using OSM
              const nameToTry = street || vicinity || query;
              if (nameToTry) {
                const qAllStreets = `
[out:json][timeout:16];
(
  way["highway"](poly:"${polyPack.poly}");
);
out center;`;
                try {
                  const streetData = await overpass(qAllStreets, 16000);
                  if (streetData?.elements?.length) {
                    const allStreets = streetData.elements
                      .map((el: any) => el?.tags?.name)
                      .filter((name: any) => name);

                    const match = findBestStreetMatch(nameToTry, allStreets, 0.6);
                    if (match) {
                      const matchedEl = streetData.elements.find((el: any) => el?.tags?.name === match.street);
                      const c2 = matchedEl ? pickCenter(matchedEl) : null;
                      if (c2) {
                        payload.lat = c2.lat;
                        payload.lon = c2.lon;
                        payload.label = `${match.street} (${hintBarangay}) [OSM]`;
                      }
                    }
                  }
                } catch {}
              }
            }
          }

          GEO_CACHE.set(cacheKey, payload);
          return NextResponse.json({ ok: true, lat: payload.lat, lon: payload.lon, displayName: payload.label, boundary: payload.boundary ?? null });
        } else {
          console.log(`[GOOGLE] ✗ No results found`);
        }
      } catch (e: any) {
        console.log(`[GOOGLE] ✗ Error: ${e?.message}`);
      }
    } else {
      console.log(`[GOOGLE] ⚠️ API key not configured, skipping Google Maps`);
    }

    // ========================================================================
    // FALLBACK: BARANGAY POLYGON LOCK (if barangay selected)
    // ========================================================================
    if (hintBarangay) {
      console.log(`[POLYGON] Searching in ${hintBarangay} polygon`);
      
      const polyPack = await getBarangayPoly({
        barangay: hintBarangay,
        city: hintCityAdjRaw,
        province: hintProvince,
        anchor,
      });

      if (polyPack?.poly) {
        const qAllStreets = `
[out:json][timeout:18];
(
  way["highway"](poly:"${polyPack.poly}");
);
out center;`;

        const streetData = await overpass(qAllStreets, 16000);

        if (streetData?.elements?.length) {
          const allStreets = streetData.elements
            .map((el: any) => el?.tags?.name)
            .filter((name: any) => name);

          console.log(`[POLYGON] Found ${allStreets.length} streets in ${hintBarangay}`);

          const nameToTry = street || vicinity || query;
          const match = findBestStreetMatch(nameToTry, allStreets, 0.6);

          if (match && match.similarity >= 0.45) {
            console.log(`[POLYGON] ✓ Match: "${match.street}" (${(match.similarity * 100).toFixed(0)}%)`);
            
            const matchedEl = streetData.elements.find((el: any) => el?.tags?.name === match.street);
            if (matchedEl) {
              const c = pickCenter(matchedEl);
              if (c) {
                const payload = {
                  ts: Date.now(),
                  lat: c.lat,
                  lon: c.lon,
                  label: `${match.street} (${hintBarangay}) [OSM: ${(match.similarity * 100).toFixed(0)}%]`,
                  boundary: polyPack.boundary,
                };
                GEO_CACHE.set(cacheKey, payload);
                return NextResponse.json({ ok: true, lat: payload.lat, lon: payload.lon, displayName: payload.label, boundary: payload.boundary ?? null });
              }
            }
          }
        }

        // Use barangay centroid as fallback (stay in barangay!)
        if (polyPack.boundary?.length) {
          console.log(`[POLYGON] Using ${hintBarangay} centroid`);
          const c = polyCentroid(polyPack.boundary);
          if (c) {
            const label = [hintBarangay, hintCity, hintProvince].filter(Boolean).join(", ");
            const payload = {
              ts: Date.now(),
              lat: c.lat,
              lon: c.lon,
              label: `${label} (centroid)`,
              boundary: polyPack.boundary,
            };
            GEO_CACHE.set(cacheKey, payload);
            return NextResponse.json({ ok: true, lat: payload.lat, lon: payload.lon, displayName: payload.label, boundary: payload.boundary ?? null });
          }
        }
      }
    }

    // ========================================================================
    // FINAL FALLBACK: Nominatim (free OpenStreetMap)
    // ========================================================================
    console.log(`[NOMINATIM] Final fallback to Nominatim`);

    const base =
      `https://nominatim.openstreetmap.org/search` +
      `?format=jsonv2&addressdetails=1&limit=5&countrycodes=ph&q=${encodeURIComponent(query)}`;

    const url = anchor ? `${base}&viewbox=${encodeURIComponent(mkViewbox(anchor.lat, anchor.lon, 10))}&bounded=1` : base;

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 9000);

    let nominatimData: any;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "BIR-Zonal-Lookup/1.0 (repompojuliecor@gmail.com)",
          "Accept-Language": "en",
        },
        signal: ac.signal,
      });

      nominatimData = await res.json().catch(() => null);
      if (!res.ok) return NextResponse.json({ ok: false, error: `Nominatim ${res.status}` }, { status: 404 });
      if (!Array.isArray(nominatimData) || nominatimData.length === 0) return NextResponse.json({ ok: false, error: "No match found" }, { status: 404 });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.name === "AbortError" ? "Timeout" : e?.message ?? "Fetch failed" }, { status: 500 });
    } finally {
      clearTimeout(t);
    }

    const best = nominatimData[0];
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
    console.error("[GEOCODE ERROR]", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "geocode failed" }, { status: 500 });
  }
}

function normalizeCityHintForOsm(city: string, province?: string) {
  const c = String(city || "").toUpperCase().trim();
  const p = String(province || "").toUpperCase().trim();
  if (p.includes("CEBU")) {
    if (c.includes("CEBU SOUTH") || c.includes("CEBU NORTH")) return "Cebu City";
  }
  return city;
}