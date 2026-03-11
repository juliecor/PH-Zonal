import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function parseBusinessAnalysis(text: string): any {
  const result: any = { businesses: [], best_recommendation: "" };

  // 1) Try to parse JSON if present
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed?.businesses) && parsed.businesses.length) return parsed;
    }
  } catch {}

  // 2) Parse numbered structured blocks (legacy format)
  const numberedBlocks = text.split(/\n\n+/).filter((s) => /^\d+\.|Business \d+:/i.test(s.trim()));
  if (numberedBlocks.length) {
    for (const block of numberedBlocks) {
      const item: any = { type: "", reason: "", target_market: "", capital_level: "", profit_potential: "", suitability_score: 0 };
      for (const line of block.split(/\n+/)) {
        if (/business type|^type|^business:/i.test(line)) item.type = line.split(":")[1]?.trim() || item.type;
        if (/reason|rationale:/i.test(line)) item.reason = line.split(":")[1]?.trim() || item.reason;
        if (/target market:/i.test(line)) item.target_market = line.split(":")[1]?.trim() || item.target_market;
        if (/capital|investment:/i.test(line)) item.capital_level = line.split(":")[1]?.trim() || item.capital_level;
        if (/profit|revenue:/i.test(line)) item.profit_potential = line.split(":")[1]?.trim() || item.profit_potential;
        if (/suitability|score:/i.test(line)) {
          const m = line.match(/(\d{1,2})/);
          if (m) item.suitability_score = parseInt(m[1]);
        }
        if (!item.type && /^\d+\.|Business \d+:/i.test(line)) item.type = line.replace(/^\d+\.|Business \d+:/i, "").trim();
      }
      if (item.type) result.businesses.push(item);
    }
  }

  // 3) Bullet-only format (new prompt). Example: "• Sari-sari – serves local demand"
  if (result.businesses.length === 0) {
    const lines = text.split(/\n+/);
    const bullets: string[] = [];
    let inSection = false;
    for (const raw of lines) {
      const s = String(raw || "").trim();
      if (!s) continue;
      if (/key\s*business\s*opportunities/i.test(s)) { inSection = true; continue; }
      if (inSection && /^\s*[\-•\*]/.test(s)) bullets.push(s.replace(/^\s*[\-•\*]\s*/, ""));
      // stop when we hit another header
      if (inSection && /^[A-Z].+:$/.test(s) && !/^key\s*business/i.test(s)) break;
    }

    const top = (bullets.length ? bullets : lines.filter((l) => /^\s*[\-•\*]/.test(l)).map((l) => l.replace(/^\s*[\-•\*]\s*/, ""))).slice(0, 3);
    for (const b of top) {
      const parts = b.split(/\s[–—-]\s|\s-\s/); // split on dash variants
      const type = parts[0]?.trim() || b.trim();
      const reason = parts.slice(1).join(" - ").trim();
      result.businesses.push({
        type,
        reason,
        target_market: "",
        capital_level: "",
        profit_potential: "",
        suitability_score: 0,
      });
    }

    // Best overall
    const bestLine = lines.find((l) => /best\s+overall/i.test(l));
    if (bestLine) result.best_recommendation = bestLine.replace(/^[^:]*:/, "").trim();
  }

  return result;
}

function deriveContextHints(params: {
  barangay: string;
  city: string;
  classification: string;
  poiCounts: Record<string, number> | null;
}) {
  const brgy = (params.barangay || "").toLowerCase();
  const cty = (params.city || "").toLowerCase();
  const cls = (params.classification || "").toLowerCase();
  const counts = params.poiCounts || {} as Record<string, number>;
  const totalPOI = Object.values(counts).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);

  // LOCATION TYPE DETECTION
