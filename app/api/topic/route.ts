import { NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

type WritingType = "lettre" | "opinion" | "creative" | "argumentatif";
type WritingLevel = "B1" | "B2" | "C1";

const fallbackTopics: Record<WritingType, string[]> = {
  lettre: [
    "demander un remboursement après un achat défectueux",
    "remercier un ami pour son aide pendant un déménagement",
    "écrire à la mairie pour proposer une amélioration dans votre quartier",
  ],
  opinion: [
    "les réseaux sociaux et la communication",
    "le télétravail",
    "les téléphones intelligents à l'école",
  ],
  creative: [
    "une journée ordinaire qui devient étrange",
    "une rencontre inattendue dans le métro",
    "un objet perdu qui change tout",
  ],
  argumentatif: [
    "faut-il limiter l'usage du téléphone dans les lieux publics",
    "les villes devraient-elles réduire la place de la voiture",
    "les transports publics devraient-ils être gratuits",
  ],
};

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cleanTopic(text: string): string {
  return text
    .replace(/^["'«»\-\s]+|["'«»\-\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackFor(type: WritingType): string {
  return randomItem(fallbackTopics[type]);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const writingType = body?.writingType as WritingType | undefined;
    const level = body?.level as WritingLevel | undefined;

    const safeLevel: WritingLevel =
      level === "B1" || level === "C1" ? level : "B2";

    if (!writingType || !fallbackTopics[writingType]) {
      return NextResponse.json({
        topic: "les réseaux sociaux et la communication",
        source: "fallback",
      });
    }

    // keep lettre stable (no AI)
    if (writingType === "lettre") {
      return NextResponse.json({
        topic: fallbackFor("lettre"),
        source: "fallback",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        topic: fallbackFor(writingType),
        source: "fallback",
      });
    }

    const client = new OpenAI({ apiKey });

    const prompts: Record<Exclude<WritingType, "lettre">, string> = {
      opinion:
        `Donne un seul thème clair pour un texte d'opinion en français niveau ${safeLevel}. ` +
        `B1: sujet simple du quotidien. ` +
        `B2: sujet actuel accessible. ` +
        `C1: sujet nuancé, social ou culturel. ` +
        `Réponds uniquement avec le thème, sans phrase, sans explication.`,

      creative:
        `Donne un seul thème narratif pour une histoire en français niveau ${safeLevel}. ` +
        `B1: simple et concret. ` +
        `B2: un peu original. ` +
        `C1: plus subtil ou psychologique. ` +
        `Réponds uniquement avec le thème, sans phrase, sans explication.`,

      argumentatif:
        `Donne un seul sujet pour un essai argumentatif en français niveau ${safeLevel}. ` +
        `B1: question simple. ` +
        `B2: sujet de société accessible. ` +
        `C1: sujet complexe ou abstrait. ` +
        `Réponds uniquement avec le sujet, sans phrase, sans explication.`,
    };

    const response = await client.responses.create({
      model: "gpt-4.1-mini", // stable + fast
      instructions:
        "Tu génères uniquement un sujet très court en français. Aucun commentaire.",
      input: prompts[writingType as Exclude<WritingType, "lettre">],
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      return NextResponse.json({
        topic: fallbackFor(writingType),
        source: "fallback",
      });
    }

    const topic = cleanTopic(raw);

    if (!topic) {
      return NextResponse.json({
        topic: fallbackFor(writingType),
        source: "fallback",
      });
    }

    return NextResponse.json({
      topic,
      source: "ai",
    });
  } catch (error) {
    console.error("topic route error:", error);

    return NextResponse.json({
      topic: "les réseaux sociaux et la communication",
      source: "fallback",
    });
  }
}