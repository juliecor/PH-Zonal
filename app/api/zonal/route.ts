import { NextResponse } from "next/server";
import { fetchZonalValuesByDomain, fetchZonalIndex } from "../../lib/zonalByDomain";
import { fuzzyMatchStreets } from "../../lib/zonal-util";

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

// ✅ NEW: Fetch ONLY the page you need (lazy loading)
async function getPageRows(domain: string, pageNum: number) {
  // Check page cache
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
    search: "", // Keep empty for unfiltered results
  });

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  
  // Cache this page
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
  
  // Fetch first page just to get metadata
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

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

    // ✅ NEW: Get metadata (total count, etc) - very fast!
    const meta = await getDomainMetadata(domain);
    const estTotalRows = meta.totalRows;
    
    // If no filters, we can calculate pages easily
    if (!city && !barangay && !classification && !q) {
      const estPageCount = Math.ceil(estTotalRows / itemsPerPage) || 1;
      const validPage = Math.min(page, estPageCount);

      // ✅ NEW: Fetch ONLY the page needed
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
    // FILTERING: Need to search through pages until we have enough results
    // But we do it PAGE-BY-PAGE, not all at once!
    // ============================================================================

    const collected: AnyRow[] = [];
    let currentPage = 1;
    let exhausted = false;

    // Collect filtered results page by page (stop after finding enough)
    while (collected.length < page * itemsPerPage && currentPage <= MAX_PAGES && !exhausted) {
      const pageRows = await getPageRows(domain, currentPage);
      
      if (pageRows.length === 0) {
        exhausted = true;
        break;
      }

      // Filter this page's rows
      const filtered = pageRows.filter((row) =>
        filterRow(row, { city, barangay, classification, q })
      );

      collected.push(...filtered);
      
      // If we got fewer rows than requested, we've reached the end
      if (pageRows.length < PAGE_SIZE) {
        exhausted = true;
      }

      currentPage++;
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