import { NextResponse } from "next/server";
import { fetchZonalValuesByDomain } from "../../lib/zonalByDomain";

export const runtime = "nodejs";

type AnyRow = Record<string, any>;

// --- small in-memory cache (per server instance)
const ZONAL_CACHE: Map<
  string,
  { ts: number; rows: AnyRow[] }
> = (globalThis as any).__ZONAL_CACHE__ ?? new Map();

(globalThis as any).__ZONAL_CACHE__ = ZONAL_CACHE;

const TTL_MS = 1000 * 60 * 30; // 30 minutes

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

async function getDomainRows(domain: string) {
  const cached = ZONAL_CACHE.get(domain);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.rows;

  // IMPORTANT: do NOT pass search to upstream anymore (keeps cache reusable)
  const data = await fetchZonalValuesByDomain({
    domain,
    page: 1,
    itemsPerPage: 5000,
    search: "", // <-- keep empty so cache always valid
  });

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  ZONAL_CACHE.set(domain, { ts: Date.now(), rows });
  return rows;
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

    // enforce city+barangay together (prevents wrong mixing)
    if (city && barangay) {
      filtered = filtered.filter((row) => {
        return (
          matchesLoose(getVal(row, "City-"), city) &&
          matchesLoose(getVal(row, "Barangay-"), barangay)
        );
      });
    } else {
      if (city) filtered = filtered.filter((row) => matchesLoose(getVal(row, "City-"), city));
      if (barangay) filtered = filtered.filter((row) => matchesLoose(getVal(row, "Barangay-"), barangay));
    }

    if (classification) {
      filtered = filtered.filter((row) => matchesLoose(getVal(row, "Classification-"), classification));
    }

    // local text search (fast, no upstream call)
    if (q) {
      const qn = norm(q);
      filtered = filtered.filter((row) => {
        const joined =
          `${getVal(row, "Street/Subdivision-")} ${getVal(row, "Vicinity-")} ${getVal(row, "Barangay-")} ${getVal(row, "City-")} ${getVal(row, "Province-")} ${getVal(row, "Classification-")}`;
        return norm(joined).includes(qn);
      });
    }

    // paginate
    const itemsPerPage = 16;
    const totalRows = filtered.length;
    const pageCount = Math.ceil(totalRows / itemsPerPage) || 1;
    const validPage = Math.min(page, pageCount);

    const start = (validPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedRows = filtered.slice(start, end);

    return NextResponse.json({
      domain,
      page: validPage,
      rows: paginatedRows,
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
