import { NextResponse, after } from "next/server";
import { fetchZonalValuesByDomain, fetchZonalIndex } from "../../lib/zonalByDomain";
import { DB_ONLY_PROVINCES } from "../../lib/dbProvinces";

export const runtime = "nodejs";
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";

function domainToProvince(domain: string): string | null {
  const host = String(domain || "").trim().toLowerCase();
  const sub = (host.split(".")[0] || host);
  if (!sub) return null;
  // explicit combined-domain preference must come first s
  if (sub.includes("negrosoccidental")) return "NEGROS OCCIDENTAL";
  if (sub.includes("negrosoriental-siquijor")) return "NEGROS ORIENTAL";
  if (sub.includes("cebu")) return "CEBU";
  if (sub.includes("bohol")) return "BOHOL";
  if (sub.includes("iloilo")) return "ILOILO"; 
  if (sub.includes("davaodelsur")) return "DAVAO DEL SUR";
  if (sub.includes("davaodelnorte-samal-compostelavalley")) return "DAVAO DEL NORTE";
  if(sub.includes("davaodeoro")) return "DAVAO DE ORO";
  if(sub.includes("davaooccidental")) return "DAVAO OCCIDENTAL";
  if(sub.includes("davaooriental")) return "DAVAO ORIENTAL";
  if(sub.includes("davaocity")) return "DAVAO CITY";
  if (sub.includes("negrosoriental") || sub.includes("negros-oriental")) return "NEGROS ORIENTAL";
  if (sub.includes("siquijor")) return "SIQUIJOR";
  if (sub.includes("zamboangadelsur")) return "ZAMBOANGA DEL SUR";
  if (sub.includes("agusandelnorte")) return "AGUSAN DEL NORTE";
  if (sub.includes("ncr1stdistrict")) return "NCR";
  if(sub.includes("ncr2nddistrict")) return "NCR";
  if(sub.includes("ncr3rddistrict")) return "NCR";
  if(sub.includes("ncr4thdistrict")) return "NCR";
  if (sub.includes("benguet")) return "BENGUET";
  if(sub.includes("ifugao")) return "IFUGAO";
  if (sub.includes("cagayan-batanes")) return "CAGAYAN";
  if(sub.includes("batanes")) return "BATANES";
  if(sub.includes("isabela")) return "ISABELA";
  if (sub.includes("abra")) return "ABRA";
  if (sub.includes("misamisoriental-camiguin")) return "MISAMIS ORIENTAL";
  if(sub.includes("camiguin")) return "CAMIGUIN";
  if(sub.includes("bukidnon")) return "BUKIDNON";
  if(sub.includes("misamiscccidental")) return "MISAMIS OCCIDENTAL";
  if(sub.includes("misamisoccidental")) return "MISAMIS OCCIDENTAL";
  if(sub.includes("lanaodelnorte")) return "LANAO DEL NORTE";
  if(sub.includes("agusandelsur")) return "AGUSAN DEL SUR";
  if(sub.includes("surigaodelnorte")) return "SURIGAO DEL NORTE";
  if(sub.includes("surigaodelsur")) return "SURIGAO DEL SUR";
  if(sub.includes("dinagat")) return "DINAGAT ISLANDS";
  if(sub.includes("kalinga-apayao")) return "KALINGA";
  if(sub.includes("apayao")) return "APAYAO";
  if(sub.includes("aklan")) return "AKLAN";
  if(sub.includes("capiz")) return "CAPIZ";
  if(sub.includes("antique")) return "ANTIQUE";
  if(sub.includes("camarinesnorte")) return "CAMARINES NORTE";
  if(sub.includes("camarinessur")) return "CAMARINES SUR";
  if(sub.includes("albay")) return "ALBAY";
  if(sub.includes("sorsogon")) return "SORSOGON";
  if(sub.includes("catanduanes")) return "CATANDUANES";
  if(sub.includes("masbate")) return "MASBATE";
  if(sub.includes("occidentalmindoro")) return "OCCIDENTAL MINDORO";
  if(sub.includes("orientalmindoro")) return "ORIENTAL MINDORO";
  if(sub.includes("marinduque")) return "MARINDUQUE";
  if(sub.includes("romblon")) return "ROMBLON";
  if(sub.includes("palawan")) return "PALAWAN";
  if(sub.includes("cavite")) return "CAVITE";
  if(sub.includes("laguna")) return "LAGUNA";
  if(sub.includes("batangas")) return "BATANGAS";
  if(sub.includes("rizal")) return "RIZAL";
  if(sub.includes("quezon")) return "QUEZON";
  if (sub.includes("aurora")) return "AURORA";
  if(sub.includes("bataan")) return "BATAAN";
  if(sub.includes("bulacan")) return "BULACAN";
  if(sub.includes("nuevaecija")) return "NUEVA ECIJA";
  if(sub.includes("pampanga")) return "PAMPANGA";
  if(sub.includes("tarlac")) return "TARLAC";
  if(sub.includes("zambales")) return "ZAMBALES";
  if(sub.includes("kalinga-apayao")) return "KALINGA";
  if(sub.includes("apayao")) return "APAYAO";
  if(sub.includes("lanaodelsur")) return "LANAO DEL SUR";
  if(sub.includes("maguindanao")) return "MAGUINDANAO";
  if(sub.includes("basilan")) return "BASILAN";
  if(sub.includes("sulu")) return "SULU";
  if(sub.includes("southernleyte")) return "SOUTHERN LEYTE";
  if(sub.includes("leyte-bilaran")) return "LEYTE"; // (before "biliran" — combined name contains it)
  if(sub.includes("biliran")) return "BILIRAN";
  if(sub.includes("mtprovince")) return "MOUNTAIN PROVINCE";
  if(sub.includes("northernsamar")) return "NORTHERN SAMAR";
  if(sub.includes("easternsamar")) return "EASTERN SAMAR";
  if(sub.includes("westernsamar")) return "WESTERN SAMAR";
  if(sub.includes("nuevavizcaya")) return "NUEVA VIZCAYA"; 
  if(sub.includes("quirino")) return "QUIRINO";
  if(sub.includes("ilocosnorte")) return "ILOCOS NORTE";
  if(sub.includes("ilocossur")) return "ILOCOS SUR";
  if(sub.includes("launion")) return "LA UNION";
  if(sub.includes("pangasinan")) return "PANGASINAN";
  if(sub.includes("southcotabato")) return "SOUTH COTABATO";
  if(sub.includes("northcotabato")) return "NORTH COTABATO";
  if(sub.includes("sultankudarat")) return "SULTAN KUDARAT";
  if(sub.includes("generalsantos")) return "GENERAL SANTOS";
  if(sub.includes("sarangani")) return "SARANGANI";
  if(sub.includes("tawitawi")) return "TAWI-TAWI";
  if(sub.includes("zamboangadelnorte")) return "ZAMBOANGA DEL NORTE";
  if(sub.includes("zamboangasibugay")) return "ZAMBOANGA SIBUGAY";


  return null;
}



