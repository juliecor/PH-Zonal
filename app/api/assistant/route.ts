import { NextResponse } from "next/server";
import OpenAI from "openai";
import { fuzzyMatchStreets } from "../../lib/zonal-util";

export const runtime = "nodejs";

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
  params: { city?: string; barangay?: string; q?: string }
): Promise<{ rows: Row[]; total: number }> {
  const sp = new URLSearchParams({ domain, page: "1" });
  if (params.city) sp.set("city", params.city);
  if (params.barangay) sp.set("barangay", params.barangay);
  if (params.q) sp.set("q", params.q);
  const data = await getJson(`${baseUrl}/api/zonal?${sp.toString()}`, cookie);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  // totalRows is the TRUE count of all matching records (across all pages),
  // even though we only fetch page 1 of sample rows.
  const total = Number(data?.totalRows ?? rows.length) || rows.length;
  return { rows, total };
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
  if (cities.length) {
    let bestLen = 0;
    for (const c of cities) {
      const core = cityCore(c);
      if (core.length >= 3 && phraseInText(qNorm, core) && core.length > bestLen) {
        city = c;
        bestLen = core.length;
      }
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
          for (const m of fuzzyMatchStreets(t, barangays, 2)) hits.add(m);
        }
        const list = Array.from(hits);
        if (list.length === 1) {
          barangay = list[0];
        } else if (list.length > 1) {
          // e.g. typed "sambag" -> matches Sambag I, II, III: ask instead of guessing
          ambiguous = list.slice(0, 4);
        }
      }
    }
  }

  // 3) Street query = the most distinctive leftover token (drop city/barangay words).
  const used = new Set<string>([
    ...tokensOf(cityCore(city)),
    ...tokensOf(normLoose(barangay)),
  ]);
  const streetTokens = placeTokens.filter((t) => !used.has(t));
  const streetQ = streetTokens.sort((a, b) => b.length - a.length)[0] || "";

  // 4) ONE structured query, with at most one looser retry on a miss.
  const attempts: { city?: string; barangay?: string; q?: string }[] = [];
  if (city && barangay && streetQ) attempts.push({ city, barangay, q: streetQ });
  if (city && barangay) attempts.push({ city, barangay });
  if (city && streetQ) attempts.push({ city, q: streetQ });
  if (city) attempts.push({ city });
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

  // Don't spend a paid zonal search on non-location chit-chat: only query when we
  // resolved a real city, or the message clearly has location/value intent.
  const hasIntent = looksLikeLocationQuery(question);
  if (!city && !hasIntent) planned = [];
  // If the barangay is ambiguous, don't guess (and don't waste a token) — ask first.
  if (ambiguous.length) planned = [];

  let rows: Row[] = [];
  let total = 0;
  for (const a of planned) {
    const r = await zonalQuery(baseUrl, cookie, domain, a);
    rows = r.rows;
    total = r.total;
    if (rows.length) break;
  }

  // 5) On a miss, build "did you mean…?" suggestions from the closest real names.
  //    (Free — these come from the cached facet lists, no extra zonal token.)
  //    Only when the user actually sought a place (not greetings / small talk).
  let suggestions: string[] = [];
  if (ambiguous.length) {
    // Surface the close barangay names so the model can ask "Did you mean …?"
    suggestions = ambiguous.map((b) => (city ? `${b}, ${city}` : b));
  } else if (!rows.length && (city || hasIntent)) {
    const pool = city && barangays.length ? barangays : cities;
    const seenSugg = new Set<string>();
    for (const t of placeTokens) {
      if (t.length < 3) continue;
      const m = fuzzyMatchStreets(t, pool, 3).slice(0, 3);
      for (const name of m) {
        const label = city && barangays.length ? `${name}, ${city}` : name;
        if (!seenSugg.has(label)) { seenSugg.add(label); suggestions.push(label); }
      }
      if (suggestions.length >= 4) break;
    }
    suggestions = suggestions.slice(0, 4);
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

  return { rows, total, city, barangay, streetQ, suggestions, stats };
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
      return NextResponse.json({ ok: true, text: faq, matched: 0, suggestions: [], source: "faq" });
    }

    // Build absolute base URL + forward the user's auth cookie to internal APIs
    // (Cebu and other DB-backed provinces require the Bearer token from authToken).
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const baseUrl = `${proto}://${host}`;
    const cookie = req.headers.get("cookie") || "";

    // 1) Look up matching zonal rows from OUR data (grounding).
    const { rows, total, suggestions, stats } = domain
      ? await lookupZonal(baseUrl, cookie, domain, question)
      : { rows: [] as Row[], total: 0, suggestions: [] as string[], stats: null };
    const dataLines = rows.slice(0, MAX_ROWS_IN_PROMPT).map(rowToLine);

    // 2) Include the currently selected property, if the user asks about "this".
    let selectedBlock = "";
    if (context && (context.city || context.barangay)) {
      const loc = [context.street, context.barangay, context.city, context.province]
        .filter(Boolean)
        .join(", ");
      selectedBlock =
        `CURRENTLY SELECTED PROPERTY (use this when the user says "this", "here", "selected"):\n` +
        `- ${loc}${context.classification ? ` [${context.classification}]` : ""}: ₱${context.zonalValue || "no value on record"}/sqm\n\n`;
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
          suggestions.map((s) => `- ${s}`).join("\n")
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

    const dataBlock =
      dataLines.length > 0
        ? `TOTAL MATCHING RECORDS IN OUR DATABASE: ${total}${shownNote}\n\n` +
          `SAMPLE OF MATCHING ZONAL RECORDS:\n${dataLines.join("\n")}${statsBlock}`
        : `TOTAL MATCHING RECORDS IN OUR DATABASE: 0\n(none found for this query)${suggestionBlock}`;

    const system =
      "You are the Zonal AI Assistant, a friendly helper inside a Philippine zonal-value app. " +
      "You help users find official BIR zonal values (₱ per square meter), organized by province, city, barangay, and street. " +
      "Be warm, natural, and conversational — like a helpful real-estate assistant.\n\n" +
      "HOW TO RESPOND:\n" +
      "• Greetings / small talk (hi, hello, good morning, salamat, etc.): greet back warmly in one short line and invite them to ask about a zonal value or location. Do NOT say you have no record. " +
      "• Questions about you or the app (who are you, what can you do, how to use this): briefly explain that you answer zonal-value questions from the app's data — they can ask about a city, barangay, or street, or select a property on the map. " +
      "• General concept questions (what is a zonal value, what does a classification mean): explain it clearly and simply in 1–2 sentences. A zonal value is the BIR-assessed value per square meter used for taxes; it is not necessarily the market price. " +
      "• A specific location's value: use ONLY the zonal records provided below — quote the exact ₱/sqm and location, and NEVER invent or estimate a number.\n\n" +
      "RULES FOR LOCATION ANSWERS:\n" +
      "(1) Quote the exact ₱/sqm value and location from the records — never make up a number. " +
      "(2) For 'how many' / counting questions, use TOTAL MATCHING RECORDS as the exact count — do NOT count only the sample rows (the sample is just a preview). " +
      "(2b) For 'most expensive / highest / cheapest / lowest / average / range' questions, use VALUE STATS FOR THIS BARANGAY (it covers ALL records) — name the exact street and value. Do NOT pick the max from the small sample list, since the sample is only alphabetical and may miss the priciest street. " +
      "(3) If several records match (e.g. multiple classifications on one street), give the range or list a few, and mention the total count. " +
      "(4) If no record is provided but CLOSEST MATCHING PLACES are listed, the user likely misspelled it — politely ask 'Did you mean …?' and list those exact suggestions. If there are none, say you don't have a record for that exact location and suggest picking it on the map or checking the spelling. Either way, do NOT guess a number. " +
      "(5) Keep replies short and friendly — a sentence or two (a few more only when listing). No emojis except a friendly greeting. " +
      "(6) Politely steer fully off-topic questions (not about zonal values, locations, or this app) back to what you can help with.\n\n" +
      selectedBlock +
      dataBlock;

    // Keep only the last few turns to limit input tokens.
    const trimmedHistory = history
      .slice(-MAX_HISTORY)
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && m.content)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_MSG_CHARS) }));

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        ...trimmedHistory,
        { role: "user", content: question },
      ],
    });

    const text = String(completion.choices?.[0]?.message?.content ?? "").trim();
    // Return suggestions so the UI can show clickable "Did you mean…?" chips.
    return NextResponse.json({
      ok: true,
      text,
      matched: dataLines.length,
      suggestions: dataLines.length === 0 ? suggestions ?? [] : [],
    });
  } catch (e: any) {
    console.error("assistant error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
