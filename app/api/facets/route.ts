import { NextResponse } from "next/server";
import { fetchZonalValuesByDomain } from "../../lib/zonalByDomain";

const norm = (v: any) => String(v ?? "").trim();

const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
const cache = new Map<string, { ts: number; data: any }>();

const SOURCE_PAGE_SIZE = 500; // fewer requests
const MAX_SOURCE_PAGES = 2000;

function cacheGet(key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}
function cacheSet(key: string, data: any) {
  cache.set(key, { ts: Date.now(), data });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const domain = norm(searchParams.get("domain") ?? "");
  const mode = norm(searchParams.get("mode") ?? "cities"); // "cities" | "barangays"
  const city = norm(searchParams.get("city") ?? "");

  if (!domain || !domain.includes(".") || domain.includes(" ")) {
    return NextResponse.json({ error: "Invalid domain", domain }, { status: 400 });
  }

  // Mode: cities
  if (mode === "cities") {
    const key = `cities:${domain}`;
    const cached = cacheGet(key);
    if (cached) return NextResponse.json({ domain, cities: cached, cached: true });

    const citiesSet = new Set<string>();

    for (let p = 1; p <= MAX_SOURCE_PAGES; p++) {
      const result = await fetchZonalValuesByDomain({
        domain,
        page: p,
        itemsPerPage: SOURCE_PAGE_SIZE,
        search: "", // no search
      });

      const batch = result.rows ?? [];
      for (const r of batch) {
        const c = norm(r["City-"]);
        if (c) citiesSet.add(c);
      }

      if (batch.length < SOURCE_PAGE_SIZE) break;
    }

    const cities = Array.from(citiesSet).sort((a, b) => a.localeCompare(b));
    cacheSet(key, cities);

    return NextResponse.json({ domain, cities, cached: false });
  }

  // Mode: barangays for a selected city
  if (mode === "barangays") {
    if (!city) {
      return NextResponse.json(
        { error: "city is required for mode=barangays" },
        { status: 400 }
      );
    }

    const key = `barangays:${domain}:${city}`;
    const cached = cacheGet(key);
    if (cached) return NextResponse.json({ domain, city, barangays: cached, cached: true });

    const brgySet = new Set<string>();

    for (let p = 1; p <= MAX_SOURCE_PAGES; p++) {
      const result = await fetchZonalValuesByDomain({
        domain,
        page: p,
        itemsPerPage: SOURCE_PAGE_SIZE,
        search: city, // helps narrow quickly
      });

      const batch = result.rows ?? [];
      for (const r of batch) {
        if (norm(r["City-"]) !== city) continue;
        const b = norm(r["Barangay-"]);
        if (b) brgySet.add(b);
      }

      if (batch.length < SOURCE_PAGE_SIZE) break;
    }

    const barangays = Array.from(brgySet).sort((a, b) => a.localeCompare(b));
    cacheSet(key, barangays);

    return NextResponse.json({ domain, city, barangays, cached: false });
  }

  return NextResponse.json({ error: "Invalid mode. Use cities or barangays." }, { status: 400 });
}
