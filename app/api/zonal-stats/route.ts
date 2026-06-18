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

// --- DB (Laravel) backend union: include rows that exist ONLY in the database ---
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";

function domainToProvince(domain: string): string | null {
  const host = String(domain || "").trim().toLowerCase();
  const sub = host.split(".")[0] || host;
  if (!sub) return null;
  if (sub.includes("negrosoriental-siquijor")) return "NEGROS ORIENTAL";
  if (sub.includes("cebu")) return "CEBU";
  if (sub.includes("bohol")) return "BOHOL";
  if (sub.includes("iloilo")) return "ILOILO";
  if (sub.includes("davaodelsur")) return "DAVAO DEL SUR";
  if (sub.includes("davaodelnorte-samal-compostelavalley")) return "DAVAO DEL NORTE";
  if (sub.includes("zamboangadelsur")) return "ZAMBOANGA DEL SUR";
  if (sub.includes("agusandelnorte")) return "AGUSAN DEL NORTE";
  if (sub.includes("ncr1stdistrict")) return "NCR";
  if (sub.includes("benguet")) return "BENGUET";
  if (sub.includes("cagayan-batanes")) return "CAGAYAN";
  if (sub.includes("abra")) return "ABRA";
  if (sub.includes("misamisoriental-camiguin")) return "CAMIGUIN-MISAMISORIENTAL";
  if (sub.includes("agusandelsur")) return "AGUSAN DEL SUR";
  if (sub.includes("kalinga-apayao")) return "KALINGA";
  if (sub.includes("aklan")) return "AKLAN";
  if (sub.includes("aurora")) return "AURORA";
  if (sub.includes("laguna")) return "LAGUNA";
  if (sub.includes("lanaodelsur")) return "LANAO DEL SUR";
  if (sub.includes("leyte-bilaran")) return "LEYTE";
  if (sub.includes("mtprovince")) return "MOUNTAIN PROVINCE";
  if (sub.includes("northernsamar")) return "NORTHERN SAMAR";
  if (sub.includes("nuevavizcaya")) return "NUEVA VIZCAYA";
  if (sub.includes("quirino")) return "QUIRINO";
  if (sub.includes("southcotabato")) return "SOUTH COTABATO";
  if (sub.includes("tawitawi")) return "TAWI-TAWI";
  if (sub.includes("zamboangadelnorte")) return "ZAMBOANGA DEL NORTE";
  if (sub.includes("zamboangasibugay")) return "ZAMBOANGA SIBUGAY";
  return null;
}

type ValuedRow = { v: number; street: string; cls: string };

// Pull ALL matching rows for a barangay from the DB (paginated). Note: each
// /zonal-values request may deduct a user token — this is why zonal-stats caches
// its result for 30 minutes (so the DB is hit at most once per barangay per TTL).
async function fetchDbValued(args: {
  province: string;
  city: string;
  barangay: string;
  classification: string;
  token: string;
}): Promise<ValuedRow[]> {
  if (!BACKEND_URL) return [];
  const { province, city, barangay, classification, token } = args;
  const out: ValuedRow[] = [];
  let page = 1;
  const MAX_PAGES = 10;
  while (page <= MAX_PAGES) {
    const params = new URLSearchParams({ province, page: String(page), per_page: "100" });
    if (city) params.set("city", city);
    if (barangay) params.set("barangay", barangay);
    if (classification && /^[A-Z0-9-]{1,5}$/.test(classification)) {
      params.set("classification_code", classification);
    }
    const url = `${BACKEND_URL.replace(/\/$/, "")}/api/zonal-values?${params.toString()}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    let j: any;
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) break;
      j = await res.json();
    } catch {
      break;
    }
    const data = Array.isArray(j?.data) ? j.data : [];
    for (const r of data) {
      const v = Number(r?.value_per_sqm);
      if (Number.isFinite(v) && v > 0) {
        out.push({
          v,
          street: String(r?.street_location ?? r?.vicinity ?? "").trim(),
          cls: String(r?.classification_code ?? "").trim(),
        });
      }
    }
    const last = Number(j?.last_page ?? 1);
    if (!data.length || page >= last) break;
    page++;
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cookieHeader = req.headers.get("cookie") || "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)authToken=([^;]+)/);
    const authToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : "";
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

    // Keep each value together with its street + classification so we can report
    // WHICH street is the most/least expensive (not just the numbers).
    const valued = matched
      .map((r: any) => ({
        v: parseVal(r.__zonal_raw, r["ZonalValuepersqm.-"]),
        street: String(r["Street/Subdivision-"] ?? r["Vicinity-"] ?? "").trim(),
        cls: String(r["Classification-"] ?? "").trim(),
      }))
      .filter((x: any): x is ValuedRow => x.v != null);

    // UNION the DB (Laravel) rows — these may include values that exist ONLY in the
    // database and are missing from the spreadsheet. Deduped by street|class|value.
    const province = domainToProvince(domain);
    if (province && BACKEND_URL) {
      const dbRows = await fetchDbValued({ province, city, barangay, classification, token: authToken });
      if (dbRows.length) {
        const seen = new Set(
          valued.map((x) => `${norm(x.street)}|${norm(x.cls)}|${x.v}`)
        );
        for (const r of dbRows) {
          const k = `${norm(r.street)}|${norm(r.cls)}|${r.v}`;
          if (!seen.has(k)) {
            seen.add(k);
            valued.push(r);
          }
        }
      }
    }

    const vals = valued.map((x) => x.v);

    if (vals.length < 2) {
      const payload = { ok: true, stats: null, count: vals.length };
      CACHE.set(key, { ts: Date.now(), payload });
      return NextResponse.json(payload);
    }

    const sortedRows = [...valued].sort((a, b) => a.v - b.v);
    const sorted = sortedRows.map((x) => x.v);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;

    const lowest = sortedRows[0];
    const highest = sortedRows[sortedRows.length - 1];

    const payload = {
      ok: true,
      stats: {
        min,
        max,
        median,
        mean,
        count: vals.length,
        minStreet: lowest.street,
        minClass: lowest.cls,
        maxStreet: highest.street,
        maxClass: highest.cls,
      },
    };
    CACHE.set(key, { ts: Date.now(), payload });
    return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "stats failed" }, { status: 500 });
  }
}
