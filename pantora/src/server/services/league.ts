import type { DB } from "../db/sql";
import { get } from "../db/sql";
import { addDays, levelForXp } from "@/lib/game-rules";
import { weekStartOf } from "@/lib/quests";
import { DEMO_PARTNERS } from "@/content/partners";
import { totalXp } from "./gamification";

// Weekly demo league. The other players are Pantora's fictional demo partners
// and their XP is simulated (deterministic per week), so the league is clearly
// labeled as a demo. Only the player's own XP is real.

const TIERS = ["Bronze", "Silver", "Gold", "Sapphire", "Diamond"];

function hash(text: string) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

export interface LeagueEntry {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  rank: number;
  isYou: boolean;
}

export function getWeeklyLeague(db: DB, user: { id: string; displayName: string; avatar: string }, today: string) {
  const weekStart = weekStartOf(today);
  const weekEnd = addDays(weekStart, 6);
  const dayIndex = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 86_400_000);
  const youXp =
    get<{ xp: number }>(db, "SELECT COALESCE(SUM(amount), 0) AS xp FROM xp_events WHERE user_id = ? AND activity_date BETWEEN ? AND ?", user.id, weekStart, weekEnd)?.xp ?? 0;
  const elapsed = (dayIndex + 1) / 7;
  const players = DEMO_PARTNERS.map((p) => {
    const h = hash(`${weekStart}:${p.id}`);
    const weeklyPace = 90 + (h % 330);
    const jitter = 0.85 + ((h >>> 9) % 30) / 100;
    return { id: p.id, name: p.displayName, avatar: p.avatar, xp: Math.round(weeklyPace * elapsed * jitter), isYou: false };
  });
  const all = [...players, { id: user.id, name: user.displayName, avatar: user.avatar, xp: youXp, isYou: true }]
    .sort((a, b) => b.xp - a.xp || Number(b.isYou) - Number(a.isYou))
    .map((e, i) => ({ ...e, rank: i + 1 }));
  const you = all.find((e) => e.isYou)!;
  const ahead = you.rank > 1 ? all[you.rank - 2] : null;
  const tier = TIERS[Math.min(levelForXp(totalXp(db, user.id)).current.index, TIERS.length) - 1];
  return {
    tier: `${tier} League`,
    weekStart,
    weekEnd,
    daysLeft: 7 - dayIndex,
    entries: all as LeagueEntry[],
    you,
    xpToPass: ahead ? ahead.xp - you.xp + 1 : 0,
    aheadName: ahead?.name ?? null,
  };
}
