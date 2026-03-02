import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function normalizeIdeas(text: string): string[] {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[•\-\d.\)]\s*/, "").trim())
    .filter(Boolean);
  // If there's a single paragraph, try splitting by semicolons
  if (lines.length <= 1) {
    const parts = text
      .split(/;|\u2022|\n|,\s(?=[A-Z])/)
      .map((p) => p.replace(/^\s*[•\-\d.\)]\s*/, "").trim())
      .filter(Boolean);
    return parts.slice(0, 6);
  }
  return lines.slice(0, 6);
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
Suggest 4-6 specific, location-aware business uses suited for this Philippine area.
Location: ${loc}
Classification: ${classification || "-"}
Zonal value (per sqm): ${zonalValuePerSqm || "-"}
${poiText}
   Context hints: ${contextHints}
Guidelines:
- Be realistic for the Philippines context and the given amenities.
- Favor short, punchy items (2–6 words each).
- Avoid duplicates, avoid generic fluff like "retail" alone.
- Output as simple bullet lines (no numbering).
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "You are a Philippine real estate assistant. Propose concise, practical business uses for the local context.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const ideas = normalizeIdeas(String(raw));

    if (!ideas.length) {
      return NextResponse.json({ ok: false, error: "No ideas generated" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ideas });
  } catch (e: any) {
    console.error("ideal-business error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
