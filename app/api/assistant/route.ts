import { NextResponse } from "next/server";
import OpenAI from "openai";
import { fuzzyMatchStreets } from "../../lib/zonal-util";
import { provinceToDomain } from "../../lib/provinceDomain";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Cost controls (keep every chat small) ----
const MODEL = "gpt-4o-mini";       // cheapest capable model
const MAX_TOKENS = 350;            // hard cap on answer length
const MAX_ROWS_IN_PROMPT = 10;     // only feed the few matching rows
const MAX_HISTORY = 12;            // remember the last ~6 back-and-forth turns
const MAX_MSG_CHARS = 800;         // per remembered message

type Row = Record<string, any>;

// Words that are not part of a place name — stripped before matching.
const STOP = new Set([
  "what", "whats", "what's", "is", "the", "of", "in", "at", "a", "an", "for",
  "zonal", "value", "values", "price", "prices", "how", "much", "cost", "costs",
  "per", "sqm", "sq", "square", "meter", "metre", "land", "property", "properties",
  "tell", "me", "about", "show", "give", "do", "you", "have", "there", "any",
  "near", "nearby", "around", "this", "that", "place", "area", "to", "and", "or",
  "please", "can", "i", "we", "know", "find", "looking", "look", "search",
  "located", "location", "address", "street", "st", "brgy", "barangay", "city",
  // filler / question / pronoun words (so they never become the street search term,
  // and so a pronoun-only follow-up like "is it flooded?" is detected as having no
  // place of its own → we reuse the place from the previous message).
  "are", "mean", "really", "actually", "mention", "mentioned", "ba", "po", "sa",
  "ng", "na", "yung", "yong", "ung", "ito", "dito", "dyan", "ang", "mga", "kung",
  "it", "its", "it's", "yan", "yun", "yon", "nito", "niyan", "sya", "siya", "doon",
  // hazard words — these are intent, never a place/street name
  "flood", "flooded", "flooding", "floods", "baha", "bumabaha", "nababaha",
  "landslide", "landslides", "guho", "pagguho", "storm", "surge", "bagyo",
  "tsunami", "hazard", "hazards", "risk", "risks", "risky", "safe", "safety",
  "ligtas", "delikado", "peligro", "prone", "disaster", "calamity", "kalamidad",
]);

