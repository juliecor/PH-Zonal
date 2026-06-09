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

    const userPrompt = `Write a concise, professional real-estate INVESTMENT BRIEF for an agent/buyer.

LOCATION: ${loc}
Classification: ${classification || "Unclassified"}
Zonal value: ₱${zonalValue || "-"}/sqm
${landAreaSqm ? `Measured land: ${Math.round(landAreaSqm).toLocaleString()} sqm ≈ ₱${Math.round(landValue).toLocaleString()} at zonal value` : ""}
${compLine}
${poiText ? `Nearby facilities: ${poiText}` : ""}
${monthly ? `Indicative financing: about ₱${Math.round(monthly).toLocaleString()}/month at ${downPct}% down (20-yr, ~6.5%)` : ""}

Format EXACTLY three short labeled sections, each 1-2 sentences:
Valuation: ...
Location & Infrastructure: ...
Outlook & Best Use: ...

Be specific to THIS data, professional and realistic — no hype, no guaranteed returns. Under 140 words total. Do not invent figures not given.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 320,
      messages: [
        {
          role: "system",
          content:
            "You are a senior Philippine real estate investment analyst. Write sharp, professional, realistic briefs grounded ONLY in the data provided. Never exaggerate or promise returns. Keep it concise.",
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
