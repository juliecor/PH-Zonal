// Pre-warm the durable facet cache so the FIRST visitor to each province never
// waits for the slow one-time SpreadSimple fetch. Run this once after each deploy.
//
//   node scripts/prewarm-facets.mjs                       # warms https://zonalvalue.ph
//   node scripts/prewarm-facets.mjs https://zonalvalue.ph # explicit site
//   SITE=http://localhost:3000 node scripts/prewarm-facets.mjs   # local test
//   node scripts/prewarm-facets.mjs https://zonalvalue.ph 5      # only first 5 (test)
//
// DB-backed provinces (Cebu, Bohol, etc.) need login to read their city list, so
// pass a valid token to warm those too (get it from your browser: the `authToken`
// cookie / localStorage after logging in):
//   AUTH_TOKEN=xxxxx node scripts/prewarm-facets.mjs https://zonalvalue.ph
// Without a token it still warms every spreadsheet-only province (the slowest ones).
//
// It (1) reads the regions master sheet to list every province domain, then
// (2) hits /api/facets?mode=cities for each so the city dropdowns get cached.
// Barangay lists warm naturally as users pick cities (also cached after first pick).

const SITE = (process.argv[2] || process.env.SITE || "https://zonalvalue.ph").replace(/\/$/, "");
const LIMIT = Number(process.argv[3] || process.env.LIMIT || 0); // 0 = all
const AUTH_TOKEN = process.env.AUTH_TOKEN || ""; // optional, for DB-backed provinces
const CONCURRENCY = 3; // gentle on the upstream
const PER_REQ_TIMEOUT_MS = 120000;

const REGIONS_SID = "9w4dKor11_OcyG8MZJVgwCoFdY43zK4KPd_G2IL4DKP2WwTintW0wptecz4odevpf2yw";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64");

function cell(row, id) {
  const c = row?.cells?.[id];
  return c?.formattedValue ?? c?.value ?? "";
}
function toHost(name) {
  const s = String(name ?? "").trim();
  if (!s) return "";
  try { return new URL(s).hostname; } catch { return s.replace(/^https?:\/\//, "").split("/")[0]; }
}

async function getJson(url, timeoutMs = 30000, withAuth = false) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = { Accept: "application/json" };
    if (withAuth && AUTH_TOKEN) headers.Cookie = `authToken=${AUTH_TOKEN}`;
    const res = await fetch(url, { headers, signal: ctrl.signal });
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function listDomains() {
  const query = { paginate: { currentPage: "1" } };
  const options = { rowsLimit: 5000, pagination: { enabled: true, itemsPerPage: "5000" } };
  const url = `https://spread.name/sheet/${REGIONS_SID}?query=${b64(query)}&options=${b64(options)}`;
  let raw = await getJson(url);
  if (!raw?.table && raw?.s3Url) raw = await getJson(raw.s3Url);
  const t = raw?.table;
  const rows = Array.isArray(t) ? t : Array.isArray(t?.rows) ? t.rows : Array.isArray(t?.data) ? t.data : [];
  const set = new Set();
  for (const r of rows) {
    const host = toHost(cell(r, "DomainName-"));
    if (host && host.includes(".")) set.add(host);
  }
  return [...set].sort();
}

async function warmOne(domain) {
  const url = `${SITE}/api/facets?mode=cities&domain=${encodeURIComponent(domain)}`;
  const start = Date.now();
  try {
    const j = await getJson(url, PER_REQ_TIMEOUT_MS, true);
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    if (!Array.isArray(j?.cities) || j.cities.length === 0) {
      // No usable list — usually a DB-backed province that needs a valid AUTH_TOKEN.
      const why = j?.error ? "needs login (pass AUTH_TOKEN)" : "no cities";
      console.log(`  [skip]  ${domain} — ${why} (${secs}s)`);
      return { domain, ok: false, skipped: true };
    }
    const tag = j?.cached ? "cached" : "WARMED";
    console.log(`  [${tag}] ${domain} — ${j.cities.length} cities (${secs}s)`);
    return { domain, ok: true, warmed: !j.cached };
  } catch (e) {
    console.log(`  [FAIL]  ${domain} — ${e?.name === "AbortError" ? "timeout" : e?.message}`);
    return { domain, ok: false };
  }
}

async function run() {
  console.log(`Pre-warming facet cache on ${SITE}\n`);
  let domains = await listDomains();
  if (LIMIT > 0) domains = domains.slice(0, LIMIT);
  console.log(`Found ${domains.length} province domains.\n`);

  const results = [];
  for (let i = 0; i < domains.length; i += CONCURRENCY) {
    const batch = domains.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map(warmOne))));
  }

  const warmed = results.filter((r) => r.ok && r.warmed).length;
  const already = results.filter((r) => r.ok && !r.warmed).length;
  const skipped = results.filter((r) => r.skipped);
  const failed = results.filter((r) => !r.ok && !r.skipped);
  console.log(`\nDone. warmed=${warmed}, already-cached=${already}, skipped=${skipped.length}, failed=${failed.length}`);
  if (skipped.length && !AUTH_TOKEN) console.log("Tip: set AUTH_TOKEN to also warm the DB-backed provinces above.");
  if (failed.length) console.log("Failed:", failed.map((f) => f.domain).join(", "));
}

run().catch((e) => { console.error("prewarm error:", e); process.exit(1); });
