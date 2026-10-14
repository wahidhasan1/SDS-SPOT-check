import "server-only";
import { all, get, getDb, json, run } from "./db";
import {
  ACHIEVEMENTS,
  STREAK_MIN_SECONDS,
  achievementProgress,
  addDays,
  computeStreaks,
  levelForXp,
} from "@/lib/game-rules";
import { dateKeyInZone } from "@/lib/dates";
import { achievementStats, notify, qualifyingDays, totalXp } from "./services/gamification";
import type {
  AnalysisResult,
  BattleEvaluation,
  IssueCategory,
  ScoreCard,
  SessionOrigin,
  SessionStatus,
  SessionType,
  Topic,
  TopicCategory,
  UserProfile,
  UserSettings,
} from "@/lib/types";

// Read models for pages. Everything here is scoped to a user id that the
// caller obtained from the session — never from request parameters.

export function todayFor(profile: UserProfile, now = new Date()) {
  return dateKeyInZone(now, profile.timezone);
}

export interface SessionListItem {
  id: string;
  type: SessionType;
  topicId: string | null;
  topicTitle: string | null;
  topicCategory: TopicCategory | null;
  promptText: string | null;
  partnerName: string | null;
  partnerKind: "demo_partner" | "user" | null;
  durationSeconds: number;
  practiceSeconds: number;
  startedAt: string;
  activityDate: string;
  status: SessionStatus;
  endReason: string | null;
  origin: SessionOrigin;
  xpAwarded: number;
  hasFeedback: boolean;
  transcriptStatus: string | null;
  battleResult: string | null;
  battleScore: number | null;
}

const SESSION_SELECT = `
  SELECT s.id, s.type, s.topic_id AS topicId, t.title AS topicTitle, t.category AS topicCategory, s.prompt_text AS promptText,
         s.partner_name AS partnerName, s.partner_kind AS partnerKind, s.duration_seconds AS durationSeconds,
         s.practice_seconds AS practiceSeconds, s.started_at AS startedAt, s.activity_date AS activityDate, s.status,
         s.end_reason AS endReason, s.origin, s.xp_awarded AS xpAwarded,
         EXISTS (SELECT 1 FROM feedback f WHERE f.session_id = s.id) AS hasFeedback,
         (SELECT tr.status FROM transcripts tr WHERE tr.session_id = s.id) AS transcriptStatus,
         (SELECT b.result FROM battles b WHERE b.session_id = s.id) AS battleResult,
         (SELECT b.user_score FROM battles b WHERE b.session_id = s.id) AS battleScore
  FROM sessions s LEFT JOIN topics t ON t.id = s.topic_id`;

type SessionRow = Omit<SessionListItem, "hasFeedback"> & { hasFeedback: number };

function mapSession(row: SessionRow): SessionListItem {
  return { ...row, hasFeedback: Boolean(row.hasFeedback) };
}

// ---------- Stats ----------

export interface DayPoint {
  date: string;
  practiceSeconds: number;
  sessions: number;
  xp: number;
  qualifies: boolean;
  isSample: boolean;
}

export interface UserStats {
  today: string;
  totals: {
    practiceSeconds: number;
    sessions: number;
    conversations: number;
    battles: number;
    coach: number;
    avgSessionSeconds: number;
    savedSentences: number;
    feedbackCount: number;
    reviewedCount: number;
    sampleSessions: number;
  };
  streak: { current: number; longest: number; practicedToday: boolean; minSeconds: number };
  goal: { minutes: number; practiceSecondsToday: number; reached: boolean; daysReached: number };
  xp: { total: number; level: ReturnType<typeof levelForXp> };
  days: DayPoint[];
  battles: { total: number; wins: number; draws: number; losses: number; best: number | null; average: number | null };
}

