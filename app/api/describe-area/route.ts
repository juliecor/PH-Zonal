import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing OPENAI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const geoLabel = String(body.geoLabel ?? "").trim();
    const city = String(body.city ?? "").trim();
    const barangay = String(body.barangay ?? "").trim();
    const province = String(body.province ?? "").trim();
    const classification = String(body.classification ?? "").trim();
    const zonalValue = String(body.zonalValue ?? "").trim();
    const poiCounts = body.poiCounts ?? null;

    const locationBits = [barangay, city, province].filter(Boolean).join(", ");
    const loc = locationBits || geoLabel || "the selected area";

    // Derive location profile and constraints for accuracy
    const totalPOI = poiCounts && typeof poiCounts === "object"
      ? Object.values(poiCounts).reduce((a: number, b: any) => a + (typeof b === "number" ? b : 0), 0)
      : 0;
    const isUpland = /(upper|mountain|highland|hills?|bukid|sapa|sitio|upland|elevation)/i.test(barangay);
    const isUrban = /(poblacion|downtown|central|centrum|district|proper|market|business|commercial)/i.test(barangay) || /(city proper|city center|district)/i.test(city);
    const density = totalPOI >= 25 ? "high" : totalPOI >= 10 ? "medium" : "low";
    const isAgricultural = /agri|agricultural|farm/i.test(classification);

    const allowedForUpland = [
      "Sari-sari / Micro-retail",
      "Basic food stall / Carinderia",
      "Fresh produce trading (vegetables/fruits/eggs)",
      "Feed, seed, and farm supply",
      "Water refilling / Purified ice",
      "Motorcycle repair / vulcanizing",
      "Small hardware & construction supplies",
      "Rice retailing",
      "Mobile load, e-wallet and remittance",
      "Laundry services",
    ];
    const avoidUrban = [
      "Malls and large retail chains",
      "Big-brand cafés and fine dining",
      "Co-working / BPO centers",
      "Nightlife bars and clubs",
      "Large format supermarkets",
    ];

    const poiAnalysis = (() => {
      if (!poiCounts || typeof poiCounts !== "object") return "";
      const entries = Object.entries(poiCounts)
        .filter(([, v]) => typeof v === "number" && (v as number) > 0)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      return entries ? `Infrastructure: ${entries}` : "";
    })();

    const userPrompt = `
LOCATION PROFILE & BUSINESS OPPORTUNITY ANALYSIS

Location: ${loc}
Classification: ${classification || "Unclassified"}
Zonal Value: ₱${zonalValue}/sqm (${zonalValue ? "assessed" : "not appraised"})
${poiAnalysis}

 LOCATION TYPE:
 - Upland/Mountain: ${isUpland ? "YES" : "NO"}
 - Urban/Poblacion: ${isUrban ? "YES" : "NO"}
 - POI Density: ${density.toUpperCase()}
 - Agricultural Zoning: ${isAgricultural ? "YES" : "NO"}

 STRICT RULES FOR RECOMMENDATIONS:
 ${isUpland || isAgricultural || density === "low" ? `- Allowed examples only: ${allowedForUpland.join("; ")}
 - Avoid: ${avoidUrban.join("; ")}
 - Emphasize essentials, agriculture, and community services.
 - Do NOT mention malls, big-brand cafés, fine dining, or nightlife.` : `- Urban context allowed; still be realistic to density and access.`}

---

PROVIDE ANALYSIS IN BULLET-POINT FORMAT ONLY:

📍 Location Overview:
• [Key characteristic of this area]
• [Economic/residential profile]

💼 Key Business Opportunities (must follow the STRICT RULES above):
• [Business Type 1] – [why it works here]
• [Business Type 2] – [why it works here]
• [Business Type 3] – [why it works here]

⭐ Overall Assessment:
• [Best business type for this location]
• [Primary success factor]

---

TONE: Professional, bullet-point only (no paragraphs).
SPECIFIC TO: THIS location characteristics.
LENGTH: Keep entire response under 200 words.
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 250,
      messages: [
        {
          role: "system",
          content:
            "You are a Philippine real estate and business analyst. Provide location-specific business assessments USING BULLET POINTS ONLY. Use professional format with emojis and bullets. No paragraphs. Be practical and realistic.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const cleaned = String(raw).replace(/\s+/g, " ").trim();

    return NextResponse.json({ ok: true, text: cleaned });
  } catch (e: any) {
    console.error("describe-area error:", e);   
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
