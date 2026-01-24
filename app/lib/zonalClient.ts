import axios from "axios";

export type SpreadIndex = {
  rowsLimit: number;
  sid: string;
};

export type ZonalRowFlat = {
  rowIndex: number;
  route?: string;
  "Street/Subdivision-"?: string;
  "Vicinity-"?: string;
  "Barangay-"?: string;
  "City-"?: string;
  "Province-"?: string;
  "Classification-"?: string;
  "ZonalValuepersqm.-"?: string; // formattedValue like "30,500.00"
  __zonal_raw?: number | string; // raw numeric value if available
};

function b64(obj: unknown) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

export async function fetchZonalIndex(domain: string): Promise<SpreadIndex> {
  const url = `https://api.spreadsimple.com/spread-view/public/omit-routes/${domain}`;
  const { data } = await axios.get(url, { timeout: 30000 });

  return {
    rowsLimit: data?.customDealLimits?.rowsLimit ?? 5000,
    sid: data?.sid,
  };
}

function extractRows(payload: any): any[] {
  const t = payload?.table;
  if (Array.isArray(t)) return t;
  if (Array.isArray(t?.rows)) return t.rows;
  if (Array.isArray(t?.data)) return t.data;
  return [];
}

function cellFormatted(row: any, id: string) {
  const c = row?.cells?.[id];
  return c?.formattedValue ?? c?.value ?? "";
}

function cellRaw(row: any, id: string) {
  const c = row?.cells?.[id];
  return c?.value ?? c?.formattedValue ?? "";
}

export async function fetchZonalValuesByDomain(args: {
  domain: string;      // e.g. "cebu.zonalvalue.com"
  page: number;        // e.g. 125
  itemsPerPage?: number; // default 16
}) {
  const { domain, page, itemsPerPage = 16 } = args;

  const zonalIndex = await fetchZonalIndex(domain);

  const options = {
    rowsLimit: zonalIndex.rowsLimit,
    pagination: { enabled: true, itemsPerPage: String(itemsPerPage) },
  };

  const query = { paginate: { currentPage: String(page) } };

  const sheetUrl =
    `https://spread.name/sheet/${zonalIndex.sid}` +
    `?query=${b64(query)}` +
    `&options=${b64(options)}`;

  const { data: raw } = await axios.get(sheetUrl, { timeout: 30000 });

  const rows = extractRows(raw);

  // Flatten rows so React can render them easily
  const flat: ZonalRowFlat[] = rows.map((r: any) => ({
    rowIndex: r.rowIndex,
    route: r.route,
    "Street/Subdivision-": cellFormatted(r, "Street/Subdivision-"),
    "Vicinity-": cellFormatted(r, "Vicinity-"),
    "Barangay-": cellFormatted(r, "Barangay-"),
    "City-": cellFormatted(r, "City-"),
    "Province-": cellFormatted(r, "Province-"),
    "Classification-": cellFormatted(r, "Classification-"),
    "ZonalValuepersqm.-": cellFormatted(r, "ZonalValuepersqm.-"),
    __zonal_raw: cellRaw(r, "ZonalValuepersqm.-"),
  }));

  return {
    sheetUrl,           // for debugging
    page,
    rows: flat,
    meta: {
      totalRows: raw?.totalRows ?? null,
      totalQueriedRows: raw?.totalQueriedRows ?? null,
    },
  };
}
