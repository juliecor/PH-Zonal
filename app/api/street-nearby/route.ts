import { NextResponse } from "next/server";

export const runtime = "nodejs";

// simple cache per instance
const CACHE: Map<string, { ts: number; data: any }> = (globalThis as any).__STREET_NEARBY__ ?? new Map();
(globalThis as any).__STREET_NEARBY__ = CACHE;
const TTL = 1000 * 60 * 60 * 12; // 12 hours

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function haversine(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const c = s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

async function overpass(query: string) {
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: query,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.elements) return null;
    return data;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const lat = toNum(body?.lat);
    const lon = toNum(body?.lon);
    const radius = Math.max(80, Math.min(800, Number(body?.radius ?? 220)));
    if (lat == null || lon == null) return NextResponse.json({ ok: false, error: "lat/lon required" }, { status: 400 });

    const key = `${lat.toFixed(5)}|${lon.toFixed(5)}|${radius}`;
    const hit = CACHE.get(key);
    if (hit && Date.now() - hit.ts < TTL) return NextResponse.json({ ok: true, ...hit.data });

    // 1) Try super-fast reverse geocoding from Google (if key present)
    const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
    if (GOOGLE_KEY) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&result_type=route&key=${GOOGLE_KEY}`;
        const r = await fetch(url);
        const j = await r.json().catch(() => null);
        const route = j?.results?.[0];
        const nameComp = Array.isArray(route?.address_components)
          ? route.address_components.find((c: any) => (c?.types || []).includes("route"))
          : null;
        const gName = (nameComp?.long_name || route?.formatted_address || "").trim();
        if (r.ok && gName) {
          const payload = { name: gName, bestDistanceMeters: 0, center: null };
          CACHE.set(key, { ts: Date.now(), data: payload });
          return NextResponse.json({ ok: true, ...payload });
        }
      } catch {}
    }

    // 2) Fast OSM reverse via Nominatim
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
      const r = await fetch(url, { headers: { "User-Agent": "PH-Zonal/1.0" } });
      const j = await r.json().catch(() => null);
      const addr = j?.address || {};
      const nName = addr.road || addr.pedestrian || addr.footway || addr.path || "";
      if (r.ok && nName) {
        const payload = { name: String(nName), bestDistanceMeters: 0, center: null };
        CACHE.set(key, { ts: Date.now(), data: payload });
        return NextResponse.json({ ok: true, ...payload });
      }
    } catch {}

    // 3) Fallback to Overpass (slower but reliable)
    const q = `
[out:json][timeout:20];
(
  way(around:${radius},${lat},${lon})["highway"]["name"];
);
out tags geom;`;

    const data = await overpass(q);
    const elements = Array.isArray(data?.elements) ? data.elements : [];

    let best: any = null;
    let bestD = Infinity;

    for (const el of elements) {
      const name = el?.tags?.name as string | undefined;
      if (!name) continue;
      const geom: Array<{ lat: number; lon: number }> = Array.isArray(el?.geometry) ? el.geometry : [];
      for (const p of geom) {
        const d = haversine(lat, lon, p.lat, p.lon);
        if (d < bestD) {
          bestD = d;
          best = el;
        }
      }
    }

    if (!best) return NextResponse.json({ ok: false, error: "No nearby named street" }, { status: 404 });

    const payload = {
      name: String(best.tags.name),
      bestDistanceMeters: Math.round(bestD),
      center: best?.center ? { lat: best.center.lat, lon: best.center.lon } : null,
    };
    CACHE.set(key, { ts: Date.now(), data: payload });
    return NextResponse.json({ ok: true, ...payload });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "street-nearby failed" }, { status: 500 });
  }
}
