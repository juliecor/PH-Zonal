import { NextResponse } from "next/server";
import { fetchZonalValuesByDomain, fetchZonalIndex } from "../../lib/zonalByDomain";
import { fuzzyMatchStreets } from "../../lib/zonal-util";

// --- Optional: DB backend (Laravel) integration for Cebu ---
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";

function domainToProvince(domain: string): string | null {
  const host = String(domain || "").trim().toLowerCase();
  if (!host) return null;
  const sub = host.split(".")[0] || host; // handle apex domains like negrosoriental-siquijor.com
  // Flexible includes-based matching to support combined domains (e.g., negrosoriental-siquijor)
  if (sub.includes("negrosoriental-siquijor")) return "NEGROS ORIENTAL"; // explicit preference
  if (sub.includes("cebu")) return "CEBU";
  if (sub.includes("bohol")) return "BOHOL";
  if (sub.includes("iloilo")) return "ILOILO";
  if (sub.includes("davaodelsur")) return "DAVAO DEL SUR";
  if (sub.includes("davaodelnorte-samal-compostelavalley")) return "DAVAO DEL NORTE";
  if (sub.includes("zamboangadelsur")) return "ZAMBOANGA DEL SUR";
  if (sub.includes("agusandelnorte")) return "AGUSAN DEL NORTE";
  if (sub.includes("ncr1stdistrict")) return "NCR";
  if (sub.includes("benguet")) return "BENGUET";
  if (sub.includes("cagayan-batanes")) return "CAGAYAN";
  if (sub.includes("abra")) return "ABRA";
  if (sub.includes("misamisoriental-camiguin")) return "CAMIGUIN-MISAMISORIENTAL";
  if(sub.includes("agusandelsur")) return "AGUSAN DEL SUR";
  if(sub.includes("kalinga-apayao")) return "KALINGA";
  if(sub.includes("aklan")) return "AKLAN";
  if (sub.includes("aurora")) return "AURORA";
  if(sub.includes("laguna")) return "LAGUNA";
  if (sub.includes("lanaodelsur")) return "LANAO DEL SUR";
  if (sub.includes("leyte-bilaran")) return "LEYTE";
  if(sub.includes("mtprovince")) return "MOUNTAIN PROVINCE";
  if(sub.includes("northernsamar")) return "NORTHERN SAMAR";
  if(sub.includes("nuevavizcaya")) return "NUEVA VIZCAYA"; 
  if(sub.includes("quirino")) return "QUIRINO";
  if(sub.includes("southcotabato")) return "SOUTH COTABATO";
  if(sub.includes("tawitawi")) return "TAWI-TAWI";
  if(sub.includes("zamboangadelnorte")) return "ZAMBOANGA DEL NORTE";
  if(sub.includes("zamboangasibugay")) return "ZAMBOANGA SIBUGAY";
  if(sub.includes("zamboangadelsur")) return "ZAMBOANGA DEL SUR";

  return null;
}