export function getUserStats(profile: UserProfile, now = new Date()): UserStats {
  const db = getDb();
  const today = todayFor(profile, now);
  const one = (sql: string, ...params: (string | number)[]) => get<{ n: number }>(db, sql, ...params)?.n ?? 0;
  const uid = profile.id;
  const totalsRow = get<{ practice: number; sessions: number; avg: number | null }>(
    db,
    `SELECT COALESCE(SUM(practice_seconds), 0) AS practice, COUNT(*) AS sessions,
            AVG(CASE WHEN type = 'free_talk' THEN duration_seconds END) AS avg
     FROM sessions WHERE user_id = ? AND status = 'completed'`,
    uid,
  )!;
  const activity = all<{ activity_date: string; practice_seconds: number; session_count: number; xp_earned: number }>(
    db,
    "SELECT activity_date, practice_seconds, session_count, xp_earned FROM user_activity WHERE user_id = ? AND activity_date >= ? ORDER BY activity_date",
    uid,
    addDays(today, -41),
  );
  const sampleDays = new Set(
    all<{ d: string }>(db, "SELECT DISTINCT activity_date AS d FROM sessions WHERE user_id = ? AND origin = 'seed'", uid).map((r) => r.d),
  );
  const byDate = new Map(activity.map((a) => [a.activity_date, a]));
  const days: DayPoint[] = [];
  for (let i = 41; i >= 0; i--) {
    const date = addDays(today, -i);
    const a = byDate.get(date);
    days.push({
      date,
      practiceSeconds: a?.practice_seconds ?? 0,
      sessions: a?.session_count ?? 0,
      xp: a?.xp_earned ?? 0,
      qualifies: (a?.practice_seconds ?? 0) >= STREAK_MIN_SECONDS,
      isSample: sampleDays.has(date),
    });
  }
  const streaks = computeStreaks(qualifyingDays(db, uid), today);
  const todaySeconds = byDate.get(today)?.practice_seconds ?? 0;
  const battleRow = get<{ total: number; wins: number; draws: number; losses: number; best: number | null; avg: number | null }>(
    db,
    `SELECT COUNT(*) AS total, SUM(result = 'win') AS wins, SUM(result = 'draw') AS draws, SUM(result = 'loss') AS losses,
            MAX(user_score) AS best, AVG(user_score) AS avg FROM battles WHERE user_id = ?`,
    uid,
  )!;
  const xp = totalXp(db, uid);
  return {
    today,
    totals: {
      practiceSeconds: totalsRow.practice,
      sessions: totalsRow.sessions,
      conversations: one("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND type = 'free_talk' AND status = 'completed'", uid),
      battles: one("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND type = 'battle' AND status = 'completed'", uid),
      coach: one("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND type = 'coach' AND status = 'completed'", uid),
      avgSessionSeconds: Math.round(totalsRow.avg ?? 0),
      savedSentences: one("SELECT COUNT(*) AS n FROM saved_sentences WHERE user_id = ?", uid),
      feedbackCount: one("SELECT COUNT(*) AS n FROM feedback WHERE user_id = ?", uid),
      reviewedCount: achievementStats(db, uid, today).reviews,
      sampleSessions: one("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND origin = 'seed'", uid),
    },
    streak: { ...streaks, minSeconds: STREAK_MIN_SECONDS },
    goal: {
      minutes: profile.dailyGoalMinutes,
      practiceSecondsToday: todaySeconds,
      reached: todaySeconds >= profile.dailyGoalMinutes * 60,
      daysReached: one("SELECT COUNT(*) AS n FROM user_activity WHERE user_id = ? AND practice_seconds >= ?", uid, profile.dailyGoalMinutes * 60),
    },
    xp: { total: xp, level: levelForXp(xp) },
    days,
    battles: {
      total: battleRow.total,
      wins: battleRow.wins ?? 0,
      draws: battleRow.draws ?? 0,
      losses: battleRow.losses ?? 0,
      best: battleRow.best,
      average: battleRow.avg == null ? null : Math.round(battleRow.avg),
    },
  };
}

