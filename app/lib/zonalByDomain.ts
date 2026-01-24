import axios from "axios";

function b64(obj: unknown) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

export async function fetchZonalIndex(domain: string) {
  const { data } = await axios.get(
    `https://api.spreadsimple.com/spread-view/public/omit-routes/${domain}`,
    { timeout: 30000 }
  );
  return {
    rowsLimit: data?.customDealLimits?.rowsLimit ?? 5000,
    sid: data?.sid as string,
  };
}

function extractRows(payload: any): any[] {
  if (!payload) return [];

  // sometimes already { rows: [...] }
  if (Array.isArray(payload.rows)) return payload.rows;

  const t = payload.table;
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

export type ZonalFlatRow = {
  rowIndex: number;
  route?: string;
  "Street/Subdivision-": string;
  "Vicinity-": string;
  "Barangay-": string;
  "City-": string;
  "Province-": string;
  "Classification-": string;
  "ZonalValuepersqm.-": string;
  __zonal_raw: number | string;
};

async function fetchS3Json(s3Url: string) {
  const res = await axios.get(s3Url, {
    timeout: 30000,
    responseType: "text", // S3 may return JSON as text
    headers: { Accept: "application/json" },
  });

  if (typeof res.data === "string") {
    return JSON.parse(res.data);
  }
  return res.data;
}

export async function fetchZonalValuesByDomain(args: {
  domain: string;
  page: number;
  itemsPerPage?: number;
  search?: string;
}) {
  const { domain, page, itemsPerPage = 16, search = "" } = args;

  const idx = await fetchZonalIndex(domain);

  const options = {
    rowsLimit: idx.rowsLimit,
    pagination: { enabled: true, itemsPerPage: String(itemsPerPage) },
  };

  const query: any = { paginate: { currentPage: String(page) } };
  if (String(search).trim()) query.searchBy = { value: String(search).trim() };

  const url =
    `https://spread.name/sheet/${idx.sid}` +
    `?query=${b64(query)}` +
    `&options=${b64(options)}`;

  // 1) first request
  const first = await axios.get(url, { timeout: 30000 });
  let raw = first.data;

  // ✅ 2) if table missing but s3Url exists, follow it
  if (!raw?.table && raw?.s3Url) {
    const s3Payload = await fetchS3Json(raw.s3Url);

    // preserve meta from first response if needed
    raw = {
      ...s3Payload,
      totalRows: s3Payload?.totalRows ?? raw?.totalRows ?? null,
      totalQueriedRows: s3Payload?.totalQueriedRows ?? raw?.totalQueriedRows ?? null,
      pageCount: s3Payload?.pageCount ?? raw?.pageCount ?? null,
      hasNext: s3Payload?.hasNext ?? raw?.hasNext ?? false,
    };
  }

  const rows = extractRows(raw);

  const flat: ZonalFlatRow[] = rows.map((r: any) => ({
    rowIndex: r.rowIndex,
    route: r.route,
    "Street/Subdivision-": String(cellFormatted(r, "Street/Subdivision-") ?? ""),
    "Vicinity-": String(cellFormatted(r, "Vicinity-") ?? ""),
    "Barangay-": String(cellFormatted(r, "Barangay-") ?? ""),
    "City-": String(cellFormatted(r, "City-") ?? ""),
    "Province-": String(cellFormatted(r, "Province-") ?? ""),
    "Classification-": String(cellFormatted(r, "Classification-") ?? ""),
    "ZonalValuepersqm.-": String(cellFormatted(r, "ZonalValuepersqm.-") ?? ""),
    __zonal_raw: cellRaw(r, "ZonalValuepersqm.-"),
  }));

  return {
    page,
    rows: flat,
    itemsPerPage,
    meta: {
      totalRows: raw?.totalRows ?? null,
      totalQueriedRows: raw?.totalQueriedRows ?? null,
      pageCount: raw?.pageCount ?? null,
      hasNext: raw?.hasNext ?? false,
    },
  };
}