function enrichBusinesses(
  businesses: Array<{
    type?: string;
    reason?: string;
    target_market?: string;
    capital_level?: string;
    profit_potential?: string;
    suitability_score?: number;
  }>,
  ctx: {
    poiCounts: Record<string, number> | null;
    isUpland: boolean;
    isUrban: boolean;
    density: "low" | "medium" | "high";
    isAgricultural: boolean;
  }
) {
  const counts = ctx.poiCounts || {} as Record<string, number>;
  const schools = Number(counts.schools || 0);
  const healthcare = Number((counts.hospitals || 0) + (counts.clinics || 0));

  function capitalFor(type: string) {
    const s = type.toLowerCase();
    if (/(sari|carinderia|food stall|laundry|motorcycle|rice|produce|water refilling)/i.test(s)) return "low";
    if (/(hardware|farm supply|pharmacy|restaurant|logistics|clinic)/i.test(s)) return "medium";
    return ctx.density === "low" ? "low" : "medium";
  }

  function profitFor(type: string) {
    const s = type.toLowerCase();
    if (/(sari|carinderia|food stall|rice|produce|load|remittance)/i.test(s)) return ctx.density === "low" ? "medium" : "medium";
    if (/(hardware|farm supply|pharmacy|clinic)/i.test(s)) return ctx.density === "high" ? "high" : "medium";
    return ctx.density === "high" ? "medium" : "low";
  }

  function marketFor(type: string) {
    const parts: string[] = [];
    const s = type.toLowerCase();
    if (/(sari|rice|produce|water refilling)/i.test(s)) parts.push("nearby households, farmers");
    if (/(carinderia|food stall)/i.test(s)) parts.push("workers, farmers" + (schools >= 2 ? ", students" : ""));
    if (/(hardware|farm supply)/i.test(s)) parts.push("local builders, growers");
    if (/(motorcycle)/i.test(s)) parts.push("motorcycle owners, tricycle drivers");
    if (healthcare > 0 && /(pharmacy|clinic)/i.test(s)) parts.push("patients and caregivers");
    if (!parts.length) parts.push(ctx.isUpland ? "local community" : "nearby residents and passers-by");
    return parts.join("; ");
  }

  function scoreFor(type: string) {
    const s = type.toLowerCase();
    let score = 5;
    if (ctx.isUpland || ctx.isAgricultural || ctx.density === "low") {
      if (/(sari|carinderia|food stall|produce|rice|farm supply|motorcycle|water refilling|hardware)/i.test(s)) score += 3;
      if (/(mall|chain|fine dining|bpo|co-?working|nightlife)/i.test(s)) score -= 2;
    } else if (ctx.density === "high") {
      if (/(pharmacy|restaurant|retail|clinic|salon)/i.test(s)) score += 2;
    }
    if (schools >= 3 && /(snacks|milk tea|school supplies|printing|canteen|carinderia)/i.test(s)) score += 1;
    if (healthcare >= 2 && /(pharmacy|clinic|medical)/i.test(s)) score += 1;
    score = Math.max(2, Math.min(9, score));
    return score;
  }

  return businesses.map((b) => {
    const type = String(b.type || "Business");
    return {
      type,
      reason: b.reason || "Location-fit based on density and access.",
      target_market: b.target_market || marketFor(type),
      capital_level: b.capital_level || capitalFor(type),
      profit_potential: b.profit_potential || profitFor(type),
      suitability_score: (typeof b.suitability_score === "number" && b.suitability_score > 0) ? b.suitability_score : scoreFor(type),
    };
  });
}

  const isMountain = /(upper|mountain|highland|hills?|bukid|sapa|sitio|upland|elevation)/i.test(brgy);
  const isUrban = /(poblacion|downtown|central|centrum|district|proper|market|business|commercial)/i.test(brgy) || /(city proper|city center|district)/i.test(cty);
  const isRural = totalPOI < 8 && !isUrban;
  const isCoastal = /(beach|daw|dagat|coastal|port)/i.test(brgy);
  const isAgricultural = /agricultural|farm|agri/i.test(cls);

  const hints: string[] = [];

  // Location category
  if (isMountain) {
    hints.push("MOUNTAIN/UPLAND AREA - Limited road access, local community focus, essentials-based economy");
  } else if (isUrban) {
    hints.push("URBAN/POBLACION - High foot traffic, diverse consumer base, commercial viability");
  } else if (isCoastal) {
    hints.push("COASTAL AREA - Tourism potential, fishing-related opportunities");
  } else if (isRural) {
    hints.push("RURAL AREA - Agricultural communities, local demand, subsistence-focused");
  }

  if (isAgricultural) {
    hints.push("Agricultural classification - farming/agribusiness focus");
  }

  // POI density assessment
  if (totalPOI >= 25) hints.push("High service density (urban commercial potential)");
  else if (totalPOI >= 10) hints.push("Moderate service density (suburban opportunities)");
  else hints.push("Low service density (essentials and local services only)");

  return hints.join(" | ");
}


