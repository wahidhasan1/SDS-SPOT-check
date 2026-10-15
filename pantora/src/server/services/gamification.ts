import type { DB } from "../db/sql";
import { all, get, newId, run, tx } from "../db/sql";
import {
  ACHIEVEMENTS,
  STREAK_MILESTONES,
  STREAK_MIN_SECONDS,
  XP_RULES,
  computeStreaks,
  eligibleAchievements,
  levelForXp,
  streakBonusXp,
  type AchievementDef,
  type AchievementStats,
  type Level,
} from "@/lib/game-rules";
import { dateKeyInZone } from "@/lib/dates";
import type { SessionOrigin, SessionStatus, SessionType } from "@/lib/types";
import { getProfile, getSettings } from "./users";
import { modeOfPromptId } from "@/content/battle-prompts";

// Records completed practice and applies every reward rule in one transaction.
// Rewards are keyed by `source_key`, so replaying the same request (page
// refresh, double submit) can never award XP or achievements twice.

export interface XpItem {
  key: string;
  amount: number;
  reason: string;
  /** Keys are scoped to the session unless global (e.g. once-per-day bonuses). */
  global?: boolean;
}

export interface RecordSessionInput {
  userId: string;
  type: SessionType;
  partner?: { id: string; kind: "demo_partner" | "user"; name: string } | null;
  topicId?: string | null;
  promptText?: string | null;
  plannedSeconds?: number | null;
  durationSeconds: number;
  practiceSeconds: number;
  startedAt: Date;
  endedAt: Date;
  status: SessionStatus;
  endReason?: string | null;
  origin: SessionOrigin;
  idempotencyKey: string;
  /** Session-specific XP (e.g. conversation or battle XP). Keys are prefixed automatically. */
  xp?: XpItem[];
}

export interface Rewards {
  xpItems: XpItem[];
  xpTotal: number;
  newAchievements: Pick<AchievementDef, "id" | "name" | "description" | "icon">[];
  streak: { current: number; longest: number; extendedToday: boolean; milestone: number | null };
  goal: { reachedNow: boolean; practiceSecondsToday: number; goalSeconds: number };
  levelUp: Level | null;
}

export interface RecordSessionResult {
  sessionId: string;
  created: boolean;
  rewards: Rewards;
}

export function totalXp(db: DB, userId: string): number {
  return get<{ xp: number }>(db, "SELECT COALESCE(SUM(amount), 0) AS xp FROM xp_events WHERE user_id = ?", userId)?.xp ?? 0;
}

export function awardXp(db: DB, userId: string, item: XpItem, activityDate: string, at: Date): boolean {
  const result = run(
    db,
    `INSERT OR IGNORE INTO xp_events (id, user_id, source_key, amount, reason, activity_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    userId,
    item.key,
    item.amount,
    item.reason,
    activityDate,
    at.toISOString(),
  );
  if (result.changes === 0) return false;
  run(
    db,
    `INSERT INTO user_activity (user_id, activity_date, practice_seconds, xp_earned, session_count) VALUES (?, ?, 0, ?, 0)
     ON CONFLICT (user_id, activity_date) DO UPDATE SET xp_earned = xp_earned + excluded.xp_earned`,
    userId,
    activityDate,
    item.amount,
  );
  return true;
}

export function notify(
  db: DB,
  userId: string,
  n: { kind: string; title: string; body: string; href?: string | null; dedupeKey?: string | null; at?: Date },
) {
  run(
    db,
    `INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, href, dedupe_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    userId,
    n.kind,
    n.title,
    n.body,
    n.href ?? null,
    n.dedupeKey ?? null,
    (n.at ?? new Date()).toISOString(),
  );
}

export function qualifyingDays(db: DB, userId: string): string[] {
  return all<{ d: string }>(
    db,
    "SELECT activity_date AS d FROM user_activity WHERE user_id = ? AND practice_seconds >= ?",
    userId,
    STREAK_MIN_SECONDS,
  ).map((r) => r.d);
}

