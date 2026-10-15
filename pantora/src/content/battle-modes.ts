import type { Difficulty } from "@/lib/types";

// Battle types. Each prompt in battle-prompts.ts belongs to exactly one type;
// the type sets the timers and the XP a finished battle earns.

export const BATTLE_MODE_IDS = ["quick-fire", "describe-it", "opinion-clash", "story-sprint", "big-question", "free-play"] as const;
export type BattleModeId = (typeof BATTLE_MODE_IDS)[number];
/** Types that own prompts. Free Play reuses prompts from all of them. */
export type PromptModeId = Exclude<BattleModeId, "free-play">;

export type ModeColor = "sun" | "sky" | "pink" | "mint" | "violet" | "orange";

export interface BattleMode {
  id: BattleModeId;
  name: string;
  tagline: string;
  description: string;
  /** Short steps shown in the detail view. */
  howItWorks: string[];
  /** What this type trains, in plain words. */
  skills: string[];
  prepSeconds: number;
  speakSeconds: number;
  difficulty: Difficulty | "mixed";
  /** XP for finishing (win, draw, or loss). Free Play earns the XP of the prompt's own type. */
  xp: number;
  color: ModeColor;
}

export const BATTLE_MODES: BattleMode[] = [
  {
    id: "quick-fire",
    name: "Quick Fire",
    tagline: "30 seconds. No overthinking.",
    description: "Fast, everyday questions. Answer on instinct and keep talking until the buzzer.",
    howItWorks: ["10 seconds to think", "30 seconds to answer", "Keep going: fluency beats perfection"],
    skills: ["Fluency", "Confidence"],
    prepSeconds: 10,
    speakSeconds: 30,
    difficulty: "easy",
    xp: 30,
    color: "sun",
  },
  {
    id: "describe-it",
    name: "Describe It",
    tagline: "Paint a picture with words.",
    description: "Describe a place, a meal, or a thing so clearly that your listener can see it.",
    howItWorks: ["15 seconds to picture it", "45 seconds to describe it", "Use colors, sounds, and feelings"],
    skills: ["Vocabulary", "Detail"],
    prepSeconds: 15,
    speakSeconds: 45,
    difficulty: "easy",
    xp: 35,
    color: "sky",
  },
  {
    id: "opinion-clash",
    name: "Opinion Clash",
    tagline: "Pick a side. Defend it.",
    description: "Hot takes on real debates. Choose your side, give reasons, and back them up.",
    howItWorks: ["20 seconds to pick a side", "45 seconds to argue it", "Reason + example + conclusion"],
    skills: ["Arguments", "Linking words"],
    prepSeconds: 20,
    speakSeconds: 45,
    difficulty: "medium",
    xp: 40,
    color: "pink",
  },
  {
    id: "story-sprint",
    name: "Story Sprint",
    tagline: "Beginning, middle, twist, end.",
    description: "Tell a true or made-up story in one minute. Set the scene, build up, and land the ending.",
    howItWorks: ["30 seconds to plan", "60 seconds to tell it", "Past tenses and time words help"],
    skills: ["Past tenses", "Sequencing"],
    prepSeconds: 30,
    speakSeconds: 60,
    difficulty: "medium",
    xp: 40,
    color: "mint",
  },
  {
    id: "big-question",
    name: "Big Question",
    tagline: "Deep thoughts, one minute.",
    description: "Big ideas about life, tech, and the future. Explain your thinking with a real example.",
    howItWorks: ["30 seconds to think", "60 seconds to explain", "Define, explain, give an example"],
    skills: ["Complex ideas", "Examples"],
    prepSeconds: 30,
    speakSeconds: 60,
    difficulty: "challenging",
    xp: 50,
    color: "violet",
  },
  {
    id: "free-play",
    name: "Free Play",
    tagline: "Your prompt. Your rules.",
    description: "Pick any prompt from any battle type, or shuffle, and set your own preparation and speaking time.",
    howItWorks: ["Choose a prompt or shuffle", "Set your own timers", "Earns the XP of the prompt's type"],
    skills: ["Anything you like"],
    prepSeconds: 30,
    speakSeconds: 45,
    difficulty: "mixed",
    xp: 0,
    color: "orange",
  },
];

export function getBattleMode(id: string | null | undefined): BattleMode | undefined {
  return BATTLE_MODES.find((m) => m.id === id);
}

/** XP range shown for a mode (Free Play depends on the prompt). */
export function modeXpLabel(mode: BattleMode) {
  if (mode.id !== "free-play") return `${mode.xp} XP`;
  const xps = BATTLE_MODES.filter((m) => m.id !== "free-play").map((m) => m.xp);
  return `${Math.min(...xps)}–${Math.max(...xps)} XP`;
}

export const MODE_COLOR_CLASSES: Record<ModeColor, { card: string; soft: string; text: string; chip: string; ring: string }> = {
  sun: { card: "from-sun-300 to-orange-400", soft: "bg-sun-50", text: "text-sun-700", chip: "bg-sun-100 text-sun-700", ring: "ring-sun-400" },
  sky: { card: "from-sky-300 to-sky-500", soft: "bg-sky-50", text: "text-sky-700", chip: "bg-sky-100 text-sky-700", ring: "ring-sky-400" },
  pink: { card: "from-pink-300 to-pink-500", soft: "bg-pink-50", text: "text-pink-700", chip: "bg-pink-100 text-pink-700", ring: "ring-pink-400" },
  mint: { card: "from-mint-300 to-mint-500", soft: "bg-mint-50", text: "text-mint-700", chip: "bg-mint-100 text-mint-700", ring: "ring-mint-400" },
  violet: { card: "from-brand-300 to-brand-500", soft: "bg-brand-50", text: "text-brand-700", chip: "bg-brand-100 text-brand-700", ring: "ring-brand-400" },
  orange: { card: "from-orange-300 to-pink-400", soft: "bg-orange-50", text: "text-orange-700", chip: "bg-orange-100 text-orange-700", ring: "ring-orange-400" },
};
