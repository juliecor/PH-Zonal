import { NextResponse } from "next/server";
import OpenAI from "openai";

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

    const loc = [barangay, city, province].filter(Boolean).join(", ") || "the selected area";

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

    const userPrompt = `Write a concise, professional PROPERTY BRIEF for an agent advising both a HOME BUYER and a BUSINESS INVESTOR.

LOCATION: ${loc}
Classification: ${classification || "Unclassified"}
Zonal value: ₱${zonalValue || "-"}/sqm
${landAreaSqm ? `Measured land: ${Math.round(landAreaSqm).toLocaleString()} sqm ≈ ₱${Math.round(landValue).toLocaleString()} at zonal value` : ""}
${compLine}
${poiText ? `Nearby facilities: ${poiText}` : ""}
${monthly ? `Indicative financing: about ₱${Math.round(monthly).toLocaleString()}/month at ${downPct}% down (20-yr, ~6.5%)` : ""}

LOCATION TYPE: ${isUpland ? "Upland/rural. " : ""}${isUrban ? "Urban/town-center. " : ""}${isAgricultural ? "Agricultural zoning. " : ""}POI density: ${density.toUpperCase()}.
${ruralLike
  ? "BUSINESS RULES: suggest only essentials & community services (sari-sari, carinderia, water refilling, farm supply, hardware, vulcanizing, rice retail, laundry, e-wallet/remittance). Do NOT suggest malls, big-brand cafés, fine dining, BPO, or nightlife."
  : "BUSINESS RULES: urban context allowed, but stay realistic to the density and access."}

Format EXACTLY these four short labeled sections (1-2 sentences each):
Living Conditions: what it is like to live here — environment, access to schools/hospitals/markets, residential suitability.
Business Opportunities: 2-3 suitable business types for this exact location and why (follow the BUSINESS RULES).
Valuation: the value vs the barangay median and affordability.
Best Use & Outlook: the single best use (home vs business) and a realistic outlook.

Be specific to THIS data, professional and realistic — no hype, no guaranteed returns. Under 180 words total. Do not invent figures not given.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 420,
      messages: [
        {
          role: "system",
          content:
            "You are a senior Philippine real estate analyst advising both home buyers and business investors. Write sharp, professional, realistic briefs grounded ONLY in the data provided. Match business and living suggestions to the location type and density. Never exaggerate or promise returns. Keep it concise.",
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
