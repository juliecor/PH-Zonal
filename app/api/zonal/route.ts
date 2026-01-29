import { NextResponse } from "next/server";
import { fetchZonalValuesByDomain, fetchZonalIndex } from "../../lib/zonalByDomain";
import { fuzzyMatchStreets } from "../../lib/zonal-util";

export const runtime = "nodejs";

type AnyRow = Record<string, any>;

// ---- cache (per server instance) ----
const ZONAL_CACHE: Map<string, { ts: number; rows: AnyRow[] }> =
  (globalThis as any).__ZONAL_CACHE__ ?? new Map();
(globalThis as any).__ZONAL_CACHE__ = ZONAL_CACHE;

const TTL_MS = 1000 * 60 * 30; // 30 minutes

// tune this (1000 is a great default)
const PAGE_SIZE = 1000;
const HARD_CAP_PAGES = 120; // safety cap (~120k rows)

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

// for CITY / PROVINCE / CLASSIFICATION loose matching
function matchesLoose(value: any, want: any) {
  const v = norm(value);
  const w = norm(want);
  if (!w) return true;
  // keep loose matching here (useful for "CITY OF MANILA" vs "MANILA")
  return v === w || v.includes(w) || w.includes(v);
}

// ✅ barangay must be numeric-exact (prevents 102 matching 1)
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

  // If both have numbers, compare exact number
  if (vn && wn) return vn === wn;

  // Otherwise strict compare (no includes)
  return norm(value) === norm(want);
}

async function getDomainRows(domain: string) {
  const cached = ZONAL_CACHE.get(domain);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.rows;

  // rowsLimit tells us how many pages we need
  const idx = await fetchZonalIndex(domain);
  const rowsLimit = Number(idx?.rowsLimit ?? 5000);

  const pagesNeeded = Math.min(
    HARD_CAP_PAGES,
    Math.max(1, Math.ceil(rowsLimit / PAGE_SIZE))
  );

  const all: AnyRow[] = [];

  for (let p = 1; p <= pagesNeeded; p++) {
    const data = await fetchZonalValuesByDomain({
      domain,
      page: p,
      itemsPerPage: PAGE_SIZE,
      search: "", // IMPORTANT: keep empty so cache includes everything
    });

    const batch = Array.isArray(data?.rows) ? data.rows : [];
    all.push(...batch);

    // source ended early
    if (batch.length < PAGE_SIZE) break;
  }

  ZONAL_CACHE.set(domain, { ts: Date.now(), rows: all });
  return all;
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

    const base = await getDomainRows(domain);

    let filtered = base;

    // ✅ enforce city+barangay together (prevents mixing)
    if (city && barangay) {
      filtered = filtered.filter(
        (row) =>
          matchesLoose(getVal(row, "City-"), city) &&
          matchesBarangay(getVal(row, "Barangay-"), barangay)
      );
    } else {
      if (city) {
        filtered = filtered.filter((row) => matchesLoose(getVal(row, "City-"), city));
      }
      if (barangay) {
        filtered = filtered.filter((row) =>
          matchesBarangay(getVal(row, "Barangay-"), barangay)
        );
      }
    }

    if (classification) {
      filtered = filtered.filter((row) =>
        matchesLoose(getVal(row, "Classification-"), classification)
      );
    }

    // local text search with fuzzy matching (fast, no upstream call)
    if (q) {
      const qn = norm(q);
      filtered = filtered.filter((row) => {
        const street = String(getVal(row, "Street/Subdivision-") ?? "");
        const vicinity = String(getVal(row, "Vicinity-") ?? "");
        const barangay = String(getVal(row, "Barangay-") ?? "");
        const city = String(getVal(row, "City-") ?? "");
        const province = String(getVal(row, "Province-") ?? "");
        const classification = String(getVal(row, "Classification-") ?? "");
        
        // Try exact match first
        const joined = `${street} ${vicinity} ${barangay} ${city} ${province} ${classification}`;
        if (norm(joined).includes(qn)) return true;
        
        // Try fuzzy match on street/vicinity names
        const candidates = [street, vicinity].filter(Boolean);
        if (candidates.length === 0) return false;
        
        const matches = fuzzyMatchStreets(qn, candidates, 3);
        return matches.length > 0;
      });
    }

    // paginate
    const itemsPerPage = 16;
    const totalRows = filtered.length;
    const pageCount = Math.ceil(totalRows / itemsPerPage) || 1;
    const validPage = Math.min(page, pageCount);

    const start = (validPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;

    return NextResponse.json({
      domain,
      page: validPage,
      rows: filtered.slice(start, end),
      itemsPerPage,
      totalRows,
      pageCount,
      hasPrev: validPage > 1,
      hasNext: validPage < pageCount,
    });
  } catch (e: any) {
    console.error("Zonal API error:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
