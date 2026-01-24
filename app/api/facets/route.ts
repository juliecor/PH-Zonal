import { NextResponse } from "next/server";
import { fetchZonalValuesByDomain, fetchZonalIndex } from "../../lib/zonalByDomain";

export const runtime = "nodejs";

type AnyRow = Record<string, any>;

function norm(v: any) {
  return String(v ?? "").trim();
}

function getVal(row: AnyRow, key: string) {
  return (
    row?.cells?.[key]?.value ??
    row?.cells?.[key]?.formattedValue ??
    row?.[key] ??
    ""
  );
}

// cache: domain -> rows
const FACET_CACHE: Map<string, { ts: number; rows: AnyRow[] }> =
  (globalThis as any).__FACET_CACHE__ ?? new Map();
(globalThis as any).__FACET_CACHE__ = FACET_CACHE;

const TTL_MS = 1000 * 60 * 30; // 30 mins
const PAGE_SIZE = 1000;        // good balance (few calls, not too heavy)
const HARD_CAP_PAGES = 120;    // safety (~120k rows)

function cityMatches(rowCity: string, wantCity: string) {
  const a = norm(rowCity).toUpperCase();
  const b = norm(wantCity).toUpperCase();
  if (!b) return true;
  return a === b || a.includes(b) || b.includes(a);
}

async function getAllDomainRows(domain: string) {
  const cached = FACET_CACHE.get(domain);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.rows;

  // ✅ dynamic page count based on rowsLimit
  const idx = await fetchZonalIndex(domain);
  const rowsLimit = Number(idx?.rowsLimit ?? 5000);
  const pagesNeeded = Math.min(
    HARD_CAP_PAGES,
    Math.max(1, Math.ceil(rowsLimit / PAGE_SIZE))
  );

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

    // stop when last page (extra safety)
    if (batch.length < PAGE_SIZE) break;
  }

  FACET_CACHE.set(domain, { ts: Date.now(), rows: all });
  return all;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const domain = norm(searchParams.get("domain"));
    const mode = norm(searchParams.get("mode") ?? "cities");
    const city = norm(searchParams.get("city"));

    if (!domain || !domain.includes(".") || domain.includes(" ")) {
      return NextResponse.json({ error: "Invalid domain", domain }, { status: 400 });
    }

    const rows = await getAllDomainRows(domain);

    if (mode === "cities") {
      const set = new Set<string>();
      for (const r of rows) {
        const c = norm(getVal(r, "City-"));
        if (c) set.add(c);
      }
      const cities = Array.from(set).sort((a, b) => a.localeCompare(b));
      return NextResponse.json({ domain, cities, cached: true });
    }

    if (mode === "barangays") {
      if (!city) {
        return NextResponse.json({ error: "city is required" }, { status: 400 });
      }

      const set = new Set<string>();
      for (const r of rows) {
        const rowCity = String(getVal(r, "City-") ?? "");
        if (!cityMatches(rowCity, city)) continue;

        const b = norm(getVal(r, "Barangay-"));
        if (b) set.add(b);
      }

      const barangays = Array.from(set).sort((a, b) => a.localeCompare(b));
      return NextResponse.json({ domain, city, barangays, cached: true });
    }

    return NextResponse.json({ error: "Invalid mode (use cities|barangays)" }, { status: 400 });
  } catch (e: any) {
    console.error("Facets API error:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
