import { addDays } from "./game-rules";

// Weekly quests: small, achievable goals that reset every Monday. Progress only
// counts the player's own activity (never preloaded sample history), and the
// XP is claimed once per quest per week.

export type QuestMetric = "battles" | "practiceMinutes" | "battleModes" | "activeDays" | "conversations" | "coach";

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  metric: QuestMetric;
  target: number;
  xp: number;
  /** Where to go to make progress. */
  href: string;
  color: "violet" | "pink" | "orange" | "sky" | "mint" | "sun";
}

export const WEEKLY_QUESTS: QuestDef[] = [
  { id: "battle-royale", title: "Battle Royale", description: "Finish 3 Speaking Battles", metric: "battles", target: 3, xp: 40, href: "/battles", color: "pink" },
  { id: "mix-it-up", title: "Mix It Up", description: "Play 3 different battle types", metric: "battleModes", target: 3, xp: 50, href: "/battles", color: "violet" },
  { id: "chatterbox", title: "Chatterbox", description: "Log 15 minutes of speaking practice", metric: "practiceMinutes", target: 15, xp: 40, href: "/free-talk", color: "sky" },
  { id: "social-butterfly", title: "Social Butterfly", description: "Complete 2 Free Talk conversations", metric: "conversations", target: 2, xp: 40, href: "/free-talk", color: "mint" },
  { id: "coachs-pick", title: "Coach's Pick", description: "Finish 2 AI Coach exercises", metric: "coach", target: 2, xp: 30, href: "/coach", color: "sun" },
  { id: "show-up", title: "Show Up", description: "Practice on 4 different days", metric: "activeDays", target: 4, xp: 60, href: "/dashboard", color: "orange" },
];

export function getQuest(id: string) {
  return WEEKLY_QUESTS.find((q) => q.id === id);
}

/** Monday of the week containing `dateKey` (YYYY-MM-DD). */
export function weekStartOf(dateKey: string): string {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return addDays(dateKey, -((day + 6) % 7));
}

export function questKey(questId: string, weekStart: string) {
  return `quest:${questId}:${weekStart}`;
}
