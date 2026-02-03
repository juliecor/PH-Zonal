import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Way = {
  id: number;
  tags?: Record<string, string>;
  geometry: Array<{ lat: number; lon: number }>;
};

// In-memory cache to avoid repeated Overpass calls for the same request
const SG_CACHE: Map<string, { ts: number; data: any }> = (globalThis as any).__SG_CACHE__ ?? new Map();
(globalThis as any).__SG_CACHE__ = SG_CACHE;
const SG_TTL = 1000 * 60 * 60 * 12; // 12 hours

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "";

function degOffsetMeters(lat: number, dxMeters: number, dyMeters: number) {
  const dLat = dyMeters / 111000;
  const dLon = dxMeters / (111000 * Math.cos((lat * Math.PI) / 180));
  return { dLat, dLon };
}

async function googleReverseRouteName(lat: number, lon: number) {
  if (!GOOGLE_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&result_type=route&key=${GOOGLE_KEY}`;
    const r = await fetch(url);
    const j = await r.json().catch(() => null);
    const route = j?.results?.[0];
    const comp = Array.isArray(route?.address_components)
      ? route.address_components.find((c: any) => (c?.types || []).includes("route"))
      : null;
    const gName = (comp?.long_name || route?.formatted_address || "").trim();
    return gName || null;
  } catch { return null; }
}

async function googleNearestRoadLine(lat: number, lon: number) {
  if (!GOOGLE_KEY) return null;
  try {
    // sample points around the click within ~60m radius to cover the street segment
    const pts: string[] = [];
    const radius = 60;
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const ang = (2 * Math.PI * i) / steps;
      const dx = Math.cos(ang) * radius;
      const dy = Math.sin(ang) * radius;
      const off = degOffsetMeters(lat, dx, dy);
      pts.push(`${lat + off.dLat},${lon + off.dLon}`);
    }
    const url = `https://roads.googleapis.com/v1/nearestRoads?points=${encodeURIComponent(pts.join("|"))}&key=${GOOGLE_KEY}`;
    const r = await fetch(url);
    const j = await r.json().catch(() => null);
    const arr = Array.isArray(j?.snappedPoints) ? j.snappedPoints : [];
    if (!arr.length) return null;
    // group by placeId and take the largest cluster
    const clusters: Record<string, Array<{ lat: number; lon: number; idx: number }>> = {};
    arr.forEach((sp: any) => {
      const pid = sp.placeId || ""; const loc = sp.location || {};
      if (!pid || typeof loc.latitude !== "number" || typeof loc.longitude !== "number") return;
      (clusters[pid] = clusters[pid] || []).push({ lat: loc.latitude, lon: loc.longitude, idx: Number(sp.originalIndex ?? 0) });
    });
    let bestKey: string | null = null; let bestLen = 0;
    for (const k of Object.keys(clusters)) {
      const n = clusters[k].length;
      if (n > bestLen) { bestLen = n; bestKey = k; }
    }
    if (!bestKey) return null;
    const ptsBest = clusters[bestKey].sort((a,b)=>a.idx-b.idx);
    const coordinates = ptsBest.map((p)=>[p.lon, p.lat]);
    if (coordinates.length < 2) return null;
    const feature = {
      type: "Feature",
      properties: { id: bestKey, name: null },
      geometry: { type: "LineString", coordinates },
    } as any;
    const name = await googleReverseRouteName(lat, lon);
    if (name) feature.properties.name = name;
    return feature;
  } catch { return null; }
}

