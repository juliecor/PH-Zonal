import { NextResponse } from "next/server";
import { fetchZonalValuesByDomain } from "../../lib/zonalByDomain";

export const runtime = "nodejs";

type AnyRow = Record<string, any>;

function getVal(row: AnyRow, key: string) {
  // supports both shapes:
  // 1) Spread rows: row.cells[key].value / formattedValue
  // 2) Flattened rows: row[key]
  return (
    row?.cells?.[key]?.value ??
    row?.cells?.[key]?.formattedValue ??
    row?.[key] ??
    ""
  );
}

/** Normalize PH location text so filters won't "miss" due to formatting differences */
function norm(s: any) {
  return String(s ?? "")
    .toUpperCase()
    .replace(/\(.*?\)/g, "")            // remove (...) notes
    .replace(/\bBRGY\.?\b/g, "")        // remove BRGY / BRGY.
    .replace(/\bBARANGAY\b/g, "")       // remove BARANGAY word
    .replace(/Ñ/g, "N")                 // normalize Ñ
    .replace(/[^\p{L}\p{N}\s-]/gu, "")  // keep letters/numbers/spaces/hyphen
    .replace(/\s+/g, " ")
    .trim();
}

/** Loose match: exact OR contains (either direction) */
function matchesLoose(value: any, want: any) {
  const v = norm(value);
  const w = norm(want);
  if (!w) return true;
  return v === w || v.includes(w) || w.includes(v);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const domain = String(searchParams.get("domain") ?? "").trim();
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const city = String(searchParams.get("city") ?? "").trim();
    const barangay = String(searchParams.get("barangay") ?? "").trim();
    const classification = String(searchParams.get("classification") ?? "").trim();
    const q = String(searchParams.get("q") ?? "").trim();

    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }

    // Fetch a big chunk once
    const data = await fetchZonalValuesByDomain({
      domain,
      page: 1,
      itemsPerPage: 5000,
      search: q, // still ok
    });

    let filtered = Array.isArray(data?.rows) ? data.rows : [];

    // ✅ city filter (loose)
    if (city) {
      filtered = filtered.filter((row) => matchesLoose(getVal(row, "City-"), city));
    }

    // ✅ barangay filter (loose)
    if (barangay) {
      filtered = filtered.filter((row) => matchesLoose(getVal(row, "Barangay-"), barangay));
    }

    // ✅ classification filter (loose contains)
    if (classification) {
      filtered = filtered.filter((row) =>
        matchesLoose(getVal(row, "Classification-"), classification)
      );
    }

    // ✅ optional: if q is empty, still allow client-side text search for better results
    // (only do this when q exists but backend search isn't reliable)
    if (q) {
      const qn = norm(q);
      filtered = filtered.filter((row) => {
        const joined =
          `${getVal(row, "Street/Subdivision-")} ${getVal(row, "Vicinity-")} ${getVal(row, "Barangay-")} ${getVal(row, "City-")} ${getVal(row, "Province-")} ${getVal(row, "Classification-")}`;
        return norm(joined).includes(qn);
      });
    }

    // ✅ paginate
    const itemsPerPage = 16;
    const totalRows = filtered.length;
    const pageCount = Math.ceil(totalRows / itemsPerPage) || 1;
    const validPage = Math.min(page, pageCount);

    const start = (validPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedRows = filtered.slice(start, end);

    return NextResponse.json({
      domain,
      page: validPage,
      rows: paginatedRows,
      itemsPerPage,
      totalRows,
      pageCount,
      hasPrev: validPage > 1,
      hasNext: validPage < pageCount,

      // ✅ helpful debug (remove later if you want)
      debug: {
        city,
        barangay,
        sampleBarangayValues: filtered.slice(0, 10).map((r) => getVal(r, "Barangay-")),
      },
    });
  } catch (e: any) {
    console.error("Zonal API error:", e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