function formatMoney(n: any): string {
  const v = Number(n);
  if (!isFinite(v)) return String(n ?? "");
  return v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchFromDbBackend(args: {
  province: string;
  page: number;
  city?: string;
  barangay?: string;
  classification?: string;
  q?: string;
  itemsPerPage: number;
  token?: string | null;
}) {
  if (!BACKEND_URL) throw new Error("BACKEND_URL not configured");
  const { province, page, city = "", barangay = "", classification = "", q = "", itemsPerPage, token } = args;

  const params = new URLSearchParams();
  params.set("province", province);
  if (city) params.set("city", city);
  if (barangay) params.set("barangay", barangay);
  // Pass code-like classifications only (e.g., GP, RR, CR, A50)
  if (/^[A-Z0-9-]{1,5}$/.test(classification)) params.set("classification_code", classification);
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("per_page", String(itemsPerPage));

  const url = `${BACKEND_URL.replace(/\/$/, "")}/api/zonal-values?${params.toString()}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Backend failed: ${res.status}${t ? ` — ${t}` : ""}`);
  }
  const j = await res.json();

  const data = Array.isArray(j?.data) ? j.data : [];
  const currentPage = Number(j?.current_page ?? page ?? 1);
  const perPage = Number(j?.per_page ?? itemsPerPage ?? 16);
  const total = Number(j?.total ?? data.length);
  const lastPage = Number((j?.last_page ?? Math.ceil(total / perPage)) || 1);

  const rows = data.map((r: any, idx: number) => ({
    rowIndex: r?.id ?? idx,
    route: undefined,
    "Street/Subdivision-": String(r?.street_location ?? ""),
    "Vicinity-": String(r?.vicinity ?? ""),
    "Barangay-": String(r?.barangay ?? ""),
    "City-": String(r?.city_municipality ?? ""),
    "Province-": String(r?.province ?? ""),
    "Classification-": String(r?.classification_code ?? ""),
    "ZonalValuepersqm.-": formatMoney(r?.value_per_sqm),
    __zonal_raw: r?.value_per_sqm,
  }));

  return {
    page: currentPage,
    rows,
    itemsPerPage: perPage,
    totalRows: total,
    pageCount: lastPage,
    hasPrev: currentPage > 1,
    hasNext: currentPage < lastPage,
  };
}

export const runtime = "nodejs";

type AnyRow = Record<string, any>;

// ---- SMART PAGE CACHE (only cache requested pages, not everything!) ----
const ZONAL_PAGE_CACHE: Map<string, Map<number, { ts: number; rows: AnyRow[] }>> = 
  (globalThis as any).__ZONAL_PAGE_CACHE__ ?? new Map();
(globalThis as any).__ZONAL_PAGE_CACHE__ = ZONAL_PAGE_CACHE;

const PAGE_TTL_MS = 1000 * 60 * 30; // 30 minutes per page

// Metadata cache (fast lookup of total rows, etc)
const ZONAL_META_CACHE: Map<string, { ts: number; totalRows: number }> =
  (globalThis as any).__ZONAL_META_CACHE__ ?? new Map();
(globalThis as any).__ZONAL_META_CACHE__ = ZONAL_META_CACHE;
const META_TTL_MS = 1000 * 60 * 60; // 1 hour

// --- Google canonicalization (cache) ---
const G_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "";
const CANON_CACHE: Map<string, { ts: number; name: string }> = (globalThis as any).__ZONAL_CANON_CACHE__ ?? new Map();
(globalThis as any).__ZONAL_CANON_CACHE__ = CANON_CACHE;
const CANON_TTL = 1000 * 60 * 60 * 12; // 12h

async function canonicalizeStreetWithGoogle(q: string, barangay: string, city: string) {
  try {
    if (!G_KEY) return null;
    const key = `${q}|${barangay}|${city}`.toLowerCase();
    const hit = CANON_CACHE.get(key);
    if (hit && Date.now() - hit.ts < CANON_TTL) return hit.name;

    const address = [q, barangay, city, "Philippines"].filter(Boolean).join(", ");
    let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=ph&result_type=route&key=${G_KEY}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 1200);
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    const j = await res.json().catch(() => null);
    const r = Array.isArray(j?.results) && j.results.length ? j.results[0] : null;
    if (!r) return null;
    const comp = Array.isArray(r.address_components)
      ? r.address_components.find((c: any) => (c?.types || []).includes("route"))
      : null;
    const longName = (comp?.long_name || r?.formatted_address || "").trim();
    if (!longName) return null;
    CANON_CACHE.set(key, { ts: Date.now(), name: longName });
    return longName;
  } catch {
    return null;
  }
}

const PAGE_SIZE = 1000; // Fetch 1000 at a time from source (fast)
const MAX_PAGES = 150; // Safety cap
const PARALLEL_FETCH = 3; // Fetch 3 pages in parallel (instead of 1 at a time)

