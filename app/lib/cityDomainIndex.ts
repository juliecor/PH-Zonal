// DB-grounded city → { domain, exact DB city } resolver.
//
// WHY: Google's geocoder (a) still reports OLD provinces for post-split LGUs (Malita comes
// back as "Davao del Sur" but our data is under "Davao Occidental"; same for Dinagat,
// Zamboanga Sibugay, Biliran, Apayao …) and (b) writes city names differently from BIR —
// "Kidapawan"/"Caloocan" vs our "KIDAPAWAN CITY"/"CALOOCAN CITY", or "General Santos City
// (Dadiangas)". Both make a name-based lookup miss and we wrongly say "no zonal value."
//
// This resolves by the CITY, grounded in the authoritative (province, city) pairs our DB
// actually holds, and returns the EXACT DB city string so the downstream exact-match query
// hits. For the ~112 city names shared across provinces (e.g. SAN ISIDRO), Google's
// province is the tiebreaker. Returns null when unsure → callers fall back to the
// name-based resolver, so behavior is never worse than before.

import { provinceToDomain } from "./provinceDomain";

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";

// Aggressive city-name key so Google's form and BIR's form collide:
// drop parentheticals ("(Dadiangas)"), "CITY OF"/"MUNICIPALITY OF", a trailing/standalone
// "CITY", Ñ→N, and any punctuation. "GENERAL SANTOS CITY (DADIANGAS)" → "GENERAL SANTOS";
// "Kidapawan" → "KIDAPAWAN" == "KIDAPAWAN CITY". Increased collisions are resolved by the
// province tiebreaker below.
function cityKey(s: any): string {
  return String(s || "")
    .toUpperCase()
    .replace(/Ñ/g, "N")
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(CITY|MUNICIPALITY)\s+OF\b/g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\bCITY\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Entry = { domain: string; city: string };
type IndexShape = { map: Map<string, Entry[]>; builtAt: number };

const INDEX_TTL_MS = 1000 * 60 * 60; // refresh hourly
// Survive hot-reloads/route recompiles in dev so we don't rebuild on every request.
let cached: IndexShape | null = (globalThis as any).__CITY_DOMAIN_INDEX_V2__ ?? null;
let building: Promise<IndexShape | null> | null = (globalThis as any).__CITY_DOMAIN_INDEX_BUILDING_V2__ ?? null;

async function buildIndex(baseUrl: string): Promise<IndexShape | null> {
  const root = (BACKEND_URL || baseUrl).replace(/\/$/, "");
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    const res = await fetch(`${root}/api/facets/city-province-index`, {
      headers: { Accept: "application/json" },
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const pairs: any[] = Array.isArray(data?.pairs) ? data.pairs : [];
    if (!pairs.length) return null;

    const map = new Map<string, Entry[]>();
    for (const pair of pairs) {
      const province = Array.isArray(pair) ? pair[0] : pair?.province;
      const city = Array.isArray(pair) ? pair[1] : pair?.city;
      const domain = provinceToDomain(province);
      const key = cityKey(city);
      if (!domain || !key || !city) continue;
      let arr = map.get(key);
      if (!arr) { arr = []; map.set(key, arr); }
      if (!arr.some((e) => e.domain === domain && e.city === city)) arr.push({ domain, city: String(city) });
    }
    if (!map.size) return null;
    return { map, builtAt: Date.now() };
  } catch {
    return null;
  }
}

async function getIndex(baseUrl: string): Promise<IndexShape | null> {
  if (cached && Date.now() - cached.builtAt < INDEX_TTL_MS) return cached;
  if (building) return building; // a concurrent caller is already building — share it
  building = buildIndex(baseUrl).then((idx) => {
    if (idx) {
      cached = idx;
      (globalThis as any).__CITY_DOMAIN_INDEX_V2__ = idx;
    }
    building = null;
    (globalThis as any).__CITY_DOMAIN_INDEX_BUILDING_V2__ = null;
    return idx ?? cached; // if build failed but we have a stale cache, use it
  });
  (globalThis as any).__CITY_DOMAIN_INDEX_BUILDING_V2__ = building;
  return building;
}

// Among entries for one domain, prefer the DB city that equals the Google city (ignoring
// the "City" suffix), else the first — so we hand back the exact string the DB stores.
function pickCity(entries: Entry[], googleCity?: string | null): string {
  const g = cityKey(googleCity);
  const exact = entries.find((e) => cityKey(e.city) === g);
  return (exact ?? entries[0]).city;
}

/**
 * Resolve { domain, exact DB city } for a reverse-geocoded (city, province) using our DB.
 *  - city in exactly one province  → that province's domain (ignores Google's province)
 *  - city in several provinces      → the one matching Google's province, else null
 *  - city not in the DB / no index  → null  (caller falls back to the name-based resolver)
 */
export async function resolveDomainByCity(
  baseUrl: string,
  city?: string | null,
  province?: string | null,
): Promise<{ domain: string; city: string } | null> {
  const key = cityKey(city);
  if (!key) return null;
  const idx = await getIndex(baseUrl);
  if (!idx) return null;

  const entries = idx.map.get(key);
  if (entries && entries.length) {
    const domains = Array.from(new Set(entries.map((e) => e.domain)));
    if (domains.length === 1) {
      return { domain: domains[0], city: pickCity(entries, city) }; // unambiguous → trust DB
    }
    // Ambiguous city name (e.g. SAN ISIDRO): use Google's province as the tiebreaker.
    const byName = provinceToDomain(province);
    if (byName && domains.includes(byName)) {
      return { domain: byName, city: pickCity(entries.filter((e) => e.domain === byName), city) };
    }
    return null; // can't disambiguate confidently → let the caller fall back
  }

  // FUZZY fallback: Google sometimes returns a typo/near-miss locality (e.g. "Dimano"
  // for "Dimiao"). If we know the province, match the closest DB city WITHIN that
  // province only (edit distance ≤ 2) — safe because it's province-scoped.
  const provDomain = provinceToDomain(province);
  if (provDomain && key.length >= 5) {
    let best: Entry | null = null, bestD = 99;
    for (const [k, arr] of idx.map) {
      if (Math.abs(k.length - key.length) > 2) continue;
      const e = arr.find((x) => x.domain === provDomain);
      if (!e) continue;
      const d = editDistance(key, k);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (best && bestD <= 2) return { domain: best.domain, city: best.city };
  }
  return null;
}

// Levenshtein edit distance (small strings) for the fuzzy city fallback.
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
