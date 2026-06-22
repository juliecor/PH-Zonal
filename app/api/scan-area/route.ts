import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Cost guards — bounded per scan, and every geocode is cached (geo_zonal) so repeat
// scans of the same area are free.
const MAX_AREAS = 8;      // distinct (city,barangay) the box maps to (wider scan → more)
const MAX_RECORDS = 160;  // records considered for geocoding
const MAX_GEOCODES = 90;  // Google street-geocodes per scan (cache hits don't count)
const GEO_CONCURRENCY = 6;

// In-memory reverse-geocode cache (cheap; a scan does ≤5 reverse lookups).
const REV_CACHE: Map<string, { city: string; barangay: string; province: string } | null> =
  (globalThis as any).__REV_GEO__ ?? new Map();
(globalThis as any).__REV_GEO__ = REV_CACHE;

function comp(components: any[], type: string): string {
  const c = components?.find((x) => (x?.types || []).includes(type));
  return c?.long_name ? String(c.long_name).trim() : "";
}

// Reverse-geocode a point → { city, barangay, province } (best-effort, PH-aware).
// Google returns several results at different granularities; scan ALL of them so we
// catch the barangay even when it's not on the most-specific result.
async function reverseGeocode(lat: number, lon: number) {
  if (!GOOGLE_API_KEY) return null;
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (REV_CACHE.has(key)) return REV_CACHE.get(key)!;
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}` +
      `&region=ph&language=en&key=${GOOGLE_API_KEY}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 6000);
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(t);
    const data = await res.json().catch(() => null);
    const results: any[] = Array.isArray(data?.results) ? data.results : [];
    if (!results.length) { REV_CACHE.set(key, null); return null; }
    let city = "", barangay = "", province = "";
    for (const r of results) {
      const ac1 = r.address_components || [];
      city = city || comp(ac1, "locality") || comp(ac1, "administrative_area_level_3");
      barangay =
        barangay ||
        comp(ac1, "sublocality_level_1") ||
        comp(ac1, "neighborhood") ||
        comp(ac1, "sublocality") ||
        comp(ac1, "administrative_area_level_4") ||
        comp(ac1, "administrative_area_level_5");
      province = province || comp(ac1, "administrative_area_level_2") || comp(ac1, "administrative_area_level_1");
      if (city && barangay) break;
    }
    const clean = (s: string) => s.replace(/^Barangay\s+/i, "").replace(/^Brgy\.?\s+/i, "").trim();
    const out = { city: clean(city), barangay: clean(barangay), province };
    REV_CACHE.set(key, out);
    return out;
  } catch {
    REV_CACHE.set(key, null);
    return null;
  }
}

async function getJson(url: string, cookie: string) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", cookie } });
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

type Rec = { street: string; barangay: string; city: string; province: string; classification: string; value: string };

// Fetch our zonal records for one (city, barangay) on the given domain (a few pages).
async function fetchRecords(baseUrl: string, cookie: string, domain: string, city: string, barangay: string): Promise<Rec[]> {
  const out: Rec[] = [];
  for (let page = 1; page <= 4; page++) {
    const sp = new URLSearchParams({ domain, page: String(page), city, barangay, classification: "", q: "" });
    const data = await getJson(`${baseUrl}/api/zonal?${sp.toString()}`, cookie);
    const rows: any[] = Array.isArray(data?.rows) ? data.rows : [];
    for (const r of rows) {
      out.push({
        street: String(r["Street/Subdivision-"] ?? "").trim(),
        barangay: String(r["Barangay-"] ?? "").trim(),
        city: String(r["City-"] ?? "").trim(),
        province: String(r["Province-"] ?? "").trim(),
        classification: String(r["Classification-"] ?? "").trim(),
        value: String(r["ZonalValuepersqm.-"] ?? "").trim(),
      });
    }
    if (!data?.hasNext || rows.length === 0) break;
  }
  return out;
}

