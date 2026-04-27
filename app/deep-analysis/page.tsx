// app/deep-analysis/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Brain,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Zap,
  ListChecks,
} from "lucide-react";

/**
 * Deep Analysis (C1 Coach Office)
 * - Reads localStorage:
 *   - frenchCoachHistory
 *   - frenchCoachDrillSessions
 * - Calls API:
 *   - https://chezctvicky.ca/api/deep-analysis.php   (adjust if needed)
 * - Shows:
 *   - Estimated level + pillar diagnostics
 *   - Frequent errors + C1 push phrases
 *   - Drill templates (generate sets)
 *   - Pressure Mode toggle
 */

type HistoryEntry = {
  dateKey: string;
  tone: "formel" | "informel";
  promptTitle: string;
  promptBody: string;
  text: string;
  feedback?: {
    corrections: string;
    natural: string;
    tefNotes: string;
    tefScore?: string;
  };
  wordCount: number;
};

type DrillSession = {
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
};

type Template = {
  id: string;
  pillar:
    | "Temporal control"
    | "Logical articulation"
    | "Controlled complexity"
    | "Lexical precision"
    | "Register mastery"
    | "Examiner comfort signals";
  title: string;
  subtitle: string;
  whatItTrains: string[];
  outputType: "mcq" | "rewrite" | "error_detection";
};

type GeneratedExercise = {
  id: string;
  type: string; // mcq | rewrite | error_detection
  title?: string; // better heading than "MCQ"
  context?: string; // extra context if needed
  prompt: string;
  instruction: string;
  choices?: string[];
  answer: string | string[];
  explanation: string;
  uiId?: string;
  pillar?: string;
  templateId?: string;
};

type DeepAnalysisResponse = {
  estimatedLevel: string; // e.g. "B2+ (proche C1)"
  summary: string;
  pillarScores: Array<{
    pillar: string;
    score: number; // 0-100
    why: string;
    next: string;
  }>;
  frequentErrors: Array<{
    label: string;
    whyBlocksC1: string;
    pattern: string;
    fix: string;
  }>;
  c1PushPhrases: Array<{
    weak: string;
    strong: string;
    why: string;
  }>;
  generatedExercises: GeneratedExercise[];
};

const API_URL = "/api/deep-analysis";

const TEMPLATES: Template[] = [
  {
    id: "TENSE_CONTEXT",
    pillar: "Temporal control",
    title: "Temps sous pression",
    subtitle: "Présent / imparfait / passé composé avec contexte riche",
    whatItTrains: [
      "Aspect (habitude vs action ponctuelle)",
      "Bascule narratif imparfait → PC",
      "Choix « acceptable » vs « meilleur C1 »",
    ],
    outputType: "mcq",
  },
  {
    id: "CONNECTORS_LOGIC",
    pillar: "Logical articulation",
    title: "Connecteurs (logique & nuance)",
    subtitle: "Certes… mais / néanmoins / en revanche / dans la mesure où",
    whatItTrains: [
      "Hiérarchie logique (cause, concession, nuance, conclusion)",
      "Connecteur correct vs connecteur précis",
      "Argumentation TEF",
    ],
    outputType: "mcq",
  },
  {
    id: "REGISTER_SHIFT",
    pillar: "Register mastery",
    title: "Registre (formel / neutre / familier)",
    subtitle: "Même contenu, ton différent (sans mélanger)",
    whatItTrains: [
      "Cohérence de ton",
      "Politesse efficace",
      "Éviter les « glissements »",
    ],
    outputType: "mcq",
  },
  {
    id: "REFORMULATION_C1",
    pillar: "Lexical precision",
    title: "Reformulation C1",
    subtitle: "Transformer une phrase correcte en phrase C1",
    whatItTrains: [
      "Verbes précis",
      "Éviter vague (très, beaucoup, faire)",
      "Rythme naturel",
    ],
    outputType: "rewrite",
  },
  {
    id: "CONTROLLED_COMPLEXITY",
    pillar: "Controlled complexity",
    title: "Complexité contrôlée",
    subtitle: "Fusionner / équilibrer des phrases sans lourdeur",
    whatItTrains: [
      "Propositions relatives",
      "Ponctuation / respiration",
      "Clarté + sophistication",
    ],
    outputType: "mcq",
  },
  {
    id: "EXAMINER_SIGNAL",
    pillar: "Examiner comfort signals",
    title: "Signaux d’examinateur",
    subtitle: "Cela étant dit… / Il convient de… / Il ne s’agit pas de…",
    whatItTrains: [
      "Maturité rhétorique",
      "Anticipation / cadrage",
      "Confort de lecture",
    ],
    outputType: "mcq",
  },
];

