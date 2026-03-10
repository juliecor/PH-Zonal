import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Map of domain -> province (same as in other routes)
function domainToProvince(domain: string): string | null {
  const host = String(domain || "").trim().toLowerCase();
  if (!host) return null;
  const sub = host.split(".")[0] || host;
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
  if (sub.includes("ncr1stdisrict")) return "NCR";
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

// Reverse mapping: province -> domain (for popular regions)
const PROVINCE_DOMAINS: Record<string, string> = {
  "CEBU": "cebu.zonalvalue.com",
  "BOHOL": "bohol.zonalvalue.com",
  "ILOILO": "iloilo.zonalvalue.com",
  "DAVAO DEL SUR": "davaodelsur.zonalvalue.com",
  "DAVAO DEL NORTE": "davaodelnorte-samal-compostelavalley.zonalvalue.com",
  "NEGROS ORIENTAL": "negrosoriental-siquijor.zonalvalue.com",
  "SIQUIJOR": "siquijor.zonalvalue.com",
  "ZAMBOANGA DEL SUR": "zamboangadelsur.zonalvalue.com",
  "AGUSAN DEL NORTE": "agusandelnorte.zonalvalue.com",
  "AGUSAN DEL SUR": "agusandelsur.zonalvalue.com",
  "NCR": "ncr1stdisrict.zonalvalue.com",
  "BENGUET": "benguet.zonalvalue.com",
  "CAGAYAN": "cagayan-batanes.zonalvalue.com",
  "ABRA": "abra.zonalvalue.com",
};

type CityIndex = Map<string, { province: string; domain: string }>;

// Global in-memory cache: normalized city name -> { province, domain }
// Built lazily in background, searches use it immediately if available
const CITY_INDEX_CACHE: Map<string, { ts: number; index: CityIndex }> =
  (globalThis as any).__CITY_INDEX_CACHE__ ?? new Map();
(globalThis as any).__CITY_INDEX_CACHE__ = CITY_INDEX_CACHE;

// Track which domains are working/broken (cache for 6 hours)
const DOMAIN_HEALTH: Map<string, { ts: number; ok: boolean }> = 
  (globalThis as any).__DOMAIN_HEALTH__ ?? new Map();
(globalThis as any).__DOMAIN_HEALTH__ = DOMAIN_HEALTH;
const HEALTH_TTL_MS = 1000 * 60 * 60 * 6;

// Background building flag
const INDEX_BUILDING: { [key: string]: boolean } = (globalThis as any).__INDEX_BUILDING__ ?? {};
(globalThis as any).__INDEX_BUILDING__ = INDEX_BUILDING;

const INDEX_TTL_MS = 1000 * 60 * 60; // 1 hour

function normCity(s: any): string {
  return String(s || "")
    .toUpperCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

// ⚡ Fast: Use existing facets API (already cached)
async function buildCityIndexFast(): Promise<CityIndex> {
  const cached = CITY_INDEX_CACHE.get("__main__");
  if (cached && Date.now() - cached.ts < INDEX_TTL_MS) {
    console.log("[CITY INDEX] ✓ Using cached index (instant)");
    return cached.index;
  }

  console.log("[CITY INDEX] Building from facets API...");
  const index: CityIndex = new Map();

  // Get all domains
  const domains = Object.values(PROVINCE_DOMAINS);
  const workingDomains: string[] = [];
  const brokenDomains: string[] = [];

  // ⚡ Call facets API in parallel (not zonal data!)
  // This is 10-50x faster because facets are already cached
  const promises = domains.map(async (domain) => {
    try {
      // Check health cache first
      const health = DOMAIN_HEALTH.get(domain);
      if (health && Date.now() - health.ts < HEALTH_TTL_MS) {
        if (!health.ok) {
          console.log(`[CITY INDEX] ⊘ Skipping ${domain} (previously failed)`);
          brokenDomains.push(domain);
          return [];
        }
      }

      const province = domainToProvince(domain);
      if (!province) {
        console.warn(`[CITY INDEX] ⊘ No province found for ${domain}, skipping`);
        DOMAIN_HEALTH.set(domain, { ts: Date.now(), ok: false });
        brokenDomains.push(domain);
        return [];
      }

      // Use relative URL for same-server fetch
      const url = `/api/facets?mode=cities&domain=${encodeURIComponent(domain)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // 3 sec timeout per domain

      const res = await fetch(url, { signal: controller.signal }).catch((e) => {
        clearTimeout(timeout);
        console.warn(`[CITY INDEX] ⊘ Fetch error for ${domain}: ${e?.message ?? e}`);
        DOMAIN_HEALTH.set(domain, { ts: Date.now(), ok: false });
        brokenDomains.push(domain);
        return null;
      });
      clearTimeout(timeout);

      if (!res) return [];

      if (!res.ok) {
        console.warn(`[CITY INDEX] ⊘ ${domain} returned ${res.status}, marking as broken`);
        DOMAIN_HEALTH.set(domain, { ts: Date.now(), ok: false });
        brokenDomains.push(domain);
        return [];
      }

      const text = await res.text().catch((e: any) => {
        console.error(`[CITY INDEX] Read error for ${domain}: ${e?.message ?? e}`);
        DOMAIN_HEALTH.set(domain, { ts: Date.now(), ok: false });
        brokenDomains.push(domain);
        return "";
      });

      if (!text) {
        console.warn(`[CITY INDEX] Empty response from ${domain}`);
        DOMAIN_HEALTH.set(domain, { ts: Date.now(), ok: false });
        brokenDomains.push(domain);
        return [];
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e: any) {
        console.error(`[CITY INDEX] JSON parse error for ${domain}: ${e?.message ?? e}`);
        DOMAIN_HEALTH.set(domain, { ts: Date.now(), ok: false });
        brokenDomains.push(domain);
        return [];
      }

      const cities = Array.isArray(data?.cities) ? data.cities : [];
      console.log(`[CITY INDEX] ✓ Got ${cities.length} cities from ${domain}`);
      DOMAIN_HEALTH.set(domain, { ts: Date.now(), ok: true });
      workingDomains.push(domain);

      return cities.map((c: string) => ({ city: c, province, domain }));
    } catch (e) {
      console.error(`[CITY INDEX] Unexpected error for ${domain}:`, e);
      DOMAIN_HEALTH.set(domain, { ts: Date.now(), ok: false });
      brokenDomains.push(domain);
      return [];
    }
  });

  const allCities = await Promise.all(promises);

  // Build index (deduped)
  for (const cities of allCities) {
    for (const { city, province, domain } of cities) {
      const normalized = normCity(city);
      if (normalized && !index.has(normalized)) {
        index.set(normalized, { province, domain });
      }
    }
  }

  CITY_INDEX_CACHE.set("__main__", { ts: Date.now(), index });
  console.log(`[CITY INDEX] ✓ Built index with ${index.size} cities (${workingDomains.length} working domains, ${brokenDomains.length} broken)`);
  if (brokenDomains.length > 0) {
    console.log(`[CITY INDEX] Broken domains: ${brokenDomains.join(", ")}`);
  }
  return index;
}

// Build index in background (non-blocking)
function buildIndexInBackground() {
  if (INDEX_BUILDING["__main__"]) return;
  
  INDEX_BUILDING["__main__"] = true;
  buildCityIndexFast()
    .catch((e) => console.error("[CITY INDEX] Background build error:", e))
    .finally(() => {
      INDEX_BUILDING["__main__"] = false;
    });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") ?? "").trim();

    if (!q || q.length < 2) {
      return NextResponse.json(
        { matches: [], message: "Type at least 2 characters" },
        { headers: { "Cache-Control": "public, max-age=60" } }
      );
    }

    // Ensure index exists (build in background if needed)
    const cached = CITY_INDEX_CACHE.get("__main__");
    if (!cached) {
      buildIndexInBackground(); // Start building in background (non-blocking)
      
      // If we have some cached data, use it; otherwise wait briefly for first build
      const waitMs = 100;
      const startTime = Date.now();
      while (Date.now() - startTime < waitMs) {
        const index = CITY_INDEX_CACHE.get("__main__");
        if (index) break;
        await new Promise(r => setTimeout(r, 10));
      }
    }

    // Get index (even if not fully built, use what we have)
    const index = CITY_INDEX_CACHE.get("__main__")?.index ?? new Map();

    if (index.size === 0) {
      // First time ever - trigger background build and return quickly
      buildIndexInBackground();
      return NextResponse.json(
        { matches: [], message: "Initializing search index..." },
        { headers: { "Cache-Control": "public, max-age=5" } }
      );
    }

    const normalized = normCity(q);

    // Find matches: exact starts-with first, then contains (ultra-fast!)
    const matches: Array<{ city: string; province: string; domain: string; type: "exact" | "match" }> = [];
    const seen = new Set<string>();

    // ⚡ Single pass: exact matches
    for (const [keyN, value] of index.entries()) {
      // Skip broken domains
      const health = DOMAIN_HEALTH.get(value.domain);
      if (health && !health.ok && Date.now() - health.ts < HEALTH_TTL_MS) {
        continue;
      }

      if (keyN.startsWith(normalized)) {
        matches.push({ city: keyN, province: value.province, domain: value.domain, type: "exact" });
        seen.add(keyN);
        if (seen.size >= 20) break; // Early exit if we have enough
      }
    }

    // ⚡ Single pass: contains matches (only if we need more)
    if (seen.size < 15) {
      for (const [keyN, value] of index.entries()) {
        if (seen.has(keyN)) continue;

        // Skip broken domains
        const health = DOMAIN_HEALTH.get(value.domain);
        if (health && !health.ok && Date.now() - health.ts < HEALTH_TTL_MS) {
          continue;
        }

        if (keyN.includes(normalized)) {
          matches.push({ city: keyN, province: value.province, domain: value.domain, type: "match" });
          seen.add(keyN);
          if (seen.size >= 20) break; // Early exit
        }
      }
    }

    // Sort: exact first, then alphabetical
    matches.sort((a, b) => {
      if (a.type !== b.type) return a.type === "exact" ? -1 : 1;
      return a.city.localeCompare(b.city);
    });

    const limited = matches.slice(0, 15);

    return NextResponse.json(
      { matches: limited },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch (e: any) {
    console.error("[CITY SEARCH ERROR]", e);
    return NextResponse.json(
      { error: e?.message ?? "Search failed", matches: [] },
      { status: 500, headers: { "Cache-Control": "public, max-age=60" } }
    );
  }
}