function parseVal(v: string): number | null {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const minLat = Number(body?.minLat), maxLat = Number(body?.maxLat);
    const minLon = Number(body?.minLon), maxLon = Number(body?.maxLon);
    const domain = String(body?.domain ?? "").trim();
    if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite) || maxLat <= minLat || maxLon <= minLon) {
      return NextResponse.json({ ok: false, error: "valid bounds required" }, { status: 400 });
    }
    if (!domain) return NextResponse.json({ ok: false, error: "domain required" }, { status: 400 });
    if (!GOOGLE_API_KEY) return NextResponse.json({ ok: true, points: [], note: "no geocoding key" });

    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = `${proto}://${host}`;
    const cookie = req.headers.get("cookie") || "";

    // 1) Map the box to real areas: reverse-geocode a GRID of points across the box,
    //    denser for bigger boxes so a wide scan samples more barangays.
    const cLat = (minLat + maxLat) / 2, cLon = (minLon + maxLon) / 2;
    const spanLat = maxLat - minLat, spanLon = maxLon - minLon;
    const approxKm = Math.max(spanLat, spanLon) * 111;
    const g = Math.max(1, Math.min(3, Math.round(approxKm / 1.5))); // (g+1)² probes: 2x2 … 4x4
    const probes: number[][] = [];
    for (let i = 0; i <= g; i++) {
      for (let j = 0; j <= g; j++) {
        probes.push([minLat + (spanLat * i) / g, minLon + (spanLon * j) / g]);
      }
    }
    const revs = await Promise.all(probes.map(([la, lo]) => reverseGeocode(la, lo)));
    let areas: { city: string; barangay: string }[] = [];
    const seenArea = new Set<string>();
    for (const rv of revs) {
      if (!rv?.city) continue;
      const k = `${rv.city}|${rv.barangay}`.toLowerCase();
      if (seenArea.has(k)) continue;
      seenArea.add(k);
      areas.push({ city: rv.city, barangay: rv.barangay });
    }
    // FOCUS: if we resolved any barangay, fetch ONLY those barangays (targeted &
    // complete → fast + accurate). Fall back to city-level only when no barangay.
    const withBrgy = areas.filter((a) => a.barangay);
    if (withBrgy.length) areas = withBrgy;
    areas = areas.slice(0, MAX_AREAS);
    if (!areas.length) return NextResponse.json({ ok: true, points: [] });

    // 2) Pull our zonal records for those areas.
    const recsNested = await Promise.all(areas.map((a) => fetchRecords(baseUrl, cookie, domain, a.city, a.barangay)));
    const seenRec = new Set<string>();
    const records: Rec[] = [];
    for (const list of recsNested) {
      for (const r of list) {
        const k = `${r.street}|${r.barangay}|${r.city}`.toLowerCase();
        if (!r.street || seenRec.has(k)) continue;
        seenRec.add(k);
        records.push(r);
        if (records.length >= MAX_RECORDS) break;
      }
      if (records.length >= MAX_RECORDS) break;
    }

    // 3) Geocode each record (cache-first inside /api/geocode), bounded concurrency.
    // Keep points inside the box PLUS a small margin, so a long street (one uniform
    // value) whose geocoded point lands just past the edge is still caught.
    const marginLat = Math.max(0.0015, (maxLat - minLat) * 0.15);
    const marginLon = Math.max(0.0015, (maxLon - minLon) * 0.15);
    const tinyBox = Math.max(maxLat - minLat, maxLon - minLon) < 0.005; // ~550m (house/block scan)
    const candidates: any[] = []; // every geocoded street, with distance to the box centre
    let geocoded = 0;
    for (let i = 0; i < records.length && geocoded < MAX_GEOCODES; i += GEO_CONCURRENCY) {
      const batch = records.slice(i, i + GEO_CONCURRENCY);
      const done = await Promise.all(
        batch.map(async (r) => {
          try {
            const res = await fetch(`${baseUrl}/api/geocode`, {
              method: "POST",
              headers: { "Content-Type": "application/json", cookie },
              body: JSON.stringify({
                query: [r.street, r.barangay, r.city, r.province, "Philippines"].filter(Boolean).join(", "),
                street: r.street,
                hintBarangay: r.barangay,
                hintCity: r.city,
                hintProvince: r.province,
                baseLatLon: { lat: cLat, lon: cLon },
                valuePerSqm: parseVal(r.value),
                classification: r.classification,
              }),
            });
            const j = await res.json().catch(() => null);
            if (j?.ok && Number.isFinite(Number(j.lat)) && Number.isFinite(Number(j.lon))) {
              return { r, lat: Number(j.lat), lon: Number(j.lon) };
            }
          } catch {}
          return null;
        })
      );
      geocoded += batch.length;
      for (const d of done) {
        if (!d) continue;
        const val = parseVal(d.r.value);
        if (!val) continue;
        const dx = (d.lon - cLon) * Math.cos((cLat * Math.PI) / 180);
        const dy = d.lat - cLat;
        candidates.push({
          lat: d.lat, lon: d.lon, value_per_sqm: val,
          classification_code: d.r.classification, street: d.r.street,
          barangay: d.r.barangay, city: d.r.city, province: d.r.province,
          _d2: dx * dx + dy * dy, // squared distance (degrees) for sorting
        });
      }
    }

    // Inside the box (+margin) is the normal result. But for a TINY scan (a house/lot)
    // or when nothing lands inside, fall back to the NEAREST zonal values to the centre
    // — i.e. the value of that street / the closest possible — so you always get an answer.
    const inBox = candidates.filter(
      (p) => !(p.lat < minLat - marginLat || p.lat > maxLat + marginLat || p.lon < minLon - marginLon || p.lon > maxLon + marginLon)
    );
    let chosen = inBox;
    let nearest = false;
    if (tinyBox || inBox.length === 0) {
      chosen = candidates.slice().sort((a, b) => a._d2 - b._d2).slice(0, 6); // nearest few
      nearest = chosen.length > 0;
    }
    const points = chosen.map(({ _d2, ...p }) => p);

    return NextResponse.json({ ok: true, points, areas, considered: records.length, nearest });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "scan-area failed" }, { status: 500 });
  }
}
