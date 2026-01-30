import { NextResponse } from "next/server";

export const runtime = "nodejs";

type InItem = { name: string; lat?: number; lon?: number; type?: string };

const CACHE = new Map<string, { ts: number; data: any }>();
const TTL_MS = 1000 * 60 * 60 * 12; // 12h

function getKey(i: InItem, lat?: number, lon?: number) {
  return `${(i.name || '').toLowerCase()}|${i.type || ''}|${lat ?? ''},${lon ?? ''}`;
}

function photoUrlFromRef(ref: string, key: string, maxWidth = 320) {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(
    ref
  )}&key=${encodeURIComponent(key)}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items: InItem[] = Array.isArray(body?.items) ? body.items : [];
    const lat = Number(body?.lat);
    const lon = Number(body?.lon);
    const type = String(body?.type ?? ""); // optional hint

    const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!API_KEY) return NextResponse.json({ ok: false, error: "Missing Google API key" }, { status: 400 });

    const out: any[] = [];

    for (const it of items) {
      if (!it?.name) continue;
      const key = getKey(it, lat, lon);
      const hit = CACHE.get(key);
      if (hit && Date.now() - hit.ts < TTL_MS) {
        out.push(hit.data);
        continue;
      }

      // Use Text Search with location bias
      const query = encodeURIComponent(`${it.name} ${it.type ?? type ?? ''}`.trim());
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=${lat},${lon}&radius=1500&key=${API_KEY}`;

      let placeId: string | null = null;
      try {
        const r = await fetch(url);
        const j = await r.json();
        placeId = j?.results?.[0]?.place_id ?? null;
      } catch {}

      let phone: string | null = null;
      let website: string | null = null;
      let photoUrl: string | null = null;

      if (placeId) {
        try {
          const dUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
            placeId
          )}&fields=formatted_phone_number,international_phone_number,website,photos&key=${API_KEY}`;
          const r2 = await fetch(dUrl);
          const d = await r2.json();
          const det = d?.result ?? {};
          phone = det?.international_phone_number || det?.formatted_phone_number || null;
          website = (det?.website as string | undefined) ?? null;
          const ref = det?.photos?.[0]?.photo_reference;
          if (ref) photoUrl = photoUrlFromRef(ref, API_KEY as string);
        } catch {}
      }

      const payload = { name: it.name, lat: it.lat, lon: it.lon, type: it.type ?? type, phone, website, photoUrl };
      CACHE.set(key, { ts: Date.now(), data: payload });
      out.push(payload);
    }

    return NextResponse.json({ ok: true, items: out });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "enrich failed" }, { status: 500 });
  }
}
