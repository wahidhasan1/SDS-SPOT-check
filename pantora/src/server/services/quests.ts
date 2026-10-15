import type { DB } from "../db/sql";
import { all, get } from "../db/sql";
import { WEEKLY_QUESTS, getQuest, questKey, weekStartOf, type QuestDef, type QuestMetric } from "@/lib/quests";
import { addDays, levelForXp, type Level } from "@/lib/game-rules";
import { dateKeyInZone } from "@/lib/dates";
import { modeOfPromptId } from "@/content/battle-prompts";
import { awardXp, notify, totalXp } from "./gamification";
import { getProfile } from "./users";

export interface QuestProgress extends QuestDef {
  value: number;
  complete: boolean;
  claimed: boolean;
}

/** Quest metrics for one week, from the player's own (non-sample) completed sessions. */
export function weeklyMetrics(db: DB, userId: string, weekStart: string): Record<QuestMetric, number> {
  const weekEnd = addDays(weekStart, 6);
  const rows = all<{ type: string; practice_seconds: number; activity_date: string; prompt_id: string | null }>(
    db,
    `SELECT s.type, s.practice_seconds, s.activity_date, b.prompt_id FROM sessions s LEFT JOIN battles b ON b.session_id = s.id
     WHERE s.user_id = ? AND s.status = 'completed' AND s.origin != 'seed' AND s.activity_date BETWEEN ? AND ?`,
    userId,
    weekStart,
    weekEnd,
  );
  const modes = new Set(rows.filter((r) => r.prompt_id).map((r) => modeOfPromptId(r.prompt_id!)?.id).filter(Boolean));
  return {
    battles: rows.filter((r) => r.type === "battle").length,
    conversations: rows.filter((r) => r.type === "free_talk").length,
    coach: rows.filter((r) => r.type === "coach").length,
    practiceMinutes: Math.floor(rows.reduce((sum, r) => sum + r.practice_seconds, 0) / 60),
    activeDays: new Set(rows.map((r) => r.activity_date)).size,
    battleModes: modes.size,
  };
}

export function getWeeklyQuests(db: DB, userId: string, today: string) {
  const weekStart = weekStartOf(today);
  const metrics = weeklyMetrics(db, userId, weekStart);
  const claimed = new Set(
    all<{ k: string }>(db, "SELECT source_key AS k FROM xp_events WHERE user_id = ? AND source_key LIKE ?", userId, `quest:%:${weekStart}`).map((r) => r.k),
  );
  const quests: QuestProgress[] = WEEKLY_QUESTS.map((q) => {
    const value = Math.min(metrics[q.metric], q.target);
    return { ...q, value, complete: metrics[q.metric] >= q.target, claimed: claimed.has(questKey(q.id, weekStart)) };
  });
  const daysLeft = 7 - Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 86_400_000);
  return { weekStart, weekEnd: addDays(weekStart, 6), daysLeft, quests };
}

export class QuestError extends Error {}

/** Awards a completed quest's XP once. Throws QuestError when it can't be claimed. */
export function claimQuest(db: DB, userId: string, questId: string, at = new Date()): { xp: number; levelUp: Level | null; totalXp: number } {
  const quest = getQuest(questId);
  if (!quest) throw new QuestError("Unknown quest.");
  const profile = getProfile(db, userId);
  if (!profile) throw new QuestError("Profile not found.");
  const today = dateKeyInZone(at, profile.timezone);
  const { weekStart, quests } = getWeeklyQuests(db, userId, today);
  const progress = quests.find((q) => q.id === questId)!;
  if (progress.claimed) throw new QuestError("You already claimed this quest this week.");
  if (!progress.complete) throw new QuestError(`Keep going: ${progress.value}/${progress.target} done.`);
  const before = totalXp(db, userId);
  const awarded = awardXp(db, userId, { key: questKey(questId, weekStart), amount: quest.xp, reason: `Weekly quest: ${quest.title}` }, today, at);
  if (!awarded) throw new QuestError("You already claimed this quest this week.");
  const after = before + quest.xp;
  const oldLevel = levelForXp(before).current;
  const newLevel = levelForXp(after).current;
  const levelUp = newLevel.index > oldLevel.index ? newLevel : null;
  if (levelUp) {
    notify(db, userId, { kind: "level", title: `New level: ${levelUp.name}`, body: levelUp.description, href: "/achievements", dedupeKey: `level:${levelUp.index}`, at });
  }
  return { xp: quest.xp, levelUp, totalXp: after };
}

export function hasClaimedQuest(db: DB, userId: string, questId: string, weekStart: string) {
  return Boolean(get(db, "SELECT 1 FROM xp_events WHERE user_id = ? AND source_key = ?", userId, questKey(questId, weekStart)));
}
