import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function limitTo50Words(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 50) return text.trim();
  return words.slice(0, 50).join(" ").replace(/[,\s]+$/, "") + "…";
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

    const geoLabel = String(body.geoLabel ?? "").trim();
    const city = String(body.city ?? "").trim();
    const barangay = String(body.barangay ?? "").trim();
    const province = String(body.province ?? "").trim();
    const classification = String(body.classification ?? "").trim();
    const zonalValue = String(body.zonalValue ?? "").trim();
    const poiCounts = body.poiCounts ?? null;

    const locationBits = [barangay, city, province].filter(Boolean).join(", ");
    const loc = locationBits || geoLabel || "the selected area";

    const poiText =
      poiCounts && typeof poiCounts === "object"
        ? `POI counts within 1.5km: ${Object.entries(poiCounts)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}.`
        : "";

    const userPrompt = `
Write ONE short description (max 50 words) about what living/doing business here feels like.
Location: ${loc}
Classification: ${classification || "-"}
Zonal value (per sqm): ${zonalValue || "-"}
${poiText}
Avoid fake facts. If uncertain, use cautious language. No bullet points.
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content:
            "You write concise Philippine neighborhood descriptions. Output a single paragraph, maximum 50 words.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const cleaned = limitTo50Words(String(raw).replace(/\s+/g, " ").trim());

    return NextResponse.json({ ok: true, text: cleaned });
  } catch (e: any) {
    console.error("describe-area error:", e);   
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
