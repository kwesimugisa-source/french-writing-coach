import { NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

function safeStr(v: any, max = 4000) {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length > max ? t.slice(0, max) : t;
}

function safeArr(v: any) {
  return Array.isArray(v) ? v : [];
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const input: any = await req.json();

    const mode = safeStr(input.mode || "");
    const pressureMode = !!input.pressureMode;
    const templateId = safeStr(input.templateId || "");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Clé API OpenAI manquante." },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    // ---- Build compact payload ----
    const compact: any = {
      pressureMode: pressureMode ? "ON" : "OFF",
      history: [],
      drillSessions: [],
      templates: [],
    };

    for (const h of safeArr(input.history)) {
      compact.history.push({
        dateKey: safeStr(h.dateKey, 20),
        tone: safeStr(h.tone, 20),
        promptTitle: safeStr(h.promptTitle, 120),
        wordCount: Number(h.wordCount || 0),
        text: safeStr(h.text, 1500),
        corrections: safeStr(h.corrections || h.feedback?.corrections, 1200),
        tefScore: safeStr(h.tefScore || h.feedback?.tefScore, 40),
      });
      if (compact.history.length >= 12) break;
    }

    for (const s of safeArr(input.drillSessions)) {
      compact.drillSessions.push({
        dateKey: safeStr(s.dateKey, 20),
        tone: safeStr(s.tone, 20),
        score10: Number(s.score10 || 0),
        areaStats: s.areaStats || {},
        wrongItems: safeArr(s.wrongItems).slice(0, 15),
      });
      if (compact.drillSessions.length >= 20) break;
    }

    for (const t of safeArr(input.templates)) {
      compact.templates.push({
        id: safeStr(t.id, 60),
        pillar: safeStr(t.pillar, 80),
        title: safeStr(t.title, 80),
        outputType: safeStr(t.outputType, 30),
      });
    }

    const system = `
You are a strict JSON generator for a French TEF writing coach.
Return ONLY valid JSON. No markdown. No extra text.
- Always include "title" and "context".
- MCQs must be unambiguous.
- Pressure Mode = harder distractors.
- Keep explanations short.
`;

    // ---- TEMPLATE MODE ----
    if (mode === "generate_template") {
      if (!templateId) {
        return NextResponse.json(
          { error: "templateId manquant." },
          { status: 400 }
        );
      }

      const user = `
MODE: generate_template
templateId: ${templateId}

DATA:
${JSON.stringify(compact)}

Generate 6-10 exercises.
`;

      const res = await client.responses.create({
        model: "gpt-4.1-mini",
        temperature: 0.5,
        instructions: system,
        input: user,
      });

      let parsed: any;
      try {
        parsed = JSON.parse(res.output_text || "");
      } catch {
        parsed = extractJsonObject(res.output_text || "");
      }

      if (!parsed) {
        return NextResponse.json(
          { error: "Réponse IA invalide." },
          { status: 500 }
        );
      }

      if (!Array.isArray(parsed.generatedExercises)) {
        parsed.generatedExercises = [];
      }

      return NextResponse.json(parsed);
    }

    // ---- ANALYZE MODE ----
    const user = `
MODE: analyze

DATA:
${JSON.stringify(compact)}

Return:
- estimatedLevel
- summary
- pillarScores (6)
- frequentErrors (4-8)
- c1PushPhrases (4-8)
- generatedExercises (6-10)
`;

    const res = await client.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0.45,
      instructions: system,
      input: user,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(res.output_text || "");
    } catch {
      parsed = extractJsonObject(res.output_text || "");
    }

    if (!parsed) {
      return NextResponse.json(
        { error: "Réponse IA invalide." },
        { status: 500 }
      );
    }

    // Hard defaults
    parsed.estimatedLevel = parsed.estimatedLevel || "B2";
    parsed.summary = parsed.summary || "";
    parsed.pillarScores = safeArr(parsed.pillarScores);
    parsed.frequentErrors = safeArr(parsed.frequentErrors);
    parsed.c1PushPhrases = safeArr(parsed.c1PushPhrases);
    parsed.generatedExercises = safeArr(parsed.generatedExercises);

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("deep-analysis error:", e);

    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 }
    );
  }
}