export function achievementStats(db: DB, userId: string, today: string): AchievementStats {
  const one = (sql: string, ...params: (string | number)[]) => get<{ n: number }>(db, sql, ...params)?.n ?? 0;
  const goal = get<{ g: number }>(db, "SELECT daily_goal_minutes AS g FROM users WHERE id = ?", userId)?.g ?? 10;
  return {
    conversations: one("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND type = 'free_talk' AND status = 'completed'", userId),
    battles: one("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND type = 'battle' AND status = 'completed'", userId),
    coachSessions: one("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND type = 'coach' AND status = 'completed'", userId),
    longestStreak: computeStreaks(qualifyingDays(db, userId), today).longest,
    practiceMinutes: Math.floor(one("SELECT COALESCE(SUM(practice_seconds), 0) AS n FROM user_activity WHERE user_id = ?", userId) / 60),
    reviews:
      one("SELECT COUNT(*) AS n FROM feedback WHERE user_id = ? AND reviewed_at IS NOT NULL", userId) +
      one(
        `SELECT COUNT(*) AS n FROM transcript_entries e JOIN transcripts t ON t.id = e.transcript_id JOIN sessions s ON s.id = t.session_id
         WHERE s.user_id = ? AND e.reviewed_at IS NOT NULL`,
        userId,
      ) +
      one("SELECT COUNT(*) AS n FROM saved_sentences WHERE user_id = ? AND reviewed_at IS NOT NULL", userId),
    topicCategories: one(
      `SELECT COUNT(DISTINCT t.category) AS n FROM sessions s JOIN topics t ON t.id = s.topic_id WHERE s.user_id = ? AND s.status = 'completed'`,
      userId,
    ),
    savedSentences: one("SELECT COUNT(*) AS n FROM saved_sentences WHERE user_id = ?", userId),
    goalDays: one("SELECT COUNT(*) AS n FROM user_activity WHERE user_id = ? AND practice_seconds >= ?", userId, goal * 60),
  };
}

/** Unlocks any newly eligible achievements. Safe to call repeatedly. */
export function evaluateAchievements(db: DB, userId: string, at: Date, opts: { silent?: boolean } = {}) {
  const profile = getProfile(db, userId);
  if (!profile) return [];
  const today = dateKeyInZone(at, profile.timezone);
  const stats = achievementStats(db, userId, today);
  const unlocked = new Set(
    all<{ id: string }>(db, "SELECT achievement_id AS id FROM user_achievements WHERE user_id = ?", userId).map((r) => r.id),
  );
  const settings = getSettings(db, userId, profile);
  const fresh: AchievementDef[] = [];
  for (const id of eligibleAchievements(stats)) {
    if (unlocked.has(id)) continue;
    const def = ACHIEVEMENTS.find((a) => a.id === id)!;
    run(db, "INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)", userId, id, at.toISOString());
    fresh.push(def);
    if (!opts.silent && settings.notifications.achievementNotifications) {
      notify(db, userId, {
        kind: "achievement",
        title: `Achievement unlocked: ${def.name}`,
        body: def.description,
        href: "/achievements",
        dedupeKey: `achievement:${id}`,
        at,
      });
    }
  }
  return fresh;
}

