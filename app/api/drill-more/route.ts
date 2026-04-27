import { NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const data: any = await req.json();

    const text = String(data?.text ?? "").trim();
    const tone = String(data?.tone ?? "").trim();
    const category = String(data?.category ?? "").trim();

    if (!text || !category) {
      return NextResponse.json({
        error:
          "Texte ou catégorie manquant pour générer des exercices supplémentaires.",
        exercises: [],
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        error: "Clé API OpenAI manquante sur le serveur (OPENAI_API_KEY).",
        exercises: [],
      });
    }

    const client = new OpenAI({ apiKey });

    const system =
      "Tu es un professeur de français (B1–C1). Tu génères des exercices QCM clairs, sans ambiguïté, avec une seule bonne réponse.";

    let user =
  `Crée 8 exercices QCM ciblés pour corriger ce problème précis : "${category}".\n\n` +
  `Texte original de l'apprenant :\n${text}\n\n` +
  `Ton demandé : ${tone || "non précisé"}\n\n` +
  `Objectif : les exercices doivent attaquer directement cette faiblesse, pas être génériques.\n` +
  `Utilise des pièges réalistes basés sur les erreurs probables de l'apprenant.\n\n` +
  `Règles OBLIGATOIRES:\n` +
  `- Chaque exercice DOIT avoir un contexte clair (1–2 phrases) + une phrase à compléter.\n` +
  `- Le contexte doit rendre UNE SEULE réponse possible.\n` +
  `- Utilise ____ dans la phrase.\n` +
  `- 3 choix, UNE seule bonne réponse.\n` +
  `- Les mauvais choix doivent ressembler aux erreurs que l'apprenant fait ou pourrait faire.\n` +
  `- Fournis une explication courte.\n` +
  `- Retourne UNIQUEMENT du JSON valide.\n\n` +
  `Format JSON EXACT:\n` +
  `{\n` +
  `  "exercises": [\n` +
  `    {\n` +
  `      "title": "Titre court",\n` +
  `      "context": "1–2 phrases",\n` +
  `      "q": "Phrase avec ____",\n` +
  `      "choices": ["...", "...", "..."],\n` +
  `      "answer": "...",\n` +
  `      "explanation": "...",\n` +
  `      "category": "${category}",\n` +
  `      "type": "mcq"\n` +
  `    }\n` +
  `  ]\n` +
  `}`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      instructions: system,
      input: user,
    });

    const content = response.output_text?.trim();

    if (!content) {
      return NextResponse.json({
        error: "Réponse vide du modèle.",
        exercises: [],
      });
    }

    let parsed: any;

    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({
        error: "Le modèle n’a pas retourné le JSON attendu.",
        model_output: content,
        exercises: [],
      });
    }

    if (!parsed?.exercises || !Array.isArray(parsed.exercises)) {
      return NextResponse.json({
        error: "Le modèle n’a pas retourné le JSON attendu.",
        model_output: content,
        exercises: [],
      });
    }

    const clean: any[] = [];

    for (const ex of parsed.exercises) {
      if (!ex || typeof ex !== "object") continue;

      const title = String(ex.title ?? "").trim();
      const context = String(ex.context ?? "").trim();
      const q = String(ex.q ?? "").trim();
      const choices = ex.choices;
      const answer = String(ex.answer ?? "").trim();
      const explanation = String(ex.explanation ?? "").trim();

      if (!context || !q || !answer || !explanation) continue;
      if (!Array.isArray(choices) || choices.length < 3) continue;

      const choicesNorm = choices.map((c: any) => String(c).trim());

      if (!choicesNorm.includes(answer)) continue;

      clean.push({
        title: title || category,
        context,
        q,
        choices: choicesNorm,
        answer,
        explanation,
        category,
        type: "mcq",
      });
    }

    if (clean.length === 0) {
      return NextResponse.json({
        error:
          "Aucun exercice valide n’a pu être extrait de la réponse du modèle.",
        model_output: content,
        exercises: [],
      });
    }

    return NextResponse.json({
      error: null,
      exercises: clean,
    });
  } catch (error) {
    console.error("drill-more route error:", error);

    return NextResponse.json({
      error: "Erreur serveur.",
      exercises: [],
    });
  }
}