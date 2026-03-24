import { NextResponse } from "next/server";
import { fetchZonalValuesByDomain, fetchZonalIndex } from "../../lib/zonalByDomain";

export const runtime = "nodejs";
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";

function domainToProvince(domain: string): string | null {
  const host = String(domain || "").trim().toLowerCase();
  const sub = (host.split(".")[0] || host);
  if (!sub) return null;
  // explicit combined-domain preference must come first s
  if (sub.includes("negrosoriental-siquijor")) return "NEGROS ORIENTAL";
  if (sub.includes("cebu")) return "CEBU";
  if (sub.includes("bohol")) return "BOHOL";
  if (sub.includes("iloilo")) return "ILOILO"; 
  if (sub.includes("davaodelsur")) return "DAVAO DEL SUR";
  if (sub.includes("davaodelnorte-samal-compostelavalley")) return "DAVAO DEL NORTE";
  if (sub.includes("negrosoriental") || sub.includes("negros-oriental")) return "NEGROS ORIENTAL";
  if (sub.includes("siquijor")) return "SIQUIJOR";
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
  if(sub.includes("kalinga-apayao")) return "KALINGA";
  if(sub.includes("lanaodelsur")) return "LANAO DEL SUR";
  if(sub.includes("leyte-bilaran")) return "LEYTE";
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
    console.log(`[getAllDomainRows] Cache HIT for ${domain} (age: ${Date.now() - cached.ts}ms)`);
    return { rows: cached.rows, fromCache: true as const };
  }

  console.log(`[getAllDomainRows] Cache MISS for ${domain}, fetching from upstream...`);
  const startTime = Date.now();
  
  try {
    const idx = await fetchZonalIndex(domain);
    const rowsLimit = Number(idx?.rowsLimit ?? 5000);
    console.log(`[getAllDomainRows] Got index for ${domain} - rowsLimit: ${rowsLimit}`);

    const pagesNeeded = Math.min(HARD_CAP_PAGES, Math.max(1, Math.ceil(rowsLimit / PAGE_SIZE)));
    console.log(`[getAllDomainRows] Will fetch ${pagesNeeded} pages for ${domain}`);

    // Fetch all pages in parallel instead of sequentially
    const pagePromises = [];
    for (let p = 1; p <= pagesNeeded; p++) {
      pagePromises.push(
        fetchZonalValuesByDomain({
          domain,
          page: p,
          itemsPerPage: PAGE_SIZE,
          search: "", // IMPORTANT: keep empty so we fetch everything
        })
      );
    }

    const results = await Promise.all(pagePromises);
    const all: AnyRow[] = [];

    for (const result of results) {
      const batch = Array.isArray(result?.rows) ? result.rows : [];
      all.push(...batch);

      if (batch.length < PAGE_SIZE) break;
    }

    FACET_CACHE.set(domain, { ts: Date.now(), rows: all });
    console.log(`[getAllDomainRows] SUCCESS for ${domain} - fetched ${all.length} rows in ${Date.now() - startTime}ms`);
    return { rows: all, fromCache: false as const };
  } catch (err: any) {
    console.error(`[getAllDomainRows] FAILED for ${domain} after ${Date.now() - startTime}ms:`, {
      status: err?.response?.status,
      code: err?.code,
      message: err?.message,
    });
    throw err;
  }
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

    const province = domainToProvince(domain);

    // If this domain maps to a DB-backed province and BACKEND_URL configured, prefer backend facet endpoints but UNION with spreadsheet
    if (province && BACKEND_URL) {
      const base = BACKEND_URL.replace(/\/$/, "");
      if (mode === "cities") {
        const url = `${base}/api/facets/cities?province=${encodeURIComponent(province)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j) return NextResponse.json({ error: j?.error || "Backend facets failed" }, { status: 502 });

        // Backend cities
        const backendCities: string[] = Array.isArray(j?.cities) ? j.cities : [];

        // Spreadsheet cities (union)
        const { rows } = await getAllDomainRows(domain);
        const set = new Set<string>(backendCities);
        for (const r of rows) {
          const c = norm(getVal(r, "City-"));
          if (c) set.add(c);
        }
        const cities = Array.from(set).sort((a, b) => a.localeCompare(b));
        return NextResponse.json(
          { domain, cities, cached: false },
          { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=86400" } }
        );
      }
      if (mode === "barangays") {
        if (!city) return NextResponse.json({ error: "city is required" }, { status: 400 });
        const url = `${base}/api/facets/barangays?province=${encodeURIComponent(province)}&city=${encodeURIComponent(city)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j) return NextResponse.json({ error: j?.error || "Backend facets failed" }, { status: 502 });

        const backendList: string[] = Array.isArray(j?.barangays) ? j.barangays : [];

        // Spreadsheet barangays (union for selected city)
        const { rows } = await getAllDomainRows(domain);
        const set = new Set<string>(backendList);
        for (const r of rows) {
          const rowCity = String(getVal(r, "City-") ?? "");
          if (!matchesLoose(rowCity, city)) continue;
          const b = norm(getVal(r, "Barangay-"));
          if (b) set.add(b);
        }
        const list = Array.from(set).sort((a, b) => a.localeCompare(b));
        return NextResponse.json(
          { domain, city, barangays: list, cached: false },
          { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=86400" } }
        );
      }
      if (mode === "classifications") {
        const url = `${base}/api/facets/classifications?province=${encodeURIComponent(province)}${city ? `&city=${encodeURIComponent(city)}` : ""}${barangay ? `&barangay=${encodeURIComponent(barangay)}` : ""}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j) return NextResponse.json({ error: j?.error || "Backend facets failed" }, { status: 502 });

        const backendList: string[] = Array.isArray(j?.classifications) ? j.classifications : [];

        // Spreadsheet classifications (optional union, filtered if city/barangay provided)
        const { rows } = await getAllDomainRows(domain);
        let filtered = rows;
        if (city) filtered = filtered.filter((r) => matchesLoose(getVal(r, "City-"), city));
        if (barangay) filtered = filtered.filter((r) => matchesBarangay(getVal(r, "Barangay-"), barangay));
        const set = new Set<string>(backendList);
        for (const r of filtered) {
          const c = norm(getVal(r, "Classification-"));
          if (c) set.add(c);
        }
        const list = Array.from(set).sort((a, b) => a.localeCompare(b));
        return NextResponse.json(
          { domain, city, barangay, classifications: list, cached: false },
          { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=86400" } }
        );
      }
    }

    const { rows, fromCache } = await getAllDomainRows(domain);

    if (mode === "cities") {
      const set = new Set<string>();
      for (const r of rows) {
        const c = norm(getVal(r, "City-"));
        if (c) set.add(c);
      }
      const cities = Array.from(set).sort((a, b) => a.localeCompare(b));
      return NextResponse.json(
        { domain, cities, cached: fromCache },
        { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=86400" } }
      );
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
      return NextResponse.json(
        { domain, city, barangays, cached: fromCache },
        { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=86400" } }
      );
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
      return NextResponse.json(
        { domain, city, barangay, classifications, cached: fromCache },
        { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=86400" } }
      );
    }

    return NextResponse.json(
      { error: "Invalid mode (use cities|barangays)" },
      { status: 400, headers: { "Cache-Control": "public, max-age=60" } }
    );
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