/** Lightweight header data for every app page. */
export function getHeaderData(profile: UserProfile) {
  const db = getDb();
  const today = todayFor(profile);
  const streak = computeStreaks(qualifyingDays(db, profile.id), today);
  const notifications = all<{ id: string; kind: string; title: string; body: string; href: string | null; read_at: string | null; created_at: string }>(
    db,
    "SELECT id, kind, title, body, href, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 15",
    profile.id,
  );
  return {
    streak: streak.current,
    practicedToday: streak.practicedToday,
    notifications: notifications.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      href: n.href,
      read: Boolean(n.read_at),
      createdAt: n.created_at,
    })),
  };
}

/** Creates at most one in-app reminder per day, based on the user's notification settings. */
export function ensureDailyReminders(profile: UserProfile, settings: UserSettings, now = new Date()) {
  const db = getDb();
  const today = todayFor(profile, now);
  const streak = computeStreaks(qualifyingDays(db, profile.id), today);
  if (streak.practicedToday) return;
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: profile.timezone }).format(now));
  if (settings.notifications.streakReminders && streak.current > 0 && hour >= 12) {
    notify(db, profile.id, {
      kind: "reminder",
      title: `Keep your ${streak.current}-day streak alive`,
      body: "Two minutes of speaking practice today keeps your streak going.",
      href: "/free-talk",
      dedupeKey: `streak-reminder:${today}`,
      at: now,
    });
  } else if (settings.notifications.practiceReminders && hour >= 17) {
    notify(db, profile.id, {
      kind: "reminder",
      title: "Time for a quick practice?",
      body: `A short conversation counts toward your ${profile.dailyGoalMinutes}-minute daily goal.`,
      href: "/free-talk",
      dedupeKey: `practice-reminder:${today}`,
      at: now,
    });
  }
}

// ---------- Sessions ----------

export interface HistoryFilters {
  type?: SessionType | "all";
  status?: SessionStatus | "all";
  from?: string;
  to?: string;
  sort?: "newest" | "oldest" | "longest";
  withFeedback?: boolean;
  page?: number;
  pageSize?: number;
}

