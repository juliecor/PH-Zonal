// Shared coastal/beach detection for the AI endpoints (server-side only).

export function haversineM(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Nearest beach/coast via one Google Places search. Returns metres, or null.
export async function nearestBeachMeters(lat: number, lon: number, key: string): Promise<number | null> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${lat},${lon}`);
    url.searchParams.set("rankby", "distance");
    url.searchParams.set("keyword", "beach");
    url.searchParams.set("key", key);
    const res = await fetch(url.toString());
    const j: any = await res.json().catch(() => null);
    if (!j || !Array.isArray(j.results)) return null;
    let best = Infinity;
    for (const r of j.results.slice(0, 6)) {
      const rlat = r?.geometry?.location?.lat;
      const rlon = r?.geometry?.location?.lng;
      const types: string[] = r?.types || [];
      const name = String(r?.name || "").toLowerCase();
      const looksBeach = types.includes("natural_feature") || /\b(beach|cove|shore|baybay|playa)\b/.test(name);
      if (rlat == null || rlon == null || !looksBeach) continue;
      const d = haversineM(lat, lon, rlat, rlon);
      if (d < best) best = d;
    }
    return Number.isFinite(best) ? best : null;
  } catch {
    return null;
  }
}

// Human-readable coastal note for prompts. Empty string when not coastal.
// Tight threshold: only genuinely beachfront (~600 m) counts — otherwise a
// property 1-3 km away would wrongly get "beach dining" suggestions.
export function coastalSignalText(d: number | null): string {
  if (d == null) return "";
  if (d <= 400) return `Beachfront / right by the coast — nearest beach ~${Math.round(d)} m away (genuine coastal & tourism potential).`;
  return "";
}

// Per-location cache (coastline is static, so a long TTL is safe). Shared
// across all AI endpoints via globalThis so a re-select doesn't re-charge.
const COASTAL_CACHE: Map<string, { ts: number; d: number | null }> =
  (globalThis as any).__COASTAL_CACHE__ ?? new Map();
(globalThis as any).__COASTAL_CACHE__ = COASTAL_CACHE;
const COASTAL_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

// Resolve a coastal note from coords + key (one Places lookup, cached). Empty if inland/unknown.
export async function coastalNote(lat: number, lon: number, key: string): Promise<string> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !key) return "";
  // Bucket by ~110 m (3 decimals) so nearby lots in the same area reuse the
  // result instead of each triggering a new (charged) lookup.
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const hit = COASTAL_CACHE.get(cacheKey);
  let d: number | null;
  if (hit && Date.now() - hit.ts < COASTAL_TTL_MS) {
    d = hit.d;
  } else {
    d = await nearestBeachMeters(lat, lon, key);
    COASTAL_CACHE.set(cacheKey, { ts: Date.now(), d });
  }
  return coastalSignalText(d);
}