function getVal(row: AnyRow, key: string) {
  return (
    row?.cells?.[key]?.value ??
    row?.cells?.[key]?.formattedValue ??
    row?.[key] ??
    ""
  );
}

function norm(s: any) {
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
  const v = norm(value);
  const w = norm(want);
  if (!w) return true;
  return v === w || v.includes(w) || w.includes(v);
}

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
  return norm(value) === norm(want);
}

// ✅ Fetch ONLY the page you need (lazy loading)
async function getPageRows(domain: string, pageNum: number) {
  let domainCache = ZONAL_PAGE_CACHE.get(domain);
  if (!domainCache) {
    domainCache = new Map();
    ZONAL_PAGE_CACHE.set(domain, domainCache);
  }

  const cached = domainCache.get(pageNum);
  if (cached && Date.now() - cached.ts < PAGE_TTL_MS) {
    console.log(`[CACHE HIT] Domain ${domain}, page ${pageNum}`);
    return cached.rows;
  }

  console.log(`[FETCH] Domain ${domain}, page ${pageNum}`);
  
  const data = await fetchZonalValuesByDomain({
    domain,
    page: pageNum,
    itemsPerPage: PAGE_SIZE,
    search: "",
  });

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  
  domainCache.set(pageNum, { ts: Date.now(), rows });
  return rows;
}

// ✅ NEW: Get total row count (cached for 1 hour)
async function getDomainMetadata(domain: string) {
  const cached = ZONAL_META_CACHE.get(domain);
  if (cached && Date.now() - cached.ts < META_TTL_MS) {
    console.log(`[META CACHE HIT] Domain ${domain}`);
    return cached;
  }

  console.log(`[META FETCH] Domain ${domain}`);
  
  const data = await fetchZonalValuesByDomain({
    domain,
    page: 1,
    itemsPerPage: PAGE_SIZE,
    search: "",
  });

  const totalRows = Number(data?.meta?.totalRows ?? 0);
  const result = { ts: Date.now(), totalRows };
  
  ZONAL_META_CACHE.set(domain, result);
  return result;
}

// ✅ NEW: Smart filter function that only evaluates necessary rows
function filterRow(row: AnyRow, filters: { city?: string; barangay?: string; classification?: string; q?: string }) {
  const { city, barangay, classification, q } = filters;

  // City + Barangay (must be together)
  if (city && barangay) {
    if (!matchesLoose(getVal(row, "City-"), city)) return false;
    if (!matchesBarangay(getVal(row, "Barangay-"), barangay)) return false;
  } else {
    if (city && !matchesLoose(getVal(row, "City-"), city)) return false;
    if (barangay && !matchesBarangay(getVal(row, "Barangay-"), barangay)) return false;
  }

  // Classification
  if (classification && !matchesLoose(getVal(row, "Classification-"), classification)) {
    return false;
  }

  // Text search (fuzzy match on street/vicinity)
  if (q) {
    const qn = norm(q);
    const street = String(getVal(row, "Street/Subdivision-") ?? "");
    const vicinity = String(getVal(row, "Vicinity-") ?? "");
    const barangay = String(getVal(row, "Barangay-") ?? "");
    const city = String(getVal(row, "City-") ?? "");
    const province = String(getVal(row, "Province-") ?? "");
    const classification = String(getVal(row, "Classification-") ?? "");
    
    const joined = `${street} ${vicinity} ${barangay} ${city} ${province} ${classification}`;
    if (!norm(joined).includes(qn)) {
      const candidates = [street, vicinity].filter(Boolean);
      if (candidates.length === 0) return false;
      const matches = fuzzyMatchStreets(qn, candidates, 3);
      if (matches.length === 0) return false;
    }
  }

  return true;
}

