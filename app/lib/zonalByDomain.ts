import axios, { AxiosInstance } from "axios";
import http from "http";
import https from "https";

function b64(obj: unknown) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

// Keep-alive agents and shared axios client
const keepAliveHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const keepAliveHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const httpClient: AxiosInstance = axios.create({
  httpAgent: keepAliveHttpAgent,
  httpsAgent: keepAliveHttpsAgent,
  timeout: 12000,
  decompress: true,
  validateStatus: (s) => s >= 200 && s < 400, // allow redirects
});

async function getWithRetry(url: string, opts: { timeout?: number; headers?: Record<string, string> } = {}, attempts = 3) {
  let lastErr: any = null;
  const perTryTimeout = opts.timeout ?? 12000;
  const startTime = Date.now();
  
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await httpClient.get(url, { timeout: perTryTimeout, headers: opts.headers });
      if (i > 0) {
        console.log(`[getWithRetry] SUCCESS on attempt ${i + 1}/${attempts} after ${Date.now() - startTime}ms`);
      }
      return res.data;
    } catch (e: any) {
      lastErr = e;
      const status = e?.response?.status ?? 0;
      const code = e?.code || "NO_CODE";
      console.warn(`[getWithRetry] Attempt ${i + 1}/${attempts} failed - Status: ${status}, Code: ${code}, URL: ${url}`);
      
      const retriable =
        e?.code === "ECONNRESET" ||
        e?.code === "ETIMEDOUT" ||
        e?.name === "AbortError" ||
        status === 0 ||
        status === 429 ||
        (status >= 500 && status < 600);
      
      if (i < attempts - 1 && retriable) {
        const backoff = Math.min(1500 * (i + 1) + Math.random() * 400, 4000);
        console.log(`[getWithRetry] Retrying in ${backoff}ms (retriable: ${retriable})...`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      break;
    }
  }
  
  const status = lastErr?.response?.status ?? 0;
  console.error(`[getWithRetry] FAILED after ${attempts} attempts (${Date.now() - startTime}ms total) - Status: ${status}`);
  throw lastErr;
}

export async function fetchZonalIndex(domain: string) {
  // Simple in-memory cache with stale-on-error behavior to survive brief upstream outages
  const g: any = globalThis as any;
  if (!g.__SPREAD_INDEX_CACHE__) g.__SPREAD_INDEX_CACHE__ = new Map<string, { ts: number; idx: { rowsLimit: number; sid: string } }>();
  const INDEX_CACHE: Map<string, { ts: number; idx: { rowsLimit: number; sid: string } } > = g.__SPREAD_INDEX_CACHE__;
  const TTL_MS = 1000 * 60 * 30; // 30 minutes

  const cached = INDEX_CACHE.get(domain);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return cached.idx;
  }

  try {
    const data = await getWithRetry(
      `https://api.spreadsimple.com/spread-view/public/omit-routes/${domain}`,
      { timeout: 10000 },
      5 // a bit more persistent for index
    );
    const idx = {
      rowsLimit: data?.customDealLimits?.rowsLimit ?? 5000,
      sid: data?.sid as string,
    };
    if (idx?.sid) INDEX_CACHE.set(domain, { ts: Date.now(), idx });
    return idx;
  } catch (e) {
    if (cached) {
      // serve stale if we have it
      return cached.idx;
    }
    throw e;
  }
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
  const data = await getWithRetry(s3Url, {
    timeout: 10000,
    headers: { Accept: "application/json" },
  });
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return null; }
  }
  return data;
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

  // 1) first request with retry
  let raw = await getWithRetry(url, { timeout: 12000 });

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
