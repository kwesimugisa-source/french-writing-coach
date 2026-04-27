"use client";
import { useRouter } from "next/navigation";
import { Brain } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  Edit3,
  RefreshCw,
  Info,
  Loader2,
  AlertTriangle,
  Clock,
  Lock,
  Unlock,
  History,
  PlusCircle,
  XCircle, // 👈 added for wrong answers
} from "lucide-react";

/*
French Writing Coach (TEF-focused)
---------------------------------
- Daily prompt (formel / informel)
- Word counter + target range
- Exam mode (30 min timer + lock after submit)
- History of past writings (localStorage)
- Drill generator + PDF export
*/

// --- extract min/max word targets from prompt text like "180–220 mots" ---
function getWordTargetRange(body: string) {
  const match = body.match(/(\d+)\s*[-–]\s*(\d+)\s*mots/i);
  if (!match) return null;
  return {
    min: parseInt(match[1], 10),
    max: parseInt(match[2], 10),
  };
}

// count words in user's text
function countWords(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

// --- utility: generate today's prompt (expanded bank) ---
function getDailyPrompt(
  dateKey: string,
  tone: "formel" | "informel",
  writingType: WritingType = "lettre",
  topic?: string
) {
  const formalPrompts = [
    {
      title: "Plainte logement – Chauffage défectueux",
      body:
        "Vous vivez dans un appartement meublé et le chauffage ne fonctionne plus depuis trois jours. Expliquez l’impact sur votre confort, demandez une intervention urgente et proposez une alternative temporaire. 180–220 mots.",
    },
    {
      title: "Réclamation – Facturation incorrecte",
      body:
        "Vous constatez qu'une facture mensuelle comporte des frais que vous n’avez jamais utilisés. Écrivez au service client pour demander des explications et un ajustement immédiat. 170–210 mots.",
    },
    {
      title: "Demande d'information – Carte de résident",
      body:
        "Vous préparez une demande de carte de résident temporaire. Rédigez un courriel à l'organisme responsable afin d’obtenir des précisions sur les documents nécessaires et les délais de traitement. 160–200 mots.",
    },
    {
      title: "Lettre de motivation – Emploi administratif",
      body:
        "Vous postulez à un poste d’assistant administratif dans une petite entreprise. Présentez vos compétences, vos expériences antérieures et expliquez pourquoi vous êtes un bon candidat pour ce poste. 180–220 mots.",
    },
    {
      title: "Signalement – Nuisances sonores",
      body:
        "Des travaux ont lieu très tôt le matin près de votre domicile et perturbent votre sommeil. Rédigez un message à la mairie ou au service municipal pour signaler la situation et demander une intervention. 170–210 mots.",
    },
    {
      title: "Demande – Report d’échéance",
      body:
        "Vous n’êtes pas en mesure de respecter une échéance administrative importante. Expliquez votre situation, justifiez votre retard et demandez un délai supplémentaire de manière polie. 150–190 mots.",
    },
    {
      title: "Plainte – Service non conforme",
      body:
        "Vous avez acheté un service (cours, réparation, atelier, etc.) qui ne correspondait pas à ce qui était annoncé. Expliquez le problème en détail et demandez une compensation ou un geste commercial. 170–210 mots.",
    },
    {
      title: "Réservation – Location de salle",
      body:
        "Vous souhaitez louer une salle pour un événement (réunion, fête, atelier). Présentez vos besoins, indiquez la date, le nombre de personnes et demandez les tarifs et conditions. 150–180 mots.",
    },
    {
      title: "Réclamation – Livraison en retard",
      body:
        "Une commande importante est arrivée avec une semaine de retard et cela vous a causé des problèmes d’organisation. Écrivez au service de livraison pour demander un dédommagement. 160–200 mots.",
    },
    {
      title: "Plainte – Propreté insuffisante",
      body:
        "Vous séjournez dans un logement temporaire et constatez des problèmes d’hygiène (salle de bain sale, literie douteuse, etc.). Décrivez les problèmes et demandez une intervention immédiate ou un changement de chambre. 170–210 mots.",
    },
    {
      title: "Demande – Renseignements sur une formation",
      body:
        "Vous souhaitez obtenir des renseignements sur une formation professionnelle (durée, contenu, conditions d’admission). Posez vos questions clairement et indiquez vos objectifs. 160–200 mots.",
    },
    {
      title: "Signalement – Problème de sécurité",
      body:
        "Un équipement (ascenseur, escalier, porte d’accès, éclairage) semble dangereux dans votre immeuble. Rédigez une plainte formelle au gestionnaire pour décrire la situation et demander une intervention. 170–210 mots.",
    },
    {
      title: "Demande – Restitution de dépôt de garantie",
      body:
        "Vous avez quitté un logement depuis un mois mais vous n’avez toujours pas reçu votre dépôt de garantie. Demandez une clarification sur la situation et un remboursement rapide. 160–200 mots.",
    },
    {
      title: "Plainte – Service à la clientèle",
      body:
        "Vous avez reçu un mauvais service lors d’une visite en magasin (attente, attitude du personnel, erreur). Décrivez la situation et demandez des mesures correctives. 160–200 mots.",
    },
    {
      title: "Plainte – Chauffage collectif insuffisant",
      body:
        "Le chauffage collectif de votre immeuble est insuffisant et plusieurs résidents ont froid. Expliquez les conséquences au quotidien et demandez une intervention urgente. 180–220 mots.",
    },
    {
      title: "Demande – Modification de contrat",
      body:
        "Vous souhaitez modifier un contrat existant (téléphonie, assurance, abonnement). Expliquez les raisons de votre demande, les changements souhaités et proposez une solution raisonnable. 160–200 mots.",
    },
    {
      title: "Signalement – Dysfonctionnement du transport public",
      body:
        "Un problème récurrent affecte votre ligne de transport (retards fréquents, pannes, surpopulation). Rédigez un courriel au service de transport pour décrire la situation et proposer des améliorations. 160–200 mots.",
    },
    {
      title: "Réclamation – Produit endommagé",
      body:
        "Vous recevez un produit abîmé malgré une livraison en apparence correcte. Expliquez le problème, joignez des détails concrets (sans photo) et demandez un échange ou un remboursement. 160–200 mots.",
    },
    {
      title: "Demande – Intervention technique dans le logement",
      body:
        "Un appareil fourni par votre propriétaire (frigo, four, laveuse, climatisation) ne fonctionne plus. Décrivez le problème, indiquez depuis quand il dure et demandez une réparation ou un remplacement. 160–200 mots.",
    },
    {
      title: "Proposition – Activité communautaire",
      body:
        "Vous proposez la création d’une nouvelle activité dans un centre communautaire (atelier, club, cours). Présentez l’idée, ses avantages pour les participants et votre motivation à y participer. 170–210 mots.",
    },
  ];

  const informalPrompts = [
    {
      title: "Raconter une mauvaise journée",
      body:
        "Raconte à un ami une journée particulièrement compliquée (transport, météo, travail, études). Décris ce qui s’est passé, ce que tu as ressenti et comment tu as fini la journée. 140–170 mots.",
    },
    {
      title: "Invitation – Sortie du week-end",
      body:
        "Invite un ami à une activité ce week-end (cinéma, promenade, café, événement). Explique ce que tu proposes, pourquoi tu y penses et quel serait le programme. 130–170 mots.",
    },
    {
      title: "Conseil à un ami",
      body:
        "Un ami traverse une période compliquée et t’a demandé conseil. Raconte la situation brièvement et propose-lui des idées pour aller mieux. 130–170 mots.",
    },
    {
      title: "Annonce d’une bonne nouvelle",
      body:
        "Annonce une bonne nouvelle à quelqu’un que tu apprécies (travail, réussite d’examen, projet personnel). Partage ton enthousiasme et explique ce que cela change pour toi. 130–170 mots.",
    },
    {
      title: "Raconter une expérience gênante",
      body:
        "Explique à ton ami un moment embarrassant mais drôle qui t’est arrivé récemment (au travail, dans les transports, à un rendez-vous). 130–170 mots.",
    },
    {
      title: "Demande de service à un ami",
      body:
        "Demande un petit service à un ami (prêt d’objet, aide pour un déménagement, révision d’un texte). Explique pourquoi tu as besoin d’aide et montre que tu apprécies son soutien. 120–160 mots.",
    },
    {
      title: "Partager un changement de vie",
      body:
        "Explique à un ami un changement important dans ta vie (nouveau boulot, déménagement, relation, projet d’études). Raconte ce qui t’inquiète et ce qui t’enthousiasme. 140–180 mots.",
    },
    {
      title: "Répondre à un message stressant",
      body:
        "Ton ami t’a envoyé un message pour te raconter une situation très stressante. Réponds-lui en le rassurant, en montrant que tu comprends et en proposant une piste de solution. 130–170 mots.",
    },
    {
      title: "Proposer un projet commun",
      body:
        "Propose à ton ami(e) un nouveau projet à faire ensemble (voyage, défi sportif, apprentissage d’une langue, projet artistique). Explique pourquoi ce serait une bonne idée pour vous deux. 130–170 mots.",
    },
    {
      title: "Raconter un rêve",
      body:
        "Raconte à un ami un rêve étrange ou drôle que tu as fait récemment. Décris les détails et ta réaction au réveil. 120–160 mots.",
    },
    {
      title: "Remercier un ami",
      body:
        "Écris un message pour remercier un ami qui t’a aidé récemment (écoute, soutien, service rendu). Explique en quoi son aide a été importante pour toi. 120–160 mots.",
    },
    {
      title: "Donner ton opinion",
      body:
        "Ton ami te demande ton avis sur une idée qu’il a (projet, relation, décision). Explique clairement ce que tu en penses et pourquoi. 130–170 mots.",
    },
    {
      title: "Raconter une activité culturelle",
      body:
        "Explique à ton ami une activité culturelle que tu as faite (musée, concert, festival, pièce de théâtre). Décris ce que tu as aimé ou moins aimé. 140–180 mots.",
    },
    {
      title: "Partager un souvenir commun",
      body:
        "Rappelle à ton ami un bon souvenir que vous avez partagé (voyage, fête, événement) et propose de refaire une activité similaire bientôt. 130–170 mots.",
    },
    {
      title: "Encourager avant un examen",
      body:
        "Envoie un message d’encouragement à un ami qui passe un examen important. Motive-le, rassure-le et souhaite-lui bonne chance. 120–160 mots.",
    },
    {
      title: "Raconter une nouvelle rencontre",
      body:
        "Raconte à ton ami une nouvelle rencontre qui t’a marqué (personne inspirante, collègue, voisin). Explique ce que tu as apprécié chez cette personne. 130–170 mots.",
    },
    {
      title: "Donner des nouvelles après une longue absence",
      body:
        "Explique pourquoi tu n’as pas donné de nouvelles récemment et raconte ce qui s’est passé dans ta vie pendant ce temps. 130–170 mots.",
    },
    {
      title: "S'excuser auprès d’un ami",
      body:
        "Écris à un ami pour t’excuser d’un oubli, d’un retard ou d’un comportement qui a pu le blesser. Reconnais ton erreur et propose de te rattraper. 120–160 mots.",
    },
    {
      title: "Demander conseil pour une décision",
      body:
        "Tu dois prendre une décision importante (changer de travail, reprendre des études, déménager). Explique la situation et demande sincèrement l’avis de ton ami. 130–170 mots.",
    },
    {
      title: "Parler d’un projet futur",
      body:
        "Parle à ton ami d’un projet futur que tu veux commencer (entreprise, formation, voyage au long cours) et demande ce qu’il en pense. 140–180 mots.",
    },
  ];

  const opinionTopics = [
    "les réseaux sociaux et la communication",
    "le télétravail",
    "les téléphones intelligents à l'école",
    "la place de l'intelligence artificielle dans la vie quotidienne",
    "les transports publics dans les grandes villes",
    "l'importance de protéger l'environnement au quotidien",
  ];

  const creativeTopics = [
    "une journée ordinaire qui devient étrange",
    "une rencontre inattendue dans le métro",
    "un objet perdu qui change tout",
    "un message reçu au mauvais moment",
    "un trajet banal qui devient mémorable",
    "un matin où tout semble normal, puis quelque chose bascule",
  ];

  const argumentativeTopics = [
    "faut-il limiter l'usage du téléphone dans les lieux publics",
    "les villes devraient-elles réduire la place de la voiture",
    "l'intelligence artificielle est-elle bénéfique à l'éducation",
    "faut-il interdire les réseaux sociaux aux jeunes enfants",
    "les transports publics devraient-ils être gratuits",
    "le travail à distance est-il meilleur que le travail en présentiel",
  ];

  const hash = Array.from(dateKey).reduce(
    (acc, c) => acc + c.charCodeAt(0),
    0
  );

  if (writingType === "lettre") {
    const list = tone === "formel" ? formalPrompts : informalPrompts;
    const idx = hash % list.length;
    return list[idx];
  }

  if (writingType === "opinion") {
    const subject = topic || opinionTopics[hash % opinionTopics.length];
    return {
      title: "Exprimer une opinion",
      body:
        `Certaines personnes pensent que ${subject} apportent surtout des avantages, tandis que d'autres croient que cela crée davantage de problèmes.\n\n` +
        `Donnez votre opinion en expliquant clairement votre point de vue avec des exemples concrets.\n\n` +
        `Écrivez entre 180–220 mots.\n\n` +
        `Adaptez votre registre (${tone}).`,
    };
  }

  if (writingType === "creative") {
    const subject = topic || creativeTopics[hash % creativeTopics.length];
    return {
      title: "Rédaction créative",
      body:
        `Racontez une histoire sur le thème suivant : ${subject}.\n\n` +
        `Développez une situation, un problème et une résolution.\n\n` +
        `Écrivez entre 180–220 mots.\n\n` +
        `Adaptez votre registre (${tone}).`,
    };
  }

  if (writingType === "argumentatif") {
    const subject =
      topic || argumentativeTopics[hash % argumentativeTopics.length];
    return {
      title: "Essai argumentatif",
      body:
        `Sujet : ${subject} ?\n\n` +
        `Présentez une argumentation structurée :\n` +
        `- une introduction\n` +
        `- deux arguments développés\n` +
        `- une conclusion\n\n` +
        `Écrivez entre 200–250 mots.\n\n` +
        `Adaptez votre registre (${tone}).`,
    };
  }

  const list = tone === "formel" ? formalPrompts : informalPrompts;
  const idx = hash % list.length;
  return list[idx];
}

type CorrectionItem = {
  type:
    | "accord"
    | "temps"
    | "preposition"
    | "registre"
    | "orthographe"
    | "syntaxe"
    | "lexique"
    | "ponctuation";
  original: string;
  correction: string;
  why: string;
  rule: string;
  severity: "minor" | "medium" | "major";
};

type Feedback = {
  corrections: CorrectionItem[]; // 👈 THIS IS THE KEY CHANGE
  natural: string;
  tefNotes: string;
  tefScore?: string;
};

type HistoryEntry = {
  dateKey: string;
  tone: "formel" | "informel";
  promptTitle: string;
  promptBody: string;
  text: string;
  feedback: Feedback;
  wordCount: number;
};

type DrillCategory = {
  name: string;
  description: string;
  examples: string[];
  tips: string;
};

type DrillExercise = {
  id: string;
  type: string; // "mcq"

  // NEW (from drill-more.php)
  title?: string;
  context?: string;

  prompt: string;
  instruction: string;
  choices?: string[];
  answer: string | string[];
  explanation: string;

  uiId?: string;
};

type WritingType = "lettre" | "opinion" | "creative" | "argumentatif";
type WritingLevel = "B1" | "B2" | "C1";

export default function FrenchWritingCoach() {
  const router = useRouter();
  const [writingType, setWritingType] = useState<WritingType>("lettre");
  const [dynamicTopic, setDynamicTopic] = useState<string | undefined>(undefined);
  const [recentTopics, setRecentTopics] = useState<string[]>([]); 
  const [writingLevel, setWritingLevel] = useState<WritingLevel>("B2");

  // date key
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const dateKey = `${yyyy}-${mm}-${dd}`;

  // core state
  const [tone, setTone] = useState<"formel" | "informel">("formel");
  const [userText, setUserText] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // drills state
  const [drillsLoading, setDrillsLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [categories, setCategories] = useState<DrillCategory[]>([]);
  const [exercises, setExercises] = useState<DrillExercise[]>([]);
  const [moreLoadingCat, setMoreLoadingCat] = useState<string | null>(null);

  // 👇 NEW: MCQ answers / grading state
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [mcqChecked, setMcqChecked] = useState(false);
  const [mcqScore, setMcqScore] = useState<number | null>(null);
  const [mcqAreas, setMcqAreas] = useState<
    Record<string, { total: number; wrong: number }>
  >({});
  const [mcqResults, setMcqResults] = useState<
    Record<string, "correct" | "wrong">
  >({});

  // exam mode state
  const [examMode, setExamMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [lockedAfterSubmit, setLockedAfterSubmit] = useState(false);

  // history
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // prompt and word count
  const prompt = getDailyPrompt(dateKey, tone, writingType, dynamicTopic);
  const targetRange = getWordTargetRange(prompt.body);
  const wordCount = countWords(userText);

  // load history on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("frenchCoachHistory");
      if (raw) {
        setHistory(JSON.parse(raw));
      }
    } catch (err) {
      console.warn("Could not load history:", err);
    }
  }, []);

useEffect(() => {
  fetchDynamicTopic(writingType, writingLevel);
}, [writingType, writingLevel]);

  // exam timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!examMode || !timerRunning) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setTimerRunning(false);
          setLockedAfterSubmit(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examMode, timerRunning]);

  function startExamTimer() {
    setExamMode(true);
    setTimerRunning(true);
    setLockedAfterSubmit(false);
    setTimeLeft(30 * 60);
  }

  function stopExamMode() {
    setExamMode(false);
    setTimerRunning(false);
    setLockedAfterSubmit(false);
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // --- helpers for TEF band & splitting natural text ---

  function getTefBand(score: string): { label: string; classes: string } {
    const s = score.toUpperCase();
    const base = "bg-slate-900/60 border-slate-600/70 text-slate-100";

    if (!s) return { label: "—", classes: base };

    if (s.includes("C2")) {
      return {
        label: score,
        classes: "bg-emerald-900/60 border-emerald-400/70 text-emerald-100",
      };
    }
    if (s.includes("C1")) {
      return {
        label: score,
        classes: "bg-emerald-900/50 border-emerald-400/60 text-emerald-100",
      };
    }
    if (s.includes("B2")) {
      return {
        label: score,
        classes: "bg-sky-900/60 border-sky-400/70 text-sky-100",
      };
    }
    if (s.includes("B1")) {
      return {
        label: score,
        classes: "bg-amber-900/60 border-amber-400/70 text-amber-100",
      };
    }
    if (s.includes("A2") || s.includes("A1")) {
      return {
        label: score,
        classes: "bg-red-900/60 border-red-400/70 text-red-100",
      };
    }

    return { label: score, classes: base };
  }
  
async function fetchDynamicTopic(type: WritingType, level: WritingLevel) {
  if (type === "lettre") {
    setDynamicTopic(undefined);
    return;
  }

  const currentType = type;

  try {
    const res = await fetch("/api/topic", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ writingType: type, level }),
    });

    if (!res.ok) {
      setDynamicTopic(undefined);
      return;
    }

    const data = await res.json();
    const newTopic = data?.topic;

    if (!newTopic || currentType !== type) return;

    const isDuplicate = recentTopics.includes(newTopic);

    if (isDuplicate) {
      console.log("duplicate topic detected, retrying...");

      const retryRes = await fetch("/api/topic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ writingType: type, level }),
      });

      if (!retryRes.ok) return;

      const retryData = await retryRes.json();
      const retryTopic = retryData?.topic;

      if (!retryTopic) return;

      console.log("topic source:", retryData?.source);

      setDynamicTopic(retryTopic);
      setRecentTopics((prev) => [retryTopic, ...prev].slice(0, 5));
      return;
    }

    console.log("topic source:", data?.source);

    setDynamicTopic(newTopic);
    setRecentTopics((prev) => [newTopic, ...prev].slice(0, 5));
  } catch {
    setDynamicTopic(undefined);
  }
}