export function listSessions(userId: string, filters: HistoryFilters = {}) {
  const db = getDb();
  const where = ["s.user_id = ?"];
  const params: (string | number)[] = [userId];
  if (filters.type && filters.type !== "all") {
    where.push("s.type = ?");
    params.push(filters.type);
  }
  if (filters.status && filters.status !== "all") {
    where.push("s.status = ?");
    params.push(filters.status);
  }
  if (filters.withFeedback) where.push("(EXISTS (SELECT 1 FROM feedback f WHERE f.session_id = s.id) OR EXISTS (SELECT 1 FROM transcripts tr WHERE tr.session_id = s.id AND tr.status = 'available'))");
  if (filters.from) {
    where.push("s.activity_date >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    where.push("s.activity_date <= ?");
    params.push(filters.to);
  }
  const order =
    filters.sort === "oldest" ? "s.started_at ASC" : filters.sort === "longest" ? "s.duration_seconds DESC, s.started_at DESC" : "s.started_at DESC";
  const pageSize = filters.pageSize ?? 10;
  const page = Math.max(1, filters.page ?? 1);
  const total = get<{ n: number }>(db, `SELECT COUNT(*) AS n FROM sessions s WHERE ${where.join(" AND ")}`, ...params)?.n ?? 0;
  const rows = all<SessionRow>(
    db,
    `${SESSION_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  );
  return { items: rows.map(mapSession), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export interface TranscriptEntry {
  id: string;
  position: number;
  speaker: "user" | "partner";
  original: string;
  corrected: string | null;
  explanation: string | null;
  category: IssueCategory | null;
  alternative: string | null;
  reviewed: boolean;
  saved: boolean;
}

export interface FeedbackRecord {
  id: string;
  sessionId: string | null;
  kind: "session" | "battle" | "coach";
  analyzer: "demo-rules" | "anthropic";
  model: string | null;
  origin: "seed" | "generated";
  inputMode: "typed" | "spoken";
  promptText: string | null;
  analysis: AnalysisResult;
  scores: ScoreCard | null;
  reviewed: boolean;
  createdAt: string;
}

interface FeedbackRow {
  id: string;
  session_id: string | null;
  kind: FeedbackRecord["kind"];
  analyzer: FeedbackRecord["analyzer"];
  model: string | null;
  origin: FeedbackRecord["origin"];
  input_mode: FeedbackRecord["inputMode"];
  prompt_text: string | null;
  analysis: string;
  scores: string | null;
  reviewed_at: string | null;
  created_at: string;
}

function mapFeedback(row: FeedbackRow): FeedbackRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    kind: row.kind,
    analyzer: row.analyzer,
    model: row.model,
    origin: row.origin,
    inputMode: row.input_mode,
    promptText: row.prompt_text,
    analysis: json<AnalysisResult>(row.analysis, null as unknown as AnalysisResult),
    scores: json<ScoreCard | null>(row.scores, null),
    reviewed: Boolean(row.reviewed_at),
    createdAt: row.created_at,
  };
}

export interface BattleRecord {
  id: string;
  promptId: string;
  promptText: string;
  difficulty: string;
  prepSeconds: number;
  speakSeconds: number;
  opponentName: string;
  opponentId: string;
  opponentKind: "demo_partner" | "user";
  userResponse: string;
  userInputMode: "typed" | "spoken";
  opponentResponse: string;
  opponentResponseKind: "sample" | "live";
  result: "win" | "loss" | "draw" | "no_result";
  userScore: number | null;
  opponentScore: number | null;
  evaluation: BattleEvaluation | null;
  origin: SessionOrigin;
  createdAt: string;
  sessionId: string;
}

export function getSessionDetail(userId: string, sessionId: string) {
  const db = getDb();
  const row = get<SessionRow & { partnerId: string | null; plannedSeconds: number | null }>(
    db,
    `${SESSION_SELECT.replace("SELECT s.id,", "SELECT s.id, s.partner_id AS partnerId, s.planned_seconds AS plannedSeconds,")} WHERE s.id = ? AND s.user_id = ?`,
    sessionId,
    userId,
  );
  if (!row) return null;
  const transcript = get<{ id: string; status: string; source: string | null; note: string | null; retention: string; expires_at: string | null }>(
    db,
    "SELECT id, status, source, note, retention, expires_at FROM transcripts WHERE session_id = ?",
    sessionId,
  );
  const saved = new Set(
    all<{ k: string }>(db, "SELECT original || '→' || corrected AS k FROM saved_sentences WHERE user_id = ?", userId).map((r) => r.k),
  );
  const entries: TranscriptEntry[] = transcript
    ? all<{
        id: string;
        position: number;
        speaker: "user" | "partner";
        original: string;
        corrected: string | null;
        explanation: string | null;
        category: IssueCategory | null;
        alternative: string | null;
        reviewed_at: string | null;
      }>(db, "SELECT * FROM transcript_entries WHERE transcript_id = ? ORDER BY position", transcript.id).map((e) => ({
        id: e.id,
        position: e.position,
        speaker: e.speaker,
        original: e.original,
        corrected: e.corrected,
        explanation: e.explanation,
        category: e.category,
        alternative: e.alternative,
        reviewed: Boolean(e.reviewed_at),
        saved: saved.has(`${e.original}→${e.corrected ?? e.alternative}`),
      }))
    : [];
  const feedback = all<FeedbackRow>(db, "SELECT * FROM feedback WHERE session_id = ? AND user_id = ? ORDER BY created_at", sessionId, userId).map(mapFeedback);
  const battle = getBattleBySession(userId, sessionId);
  const blocked = row.partnerId
    ? Boolean(get(db, "SELECT 1 FROM blocks WHERE blocker_user_id = ? AND blocked_id = ?", userId, row.partnerId))
    : false;
  return {
    session: mapSession(row),
    partnerId: row.partnerId,
    plannedSeconds: row.plannedSeconds,
    partnerBlocked: blocked,
    transcript: transcript
      ? { id: transcript.id, status: transcript.status, source: transcript.source, note: transcript.note, retention: transcript.retention, expiresAt: transcript.expires_at, entries }
      : null,
    feedback,
    battle,
    savedKeys: [...saved],
  };
}

function mapBattle(row: Record<string, unknown>): BattleRecord {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    promptId: row.prompt_id as string,
    promptText: row.prompt_text as string,
    difficulty: row.difficulty as string,
    prepSeconds: row.prep_seconds as number,
    speakSeconds: row.speak_seconds as number,
    opponentName: row.opponent_name as string,
    opponentId: row.opponent_id as string,
    opponentKind: row.opponent_kind as BattleRecord["opponentKind"],
    userResponse: row.user_response as string,
    userInputMode: row.user_input_mode as BattleRecord["userInputMode"],
    opponentResponse: row.opponent_response as string,
    opponentResponseKind: row.opponent_response_kind as BattleRecord["opponentResponseKind"],
    result: row.result as BattleRecord["result"],
    userScore: row.user_score as number | null,
    opponentScore: row.opponent_score as number | null,
    evaluation: json<BattleEvaluation | null>(row.evaluation as string | null, null),
    origin: row.origin as SessionOrigin,
    createdAt: row.created_at as string,
  };
}

export function getBattleBySession(userId: string, sessionId: string): BattleRecord | null {
  const row = get<Record<string, unknown>>(getDb(), "SELECT * FROM battles WHERE session_id = ? AND user_id = ?", sessionId, userId);
  return row ? mapBattle(row) : null;
}

export function listBattles(userId: string, limit = 6): BattleRecord[] {
  return all<Record<string, unknown>>(getDb(), "SELECT * FROM battles WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", userId, limit).map(mapBattle);
}

export function getBattleDimensionAverages(userId: string) {
  const battles = listBattles(userId, 50).filter((b) => b.evaluation);
  const sums = new Map<string, { label: string; max: number; total: number; best: number; count: number }>();
  for (const b of battles) {
    for (const d of b.evaluation!.user.score.dimensions) {
      const cur = sums.get(d.key) ?? { label: d.label, max: d.max, total: 0, best: 0, count: 0 };
      cur.total += d.score;
      cur.best = Math.max(cur.best, d.score);
      cur.count += 1;
      sums.set(d.key, cur);
    }
  }
  return {
    count: battles.length,
    sampleCount: battles.filter((b) => b.origin === "seed").length,
    dimensions: [...sums.entries()].map(([key, v]) => ({ key, label: v.label, max: v.max, average: v.total / v.count, best: v.best })),
  };
}

// ---------- Feedback & learning ----------

export function listFeedback(userId: string, opts: { kind?: FeedbackRecord["kind"]; limit?: number } = {}) {
  const rows = opts.kind
    ? all<FeedbackRow>(getDb(), "SELECT * FROM feedback WHERE user_id = ? AND kind = ? ORDER BY created_at DESC LIMIT ?", userId, opts.kind, opts.limit ?? 10)
    : all<FeedbackRow>(getDb(), "SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", userId, opts.limit ?? 10);
  return rows.map(mapFeedback);
}

export function getFeedback(userId: string, id: string): FeedbackRecord | null {
  const row = get<FeedbackRow>(getDb(), "SELECT * FROM feedback WHERE id = ? AND user_id = ?", id, userId);
  return row ? mapFeedback(row) : null;
}

export function mistakePatterns(userId: string) {
  const feedback = listFeedback(userId, { limit: 50 });
  const counts = new Map<IssueCategory, { count: number; example: { original: string; corrected: string } | null }>();
  for (const f of feedback) {
    for (const issue of f.analysis?.issues ?? []) {
      if (issue.minor) continue;
      const cur = counts.get(issue.category) ?? { count: 0, example: null };
      cur.count += 1;
      cur.example ??= { original: issue.original, corrected: issue.corrected };
      counts.set(issue.category, cur);
    }
  }
  return [...counts.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.count - a.count);
}

export interface SavedSentence {
  id: string;
  original: string;
  corrected: string;
  explanation: string | null;
  category: IssueCategory | null;
  sourceKind: "transcript" | "coach" | "battle";
  sourceId: string | null;
  reviewed: boolean;
  createdAt: string;
}

export function listSavedSentences(userId: string): SavedSentence[] {
  return all<{
    id: string;
    original: string;
    corrected: string;
    explanation: string | null;
    category: IssueCategory | null;
    source_kind: SavedSentence["sourceKind"];
    source_id: string | null;
    reviewed_at: string | null;
    created_at: string;
  }>(getDb(), "SELECT * FROM saved_sentences WHERE user_id = ? ORDER BY created_at DESC", userId).map((r) => ({
    id: r.id,
    original: r.original,
    corrected: r.corrected,
    explanation: r.explanation,
    category: r.category,
    sourceKind: r.source_kind,
    sourceId: r.source_id,
    reviewed: Boolean(r.reviewed_at),
    createdAt: r.created_at,
  }));
}

// ---------- Topics ----------

interface TopicRow {
  id: string;
  title: string;
  category: TopicCategory;
  difficulty: Topic["difficulty"];
  description: string;
  duration_minutes: number;
  opening_question: string;
  follow_ups: string;
  tags: string;
}

function mapTopic(r: TopicRow): Topic {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    difficulty: r.difficulty,
    description: r.description,
    durationMinutes: r.duration_minutes,
    openingQuestion: r.opening_question,
    followUps: json<string[]>(r.follow_ups, []),
    tags: json<string[]>(r.tags, []),
  };
}

export function listTopics(): Topic[] {
  return all<TopicRow>(getDb(), "SELECT * FROM topics ORDER BY title").map(mapTopic);
}

export function favoriteTopicIds(userId: string): string[] {
  return all<{ topic_id: string }>(getDb(), "SELECT topic_id FROM topic_favorites WHERE user_id = ? ORDER BY created_at DESC", userId).map((r) => r.topic_id);
}

export function practicedTopicCounts(userId: string): Record<string, number> {
  const rows = all<{ topic_id: string; n: number }>(
    getDb(),
    "SELECT topic_id, COUNT(*) AS n FROM sessions WHERE user_id = ? AND topic_id IS NOT NULL AND status = 'completed' GROUP BY topic_id",
    userId,
  );
  return Object.fromEntries(rows.map((r) => [r.topic_id, r.n]));
}

// ---------- Achievements ----------

export function getAchievements(profile: UserProfile) {
  const db = getDb();
  const stats = achievementStats(db, profile.id, todayFor(profile));
  const unlocked = new Map(
    all<{ achievement_id: string; unlocked_at: string }>(db, "SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?", profile.id).map(
      (r) => [r.achievement_id, r.unlocked_at],
    ),
  );
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    progress: achievementProgress(a, stats),
    unlockedAt: unlocked.get(a.id) ?? null,
  }));
}

// ---------- Safety ----------

export function listBlocks(userId: string) {
  return all<{ blocked_id: string; blocked_kind: string; blocked_name: string; created_at: string }>(
    getDb(),
    "SELECT blocked_id, blocked_kind, blocked_name, created_at FROM blocks WHERE blocker_user_id = ? ORDER BY created_at DESC",
    userId,
  ).map((b) => ({ id: b.blocked_id, kind: b.blocked_kind, name: b.blocked_name, createdAt: b.created_at }));
}

export function blockedIds(userId: string): string[] {
  return all<{ id: string }>(getDb(), "SELECT blocked_id AS id FROM blocks WHERE blocker_user_id = ?", userId).map((r) => r.id);
}

export function listMyReports(userId: string) {
  return all<{ id: string; reported_name: string; reason: string; details: string | null; status: string; created_at: string }>(
    getDb(),
    "SELECT id, reported_name, reason, details, status, created_at FROM safety_reports WHERE reporter_user_id = ? ORDER BY created_at DESC",
    userId,
  ).map((r) => ({ id: r.id, reportedName: r.reported_name, reason: r.reason, details: r.details, status: r.status, createdAt: r.created_at }));
}

/** Removes transcripts whose retention period has ended. */
export function purgeExpiredTranscripts(now = new Date()) {
  run(getDb(), "DELETE FROM transcripts WHERE expires_at IS NOT NULL AND expires_at < ?", now.toISOString());
}