// ✅ NEW: Parallel page fetching - fetch multiple pages at once instead of sequential!
async function getMultiplePagesParallel(domain: string, pageNums: number[]) {
  const promises = pageNums.map((pageNum) => getPageRows(domain, pageNum));
  const results = await Promise.all(promises);
  
  const combined: AnyRow[] = [];
  for (const rows of results) {
    combined.push(...rows);
  }
  
  return combined;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cookieHeader = req.headers.get("cookie") || "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)authToken=([^;]+)/);
    const authToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : "";

    const domain = String(searchParams.get("domain") ?? "").trim();
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const city = String(searchParams.get("city") ?? "").trim();
    const barangay = String(searchParams.get("barangay") ?? "").trim();
    const classification = String(searchParams.get("classification") ?? "").trim();
    const q = String(searchParams.get("q") ?? "").trim();

    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }

    const itemsPerPage = 16;

    // If domain maps to a DB-backed province and BACKEND_URL is set
    // - No filters: return DB as-is (fast)
    // - With filters: UNION DB + spreadsheet and paginate combined results
    const province = domainToProvince(domain);
    if (province && BACKEND_URL) {
      const hasFilters = Boolean(city || barangay || classification || q);
      if (!hasFilters) {
        const payload = await fetchFromDbBackend({ province, page, city, barangay, classification, q, itemsPerPage, token: authToken });
        return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=20, stale-while-revalidate=60" } });
      }

      // Collect DB rows sufficient to cover requested page
      const need = page * itemsPerPage + itemsPerPage * 2; // some headroom
      const dbRows = await collectDbRows({ province, city, barangay, classification, q, want: need, token: authToken });

      // Collect spreadsheet rows that match filters (just enough pages)
      const desired = page * itemsPerPage + itemsPerPage * 2;
      const meta = await getDomainMetadata(domain);
      const estPages = Math.ceil((meta.totalRows || 0) / PAGE_SIZE) || 1;
      let collected: AnyRow[] = [];
      let currentPage = 1;
      let exhausted = false;
      while (collected.length < desired && currentPage <= estPages && currentPage <= MAX_PAGES && !exhausted) {
        const pagesToFetch: number[] = [];
        for (let i = 0; i < PARALLEL_FETCH && currentPage + i <= estPages && currentPage + i <= MAX_PAGES; i++) {
          pagesToFetch.push(currentPage + i);
        }
        const allRows = await getMultiplePagesParallel(domain, pagesToFetch);
        if (!allRows.length) { exhausted = true; break; }
        const filtered = allRows.filter((row) =>
          filterRow(row, { city, barangay, classification, q })
        );
        collected.push(...filtered);
        const lastPageSize = (allRows.length % PAGE_SIZE) || PAGE_SIZE;
        if (lastPageSize < PAGE_SIZE) exhausted = true;
        currentPage += pagesToFetch.length;
      }

      // UNION (prefer spreadsheet rows, DB adds missing)
      const map = new Map<string, AnyRow>();
      for (const r of collected) map.set(makeKey(r), r);
      for (const r of dbRows) {
        const k = makeKey(r);
        if (!map.has(k)) map.set(k, r);
      }
      const combined = Array.from(map.values());

      const totalRows = combined.length;
      const pageCount = Math.ceil(totalRows / itemsPerPage) || 1;
      const validPage = Math.min(page, pageCount);
      const start = (validPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;

      return NextResponse.json(
        {
          domain,
          page: validPage,
          rows: combined.slice(start, end),
          itemsPerPage,
          totalRows,
          pageCount,
          hasPrev: validPage > 1,
          hasNext: validPage < pageCount,
        },
        { headers: { "Cache-Control": "public, max-age=20, stale-while-revalidate=60" } }
      );
    }

    // ✅ Get metadata (total count, etc) - very fast!
    const meta = await getDomainMetadata(domain);
    const estTotalRows = meta.totalRows;
    
    // If no filters, we can calculate pages easily
    if (!city && !barangay && !classification && !q) {
      const estPageCount = Math.ceil(estTotalRows / itemsPerPage) || 1;
      const validPage = Math.min(page, estPageCount);

      // ✅ Fetch ONLY the page needed
      const pageData = await getPageRows(domain, validPage);

      return NextResponse.json(
        {
          domain,
          page: validPage,
          rows: pageData.slice(0, itemsPerPage),
          itemsPerPage,
          totalRows: estTotalRows,
          pageCount: estPageCount,
          hasPrev: validPage > 1,
          hasNext: validPage < estPageCount,
        },
        { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=3600" } }
      );
    }

    // ============================================================================
    // FILTERING: Fetch multiple pages in PARALLEL instead of sequential!
    // This is the KEY OPTIMIZATION - 3x pages at once instead of 1 at a time
    // ============================================================================

    const collected: AnyRow[] = [];
    let currentPage = 1;
    let exhausted = false;

    // ✅ NEW: Collect results by fetching PARALLEL_FETCH pages at a time
    while (collected.length < page * itemsPerPage && currentPage <= MAX_PAGES && !exhausted) {
      // ✅ PARALLEL: Fetch 3 pages at once instead of 1!
      const pagesToFetch = [];
      for (let i = 0; i < PARALLEL_FETCH && currentPage + i <= MAX_PAGES; i++) {
        pagesToFetch.push(currentPage + i);
      }

      console.log(`[PARALLEL FETCH] Fetching pages ${pagesToFetch.join(", ")} in parallel`);

      // Fetch all pages in parallel (Promise.all waits for all to complete)
      const allPageRows = await getMultiplePagesParallel(domain, pagesToFetch);

      if (allPageRows.length === 0) {
        exhausted = true;
        break;
      }

      // Filter all fetched rows
      const filtered = allPageRows.filter((row) =>
        filterRow(row, { city, barangay, classification, q })
      );

      collected.push(...filtered);

      // Check if any page had fewer rows (reached the end)
      const lastPageSize = (allPageRows.length % PAGE_SIZE) || PAGE_SIZE;
      if (lastPageSize < PAGE_SIZE) {
        exhausted = true;
      }

      currentPage += pagesToFetch.length;
    }

    // Now paginate the collected results
    const totalRows = collected.length;
    const pageCount = Math.ceil(totalRows / itemsPerPage) || 1;
    const validPage = Math.min(page, pageCount);

    const start = (validPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;

    return NextResponse.json(
      {
        domain,
        page: validPage,
        rows: collected.slice(start, end),
        itemsPerPage,
        totalRows,
        pageCount,
        hasPrev: validPage > 1,
        hasNext: validPage < pageCount,
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=3600" } }
    );
  } catch (e: any) {
    console.error("[ZONAL API ERROR]", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

// Helper: collect multiple DB pages until we have enough rows
async function collectDbRows(args: {
  province: string;
  city?: string;
  barangay?: string;
  classification?: string;
  q?: string;
  want: number; // number of rows desired
  token?: string | null;
}): Promise<AnyRow[]> {
  const per = 100;
  let page = 1;
  const rows: AnyRow[] = [];
  while (rows.length < args.want) {
    const payload = await fetchFromDbBackend({
      province: args.province,
      page,
      city: args.city,
      barangay: args.barangay,
      classification: args.classification,
      q: args.q,
      itemsPerPage: per,
      token: args.token ?? null,
    });
    rows.push(...(payload.rows || []));
    if (!payload.hasNext) break;
    page += 1;
    if (page > 100) break; // hard safety
  }
  return rows;
}

function loose(s: any) {
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

function makeKey(row: AnyRow) {
  const street = loose(getVal(row, "Street/Subdivision-"));
  const vic = loose(getVal(row, "Vicinity-"));
  const brgy = loose(getVal(row, "Barangay-"));
  const city = loose(getVal(row, "City-"));
  const prov = loose(getVal(row, "Province-"));
  return `${street}|${vic}|${brgy}|${city}|${prov}`;
}