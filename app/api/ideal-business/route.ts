import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function parseBusinessAnalysis(text: string): any {
  try {
    // Try to parse as JSON first (if GPT returns structured format)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {}
  
  // Fallback: parse as structured text
  const result: any = { businesses: [], best_recommendation: "" };
  const sections = text.split(/\n\n+/);
  
  let currentBusiness: any = null;
  for (const section of sections) {
    if (/^\d+\.|Business \d+:/i.test(section)) {
      // New business entry
      currentBusiness = {
        type: "",
        reason: "",
        target_market: "",
        capital_level: "",
        profit_potential: "",
        suitability_score: 0,
      };
      
      const lines = section.split("\n");
      for (const line of lines) {
        if (/business type|^type|^business:/i.test(line)) {
          currentBusiness.type = line.split(":")[1]?.trim() || "";
        } else if (/reason|rationale:/i.test(line)) {
          currentBusiness.reason = line.split(":")[1]?.trim() || "";
        } else if (/target market:/i.test(line)) {
          currentBusiness.target_market = line.split(":")[1]?.trim() || "";
        } else if (/capital|investment:/i.test(line)) {
          currentBusiness.capital_level = line.split(":")[1]?.trim() || "";
        } else if (/profit|revenue:/i.test(line)) {
          currentBusiness.profit_potential = line.split(":")[1]?.trim() || "";
        } else if (/suitability|score:/i.test(line)) {
          const match = line.match(/(\d+)/);
          currentBusiness.suitability_score = match ? parseInt(match[1]) : 0;
        }
      }
      
      if (currentBusiness.type) {
        result.businesses.push(currentBusiness);
      }
    } else if (/best overall|recommendation:/i.test(section)) {
      result.best_recommendation = section.split(":")[1]?.trim() || section;
    }
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


export async function POST(req: Request) {
  try {
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
      return NextResponse.json({ ok: false, error: "No business suggestions generated" }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      businesses: analysis.businesses.slice(0, 3),
      best_recommendation: analysis.best_recommendation,
      raw_analysis: raw
    });
  } catch (e: any) {
    console.error("ideal-business error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
