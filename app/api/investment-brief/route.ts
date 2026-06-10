import { NextResponse } from "next/server";
import OpenAI from "openai";
import { coastalNote } from "../../lib/coastal";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY in .env.local" }, { status: 500 });
    }

    const b = await req.json().catch(() => ({} as any));
    const city = String(b.city ?? "").trim();
    const barangay = String(b.barangay ?? "").trim();
    const province = String(b.province ?? "").trim();
    const classification = String(b.classification ?? "").trim();
    const zonalValue = String(b.zonalValue ?? "").trim();
    const landAreaSqm = Number(b.landAreaSqm) || 0;
    const landValue = Number(b.landValue) || 0;
    const comps = b.comps && typeof b.comps === "object" ? b.comps : null; // {min,median,max,count}
    const poiCounts = b.poiCounts ?? null;
    const monthly = Number(b.monthly) || 0;
    const downPct = Number(b.downPct) || 20;
    const lat = Number(b.lat);
    const lon = Number(b.lon);

    const loc = [barangay, city, province].filter(Boolean).join(", ") || "the selected area";

    // Real coastal/beach detection (one Places lookup) so tourism suggestions are grounded.
    const gKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "";
    const coastalSignal = await coastalNote(lat, lon, gKey);

    let compLine = "";
    if (comps?.median && zonalValue) {
      const sel = Number(String(zonalValue).replace(/[^0-9.]/g, ""));
      if (sel > 0 && comps.median > 0) {
        const diff = Math.round((sel / comps.median - 1) * 100);
        compLine = `Zonal value ₱${sel.toLocaleString()}/sqm is ${Math.abs(diff)}% ${diff >= 0 ? "above" : "below"} the barangay median (₱${Math.round(comps.median).toLocaleString()}/sqm; range ₱${Math.round(comps.min).toLocaleString()}–₱${Math.round(comps.max).toLocaleString()}, n=${comps.count}).`;
      }
    }

    const poiText = poiCounts && typeof poiCounts === "object"
      ? Object.entries(poiCounts).filter(([, v]) => typeof v === "number" && (v as number) > 0).map(([k, v]) => `${k}: ${v}`).join(", ")
      : "";

    // Location profile so business/living suggestions stay realistic.
    const totalPOI = poiCounts && typeof poiCounts === "object"
      ? Object.values(poiCounts).reduce((a: number, v: any) => a + (typeof v === "number" ? v : 0), 0) : 0;
    const density = totalPOI >= 25 ? "high" : totalPOI >= 10 ? "medium" : "low";
    const isUpland = /(upper|mountain|highland|hills?|bukid|sitio|upland|elevation)/i.test(barangay);
    const isUrban = /(poblacion|downtown|central|centrum|district|proper|market|business|commercial)/i.test(barangay) || /(city proper|city center|district)/i.test(city);
    const isAgricultural = /agri|agricultural|farm/i.test(classification);
    const ruralLike = isUpland || isAgricultural || density === "low";

    const userPrompt = `Analyze the location: ${loc}

KNOWN DATA (ground your analysis in these; use realistic estimates only where exact data is missing):
- Classification (BIR): ${classification || "Unclassified"}
- BIR zonal value: ₱${zonalValue || "-"}/sqm
${landAreaSqm ? `- Measured land: ${Math.round(landAreaSqm).toLocaleString()} sqm ≈ ₱${Math.round(landValue).toLocaleString()} at zonal value` : ""}
${compLine ? `- ${compLine}` : ""}
${poiText ? `- Nearby establishments (counts within radius): ${poiText}` : ""}
${monthly ? `- Indicative financing: about ₱${Math.round(monthly).toLocaleString()}/month at ${downPct}% down (20-yr, ~6.5%)` : ""}
${coastalSignal ? `- Coastal: ${coastalSignal} You MAY recommend beach/resort, beachfront dining, water-sports, short-stay/Airbnb, and tourism businesses where appropriate.` : "- Coastal: no beach detected nearby — do NOT assume beach/resort potential."}
- Location signals: ${isUpland ? "upland/rural; " : ""}${isUrban ? "urban/town-center; " : ""}${isAgricultural ? "agricultural zoning; " : ""}POI density: ${density}.
${ruralLike
  ? "REALISM RULE: This is a low-density/rural/upland/agricultural area. Keep business recommendations realistic — essentials, agriculture, and community services. Do NOT recommend malls, big-brand cafés, fine dining, BPO/co-working, or nightlife."
  : "This is an urban-leaning area; recommend realistically to its density and access."}

Create a CONCISE, premium location brief with EXACTLY these markdown sections (keep it tight — no filler):

# Executive Summary
Overall Rating: X/10
Business Suitability: X%
Residential Suitability: X%
Investment Potential: X%
Recommended Use: [primary land use]
Zonal Classification: [Prime Commercial Hub / Mixed-Use Urban District / Residential Growth Area / Institutional Zone / Tourism Zone / Emerging Investment Corridor / Industrial Area]
Growth Outlook: [Excellent / Strong / Moderate / Emerging]

# Overview
2-3 sentences on the area's character, strategic advantages, and attractiveness.

# Scores
One line each, format "Metric: XX/100 — short reason": Business Potential; Residential Suitability; Accessibility; Commercial Activity; Investment Potential; Lifestyle & Convenience; Safety & Community Appeal; Future Growth.

# Top Business Opportunities
The top 5 best-suited businesses. One line each: "1. Type — Suitability XX%, Demand High/Medium/Low — brief reason". Keep realistic to the location type above.

# Living & Best Use
1-2 sentences: what living here is like, and the single best use (home vs business) with a realistic outlook.

Rules: explain WHY scores are assigned (briefly); professional, authoritative, data-driven tone; NO generic filler; Philippine real-estate context; do not invent figures that contradict the KNOWN DATA. Keep the whole report under ~220 words.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You are an expert Urban Planning Analyst, Real Estate Consultant, GIS Specialist, and Business Location Strategist for the Philippine market. Produce premium, data-driven, investor-focused location intelligence reports. Ground every assessment in the provided data and realistic Philippine context; explain WHY each score is assigned. Keep business and lifestyle recommendations realistic to the location type and density (never suggest malls/BPO/fine-dining in rural or low-density areas). Write in a polished, authoritative tone using clean markdown.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const text = String(completion.choices?.[0]?.message?.content ?? "").trim();
    return NextResponse.json({ ok: true, text });
  } catch (e: any) {
    console.error("investment-brief error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