function tokensOf(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function normLoose(s: any) {
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

// Instant canned answers for common general questions — NO OpenAI call and NO
// zonal search, so these cost absolutely nothing. Returns null if not an FAQ.
function faqAnswer(qRaw: string): string | null {
  const s = String(qRaw || "").toLowerCase().trim();
  if (!s) return null;

  // Don't intercept when the user is asking about a SPECIFIC place's value.
  const refersToPlace = /\bzonal\s*value[s]?\s+(of|in|for|sa|at|near|around)\b/.test(s);

  // "What is a zonal value?" / "what does zonal value mean?" / "explain zonal value"
  if (
    !refersToPlace &&
    (/^(what\s*(is|are|'?s)?\s*(a|an|the)?\s*zonal\s*value[s]?\s*\??)$/.test(s) ||
      /what\s+(does|do)\s+(a\s+|the\s+)?zonal\s+value[s]?\s+mean/.test(s) ||
      /(meaning|definition|define|explain)\b[^]*zonal\s*value/.test(s))
  ) {
    return (
      "A zonal value is the official price per square meter that the BIR assigns to land in a specific area. " +
      "It's mainly used to compute taxes (like capital gains and documentary stamp tax) — so it's a government-assessed value, " +
      "not always the actual market selling price. Want me to look one up? Just tell me the city, barangay, or street."
    );
  }

  // Classification codes glossary
  if (
    /\b(classification|class)\b/.test(s) &&
    /(what|mean|meaning|explain|code|codes|type|types)/.test(s)
  ) {
    return (
      "Classification is the land's use category, which affects its zonal value. Common ones:\n" +
      "• RR — Residential Regular\n" +
      "• RC — Residential Condominium\n" +
      "• CR — Commercial Regular\n" +
      "• CC — Commercial Condominium\n" +
      "• A — Agricultural\n" +
      "• I — Industrial\n" +
      "• GP — Government / Institutional\n" +
      "• X — Tax-exempt\n" +
      "Commercial land is usually the most expensive, agricultural the least. Ask me about a specific place to see its classification and value."
    );
  }

  // Who are you / what can you do / how to use
  if (
    /(who are you|what are you|what can you do|what do you do|how (do|can) i use|how does (this|it) work|what is this app|your name|help me use)/.test(
      s
    )
  ) {
    return (
      "I'm your Zonal AI assistant 👋 I answer questions about BIR zonal values straight from this app's data. " +
      "You can ask me things like “zonal value in Lahug, Cebu City”, “which classification is most expensive in Mabolo”, " +
      "or select a property on the map and ask about it. Try me!"
    );
  }

  return null;
}

// Whole-phrase, word-boundary match so "SAMBAG I" does NOT match inside "SAMBAG II".
function phraseInText(text: string, phrase: string): boolean {
  if (!phrase) return false;
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}([^\\p{L}\\p{N}]|$)`, "u").test(text);
}

// Province / region words — never treat these as a street search term.
const PROVINCE_WORDS = new Set([
  "cebu", "bohol", "iloilo", "davao", "negros", "oriental", "occidental", "siquijor",
  "zamboanga", "sur", "norte", "del", "agusan", "ncr", "benguet", "cagayan", "batanes",
  "abra", "misamis", "camiguin", "kalinga", "apayao", "aklan", "aurora", "laguna",
  "lanao", "leyte", "samar", "nueva", "vizcaya", "ecija", "quirino", "cotabato",
  "tawitawi", "sibugay", "pampanga", "batangas", "bulacan", "cavite", "rizal",
  "pangasinan", "tarlac", "bataan", "zambales", "quezon", "albay", "sorsogon",
  "antique", "capiz", "guimaras", "leyte", "biliran", "marinduque", "romblon",
  "palawan", "mindoro", "province", "philippines", "ph",
]);

function isProvinceWord(t: string) {
  return PROVINCE_WORDS.has(String(t || "").toLowerCase());
}

// Generic place qualifiers that don't identify a province on their own.
const GENERIC_PLACE = new Set([
  "NORTH", "SOUTH", "EAST", "WEST", "CENTRAL", "CITY", "MUNICIPALITY", "DEL", "DE",
  "PROVINCE", "OF", "ST", "DISTRICT",
]);

// Split a stored place name into distinctive tokens. The master data uses
// slash/pipe/comma to join ALTERNATE names ("South Cotabato/Sarangani",
// "General Santos City/Gen. Santos City", "Binondo, Manila"), so we must treat
// those as SEPARATORS — otherwise "Cotabato/Sarangani" glues into one token.
function placeTokensOf(name: string): string[] {
  return normLoose(String(name || "").replace(/[\/\\|,]/g, " "))
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !GENERIC_PLACE.has(t));
}

// Loose province match: "pampanga" should match a stored "NORTH PAMPANGA" /
// "SOUTH PAMPANGA"; "sarangani" should match "South Cotabato/Sarangani", etc.
function provinceMentioned(qNorm: string, province: string): boolean {
  return placeTokensOf(province).some((t) => phraseInText(qNorm, t));
}

// Distinctive tokens of a stored city name (handles "Barangay, City" and
// slash-joined alternates like "General Santos City/Gen. Santos City").
// IMPORTANT: drop the province word, because many cities are stored as
// "MUNICIPALITY, CEBU" — otherwise "CEBU" would match every Cebu city. We keep
// the province word only if it's the city's whole name (e.g. "Cebu City").
function cityTokensOf(cityName: string): string[] {
  const all = placeTokensOf(cityName);
  const distinctive = all.filter((t) => !isProvinceWord(t));
  return distinctive.length ? distinctive : all;
}

// True if the question mentions any distinctive token of this city name.
function cityMentioned(qNorm: string, cityName: string): boolean {
  const toks = cityTokensOf(cityName);
  return toks.length > 0 && toks.some((t) => phraseInText(qNorm, t));
}

// Guard against wild fuzzy matches (e.g. "aborlan" -> "tabuelan"). A real typo
// keeps the first letter and a similar length.
function plausibleTypo(token: string, candidate: string): boolean {
  const a = String(token || "").toUpperCase();
  const b = String(candidate || "").toUpperCase();
  if (!a || !b) return false;
  if (a[0] !== b[0]) return false;
  if (Math.abs(a.length - b.length) > 2) return false;
  return true;
}

// Fuzzy match limited to plausible typos only.
function fuzzyTypos(token: string, candidates: string[]): string[] {
  return fuzzyMatchStreets(token, candidates, 2).filter((c) => plausibleTypo(token, c));
}

// Levenshtein edit distance (small strings).
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// Stricter fuzzy for CITY names: a real city typo is ≤1 edit away. This stops a
// BARANGAY name (e.g. "Sambag") from wrongly snapping to a similar TOWN ("Samboan").
function cityTypos(token: string, candidates: string[]): string[] {
  return fuzzyTypos(token, candidates).filter((c) => editDistance(token.toUpperCase(), c.toUpperCase()) <= 1);
}

// Parse a money value like "15,000.00" → 15000.
function parseMoney(v: any): number | null {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}
function fmtPeso(n: number): string {
  return "₱" + Number(n).toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

// Detect a land area in the question (square meters or hectares) for the
// land-value calculator. Returns the area in square meters, or null.
function parseAreaSqm(q: string): number | null {
  const s = String(q || "").toLowerCase();
  let m = s.match(/(\d+(?:\.\d+)?)\s*(?:hectares?|has\b|ha\b)/);
  if (m) return parseFloat(m[1]) * 10000;
  m = s.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*m\.?|sqm|square\s*met(?:er|re)s?|sq\s*met(?:er|re)s?|m2|m²)/);
  if (m) return parseFloat(m[1].replace(/,/g, ""));
  return null;
}

// City matching core: drop "CITY"/"MUNICIPALITY" so "cebu" matches "CEBU CITY".
function cityCore(c: string) {
  return normLoose(c)
    .replace(/\b(CITY|MUNICIPALITY|MUN|TOWN|OF)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Does the message look like it's actually asking about a place / its value?
// Used to avoid spending a zonal search token on greetings & small talk.
function looksLikeLocationQuery(q: string): boolean {
  return /\b(zonal|value|values|price|prices|presyo|magkano|halaga|worth|cost|sqm|per\s*sq|apprais|classification|street|st|ave|avenue|road|rd|subdivision|subd|barangay|brgy|sitio|purok|lot|land|city|town|municipal|how\s*much)\b/i.test(
    String(q || "")
  );
}

// Greeting / small-talk / question words that mean the message ISN'T just a place.
const CHITCHAT_WORDS = new Set([
  "hi", "hello", "hey", "yo", "hoy", "kumusta", "kamusta", "musta", "salamat",
  "thanks", "thank", "thankyou", "thx", "please", "pls", "sige", "ok", "okay",
  "okey", "yes", "yep", "yeah", "no", "nope", "oo", "opo", "hindi", "wala",
  "test", "testing", "good", "morning", "afternoon", "evening", "night",
  "maganda", "ganda", "galing", "nice", "wow", "haha", "hehe", "lol", "bye",
  "who", "what", "when", "why", "how", "where", "which", "can", "you", "are",
  "sino", "sina", "ano", "bakit", "paano", "kailan", "saan", "pwede", "puede",
]);

// A bare place name typed with NO "zonal/value/price" keyword, e.g.
// "tondo manila", "cabuyao laguna", "poblacion talisay". Many users (non-techy)
// just type the place. Treat these as location lookups too. Kept conservative:
// short, all-alphabetic tokens, no greeting/question words — and resolveDomain
// (which is FREE) still has to confirm it's a real place before any paid search.
function looksLikeBarePlace(qRaw: string): boolean {
  if (looksLikeLocationQuery(qRaw)) return true;
  const toks = tokensOf(qRaw).filter((t) => t.length >= 2 && !STOP.has(t));
  if (toks.length < 1 || toks.length > 6) return false; // bare place names are short
  // every token must be an alphabetic word (place-like), none chit-talk/questions
  for (const t of toks) {
    if (!/^[a-zñ]+(-[a-zñ]+)*$/i.test(t)) return false; // letters (incl. hyphenated names)
    if (CHITCHAT_WORDS.has(t)) return false;
  }
  return true;
}

// Does the user actually want hazard info (flood / landslide / storm surge)?
// Gates the (paid) geocode so plain value questions stay free.
function hazardIntent(q: string): boolean {
  return /\b(flood|flooded|flooding|baha|bumabaha|nababaha|landslide|land\s*slide|guho|pagguho|storm\s*surge|surge|bagyo|tsunami|hazard|hazards|risk|risks|risky|safe|safety|ligtas|delikado|peligro|disaster|calamity|kalamidad|prone)\b/i.test(
    String(q || "")
  );
}

// Geocode a place to one lat/lon via our cached /api/geocode (memory + DB cache,
// so repeats are free). Used only when the user asks about hazards.
async function geocodePoint(
  baseUrl: string,
  query: string
): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const res = await fetch(`${baseUrl}/api/geocode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const j = await res.json().catch(() => null);
    if (j?.ok && Number.isFinite(Number(j.lat)) && Number.isFinite(Number(j.lon))) {
      return { lat: Number(j.lat), lon: Number(j.lon), label: String(j.displayName ?? query) };
    }
  } catch {}
  return null;
}

type HazLevel = { label: string; level: number } | null;
// Flood (100-yr) + landslide + storm surge (worst-case SSA4) at a point. All FREE
// (local raster reads). Returns {label,level}, or null when outside coverage.
async function hazardAt(baseUrl: string, lat: number, lon: number) {
  const [f, l, s] = await Promise.all([
    getJson(`${baseUrl}/api/flood-at?lat=${lat}&lon=${lon}`, "").catch(() => null),
    getJson(`${baseUrl}/api/landslide-at?lat=${lat}&lon=${lon}`, "").catch(() => null),
    getJson(`${baseUrl}/api/stormsurge-at?lat=${lat}&lon=${lon}`, "").catch(() => null),
  ]);
  const pick = (d: any): HazLevel =>
    d?.inCoverage ? { label: String(d.label || ""), level: Number(d.level) || 0 } : null;
  return { flood: pick(f), landslide: pick(l), stormSurge: pick(s) };
}

// Map a hazard label (e.g. from selected-property context) back to a 0–3 level.
function labelLevel(label?: string): number {
  const s = String(label || "").toLowerCase();
  if (/high/.test(s)) return 3;
  if (/moderate|medium/.test(s)) return 2;
  if (/low/.test(s)) return 1;
  return 0; // "no flood" / "none"
}

// Does the message name a place of its own (any non-stopword token)?
function hasOwnPlace(q: string): boolean {
  return tokensOf(q).some((t) => t.length >= 2 && !STOP.has(t));
}

// Most recent earlier USER message that named a place — for follow-up recall
// ("is it flooded?" → reuse the place from the previous turn).
function lastPlaceFromHistory(history: any[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m?.role === "user" && m.content && hasOwnPlace(String(m.content))) return String(m.content);
  }
  return "";
}

function getVal(row: Row, key: string) {
  return row?.cells?.[key]?.value ?? row?.cells?.[key]?.formattedValue ?? row?.[key] ?? "";
}

// Turn a data row into one compact line the model can read back verbatim.
function rowToLine(row: Row): string {
  const street = String(getVal(row, "Street/Subdivision-") ?? "").trim();
  const vicinity = String(getVal(row, "Vicinity-") ?? "").trim();
  const brgy = String(getVal(row, "Barangay-") ?? "").trim();
  const city = String(getVal(row, "City-") ?? "").trim();
  const prov = String(getVal(row, "Province-") ?? "").trim();
  const cls = String(getVal(row, "Classification-") ?? "").trim();
  const val = String(getVal(row, "ZonalValuepersqm.-") ?? "").trim();
  const loc = [street || vicinity, brgy, city, prov].filter(Boolean).join(", ");
  return `- ${loc}${cls ? ` [${cls}]` : ""}: ₱${val || "no value on record"}/sqm`;
}

async function getJson(url: string, cookie: string): Promise<any> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", cookie } });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

async function zonalQuery(
  baseUrl: string,
  cookie: string,
  domain: string,
  params: { city?: string; barangay?: string; q?: string; sort?: string }
): Promise<{ rows: Row[]; total: number }> {
  const sp = new URLSearchParams({ domain, page: "1" });
  if (params.city) sp.set("city", params.city);
  if (params.barangay) sp.set("barangay", params.barangay);
  if (params.q) sp.set("q", params.q);
  if (params.sort) sp.set("sort", params.sort);
  const data = await getJson(`${baseUrl}/api/zonal?${sp.toString()}`, cookie);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  // totalRows is the TRUE count of all matching records (across all pages),
  // even though we only fetch page 1 of sample rows.
  const total = Number(data?.totalRows ?? rows.length) || rows.length;
  return { rows, total };
}

// Figure out WHICH province/domain a place belongs to, so the assistant can answer
// about anywhere — not just the province the site currently has loaded. Uses the
// same master city→domain resolver the app's search box uses (/api/regions).
type ResolveResult = { domain: string | null; strong: boolean; suggestions: string[] };

// Cache domain resolution so repeated/similar questions skip the network hops
// (city-search + regions). Keyed by the place tokens + current domain.
const RESOLVE_CACHE: Map<string, { ts: number; result: ResolveResult }> =
  (globalThis as any).__ASSISTANT_RESOLVE_CACHE__ ?? new Map();
(globalThis as any).__ASSISTANT_RESOLVE_CACHE__ = RESOLVE_CACHE;
const RESOLVE_TTL_MS = 1000 * 60 * 30; // 30 minutes

// Authoritative (province, city) index straight from OUR DB (all 82 provinces) — the
// same source the map's resolver uses. Cached so the assistant resolves places fast and
// accurately, instead of hitting the slow external SpreadSimple sheet.
const CPI_CACHE: { ts: number; pairs: any[] | null } =
  (globalThis as any).__ASSISTANT_CPI__ ?? { ts: 0, pairs: null };
(globalThis as any).__ASSISTANT_CPI__ = CPI_CACHE;
async function getCityProvinceIndex(): Promise<any[] | null> {
  if (CPI_CACHE.pairs && Date.now() - CPI_CACHE.ts < 1000 * 60 * 60) return CPI_CACHE.pairs;
  const root = (BACKEND_URL || "").replace(/\/$/, "");
  if (!root) return null;
  const d = await getJson(`${root}/api/facets/city-province-index`, "");
  const pairs = Array.isArray(d?.pairs) ? d.pairs : null;
  if (pairs) { CPI_CACHE.pairs = pairs; CPI_CACHE.ts = Date.now(); }
  return pairs;
}

async function resolveDomain(
  baseUrl: string,
  question: string,
  currentDomain: string
): Promise<ResolveResult> {
  const qNorm = normLoose(question);
  // Keep province words too — the master sheet maps province→domain most reliably
  // when you search by the province name (e.g. "palawan" -> palawan.zonalvalue.com).
  const tokens = tokensOf(question)
    .filter((t) => t.length >= 3 && !STOP.has(t))
    .sort((a, b) => b.length - a.length)
    .slice(0, 3); // cap lookups
  if (!tokens.length) return { domain: null, strong: false, suggestions: [] };

  // Cache hit? (key = sorted place tokens + current domain)
  const cacheKey = `${currentDomain}|${[...tokens].sort().join(" ")}`;
  const cached = RESOLVE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < RESOLVE_TTL_MS) return cached.result;

  const strong: string[] = []; // city AND province both appear → most confident
  const weak: string[] = []; // only the city name appears
  const provinceOnly: string[] = []; // only the province appears (still resolves the domain)
  const fuzzy = new Map<string, string>(); // "City, Province" -> domain (typo suggestions)

  // PRIMARY: our own authoritative (province, city) index — covers ALL 82 provinces,
  // cached, no external network. Resolve the place straight from our DB (fast + accurate).
  const idx = await getCityProvinceIndex();
  if (idx) {
    // NCR is stored as "NCR" but users say "Metro Manila"/"Kalakhang Maynila" (and the
    // matcher ignores 3-letter names), so treat those as a Metro-Manila province mention.
    const NCR_DOMAIN = provinceToDomain("NCR");
    const qMentionsNCR = /\b(metro\s*manila|kalakhang\s*maynila|national\s*capital|ncr)\b/i.test(question);
    for (const pair of idx) {
      const prov = Array.isArray(pair) ? pair[0] : pair?.province;
      const city = Array.isArray(pair) ? pair[1] : pair?.city;
      const dom = provinceToDomain(prov);
      if (!dom) continue;
      const cityHit = city && cityMentioned(qNorm, city);
      const provHit = (prov && provinceMentioned(qNorm, prov)) || (qMentionsNCR && dom === NCR_DOMAIN);
      if (cityHit && provHit) strong.push(dom);
      else if (cityHit) weak.push(dom);
      else if (provHit) provinceOnly.push(dom);
    }
  }

  // FALLBACK (only if the DB index found nothing): the search box's city-search +
  // master sheet, which also surface typo "did you mean" suggestions.
  if (!strong.length && !weak.length && !provinceOnly.length) {
    for (const source of ["city-search", "regions"] as const) {
      for (const t of tokens) {
        const data = await getJson(`${baseUrl}/api/${source}?q=${encodeURIComponent(t)}`, "");
        const matches: any[] = Array.isArray(data?.matches) ? data.matches : [];
        for (const m of matches) {
          if (!m?.domain) continue;
          const cityHit = m.city && cityMentioned(qNorm, m.city);
          const provHit = m.province && provinceMentioned(qNorm, m.province);
          if (cityHit && provHit) strong.push(m.domain);
          else if (cityHit) weak.push(m.domain);
          else if (provHit) provinceOnly.push(m.domain); // province named → domain is known
          else if (m.city) {
            // fuzzy (typo): query token close to one of the city's tokens (≤1 edit)
            const close = cityTokensOf(m.city).some((ct) => cityTypos(t, [ct]).length);
            if (close) {
              const label = `${m.city}${m.province ? `, ${m.province}` : ""}`;
              if (!fuzzy.has(label)) fuzzy.set(label, m.domain);
            }
          }
        }
        if (strong.length) break;
      }
      if (strong.length || weak.length || provinceOnly.length) break; // got a usable hit
    }
  }

  // Pick: city+province wins, then city-only, then province-only. For a bare city
  // name, prefer staying on the current province if that city exists there.
  let pick: string | null = null;
  let isStrong = false;
  if (strong.length) {
    pick = strong[0];
    isStrong = true;
  } else if (weak.length) {
    pick = weak.includes(currentDomain) ? currentDomain : weak[0];
  } else if (provinceOnly.length) {
    pick = provinceOnly.includes(currentDomain) ? currentDomain : provinceOnly[0];
    isStrong = true; // the province was explicitly named
  }

  let result: ResolveResult;
  if (pick && pick !== currentDomain) result = { domain: pick, strong: isStrong, suggestions: [] };
  else if (pick === currentDomain) result = { domain: null, strong: false, suggestions: [] };
  // No confident hit — offer the closest real "City, Province" matches as suggestions.
  else result = { domain: null, strong: false, suggestions: Array.from(fuzzy.keys()).slice(0, 4) };

  RESOLVE_CACHE.set(cacheKey, { ts: Date.now(), result });
  return result;
}