type AnyRow = Record<string, any>;

function norm(v: any) {
  return String(v ?? "").trim();
}

function getVal(row: AnyRow, key: string) {
  return row?.cells?.[key]?.value ?? row?.cells?.[key]?.formattedValue ?? row?.[key] ?? "";
}

// cache: domain -> rows
const FACET_CACHE: Map<string, { ts: number; rows: AnyRow[] }> =
  (globalThis as any).__FACET_CACHE__ ?? new Map();
(globalThis as any).__FACET_CACHE__ = FACET_CACHE;

const TTL_MS = 1000 * 60 * 30; // 30 mins
const PAGE_SIZE = 1000; // good balance
const HARD_CAP_PAGES = 120; // safety (~120k rows)

// Match your zonal API loose matching
function normLoose(s: any) {
  return String(s ?? "")
    .toUpperCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\bBRGY\.?\b/g, "")
    .replace(/\bBARANGAY\b/g, "")
    .replace(/Ñ/g, "N")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
function matchesLoose(value: any, want: any) {
  const v = normLoose(value);
  const w = normLoose(want);
  if (!w) return true;
  return v === w || v.includes(w) || w.includes(v);
}

// Same barangay-number-safe logic as /api/zonal
function extractBarangayNumber(s: any): string | null {
  const t = String(s ?? "").toUpperCase();
  const m = t.match(/\b(?:BARANGAY|BRGY\.?)\s*(\d{1,4})\b/);
  if (m?.[1]) return m[1];
  const m2 = t.match(/\d{1,4}/);
  return m2 ? m2[0] : null;
}
function matchesBarangay(value: any, want: any) {
  const vn = extractBarangayNumber(value);
  const wn = extractBarangayNumber(want);

  if (vn && wn) return vn === wn;
  return normLoose(value) === normLoose(want);
}