// Enrich parsed businesses with sensible defaults based on location profile
function enrichBusinesses(
  businesses: Array<{
    type?: string;
    reason?: string;
    target_market?: string;
    capital_level?: string;
    profit_potential?: string;
    suitability_score?: number;
  }>,
  ctx: {
    poiCounts: Record<string, number> | null;
    isUpland: boolean;
    isUrban: boolean;
    density: "low" | "medium" | "high";
    isAgricultural: boolean;
  }
) {
  const counts = ctx.poiCounts || ({} as Record<string, number>);
  const schools = Number(counts.schools || 0);
  const healthcare = Number((counts.hospitals || 0) + (counts.clinics || 0));

  function capitalFor(type: string) {
    const s = type.toLowerCase();
    if (/(sari|carinderia|food stall|laundry|motorcycle|rice|produce|water refilling)/i.test(s)) return "low";
    if (/(hardware|farm supply|pharmacy|restaurant|logistics|clinic)/i.test(s)) return "medium";
    return ctx.density === "low" ? "low" : "medium";
  }

  function profitFor(type: string) {
    const s = type.toLowerCase();
    if (/(sari|carinderia|food stall|rice|produce|load|remittance)/i.test(s)) return ctx.density === "low" ? "medium" : "medium";
    if (/(hardware|farm supply|pharmacy|clinic)/i.test(s)) return ctx.density === "high" ? "high" : "medium";
    return ctx.density === "high" ? "medium" : "low";
  }

  function marketFor(type: string) {
    const parts: string[] = [];
    const s = type.toLowerCase();
    if (/(sari|rice|produce|water refilling)/i.test(s)) parts.push("nearby households, farmers");
    if (/(carinderia|food stall)/i.test(s)) parts.push("workers, farmers" + (schools >= 2 ? ", students" : ""));
    if (/(hardware|farm supply)/i.test(s)) parts.push("local builders, growers");
    if (/(motorcycle)/i.test(s)) parts.push("motorcycle owners, tricycle drivers");
    if (healthcare > 0 && /(pharmacy|clinic)/i.test(s)) parts.push("patients and caregivers");
    if (!parts.length) parts.push(ctx.isUpland ? "local community" : "nearby residents and passers-by");
    return parts.join("; ");
  }

  function scoreFor(type: string) {
    const s = type.toLowerCase();
    let score = 5;
    if (ctx.isUpland || ctx.isAgricultural || ctx.density === "low") {
      if (/(sari|carinderia|food stall|produce|rice|farm supply|motorcycle|water refilling|hardware)/i.test(s)) score += 3;
      if (/(mall|chain|fine dining|bpo|co-?working|nightlife)/i.test(s)) score -= 2;
    } else if (ctx.density === "high") {
      if (/(pharmacy|restaurant|retail|clinic|salon)/i.test(s)) score += 2;
    }
    if (schools >= 3 && /(snacks|milk tea|school supplies|printing|canteen|carinderia)/i.test(s)) score += 1;
    if (healthcare >= 2 && /(pharmacy|clinic|medical)/i.test(s)) score += 1;
    score = Math.max(2, Math.min(9, score));
    return score;
  }

  return businesses.map((b) => {
    const type = String(b.type || "Business");
    return {
      type,
      reason: b.reason || "Location-fit based on density and access.",
      target_market: b.target_market || marketFor(type),
      capital_level: b.capital_level || capitalFor(type),
      profit_potential: b.profit_potential || profitFor(type),
      suitability_score: typeof b.suitability_score === "number" && b.suitability_score > 0 ? b.suitability_score : scoreFor(type),
    };
  });
}


