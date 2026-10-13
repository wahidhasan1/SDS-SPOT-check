import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { notify } from './notifications';

export interface AchievementDef {
  code: string;
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'placement_done', title: 'Starting line', description: 'Completed the placement assessment.', icon: 'flag' },
  { code: 'first_lesson', title: 'First lesson', description: 'Completed your first grammar lesson.', icon: 'book' },
  { code: 'lessons_10', title: 'Grammar explorer', description: 'Completed 10 grammar lessons.', icon: 'library' },
  { code: 'words_10', title: 'Word collector', description: 'Saved 10 words to your vocabulary.', icon: 'bookmark' },
  { code: 'mastered_10', title: 'Word master', description: 'Mastered 10 words through spaced repetition.', icon: 'star' },
  { code: 'streak_3', title: '3-day streak', description: 'Studied 3 days in a row.', icon: 'flame' },
  { code: 'streak_7', title: '7-day streak', description: 'Studied 7 days in a row.', icon: 'flame' },
  { code: 'streak_30', title: '30-day streak', description: 'Studied 30 days in a row.', icon: 'flame' },
  { code: 'first_call', title: 'First conversation', description: 'Completed a voice call of at least one minute.', icon: 'phone' },
  { code: 'calls_10', title: 'Social speaker', description: 'Completed 10 voice calls.', icon: 'users' },
  { code: 'first_battle_win', title: 'Victory', description: 'Won your first battle.', icon: 'trophy' },
  { code: 'battles_10', title: 'Battle tested', description: 'Finished 10 battles.', icon: 'swords' },
  { code: 'first_reading', title: 'Reader', description: 'Completed an IELTS reading practice.', icon: 'file' },
  { code: 'first_listening', title: 'Listener', description: 'Completed an IELTS listening practice.', icon: 'headphones' },
  { code: 'first_writing', title: 'Writer', description: 'Submitted an IELTS writing task.', icon: 'pen' },
  { code: 'first_speaking', title: 'Speaker', description: 'Recorded an IELTS speaking answer.', icon: 'mic' },
  { code: 'first_mock', title: 'Exam ready', description: 'Completed a full mock test.', icon: 'clipboard' },
  { code: 'first_scan', title: 'Page turner', description: 'Scanned a book page with the reader.', icon: 'camera' },
];

/** Consecutive study days ending today or yesterday, based on activity_log.day. */
export async function computeStreak(userId: string, today: string): Promise<{ current: number; longest: number; days: string[] }> {
  const rows = await db
    .selectDistinct({ day: schema.activityLog.day })
    .from(schema.activityLog)
    .where(eq(schema.activityLog.userId, userId))
    .orderBy(sql`${schema.activityLog.day} desc`)
    .limit(400);
  const days = rows.map((r) => r.day);
  const set = new Set(days);
  const dayMs = 86400_000;
  const toDate = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
  const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
  let current = 0;
  let cursor = toDate(today);
  if (!set.has(today)) cursor -= dayMs; // streak still alive if studied yesterday
  while (set.has(fmt(cursor))) {
    current++;
    cursor -= dayMs;
  }
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of [...days].reverse()) {
    const t = toDate(d);
    run = prev !== null && t - prev === dayMs ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }
  return { current, longest, days };
}

async function count(q: Promise<{ n: number }[]>) {
  const r = await q;
  return Number(r[0]?.n ?? 0);
}

/** Evaluate achievement rules from stored data and award any newly earned ones. */
export async function checkAchievements(userId: string, today: string): Promise<AchievementDef[]> {
  const have = new Set(
    (await db.select({ code: schema.achievements.code }).from(schema.achievements).where(eq(schema.achievements.userId, userId))).map((r) => r.code),
  );
  if (have.size === ACHIEVEMENTS.length) return [];
  const n = sql<number>`count(*)::int`;
  const [placement, lessons, wordsSaved, mastered, calls, wins, battlesDone, reading, listening, writing, speaking, mocks, scans, streak] = await Promise.all([
    count(db.select({ n }).from(schema.assessments).where(and(eq(schema.assessments.userId, userId), sql`completed_at is not null`))),
    count(db.select({ n }).from(schema.lessonProgress).where(and(eq(schema.lessonProgress.userId, userId), eq(schema.lessonProgress.status, 'completed')))),
    count(db.select({ n }).from(schema.userWords).where(eq(schema.userWords.userId, userId))),
    count(db.select({ n }).from(schema.userWords).where(and(eq(schema.userWords.userId, userId), eq(schema.userWords.status, 'mastered')))),
    count(db.select({ n }).from(schema.callSessions).where(sql`(user_a = ${userId} or user_b = ${userId}) and status = 'ended' and duration_sec >= 60`)),
    count(db.select({ n }).from(schema.battles).where(eq(schema.battles.winnerId, userId))),
    count(db.select({ n }).from(schema.battles).where(sql`(user_a = ${userId} or user_b = ${userId}) and status = 'finished'`)),
    count(db.select({ n }).from(schema.attempts).where(and(eq(schema.attempts.userId, userId), eq(schema.attempts.kind, 'ielts_reading'), eq(schema.attempts.status, 'completed')))),
    count(db.select({ n }).from(schema.attempts).where(and(eq(schema.attempts.userId, userId), eq(schema.attempts.kind, 'ielts_listening'), eq(schema.attempts.status, 'completed')))),
    count(db.select({ n }).from(schema.writingSubmissions).where(and(eq(schema.writingSubmissions.userId, userId), sql`submitted_at is not null`))),
    count(db.select({ n }).from(schema.speakingAttempts).where(and(eq(schema.speakingAttempts.userId, userId), eq(schema.speakingAttempts.mode, 'ielts')))),
    count(db.select({ n }).from(schema.mockAttempts).where(and(eq(schema.mockAttempts.userId, userId), eq(schema.mockAttempts.status, 'completed')))),
    count(db.select({ n }).from(schema.ocrDocuments).where(eq(schema.ocrDocuments.userId, userId))),
    computeStreak(userId, today),
  ]);
  const earned: Record<string, boolean> = {
    placement_done: placement >= 1,
    first_lesson: lessons >= 1,
    lessons_10: lessons >= 10,
    words_10: wordsSaved >= 10,
    mastered_10: mastered >= 10,
    streak_3: streak.current >= 3,
    streak_7: streak.current >= 7,
    streak_30: streak.current >= 30,
    first_call: calls >= 1,
    calls_10: calls >= 10,
    first_battle_win: wins >= 1,
    battles_10: battlesDone >= 10,
    first_reading: reading >= 1,
    first_listening: listening >= 1,
    first_writing: writing >= 1,
    first_speaking: speaking >= 1,
    first_mock: mocks >= 1,
    first_scan: scans >= 1,
  };
  const fresh = ACHIEVEMENTS.filter((a) => earned[a.code] && !have.has(a.code));
  if (fresh.length) {
    await db
      .insert(schema.achievements)
      .values(fresh.map((a) => ({ userId, code: a.code })))
      .onConflictDoNothing();
    for (const a of fresh) await notify(userId, { type: 'achievement', title: `Achievement unlocked: ${a.title}`, body: a.description, link: '/profile#achievements' });
  }
  return fresh;
}
