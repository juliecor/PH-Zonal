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

  const hints: string[] = [];

  // Heuristic: POI density → urban vs rural feel
  if (totalPOI >= 25) hints.push("urban / city-center density");
  else if (totalPOI >= 10) hints.push("suburban / mixed-use density");
  else hints.push("rural / low-density area");

  // Heuristic: mountain/upland indicators in barangay names
  if (/(upper|mountain|highland|hills?|bukid|sapa|sitio)/i.test(params.barangay)) {
    hints.push("mountain/upland barangay (limited foot traffic; local essentials)");
  }

  // Heuristic: poblacion/downtown indicators
  if (/(poblacion|downtown|central|centrum|district|proper|market)/i.test(params.barangay) || /(city proper|district)/i.test(params.city)) {
    hints.push("near poblacion/market area (higher foot traffic)");
  }

  // Classification cue
  if (cls.includes("residential")) hints.push("primarily residential");
  if (cls.includes("commercial")) hints.push("commercial corridor possible");
  if (cls.includes("agricultural")) hints.push("agri-adjacent opportunities");

  return hints.join("; ");
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
    const poiText =
      poiCounts && typeof poiCounts === "object"
        ? `POI counts within ~1.5km: ${Object.entries(poiCounts)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}.`
        : "";

    const contextHints = deriveContextHints({ barangay, city, classification, poiCounts });

    const userPrompt = `
Analyze this selected place and suggest the top 5 ideal businesses to open there.

Location Details:
- Place: ${loc}
- Classification: ${classification || "Unknown"}
- Zonal Value (per sqm): ₱${zonalValuePerSqm || "N/A"}
${poiText}
- Context: ${contextHints}

For each business recommendation, provide:
1. Business Type (e.g., "Sari-sari Store", "Laundromat")
2. Short Reason (why it works here)
3. Target Market (who will buy)
4. Capital Level (low/medium/high estimate)
5. Profit Potential (low/medium/high)
6. Suitability Score (1-10)

Requirements:
- Base suggestions on EXACT location details (not generic)
- Consider foot traffic, accessibility, nearby establishments, and land value
- Only recommend practical Philippine businesses
- Rank the top 5 from most to least suitable
- End with the single best overall recommendation

Format each business clearly with numbered headings (Business 1:, Business 2:, etc.).
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 1500,
      messages: [
        {
          role: "system",
          content:
            "You are a Philippine real estate and business consultant. Analyze locations and provide accurate, practical business recommendations based on local market conditions, zonal values, and accessibility. Be specific to the Philippine context and provide detailed reasoning for each suggestion.",
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
      businesses: analysis.businesses.slice(0, 5),  // Top 5
      best_recommendation: analysis.best_recommendation,
      raw_analysis: raw  // Include raw text for debugging
    });
  } catch (e: any) {
    console.error("ideal-business error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
