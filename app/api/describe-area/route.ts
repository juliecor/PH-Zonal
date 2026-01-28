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
        { ok: false, error: "Missing OPENAI_API_KEY in environment variables." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { lat, lon, label, city, barangay, province, classification, zonalValuePerSqm, poiCounts } = body;

    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      return NextResponse.json({ ok: false, error: "lat/lon required" }, { status: 400 });
    }

    const instructions =
      "Write a short area description for real estate (max 50 words). " +
      "Mention livability and what type of resident it suits. " +
      "Keep it neutral, avoid guarantees, no emojis, no bullet points.";

    // Mao ni ang standard Chat Completion call
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // Mas paspas ug mas barato para sa short descriptions
      messages: [
        { role: "system", content: instructions },
        {
          role: "user",
          content: `Location Context: 
          City: ${city}, Barangay: ${barangay}, Province: ${province}
          Zonal Value: ${zonalValuePerSqm} per sqm
          Classification: ${classification}
          Nearby Points of Interest: ${JSON.stringify(poiCounts)}`
        },
      ],
      max_tokens: 150,
    });

    const text = completion.choices[0]?.message?.content?.trim();

    return NextResponse.json({ 
      ok: true, 
      text: text || "No description generated." 
    });

  } catch (e: any) {
    console.error("describe-area error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}