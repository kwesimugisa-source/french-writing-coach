import { NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

type CorrectionItem = {
  original: string;
  correction: string;
  why: string;
  rule: string;
  severity: "minor" | "medium" | "major";
};

type TefBreakdown = {
  task: number;
  coherence: number;
  lexicon: number;
  grammar: number;
  orthography: number;
  register: number;
  total20: number;
  estimatedLevel: "A2" | "B1" | "B2" | "C1" | "C2";
  confidence: number;
};

function clampInt(value: unknown, min: number, max: number) {
  const n = Number.parseInt(String(value ?? 0), 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function levelRank(level: string) {
  switch (level) {
    case "A2":
      return 1;
    case "B1":
      return 2;
    case "B2":
      return 3;
    case "C1":
      return 4;
    case "C2":
      return 5;
    default:
      return 0;
  }
}

function minLevel(a: TefBreakdown["estimatedLevel"], b: TefBreakdown["estimatedLevel"]) {
  return levelRank(a) <= levelRank(b) ? a : b;
}

function levelFromTotal20(total20: number): TefBreakdown["estimatedLevel"] {
  if (total20 >= 18) return "C2";
  if (total20 >= 15) return "C1";
  if (total20 >= 11) return "B2";
  if (total20 >= 8) return "B1";
  return "A2";
}

function stripJsonFence(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const text = typeof body?.text === "string" ? body.text : "";
    const tone = body?.tone === "informel" ? "informel" : "formel";
    const promptTitle =
  typeof body?.promptTitle === "string" ? body.promptTitle : "";

const promptBody =
  typeof body?.promptBody === "string" ? body.promptBody : "";

    if (!text.trim()) {
      return NextResponse.json({
        error: "Aucun texte n'a été reçu pour l'analyse.",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        error: "Clé API manquante côté serveur (OPENAI_API_KEY).",
      });
    }

    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      instructions: `
Tu es un correcteur expert de français (TEF Canada – production écrite).
Tu dois répondre STRICTEMENT en JSON, sans aucun texte avant ou après.

IMPORTANT (score):
- Tu DOIS appliquer la grille ci-dessous et donner des notes 0–5.
- Tu DOIS calculer total20 = somme des 6 critères (0–30) ramenée sur 20 (arrondi à l'entier).
- Tu DOIS donner estimatedLevel UNIQUEMENT parmi: "A2", "B1", "B2", "C1", "C2".
- Tu DOIS donner confidence entre 0.00 et 1.00.

GRILLE (0–5 chaque critère):
1) task (respect de la consigne + objectifs + longueur + format lettre/message)
2) coherence (structure, paragraphes, enchaînements logiques)
3) lexicon (précision lexicale, variété, collocations naturelles)
4) grammar (contrôle morpho-syntaxe, temps, accords, subordonnées)
5) orthography (orthographe, ponctuation, accents, typographie)
6) register (cohérence du registre: formel/informel; politesse; absence de glissements)

INTERPRÉTATION:
- 5 = C1/C2 solide (contrôle + naturel)
- 4 = B2+ / C1 borderline
- 3 = B2 typique
- 2 = B1
- 1 = A2
- 0 = hors-sujet / très insuffisant

SORTIE JSON exactement:
{
  "corrections": [
    {
      "original": "string",
      "correction": "string",
      "why": "string",
      "rule": "string",
      "severity": "minor|medium|major"
    }
  ],
  "natural": "string",
  "tefNotes": "string",
  "tefScore": "string",
  "tefBreakdown": {
    "task": number,
    "coherence": number,
    "lexicon": number,
    "grammar": number,
    "orthography": number,
    "register": number,
    "total20": number,
    "estimatedLevel": "A2|B1|B2|C1|C2",
    "confidence": number
  }
}

RÈGLE CRITIQUE POUR "natural":
- Tu DOIS réécrire le texte COMPLET, pas un résumé/critique.
- INTERDIT: "Le texte présente..." / "Ce texte contient..." / "Il est important/essentiel..." / "Le message..."
- Tu dois conserver le même sens et tous les détails (noms, dates, chiffres, demandes).
- Tu améliores: naturel, registre, grammaire, connecteurs, lexique.
- Format exact dans UNE seule chaîne:
"(a) Version Québec\\n<texte complet réécrit>\\n\\n(b) Version France\\n<texte complet réécrit>"
`,
      input:
  `Réponds uniquement en JSON valide.\n\n` +
  `Sujet demandé : ${promptTitle}\n${promptBody}\n\n` +
  `Registre demandé : ${tone}\n\n` +
  `Texte de l'apprenant (à corriger ET à réécrire intégralement) :\n\n${text}`,
      text: {
        format: {
          type: "json_object",
        },
      },
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      return NextResponse.json({
        error: "Réponse vide ou inattendue du modèle.",
      });
    }

    let parsed: any;

    try {
      parsed = JSON.parse(stripJsonFence(raw));
    } catch {
      return NextResponse.json({
        error: "La réponse du modèle n'était pas un JSON valide.",
        debugRaw: raw,
      });
    }

    // Guard: tefNotes must not be numeric-only, including comma-separated scores like "2, 3, 2, 2, 4, 3"
    if (typeof parsed.tefNotes === "string") {
      const notes = parsed.tefNotes.trim();

      if (notes !== "" && /^[0-9,\s]+$/.test(notes)) {
        parsed.tefNotes =
          "Structure: annonce clairement l’objectif dès la première phrase.\n" +
          "Cohérence: ajoute 2–3 connecteurs de logique (cependant, dès lors, en revanche).\n" +
          "Temps: stabilise imparfait vs passé composé (habitude vs action ponctuelle).\n" +
          "Registre: reste cohérent (formel/informel) du début à la fin.\n" +
          "Lexique: remplace les verbes génériques (faire, avoir) par des verbes précis.";
      }
    }

    // Guard: natural must be full rewrite, not a critique/summary
    if (typeof parsed.natural === "string") {
      const natural = parsed.natural.trim();

      const looksLikeCritique =
        /\b(Le texte|Ce texte|Il est important|Il est essentiel|Le message)\b/i.test(
          natural
        );

      const hasRequiredMarkers =
        natural.includes("(a) Version Québec") &&
        natural.includes("(b) Version France");

      if (natural === "" || looksLikeCritique || !hasRequiredMarkers) {
        parsed.natural =
          "(a) Version Québec\n" +
          "[ERREUR: la sortie 'natural' doit être une réécriture complète du texte, pas un résumé. Relance l’analyse.]\n\n" +
          "(b) Version France\n" +
          "[ERREUR: la sortie 'natural' doit être une réécriture complète du texte, pas un résumé. Relance l’analyse.]";
      }
    } else {
      parsed.natural =
        "(a) Version Québec\n[ERREUR: réécriture manquante. Relance l’analyse.]\n\n" +
        "(b) Version France\n[ERREUR: réécriture manquante. Relance l’analyse.]";
    }

    // Ensure corrections is always an array
    const corrections: CorrectionItem[] = Array.isArray(parsed.corrections)
      ? parsed.corrections
      : [];

    // Deterministic scoring — fixed order
    const bd = parsed.tefBreakdown ?? {};

    const task = clampInt(bd.task, 0, 5);
    const coherence = clampInt(bd.coherence, 0, 5);
    const lexicon = clampInt(bd.lexicon, 0, 5);
    const grammar = clampInt(bd.grammar, 0, 5);
    const orthography = clampInt(bd.orthography, 0, 5);
    const register = clampInt(bd.register, 0, 5);

    const total30 = task + coherence + lexicon + grammar + orthography + register;
    const total20 = Math.round((total30 / 30) * 20);

    let estimated = levelFromTotal20(total20);

    // TEF ceiling logic — must happen AFTER total20 and criteria are calculated
    if (task <= 2) {
      estimated = minLevel(estimated, "B1");
    }

    if (grammar <= 2 || register <= 2) {
      estimated = minLevel(estimated, "B1");
    }

    if (coherence <= 2) {
      estimated = minLevel(estimated, "B1");
    }

    if (estimated === "C1") {
      const minCrit = Math.min(
        task,
        coherence,
        lexicon,
        grammar,
        orthography,
        register
      );

      if (minCrit < 4) {
        estimated = "B2";
      }
    }

    if (estimated === "C2") {
      const minCrit = Math.min(
        task,
        coherence,
        lexicon,
        grammar,
        orthography,
        register
      );

      if (minCrit < 5) {
        estimated = "C1";
      }
    }

    const minCrit = Math.min(
      task,
      coherence,
      lexicon,
      grammar,
      orthography,
      register
    );

    const spread = total30 - 6 * minCrit;

    let confidence = 0.45 + (total20 / 20) * 0.45 - (spread / 30) * 0.25;
    if (confidence < 0.1) confidence = 0.1;
    if (confidence > 0.95) confidence = 0.95;

    return NextResponse.json({
      corrections,
      natural: parsed.natural ?? "",
      tefNotes: parsed.tefNotes ?? "",
      tefScore: estimated,
      tefBreakdown: {
        task,
        coherence,
        lexicon,
        grammar,
        orthography,
        register,
        total20,
        estimatedLevel: estimated,
        confidence: Number(confidence.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("analyze route error:", error);

    return NextResponse.json({
      error: "Impossible d'analyser le texte. Réessaie.",
    });
  }
}