// In-flight fetches, so concurrent identical loads share ONE download instead of
// each re-pulling all rows (the UI fires several loadCities() at once during search
// → without this it was a "cache stampede": 4× the same 23k-row fetch).
const FACET_INFLIGHT: Map<string, Promise<AnyRow[]>> =
  (globalThis as any).__FACET_INFLIGHT__ ?? new Map();
(globalThis as any).__FACET_INFLIGHT__ = FACET_INFLIGHT;

async function fetchAllDomainRows(domain: string): Promise<AnyRow[]> {
  const startTime = Date.now();
  const idx = await fetchZonalIndex(domain);
  const rowsLimit = Number(idx?.rowsLimit ?? 5000);
  const pagesNeeded = Math.min(HARD_CAP_PAGES, Math.max(1, Math.ceil(rowsLimit / PAGE_SIZE)));
  console.log(`[getAllDomainRows] Fetching ${pagesNeeded} pages for ${domain}...`);

  // Fetch with bounded concurrency and tolerate partial 5xx failures.
  const CONCURRENCY = 8; // keep upstream happy
  const results: Array<{ rows: AnyRow[] } | null> = [];
  let failed = 0;

  for (let start = 1; start <= pagesNeeded; start += CONCURRENCY) {
    const end = Math.min(pagesNeeded, start + CONCURRENCY - 1);
    const batchPromises: Array<Promise<{ rows: AnyRow[] } | null>> = [];

    for (let p = start; p <= end; p++) {
      batchPromises.push(
        fetchZonalValuesByDomain({ domain, page: p, itemsPerPage: PAGE_SIZE, search: "" })
          .then((r) => ({ rows: (Array.isArray(r?.rows) ? r.rows : []) as AnyRow[] }))
          .catch((e) => {
            failed += 1;
            console.warn(`[getAllDomainRows] page ${p} failed for ${domain}: ${e?.code || e?.response?.status}`);
            return null; // tolerate this page; continue with others
          })
      );
    }

    const settled = await Promise.all(batchPromises);
    results.push(...settled);
  }

  const all: AnyRow[] = [];
  for (const r of results) {
    if (r) all.push(...(Array.isArray(r.rows) ? r.rows : []));
  }

  if (all.length === 0) {
    const err: any = new Error(`Upstream returned no data for ${domain}. pages=${pagesNeeded}, failed=${failed}`);
    err.code = "UPSTREAM_EMPTY";
    throw err;
  }

  FACET_CACHE.set(domain, { ts: Date.now(), rows: all });
  console.log(`[getAllDomainRows] SUCCESS for ${domain} - ${all.length} rows in ${Date.now() - startTime}ms`);
  return all;
}

async function getAllDomainRows(domain: string) {
  const cached = FACET_CACHE.get(domain);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return { rows: cached.rows, fromCache: true as const };
  }

  // Coalesce: if a fetch for this domain is already running, await the SAME promise.
  let inflight = FACET_INFLIGHT.get(domain);
  if (!inflight) {
    inflight = fetchAllDomainRows(domain);
    FACET_INFLIGHT.set(domain, inflight);
    inflight.finally(() => FACET_INFLIGHT.delete(domain));
  } else {
    console.log(`[getAllDomainRows] coalesced into in-flight fetch for ${domain}`);
  }

  const rows = await inflight;
  return { rows, fromCache: false as const };
}

const STALE_AFTER_SECONDS = 60 * 60; // serve instantly; refresh in background if older than 1h
const SWR_HEADERS = { "Cache-Control": "public, max-age=600, stale-while-revalidate=86400" };

