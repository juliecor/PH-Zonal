import { NextResponse } from "next/server";

export const runtime = "nodejs";

function toNum(v: any) { const n = Number(v); return Number.isFinite(n) ? n : null; }

async function overpass(query: string, timeoutMs = 8000) {
  const ac = new AbortController(); const t = setTimeout(()=>ac.abort(), timeoutMs);
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: query, signal: ac.signal });
    const j = await res.json().catch(()=>null);
    if (!res.ok || !j?.elements) return null; return j;
  } catch { return null; } finally { clearTimeout(t); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(()=>({}));
    const lat = toNum(body?.lat); const lon = toNum(body?.lon);
    const radius = Math.max(300, Math.min(3000, Number(body?.radius ?? 1500)));
    if (lat==null || lon==null) return NextResponse.json({ ok:false, error:"lat/lon required" }, { status:400 });

    const q = `
[out:json][timeout:8];
(
  // Named neighbourhoods/suburbs/villages
  nwr(around:${radius},${lat},${lon})["place"~"^(neighbourhood|neighborhood|suburb|quarter|residential|village|hamlet)$"]["name"]; 
  // Named residential areas used as subdivisions
  way(around:${radius},${lat},${lon})["landuse"="residential"]["name"]; 
);
out center tags;`;

    const data = await overpass(q, 8000);
    const elements = Array.isArray(data?.elements) ? data.elements : [];

    const uniq = new Map<string, { name: string; lat: number; lon: number; type: string }>();
    for (const el of elements) {
      const name = String(el?.tags?.name || "").trim(); if (!name) continue;
      const type = String(el?.tags?.place || el?.tags?.landuse || "").trim();
      const cLat = el?.center?.lat ?? el?.lat; const cLon = el?.center?.lon ?? el?.lon;
      if (typeof cLat !== 'number' || typeof cLon !== 'number') continue;
      const key = name.toLowerCase(); if (uniq.has(key)) continue;
      uniq.set(key, { name, lat: cLat, lon: cLon, type });
    }

    return NextResponse.json({ ok:true, items: Array.from(uniq.values()) });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message ?? 'neighborhoods failed' }, { status:500 });
  }
}