async function googleSnapToRoadsLine(lat: number, lon: number) {
  if (!GOOGLE_KEY) return null;
  try {
    // Build a short cross path (~120m) through the point to get a good segment
    const points: Array<{lat:number; lon:number}> = [];
    const half = 60; // meters
    const steps = 6;
    // horizontal
    for (let i = -steps; i <= steps; i++) {
      const dx = (i * half) / steps; const off = degOffsetMeters(lat, dx, 0);
      points.push({ lat: lat + off.dLat, lon: lon + off.dLon });
    }
    // vertical
    for (let i = -steps; i <= steps; i++) {
      const dy = (i * half) / steps; const off = degOffsetMeters(lat, 0, dy);
      points.push({ lat: lat + off.dLat, lon: lon + off.dLon });
    }
    const path = points.map(p => `${p.lat},${p.lon}`).join("|");
    const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(path)}&interpolate=true&key=${GOOGLE_KEY}`;
    const r = await fetch(url);
    const j = await r.json().catch(()=>null);
    const arr = Array.isArray(j?.snappedPoints) ? j.snappedPoints : [];
    if (!arr.length) return null;
    const coordinates = arr.map((sp:any)=>[sp.location?.longitude, sp.location?.latitude]).filter((xy:any)=>typeof xy?.[0]==='number' && typeof xy?.[1]==='number');
    if (coordinates.length < 2) return null;
    const feature = {
      type: "Feature",
      properties: { id: "snapToRoads", name: null },
      geometry: { type: "LineString", coordinates },
    } as any;
    const name = await googleReverseRouteName(lat, lon);
    if (name) feature.properties.name = name;
    return feature;
  } catch { return null; }
}

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function escapeRegex(s: string) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normStreet(input: string) {
  let s = String(input || "").toUpperCase().trim();
  s = s.replace(/[.,]/g, " ");
  s = s.replace(/\s+/g, " ");
  s = s.replace(/\bST\b/g, "STREET");
  s = s.replace(/\bRD\b/g, "ROAD");
  s = s.replace(/\bAVE\b/g, "AVENUE");
  s = s.replace(/\bBLVD\b/g, "BOULEVARD");
  s = s.replace(/\bDR\b/g, "DRIVE");
  return s.trim();
}

function tokenizeName(raw?: string) {
  if (!raw) return [] as string[];
  return String(raw)
    .split(/[;|]/)
    .map((x) => normStreet(x))
    .filter(Boolean);
}

function levenshtein(a: string, b: string) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  const d = levenshtein(a, b);
  const L = Math.max(a.length, b.length) || 1;
  return 1 - d / L;
}

function approxMinDistMeters(lat: number, lon: number, geom: Array<{ lat: number; lon: number }>) {
  // approximate by nearest vertex (fast)
  let best = Infinity;
  const R = 6371000;
  for (const p of geom) {
    const dLat = ((p.lat - lat) * Math.PI) / 180;
    const dLon = ((p.lon - lon) * Math.PI) / 180;
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLon / 2);
    const C = s1 * s1 + Math.cos((lat * Math.PI) / 180) * Math.cos((p.lat * Math.PI) / 180) * s2 * s2;
    const d = 2 * R * Math.atan2(Math.sqrt(C), Math.sqrt(1 - C));
    if (d < best) best = d;
  }
  return best;
}

function nearestVertex(lat: number, lon: number, geom: Array<{ lat: number; lon: number }>) {
  let best: { lat: number; lon: number } | null = null;
  let bestD = Infinity;
  const R = 6371000;
  for (const p of geom) {
    const dLat = ((p.lat - lat) * Math.PI) / 180;
    const dLon = ((p.lon - lon) * Math.PI) / 180;
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLon / 2);
    const C = s1 * s1 + Math.cos((lat * Math.PI) / 180) * Math.cos((p.lat * Math.PI) / 180) * s2 * s2;
    const d = 2 * R * Math.atan2(Math.sqrt(C), Math.sqrt(1 - C));
    if (d < bestD) {
      bestD = d;
      best = { lat: p.lat, lon: p.lon };
    }
  }
  return best;
}

function wayToFeature(way: Way, chosenName?: string) {
  return {
    type: "Feature",
    properties: {
      id: way.id,
      name: chosenName || way.tags?.name || way.tags?.official_name || way.tags?.short_name || way.tags?.alt_name || null,
    },
    geometry: {
      type: "LineString",
      coordinates: way.geometry.map((p) => [p.lon, p.lat]),
    },
  } as any;
}

async function overpass(query: string) {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: query,
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.elements) return data;
    } catch {}
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const streetNameRaw = String(body?.streetName ?? "").trim();
    const cityRaw = String(body?.city ?? "").trim();
    const barangayRaw = String(body?.barangay ?? "").trim();
    const lat = toNum(body?.lat);
    const lon = toNum(body?.lon);
    if (!streetNameRaw) return NextResponse.json({ ok: false, error: "Missing streetName" }, { status: 400 });
    if (lat == null || lon == null) return NextResponse.json({ ok: false, error: "Missing lat/lon" }, { status: 400 });

    const cacheKey = `${normStreet(streetNameRaw)}|${cityRaw.toUpperCase()}|${barangayRaw.toUpperCase()}|${lat.toFixed(4)},${lon.toFixed(4)}`;
    const hit = SG_CACHE.get(cacheKey);
    if (hit && Date.now() - hit.ts < SG_TTL) return NextResponse.json(hit.data);

    // Special aliasing: In Cebu City Sambag II, "AZNAR ROAD" ~= "AZNAR STREET"
    let streetNorm = normStreet(streetNameRaw);
    const cityN = String(cityRaw).toUpperCase();
    const brgyN = String(barangayRaw).toUpperCase();
    if (streetNorm.includes("AZNAR") && cityN.includes("CEBU") && (/(SAMBAG\s*II|SAMBAG\s*2)\b/).test(brgyN)) {
      streetNorm = "AZNAR STREET";
    }
    // Use a tighter default radius for OSM fallback performance
    let radius = 600;

    const tokens = streetNorm
      .split(" ")
      .filter((t) => t.length >= 2)
      .slice(0, 3);
    const tokenFilter = tokens.map((t) => `["name"~"${escapeRegex(t)}", i]`).join("");
    const altToken = tokens.map((t) => `["alt_name"~"${escapeRegex(t)}", i]`).join("");
    const offToken = tokens.map((t) => `["official_name"~"${escapeRegex(t)}", i]`).join("");
    const shortToken = tokens.map((t) => `["short_name"~"${escapeRegex(t)}", i]`).join("");

    const q = `
[out:json][timeout:25];
(
  way(around:${radius},${lat},${lon})["highway"]["name"]${tokenFilter};
  way(around:${radius},${lat},${lon})["highway"]["official_name"]${offToken};
  way(around:${radius},${lat},${lon})["highway"]["short_name"]${shortToken};
  way(around:${radius},${lat},${lon})["highway"]["alt_name"]${altToken};
  way(around:${Math.min(400, radius)},${lat},${lon})["highway"]["name"]; // fallback close-by named ways
);
out tags geom;`;

    let data = await overpass(q);
    // Fallback: query all named highways nearby if token search failed
    if (!data || !Array.isArray(data.elements) || data.elements.length === 0) {
      const qAll = `
[out:json][timeout:25];
(
  way(around:${radius},${lat},${lon})["highway"]["name"];
);
out tags geom;`;
      data = await overpass(qAll);
      if (!data) {
        return NextResponse.json({ ok: true, geojson: { type: "FeatureCollection", features: [] }, meta: { matched: false, note: "overpass-unavailable" } });
      }
    }

    const ways: Way[] = (data.elements ?? [])
      .filter((x: any) => x?.type === "way" && Array.isArray(x?.geometry))
      .map((x: any) => ({ id: x.id, tags: x.tags ?? {}, geometry: x.geometry }));

    if (!ways.length) {
      // final attempt: enlarge radius further one time
      radius = 2500;
      const qWide = `
[out:json][timeout:25];
(
  way(around:${radius},${lat},${lon})["highway"]["name"];
);
out tags geom;`;
      const wdata = await overpass(qWide);
      const wlist: Way[] = (wdata?.elements ?? [])
        .filter((x: any) => x?.type === "way" && Array.isArray(x?.geometry))
        .map((x: any) => ({ id: x.id, tags: x.tags ?? {}, geometry: x.geometry }));
      if (!wlist.length) {
      return NextResponse.json({ ok: true, geojson: { type: "FeatureCollection", features: [] }, meta: { matched: false } });
      }
      ways.push(...wlist);
    }

    // Try Google Roads first for a quick, map-consistent line
    if (GOOGLE_KEY) {
      let gFeature = await googleSnapToRoadsLine(lat!, lon!);
      if (!gFeature) gFeature = await googleNearestRoadLine(lat!, lon!);
      if (gFeature) {
        const snap = nearestVertex(lat!, lon!, (gFeature.geometry.coordinates as any[]).map(([x,y]:[number,number])=>({lat:y, lon:x})));
        const payload = {
          ok: true,
          geojson: { type: "FeatureCollection", features: [gFeature] },
          meta: { matched: true, bestScore: 1, name: String(gFeature.properties?.name || streetNameRaw || ""), center: snap },
        };
        SG_CACHE.set(cacheKey, { ts: Date.now(), data: payload });
        return NextResponse.json(payload);
      }
    }

    const target = normStreet(streetNorm);
    let best: { way: Way; score: number; name: string } | null = null;

    for (const w of ways) {
      const names = [
        ...tokenizeName(w.tags?.name),
        ...tokenizeName(w.tags?.official_name),
        ...tokenizeName(w.tags?.short_name),
        ...tokenizeName(w.tags?.alt_name),
      ];
      const set = Array.from(new Set(names));
      if (!set.length) continue;
      for (const nm of set) {
        let score = 0;
        if (nm === target) score = 1.0;
        else if (nm.includes(target) || target.includes(nm)) score = 0.92;
        else score = similarity(nm, target);
        // distance bonus
        const dist = approxMinDistMeters(lat, lon, w.geometry);
        const bonus = Math.max(0, 1 - dist / radius) * 0.15;
        score += bonus;
        if (!best || score > best.score) best = { way: w, score, name: nm };
      }
    }

    const threshold = 0.4; // allow small typos/variants (e.g., AZNAR vs AZNER)
    const features = best && best.score >= threshold ? [wayToFeature(best.way, best.name)] : [];

    let snap: { lat: number; lon: number } | null = null;
    if (features.length && lat != null && lon != null) {
      snap = nearestVertex(lat, lon, (best as any).way.geometry);
      if (!snap) {
        // fallback: average of vertices
        const g = (best as any).way.geometry as Array<{ lat: number; lon: number }>;
        if (g && g.length) {
          const s = g.reduce((acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }), { lat: 0, lon: 0 });
          snap = { lat: s.lat / g.length, lon: s.lon / g.length };
        }
      }
    }

    const payload = {
      ok: true,
      geojson: { type: "FeatureCollection", features },
      meta: { matched: features.length > 0, bestScore: best?.score ?? null, name: best?.name ?? null, center: snap },
    };
    SG_CACHE.set(cacheKey, { ts: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