export async function POST(req: Request) {
  try {
    // Optional kill switch (default: enabled). Set IDEAL_BUSINESS_DISABLED=true to turn off.
    const DISABLE = (process.env.IDEAL_BUSINESS_DISABLED ?? "false").toLowerCase() === "true" || process.env.IDEAL_BUSINESS_DISABLED === "1";
    if (DISABLE) {
      return NextResponse.json({ ok: false, error: "Ideal Business is temporarily disabled" }, { status: 503 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const city = String(body.city ?? "").trim();
    const barangay = String(body.barangay ?? "").trim();
    const province = String(body.province ?? "").trim();
    const classification = String(body.classification ?? "").trim();
    const zonalValuePerSqm = String(body.zonalValuePerSqm ?? "").trim();
    const poiCounts = body.poiCounts ?? null;

    const loc = [barangay, city, province].filter(Boolean).join(", ") || "the selected area";
    
    // Enhanced POI Analysis
    const poiAnalysis = (() => {
      if (!poiCounts || typeof poiCounts !== "object") return "";
      const entries = Object.entries(poiCounts)
        .filter(([, v]) => typeof v === "number" && (v as number) > 0)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const total = Object.values(poiCounts).reduce((a: number, b: any) => a + (typeof b === "number" ? b : 0), 0);
      return `POI Infrastructure (1.5km radius):
  Services: ${entries}
  Total facilities: ${total}
  Density classification: ${total >= 25 ? "Urban/High traffic area" : total >= 10 ? "Suburban/Medium foot traffic" : "Rural/Low traffic area"}`;
    })();

    const contextHints = deriveContextHints({ barangay, city, classification, poiCounts });

    // Compute strict allow/avoid lists based on context to keep outputs realistic
    const totalPOI = poiCounts && typeof poiCounts === "object"
      ? Object.values(poiCounts).reduce((a: number, b: any) => a + (typeof b === "number" ? b : 0), 0)
      : 0;
    const isUpland = /(upper|mountain|highland|hills?|bukid|sapa|sitio|upland|elevation)/i.test(barangay);
    const isUrban = /(poblacion|downtown|central|centrum|district|proper|market|business|commercial)/i.test(barangay) || /(city proper|city center|district)/i.test(city);
    const density = totalPOI >= 25 ? "high" : totalPOI >= 10 ? "medium" : "low";
    const isAgricultural = /agri|agricultural|farm/i.test(classification);

    const allowedForUpland = [
      "Sari-sari / Micro-retail",
      "Carinderia / Basic food stall",
      "Fresh produce aggregation & selling",
      "Feed/seed/farm supply",
      "Water refilling & purified ice",
      "Motorcycle repair / vulcanizing",
      "Small hardware & construction supplies",
      "Rice retailing",
      "Prepaid load / e-wallet / remittance kiosk",
      "Laundry services",
    ];
    const avoidUrban = [
      "Malls and chain retail",
      "Big-brand cafés/fine dining",
      "Co-working/BPO centers",
      "Nightlife bars/clubs",
      "Large supermarkets",
    ];

    const userPrompt = `
  RECOMMENDED BUSINESS OPPORTUNITIES FOR THIS LOCATION

Location: ${loc}
Classification: ${classification || "Unclassified"}
Zonal Value: ₱${zonalValuePerSqm}/sqm
Context: ${contextHints}

---

  FORMAT RESPONSE AS BULLET POINTS ONLY (professional layout):

  LOCATION PROFILE:
  - Upland/Mountain: ${isUpland ? "YES" : "NO"}
  - Urban/Poblacion: ${isUrban ? "YES" : "NO"}
  - POI Density: ${density.toUpperCase()}
  - Agricultural Zoning: ${isAgricultural ? "YES" : "NO"}

  STRICT RULES:
  ${isUpland || isAgricultural || density === "low" ? `- Allowed examples only: ${allowedForUpland.join("; ")}
  - Avoid: ${avoidUrban.join("; ")}
  - Emphasize essentials and agri-adjacent services; must be feasible for limited foot traffic and road access.` : `- Urban context allowed but keep realistic to density and access.`}

💼 Key Business Opportunities:
• [Business Type 1] – [why it works here & who needs it]
• [Business Type 2] – [why it works here & target market]
• [Business Type 3] – [why it works here & customer base]

⭐ Best Overall Recommendation:
• [Single best business type for this location]
• [Key reason why]

---

CRITICAL RULES:
- If MOUNTAIN/UPLAND: ONLY sari-sari, agriculture, essentials (NO retail chains)
- If URBAN: Can recommend diverse retail and services
- If RURAL: Focus on agricultural, local services
- Use bullet points ONLY - NO paragraphs
- Be location-specific (not generic)
- Include target customer type

LENGTH: Keep entire response under 150 words.
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            "You are a Philippine business consultant. Provide location-specific business recommendations in BULLET-POINT ONLY format  with emojis. For mountain/rural areas, only suggest practical, accessible businesses. NO urban chains for upland areas. Be concise and professional.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const analysis = parseBusinessAnalysis(String(raw));

    if (!analysis.businesses || analysis.businesses.length === 0) {
      // Graceful fallback: derive from bullet lines to avoid 500s
      const quick = String(raw || "")
        .split(/\n+/)
        .filter((l) => /^\s*[\-•\*]/.test(l))
        .map((l) => l.replace(/^\s*[\-•\*]\s*/, ""))
        .slice(0, 3);

      if (quick.length) {
        const enriched = enrichBusinesses(
          quick.map((b) => ({ type: b })),
          { poiCounts, isUpland, isUrban, density, isAgricultural }
        );
        return NextResponse.json({ ok: true, businesses: enriched, best_recommendation: "", raw_analysis: raw });
      }

      return NextResponse.json({ ok: false, error: "No business suggestions generated" }, { status: 500 });
    }

    const enriched = enrichBusinesses(
      analysis.businesses.slice(0, 3),
      { poiCounts, isUpland, isUrban, density, isAgricultural }
    );
    return NextResponse.json({ ok: true, businesses: enriched, best_recommendation: analysis.best_recommendation, raw_analysis: raw });
  } catch (e: any) {
    console.error("ideal-business error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
