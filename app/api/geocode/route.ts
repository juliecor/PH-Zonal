import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GEO_CACHE = new Map<string, { ts: number; lat: number; lon: number; label: string; boundary?: any }>();
const STREET_SNAP_CACHE = new Map<string, { ts: number; lat: number; lon: number; name: string }>();

const GEO_TTL = 1000 * 60 * 60 * 24 * 14; // 14 days
const STREET_SNAP_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_API_KEY) {
  console.warn("⚠️ WARNING: GOOGLE_MAPS_API_KEY not set!");
}

// ============================================================================
// SMART STREET-LEVEL PINPOINTING (NEW APPROACH)
// ============================================================================

/**
 * Uses Google Places API to find the exact location of a street/place.
 * This is MORE precise than geocoding because it uses Google's POI database.
 */
async function googleStreetSnap(args: {
  streetName: string;
  barangay: string;
  city: string;
  province: string;
  baseLatLon?: { lat: number; lon: number } | null;
}) {
  if (!GOOGLE_API_KEY || !args.streetName.trim()) return null;

  const cacheKey = `${args.streetName}|${args.barangay}|${args.city}|${args.province}|${args.baseLatLon?.lat ?? ""},${args.baseLatLon?.lon ?? ""}`.toLowerCase();

  const cached = STREET_SNAP_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < STREET_SNAP_TTL) {
    return cached;
  }

  // Build components filter for precise location
  const components = [
    `administrative_area:${args.province}`,
    `locality:${args.city}`,
    "country:PH",
  ].join("|");

  // Build address with street + local context
  const address = `${args.streetName}, ${args.barangay}, ${args.city}, ${args.province}, Philippines`;

  let url =
    `https://maps.googleapis.com/maps/api/geocode/json?` +
    `address=${encodeURIComponent(address)}` +
    `&components=${encodeURIComponent(components)}` +
    `&region=ph&language=en&key=${GOOGLE_API_KEY}`;

  // Add location bias if we have a base coordinate
  if (args.baseLatLon) {
    const dLat = 2 / 111; // ~2 km box for tight bias
    const dLon = 2 / (111 * Math.cos((args.baseLatLon.lat * Math.PI) / 180));
    const sw = `${args.baseLatLon.lat - dLat},${args.baseLatLon.lon - dLon}`;
    const ne = `${args.baseLatLon.lat + dLat},${args.baseLatLon.lon + dLon}`;
    url += `&bounds=${encodeURIComponent(sw)}|${encodeURIComponent(ne)}`;
  }

  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);

    const res = await fetch(url, { signal: ac.signal });
    const data = await res.json().catch(() => null);
    clearTimeout(t);

    if (data.results?.length > 0) {
      const result = data.results[0];
      const { lat, lng } = result.geometry.location;

      // Extract formatted street name from Google's response
      const route = result.address_components?.find((c: any) =>
        (c?.types || []).includes("route")
      );
      const streetLabel = route?.long_name || args.streetName;

      const payload = { ts: Date.now(), lat: Number(lat), lon: Number(lng), name: streetLabel };
      STREET_SNAP_CACHE.set(cacheKey, payload);

      console.log(`[GOOGLE SNAP] ✓ ${streetLabel} @ ${lat.toFixed(5)},${lng.toFixed(5)}`);
      return payload;
    }
  } catch (e: any) {
    console.log(`[GOOGLE SNAP] ✗ ${e?.message}`);
  }

  return null;
}

