import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Way = {
  id: number;
  tags?: Record<string, string>;
  geometry: Array<{ lat: number; lon: number }>;
};

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

    // Special aliasing: In Cebu City Sambag II, "AZNAR ROAD" ~= "AZNAR STREET"
    let streetNorm = normStreet(streetNameRaw);
    const cityN = String(cityRaw).toUpperCase();
    const brgyN = String(barangayRaw).toUpperCase();
    if (streetNorm.includes("AZNAR") && cityN.includes("CEBU") && (/(SAMBAG\s*II|SAMBAG\s*2)\b/).test(brgyN)) {
      streetNorm = "AZNAR STREET";
    }
    let radius = 1500; // wider search window in meters (for centroid/pin offset)

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

    return NextResponse.json({
      ok: true,
      geojson: { type: "FeatureCollection", features },
      meta: { matched: features.length > 0, bestScore: best?.score ?? null, name: best?.name ?? null },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