function attachUiIds(raw: GeneratedExercise[]): GeneratedExercise[] {
  const stamp = Date.now();
  return raw.map((ex, idx) => ({
    ...ex,
    uiId: ex.uiId || `${ex.id || "ex"}-${stamp}-${idx}`,
  }));
}

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function levelBadgeClasses(level: string) {
  const s = (level || "").toUpperCase();
  if (s.includes("C1") || s.includes("C2"))
    return "bg-emerald-900/50 border-emerald-400/60 text-emerald-100";
  if (s.includes("B2"))
    return "bg-sky-900/60 border-sky-400/70 text-sky-100";
  if (s.includes("B1"))
    return "bg-amber-900/60 border-amber-400/70 text-amber-100";
  return "bg-slate-900/60 border-slate-600/70 text-slate-100";
}

export default function DeepAnalysisPage() {
   console.log("DEEP ANALYSIS NEW VERSION LOADED");
  const router = useRouter();

  const [pressureMode, setPressureMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [drillSessions, setDrillSessions] = useState<DrillSession[]>([]);

  const [analysis, setAnalysis] = useState<DeepAnalysisResponse | null>(null);

  // drills UI (generated on this page)
  const [exercises, setExercises] = useState<GeneratedExercise[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [score10, setScore10] = useState<number | null>(null);
  const [results, setResults] = useState<Record<string, "correct" | "wrong">>(
    {}
  );

  // Load data from localStorage
  useEffect(() => {
    const h = safeParse<HistoryEntry[]>(
      localStorage.getItem("frenchCoachHistory"),
      []
    );
    const d = safeParse<DrillSession[]>(
      localStorage.getItem("frenchCoachDrillSessions"),
      []
    );
    setHistory(h);
    setDrillSessions(d);
  }, []);

  const payload = useMemo(() => {
    // Keep it compact for the API (avoid sending huge text)
    const lastHistory = history.slice(0, 12).map((h) => ({
      dateKey: h.dateKey,
      tone: h.tone,
      promptTitle: h.promptTitle,
      wordCount: h.wordCount,
      text: h.text?.slice(0, 1500) || "",
      corrections: h.feedback?.corrections?.slice(0, 1200) || "",
      tefScore: h.feedback?.tefScore || "",
    }));

    const lastDrills = drillSessions.slice(0, 20).map((s) => ({
      dateKey: s.dateKey,
      tone: s.tone,
      score10: s.score10,
      areaStats: s.areaStats,
      wrongItems: (s.wrongItems || []).slice(0, 15),
    }));

    return {
      pressureMode,
      history: lastHistory,
      drillSessions: lastDrills,
      // Optional: you can let the API pick templates by weakness
      templates: TEMPLATES.map((t) => ({
        id: t.id,
        pillar: t.pillar,
        title: t.title,
        outputType: t.outputType,
      })),
    };
  }, [history, drillSessions, pressureMode]);

  async function runDeepAnalysis() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "analyze", ...payload }),
      });

      const data = (await res.json()) as DeepAnalysisResponse & {
        error?: string;
      };

      if (!res.ok || data.error) {
        setErr(
          data.error ||
            "Impossible de générer l’analyse. Vérifie l’API deep-analysis.php."
        );
        setAnalysis(null);
        return;
      }

      setAnalysis(data);
      // Pull exercises if API returns any
      const ex = attachUiIds(data.generatedExercises || []);
      setExercises(ex);
      setAnswers({});
      setChecked(false);
      setScore10(null);
      setResults({});
    } catch (e) {
      setErr("Impossible de contacter l’API. Vérifie l’URL et CORS.");
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }

  async function generateFromTemplate(templateId: string) {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate_template",
          templateId,
          pressureMode,
          history: payload.history,
          drillSessions: payload.drillSessions,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        generatedExercises?: GeneratedExercise[];
      };

      if (!res.ok || data.error) {
        setErr(data.error || "Impossible de générer ce template.");
        return;
      }

      const ex = attachUiIds(data.generatedExercises || []);
      setExercises(ex);
      setAnswers({});
      setChecked(false);
      setScore10(null);
      setResults({});
    } catch {
      setErr("Erreur réseau lors de la génération du template.");
    } finally {
      setLoading(false);
    }
  }

  function gradeExercises() {
    if (!exercises.length) return;

    let correct = 0;
    const r: Record<string, "correct" | "wrong"> = {};

    exercises.forEach((ex) => {
      const key = ex.uiId || ex.id;
      const user = answers[key];

      const correctAnswers = Array.isArray(ex.answer) ? ex.answer : [ex.answer];
      const ok = user !== undefined && correctAnswers.includes(user);

      if (ok) {
        correct += 1;
        r[key] = "correct";
      } else {
        r[key] = "wrong";
      }
    });

    const s10 = Math.round((correct / exercises.length) * 10);
    setChecked(true);
    setResults(r);
    setScore10(s10);

    // Persist sessions from deep-analysis too (optional)
    try {
      const key = "frenchCoachDeepAnalysisSessions";
      const prev = safeParse<any[]>(localStorage.getItem(key), []);
      const updated = [
        {
          dateKey: new Date().toISOString().slice(0, 10),
          pressureMode,
          score10: s10,
          total: exercises.length,
          wrong: exercises
            .filter((ex) => r[(ex.uiId || ex.id) as string] === "wrong")
            .map((ex) => ({
              id: ex.uiId || ex.id,
              title: ex.title,
              templateId: ex.templateId,
              pillar: ex.pillar,
              prompt: ex.prompt,
              chosen: answers[(ex.uiId || ex.id) as string],
              correct: ex.answer,
            })),
        },
        ...prev,
      ].slice(0, 80);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      // silent
    }
  }

  function choiceClasses(
    ex: GeneratedExercise,
    choice: string,
    selected: boolean
  ) {
    const base =
      "w-full text-left px-2 py-1.5 rounded-lg text-xs border transition-colors";
    const key = ex.uiId || ex.id;

    if (!checked) {
      return (
        base +
        " " +
        (selected
          ? "bg-slate-700 border-slate-400 text-slate-50"
          : "bg-slate-900/40 border-slate-600 text-slate-200 hover:bg-slate-800/80")
      );
    }

    const correctAnswers = Array.isArray(ex.answer) ? ex.answer : [ex.answer];
    const isCorrectAnswer = correctAnswers.includes(choice);
    const result = results[key];

    if (selected && result === "correct")
      return base + " bg-emerald-900/40 border-emerald-400 text-emerald-100";
    if (selected && result === "wrong")
      return base + " bg-red-900/40 border-red-400 text-red-100";
    if (!selected && isCorrectAnswer)
      return base + " bg-emerald-900/10 border-emerald-500/70 text-emerald-100";

    return base + " bg-slate-900/40 border-slate-700 text-slate-200";
  }

  const hasData = history.length > 0 || drillSessions.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6 md:p-10 font-sans flex flex-col gap-6">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            className="rounded-xl border border-slate-700/60"
            onClick={() => router.push("/")}
            title="Retour"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>

          <div>
            <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
              <Brain className="w-7 h-7" />
              Deep Analysis (C1)
            </h1>
            <p className="text-slate-400 text-sm md:text-base">
              Diagnostic sur tes erreurs récurrentes + drills C1 (Pressure Mode).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPressureMode((p) => !p)}
            className={`inline-flex items-center gap-2 text-[11px] font-semibold rounded-xl px-3 py-2 border ${
              pressureMode
                ? "bg-amber-900/30 border-amber-500/60 text-amber-100"
                : "bg-slate-900/40 border-slate-700/70 text-slate-200"
            }`}
            title="Pressure Mode: réponses C1-acceptables, contexte plus riche"
          >
            <Zap className="w-4 h-4" />
            Pressure Mode: {pressureMode ? "ON" : "OFF"}
          </button>

          <Button
            onClick={runDeepAnalysis}
            disabled={loading || !hasData}
            className="rounded-xl bg-slate-100 text-slate-900 hover:bg-white text-sm font-semibold disabled:opacity-50"
            title={!hasData ? "Fais au moins une rédaction + un quiz d’abord" : ""}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Analyse…
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Lancer l’analyse
              </>
            )}
          </Button>
        </div>
      </header>

      {!hasData && (
        <Card className="bg-slate-900/40 border border-slate-700/60 shadow-xl rounded-2xl">
          <CardContent className="p-5 text-sm text-slate-300">
            <div className="font-semibold text-slate-100 mb-1">
              Pas encore de données.
            </div>
            <div className="text-slate-400">
              Fais une rédaction sur la page principale, génère des exercices,
              puis clique “Corriger les exercices” (ça enregistre tes erreurs).
              Ensuite reviens ici.
            </div>
          </CardContent>
        </Card>
      )}

      {err && (
        <Card className="bg-red-900/20 border border-red-700/50 rounded-2xl">
          <CardContent className="p-4 text-sm text-red-200">{err}</CardContent>
        </Card>
      )}

      {/* ANALYSIS RESULT */}
      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="grid md:grid-cols-3 gap-6"
        >
          <Card
            className={`shadow-xl rounded-2xl border ${levelBadgeClasses(
              analysis.estimatedLevel
            )}`}
          >
            <CardContent className="p-5">
              <div className="text-xs uppercase tracking-wide opacity-80">
                Niveau estimé
              </div>
              <div className="text-xl font-semibold mt-1">
                {analysis.estimatedLevel}
              </div>
              <div className="text-[11px] opacity-80 mt-2">
                Indication basée sur tes textes + tes erreurs de quiz.
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border border-slate-700/60 shadow-xl rounded-2xl md:col-span-2">
            <CardContent className="p-5">
              <div className="text-slate-200 font-semibold mb-2">
                Synthèse coach (C1)
              </div>
              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {analysis.summary}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border border-slate-700/60 shadow-xl rounded-2xl md:col-span-3">
            <CardContent className="p-5">
              <div className="text-slate-200 font-semibold mb-2">
                6 piliers (score + plan)
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {analysis.pillarScores.map((p, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950/40 border border-slate-700/60 rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-slate-100 font-semibold text-sm">
                        {p.pillar}
                      </div>
                      <div className="text-slate-200 text-sm font-semibold">
                        {p.score}/100
                      </div>
                    </div>
                    <div className="text-[12px] text-slate-400 mt-2 whitespace-pre-wrap">
                      <span className="text-slate-300 font-semibold">Pourquoi:</span>{" "}
                      {p.why}
                    </div>
                    <div className="text-[12px] text-slate-400 mt-2 whitespace-pre-wrap">
                      <span className="text-slate-300 font-semibold">Next:</span>{" "}
                      {p.next}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border border-slate-700/60 shadow-xl rounded-2xl md:col-span-2">
            <CardContent className="p-5">
              <div className="text-slate-200 font-semibold mb-2">
                Erreurs fréquentes (ce qui bloque C1)
              </div>
              <div className="space-y-3">
                {analysis.frequentErrors.map((e, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950/40 border border-slate-700/60 rounded-xl p-3"
                  >
                    <div className="text-slate-100 font-semibold">{e.label}</div>
                    <div className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">
                      <span className="text-slate-300 font-semibold">
                        Pourquoi bloque:
                      </span>{" "}
                      {e.whyBlocksC1}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">
                      <span className="text-slate-300 font-semibold">
                        Pattern:
                      </span>{" "}
                      {e.pattern}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">
                      <span className="text-slate-300 font-semibold">Fix:</span>{" "}
                      {e.fix}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border border-slate-700/60 shadow-xl rounded-2xl">
            <CardContent className="p-5">
              <div className="text-slate-200 font-semibold mb-2">
                Phrases “push” vers C1
              </div>
              <div className="space-y-3">
                {analysis.c1PushPhrases.map((x, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950/40 border border-slate-700/60 rounded-xl p-3"
                  >
                    <div className="text-xs text-slate-400 whitespace-pre-wrap">
                      <span className="text-slate-300 font-semibold">Faible:</span>{" "}
                      {x.weak}
                    </div>
                    <div className="text-xs text-emerald-200 mt-1 whitespace-pre-wrap">
                      <span className="text-emerald-100 font-semibold">
                        C1:
                      </span>{" "}
                      {x.strong}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-2 whitespace-pre-wrap">
                      {x.why}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* TEMPLATES */}
      <Card className="bg-slate-900/40 border border-slate-700/60 shadow-xl rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-slate-200 font-semibold flex items-center gap-2">
                <ListChecks className="w-4 h-4" />
                Templates de drills (C1)
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Clique un template pour générer un set. Pressure Mode rend les
                options “piégeuses mais réalistes”.
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 mt-4">
            {TEMPLATES.map((t) => (
              <div
                key={t.id}
                className="bg-slate-950/40 border border-slate-700/60 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-slate-100 font-semibold">{t.title}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {t.subtitle}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-2">
                      Pilier: <span className="text-slate-300">{t.pillar}</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    disabled={loading || !hasData}
                    onClick={() => generateFromTemplate(t.id)}
                    className="rounded-xl bg-slate-100 text-slate-900 hover:bg-white text-[11px] font-semibold disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin mr-2" />
                        …
                      </>
                    ) : (
                      "Générer"
                    )}
                  </Button>
                </div>

                <ul className="mt-3 text-xs text-slate-300 list-disc list-inside space-y-1">
                  {t.whatItTrains.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* GENERATED EXERCISES */}
      <Card className="bg-slate-900/40 border border-slate-700/60 shadow-xl rounded-2xl">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-slate-200 font-semibold">
                Drills (Pressure Mode compatible)
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Les titres/contexts doivent remplacer “MCQ” répétitif.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={gradeExercises}
                disabled={!exercises.length || checked}
                className="rounded-xl bg-slate-100 text-slate-900 hover:bg-white text-[11px] font-semibold disabled:opacity-50"
              >
                Corriger
              </Button>

              {score10 !== null && (
                <div className="text-xs text-slate-200">
                  Score: <span className="font-semibold">{score10}/10</span>
                </div>
              )}
            </div>
          </div>

          {!exercises.length ? (
            <div className="text-xs text-slate-400 mt-4">
              Lance l’analyse ou génère un template pour voir des questions ici.
            </div>
          ) : (
            <ul className="space-y-3 mt-4">
              {exercises.map((ex) => {
                const key = ex.uiId || ex.id;
                const heading =
                  ex.title ||
                  (ex.pillar ? `${ex.pillar}` : ex.type.toUpperCase());

                return (
                  <li
                    key={key}
                    className="text-xs text-slate-300 bg-slate-950/40 border border-slate-700/60 rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-slate-100 font-semibold">
                          {heading}
                        </div>
                        {ex.context && (
                          <div className="text-[11px] text-slate-400 mt-1 whitespace-pre-wrap">
                            <span className="text-slate-300 font-semibold">
                              Contexte:
                            </span>{" "}
                            {ex.context}
                          </div>
                        )}
                      </div>

                      {checked && (
                        <div className="text-[11px]">
                          {results[key] === "correct" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-300">
                              <CheckCircle className="w-4 h-4" />
                              Bon
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-300">
                              <XCircle className="w-4 h-4" />
                              Faux
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-slate-200 whitespace-pre-wrap">
                      {ex.prompt}
                    </div>
                    <div className="mt-1 text-slate-400 whitespace-pre-wrap">
                      {ex.instruction}
                    </div>

                    {ex.choices && ex.choices.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {ex.choices.map((choice, idx) => {
                          const selected = answers[key] === choice;

                          let icon = null;
                          if (checked) {
                            const correctAnswers = Array.isArray(ex.answer)
                              ? ex.answer
                              : [ex.answer];
                            const isCorrectAnswer =
                              correctAnswers.includes(choice);
                            const result = results[key];

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
                              disabled={checked}
                              onClick={() =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [key]: choice,
                                }))
                              }
                              className={choiceClasses(ex, choice, selected)}
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

                    <details className="mt-3">
                      <summary className="cursor-pointer text-slate-200">
                        Voir la solution
                      </summary>
                      <div className="mt-2">
                        <div className="text-emerald-200 whitespace-pre-wrap">
                          <span className="font-semibold">Réponse:</span>{" "}
                          {Array.isArray(ex.answer)
                            ? ex.answer.join(" / ")
                            : ex.answer}
                        </div>
                        <div className="text-slate-400 mt-2 whitespace-pre-wrap">
                          <span className="font-semibold">Explication:</span>{" "}
                          {ex.explanation}
                        </div>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <footer className="text-[11px] text-slate-500 text-center leading-relaxed max-w-3xl mx-auto pb-10">
        <p className="font-semibold text-slate-400 mb-1">
          Next step (API):
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Implémenter <span className="text-slate-300">deep-analysis.php</span>{" "}
            avec sorties JSON strictes.
          </li>
          <li>
            En Pressure Mode: “plusieurs réponses possibles”, 1 seule “C1
            acceptable”.
          </li>
          <li>
            Retourner des exercices avec{" "}
            <span className="text-slate-300">title</span> +{" "}
            <span className="text-slate-300">context</span> pour éviter
            l’étiquette “MCQ” répétée.
          </li>
        </ul>
      </footer>
    </div>
  );
}
