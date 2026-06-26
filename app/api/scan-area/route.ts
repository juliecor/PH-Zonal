import { NextResponse } from "next/server";
import { resolveDomainFromLocation } from "../../lib/provinceDomain";
import { resolveDomainByCity } from "../../lib/cityDomainIndex";

export const runtime = "nodejs";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Cost guards — bounded per scan, and every geocode is cached (geo_zonal) so repeat
// scans of the same area are free.
const MAX_AREAS = 8;      // distinct (city,barangay) the box maps to (wider scan → more)
const MAX_RECORDS = 160;  // records considered for geocoding
const MAX_GEOCODES = 90;  // Google street-geocodes per scan (cache hits don't count)
const GEO_CONCURRENCY = 6;

// In-memory reverse-geocode cache (cheap; a scan does ≤5 reverse lookups).
// ⚠️ Only SUCCESSFUL lookups are cached — never null. A transient Google timeout/error must
// NOT poison a point forever (that bug made a spot permanently show "no data" after one
// failure during a server hiccup). Key is versioned (__REV_GEO2__) so a reload drops any
// stale poisoned entries from the old cache.
const REV_CACHE: Map<string, { city: string; barangay: string; province: string; street: string }> =
  (globalThis as any).__REV_GEO2__ ?? new Map();
(globalThis as any).__REV_GEO2__ = REV_CACHE;

function comp(components: any[], type: string): string {
  const c = components?.find((x) => (x?.types || []).includes(type));
  return c?.long_name ? String(c.long_name).trim() : "";
}

// Reverse-geocode a point → { city, barangay, province } (best-effort, PH-aware).
// Google returns several results at different granularities; scan ALL of them so we
// catch the barangay even when it's not on the most-specific result.
async function reverseGeocode(lat: number, lon: number) {
  if (!GOOGLE_API_KEY) return null;
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (REV_CACHE.has(key)) return REV_CACHE.get(key)!;
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}` +
      `&region=ph&language=en&key=${GOOGLE_API_KEY}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 6000);
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    const data = await res.json().catch(() => null);
    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    if (!results.length) return null; // don't cache — could be a transient error, retry next time
    let city = "", barangay = "", province = "", street = "";
    for (const r of results) {
      const ac1 = r.address_components || [];
      street = street || comp(ac1, "route");
      city = city || comp(ac1, "locality") || comp(ac1, "administrative_area_level_3");
      barangay =
        barangay ||
        comp(ac1, "sublocality_level_1") ||
        comp(ac1, "neighborhood") ||
        comp(ac1, "sublocality") ||
        comp(ac1, "administrative_area_level_4") ||
        comp(ac1, "administrative_area_level_5");
      province = province || comp(ac1, "administrative_area_level_2") || comp(ac1, "administrative_area_level_1");
      if (city && barangay && street) break;
    }
    const clean = (s: string) => s.replace(/^Barangay\s+/i, "").replace(/^Brgy\.?\s+/i, "").trim();
    const out = { city: clean(city), barangay: clean(barangay), province, street: clean(street) };
    REV_CACHE.set(key, out);
    return out;
  } catch {
    return null; // transient (timeout/network) — don't cache, so it retries next scan
  }
}

async function getJson(url: string, cookie: string) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", cookie } });
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

type Rec = { street: string; barangay: string; city: string; province: string; classification: string; value: string };

// Fetch our zonal records for one (city, barangay) on the given domain (a few pages).
async function fetchRecords(baseUrl: string, cookie: string, domain: string, city: string, barangay: string, q = "", maxPages = 4): Promise<Rec[]> {
  const out: Rec[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const sp = new URLSearchParams({ domain, page: String(page), city, barangay, classification: "", q });
    const data = await getJson(`${baseUrl}/api/zonal?${sp.toString()}`, cookie);
    const rows: any[] = Array.isArray(data?.rows) ? data.rows : [];
    for (const r of rows) {
      out.push({
        street: String(r["Street/Subdivision-"] ?? "").trim(),
        barangay: String(r["Barangay-"] ?? "").trim(),
        city: String(r["City-"] ?? "").trim(),
        province: String(r["Province-"] ?? "").trim(),
        classification: String(r["Classification-"] ?? "").trim(),
        value: String(r["ZonalValuepersqm.-"] ?? "").trim(),
      });
    }
    if (!data?.hasNext || rows.length === 0) break;
  }
  return out;
}