// Durable facet cache (Laravel DB). Degrades gracefully: any failure is treated as a
// miss and we fall back to the live fetch, so the dropdowns never break.
async function dbFacetGet(key: string): Promise<{ payload: string[]; ageSeconds: number | null } | null> {
  if (!BACKEND_URL) return null;
  try {
    const res = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/api/facet-cache?key=${encodeURIComponent(key)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const j = await res.json().catch(() => null);
    if (!j?.found || !Array.isArray(j.payload)) return null;
    return { payload: j.payload as string[], ageSeconds: typeof j.age_seconds === "number" ? j.age_seconds : null };
  } catch {
    return null;
  }
}

async function dbFacetSave(key: string, payload: string[]): Promise<void> {
  if (!BACKEND_URL || !payload.length) return; // never cache an empty list
  try {
    await fetch(`${BACKEND_URL.replace(/\/$/, "")}/api/facet-cache`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, payload }),
    });
  } catch {}
}

function facetResponse(mode: string, domain: string, city: string, barangay: string, list: string[], cached: boolean) {
  if (mode === "barangays") return NextResponse.json({ domain, city, barangays: list, cached }, { headers: SWR_HEADERS });
  if (mode === "classifications") return NextResponse.json({ domain, city, barangay, classifications: list, cached }, { headers: SWR_HEADERS });
  return NextResponse.json({ domain, cities: list, cached }, { headers: SWR_HEADERS });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cookieHeader = req.headers.get("cookie") || "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)authToken=([^;]+)/);
    const authToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : "";

    const domain = norm(searchParams.get("domain"));
    const mode = norm(searchParams.get("mode") ?? "cities");
    const city = norm(searchParams.get("city"));
    const barangay = norm(searchParams.get("barangay"));
    const wantRefresh = searchParams.get("refresh") === "1" || searchParams.get("nocache") === "1";

    if (!domain || !domain.includes(".") || domain.includes(" ")) {
      return NextResponse.json({ error: "Invalid domain", domain }, { status: 400 });
    }
    if (mode !== "cities" && mode !== "barangays" && mode !== "classifications") {
      return NextResponse.json({ error: "Invalid mode (use cities|barangays|classifications)" }, { status: 400 });
    }
    if (mode === "barangays" && !city) {
      return NextResponse.json({ error: "city is required" }, { status: 400 });
    }

    const cacheKey = (
      mode === "barangays" ? `barangays|${domain}|${city}`
      : mode === "classifications" ? `classifications|${domain}|${city}|${barangay}`
      : `cities|${domain}`
    ).toLowerCase();

    // 1) Durable cache → instant. If it's old, serve it now and refresh in the
    //    background (stale-while-revalidate) so the user never waits the ~5s again.
    if (!wantRefresh) {
      const cached = await dbFacetGet(cacheKey);
      if (cached && cached.payload.length) {
        if (cached.ageSeconds == null || cached.ageSeconds > STALE_AFTER_SECONDS) {
          try {
            const u = new URL(req.url);
            u.searchParams.set("refresh", "1");
            const refreshUrl = u.toString();
            after(async () => {
              try {
                await fetch(refreshUrl, { headers: { cookie: cookieHeader } });
              } catch {}
            });
          } catch {}
        }
        return facetResponse(mode, domain, city, barangay, cached.payload, true);
      }
    }

    // 2) Cache miss (or forced refresh): compute the list (same union logic as before).
    const province = domainToProvince(domain);
    let list: string[] = [];

    if (province && BACKEND_URL) {
      const base = BACKEND_URL.replace(/\/$/, "");
      const headers: Record<string, string> = { Accept: "application/json" };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      // DB-complete provinces (e.g. Cebu): use the DB facet list ONLY — no SpreadSimple
      // blend — so dropdown labels match the DB exactly (e.g. "CEBU CITY", not "CEBU").
      const dbOnly = DB_ONLY_PROVINCES.has(province);

      if (mode === "cities") {
        let j: any = null;
        try {
          const res = await fetch(`${base}/api/facets/cities?province=${encodeURIComponent(province)}`, { headers, signal: AbortSignal.timeout(10000) });
          j = await res.json().catch(() => null);
        } catch {} // timeout/backend-down → degrade gracefully
        // backend unavailable/unauthed → degrade to spreadsheet-only below (don't 502)
        const set = new Set<string>(Array.isArray(j?.cities) ? j.cities : []);
        if (!dbOnly) {
          const { rows } = await getAllDomainRows(domain);
          for (const r of rows) { const c = norm(getVal(r, "City-")); if (c) set.add(c); }
        }
        list = Array.from(set).sort((a, b) => a.localeCompare(b));
      } else if (mode === "barangays") {
        let j: any = null;
        try {
          const res = await fetch(`${base}/api/facets/barangays?province=${encodeURIComponent(province)}&city=${encodeURIComponent(city)}`, { headers, signal: AbortSignal.timeout(10000) });
          j = await res.json().catch(() => null);
        } catch {} // timeout/backend-down → degrade gracefully
        // backend unavailable/unauthed → degrade to spreadsheet-only below (don't 502)
        const set = new Set<string>(Array.isArray(j?.barangays) ? j.barangays : []);
        if (!dbOnly) {
          const { rows } = await getAllDomainRows(domain);
          for (const r of rows) {
            if (!matchesLoose(getVal(r, "City-"), city)) continue;
            const b = norm(getVal(r, "Barangay-")); if (b) set.add(b);
          }
        }
        list = Array.from(set).sort((a, b) => a.localeCompare(b));
      } else {
        const url = `${base}/api/facets/classifications?province=${encodeURIComponent(province)}${city ? `&city=${encodeURIComponent(city)}` : ""}${barangay ? `&barangay=${encodeURIComponent(barangay)}` : ""}`;
        let j: any = null;
        try {
          const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
          j = await res.json().catch(() => null);
        } catch {} // timeout/backend-down → degrade gracefully
        // backend unavailable/unauthed → degrade to spreadsheet-only below (don't 502)
        const set = new Set<string>(Array.isArray(j?.classifications) ? j.classifications : []);
        if (!dbOnly) {
          const { rows } = await getAllDomainRows(domain);
          let filtered = rows;
          if (city) filtered = filtered.filter((r) => matchesLoose(getVal(r, "City-"), city));
          if (barangay) filtered = filtered.filter((r) => matchesBarangay(getVal(r, "Barangay-"), barangay));
          for (const r of filtered) { const c = norm(getVal(r, "Classification-")); if (c) set.add(c); }
        }
        list = Array.from(set).sort((a, b) => a.localeCompare(b));
      }
    } else {
      const { rows } = await getAllDomainRows(domain);
      if (mode === "cities") {
        const set = new Set<string>();
        for (const r of rows) { const c = norm(getVal(r, "City-")); if (c) set.add(c); }
        list = Array.from(set).sort((a, b) => a.localeCompare(b));
      } else if (mode === "barangays") {
        const set = new Set<string>();
        for (const r of rows) {
          if (!matchesLoose(getVal(r, "City-"), city)) continue;
          const b = norm(getVal(r, "Barangay-")); if (b) set.add(b);
        }
        list = Array.from(set).sort((a, b) => a.localeCompare(b));
      } else {
        let filtered = rows;
        if (city) filtered = filtered.filter((r) => matchesLoose(getVal(r, "City-"), city));
        if (barangay) filtered = filtered.filter((r) => matchesBarangay(getVal(r, "Barangay-"), barangay));
        const set = new Set<string>();
        for (const r of filtered) { const c = norm(getVal(r, "Classification-")); if (c) set.add(c); }
        list = Array.from(set).sort((a, b) => a.localeCompare(b));
      }
    }

    // 3) Persist to the durable cache for next time (await so it survives serverless).
    await dbFacetSave(cacheKey, list);
    return facetResponse(mode, domain, city, barangay, list, false);
  } catch (e: any) {
    const status = e?.response?.status ?? 500;
    const code = e?.code || "UNKNOWN";
    const message = e?.message || "Unknown error";
    const url = e?.config?.url || "unknown URL";
    
    console.error("Facets API error:", {
      status,
      code,
      message,
      url,
      stack: e?.stack,
    });
    
    // If external API is down (503), return 503 instead of 500
    if (status === 503) {
      return NextResponse.json(
        { error: "External service unavailable. BIR data temporarily unreachable.", status: 503 },
        { status: 503, headers: { "Cache-Control": "public, max-age=60" } }
      );
    }
    
    return NextResponse.json(
      { error: message ?? "Unknown error", status },
      { status: 500, headers: { "Cache-Control": "public, max-age=60" } }
    );
  }
}
