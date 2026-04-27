import { NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

function summarizeHistoryPatterns(history: any[]) {
  return history.slice(0, 10).map((h, idx) => ({
    entry: idx + 1,
    promptTitle: h?.promptTitle || "",
    text: String(h?.text || "").slice(0, 800),
    corrections: String(h?.feedback?.corrections || h?.corrections || "").slice(
      0,
      1200
    ),
  }));
}

function fallbackExercises() {
  return [
    {
      id: "fallback-1",
      type: "mcq",
      title: "Révision ciblée",
      context: "Exercice de secours généré automatiquement.",
      prompt: "Choisis la phrase la plus naturelle.",
      instruction: "Une seule réponse est correcte.",
      choices: [
        "Je voudrais modifier mon forfait.",
        "Je voudrais de modifier mon forfait.",
        "Je voudrais modification mon forfait.",
      ],
      answer: "Je voudrais modifier mon forfait.",
      explanation:
        "Après « vouloir », on utilise l’infinitif directement : « vouloir modifier ».",
    },
  ];
}

export async function POST(req: Request) {
  try {
    const data: any = await req.json();

    const text = String(data?.text ?? "");
    const tone = String(data?.tone ?? "");
    const corrections = data?.corrections ?? "";
    const history = Array.isArray(data?.history) ? data.history : [];
    const historyPatterns = summarizeHistoryPatterns(history);

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        categories: [
          {
            name: "Révision ciblée",
            description: "Exercices de secours basés sur une erreur fréquente.",
            examples: [],
            tips: "",
          },
        ],
        exercises: fallbackExercises(),
      });
    }

    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0.35,
      max_output_tokens: 1800,
      instructions:
        "Tu es un professeur de français TEF. Réponds uniquement en JSON valide, sans markdown.",
      input:
        `Réponds uniquement en JSON valide.\n\n` +
        `Analyse les erreurs récurrentes de l'apprenant et génère des exercices ciblés.\n\n` +
        `Texte actuel:\n${text}\n\n` +
        `Registre demandé: ${tone}\n\n` +
        `Corrections actuelles:\n${JSON.stringify(corrections)}\n\n` +
        `Historique récent:\n${JSON.stringify(historyPatterns)}\n\n` +
        `Objectif:\n` +
        `- Ne génère PAS d’exercices génériques.\n` +
        `- Les exercices doivent venir des vraies erreurs du texte ou de l’historique.\n` +
        `- Niveau visé: B2 vers C1.\n` +
        `- Évite les phrases trop basiques sauf si l’erreur exacte est présente.\n\n` +
        `Retourne exactement ce JSON:\n` +
        `{
  "categories": [
    {
      "name": "string",
      "description": "string",
      "examples": ["string"],
      "tips": "string"
    }
  ],
  "exercises": [
    {
      "id": "string",
      "type": "mcq",
      "title": "string",
      "context": "string",
      "prompt": "string",
      "instruction": "Choisis la meilleure réponse.",
      "choices": ["string", "string", "string"],
      "answer": "string",
      "explanation": "string"
    }
  ]
}`,
      text: {
        format: { type: "json_object" },
      },
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      return NextResponse.json({
        categories: [
          {
            name: "Révision ciblée",
            description: "Exercices de secours.",
            examples: [],
            tips: "",
          },
        ],
        exercises: fallbackExercises(),
      });
    }

    const parsed = JSON.parse(raw);

    const categories = Array.isArray(parsed.categories)
      ? parsed.categories
      : [];

    const exercises = Array.isArray(parsed.exercises)
      ? parsed.exercises
      : fallbackExercises();

    return NextResponse.json({
      categories,
      exercises,
    });
  } catch (error) {
    console.error("drill route error:", error);

    return NextResponse.json({
      categories: [
        {
          name: "Révision ciblée",
          description: "Exercices de secours.",
          examples: [],
          tips: "",
        },
      ],
      exercises: fallbackExercises(),
    });
  }
}