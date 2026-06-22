import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Short-lived cache so fast typing (and repeated prefixes) don't burn quota.
const CACHE = new Map<string, { ts: number; data: any }>();
const TTL_MS = 1000 * 60 * 60 * 6; // 6h

// Google Places Autocomplete proxy — keeps the API key on the server and
// biases results to the Philippines so suggestions feel local (like Google Maps).
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const input = String(searchParams.get("q") ?? "").trim();
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    if (input.length < 2) return NextResponse.json({ ok: true, suggestions: [] });

    const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!API_KEY) return NextResponse.json({ ok: false, error: "Missing Google API key" }, { status: 400 });

    const cacheKey = `${input.toLowerCase()}|${lat ?? ""},${lon ?? ""}`;
    const hit = CACHE.get(cacheKey);
    if (hit && Date.now() - hit.ts < TTL_MS) {
      return NextResponse.json({ ok: true, suggestions: hit.data });
    }

    const params = new URLSearchParams({
      input,
      key: API_KEY,
      components: "country:ph",
      language: "en",
    });
    // Bias toward where the user is currently looking on the map.
    if (lat && lon && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
      params.set("location", `${lat},${lon}`);
      params.set("radius", "50000");
    }

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const json = await res.json().catch(() => null);

    const suggestions = Array.isArray(json?.predictions)
      ? json.predictions.slice(0, 6).map((p: any) => ({
          description: p.description as string,
          main: p.structured_formatting?.main_text ?? p.description,
          secondary: p.structured_formatting?.secondary_text ?? "",
          placeId: p.place_id as string,
        }))
      : [];

    CACHE.set(cacheKey, { ts: Date.now(), data: suggestions });
    return NextResponse.json({ ok: true, suggestions });
  } catch {
    // Autocomplete is best-effort; never block typing.
    return NextResponse.json({ ok: true, suggestions: [] });
  }
}
