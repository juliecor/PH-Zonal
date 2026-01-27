import { NextResponse } from "next/server";
import { fetchZonalValuesByDomain, fetchZonalIndex } from "../../lib/zonalByDomain";

export const runtime = "nodejs";

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

async function getAllDomainRows(domain: string) {
  const cached = FACET_CACHE.get(domain);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return { rows: cached.rows, fromCache: true as const };
  }

  const idx = await fetchZonalIndex(domain);
  const rowsLimit = Number(idx?.rowsLimit ?? 5000);

  const pagesNeeded = Math.min(HARD_CAP_PAGES, Math.max(1, Math.ceil(rowsLimit / PAGE_SIZE)));

  const all: AnyRow[] = [];

  for (let p = 1; p <= pagesNeeded; p++) {
    const result = await fetchZonalValuesByDomain({
      domain,
      page: p,
      itemsPerPage: PAGE_SIZE,
      search: "", // IMPORTANT: keep empty so we fetch everything
    });

    const batch = Array.isArray(result?.rows) ? result.rows : [];
    all.push(...batch);

    if (batch.length < PAGE_SIZE) break;
  }

  FACET_CACHE.set(domain, { ts: Date.now(), rows: all });
  return { rows: all, fromCache: false as const };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const domain = norm(searchParams.get("domain"));
    const mode = norm(searchParams.get("mode") ?? "cities");
    const city = norm(searchParams.get("city"));
    const barangay = norm(searchParams.get("barangay"));

    if (!domain || !domain.includes(".") || domain.includes(" ")) {
      return NextResponse.json({ error: "Invalid domain", domain }, { status: 400 });
    }

    const { rows, fromCache } = await getAllDomainRows(domain);

    if (mode === "cities") {
      const set = new Set<string>();
      for (const r of rows) {
        const c = norm(getVal(r, "City-"));
        if (c) set.add(c);
      }
      const cities = Array.from(set).sort((a, b) => a.localeCompare(b));
      return NextResponse.json({ domain, cities, cached: fromCache });
    }

    if (mode === "barangays") {
      if (!city) {
        return NextResponse.json({ error: "city is required" }, { status: 400 });
      }

      const set = new Set<string>();
      for (const r of rows) {
        const rowCity = String(getVal(r, "City-") ?? "");
        if (!matchesLoose(rowCity, city)) continue;

        const b = norm(getVal(r, "Barangay-"));
        if (b) set.add(b);
      }

      const barangays = Array.from(set).sort((a, b) => a.localeCompare(b));
      return NextResponse.json({ domain, city, barangays, cached: fromCache });
    }

    // OPTIONAL: if you want "classifications" facet later
    if (mode === "classifications") {
      let filtered = rows;

      if (city) filtered = filtered.filter((r) => matchesLoose(getVal(r, "City-"), city));
      if (barangay) filtered = filtered.filter((r) => matchesBarangay(getVal(r, "Barangay-"), barangay));

      const set = new Set<string>();
      for (const r of filtered) {
        const c = norm(getVal(r, "Classification-"));
        if (c) set.add(c);
      }

      const classifications = Array.from(set).sort((a, b) => a.localeCompare(b));
      return NextResponse.json({ domain, city, barangay, classifications, cached: fromCache });
    }

    return NextResponse.json({ error: "Invalid mode (use cities|barangays)" }, { status: 400 });
  } catch (e: any) {
    console.error("Facets API error:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
