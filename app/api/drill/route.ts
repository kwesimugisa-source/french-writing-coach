import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type DrillCategory = {
  name: string;
  description: string;
  examples: string[];
  tips: string;
};

type BankItem = {
  category: string;
  id: string;
  type: string;
  prompt: string;
  instruction: string;
  choices: string[];
  answer: string;
  explanation: string;
};

function addCategory(
  categories: Record<string, DrillCategory>,
  key: string,
  name: string,
  description: string
) {
  if (!categories[key]) {
    categories[key] = {
      name,
      description,
      examples: [],
      tips: "",
    };
  }
}

export async function POST(req: Request) {
  try {
    const data: any = await req.json();

    const corrections = data?.corrections ?? "";
    const lowerCorr: string = String(corrections).toLowerCase();

    const categories: Record<string, DrillCategory> = {};

    if (lowerCorr === "") {
      addCategory(categories, "orthographe", "Orthographe de base", "Corriger les fautes d'orthographe fréquentes.");
      addCategory(categories, "accords", "Accords (genre et nombre)", "Bien accorder les adjectifs et participes passés.");
      addCategory(categories, "temps", "Choix des temps", "Utiliser le bon temps pour un récit ou une explication.");
    } else {
      if (lowerCorr.includes("orthographe") || lowerCorr.includes("faute") || lowerCorr.includes("accent")) {
        addCategory(categories, "orthographe", "Orthographe de base", "Corriger les fautes d'orthographe fréquentes.");
      }

      if (lowerCorr.includes("accord") || lowerCorr.includes("genre") || lowerCorr.includes("nombre")) {
        addCategory(categories, "accords", "Accords (genre et nombre)", "Bien accorder les adjectifs et participes passés.");
      }

      if (lowerCorr.includes("temps") || lowerCorr.includes("imparfait") || lowerCorr.includes("passé composé")) {
        addCategory(categories, "temps", "Choix des temps", "Choisir entre présent, imparfait et passé composé.");
      }

      if (lowerCorr.includes("registre") || lowerCorr.includes("trop familier")) {
        addCategory(categories, "registre", "Registre de langue", "Adapter le niveau de langue au contexte (formel / informel).");
      }

      if (Object.keys(categories).length === 0) {
        addCategory(categories, "orthographe", "Orthographe de base", "Corriger les fautes d'orthographe fréquentes.");
        addCategory(categories, "accords", "Accords (genre et nombre)", "Bien accorder les adjectifs et participes passés.");
        addCategory(categories, "temps", "Choix des temps", "Utiliser le bon temps pour un récit ou une explication.");
      }
    }

    const bank: BankItem[] = [
      {
        category: "orthographe",
        id: "ortho1",
        type: "choix",
        prompt: "Choisis la phrase correctement orthographiée.",
        instruction: "Une seule réponse est correcte.",
        choices: ["Je n'est jamais eu de problème.", "Je n'ai jamais eu de problème.", "Je n'ai jamais eu des problème."],
        answer: "Je n'ai jamais eu de problème.",
        explanation: "« n'ai » (pas « n'est ») et « de problème » au singulier.",
      },
      {
        category: "orthographe",
        id: "ortho2",
        type: "choix",
        prompt: "Choisis la bonne écriture.",
        instruction: "Une seule réponse est correcte.",
        choices: ["sa m'a beaucoup aidé.", "ça m'a beaucoup aidé.", "sa m'a beaucoup aidez."],
        answer: "ça m'a beaucoup aidé.",
        explanation: "« ça » (pronom démonstratif) + participe passé « aidé ».",
      },
      {
        category: "orthographe",
        id: "ortho3",
        type: "choix",
        prompt: "Choisis la forme correcte.",
        instruction: "Une seule réponse est correcte.",
        choices: ["Ils ont télécharger le document.", "Ils ont téléchargé le document.", "Ils ont téléchargez le document."],
        answer: "Ils ont téléchargé le document.",
        explanation: "Participe passé « téléchargé » avec l'auxiliaire « avoir ».",
      },
      {
        category: "accords",
        id: "acc1",
        type: "choix",
        prompt: "Choisis la phrase correctement accordée.",
        instruction: "Une seule réponse est correcte.",
        choices: ["Les informations que j'ai reçu.", "Les informations que j'ai reçues.", "Les informations que j'ai reçus."],
        answer: "Les informations que j'ai reçues.",
        explanation: "COD « informations » (fém. pl.) placé avant → « reçues ».",
      },
      {
        category: "accords",
        id: "acc2",
        type: "choix",
        prompt: "Choisis la bonne phrase.",
        instruction: "Une seule réponse est correcte.",
        choices: ["Elle est resté très motivée.", "Elle est restée très motivée.", "Elle est restées très motivé."],
        answer: "Elle est restée très motivée.",
        explanation: "Avec « être », le participe passé s'accorde avec le sujet (fém. sing.).",
      },
      {
        category: "accords",
        id: "acc3",
        type: "choix",
        prompt: "Choisis la phrase sans faute d'accord.",
        instruction: "Une seule réponse est correcte.",
        choices: ["Les collègues sont tous arrivés en retard.", "Les collègues sont tout arrivé en retard.", "Les collègue sont tous arrivées en retard."],
        answer: "Les collègues sont tous arrivés en retard.",
        explanation: "Sujet pluriel « collègues » → « arrivés ». « tous » s'accorde aussi.",
      },
      {
        category: "temps",
        id: "temps1",
        type: "choix",
        prompt: "Choisis le temps le plus naturel pour un récit au passé.",
        instruction: "Une seule réponse est correcte.",
        choices: ["Hier, je vais au travail et je rencontre mon patron.", "Hier, j'allais au travail et j'ai rencontré mon patron.", "Hier, je suis allé au travail et je rencontre mon patron."],
        answer: "Hier, j'allais au travail et j'ai rencontré mon patron.",
        explanation: "Imparfait pour la situation de fond, passé composé pour l'événement ponctuel.",
      },
      {
        category: "temps",
        id: "temps2",
        type: "choix",
        prompt: "Complète la phrase avec le bon temps.",
        instruction: "Choisis la meilleure option.",
        choices: ["Quand il est arrivé, nous mangeons déjà.", "Quand il est arrivé, nous mangions déjà.", "Quand il arrivait, nous avons mangé déjà."],
        answer: "Quand il est arrivé, nous mangions déjà.",
        explanation: "Action ponctuelle « il est arrivé », action en cours « nous mangions ».",
      },
      {
        category: "temps",
        id: "temps3",
        type: "choix",
        prompt: "Choisis la phrase correcte pour une habitude passée.",
        instruction: "Une seule réponse est correcte.",
        choices: ["Chaque été, nous allions à la mer.", "Chaque été, nous sommes allés à la mer.", "Chaque été, nous irons à la mer."],
        answer: "Chaque été, nous allions à la mer.",
        explanation: "L'imparfait exprime une habitude dans le passé.",
      },
      {
        category: "registre",
        id: "reg1",
        type: "choix",
        prompt: "Choisis la formulation la plus adaptée pour une lettre FORMELLE.",
        instruction: "Une seule réponse est correcte.",
        choices: ["Salut, j'espère que tu vas bien.", "Bonjour, j'espère que vous allez bien.", "Yo, ça va ?"],
        answer: "Bonjour, j'espère que vous allez bien.",
        explanation: "Registre poli + vouvoiement adapté à une lettre officielle.",
      },
      {
        category: "registre",
        id: "reg2",
        type: "choix",
        prompt: "Choisis la formulation adaptée pour un message à un ami.",
        instruction: "Une seule réponse est correcte.",
        choices: ["Monsieur, je vous prie d'agréer mes salutations distinguées.", "Yo, ça fait longtemps, comment tu vas ?", "Veuillez recevoir mes sincères salutations."],
        answer: "Yo, ça fait longtemps, comment tu vas ?",
        explanation: "Registre familier adapté à un ami.",
      },
    ];

    const categoryKeys = Object.keys(categories);

    const filtered: any[] = bank
      .filter((item) => categoryKeys.includes(item.category))
      .map(({ category, ...rest }) => rest);

    if (filtered.length < 10) {
      for (const item of bank) {
        if (filtered.length >= 10) break;
        const { category, ...rest } = item;
        filtered.push(rest);
      }
    }

    const exercises = filtered.slice(0, 10);

    return NextResponse.json({
      categories: Object.values(categories),
      exercises,
    });
  } catch (error) {
    console.error("drill route error:", error);

    return NextResponse.json({
      categories: [],
      exercises: [],
    });
  }
}