import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE = new Map<string, any>();
const TTL = 1000 * 60 * 60 * 24 * 14;

function cleanName(s: string) {
  return String(s ?? "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^\p{L}\p{N}\s,.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePH(s: string) {
  return cleanName(s)
    .replace(/\bPOB\b/gi, "Poblacion")
    .replace(/\bSTO\b/gi, "Santo")
    .replace(/\bSTA\b/gi, "Santa")
    .replace(/NIÑO/gi, "Nino")
    .replace(/Ñ/gi, "N");
}

function includesLoose(hay: string, needle: string) {
  const h = normalizePH(hay).toLowerCase();
  const n = normalizePH(needle).toLowerCase();
  if (!n) return true;
  return h.includes(n);
}

async function nominatim(query: string) {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?format=jsonv2&addressdetails=1&limit=3&countrycodes=ph&q=${encodeURIComponent(query)}`;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "BIR-Zonal-Lookup/1.0 (repompojuliecor@gmail.com)",
        "Accept-Language": "en",
      },
      signal: ac.signal,
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false as const, error: `Nominatim ${res.status}` };
    if (!Array.isArray(data) || data.length === 0) return { ok: false as const, error: "No match" };
    return { ok: true as const, results: data };
  } catch (e: any) {
    return { ok: false as const, error: e?.name === "AbortError" ? "Timeout" : (e?.message ?? "Fetch failed") };
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const query = normalizePH(body?.query ?? "");
    const hintCity = normalizePH(body?.hintCity ?? "");
    const hintProvince = normalizePH(body?.hintProvince ?? "");

    if (!query) return NextResponse.json({ ok: false, error: "query required" }, { status: 400 });

    const cacheKey = `${query}|${hintCity}|${hintProvince}`.toLowerCase();
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL) {
      return NextResponse.json({ ok: true, ...cached });
    }

    const r = await nominatim(query);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 404 });

    // ✅ pick the best result that matches the intended city/province
    const best =
      r.results.find((x: any) => {
        const addr = x?.address ?? {};
        const cityLike = `${addr.city ?? ""} ${addr.town ?? ""} ${addr.municipality ?? ""} ${addr.county ?? ""}`;
        const stateLike = `${addr.state ?? ""} ${addr.region ?? ""}`;

        const okCity = hintCity ? includesLoose(cityLike, hintCity) : true;
        const okProv = hintProvince ? includesLoose(stateLike, hintProvince) : true;

        return okCity && okProv;
      }) || r.results[0];

    const payload = {
      ts: Date.now(),
      lat: Number(best.lat),
      lon: Number(best.lon),
      label: String(best.display_name ?? query),
    };

    CACHE.set(cacheKey, payload);

    return NextResponse.json({
      ok: true,
      lat: payload.lat,
      lon: payload.lon,
      displayName: payload.label,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "geocode failed" }, { status: 500 });
  }
}
