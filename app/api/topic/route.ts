import { NextResponse } from "next/server";
import OpenAI from "openai";

export const dynamic = "force-dynamic";

type WritingType = "lettre" | "opinion" | "creative" | "argumentatif";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    "la place de l'intelligence artificielle dans la vie quotidienne",
    "les transports publics dans les grandes villes",
    "l'importance de protéger l'environnement au quotidien",
  ],
  creative: [
    "une journée ordinaire qui devient étrange",
    "une rencontre inattendue dans le métro",
    "un objet perdu qui change tout",
    "un message reçu au mauvais moment",
    "un trajet banal qui devient mémorable",
    "un matin où tout semble normal, puis quelque chose bascule",
  ],
  argumentatif: [
    "faut-il limiter l'usage du téléphone dans les lieux publics",
    "les villes devraient-elles réduire la place de la voiture",
    "l'intelligence artificielle est-elle bénéfique à l'éducation",
    "faut-il interdire les réseaux sociaux aux jeunes enfants",
    "les transports publics devraient-ils être gratuits",
    "le travail à distance est-il meilleur que le travail en présentiel",
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

    if (!writingType || !fallbackTopics[writingType]) {
      return NextResponse.json({
        topic: "les réseaux sociaux et la communication",
        source: "fallback",
      });
    }

    if (writingType === "lettre") {
      return NextResponse.json({
        topic: fallbackFor("lettre"),
        source: "fallback",
      });
    }

    const prompts: Record<Exclude<WritingType, "lettre">, string> = {
      opinion:
        "Donne un seul thème clair, actuel et accessible pour un texte d'opinion en français niveau B2. Réponds uniquement avec le thème, sans phrase complète, sans explication, sans liste, sans guillemets.",
      creative:
        "Donne un seul thème narratif inspirant pour une courte histoire en français niveau B2. Réponds uniquement avec le thème, sans phrase complète, sans explication, sans liste, sans guillemets.",
      argumentatif:
        "Donne un seul sujet clair et discutable pour un essai argumentatif en français niveau B2/C1. Réponds uniquement avec le sujet, sans phrase complète, sans explication, sans liste, sans guillemets.",
    };

    const response = await client.responses.create({
      model: "gpt-5.2",
      instructions:
        "Tu génères uniquement un sujet très court en français. Aucun commentaire. Aucune introduction. Aucun numéro. Aucun emoji.",
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