function parseVal(v: string): number | null {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Prefer residential/commercial land values over agricultural sub-classes when
// picking THE value for a building/establishment (so a B&B shows RR, not A3 upland).
function clsRank(c: string): number {
  const u = String(c || "").toUpperCase().replace(/\s+/g, "");
  if (/^A\d/.test(u)) return 9; // agricultural sub-classes (A1..A50) always last (never the farm value for a building)
  return 0;                     // all built-up classes (RR/CR/RC/CC/I…) tie → pickBest breaks ties by HIGHEST value
}
function pickBest(rows: Rec[]): Rec | undefined {
  const withVal = rows.filter((r) => parseVal(r.value));
  if (!withVal.length) return undefined;
  return withVal.slice().sort((a, b) => {
    const ra = clsRank(a.classification), rb = clsRank(b.classification);
    if (ra !== rb) return ra - rb;
    return (parseVal(b.value) || 0) - (parseVal(a.value) || 0); // tie → higher value
  })[0];
}
// Distinctive token from a street name for a city-wide LIKE search (drops generic
// words like ST/AVE/ROAD). "Gen. Luna Ave" → "LUNA". Used when the exact barangay
// can't be resolved (e.g. Iloilo City reverse-geocodes only to a district).
const STREET_STOP = new Set(["ST","STS","STREET","AVE","AVENUE","ROAD","RD","BLVD","BOULEVARD","DRIVE","DR","EXT","EXTENSION","COR","CORNER","HIGHWAY","NATIONAL","PROVINCIAL","MUNICIPAL","BRGY","BARANGAY","ALONG","THE","DEL","DE","SAN","STA","STO"]);
function streetCore(street: string): string {
  const words = String(street || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim().split(" ");
  const keep = words.filter((w) => w.length >= 3 && !STREET_STOP.has(w));
  return keep.sort((a, b) => b.length - a.length)[0] || "";
}
const nl = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
// Pick THE value from a barangay's records: exact street → barangay "all other
// streets/interior" default → representative — always preferring residential/commercial.
function matchInRecords(recs: Rec[], bstreet: string): { match?: Rec; matchType: string } {
  const rs = nl(bstreet);
  let match: Rec | undefined; let matchType = "";
  if (rs && rs.length >= 3) {
    let streetRows = recs.filter((r) => { const s = nl(r.street); return !!s && (s === rs || s.includes(rs) || rs.includes(s)); });
    // Lenient fallback: match on the distinctive NAME token (ignoring "MH"/"M.H" punctuation
    // and St/Rd/Road/Ave suffixes) so e.g. Google "MH Aznar St" finds the DB's
    // "M.H AZNAR ROAD" (₱33,500) instead of dropping to the barangay's generic
    // "ALL OTHER STREETS" value (₱20,000). Whole-word match on a ≥4-char token only.
    if (!streetRows.length) {
      const core = streetCore(bstreet);
      if (core && core.length >= 4) streetRows = recs.filter((r) => nl(r.street).split(" ").includes(core));
    }
    match = pickBest(streetRows); if (match) matchType = "exact street";
  }
  if (!match) {
    // Barangay default / interior lot — BIR labels this variously: "ALL OTHER STREETS",
    // "ALL LOTS", "ALL AREAS", "ALL OTHER LOTS", "INTERIOR", etc.
    const defRows = recs.filter((r) => /\bALL\s+(OTHER\s+)?(STREET|STREETS|LOT|LOTS|AREA|AREAS|SUBDIVISION)\b|INTERIOR/i.test(r.street));
    match = pickBest(defRows); if (match) matchType = "barangay default (all other streets)";
  }
  if (!match) { match = pickBest(recs); if (match) matchType = "barangay (representative)"; }
  return { match, matchType };
}
// Build the "nearby zonal values" list straight from the DB records (deduped by
// street+value, highest first) — so an establishment in a city shows ALL the area's
// street values, not just the geocoded ones. Always populated for DB-backed provinces.
function buildNearby(recs: Rec[], limit = 60): any[] {
  const seen = new Set<string>(); const out: any[] = [];
  for (const r of recs) {
    const v = parseVal(r.value); if (!v) continue;
    const k = `${nl(r.street)}|${v}|${r.classification}`;
    if (seen.has(k)) continue; seen.add(k);
    out.push({ street: r.street, barangay: r.barangay, city: r.city, province: r.province, classification: r.classification, value_per_sqm: v });
  }
  // residential/commercial first, then by value desc
  out.sort((a, b) => { const ra = clsRank(a.classification), rb = clsRank(b.classification); return ra !== rb ? ra - rb : b.value_per_sqm - a.value_per_sqm; });
  return out.slice(0, limit);
}

// Barangay-default street labels ("ALL OTHER STREETS / AREAS / LOTS", "INTERIOR") — the value
// BIR assigns to any lot not specifically listed. Pool for the city-typical fallback.
const CATCHALL_STREET = /\bALL\s+(OTHER\s+)?(STREET|STREETS|LOT|LOTS|AREA|AREAS|SUBDIVISION)\b|INTERIOR/i;

// City-typical fallback: the MEDIAN built-up barangay-default value across the city — a
// representative figure (NOT the downtown max) for spots we can't pin exactly (e.g. Davao's
// numbered barangays vs Google's "Poblacion District", and side-streets not in the BIR list).
function cityRepresentative(recs: Rec[]): Rec | undefined {
  const valued = recs.filter((r) => parseVal(r.value));
  const defaults = valued.filter((r) => CATCHALL_STREET.test(r.street));
  let pool = defaults.length ? defaults : valued;
  const builtUp = pool.filter((r) => clsRank(r.classification) === 0); // RR/CR/etc, not agricultural
  if (builtUp.length) pool = builtUp;
  if (!pool.length) return undefined;
  const sorted = pool.slice().sort((a, b) => parseVal(a.value)! - parseVal(b.value)!);
  return sorted[Math.floor(sorted.length / 2)]; // median
}

// Group a BIR classification code into the land-use families the UI offers.
function clsGroupOf(c: string): string {
  const u = String(c || "").toUpperCase().replace(/\s+/g, "");
  if (/^A(\d|$)/.test(u)) return "agricultural";  // A, A1..A50
  if (/^RR/.test(u)) return "residential";
  if (/^CR|^CC|^RC/.test(u)) return "commercial";
  if (/^I/.test(u)) return "industrial";
  return "other";
}
// Per-land-use representative value for a barangay (median, preferring the "interior /
// all other streets" default rows) → powers the Agricultural / Residential / Commercial
// breakdown + lets an empty-land scan pick the AGRICULTURAL value instead of built-up.
function buildClassBreakdown(recs: Rec[]): { classes: { group: string; label: string; value: number; code: string }[]; counts: Record<string, number> } {
  const LABEL: Record<string, string> = { agricultural: "Agricultural", residential: "Residential", commercial: "Commercial", industrial: "Industrial", other: "Other" };
  const ORDER = ["agricultural", "residential", "commercial", "industrial", "other"];
  const byG: Record<string, Rec[]> = {};
  for (const r of recs) { if (!parseVal(r.value)) continue; const g = clsGroupOf(r.classification); (byG[g] = byG[g] || []).push(r); }
  const classes: { group: string; label: string; value: number; code: string }[] = [];
  const counts: Record<string, number> = {};
  for (const g of ORDER) {
    const rs = byG[g]; if (!rs || !rs.length) continue;
    counts[g] = rs.length;
    const defs = rs.filter((r) => CATCHALL_STREET.test(r.street));
    const pool = defs.length ? defs : rs;
    const sorted = pool.slice().sort((a, b) => parseVal(a.value)! - parseVal(b.value)!);
    const mid = sorted[Math.floor(sorted.length / 2)];
    classes.push({ group: g, label: LABEL[g], value: parseVal(mid.value)!, code: mid.classification });
  }
  return { classes, counts };
}

// Cache the per-(domain,city) representative (stable) so the wider fetch runs once per city.
const CITY_REP_CACHE: Map<string, Rec | null> = (globalThis as any).__CITY_REP__ ?? new Map();
(globalThis as any).__CITY_REP__ = CITY_REP_CACHE;

// Levenshtein edit distance (small strings) — for variant-spelling barangay matching.
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[m];
}

// Resolve a reverse-geocoded barangay (e.g. "Santa Cruz") to the actual DB barangay
// name (e.g. "SANTA CRUZ (POBLACION)" or "JARO - TACAS"), via the city's barangay list.
// Fixes scans that said "no data" when the value existed under a slightly different label.
async function resolveBarangay(baseUrl: string, cookie: string, domain: string, city: string, geocoded: string): Promise<string> {
  const N = (s: string) => String(s || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const g = N(geocoded);
  if (!g) return geocoded;
  try {
    const sp = new URLSearchParams({ mode: "barangays", domain, city });
    const data = await getJson(`${baseUrl}/api/facets?${sp.toString()}`, cookie);
    const list: string[] = Array.isArray(data?.barangays) ? data.barangays : [];
    if (!list.length) return geocoded;
    let m = list.find((b) => N(b) === g);                                              // exact
    if (!m) m = list.find((b) => { const n = N(b); return n.startsWith(g) || g.startsWith(n); }); // prefix
    if (!m) m = list.find((b) => { const n = N(b); return n.includes(g) || g.includes(n); });     // contains
    // Fuzzy: handle variant spellings (Google "Adlaon" vs BIR "ADLAWON"). Same-city list
    // only, capped edit-distance ≤2, and require a UNIQUE closest match to avoid collisions.
    if (!m && g.length >= 5) {
      let best: string | undefined, bestD = 3, ties = 0;
      for (const b of list) {
        const n = N(b);
        if (Math.abs(n.length - g.length) > 2) continue;     // length guard cuts obvious non-matches
        const d = editDistance(n, g);
        if (d < bestD) { bestD = d; best = b; ties = 1; }
        else if (d === bestD) ties++;
      }
      if (best && bestD <= 2 && ties === 1) m = best;          // accept only an unambiguous winner
    }
    return m || geocoded;
  } catch { return geocoded; }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const minLat = Number(body?.minLat), maxLat = Number(body?.maxLat);
    const minLon = Number(body?.minLon), maxLon = Number(body?.maxLon);
    const domain = String(body?.domain ?? "").trim();
    const mode = String(body?.mode ?? "").trim();   // "scan" = empty-land box (allow agricultural default); else a clicked spot/building
    if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite) || maxLat <= minLat || maxLon <= minLon) {
      return NextResponse.json({ ok: false, error: "valid bounds required" }, { status: 400 });
    }
    if (!domain) return NextResponse.json({ ok: false, error: "domain required" }, { status: 400 });
    if (!GOOGLE_API_KEY) return NextResponse.json({ ok: true, points: [], note: "no geocoding key" });

    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = `${proto}://${host}`;
    const cookie = req.headers.get("cookie") || "";

    const cLat0 = (minLat + maxLat) / 2, cLon0 = (minLon + maxLon) / 2;
    const isTiny = Math.max(maxLat - minLat, maxLon - minLon) < 0.012; // pointing at a spot / small block (≈1.3km) → precise per-spot lookup (avoids a neighbouring barangay's record leaking into the box)

    // BUILDING LOOKUP (boss request): a tiny scan = pointing at one building/lot. Give
    // THAT property's applicable BIR value, matched to its OWN barangay — exact street if
    // listed, else the barangay's "ALL OTHER STREETS / INTERIOR LOT" default (how BIR
    // values any lot, incl. interior). Designed to ALWAYS return a value.
    if (isTiny) {
      // Probe centre + corners so we still resolve the barangay for interior points.
      const bprobes = [[cLat0, cLon0], [maxLat, minLon], [maxLat, maxLon], [minLat, minLon], [minLat, maxLon]];
      const brevs = await Promise.all(bprobes.map(([la, lo]) => reverseGeocode(la, lo)));
      // Prefer the CENTER probe's reading (that's the spot you pointed at). Only if the
      // centre returns nothing for a field do we take the MAJORITY across probes. This stops
      // a single boundary-crossing CORNER from hijacking the barangay — which made a Sambag II
      // pin (your HQ) resolve to neighbouring Hipodromo's value.
      const fieldFrom = (key: "city" | "barangay" | "province"): string => {
        const center = brevs[0]?.[key];
        if (center) return center;
        const counts = new Map<string, number>();
        for (const r of brevs) { const v = r?.[key]; if (v) counts.set(v, (counts.get(v) || 0) + 1); }
        let best = "", bestN = 0;
        for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
        return best;
      };
      const bcity = fieldFrom("city");
      const bbrgy = fieldFrom("barangay");
      const bprov = fieldFrom("province");
      const bstreet = brevs[0]?.street || "";
      // ✅ Use the domain of the ACTUAL clicked location, not the (possibly stale)
      // dropdown domain the client sent. Resolve order:
      //   1) DB-grounded by city  → the province our data really holds this city under
      //      (fixes post-split LGUs like Malita: Google says "Davao del Sur", we store
      //       it as "Davao Occidental"),
      //   2) name-based on Google's province (covers cities not yet in our DB),
      //   3) the passed dropdown domain.
      // Each step only fires if the previous returned nothing → never worse than before.
      // dbHit also gives the EXACT DB city string (Google "Kidapawan" → "KIDAPAWAN CITY"),
      // which the downstream exact-match query needs.
      const dbHit = await resolveDomainByCity(baseUrl, bcity, bprov);
      const effDomain = dbHit?.domain || resolveDomainFromLocation(bcity, bprov) || domain;
      const effCity = dbHit?.city || bcity;
      if (effCity && bbrgy) {
        // Map the reverse-geocoded barangay to the actual DB barangay name first
        // (so "Santa Cruz" finds "SANTA CRUZ (POBLACION)" and the scan won't say "no data").
        const dbBrgy = await resolveBarangay(baseUrl, cookie, effDomain, effCity, bbrgy);
        const recs = await fetchRecords(baseUrl, cookie, effDomain, effCity, dbBrgy);
        if (recs.length) {
          const { match, matchType } = matchInRecords(recs, bstreet);
          const { classes, counts } = buildClassBreakdown(recs);
          let val = match ? parseVal(match.value) : null;
          let chosenCode = match?.classification ?? "";
          let chosenGroup = match ? clsGroupOf(match.classification) : "";
          let chosenStreet = matchType.startsWith("exact") ? (match?.street || "") : (bstreet || match?.street || "");
          // EMPTY-LAND scan over a rural (agriculture-dominant) barangay → the AGRICULTURAL
          // value applies, not the built-up default — a mountain/forest lot isn't "Commercial".
          // GUARD: only when the spot is genuinely INTERIOR — reverse-geocoding gave no real
          // road name (e.g. "Unnamed Road"). A spot on a NAMED road is frontage, so it keeps
          // its built-up RR/CR value even inside a farming barangay (fixes Mindoro West Coastal
          // Road reading A4 ₱40 instead of its RR ₱300). Only for mode:"scan", never a clicked building.
          const namedStreet = !!bstreet && bstreet.trim().length > 2 && !/unnamed|no\s*name/i.test(bstreet);
          if (mode === "scan" && !matchType.startsWith("exact") && !namedStreet) {
            const agri = classes.find((c) => c.group === "agricultural");
            const builtUp = (counts.residential || 0) + (counts.commercial || 0) + (counts.industrial || 0);
            if (agri && (counts.agricultural || 0) >= builtUp) { val = agri.value; chosenCode = agri.code; chosenGroup = "agricultural"; chosenStreet = "Interior / agricultural land"; }
          }
          if (match && val) {
            return NextResponse.json({
              ok: true, building: true, matchType, classes, defaultGroup: chosenGroup,
              nearby: buildNearby(recs),
              points: [{
                lat: cLat0, lon: cLon0, value_per_sqm: val,
                classification_code: chosenCode,
                street: chosenStreet,
                barangay: dbBrgy, city: effCity, province: match.province, matchType,
              }],
            });
          }
        }
      }
      // Right barangay, WRONG city: Google sometimes returns the wrong municipality for a
      // pin (e.g. "Iloilo City" for a Janiuay barangay). If the barangay is distinctive —
      // it exists in exactly ONE city province-wide — trust the barangay and use that city.
      if (bbrgy) {
        const prov = await fetchRecords(baseUrl, cookie, effDomain, "", bbrgy);
        const cities = Array.from(new Set(prov.map((r) => r.city.trim().toUpperCase()).filter(Boolean)));
        if (prov.length && cities.length === 1) {
          const { match, matchType } = matchInRecords(prov, bstreet);
          const val = match ? parseVal(match.value) : null;
          if (match && val) {
            return NextResponse.json({
              ok: true, building: true, matchType,
              nearby: buildNearby(prov.filter((r) => r.barangay.trim().toUpperCase() === (match!.barangay || "").trim().toUpperCase()).concat(prov)),
              points: [{
                lat: cLat0, lon: cLon0, value_per_sqm: val,
                classification_code: match.classification,
                street: matchType.startsWith("exact") ? match.street : (bstreet || match.street),
                barangay: match.barangay || bbrgy, city: match.city, province: match.province, matchType,
              }],
            });
          }
        }
      }

      // Couldn't pin the exact barangay (e.g. Iloilo City reverse-geocodes only to its
      // district "City Proper", which has 44 barangays) — match by STREET across the city.
      if (effCity && bstreet) {
        const core = streetCore(bstreet);
        if (core) {
          const srecs = await fetchRecords(baseUrl, cookie, effDomain, effCity, "", core);
          // ONLY accept records whose STREET genuinely contains the token. The city-wide `q`
          // search also matches barangay/vicinity/etc., so without this we'd borrow an
          // unrelated high-value record from another barangay. No street hit → fall through.
          const hit = srecs.filter((r) => nl(r.street).includes(core));
          const match = pickBest(hit);
          const val = match ? parseVal(match.value) : null;
          if (match && val) {
            return NextResponse.json({
              ok: true, building: true, matchType: "street",
              nearby: buildNearby(hit),
              points: [{
                lat: cLat0, lon: cLon0, value_per_sqm: val,
                classification_code: match.classification, street: match.street || bstreet,
                barangay: match.barangay || bbrgy, city: effCity, province: match.province, matchType: "street",
              }],
            });
          }
        }
      }

      // City-wide street match ONLY: if the reverse-geocoded street is actually listed
      // somewhere in this city, honor that exact street. We do NOT borrow a different
      // barangay's representative / "ALL OTHER STREETS" value — that produced wildly wrong
      // numbers (e.g. rural Adlaon showing downtown Luz's ₱46,540). Better to say "no data".
      if (effCity && dbHit && nl(bstreet).length >= 3) {
        const crecs = await fetchRecords(baseUrl, cookie, effDomain, effCity, "");
        if (crecs.length) {
          const { match, matchType } = matchInRecords(crecs, bstreet);
          const val = match ? parseVal(match.value) : null;
          if (match && val && matchType.startsWith("exact")) {
            return NextResponse.json({
              ok: true, building: true, matchType: `${matchType} (city)`,
              nearby: buildNearby(crecs.filter((r) => nl(r.barangay) === nl(match.barangay))),
              points: [{
                lat: cLat0, lon: cLon0, value_per_sqm: val,
                classification_code: match.classification, street: match.street,
                barangay: match.barangay || bbrgy, city: effCity, province: match.province, matchType,
              }],
            });
          }
        }
      }

      // City-typical fallback: we HAVE data for this city (dbHit) but couldn't pin the exact
      // barangay/street — e.g. Davao's numbered barangays vs Google's district name ("Poblacion
      // District"/"Agdao"), and side-streets not in the BIR list. Show the city's REPRESENTATIVE
      // (median) built-up value — never the downtown max — so a covered city never shows
      // "no data". Flagged cityTypical so the UI can mark it an estimate. Median cached per city.
      if (effCity && dbHit) {
        const repKey = `${effDomain}|${nl(effCity)}`;
        let rep = CITY_REP_CACHE.get(repKey);
        if (rep === undefined) {
          let pool = await fetchRecords(baseUrl, cookie, effDomain, effCity, "", "ALL OTHER", 10);
          if (!pool.length) pool = await fetchRecords(baseUrl, cookie, effDomain, effCity, "", "", 10);
          rep = cityRepresentative(pool) ?? null;
          CITY_REP_CACHE.set(repKey, rep);
        }
        const val = rep ? parseVal(rep.value) : null;
        if (rep && val) {
          const nb = await fetchRecords(baseUrl, cookie, effDomain, effCity, "", "ALL OTHER", 4);
          return NextResponse.json({
            ok: true, building: true, matchType: "city typical", cityTypical: true,
            nearby: buildNearby(nb),
            points: [{
              lat: cLat0, lon: cLon0, value_per_sqm: val,
              classification_code: rep.classification, street: "",
              barangay: bbrgy || rep.barangay, city: effCity, province: rep.province,
              matchType: "city typical", cityTypical: true,
            }],
          });
        }
      }

      // Genuinely no data for this city → tell the truth (city not imported, or no usable rows).
      if (bcity) {
        return NextResponse.json({ ok: true, building: true, noData: true, scannedCity: effCity, scannedBarangay: bbrgy, points: [] });
      }
      // else fall through to the area scan (geocodes records → nearest)
    }

    // 1) Map the box to real areas: reverse-geocode a GRID of points across the box,
    //    denser for bigger boxes so a wide scan samples more barangays.
    const cLat = (minLat + maxLat) / 2, cLon = (minLon + maxLon) / 2;
    const spanLat = maxLat - minLat, spanLon = maxLon - minLon;
    const approxKm = Math.max(spanLat, spanLon) * 111;
    const g = Math.max(1, Math.min(3, Math.round(approxKm / 1.5))); // (g+1)² probes: 2x2 … 4x4
    const probes: number[][] = [];
    for (let i = 0; i <= g; i++) {
      for (let j = 0; j <= g; j++) {
        probes.push([minLat + (spanLat * i) / g, minLon + (spanLon * j) / g]);
      }
    }
    const revs = await Promise.all(probes.map(([la, lo]) => reverseGeocode(la, lo)));
    let areas: { city: string; barangay: string; province: string }[] = [];
    const seenArea = new Set<string>();
    for (const rv of revs) {
      if (!rv?.city) continue;
      const k = `${rv.city}|${rv.barangay}`.toLowerCase();
      if (seenArea.has(k)) continue;
      seenArea.add(k);
      areas.push({ city: rv.city, barangay: rv.barangay, province: rv.province || "" });
    }
    // FOCUS: if we resolved any barangay, fetch ONLY those barangays (targeted &
    // complete → fast + accurate). Fall back to city-level only when no barangay.
    const withBrgy = areas.filter((a) => a.barangay);
    if (withBrgy.length) areas = withBrgy;
    areas = areas.slice(0, MAX_AREAS);
    if (!areas.length) return NextResponse.json({ ok: true, points: [] });

    // 2) Pull our zonal records for those areas — resolving each reverse-geocoded
    //    barangay to its real DB name first (so "Santa Cruz" → "SANTA CRUZ (POBLACION)").
    const recsNested = await Promise.all(
      areas.map(async (a) => {
        // Resolve each area to its OWN province's domain (not the stale dropdown domain),
        // and to the exact DB city string.
        const hit = await resolveDomainByCity(baseUrl, a.city, a.province);
        const aDomain = hit?.domain || resolveDomainFromLocation(a.city, a.province) || domain;
        const aCity = hit?.city || a.city;
        const dbB = a.barangay ? await resolveBarangay(baseUrl, cookie, aDomain, aCity, a.barangay) : a.barangay;
        return fetchRecords(baseUrl, cookie, aDomain, aCity, dbB);
      })
    );
    const seenRec = new Set<string>();
    const records: Rec[] = [];
    for (const list of recsNested) {
      for (const r of list) {
        const k = `${r.street}|${r.barangay}|${r.city}`.toLowerCase();
        if (!r.street || seenRec.has(k)) continue;
        seenRec.add(k);
        records.push(r);
        if (records.length >= MAX_RECORDS) break;
      }
      if (records.length >= MAX_RECORDS) break;
    }

    // 3) Geocode each record (cache-first inside /api/geocode), bounded concurrency.
    // Keep points inside the box PLUS a small margin, so a long street (one uniform
    // value) whose geocoded point lands just past the edge is still caught.
    const marginLat = Math.max(0.0015, (maxLat - minLat) * 0.15);
    const marginLon = Math.max(0.0015, (maxLon - minLon) * 0.15);
    const tinyBox = Math.max(maxLat - minLat, maxLon - minLon) < 0.005; // ~550m (house/block scan)
    const candidates: any[] = []; // every geocoded street, with distance to the box centre
    let geocoded = 0;
    for (let i = 0; i < records.length && geocoded < MAX_GEOCODES; i += GEO_CONCURRENCY) {
      const batch = records.slice(i, i + GEO_CONCURRENCY);
      const done = await Promise.all(
        batch.map(async (r) => {
          try {
            const res = await fetch(`${baseUrl}/api/geocode`, {
              method: "POST",
              headers: { "Content-Type": "application/json", cookie },
              body: JSON.stringify({
                query: [r.street, r.barangay, r.city, r.province, "Philippines"].filter(Boolean).join(", "),
                street: r.street,
                hintBarangay: r.barangay,
                hintCity: r.city,
                hintProvince: r.province,
                baseLatLon: { lat: cLat, lon: cLon },
                valuePerSqm: parseVal(r.value),
                classification: r.classification,
              }),
            });
            const j = await res.json().catch(() => null);
            if (j?.ok && Number.isFinite(Number(j.lat)) && Number.isFinite(Number(j.lon))) {
              return { r, lat: Number(j.lat), lon: Number(j.lon) };
            }
          } catch {}
          return null;
        })
      );
      geocoded += batch.length;
      for (const d of done) {
        if (!d) continue;
        const val = parseVal(d.r.value);
        if (!val) continue;
        const dx = (d.lon - cLon) * Math.cos((cLat * Math.PI) / 180);
        const dy = d.lat - cLat;
        candidates.push({
          lat: d.lat, lon: d.lon, value_per_sqm: val,
          classification_code: d.r.classification, street: d.r.street,
          barangay: d.r.barangay, city: d.r.city, province: d.r.province,
          _d2: dx * dx + dy * dy, // squared distance (degrees) for sorting
        });
      }
    }

    // Inside the box (+margin) is the normal result. But for a TINY scan (a house/lot)
    // or when nothing lands inside, fall back to the NEAREST zonal values to the centre
    // — i.e. the value of that street / the closest possible — so you always get an answer.
    const inBox = candidates.filter(
      (p) => !(p.lat < minLat - marginLat || p.lat > maxLat + marginLat || p.lon < minLon - marginLon || p.lon > maxLon + marginLon)
    );
    let chosen = inBox;
    let nearest = false;
    if (tinyBox || inBox.length === 0) {
      chosen = candidates.slice().sort((a, b) => a._d2 - b._d2).slice(0, 6); // nearest few
      nearest = chosen.length > 0;
    }
    const points = chosen.map(({ _d2, ...p }) => p);

    return NextResponse.json({ ok: true, points, areas, considered: records.length, nearest });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "scan-area failed" }, { status: 500 });
  }
}
