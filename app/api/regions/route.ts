import { NextResponse } from "next/server";
import axios from "axios";

const REGIONS_SID =
  "9w4dKor11_OcyG8MZJVgwCoFdY43zK4KPd_G2IL4DKP2WwTintW0wptecz4odevpf2yw";

const REGIONS_OPTIONS_B64 =
  "eyJyb3dzTGltaXQiOjUwMDAsImRlYWxUeXBlIjoiYXBwc3VtbyIsImR5bmFtaWNEYXRhIjp7InNoZWV0SGFzaCI6IjIwNDUzOTY1NzAiLCJTQ1BUYWJsZUxhdGVzdFVwZGF0ZVRpbWVzdGFtcCI6MH0sInNlYXJjaCI6eyJlbmFibGVkIjp0cnVlLCJjb2x1bW5zIjpbIkNpdHktIiwiUHJvdmluY2UtIiwiQXJlYXNEYXRhYmFzZS0iXX0sInNvcnRpbmciOnsiZW5hYmxlZCI6ZmFsc2UsInNodWZmbGUiOmZhbHNlfSwicGFnaW5hdGlvbiI6eyJlbmFibGVkIjp0cnVlLCJpdGVtc1BlclBhZ2UiOiIxNiJ9LCJmaWx0ZXJzIjp7ImVuYWJsZWQiOnRydWUsInZhbHVlcyI6W119LCJtYXBWaWV3Ijp7ImVuYWJsZWQiOmZhbHNlLCJpZCI6IlN0cmVldC9TdWJkaXZpc2lvbi0iLCJtYXJrZXJUeXBlIjoicGluIiwiaW1hZ2VDb2xJZCI6IiJ9LCJjYWxlbmRhclZpZXciOnsiZW5hYmxlZCI6ZmFsc2UsInN0YXJ0RGF0ZUNvbElkIjpudWxsLCJ0aXRsZUNvbElkIjoiUHJvdmluY2UtIn19";

function b64(obj: unknown) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

function extractRows(payload: any): any[] {
  const t = payload?.table;
  if (Array.isArray(t)) return t;
  if (Array.isArray(t?.rows)) return t.rows;
  if (Array.isArray(t?.data)) return t.data;
  return [];
}

function cell(row: any, id: string) {
  const c = row?.cells?.[id];
  return c?.formattedValue ?? c?.value ?? "";
}

function toHost(domainName: string) {
  const s = String(domainName ?? "").trim();
  if (!s) return "";
  try {
    // handles "https://launion.zonalvalue.com"
    return new URL(s).hostname;
  } catch {
    // handles "launion.zonalvalue.com"
    return s.replace(/^https?:\/\//, "").split("/")[0];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const query = {
    paginate: { currentPage: String(page) },
    searchBy: { value: q },
  };

  const url =
    `https://spread.name/sheet/${REGIONS_SID}` +
    `?query=${b64(query)}` +
    `&options=${REGIONS_OPTIONS_B64}`;

  const { data: raw } = await axios.get(url, { timeout: 30000 });
  const rows = extractRows(raw);

  const matches = rows
    .map((r: any) => {
      const province = String(cell(r, "Province-") ?? "").trim();
      const city = String(cell(r, "City-") ?? "").trim();

      // ✅ IMPORTANT: use DomainName- not AreasDatabase-
      const domainName = String(cell(r, "DomainName-") ?? "").trim();
      const domain = toHost(domainName);

      return { province, city, domain };
    })
    .filter((m: any) => m.domain);

  return NextResponse.json({
    q,
    page,
    matches,
    meta: {
      totalRows: raw?.totalRows ?? null,
      totalQueriedRows: raw?.totalQueriedRows ?? null,
    },
  });
}
