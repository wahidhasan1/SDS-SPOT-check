// Pure gamification rules. No I/O here, so they are easy to unit test and to
// explain in the UI.

/** A calendar day counts toward the streak once this much practice time is logged that day. */
export const STREAK_MIN_SECONDS = 120;

/** Conversations shorter than this are recorded as incomplete and earn no rewards. */
export const MIN_COMPLETED_CONVERSATION_SECONDS = 60;

export const XP_RULES = {
  conversationBase: 30,
  conversationPerMinute: 2,
  conversationMinuteCap: 30,
  /** Fallback battle XP; each battle type sets its own amount (30–50). */
  battle: 35,
  battlePersonalBest: 15,
  dailyChallenge: 20,
  coachTyped: 15,
  coachRecorded: 20,
  dailyGoal: 25,
  streakPerDay: 5,
  streakBonusCap: 10,
  review: 5,
} as const;

export const STREAK_RULE_TEXT =
  "A day counts toward your streak when you log at least 2 minutes of speaking practice (conversations plus recorded battle and coach answers) in your local time zone.";

export const PRACTICE_TIME_RULE_TEXT =
  "Practice time is the time you spend in a completed conversation, plus the length of recorded battle and coach answers. Typed answers earn XP but do not add speaking minutes.";

export function conversationXp(seconds: number): number {
  const minutes = Math.min(Math.floor(seconds / 60), XP_RULES.conversationMinuteCap);
  return XP_RULES.conversationBase + minutes * XP_RULES.conversationPerMinute;
}

export function streakBonusXp(streak: number): number {
  return XP_RULES.streakPerDay * Math.min(Math.max(streak, 1), XP_RULES.streakBonusCap);
}

// ---------- Levels ----------

export interface Level {
  index: number;
  name: string;
  minXp: number;
  description: string;
}

export const LEVELS: Level[] = [
  { index: 1, name: "First Words", minXp: 0, description: "You have started speaking. That is the hardest step." },
  { index: 2, name: "Brave Speaker", minXp: 250, description: "You keep showing up, even when it feels uncomfortable." },
  { index: 3, name: "Consistent Talker", minXp: 750, description: "Practice is becoming a habit." },
  { index: 4, name: "Confident Communicator", minXp: 1750, description: "You speak regularly across many topics." },
  { index: 5, name: "Global Speaker", minXp: 3500, description: "A seasoned Pantora regular." },
];

export function levelForXp(xp: number) {
  let current = LEVELS[0];
  for (const level of LEVELS) if (xp >= level.minXp) current = level;
  const next = LEVELS.find((l) => l.minXp > xp) ?? null;
  const span = next ? next.minXp - current.minXp : 1;
  const progress = next ? (xp - current.minXp) / span : 1;
  return { current, next, progress: Math.max(0, Math.min(1, progress)), xpToNext: next ? next.minXp - xp : 0 };
}

// ---------- Streaks ----------

/** Adds `days` to a YYYY-MM-DD key using UTC arithmetic (safe for plain dates). */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Current streak: consecutive qualifying days ending today. If today has not
 * qualified yet, the streak is still "alive" when it ends yesterday.
 */
export function computeStreaks(qualifyingDays: Iterable<string>, today: string) {
  const days = new Set(qualifyingDays);
  let current = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = day;
  }
  return { current, longest: Math.max(longest, current), practicedToday: days.has(today) };
}

// ---------- Achievements ----------

export type AchievementMetric =
  | "conversations"
  | "battles"
  | "longestStreak"
  | "practiceMinutes"
  | "reviews"
  | "topicCategories"
  | "savedSentences"
  | "coachSessions"
  | "goalDays";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  metric: AchievementMetric;
  target: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-conversation", name: "First Conversation", description: "Complete your first Free Talk conversation.", icon: "message-circle", metric: "conversations", target: 1 },
  { id: "five-conversations", name: "Five Conversations Completed", description: "Complete five Free Talk conversations.", icon: "messages-square", metric: "conversations", target: 5 },
  { id: "twenty-conversations", name: "Regular Voice", description: "Complete twenty Free Talk conversations.", icon: "audio-lines", metric: "conversations", target: 20 },
  { id: "first-battle", name: "First Speaking Battle", description: "Finish your first Speaking Battle.", icon: "swords", metric: "battles", target: 1 },
  { id: "ten-battles", name: "Battle Ready", description: "Finish ten Speaking Battles.", icon: "trophy", metric: "battles", target: 10 },
  { id: "seven-day-streak", name: "Seven-Day Streak", description: "Practice on seven days in a row.", icon: "flame", metric: "longestStreak", target: 7 },
  { id: "thirty-day-streak", name: "Habit Builder", description: "Practice on thirty days in a row.", icon: "calendar-check", metric: "longestStreak", target: 30 },
  { id: "one-hour", name: "One Hour of Speaking", description: "Log sixty minutes of speaking practice.", icon: "clock", metric: "practiceMinutes", target: 60 },
  { id: "five-hours", name: "Marathon Speaker", description: "Log five hours of speaking practice.", icon: "timer", metric: "practiceMinutes", target: 300 },
  { id: "ten-reviews", name: "Ten Feedback Reviews", description: "Mark ten pieces of feedback or corrections as reviewed.", icon: "check-check", metric: "reviews", target: 10 },
  { id: "topic-explorer", name: "Topic Explorer", description: "Practice topics from five different categories.", icon: "compass", metric: "topicCategories", target: 5 },
  { id: "sentence-collector", name: "Sentence Collector", description: "Save ten improved sentences to My Learning.", icon: "bookmark", metric: "savedSentences", target: 10 },
  { id: "coach-student", name: "Coach's Student", description: "Complete three AI Coach exercises.", icon: "graduation-cap", metric: "coachSessions", target: 3 },
  { id: "goal-getter", name: "Goal Getter", description: "Reach your daily practice goal on five days.", icon: "target", metric: "goalDays", target: 5 },
];

export type AchievementStats = Record<AchievementMetric, number>;

export function achievementProgress(def: AchievementDef, stats: AchievementStats) {
  const value = stats[def.metric] ?? 0;
  return { value: Math.min(value, def.target), target: def.target, ratio: Math.min(1, value / def.target), eligible: value >= def.target };
}

export function eligibleAchievements(stats: AchievementStats): string[] {
  return ACHIEVEMENTS.filter((a) => achievementProgress(a, stats).eligible).map((a) => a.id);
}

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];