function formatCorrections(c: any): string {
  if (!c) return "";

  if (typeof c === "string") return c;

  if (Array.isArray(c)) {
    if (c.length === 0) return "";
    return c
      .map((item, idx) => {
        const sev =
          item.severity === "major"
            ? "MAJEURE"
            : item.severity === "medium"
            ? "MOYENNE"
            : "MINEURE";

        return (
          `${idx + 1}. [${sev}] ${item.original}\n` +
          `→ ${item.correction}\n` +
          `Pourquoi: ${item.why}\n` +
          `Règle: ${item.rule}`
        );
      })
      .join("\n\n");
  }

  return "";
}

  function splitNatural(natural: string): { qc: string; fr: string } {
    const qIndex = natural.indexOf("(a) Version Québec");
    const fIndex = natural.indexOf("(b) Version France");

    if (qIndex === -1 || fIndex === -1) {
      // fallback: tout dans Québec, France vide
      return { qc: natural, fr: "" };
    }

    const qc = natural.slice(qIndex, fIndex).trim();
    const fr = natural.slice(fIndex).trim();
    return { qc, fr };
  }

  // --- helper: attach unique uiIds to drills to kill duplicate key warnings ---
  function attachUiIds(raw: DrillExercise[]): DrillExercise[] {
    const stamp = Date.now();
    return raw.map((ex, idx) => ({
      ...ex,
      uiId: ex.uiId || `${ex.id || "ex"}-${stamp}-${idx}`,
    }));
  }

  // --- helper: infer area from prompt (for basic “repeated errors” insight) ---
  function inferArea(ex: DrillExercise): string {
    const p = ex.prompt.toLowerCase();
    if (p.includes("orthograph")) return "Orthographe";
    if (p.includes("accord")) return "Accords";
    if (p.includes("temps")) return "Temps / aspect";
    if (p.includes("registre")) return "Registre";
    return "Autres";
  }


  // --- API calls ---

  async function handleAnalyze() {
    console.log("ANALYZE CLICKED");
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText, tone }),
      });

      const data = await res.json();

      if (data.error) {
        setErrorMsg(data.error);
        setFeedback(null);
      } else {
        const fb: Feedback = {
          corrections: data.corrections || "",
          natural: data.natural || "",
          tefNotes: data.tefNotes || "",
          tefScore: data.tefScore || "",
        };
        setFeedback(fb);

        // exam mode: lock text
        if (examMode) {
          setLockedAfterSubmit(true);
          setTimerRunning(false);
        }

        const newEntry: HistoryEntry = {
          dateKey,
          tone,
          promptTitle: prompt.title,
          promptBody: prompt.body,
          text: userText,
          feedback: fb,
          wordCount,
        };

        const updated = [newEntry, ...history].slice(0, 50);
        setHistory(updated);
        try {
          window.localStorage.setItem(
            "frenchCoachHistory",
            JSON.stringify(updated)
          );
        } catch (err) {
          console.warn("Could not save history:", err);
        }
      }
    } catch (err) {
      console.error("CLIENT error calling /api/analyze:", err);
      setErrorMsg(
        "Impossible d'analyser le texte. Vérifie ta connexion ou réessaie."
      );
      setFeedback(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateDrills() {
    setDrillsLoading(true);
    setDrillError(null);

    try {
      const res = await fetch("/api/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          tone,
          corrections: feedback?.corrections || "",
        }),
      });
      const data = await res.json();

      if (data.error) {
        setDrillError(data.error);
        setCategories([]);
        setExercises([]);
      } else {
        setCategories(data.categories || []);
        const raw = (data.exercises || []) as DrillExercise[];
        const withIds = attachUiIds(raw);
        setExercises(withIds);

        // reset MCQ grading state
        setMcqAnswers({});
        setMcqChecked(false);
        setMcqScore(null);
        setMcqAreas({});
        setMcqResults({});

        // optional: persistent "error bank"
        try {
          const prev = JSON.parse(
            localStorage.getItem("frenchCoachErrorBank") || "[]"
          );
          const updated = [...prev, ...(data.categories || [])].slice(-100);
          localStorage.setItem(
            "frenchCoachErrorBank",
            JSON.stringify(updated)
          );
        } catch {
          // ignore
        }
      }
    } catch {
      setDrillError("Impossible de créer des exercices. Réessaie.");
      setCategories([]);
      setExercises([]);
    } finally {
      setDrillsLoading(false);
    }
  }

  async function handleMoreForCategory(catName: string) {
    try {
      setMoreLoadingCat(catName);
      const res = await fetch("/api/drill-more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          tone,
          category: catName,
          corrections: feedback?.corrections || "",
        }),
      });
      const data = await res.json();
      if (data.error) {
        setDrillError(data.error);
        return;
      }

      // 👇 REFRESH the drills with a new set for that category
      const raw = (data.exercises || []) as any[];

