import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";

// Returns cached zonal value points inside a map bounding box (viewport loading).
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const minLat = searchParams.get("minLat");
    const maxLat = searchParams.get("maxLat");
    const minLon = searchParams.get("minLon");
    const maxLon = searchParams.get("maxLon");
    const limit = searchParams.get("limit") || "300";

    if (!minLat || !maxLat || !minLon || !maxLon) {
      return NextResponse.json({ ok: false, error: "bounds required" }, { status: 400 });
    }
    if (!BACKEND_URL) {
      return NextResponse.json({ ok: false, error: "BACKEND_URL not configured" }, { status: 500 });
    }

    const url =
      `${BACKEND_URL.replace(/\/$/, "")}/api/geocode-in-bounds` +
      `?minLat=${encodeURIComponent(minLat)}&maxLat=${encodeURIComponent(maxLat)}` +
      `&minLon=${encodeURIComponent(minLon)}&maxLon=${encodeURIComponent(maxLon)}&limit=${encodeURIComponent(limit)}`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return NextResponse.json({ ok: false, error: "lookup failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "in-bounds failed" }, { status: 500 });
  }
}
