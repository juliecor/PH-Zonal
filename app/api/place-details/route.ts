import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Cache place details (name/address rarely change) so repeat clicks are free.
const CACHE = new Map<string, { ts: number; data: any }>();
const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// Resolve a clicked map POI (placeId from Google's base-map icon) → its name,
// address and exact coordinates. Keeps the API key server-side.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const placeId = String(searchParams.get("placeId") ?? "").trim();
    if (!placeId) return NextResponse.json({ ok: false, error: "placeId required" }, { status: 400 });

    const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!API_KEY) return NextResponse.json({ ok: false, error: "Missing Google API key" }, { status: 400 });

    const hit = CACHE.get(placeId);
    if (hit && Date.now() - hit.ts < TTL_MS) return NextResponse.json({ ok: true, ...hit.data });

    const params = new URLSearchParams({
      place_id: placeId,
      key: API_KEY,
      language: "en",
      fields: "name,formatted_address,geometry,types",
    });
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const json = await res.json().catch(() => null);
    const r = json?.result;
    if (!r) return NextResponse.json({ ok: false, error: "not found" });

    const data = {
      name: r.name ?? "",
      address: r.formatted_address ?? "",
      lat: r.geometry?.location?.lat ?? null,
      lon: r.geometry?.location?.lng ?? null,
      types: Array.isArray(r.types) ? r.types : [],
    };
    CACHE.set(placeId, { ts: Date.now(), data });
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json({ ok: false, error: "lookup failed" }, { status: 500 });
  }
}
