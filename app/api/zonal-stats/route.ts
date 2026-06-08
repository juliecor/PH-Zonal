import { NextResponse } from "next/server";
import { fetchZonalValuesByDomain } from "../../lib/zonalByDomain";

export const runtime = "nodejs";

// Small in-memory cache so repeated selections in the same barangay are instant.
const CACHE: Map<string, { ts: number; payload: any }> =
  (globalThis as any).__ZONAL_STATS_CACHE__ ?? new Map();
(globalThis as any).__ZONAL_STATS_CACHE__ = CACHE;
const TTL_MS = 1000 * 60 * 30; // 30 minutes

function norm(s: any) {
  return String(s ?? "")
    .toUpperCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\bBRGY\.?\b/g, "")
    .replace(/\bBARANGAY\b/g, "")
    .replace(/Ñ/g, "N")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
function looseEq(v: any, w: any) {
  const a = norm(v), b = norm(w);
  if (!b) return true;
  return a === b || a.includes(b) || b.includes(a);
}
function brgyNum(s: any): string | null {
  const t = String(s ?? "").toUpperCase();
  const m = t.match(/\b(?:BARANGAY|BRGY\.?)\s*(\d{1,4})\b/);
  if (m?.[1]) return m[1];
  const m2 = t.match(/\d{1,4}/);
  return m2 ? m2[0] : null;
}
function matchBrgy(v: any, w: any) {
  const vn = brgyNum(v), wn = brgyNum(w);
  if (vn && wn) return vn === wn;
  return norm(v) === norm(w);
}
function parseVal(raw: any, formatted: any): number | null {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  const c = String(formatted ?? "").replace(/[^0-9.]/g, "");
  const p = parseFloat(c);
  return Number.isFinite(p) && p > 0 ? p : null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = String(searchParams.get("domain") ?? "").trim();
    const city = String(searchParams.get("city") ?? "").trim();
    const barangay = String(searchParams.get("barangay") ?? "").trim();
    const classification = String(searchParams.get("classification") ?? "").trim();

    if (!domain || !city || !barangay) {
      return NextResponse.json({ ok: false, error: "domain, city, barangay are required" }, { status: 400 });
    }

    const key = `${domain}|${city}|${barangay}|${classification}`.toLowerCase();
    const hit = CACHE.get(key);
    if (hit && Date.now() - hit.ts < TTL_MS) {
      return NextResponse.json(hit.payload, { headers: { "Cache-Control": "public, max-age=300" } });
    }

    // Pull a wide slice pre-filtered by the barangay term, then match precisely.
    const data = await fetchZonalValuesByDomain({ domain, page: 1, itemsPerPage: 1000, search: barangay });
    const rows = Array.isArray(data?.rows) ? data.rows : [];

    const matched = rows.filter(
      (r: any) =>
        looseEq(r["City-"], city) &&
        matchBrgy(r["Barangay-"], barangay) &&
        (!classification || looseEq(r["Classification-"], classification))
    );

    const vals = matched
      .map((r: any) => parseVal(r.__zonal_raw, r["ZonalValuepersqm.-"]))
      .filter((n: any): n is number => n != null);

    if (vals.length < 2) {
      const payload = { ok: true, stats: null, count: vals.length };
      CACHE.set(key, { ts: Date.now(), payload });
      return NextResponse.json(payload);
    }

    const sorted = [...vals].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;

    const payload = { ok: true, stats: { min, max, median, mean, count: vals.length } };
    CACHE.set(key, { ts: Date.now(), payload });
    return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "stats failed" }, { status: 500 });
  }
}