// Resolve the place in the question into city / barangay / street, then look up
// the matching zonal rows from OUR data. Uses the free facet endpoints to learn
// the real city & barangay names, then ONE structured zonal query (= 1 token).
async function lookupZonal(baseUrl: string, cookie: string, domain: string, question: string) {
  const qNorm = normLoose(question);
  const rawTokens = tokensOf(question);
  const placeTokens = rawTokens.filter((t) => t.length >= 2 && !STOP.has(t));

  // 1) Resolve CITY from the domain's real city list (loose contains match).
  let city = "";
  const citiesData = await getJson(
    `${baseUrl}/api/facets?mode=cities&domain=${encodeURIComponent(domain)}`,
    cookie
  );
  const cities: string[] = Array.isArray(citiesData?.cities) ? citiesData.cities : [];
  let cityAmbiguous: string[] = []; // close city names when the user mistyped
  if (cities.length) {
    // Token-based match (handles "Binondo, Manila" when user types "manila").
    const matched = cities.filter((c) => cityMentioned(qNorm, c));
    if (matched.length) {
      // Prefer the city sharing the MOST tokens with the question
      // (so "binondo manila" picks "Binondo, Manila", not every "*, Manila").
      const scored = matched.map((c) => ({
        c,
        hits: cityTokensOf(c).filter((t) => phraseInText(qNorm, t)).length,
      }));
      const maxHits = Math.max(...scored.map((s) => s.hits));
      const top = scored.filter((s) => s.hits === maxHits).map((s) => s.c);
      if (top.length === 1) {
        city = top[0];
      } else {
        // Tie: many entries share one city token (e.g. all "*, Manila"). Use that
        // shared token as a loose city filter so we return the whole city.
        const distinct = placeTokens
          .filter((t) => t.length >= 4 && !isProvinceWord(t))
          .map((t) => t.toUpperCase());
        let bestTok = "";
        let bestCount = 0;
        for (const up of distinct) {
          const cnt = top.filter((c) => phraseInText(normLoose(c), up)).length;
          if (cnt > bestCount) {
            bestCount = cnt;
            bestTok = up;
          }
        }
        city = bestTok || top[0];
      }
    }
    // fuzzy fallback for a mistyped city (e.g. "mandawe" -> "MANDAUE CITY")
    if (!city) {
      const cores = cities
        .map((c) => ({ full: c, toks: cityTokensOf(c) }))
        .filter((x) => x.toks.length);
      const hits = new Set<string>();
      for (const t of placeTokens) {
        if (t.length < 4 || isProvinceWord(t)) continue;
        for (const x of cores) {
          if (x.toks.some((ct) => cityTypos(t, [ct]).length)) hits.add(x.full);
        }
      }
      const list = Array.from(hits);
      if (list.length === 1) city = list[0];
      else if (list.length > 1) cityAmbiguous = list.slice(0, 8);
    }
  }

  // 2) Resolve BARANGAY within that city. Use WHOLE-WORD matching and prefer the
  //    most specific name so "Sambag II" never collapses into "Sambag I".
  let barangay = "";
  let barangays: string[] = [];
  let ambiguous: string[] = []; // close names we shouldn't silently pick between
  if (city) {
    const brgyData = await getJson(
      `${baseUrl}/api/facets?mode=barangays&domain=${encodeURIComponent(domain)}&city=${encodeURIComponent(city)}`,
      cookie
    );
    barangays = Array.isArray(brgyData?.barangays) ? brgyData.barangays : [];
    if (barangays.length) {
      // exact whole-phrase match; the LONGEST (most specific) match wins
      let bestLen = 0;
      for (const b of barangays) {
        const core = normLoose(b);
        if (core.length >= 3 && phraseInText(qNorm, core) && core.length > bestLen) {
          barangay = b;
          bestLen = core.length;
        }
      }
      // fuzzy fallback for typos (e.g. "clamaba" -> "CALAMBA")
      if (!barangay) {
        const hits = new Set<string>();
        for (const t of placeTokens) {
          if (t.length < 4) continue;
          for (const m of fuzzyTypos(t, barangays)) hits.add(m);
        }
        const list = Array.from(hits);
        if (list.length === 1) {
          barangay = list[0];
        } else if (list.length > 1) {
          // e.g. typed "sambag" -> matches Sambag I, II, III: ask instead of guessing
          ambiguous = list.slice(0, 8);
        }
      }
    }
  }

  // 3) Street query = the most distinctive leftover token (drop city/barangay AND
  //    province words, so "pampanga" is never mistaken for a street search term).
  const used = new Set<string>([
    ...tokensOf(cityCore(city)),
    ...tokensOf(normLoose(barangay)),
  ]);
  const streetTokens = placeTokens.filter((t) => !used.has(t) && !isProvinceWord(t));
  const streetQ = streetTokens.sort((a, b) => b.length - a.length)[0] || "";

  // 4) Structured queries, most reliable first. When a barangay is resolved we query
  //    city+barangay FIRST (returns the whole barangay) before trying a street term.
  const attempts: { city?: string; barangay?: string; q?: string }[] = [];
  if (city && barangay) attempts.push({ city, barangay });
  if (city && barangay && streetQ) attempts.push({ city, barangay, q: streetQ });
  if (city && streetQ) attempts.push({ city, q: streetQ });
  if (city) attempts.push({ city });
  // Bare place (no city): try the FULL phrase first ("sambag ii" → exactly SAMBAG II, not
  // every "Sambag"), then the single distinctive token.
  if (!city) {
    const barePhrase = placeTokens.filter((t) => t.length >= 2 && !isProvinceWord(t)).join(" ").trim();
    if (barePhrase && barePhrase !== streetQ) attempts.push({ q: barePhrase });
  }
  if (streetQ) attempts.push({ q: streetQ });

  // De-dup attempts and cap to 2 to keep token cost low (DB charges per search).
  const seen = new Set<string>();
  let planned = attempts
    .filter((a) => {
      const k = JSON.stringify(a);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 2);

  // Don't spend a paid zonal search on non-location chit-chat: query when we resolved a
  // real city, OR the message has location/value intent, OR it's a bare place name typed
  // on its own ("lahug", "sambag ii") — so loosely-phrased questions still get answered.
  const hasIntent = looksLikeLocationQuery(question) || looksLikeBarePlace(question);
  if (!city && !hasIntent) planned = [];
  // If the barangay or city is ambiguous, don't guess (and don't waste a token) — ask.
  if (ambiguous.length || cityAmbiguous.length) planned = [];

  // Superlative intent → sort the rows by value so "most expensive / cheapest" is EXACT
  // (the alphabetical sample would otherwise miss the priciest street).
  const wantHigh = /\b(most\s*expensive|highest|priciest|dearest|pinaka\s*mahal|pinakamahal|mahal)\b/i.test(question);
  const wantLow = /\b(cheapest|lowest|pinaka\s*mura|pinakamura|mura)\b/i.test(question);
  const sort = wantHigh ? "value_desc" : wantLow ? "value_asc" : "";

  let rows: Row[] = [];
  let total = 0;
  for (const a of planned) {
    const r = await zonalQuery(baseUrl, cookie, domain, { ...a, sort });
    rows = r.rows;
    total = r.total;
    if (rows.length) break;
  }

  // 5) On a miss, build "did you mean…?" suggestions from the closest real names.
  //    (Free — these come from the cached facet lists, no extra zonal token.)
  //    Only when the user actually sought a place (not greetings / small talk).
  const MAX_SUGG = 8;
  let suggestions: string[] = [];
  if (cityAmbiguous.length) {
    // Mistyped/ambiguous city — offer the close city names to choose from.
    suggestions = cityAmbiguous.slice(0, MAX_SUGG);
  } else if (ambiguous.length) {
    // Surface the close barangay names so the model can ask "Did you mean …?"
    suggestions = ambiguous.map((b) => (city ? `${b}, ${city}` : b)).slice(0, MAX_SUGG);
  } else if (!rows.length && (city || hasIntent)) {
    const pool = city && barangays.length ? barangays : cities;
    const seenSugg = new Set<string>();
    for (const t of placeTokens) {
      if (t.length < 3) continue;
      const m = fuzzyMatchStreets(t, pool, 3).slice(0, 5);
      for (const name of m) {
        const label = city && barangays.length ? `${name}, ${city}` : name;
        if (!seenSugg.has(label)) { seenSugg.add(label); suggestions.push(label); }
      }
      if (suggestions.length >= MAX_SUGG) break;
    }
    suggestions = suggestions.slice(0, MAX_SUGG);
  }

  // 6) When a barangay is resolved, also pull its value stats (min/max/median +
  //    which street is highest/lowest). This is what makes "most expensive in X"
  //    accurate — the plain row list only shows an alphabetical sample, not the
  //    priciest street. Stats read the cached spreadsheet, so NO extra user token.
  let stats: any = null;
  if (city && barangay) {
    const sd = await getJson(
      `${baseUrl}/api/zonal-stats?domain=${encodeURIComponent(domain)}&city=${encodeURIComponent(city)}&barangay=${encodeURIComponent(barangay)}`,
      cookie
    );
    if (sd?.ok && sd.stats) stats = sd.stats;
  }

  return {
    rows,
    total,
    city,
    barangay,
    streetQ,
    suggestions,
    stats,
    sorted: sort ? (wantHigh ? "high" : "low") : "", // rows are value-sorted for superlatives
    cityResolved: Boolean(city),
    barangayList: barangays, // full list for "what/how many barangays" questions
  };
}

// Stream the reply to the client: first line = JSON metadata (suggestions, hazards,
// followups…), then the answer text streamed token-by-token (so it feels instant).
function streamResponse(meta: any, opts: { text?: string; stream?: any }) {
  const encoder = new TextEncoder();
  const rs = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(JSON.stringify(meta) + "\n"));
      try {
        if (opts.text != null) {
          controller.enqueue(encoder.encode(opts.text));
        } else if (opts.stream) {
          for await (const part of opts.stream) {
            const delta = part?.choices?.[0]?.delta?.content || "";
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        }
      } catch { /* client disconnected or stream error — just end */ }
      controller.close();
    },
  });
  return new Response(rs, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing OPENAI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const question = String(body.question ?? "").trim();
    const domain = String(body.domain ?? "").trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const context = body.context ?? null; // currently selected property (optional)

    if (!question) {
      return NextResponse.json({ ok: false, error: "Missing question" }, { status: 400 });
    }

    // 0) Free instant answers for common general questions (no OpenAI, no search).
    const faq = faqAnswer(question);
    if (faq) {
      return streamResponse({ ok: true, matched: 0, suggestions: [], followups: [], hazard: null, hazards: [], source: "faq" }, { text: faq });
    }

    // Build absolute base URL + forward the user's auth cookie to internal APIs
    // (Cebu and other DB-backed provinces require the Bearer token from authToken).
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = `${proto}://${host}`;
    const cookie = req.headers.get("cookie") || "";

    // 1) Decide the target province/domain FROM THE QUESTION FIRST (province-
    //    independent, like the search box). This is critical: if we looked up the
    //    current province first, a loose fuzzy match could wrongly "find" a place
    //    there (e.g. "aborlan" → Cebu's "Tabuelan") and never reach the real one.
    // FOLLOW-UP RECALL: if this message has intent but names no place of its own
    // ("is it flooded?", "how about storm surge?", "magkano dito?"), reuse the place
    // from the most recent earlier message that did name one. Place resolution then
    // runs on `placeQuestion`; intent (hazard/area) still keys off the live question.
    let placeQuestion = question;
    const wantsIntent =
      hazardIntent(question) || looksLikeLocationQuery(question) || looksLikeBarePlace(question);
    const isFollowUp =
      !hasOwnPlace(question) &&
      (wantsIntent || /\b(it|this|that|here|there|dito|dyan|doon|yan|yun)\b/i.test(question));
    if (isFollowUp) {
      const prev = lastPlaceFromHistory(history);
      if (prev) placeQuestion = `${prev} ${question}`;
    }

    let targetDomain = domain;
    let resolvedSuggestions: string[] = [];
    // Resolve the province/domain when the message has location intent OR is just a
    // bare place name ("cabuyao laguna", "tondo manila"). resolveDomain is free, so
    // this only adds free lookups; the paid zonal search still gates on a resolved city.
    if (domain && (looksLikeLocationQuery(placeQuestion) || looksLikeBarePlace(placeQuestion) || hazardIntent(question))) {
      const resolved = await resolveDomain(baseUrl, placeQuestion, domain);
      if (resolved.domain) targetDomain = resolved.domain; // place belongs to another province
      else resolvedSuggestions = resolved.suggestions; // possible typo → "did you mean"
    }

    // 2) Look up on the resolved domain.
    let look: any = domain
      ? await lookupZonal(baseUrl, cookie, targetDomain, placeQuestion)
      : { rows: [] as Row[], total: 0, suggestions: [] as string[], stats: null, cityResolved: false };

    if (!look.rows.length && !look.suggestions.length && resolvedSuggestions.length) {
      look = { ...look, suggestions: resolvedSuggestions };
    }

    const { rows, total, suggestions, stats, sorted, city: resolvedCity, barangay: resolvedBarangay, streetQ: resolvedStreet, barangayList } = look;
    const dataLines = rows.slice(0, MAX_ROWS_IN_PROMPT).map(rowToLine);

    // Full barangay list for the resolved city, so the AI can answer "what/how many
    // barangays are in X" accurately (these are free facet names, no search token).
    const brgyNames: string[] = Array.isArray(barangayList) ? barangayList : [];
    const barangayListBlock =
      resolvedCity && brgyNames.length
        ? `\n\nBARANGAYS IN ${String(resolvedCity).toUpperCase()} (${brgyNames.length} total` +
          (brgyNames.length > 60 ? `, first 60 shown` : ``) +
          `): ${brgyNames.slice(0, 60).join(", ")}`
        : "";

    // 2) Include the currently selected property, if the user asks about "this".
    let selectedBlock = "";
    if (context && (context.city || context.barangay)) {
      const loc = [context.street, context.barangay, context.city, context.province]
        .filter(Boolean)
        .join(", ");
      const hz = [
        context.flood ? `flood: ${context.flood}` : "",
        context.landslide ? `landslide: ${context.landslide}` : "",
        context.stormSurge ? `storm surge (worst-case): ${context.stormSurge}` : "",
      ].filter(Boolean).join(" · ");
      selectedBlock =
        `CURRENTLY SELECTED PROPERTY (use this when the user says "this", "here", "selected"):\n` +
        `- ${loc}${context.classification ? ` [${context.classification}]` : ""}: ₱${context.zonalValue || "no value on record"}/sqm` +
        (hz ? `\n- Hazards here (NOAH): ${hz}` : "") +
        `\n\n`;
    }

    // The TRUE total count of matching records (all pages). We only LIST a sample
    // below to keep cost low, but the count lets the model answer "how many".
    const shownNote =
      total > dataLines.length
        ? ` (showing ${dataLines.length} sample records below; full list is in the app)`
        : "";

    const suggestionBlock =
      dataLines.length === 0 && suggestions && suggestions.length
        ? `\n\nCLOSEST MATCHING PLACES IN OUR DATA (the user may have misspelled — offer these as "Did you mean …?"):\n` +
          suggestions.map((s: string) => `- ${s}`).join("\n")
        : "";

    // Stats block — covers ALL records for the barangay (not just the sample), so
    // "most expensive / cheapest / average / range" questions are answered correctly.
    const peso = (n: number) =>
      "₱" + Number(n).toLocaleString("en-PH", { maximumFractionDigits: 2 });
    const statsBlock = stats
      ? `\n\nVALUE STATS FOR THIS BARANGAY (computed over ALL ${stats.count} records — use these for "most expensive", "cheapest", "average", or "range" questions):\n` +
        `- Highest: ${peso(stats.max)}/sqm${stats.maxStreet ? ` at ${stats.maxStreet}` : ""}${stats.maxClass ? ` (${stats.maxClass})` : ""}\n` +
        `- Lowest: ${peso(stats.min)}/sqm${stats.minStreet ? ` at ${stats.minStreet}` : ""}${stats.minClass ? ` (${stats.minClass})` : ""}\n` +
        `- Median: ${peso(stats.median)}/sqm · Average: ${peso(stats.mean)}/sqm`
      : "";

    // Land-value calculator: if the user mentioned an area, compute the estimate
    // server-side (accurate) so the AI just reports it.
    const area = parseAreaSqm(question);
    let landBlock = "";
    if (area && area > 0) {
      const areaStr = area.toLocaleString("en-PH");
      const ctxVal = parseMoney(context?.zonalValue);
      if (ctxVal) {
        landBlock = `\n\nLAND VALUE ESTIMATE (selected property): ${areaStr} sqm × ${fmtPeso(ctxVal)}/sqm = ${fmtPeso(area * ctxVal)}.`;
      } else if (stats) {
        landBlock =
          `\n\nLAND VALUE ESTIMATE for ${areaStr} sqm here: about ${fmtPeso(area * stats.min)} (low) to ` +
          `${fmtPeso(area * stats.max)} (high), typical ~${fmtPeso(area * stats.median)} (based on this barangay's zonal values).`;
      } else if (rows.length) {
        const v = parseMoney(getVal(rows[0], "ZonalValuepersqm.-"));
        if (v) {
          const loc = [getVal(rows[0], "Street/Subdivision-"), getVal(rows[0], "Barangay-"), getVal(rows[0], "City-")]
            .filter(Boolean)
            .join(", ");
          landBlock = `\n\nLAND VALUE ESTIMATE: ${areaStr} sqm × ${fmtPeso(v)}/sqm = ${fmtPeso(area * v)} (based on ${loc}).`;
        }
      }
    }

    // Hazard profile — ONLY when the user asks about it (flood/landslide/surge/safe…).
    // Geocode the most specific place we resolved (cached → usually free), then read
    // the three hazard rasters (free). Plain value questions never reach this.
    // Builds (a) a text block for the model and (b) a structured object the UI renders
    // as a pretty card.
    let hazardBlock = "";
    let hazardResp: any = null;
    if (hazardIntent(question)) {
      let where = "";
      let hz: { flood: HazLevel; landslide: HazLevel; stormSurge: HazLevel } | null = null;

      // (1) Best: geocode the resolved place and sample the rasters. Pick the row
      // that actually matches the searched STREET (so "colon" geocodes a Colon row,
      // not whatever happened to be rows[0]); label the card to match that row.
      let gq = "";
      if (rows.length) {
        let tRow = rows[0];
        if (resolvedStreet) {
          const sq = normLoose(resolvedStreet);
          const hit = rows.find((r: Row) => {
            const s = normLoose(getVal(r, "Street/Subdivision-"));
            const v = normLoose(getVal(r, "Vicinity-"));
            return (s && s.includes(sq)) || (v && v.includes(sq));
          });
          if (hit) tRow = hit;
        }
        const st = String(getVal(tRow, "Street/Subdivision-") ?? "").trim();
        const br = String(getVal(tRow, "Barangay-") ?? "").trim();
        const ci = String(getVal(tRow, "City-") ?? "").trim();
        const pr = String(getVal(tRow, "Province-") ?? "").trim();
        gq = [st, br, ci, pr, "Philippines"].filter(Boolean).join(", ");
        where = [st || br, ci].filter(Boolean).join(", ") || ci;
      } else if (resolvedCity) {
        gq = [resolvedBarangay, resolvedCity, "Philippines"].filter(Boolean).join(", ");
        where = [resolvedBarangay, resolvedCity].filter(Boolean).join(", ");
      }
      if (gq) {
        const pt = await geocodePoint(baseUrl, gq);
        if (pt) {
          hz = await hazardAt(baseUrl, pt.lat, pt.lon);
          if (!where) where = pt.label;
        }
      }
      // (2) Fallback: the property currently selected on the map (free — from context).
      if (!hz && context && (context.city || context.barangay)) {
        const ctx = (lbl?: string): HazLevel => (lbl ? { label: lbl, level: labelLevel(lbl) } : null);
        hz = { flood: ctx(context.flood), landslide: ctx(context.landslide), stormSurge: ctx(context.stormSurge) };
        where = [context.street || context.barangay, context.city].filter(Boolean).join(", ");
      }

      if (hz) {
        hazardResp = {
          place: where,
          flood: hz.flood,
          landslide: hz.landslide,
          stormSurge: hz.stormSurge,
        };
        hazardBlock =
          `\n\nHAZARD PROFILE for ${where} (NOAH data at this point — flood = 100-yr; ` +
          `storm surge = worst-case SSA4; "None" = NOT in that hazard's zone):\n` +
          `- Flood: ${hz.flood?.label || "None"}\n` +
          `- Landslide: ${hz.landslide?.label || "None"}\n` +
          `- Storm surge: ${hz.stormSurge?.label || "None"}\n` +
          `(A detailed hazard card is shown to the user, so keep your text to ONE short friendly summary line — do not list each hazard again. Note hazards can vary within a city.)`;
      }
    }

    // MULTI-PLACE: "give me the hazards on those [examples]" → the places were named in
    // the AI's PREVIOUS reply, not the user's message. Pull the cities out of the last
    // assistant message and return a hazard card for each (city-level, up to 3).
    let hazardsResp: any[] = hazardResp ? [hazardResp] : [];
    const refersPrior = /\b(those|these|them|the\s+examples?|all|each|lahat|sila|nila|yan)\b/i.test(question);
    if (hazardIntent(question) && hazardsResp.length === 0 && refersPrior && domain) {
      const lastAssistant = [...history].reverse().find((m: any) => m?.role === "assistant" && m?.content);
      if (lastAssistant) {
        const cd = await getJson(`${baseUrl}/api/facets?mode=cities&domain=${encodeURIComponent(domain)}`, cookie);
        const cities: string[] = Array.isArray(cd?.cities) ? cd.cities : [];
        const amsg = normLoose(String(lastAssistant.content));
        const provTok = tokensOf(String(lastAssistant.content)).find((t) => PROVINCE_WORDS.has(t)) || "";
        // STRICT: the full city name (minus a "City" suffix) must appear as a phrase, so
        // "Santa Rosa" doesn't falsely match "Santa Cruz" on the shared word "Santa".
        const coreOf = (c: string) => normLoose(c).replace(/\bCITY\b/g, "").replace(/\s+/g, " ").trim();
        const matched = cities.filter((c) => { const core = coreOf(c); return core.length >= 3 && phraseInText(amsg, core); }).slice(0, 3);
        for (const city of matched) {
          const q = [cityCore(city), provTok, "Philippines"].filter(Boolean).join(", ");
          const pt = await geocodePoint(baseUrl, q);
          if (!pt) continue;
          const hz = await hazardAt(baseUrl, pt.lat, pt.lon);
          hazardsResp.push({ place: city, flood: hz.flood, landslide: hz.landslide, stormSurge: hz.stormSurge });
        }
        if (hazardsResp.length) {
          hazardBlock =
            `\n\nHAZARD PROFILES for the places mentioned (NOAH, city-level; cards are shown to the ` +
            `user — give ONE short friendly summary line, do not re-list each):\n` +
            hazardsResp
              .map((h) => `- ${h.place}: flood ${h.flood?.label || "None"}, landslide ${h.landslide?.label || "None"}, storm surge ${h.stormSurge?.label || "None"}`)
              .join("\n");
        }
      }
    }

    // When rows are value-sorted (a superlative query with no barangay stats), the FIRST
    // record is the exact highest/lowest — tell the model to use it (not the sample order).
    const sortedNote =
      sorted && !stats && dataLines.length > 0
        ? `\n\n(THESE RECORDS ARE SORTED BY VALUE — ${sorted === "high" ? "HIGHEST" : "LOWEST"} FIRST across ALL ${total} records. For the "${sorted === "high" ? "most expensive" : "cheapest"}" answer, the FIRST record above is the exact one — quote its street, value, and classification.)`
        : "";
    const dataBlock =
      dataLines.length > 0
        ? `TOTAL MATCHING RECORDS IN OUR DATABASE: ${total}${shownNote}\n\n` +
          `SAMPLE OF MATCHING ZONAL RECORDS:\n${dataLines.join("\n")}${sortedNote}${statsBlock}${landBlock}${barangayListBlock}${hazardBlock}`
        : `TOTAL MATCHING RECORDS IN OUR DATABASE: 0\n(none found for this query)${suggestionBlock}${barangayListBlock}${hazardBlock}`;

    // Follow-up quick-replies (tappable) after a successful location answer.
    let followups: string[] = [];
    if (rows.length && resolvedCity) {
      const cleanCity = String(resolvedCity).split(",")[0].trim();
      const placeLabel = resolvedBarangay ? `${resolvedBarangay}, ${cleanCity}` : cleanCity;
      followups = [
        `Most expensive in ${placeLabel}`,
        `Cheapest in ${placeLabel}`,
        `Land value for 100 sqm in ${placeLabel}`,
      ];
    }

    const system =
      "You are the Zonal AI Assistant, a friendly helper inside a Philippine zonal-value app. " +
      "You help users find official BIR zonal values (₱ per square meter), organized by province, city, barangay, and street. " +
      "Be warm, natural, and conversational — like a helpful real-estate assistant.\n\n" +
      "LANGUAGE: Reply in the SAME language the user used — English, Tagalog/Taglish, or Cebuano/Bisaya. Mirror their language naturally.\n\n" +
      "HOW TO RESPOND:\n" +
      "• Greetings / small talk (hi, hello, good morning, salamat, etc.): greet back warmly in one short line and invite them to ask about a zonal value or location. Do NOT say you have no record. " +
      "• Questions about you or the app (who are you, what can you do, how to use this): briefly explain that you answer zonal-value questions from the app's data — they can ask about a city, barangay, or street, or select a property on the map. " +
      "• General concept questions (what is a zonal value, what does a classification mean): explain it clearly and simply in 1–2 sentences. A zonal value is the BIR-assessed value per square meter used for taxes; it is not necessarily the market price. " +
      "• A specific location's value: use ONLY the zonal records provided below — quote the exact ₱/sqm and location, and NEVER invent or estimate a number.\n\n" +
      "RULES FOR LOCATION ANSWERS:\n" +
      "(0) BE FORGIVING of phrasing. Users may just type a place name ('Lahug', 'Sambag II, Cebu City') or ask loosely/with typos. If SAMPLE RECORDS are provided below, treat it as a request for that place's zonal value and ANSWER DIRECTLY with the value(s) — do NOT reply by asking 'are you looking for the value?'. Only ask a clarifying question when NO records were found, or the records clearly span different cities (then ask which city). " +
      "(1) Quote the exact ₱/sqm value and location from the records — never make up a number. " +
      "(2) For 'how many' / counting questions, use TOTAL MATCHING RECORDS as the exact count — do NOT count only the sample rows (the sample is just a preview). " +
      "(2b) For 'most expensive / highest / cheapest / lowest / average / range' questions: if VALUE STATS FOR THIS BARANGAY is provided, use it (it covers ALL records) — name the exact street and value. Otherwise, if a note says the records are SORTED BY VALUE, use the FIRST record (it is the exact highest/lowest across all records). Never pick the max from an unsorted/alphabetical sample. " +
      "(2c) For 'what / which / how many barangays' questions about a city, use the BARANGAYS IN <CITY> list (it is the complete list) — give the count and list them. " +
      "(3) If several records match (e.g. multiple classifications on one street), give the range or list a few, and mention the total count. " +
      "(4) If no record is provided but CLOSEST MATCHING PLACES are listed, the user likely misspelled it — politely ask 'Did you mean …?' and list those exact suggestions. If there are none, say you don't have a record for that exact location and suggest picking it on the map or checking the spelling. Either way, do NOT guess a number. " +
      "(5) Keep replies short and friendly — a sentence or two (a few more only when listing). No emojis except a friendly greeting. " +
      "(6) Politely steer fully off-topic questions (not about zonal values, locations, or this app) back to what you can help with. " +
      "(7) LAND VALUE: if a LAND VALUE ESTIMATE is provided, present it clearly (area × ₱/sqm = total) and note it's an estimate based on the zonal value, not the market price. " +
      "(8) HAZARDS: if a HAZARD PROFILE or 'Hazards here' is provided, report the flood, landslide, and storm-surge levels in plain words (e.g. 'Moderate flood risk, no landslide, high worst-case storm surge'). These come from NOAH/PAGASA hazard maps: flood is the 100-yr scenario; storm surge is the worst-case SSA4 (>4m) scenario. Briefly remind that it's a hazard-map estimate for that spot and that risk can differ across a city. NEVER state a hazard level unless it is given in the data — if none is provided, say you can check it if they confirm the exact place.\n\n" +
      selectedBlock +
      dataBlock;

    // Keep only the last few turns to limit input tokens.
    const trimmedHistory = history
      .slice(-MAX_HISTORY)
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && m.content)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_MSG_CHARS) }));

    const stream = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: MAX_TOKENS,
      stream: true,
      messages: [
        { role: "system", content: system },
        ...trimmedHistory,
        { role: "user", content: question },
      ],
    });

    // Stream the answer; the metadata (suggestions / hazards / followups) rides in the
    // first line so the UI can render cards + chips alongside the streaming text.
    return streamResponse(
      {
        ok: true,
        matched: dataLines.length,
        suggestions: dataLines.length === 0 ? suggestions ?? [] : [],
        followups,
        hazard: hazardResp,
        hazards: hazardsResp,
      },
      { stream },
    );
  } catch (e: any) {
    console.error("assistant error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