function applyDailyRewards(db: DB, userId: string, activityDate: string, at: Date, silent: boolean) {
  const profile = getProfile(db, userId)!;
  const settings = getSettings(db, userId, profile);
  const day = get<{ practice_seconds: number }>(
    db,
    "SELECT practice_seconds FROM user_activity WHERE user_id = ? AND activity_date = ?",
    userId,
    activityDate,
  );
  const practiceSecondsToday = day?.practice_seconds ?? 0;
  const goalSeconds = profile.dailyGoalMinutes * 60;
  const items: XpItem[] = [];

  let goalReachedNow = false;
  if (practiceSecondsToday >= goalSeconds) {
    const item = { key: `goal:${activityDate}`, amount: XP_RULES.dailyGoal, reason: "Daily practice goal reached" };
    if (awardXp(db, userId, item, activityDate, at)) {
      goalReachedNow = true;
      items.push(item);
    }
  }

  const streaks = computeStreaks(qualifyingDays(db, userId), activityDate);
  let extendedToday = false;
  let milestone: number | null = null;
  if (streaks.practicedToday) {
    const item = {
      key: `streak:${activityDate}`,
      amount: streakBonusXp(streaks.current),
      reason: `Practiced on ${streaks.current} day${streaks.current === 1 ? "" : "s"} in a row`,
    };
    if (awardXp(db, userId, item, activityDate, at)) {
      extendedToday = true;
      items.push(item);
      if (STREAK_MILESTONES.includes(streaks.current)) {
        milestone = streaks.current;
        if (!silent && settings.notifications.achievementNotifications) {
          notify(db, userId, {
            kind: "streak",
            title: `${streaks.current}-day streak!`,
            body: `You have practiced ${streaks.current} days in a row. Keep the momentum going.`,
            href: "/progress",
            dedupeKey: `streak-milestone:${activityDate}`,
            at,
          });
        }
      }
    }
  }
  if (goalReachedNow && !silent && settings.notifications.achievementNotifications) {
    notify(db, userId, {
      kind: "goal",
      title: "Daily goal reached",
      body: `You completed your ${profile.dailyGoalMinutes}-minute practice goal today.`,
      href: "/progress",
      dedupeKey: `goal:${activityDate}`,
      at,
    });
  }
  return {
    items,
    streak: { current: streaks.current, longest: streaks.longest, extendedToday, milestone },
    goal: { reachedNow: goalReachedNow, practiceSecondsToday, goalSeconds },
  };
}