/**
 * Smart geocode that leverages:
 * 1. Provided base coordinates (from zonal data)
 * 2. Google's precise street-level matching
 * 3. Fallback to standard geocoding
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Core params
    const query = String(body?.query ?? "").trim();
    const hintBarangay = String(body?.hintBarangay ?? "").trim();
    const hintCity = String(body?.hintCity ?? "").trim();
    const hintProvince = String(body?.hintProvince ?? "").trim();
    const street = String(body?.street ?? "").trim();
    const vicinity = String(body?.vicinity ?? "").trim();

    // NEW: Accept base coordinates from zonal data
    const baseLatLon =
      body?.baseLatLon?.lat != null && body?.baseLatLon?.lon != null
        ? { lat: Number(body.baseLatLon.lat), lon: Number(body.baseLatLon.lon) }
        : null;

    // Anchor for bias (different from base)
    const anchorLat = body?.anchorLat != null ? Number(body.anchorLat) : null;
    const anchorLon = body?.anchorLon != null ? Number(body.anchorLon) : null;
    const anchor =
      anchorLat != null &&
      anchorLon != null &&
      Number.isFinite(anchorLat) &&
      Number.isFinite(anchorLon)
        ? { lat: anchorLat, lon: anchorLon }
        : null;

    if (!query) {
      return NextResponse.json({ ok: false, error: "query required" }, { status: 400 });
    }

    const cacheKey = `${query}|${hintBarangay}|${hintCity}|${hintProvince}|${baseLatLon?.lat ?? ""},${baseLatLon?.lon ?? ""}|${street}|${vicinity}`.toLowerCase();

    // Check memory cache
    const cached = GEO_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < GEO_TTL) {
      console.log(`[CACHE HIT] ${query}`);
      return NextResponse.json({
        ok: true,
        lat: cached.lat,
        lon: cached.lon,
        displayName: cached.label,
        boundary: cached.boundary ?? null,
      });
    }

    // ========================================================================
    // STRATEGY 1: Smart street snap using Google (if street provided + base coords)
    // ========================================================================
    if (GOOGLE_API_KEY && street && hintBarangay && baseLatLon) {
      console.log(`[STRATEGY 1] Street snap: "${street}" near ${baseLatLon.lat.toFixed(5)},${baseLatLon.lon.toFixed(5)}`);

      const snap = await googleStreetSnap({
        streetName: street,
        barangay: hintBarangay,
        city: hintCity,
        province: hintProvince,
        baseLatLon,
      });

      if (snap) {
        const payload = {
          ts: Date.now(),
          lat: snap.lat,
          lon: snap.lon,
          label: `${snap.name}, ${hintBarangay}, ${hintCity}`,
          boundary: null,
        };
        GEO_CACHE.set(cacheKey, payload);
        return NextResponse.json({
          ok: true,
          lat: payload.lat,
          lon: payload.lon,
          displayName: payload.label,
          boundary: null,
        });
      }
    }

    // ========================================================================
    // STRATEGY 2: If we have base coordinates, use them directly + refine
    // ========================================================================
    if (baseLatLon) {
      console.log(`[STRATEGY 2] Using base coords from zonal data: ${baseLatLon.lat},${baseLatLon.lon}`);

      // Still try Google to get a better name/label
      if (GOOGLE_API_KEY) {
        const address = [street, vicinity, hintBarangay, hintCity, hintProvince, "Philippines"]
          .filter(Boolean)
          .join(", ");

        try {
          const ac = new AbortController();
          const t = setTimeout(() => ac.abort(), 4000);

          const url =
            `https://maps.googleapis.com/maps/api/geocode/json?` +
            `latlng=${baseLatLon.lat},${baseLatLon.lon}` +
            `&result_type=street_address|route|neighborhood` +
            `&language=en&key=${GOOGLE_API_KEY}`;

          const res = await fetch(url, { signal: ac.signal });
          const data = await res.json().catch(() => null);
          clearTimeout(t);

          if (data.results?.length > 0) {
            const result = data.results[0];
            const payload = {
              ts: Date.now(),
              lat: baseLatLon.lat,
              lon: baseLatLon.lon,
              label: result.formatted_address || address,
              boundary: null,
            };
            GEO_CACHE.set(cacheKey, payload);
            console.log(`[STRATEGY 2] ✓ ${payload.label}`);
            return NextResponse.json({
              ok: true,
              lat: payload.lat,
              lon: payload.lon,
              displayName: payload.label,
              boundary: null,
            });
          }
        } catch (e: any) {
          console.log(`[STRATEGY 2] Reverse geocode failed: ${e?.message}`);
        }
      }

      // Fallback: use base coordinates as-is
      const payload = {
        ts: Date.now(),
        lat: baseLatLon.lat,
        lon: baseLatLon.lon,
        label: [street, hintBarangay, hintCity, hintProvince].filter(Boolean).join(", "),
        boundary: null,
      };
      GEO_CACHE.set(cacheKey, payload);
      console.log(`[STRATEGY 2] Using base coords directly`);
      return NextResponse.json({
        ok: true,
        lat: payload.lat,
        lon: payload.lon,
        displayName: payload.label,
        boundary: null,
      });
    }

    // ========================================================================
    // STRATEGY 3: Full Google Geocode (legacy, no base coords)
    // ========================================================================
    if (GOOGLE_API_KEY) {
      console.log(`[STRATEGY 3] Full Google geocode: ${query}`);

      const address = [street || query, vicinity, hintBarangay, hintCity, hintProvince, "Philippines"]
        .filter(Boolean)
        .join(", ");

      const components = [hintProvince && `administrative_area:${hintProvince}`, "country:PH"]
        .filter(Boolean)
        .join("|");

      let url =
        `https://maps.googleapis.com/maps/api/geocode/json?` +
        `address=${encodeURIComponent(address)}` +
        `&components=${encodeURIComponent(components)}` +
        `&region=ph&language=en&key=${GOOGLE_API_KEY}`;

      if (anchor) {
        const dLat = 6 / 111;
        const dLon = 6 / (111 * Math.cos((anchor.lat * Math.PI) / 180));
        const sw = `${anchor.lat - dLat},${anchor.lon - dLon}`;
        const ne = `${anchor.lat + dLat},${anchor.lon + dLon}`;
        url += `&bounds=${encodeURIComponent(sw)}|${encodeURIComponent(ne)}`;
      }

      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 6000);

        const res = await fetch(url, { signal: ac.signal });
        const data = await res.json().catch(() => null);
        clearTimeout(t);

        if (data.results?.length > 0) {
          const result = data.results[0];
          const { lat, lng } = result.geometry.location;
          const payload = {
            ts: Date.now(),
            lat: Number(lat),
            lon: Number(lng),
            label: result.formatted_address || address,
            boundary: null,
          };
          GEO_CACHE.set(cacheKey, payload);
          console.log(`[STRATEGY 3] ✓ ${result.formatted_address}`);
          return NextResponse.json({
            ok: true,
            lat: payload.lat,
            lon: payload.lon,
            displayName: payload.label,
            boundary: null,
          });
        }
      } catch (e: any) {
        console.log(`[STRATEGY 3] Error: ${e?.message}`);
      }
    }

    // ========================================================================
    // FINAL FALLBACK: Nominatim (OpenStreetMap)
    // ========================================================================
    console.log(`[FALLBACK] Nominatim: ${query}`);

    const base = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=3&countrycodes=ph&q=${encodeURIComponent(query)}`;

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);

    try {
      const res = await fetch(base, {
        headers: {
          "User-Agent": "ZonalValue-Lookup/1.0",
          "Accept-Language": "en",
        },
        signal: ac.signal,
      });

      const data = await res.json().catch(() => null);
      clearTimeout(t);

      if (!Array.isArray(data) || data.length === 0) {
        return NextResponse.json({ ok: false, error: "No match found" }, { status: 404 });
      }

      const best = data[0];
      const payload = {
        ts: Date.now(),
        lat: Number(best.lat),
        lon: Number(best.lon),
        label: best.display_name || query,
        boundary: null,
      };

      GEO_CACHE.set(cacheKey, payload);
      return NextResponse.json({
        ok: true,
        lat: payload.lat,
        lon: payload.lon,
        displayName: payload.label,
        boundary: null,
      });
    } catch (e: any) {
      clearTimeout(t);
      return NextResponse.json(
        { ok: false, error: e?.message ?? "geocode failed" },
        { status: 500 }
      );
    }
  } catch (e: any) {
    console.error("[GEOCODE ERROR]", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "geocode failed" }, { status: 500 });
  }
}