const normalized: DrillExercise[] = raw.map((ex: any, idx: number) => ({
  id: ex.id || `more-${catName}-${idx}`,
  type: ex.type || "mcq",

  title: ex.title || catName,
  context: ex.context || "",

  // drill-more.php sends "q"
  prompt: ex.q || ex.prompt || "",
  instruction: ex.instruction || "Choisis la bonne réponse.",
  choices: ex.choices || [],
  answer: ex.answer,
  explanation: ex.explanation || "",
}));

const withIds = attachUiIds(normalized);
setExercises(withIds);

      // reset grading
      setMcqAnswers({});
      setMcqChecked(false);
      setMcqScore(null);
      setMcqAreas({});
      setMcqResults({});
    } catch {
      setDrillError("Impossible de générer des exercices supplémentaires.");
    } finally {
      setMoreLoadingCat(null);
    }
  }

function saveDrillSession(session: {
  dateKey: string;
  tone: "formel" | "informel";
  score10: number;
  total: number;
  correctCount: number;
  areaStats: Record<string, { total: number; wrong: number }>;
  wrongItems: Array<{
    id: string;
    area: string;
    title?: string;
    context?: string;
    prompt: string;
    instruction: string;
    chosen?: string;
    correct: string | string[];
    explanation?: string;
  }>;
  categories?: Array<{ name: string; description: string }>;
}) {
  try {
    const key = "frenchCoachDrillSessions";
    const prev = JSON.parse(localStorage.getItem(key) || "[]");
    const updated = [session, ...prev].slice(0, 80);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // silent fail
  }
}

  // --- Grading logic for drills (score /10 + repeated areas) ---
  function handleCheckDrills() {
  if (!exercises.length) return;

  let correctCount = 0;
  const areaStats: Record<string, { total: number; wrong: number }> = {};
  const results: Record<string, "correct" | "wrong"> = {};

  // 👇 NEW: capture wrong items for deep analysis
  const wrongItems: Array<{
    id: string;
    area: string;
    title?: string;
    context?: string;
    prompt: string;
    instruction: string;
    chosen?: string;
    correct: string | string[];
    explanation?: string;
  }> = [];

  exercises.forEach((ex) => {
    const key = ex.uiId || ex.id;
    const userChoice = mcqAnswers[key];

    const correctAnswers = Array.isArray(ex.answer) ? ex.answer : [ex.answer];
    const isCorrect =
      userChoice !== undefined && correctAnswers.includes(userChoice);

    // Your existing area logic
    const area = inferArea(ex);
    if (!areaStats[area]) areaStats[area] = { total: 0, wrong: 0 };
    areaStats[area].total += 1;

    if (isCorrect) {
      correctCount += 1;
      results[key] = "correct";
    } else {
      areaStats[area].wrong += 1;
      results[key] = "wrong";

      // 👇 NEW: store details for later pattern detection
      wrongItems.push({
        id: key,
        area,
        title: (ex as any).title,      // works even if not present
        context: (ex as any).context,  // works even if not present
        prompt: ex.prompt,
        instruction: ex.instruction,
        chosen: userChoice,
        correct: ex.answer,
        explanation: ex.explanation,
      });
    }
  });

  const score = Math.round((correctCount / exercises.length) * 10);

  // Keep your existing state updates
  setMcqChecked(true);
  setMcqScore(score);
  setMcqAreas(areaStats);
  setMcqResults(results);

  // ✅ NEW: save a drill session for deep analysis
  saveDrillSession({
    dateKey, // you already have dateKey in scope
    tone,
    score10: score,
    total: exercises.length,
    correctCount,
    areaStats,
    wrongItems,
    // optional: helps deep analysis know “what set was this?”
    categories: categories?.map((c) => ({
      name: c.name,
      description: c.description,
    })),
  });
}


  // styling for each choice depending on selection + correction
  function choiceClasses(
    ex: DrillExercise,
    choice: string,
    isSelected: boolean
  ): string {
    const base =
      "w-full text-left px-2 py-1.5 rounded-lg text-xs border transition-colors";
    const key = ex.uiId || ex.id;

    if (!mcqChecked) {
      return (
        base +
        " " +
        (isSelected
          ? "bg-slate-700 border-slate-400 text-slate-50"
          : "bg-slate-900/40 border-slate-600 text-slate-200 hover:bg-slate-800/80")
      );
    }

    const answers = Array.isArray(ex.answer) ? ex.answer : [ex.answer];
    const isCorrectAnswer = answers.includes(choice);
    const result = mcqResults[key];

    if (isSelected && result === "correct") {
      return base + " bg-emerald-900/40 border-emerald-400 text-emerald-100";
    }
    if (isSelected && result === "wrong") {
      return base + " bg-red-900/40 border-red-400 text-red-100";
    }
    if (!isSelected && isCorrectAnswer) {
      // highlight the correct answer even if user chose another
      return base + " bg-emerald-900/10 border-emerald-500/70 text-emerald-100";
    }

    return base + " bg-slate-900/40 border-slate-700 text-slate-200";
  }

  // --- PDF export ---
  function exportDrillsPdf() {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 40;
    const maxW = 555;
    let y = 50;

    const line = () => {
      doc.setDrawColor(220);
      doc.line(marginX, y, marginX + maxW, y);
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("French Writing Coach — Pack d'exercices", marginX, y);
    y += 20;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Date: ${new Date().toLocaleDateString()}   |   Registre: ${tone}`,
      marginX,
      y
    );
    y += 16;

    if (categories.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Catégories ciblées :", marginX, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      for (const c of categories) {
        const lines = doc.splitTextToSize(
          `${c.name}: ${c.description}`,
          maxW
        );
        for (const ln of lines) {
          if (y > 770) {
            doc.addPage();
            y = 50;
          }
          doc.text(ln, marginX, y);
          y += 14;
        }
        y += 6;
      }
      line();
      y += 14;
    }

    if (exercises.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Exercices :", marginX, y);
      y += 14;
      doc.setFont("helvetica", "normal");

      exercises.forEach((ex, idx) => {
        if (y > 770) {
          doc.addPage();
          y = 50;
        }
        doc.setFont("helvetica", "bold");
        doc.text(`${idx + 1}. [${ex.type.toUpperCase()}]`, marginX, y);
        y += 12;

        doc.setFont("helvetica", "normal");
        doc.text(doc.splitTextToSize(ex.prompt, maxW), marginX, y);
        y += 14;

        doc.setTextColor(120);
        doc.text(
          doc.splitTextToSize(`Consigne: ${ex.instruction}`, maxW),
          marginX,
          y
        );
        doc.setTextColor(0);
        y += 14;

        if (ex.choices?.length) {
          for (const c of ex.choices) {
            doc.text(`- ${c}`, marginX + 12, y);
            y += 12;
          }
        }

        doc.setTextColor(20, 120, 20);
        const ans = Array.isArray(ex.answer)
          ? ex.answer.join(" / ")
          : ex.answer;
        doc.text(
          doc.splitTextToSize(`Réponse: ${ans}`, maxW),
          marginX,
          y
        );
        doc.setTextColor(0);
        y += 14;

        doc.setTextColor(90);
        doc.text(
          doc.splitTextToSize(`Explication: ${ex.explanation}`, maxW),
          marginX,
          y
        );
        doc.setTextColor(0);
        y += 18;

        line();
        y += 14;
      });
    } else {
      doc.text(
        "Aucun exercice généré (clique « Créer des exercices ciblés »).",
        marginX,
        y
      );
    }

    doc.save("french-writing-coach-practice-pack.pdf");
  }

  function handleResetPrompt() {
    if (examMode && lockedAfterSubmit) return;
    setUserText("");
    setFeedback(null);
    setErrorMsg(null);
  }

  // word count UI status
  let wordStatusColor = "text-slate-400";
  let wordStatusText = `${wordCount} mots`;

  if (targetRange) {
    if (wordCount < targetRange.min) {
      wordStatusColor = "text-yellow-400";
      const diff = targetRange.min - wordCount;
      wordStatusText = `${wordCount} mots — il te manque ${diff} mots minimum`;
    } else if (wordCount > targetRange.max) {
      wordStatusColor = "text-red-400";
      const diff = wordCount - targetRange.max;
      wordStatusText = `${wordCount} mots — ${diff} mots au-dessus`;
    } else {
      wordStatusColor = "text-green-400";
      wordStatusText = `${wordCount} mots — OK ✅`;
    }
  }

  const textDisabled = loading || (examMode && lockedAfterSubmit);

  // TEF band + split natural
  const tefScore = feedback?.tefScore || "";
  const tefBand = getTefBand(tefScore);
  const { qc: naturalQc, fr: naturalFr } = feedback
    ? splitNatural(feedback.natural)
    : { qc: "", fr: "" };

  // --- UI ---

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 p-6 md:p-10 font-sans flex flex-col gap-6">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <Edit3 className="w-7 h-7" />
            Coach d'écriture français
          </h1>
          <p className="text-slate-400 text-sm md:text-base">
            Objectif : score élevé à l'épreuve de production écrite du TEF.
            Pratique quotidienne, correction ciblée, amélioration du style.
          </p>
        </div>

        <div className="flex flex-col md:items-end text-sm">
          <span className="text-slate-400">Mission du jour</span>
          <span className="text-slate-100 font-medium">{dateKey}</span>

          {/* history toggle */}
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="mt-2 inline-flex items-center gap-2 text-[11px] text-slate-300 hover:text-white bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1"
          >
            <History className="w-3 h-3" />
            {showHistory ? "Masquer l'historique" : "Voir l'historique"}
          </button>
        </div>
      </header>

      {/* HISTORY PANEL */}
      {showHistory && (
        <section className="bg-slate-800/60 border border-slate-700/60 shadow-xl rounded-2xl p-4 text-xs max-h-[240px] overflow-y-auto">
          {history.length === 0 ? (
            <div className="text-slate-400 italic">
              Aucune rédaction enregistrée pour l'instant.
            </div>
          ) : (
            <ul className="space-y-4">
              {history.map((h, i) => (
                <li
                  key={i}
                  className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                    <div className="font-semibold text-slate-200">
                      {h.dateKey} —{" "}
                      {h.tone === "formel" ? "Formel" : "Informel"}
                    </div>
                    <div className="text-slate-400">{h.wordCount} mots</div>
                  </div>
                  <div className="text-slate-300 font-medium text-[11px] leading-snug mt-1">
                    {h.promptTitle}
                  </div>
                  <div className="text-slate-400 leading-relaxed mt-2 whitespace-pre-wrap">
                    <span className="text-slate-500 block mb-1">
                      Ton texte :
                    </span>
                    {h.text}
                  </div>
                  <div className="text-slate-400 leading-relaxed mt-2 whitespace-pre-wrap">
                    <span className="text-slate-500 block mb-1">
                      Principales corrections :
                    </span>
                    {formatCorrections(h.feedback?.corrections)}

                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* PROMPT + SETTINGS */}
      <section className="grid md:grid-cols-3 gap-6">
        {/* prompt card */}
        <Card className="bg-slate-800/60 border border-slate-700/60 shadow-xl rounded-2xl md:col-span-2">
          <CardContent className="p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  Sujet ({tone === "formel" ? "formel" : "informel"})
                </div>
                <div className="text-lg font-semibold leading-snug text-slate-100">
                  {prompt.title}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl border border-slate-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleResetPrompt}
                title="Vider le texte"
                disabled={loading || (examMode && lockedAfterSubmit)}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
              {prompt.body}
            </p>

            {/* Word count helper */}
            <div
              className={`text-[11px] font-medium ${wordStatusColor} bg-slate-900/40 border border-slate-700/60 rounded-xl px-3 py-2`}
            >
              {targetRange ? (
                <>
                  <div>{wordStatusText}</div>
                  <div className="text-slate-500 text-[10px]">
                    Cible: {targetRange.min}–{targetRange.max} mots
                  </div>
                </>
              ) : (
                <div>{wordCount} mots</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* settings card */}
        <Card className="bg-slate-800/60 border border-slate-700/60 shadow-xl rounded-2xl">
          <CardContent className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-slate-200 font-medium text-sm">
              <Info className="w-4 h-4" />
              <span>Paramètres</span>
            </div>

            {/* tone selector */}
            <div className="flex flex-col gap-2 text-sm">
              <label className="text-slate-400 text-xs uppercase tracking-wide">
                Registre / ton demandé
              </label>
              <Select
                value={tone}
                onValueChange={(v: "formel" | "informel") => setTone(v)}
                disabled={loading || (examMode && timerRunning)}
              >
                <SelectTrigger className="bg-slate-900/60 border-slate-600/50 rounded-xl text-slate-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 text-slate-100 border-slate-600">
                  <SelectItem value="formel">
                    Formel (lettre officielle)
                  </SelectItem>
                  <SelectItem value="informel">
                    Informel (ami / réseau social)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
<div className="flex flex-col gap-2 text-sm">
  <label className="text-slate-400 text-xs uppercase tracking-wide">
    Type de texte
  </label>
  <Select
    value={writingType}
    onValueChange={(v) => setWritingType(v as WritingType)}
    disabled={loading || (examMode && timerRunning)}
  >
    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 rounded-xl text-slate-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
      <SelectValue />
    </SelectTrigger>
    <SelectContent className="bg-slate-800 text-slate-100 border-slate-600">
      <SelectItem value="lettre">Lettre</SelectItem>
      <SelectItem value="opinion">Opinion</SelectItem>
      <SelectItem value="creative">Histoire / créatif</SelectItem>
      <SelectItem value="argumentatif">Essai argumentatif</SelectItem>
    </SelectContent>
  </Select>
</div>

<div className="flex flex-col gap-2 text-sm">
  <label className="text-slate-400 text-xs uppercase tracking-wide">
    Niveau
  </label>
  <Select
    value={writingLevel}
    onValueChange={(v) => setWritingLevel(v as WritingLevel)}
    disabled={loading || (examMode && timerRunning)}
  >
    <SelectTrigger className="bg-slate-900/60 border-slate-600/50 rounded-xl text-slate-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
      <SelectValue />
    </SelectTrigger>
    <SelectContent className="bg-slate-800 text-slate-100 border-slate-600">
      <SelectItem value="B1">B1</SelectItem>
      <SelectItem value="B2">B2</SelectItem>
      <SelectItem value="C1">C1</SelectItem>
    </SelectContent>
  </Select>
</div>
            {/* exam mode controls */}
            <div className="flex flex-col gap-2 text-sm">
              <label className="text-slate-400 text-xs uppercase tracking-wide flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Mode Examen TEF
              </label>

              {!examMode ? (
                <Button
                  size="sm"
                  className="rounded-xl bg-slate-100 text-slate-900 hover:bg-white text-[11px] font-semibold flex items-center gap-2 self-start"
                  onClick={startExamTimer}
                  disabled={loading}
                >
                  <Unlock className="w-3 h-3" />
                  Activer (30:00)
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="text-slate-200 text-[11px] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-300" />
                    <span>
                      Temps restant :{" "}
                      <span className="font-semibold text-slate-100">
                        {formatTime(timeLeft)}
                      </span>
                    </span>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      className="rounded-xl bg-slate-700 text-slate-100 hover:bg-slate-600 text-[11px] font-semibold flex items-center gap-2"
                      onClick={() => setTimerRunning((r) => !r)}
                      disabled={lockedAfterSubmit || loading}
                    >
                      {timerRunning ? "Pause chrono" : "Reprendre chrono"}
                    </Button>

                    <Button
                      size="sm"
                      className="rounded-xl bg-slate-700 text-slate-100 hover:bg-slate-600 text-[11px] font-semibold flex items-center gap-2"
                      onClick={stopExamMode}
                      disabled={loading}
                    >
                      <Lock className="w-3 h-3" />
                      Quitter mode examen
                    </Button>
                  </div>

                  {lockedAfterSubmit && (
                    <div className="text-[10px] text-red-400 font-medium bg-red-900/20 border border-red-700/40 rounded-lg px-2 py-1">
                      Rédaction verrouillée (envoi effectué).
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* TEF reminders */}
            <div className="text-[11px] leading-relaxed text-slate-400 bg-slate-900/40 rounded-xl p-3 border border-slate-700/60">
              <p className="font-semibold text-slate-200 text-xs mb-1">
                Rappel TEF:
              </p>
              <ul className="list-disc list-inside">
                <li>Annonce ton but dès la 1ère phrase.</li>
                <li>Paragraphes courts = idées claires.</li>
                <li>Registre cohérent (poli / familier, pas mélange).</li>
                <li>Formule d'ouverture / fermeture adaptée.</li>
                <li>Respecte la longueur demandée.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* WRITING ZONE */}
      <section className="grid md:grid-cols-2 gap-6">
        {/* left side */}
        <Card className="bg-slate-800/60 border border-slate-700/60 shadow-xl rounded-2xl flex flex-col">
          <CardContent className="p-5 flex flex-col gap-4 grow">
            <div className="flex items-center justify-between">
              <div className="text-slate-200 font-medium text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                <span>Ta rédaction (aucune correction auto)</span>
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                spellcheck OFF
              </div>
            </div>

            <Textarea
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              className="min-h-[220px] md:min-h-[260px] bg-slate-900/60 border-slate-600/50 text-slate-100 rounded-xl placeholder-slate-600 text-sm leading-relaxed focus-visible:ring-slate-400 disabled:opacity-50"
              placeholder={
                tone === "formel"
                  ? "Madame, Monsieur,\nJe me permets de vous écrire afin de..."
                  : "Yo, écoute ça... tu sais pas ce qui m'est arrivé aujourd'hui 😩"
              }
              value={userText}
              onChange={(e) => setUserText(e.target.value)}
              disabled={textDisabled}
            />

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-900/20 text-red-300 text-xs p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <div>
                  <div className="font-semibold text-red-200 text-[11px]">
                    Oups...
                  </div>
                  <div className="leading-relaxed">{errorMsg}</div>
                </div>
              </div>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={loading || (examMode && lockedAfterSubmit)}
              className="rounded-xl bg-slate-100 text-slate-900 hover:bg-white text-sm font-semibold flex items-center gap-2 self-start disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyse en cours…
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Corriger / Améliorer
                </>
              )}
            </Button>

            <Button
              onClick={handleGenerateDrills}
              disabled={
                drillsLoading || !feedback || userText.trim().length === 0
              }
              className="mt-2 rounded-xl bg-slate-700 text-slate-100 hover:bg-slate-600 text-xs font-semibold flex items-center gap-2 self-start disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {drillsLoading
                ? "Génération des exercices…"
                : "Créer des exercices ciblés"}
            </Button>

            <Button
              onClick={exportDrillsPdf}
              disabled={exercises.length === 0}
              className="mt-2 rounded-xl bg-slate-100 text-slate-900 hover:bg-white text-xs font-semibold flex items-center gap-2 self-start disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Exporter le pack (PDF)
            </Button>

            {drillError && (
              <div className="mt-2 text-xs text-red-300 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">
                {drillError}
              </div>
            )}
          </CardContent>
        </Card>

        {/* right side: feedback + drills */}
        <motion.div
          layout
          className="flex flex-col gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* TEF coloured band */}
          {feedback && tefScore && (
            <Card className={`shadow-xl rounded-2xl ${tefBand.classes}`}>
              <CardContent className="p-4 flex items-center justify-between gap-3 text-sm">
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wide opacity-80">
                    Niveau estimé – TEF
                  </span>
                  <span className="text-[11px] opacity-80">
                    Indication approximative basée sur cette rédaction.
                  </span>
                </div>
                <div className="text-lg font-semibold">
                  {tefBand.label}
                </div>
              </CardContent>
            </Card>
          )}

          {/* corrections */}
          <Card className="bg-slate-800/60 border border-slate-700/60 shadow-xl rounded-2xl">
            <CardContent className="p-5 flex flex-col gap-3 text-sm">
              <div className="text-slate-200 font-medium flex items-center gap-2 text-sm">
                <Info className="w-4 h-4" />
                <span>1. Corrections ciblées</span>
              </div>
              <pre className="whitespace-pre-wrap text-slate-300 text-xs leading-relaxed bg-slate-900/40 border border-slate-700/60 rounded-xl p-3 min-h-[70px]">
  {feedback ? (
  feedback.corrections.length > 0 ? (
    <div className="space-y-3">
      {feedback.corrections.map((c, i) => (
        <div
          key={i}
          className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-3 text-xs"
        >
          <div className="text-red-300 font-semibold">
            ❌ {c.original}
          </div>

          <div className="text-emerald-300 mt-1">
            ✅ {c.correction}
          </div>

          <div className="text-slate-300 mt-1">
            {c.why}
          </div>

          <div className="text-slate-500 italic mt-1">
            Règle : {c.rule}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="text-slate-400 text-sm">
      ✅ Aucune correction détectée.
    </div>
  )
) : (
  "Ici tu verras les erreurs (grammaire, accords, faux amis) + pourquoi."
)}

</pre>

            </CardContent>
          </Card>

          {/* natural French – Québec */}
          <Card className="bg-slate-800/60 border border-slate-700/60 shadow-xl rounded-2xl">
            <CardContent className="p-5 flex flex-col gap-3 text-sm">
              <div className="text-slate-200 font-medium flex items-center gap-2 text-sm">
                <Info className="w-4 h-4" />
                <span>2a. Version plus naturelle – Québec</span>
              </div>
              <pre className="whitespace-pre-wrap text-slate-300 text-xs leading-relaxed bg-slate-900/40 border border-slate-700/60 rounded-xl p-3 min-h-[70px]">
                {feedback
                  ? naturalQc
                  : "Ici tu verras une version qui sonne plus québécoise (registre courant / familier, tournures locales)."}
              </pre>
            </CardContent>
          </Card>

          {/* natural French – France */}
          <Card className="bg-slate-800/60 border border-slate-700/60 shadow-xl rounded-2xl">
            <CardContent className="p-5 flex flex-col gap-3 text-sm">
              <div className="text-slate-200 font-medium flex items-center gap-2 text-sm">
                <Info className="w-4 h-4" />
                <span>2b. Version plus naturelle – France</span>
              </div>
              <pre className="whitespace-pre-wrap text-slate-300 text-xs leading-relaxed bg-slate-900/40 border border-slate-700/60 rounded-xl p-3 min-h-[70px]">
                {feedback
                  ? naturalFr || "(Aucune version France distincte trouvée.)"
                  : "Ici tu verras une version en français standard (France), plus neutre et académique."}
              </pre>
            </CardContent>
          </Card>

          {/* TEF tips */}
          <Card className="bg-slate-800/60 border border-slate-700/60 shadow-xl rounded-2xl">
            <CardContent className="p-5 flex flex-col gap-3 text-sm">
              <div className="text-slate-200 font-medium flex items-center gap-2 text-sm">
                <Info className="w-4 h-4" />
                <span>3. Conseils pour le TEF</span>
              </div>
              <pre className="whitespace-pre-wrap text-slate-300 text-xs leading-relaxed bg-slate-900/40 border border-slate-700/60 rounded-xl p-3 min-h-[70px]">
                {feedback
                  ? feedback.tefNotes
                  : "Ici je t'explique comment structurer, rester dans le bon registre et gagner des points à l'examen."}
              </pre>
            </CardContent>
          </Card>

          {/* drills */}
          <Card className="bg-slate-800/60 border border-slate-700/60 shadow-xl rounded-2xl">
            <CardContent className="p-5 flex flex-col gap-3 text-sm">
              <div className="text-slate-200 font-medium flex items-center gap-2 text-sm">
                <Info className="w-4 h-4" />
                <span>4. Exercices ciblés (personnalisés)</span>
              </div>

              {categories.length > 0 && (
                <div className="text-xs text-slate-300 bg-slate-900/40 border border-slate-700/60 rounded-xl p-3 mb-2">
                  <div className="text-slate-200 font-semibold mb-1">
                    Tes zones à travailler :
                  </div>
                  <ul className="list-disc list-inside space-y-2">
                    {categories.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <div>
                          <span className="font-semibold">{c.name}:</span>{" "}
                          {c.description}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleMoreForCategory(c.name)}
                          disabled={moreLoadingCat === c.name}
                          className="ml-2 rounded-lg bg-slate-700 text-slate-100 hover:bg-slate-600 text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <PlusCircle className="w-3 h-3" />
                          {moreLoadingCat === c.name
                            ? "Nouveau set…"
                            : "Nouveau set d'exos similaires"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Grading controls + score */}
{exercises.length > 0 && (
  <div className="flex flex-wrap items-center gap-3 mb-3">
    <Button
      size="sm"
      onClick={handleCheckDrills}
      className="rounded-xl bg-slate-100 text-slate-900 hover:bg-white text-[11px] font-semibold flex items-center gap-2"
    >
      Corriger les exercices
    </Button>

    {mcqScore !== null && (
      <div className="text-xs text-slate-200">
        Score : <span className="font-semibold">{mcqScore}/10</span>
      </div>
    )}

    {mcqChecked && mcqScore !== null && (
      <Button
        size="sm"
        onClick={() => router.push("/deep-analysis")}
        className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 text-[11px] font-semibold flex items-center gap-2"
      >
        <Brain className="w-4 h-4" />
        Analyse approfondie (C1)
      </Button>
    )}
  </div>
)}

                     

              {mcqChecked && Object.keys(mcqAreas).length > 0 && (
                <div className="text-[11px] text-slate-300 bg-slate-900/40 border border-slate-700/60 rounded-xl p-3 mb-2">
                  <div className="font-semibold mb-1">
                    Ce qui te pose le plus de problèmes :
                  </div>
                  <ul className="list-disc list-inside space-y-1">
                    {Object.entries(mcqAreas).map(([area, stats]) => (
                      <li key={area}>
                        {area} : {stats.wrong} erreurs sur {stats.total} items
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {exercises.length > 0 ? (
                <ul className="space-y-3">
                  {exercises.map((ex) => {
                    const key = ex.uiId || ex.id;
                    return (
                      <li
                        key={key}
                        className="text-xs text-slate-300 bg-slate-900/40 border border-slate-700/60 rounded-xl p-3"
                      >
                        <div className="text-slate-200 font-semibold">
  {(ex.title ?? ex.type ?? "Exercice").toUpperCase()}
</div>

{ex.context && (
  <div className="mt-1 text-slate-300 whitespace-pre-wrap">
    {ex.context}
  </div>
)}

<div className="mt-2 text-slate-300 whitespace-pre-wrap">
  {ex.prompt}
</div>

<div className="mt-1 text-slate-400">
  {ex.instruction}
</div>


                        {ex.choices && ex.choices.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {ex.choices.map((choice, idx) => {
                              const selected = mcqAnswers[key] === choice;
                              const answers = Array.isArray(ex.answer)
                                ? ex.answer
                                : [ex.answer];
                              const isCorrectAnswer =
                                answers.includes(choice);
                              const result = mcqResults[key];

                              let icon = null;
                              if (mcqChecked) {
                                if (selected && result === "correct") {
                                  icon = (
                                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  );
                                } else if (selected && result === "wrong") {
                                  icon = (
                                    <XCircle className="w-3 h-3 text-red-400" />
                                  );
                                } else if (!selected && isCorrectAnswer) {
                                  icon = (
                                    <CheckCircle className="w-3 h-3 text-emerald-400 opacity-70" />
                                  );
                                }
                              }

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  disabled={mcqChecked}
                                  onClick={() => {
                                    setMcqAnswers((prev) => ({
                                      ...prev,
                                      [key]: choice,
                                    }));
                                  }}
                                  className={choiceClasses(
                                    ex,
                                    choice,
                                    selected
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    {icon && <span>{icon}</span>}
                                    <span>{choice}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <details className="mt-2">
                          <summary className="cursor-pointer text-slate-200">
                            Voir la solution
                          </summary>
                          <div className="mt-1">
                            <div className="text-green-300 whitespace-pre-wrap">
                              <span className="font-semibold">
                                Réponse:{" "}
                              </span>
                              {Array.isArray(ex.answer)
                                ? ex.answer.join(" / ")
                                : ex.answer}
                            </div>
                            <div className="text-slate-400 mt-1 whitespace-pre-wrap">
                              <span className="font-semibold">
                                Explication:{" "}
                              </span>
                              {ex.explanation}
                            </div>
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-xs text-slate-400">
                  Clique « Créer des exercices ciblés » après ta correction.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="text-[11px] text-slate-500 text-center leading-relaxed max-w-3xl mx-auto pb-10">
        <p className="font-semibold text-slate-400 mb-1">
          Prochaines étapes prévues :
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Compteur de mots en temps réel (+ rappel « il te manque 30 mots »).
          </li>
          <li>
            Historique : voir tes rédactions précédentes et ta progression.
          </li>
          <li>
            Mode « Examen TEF » avec minuterie 30 min / verrouillage après envoi.
          </li>
          <li>Option FR-Québec vs FR-France prioritaire.</li>
        </ul>
      </footer>
    </div>
  );
}