export function recordSession(db: DB, input: RecordSessionInput, opts: { silent?: boolean } = {}): RecordSessionResult {
  return tx(db, () => {
    const existing = get<{ id: string }>(
      db,
      "SELECT id FROM sessions WHERE user_id = ? AND idempotency_key = ?",
      input.userId,
      input.idempotencyKey,
    );
    const profile = getProfile(db, input.userId);
    if (!profile) throw new Error("User not found");
    const activityDate = dateKeyInZone(input.endedAt, profile.timezone);

    if (existing) {
      const streaks = computeStreaks(qualifyingDays(db, input.userId), activityDate);
      const day = get<{ practice_seconds: number }>(db, "SELECT practice_seconds FROM user_activity WHERE user_id = ? AND activity_date = ?", input.userId, activityDate);
      return {
        sessionId: existing.id,
        created: false,
        rewards: {
          xpItems: [],
          xpTotal: 0,
          newAchievements: [],
          streak: { current: streaks.current, longest: streaks.longest, extendedToday: false, milestone: null },
          goal: { reachedNow: false, practiceSecondsToday: day?.practice_seconds ?? 0, goalSeconds: profile.dailyGoalMinutes * 60 },
          levelUp: null,
        },
      };
    }

    const xpBefore = totalXp(db, input.userId);
    const sessionId = newId();
    const completed = input.status === "completed";
    const practiceSeconds = completed ? Math.max(0, Math.round(input.practiceSeconds)) : 0;
    run(
      db,
      `INSERT INTO sessions (id, user_id, type, partner_id, partner_kind, partner_name, topic_id, prompt_text, planned_seconds,
        duration_seconds, practice_seconds, started_at, ended_at, activity_date, status, end_reason, origin, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sessionId,
      input.userId,
      input.type,
      input.partner?.id ?? null,
      input.partner?.kind ?? null,
      input.partner?.name ?? null,
      input.topicId ?? null,
      input.promptText ?? null,
      input.plannedSeconds ?? null,
      Math.max(0, Math.round(input.durationSeconds)),
      practiceSeconds,
      input.startedAt.toISOString(),
      input.endedAt.toISOString(),
      activityDate,
      input.status,
      input.endReason ?? null,
      input.origin,
      input.idempotencyKey,
      input.endedAt.toISOString(),
    );

    let items: XpItem[] = [];
    let daily: ReturnType<typeof applyDailyRewards> | null = null;
    let fresh: AchievementDef[] = [];
    if (completed) {
      run(
        db,
        `INSERT INTO user_activity (user_id, activity_date, practice_seconds, xp_earned, session_count) VALUES (?, ?, ?, 0, 1)
         ON CONFLICT (user_id, activity_date) DO UPDATE SET practice_seconds = practice_seconds + excluded.practice_seconds, session_count = session_count + 1`,
        input.userId,
        activityDate,
        practiceSeconds,
      );
      for (const item of input.xp ?? []) {
        const { global, ...rest } = item;
        const keyed = global ? rest : { ...rest, key: `session:${sessionId}:${item.key}` };
        if (awardXp(db, input.userId, keyed, activityDate, input.endedAt)) items.push(keyed);
      }
      daily = applyDailyRewards(db, input.userId, activityDate, input.endedAt, !!opts.silent);
      items = [...items, ...daily.items];
      fresh = evaluateAchievements(db, input.userId, input.endedAt, opts);
    }

    const xpTotal = items.reduce((sum, i) => sum + i.amount, 0);
    run(db, "UPDATE sessions SET xp_awarded = ? WHERE id = ?", xpTotal, sessionId);
    const before = levelForXp(xpBefore).current;
    const after = levelForXp(xpBefore + xpTotal).current;
    const levelUp = after.index > before.index ? after : null;
    if (levelUp && !opts.silent) {
      notify(db, input.userId, {
        kind: "level",
        title: `New level: ${levelUp.name}`,
        body: levelUp.description,
        href: "/achievements",
        dedupeKey: `level:${levelUp.index}`,
        at: input.endedAt,
      });
    }
    const streaks = daily?.streak ?? { ...computeStreaks(qualifyingDays(db, input.userId), activityDate), extendedToday: false, milestone: null };
    return {
      sessionId,
      created: true,
      rewards: {
        xpItems: items,
        xpTotal,
        newAchievements: fresh.map(({ id, name, description, icon }) => ({ id, name, description, icon })),
        streak: { current: streaks.current, longest: streaks.longest, extendedToday: daily?.streak.extendedToday ?? false, milestone: daily?.streak.milestone ?? null },
        goal: daily?.goal ?? { reachedNow: false, practiceSecondsToday: 0, goalSeconds: profile.dailyGoalMinutes * 60 },
        levelUp,
      },
    };
  });
}

/** Marks a piece of feedback as reviewed and awards review XP once. */
export function recordReview(db: DB, userId: string, kind: "feedback" | "entry" | "saved", id: string, at = new Date()) {
  return tx(db, () => {
    const profile = getProfile(db, userId)!;
    const date = dateKeyInZone(at, profile.timezone);
    const awarded = awardXp(db, userId, { key: `review:${kind}:${id}`, amount: XP_RULES.review, reason: "Reviewed feedback" }, date, at);
    const fresh = evaluateAchievements(db, userId, at);
    return { xp: awarded ? XP_RULES.review : 0, newAchievements: fresh.map(({ id, name, description, icon }) => ({ id, name, description, icon })) };
  });
}

/**
 * XP items for a finished battle: the battle type's XP, a personal-best bonus
 * when the score beats the previous best, and a once-per-day bonus for
 * finishing that day's Daily Challenge.
 */
export function battleXpItems(db: DB, userId: string, userScore: number | null, promptId?: string, opts: { dailyChallengeDate?: string | null } = {}): XpItem[] {
  const mode = promptId ? modeOfPromptId(promptId) : undefined;
  const items: XpItem[] = [
    mode
      ? { key: "battle", amount: mode.xp, reason: `Finished a ${mode.name} battle` }
      : { key: "battle", amount: XP_RULES.battle, reason: "Finished a Speaking Battle" },
  ];
  if (opts.dailyChallengeDate) {
    items.push({ key: `daily-challenge:${opts.dailyChallengeDate}`, amount: XP_RULES.dailyChallenge, reason: "Completed the Daily Challenge", global: true });
  }
  if (userScore != null) {
    const best = get<{ best: number | null }>(db, "SELECT MAX(user_score) AS best FROM battles WHERE user_id = ?", userId)?.best;
    if (best != null && userScore > best) {
      items.push({ key: "personal-best", amount: XP_RULES.battlePersonalBest, reason: `New personal best: ${userScore}/100` });
    }
  }
  return items;
}
