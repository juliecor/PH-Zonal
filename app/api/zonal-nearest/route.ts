import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";

// "Scan a coordinate → nearest zonal value" — looks up the closest cached zonal
// point (from the geo_zonal table) to the given lat/lon. Free (no Google call).
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const radius = searchParams.get("radius") || "2000";

    if (!lat || !lon) {
      return NextResponse.json({ ok: false, error: "lat and lon required" }, { status: 400 });
    }
    if (!BACKEND_URL) {
      return NextResponse.json({ ok: false, error: "BACKEND_URL not configured" }, { status: 500 });
    }

    const url =
      `${BACKEND_URL.replace(/\/$/, "")}/api/geocode-nearest` +
      `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&radius=${encodeURIComponent(radius)}`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return NextResponse.json({ ok: false, error: "lookup failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "nearest failed" }, { status: 500 });
  }
}
