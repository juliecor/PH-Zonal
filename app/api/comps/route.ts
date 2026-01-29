// // app/api/comps/route.ts
// import { NextResponse } from "next/server";
// import { fetchZonalValuesByDomain, fetchZonalIndex } from "../../lib/zonalByDomain";

// export const runtime = "nodejs";
// type AnyRow = Record<string, any>;

// const ZONAL_CACHE: Map<string, { ts: number; rows: AnyRow[] }> =
//   (globalThis as any).__ZONAL_CACHE__ ?? new Map();
// (globalThis as any).__ZONAL_CACHE__ = ZONAL_CACHE;

// const TTL_MS = 1000 * 60 * 30; // 30 min
// const PAGE_SIZE = 1000;
// const HARD_CAP_PAGES = 120;

// function getVal(row: AnyRow, key: string) {
//   return row?.cells?.[key]?.value ?? row?.cells?.[key]?.formattedValue ?? row?.[key] ?? "";
// }

// function norm(s: any) {
//   return String(s ?? "")
//     .toUpperCase()
//     .replace(/\(.*?\)/g, "")
//     .replace(/\bBRGY\.?\b/g, "")
//     .replace(/\bBARANGAY\b/g, "")
//     .replace(/Ñ/g, "N")
//     .replace(/[^\p{L}\p{N}\s-]/gu, "")
//     .replace(/\s+/g, " ")
//     .trim();
// }

// function matchesLoose(value: any, want: any) {
//   const v = norm(value);
//   const w = norm(want);
//   if (!w) return true;
//   return v === w || v.includes(w) || w.includes(v);
// }

// function extractBarangayNumber(s: any): string | null {
//   const t = String(s ?? "").toUpperCase();
//   const m = t.match(/\b(?:BARANGAY|BRGY\.?)\s*(\d{1,4})\b/);
//   if (m?.[1]) return m[1];
//   const m2 = t.match(/\d{1,4}/);
//   return m2 ? m2[0] : null;
// }

// function matchesBarangay(value: any, want: any) {
//   const vn = extractBarangayNumber(value);
//   const wn = extractBarangayNumber(want);
//   if (vn && wn) return vn === wn;
//   return norm(value) === norm(want);
// }

// function parseZonal(v: any): number | null {
//   const n = Number(String(v ?? "").replace(/,/g, "").trim());
//   return Number.isFinite(n) ? n : null;
// }

// async function getDomainRows(domain: string) {
//   const cached = ZONAL_CACHE.get(domain);
//   if (cached && Date.now() - cached.ts < TTL_MS) return cached.rows;

//   const idx = await fetchZonalIndex(domain);
//   const rowsLimit = Number(idx?.rowsLimit ?? 5000);

//   const pagesNeeded = Math.min(HARD_CAP_PAGES, Math.max(1, Math.ceil(rowsLimit / PAGE_SIZE)));
//   const all: AnyRow[] = [];

//   for (let p = 1; p <= pagesNeeded; p++) {
//     const data = await fetchZonalValuesByDomain({
//       domain,
//       page: p,
//       itemsPerPage: PAGE_SIZE,
//       search: "",
//     });
//     const batch = Array.isArray(data?.rows) ? data.rows : [];
//     all.push(...batch);
//     if (batch.length < PAGE_SIZE) break;
//   }

//   ZONAL_CACHE.set(domain, { ts: Date.now(), rows: all });
//   return all;
// }

// export async function GET(req: Request) {
//   try {
//     const { searchParams } = new URL(req.url);

//     const domain = String(searchParams.get("domain") ?? "").trim();
//     const city = String(searchParams.get("city") ?? "").trim();
//     const barangay = String(searchParams.get("barangay") ?? "").trim();
//     const classification = String(searchParams.get("classification") ?? "").trim();
//     const limit = Math.max(3, Math.min(30, Number(searchParams.get("limit") ?? "10")));

//     if (!domain) return NextResponse.json({ error: "domain is required" }, { status: 400 });
//     if (!city || !barangay) {
//       return NextResponse.json({ error: "city and barangay are required for comps" }, { status: 400 });
//     }

//     const base = await getDomainRows(domain);

//     let filtered = base.filter(
//       (row) =>
//         matchesLoose(getVal(row, "City-"), city) &&
//         matchesBarangay(getVal(row, "Barangay-"), barangay)
//     );

//     if (classification) {
//       filtered = filtered.filter((row) => matchesLoose(getVal(row, "Classification-"), classification));
//     }

//     const scored = filtered
//       .map((row) => {
//         const zv = parseZonal(getVal(row, "ZonalValuepersqm.-"));
//         return { row, zv };
//       })
//       .filter((x) => x.zv != null) as Array<{ row: AnyRow; zv: number }>;

//     scored.sort((a, b) => a.zv - b.zv);

//     const values = scored.map((x) => x.zv);
//     const min = values.length ? values[0] : null;
//     const max = values.length ? values[values.length - 1] : null;
//     const median = values.length ? values[Math.floor(values.length / 2)] : null;

//     // Spread samples across the distribution
//     const picks: AnyRow[] = [];
//     if (scored.length) {
//       const idxs = Array.from(
//         new Set([
//           0,
//           Math.floor(scored.length * 0.25),
//           Math.floor(scored.length * 0.5),
//           Math.floor(scored.length * 0.75),
//           scored.length - 1,
//         ])
//       ).slice(0, limit);

//       for (const i of idxs) picks.push(scored[i].row);
//     }

//     return NextResponse.json({
//       ok: true,
//       stats: { min, median, max, count: scored.length },
//       rows: picks.slice(0, limit),
//     });
//   } catch (e: any) {
//     return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
//   }
// }
