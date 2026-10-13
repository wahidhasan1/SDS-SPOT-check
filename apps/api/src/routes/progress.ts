import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { cefrToPath } from '@fluentpath/shared';
import { db, schema } from '../db';
import { addDays, localDay } from '../lib/time';
import { parse, uuidParam } from '../lib/validate';
import { requireUser } from '../plugins/auth';
import { ACHIEVEMENTS, computeStreak } from '../services/achievements';
import { getPlan } from '../services/entitlements';
import { accuracyByType, type QuestionResult } from '../services/ielts';
import { vocabStats } from './vocab';

const n = sql<number>`count(*)::int`;

async function dailySeries(userId: string, today: string, days: number) {
  const from = addDays(today, -(days - 1));
  const rows = await db
    .select({ day: schema.activityLog.day, minutes: sql<number>`coalesce(sum(minutes),0)::float`, xp: sql<number>`coalesce(sum(xp),0)::int`, activities: n })
    .from(schema.activityLog)
    .where(and(eq(schema.activityLog.userId, userId), gte(schema.activityLog.day, from)))
    .groupBy(schema.activityLog.day);
  const map = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(from, i);
    const r = map.get(day);
    return { day, minutes: Math.round((r?.minutes ?? 0) * 10) / 10, xp: r?.xp ?? 0, activities: r?.activities ?? 0 };
  });
}

async function moduleStats(userId: string, kind: string) {
  const [s] = await db
    .select({ count: n, best: sql<number | null>`max(band_estimate)`, avgPct: sql<number | null>`avg(score::float / nullif(max_score,0))` })
    .from(schema.attempts)
    .where(and(eq(schema.attempts.userId, userId), eq(schema.attempts.kind, kind), eq(schema.attempts.status, 'completed')));
  const [latest] = await db
    .select({ band: schema.attempts.bandEstimate, at: schema.attempts.completedAt })
    .from(schema.attempts)
    .where(and(eq(schema.attempts.userId, userId), eq(schema.attempts.kind, kind), eq(schema.attempts.status, 'completed')))
    .orderBy(desc(schema.attempts.completedAt))
    .limit(1);
  return { count: s.count, bestBand: s.best, latestBand: latest?.band ?? null, avgPercent: s.avgPct != null ? Math.round(s.avgPct * 100) : null };
}

export async function progressRoutes(app: FastifyInstance) {
  app.get('/api/progress/streak', async (req) => {
    const u = requireUser(req);
    const [p] = await db.select({ tz: schema.profiles.timezone }).from(schema.profiles).where(eq(schema.profiles.userId, u.id));
    const s = await computeStreak(u.id, localDay(p?.tz ?? 'UTC'));
    return { current: s.current, longest: s.longest };
  });

  app.get('/api/dashboard', async (req) => {
    const u = requireUser(req);
    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, u.id));
    const [settings] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, u.id));
    const today = localDay(profile.timezone);
    const weekAgo = new Date(Date.now() - 7 * 86400_000);

    const [streak, series, vocab, reading, listening] = await Promise.all([
      computeStreak(u.id, today),
      dailySeries(u.id, today, 14),
      vocabStats(u.id),
      moduleStats(u.id, 'ielts_reading'),
      moduleStats(u.id, 'ielts_listening'),
    ]);
    const [[lessons], [totalLessons], [quizzes], [writing], [speaking], [mocks], [calls], [battles], [assessment], recent, [achievementCount]] = await Promise.all([
      db.select({ completed: n }).from(schema.lessonProgress).where(and(eq(schema.lessonProgress.userId, u.id), eq(schema.lessonProgress.status, 'completed'))),
      db.select({ total: n }).from(schema.lessons).where(eq(schema.lessons.status, 'published')),
      db
        .select({ count: n, avgPct: sql<number | null>`avg(score::float / nullif(max_score,0))` })
        .from(schema.attempts)
        .where(and(eq(schema.attempts.userId, u.id), inArray(schema.attempts.kind, ['lesson', 'vocab_quiz']), eq(schema.attempts.status, 'completed'))),
      db
        .select({ count: n, latest: sql<number | null>`(array_agg(band_estimate order by submitted_at desc) filter (where band_estimate is not null))[1]` })
        .from(schema.writingSubmissions)
        .where(and(eq(schema.writingSubmissions.userId, u.id), sql`submitted_at is not null`)),
      db.select({ count: n, minutes: sql<number>`coalesce(sum(duration_sec),0)::float / 60` }).from(schema.speakingAttempts).where(eq(schema.speakingAttempts.userId, u.id)),
      db.select({ count: n }).from(schema.mockAttempts).where(and(eq(schema.mockAttempts.userId, u.id), eq(schema.mockAttempts.status, 'completed'))),
      db
        .select({ count: n, minutes: sql<number>`coalesce(sum(duration_sec),0)::float / 60`, thisWeek: sql<number>`count(*) filter (where matched_at > ${weekAgo})::int` })
        .from(schema.callSessions)
        .where(sql`(user_a = ${u.id} or user_b = ${u.id}) and status = 'ended' and duration_sec > 0`),
      db
        .select({ played: n, won: sql<number>`count(*) filter (where winner_id = ${u.id})::int` })
        .from(schema.battles)
        .where(sql`(user_a = ${u.id} or user_b = ${u.id}) and status = 'finished'`),
      db.select({ count: n }).from(schema.assessments).where(and(eq(schema.assessments.userId, u.id), sql`completed_at is not null`)),
      db.select().from(schema.activityLog).where(eq(schema.activityLog.userId, u.id)).orderBy(desc(schema.activityLog.createdAt)).limit(8),
      db.select({ count: n }).from(schema.achievements).where(eq(schema.achievements.userId, u.id)),
    ]);

    // Recommendations: simple, transparent rules based on stored activity.
    const recs: { id: string; title: string; description: string; link: string }[] = [];
    if (assessment.count === 0) recs.push({ id: 'assessment', title: 'Take the placement assessment', description: 'About 15 minutes. We use it to estimate your level and suggest lessons.', link: '/assessment' });
    if (vocab.due > 0) recs.push({ id: 'review', title: `Review ${vocab.due} flashcard${vocab.due === 1 ? '' : 's'}`, description: 'These words are due for spaced-repetition review today.', link: '/vocabulary/review' });
    const path = cefrToPath(profile.cefrLevel as never);
    const [nextLesson] = await db
      .select({ slug: schema.lessons.slug, title: schema.lessons.title })
      .from(schema.lessons)
      .leftJoin(schema.lessonProgress, and(eq(schema.lessonProgress.lessonId, schema.lessons.id), eq(schema.lessonProgress.userId, u.id)))
      .where(and(eq(schema.lessons.status, 'published'), eq(schema.lessons.track, 'grammar'), eq(schema.lessons.pathLevel, path), sql`(${schema.lessonProgress.status} is null or ${schema.lessonProgress.status} <> 'completed')`))
      .orderBy(asc(schema.lessons.sortOrder))
      .limit(1);
    if (nextLesson) recs.push({ id: 'lesson', title: `Continue grammar: ${nextLesson.title}`, description: `Next lesson in your ${path} path.`, link: `/grammar/${nextLesson.slug}` });
    if (profile.goals.includes('ielts') || profile.ieltsModule) {
      const weakest = reading.count <= listening.count ? 'reading' : 'listening';
      recs.push({ id: `ielts-${weakest}`, title: `Practise IELTS ${weakest}`, description: `You have done ${Math.min(reading.count, listening.count)} ${weakest} practice set(s) so far.`, link: `/ielts/${weakest}` });
      if (writing.count === 0) recs.push({ id: 'writing', title: 'Write your first IELTS essay', description: 'Practise Task 1 or Task 2 with a timer and word count.', link: '/ielts/writing' });
    }
    if (calls.thisWeek === 0) recs.push({ id: 'call', title: 'Have a voice practice call', description: 'Speak with another learner anonymously for a few minutes.', link: '/speak' });
    if (vocab.total < 10) recs.push({ id: 'daily', title: 'Learn today’s words', description: 'Save words from your daily vocabulary to start flashcard reviews.', link: '/vocabulary' });

    const todayRow = series[series.length - 1];
    const examDays = profile.ieltsExamDate ? Math.ceil((new Date(`${profile.ieltsExamDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400_000) : null;
    return {
      profile: { displayName: profile.displayName, cefrLevel: profile.cefrLevel, cefrAssessedAt: profile.cefrAssessedAt, ieltsModule: profile.ieltsModule, ieltsTargetBand: profile.ieltsTargetBand, examInDays: examDays != null && examDays >= 0 ? examDays : null },
      streak: { current: streak.current, longest: streak.longest },
      today: { minutes: todayRow.minutes, xp: todayRow.xp, goalMinutes: settings.dailyGoalMinutes },
      series,
      totals: {
        lessonsCompleted: lessons.completed,
        lessonsTotal: totalLessons.total,
        quizzesTaken: quizzes.count,
        quizAvgPercent: quizzes.avgPct != null ? Math.round(quizzes.avgPct * 100) : null,
        vocab,
        reading,
        listening,
        writing: { count: writing.count, latestBand: writing.latest },
        speaking: { count: speaking.count, minutes: Math.round(speaking.minutes) },
        mocksCompleted: mocks.count,
        calls: { count: calls.count, minutes: Math.round(calls.minutes) },
        battles: { played: battles.played, won: battles.won },
        achievements: achievementCount.count,
        totalXp: series.reduce((a, d) => a + d.xp, 0),
      },
      recent,
      recommendations: recs.slice(0, 4),
    };
  });

  app.get('/api/progress', async (req) => {
    const u = requireUser(req);
    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, u.id));
    const today = localDay(profile.timezone);
    const plan = await getPlan(u.id);
    const [series, activity, attempts, writing, speaking, assessments, [xpTotal]] = await Promise.all([
      dailySeries(u.id, today, 30),
      db.select().from(schema.activityLog).where(eq(schema.activityLog.userId, u.id)).orderBy(desc(schema.activityLog.createdAt)).limit(50),
      db
        .select({ id: schema.attempts.id, kind: schema.attempts.kind, title: schema.attempts.title, score: schema.attempts.score, maxScore: schema.attempts.maxScore, bandEstimate: schema.attempts.bandEstimate, completedAt: schema.attempts.completedAt })
        .from(schema.attempts)
        .where(and(eq(schema.attempts.userId, u.id), eq(schema.attempts.status, 'completed')))
        .orderBy(desc(schema.attempts.completedAt))
        .limit(100),
      db
        .select({ id: schema.writingSubmissions.id, title: schema.writingTasks.title, taskNumber: schema.writingTasks.taskNumber, status: schema.writingSubmissions.status, wordCount: schema.writingSubmissions.wordCount, bandEstimate: schema.writingSubmissions.bandEstimate, submittedAt: schema.writingSubmissions.submittedAt })
        .from(schema.writingSubmissions)
        .innerJoin(schema.writingTasks, eq(schema.writingTasks.id, schema.writingSubmissions.taskId))
        .where(and(eq(schema.writingSubmissions.userId, u.id), sql`submitted_at is not null`))
        .orderBy(desc(schema.writingSubmissions.submittedAt))
        .limit(50),
      db.select({ id: schema.speakingAttempts.id, title: schema.speakingAttempts.title, mode: schema.speakingAttempts.mode, score: schema.speakingAttempts.score, durationSec: schema.speakingAttempts.durationSec, createdAt: schema.speakingAttempts.createdAt }).from(schema.speakingAttempts).where(eq(schema.speakingAttempts.userId, u.id)).orderBy(desc(schema.speakingAttempts.createdAt)).limit(50),
      db.select({ cefrResult: schema.assessments.cefrResult, score: schema.assessments.score, maxScore: schema.assessments.maxScore, breakdown: schema.assessments.breakdown, completedAt: schema.assessments.completedAt }).from(schema.assessments).where(and(eq(schema.assessments.userId, u.id), sql`completed_at is not null`)).orderBy(desc(schema.assessments.completedAt)),
      db.select({ xp: sql<number>`coalesce(sum(xp),0)::int`, minutes: sql<number>`coalesce(sum(minutes),0)::float` }).from(schema.activityLog).where(eq(schema.activityLog.userId, u.id)),
    ]);

    let analytics: unknown = null;
    if (plan === 'premium') {
      const ielts = await db
        .select({ kind: schema.attempts.kind, results: schema.attempts.results, band: schema.attempts.bandEstimate, completedAt: schema.attempts.completedAt })
        .from(schema.attempts)
        .where(and(eq(schema.attempts.userId, u.id), inArray(schema.attempts.kind, ['ielts_reading', 'ielts_listening']), eq(schema.attempts.status, 'completed')))
        .orderBy(asc(schema.attempts.completedAt));
      const all: QuestionResult[] = ielts.flatMap((a) => (Array.isArray(a.results) ? (a.results as QuestionResult[]) : []));
      const crit = await db
        .select({ feedback: schema.writingSubmissions.feedback })
        .from(schema.writingSubmissions)
        .where(and(eq(schema.writingSubmissions.userId, u.id), eq(schema.writingSubmissions.status, 'evaluated')));
      const sums: Record<string, { total: number; count: number }> = {};
      for (const c of crit) {
        for (const k of ((c.feedback as { ai?: { criteria: { id: string; band: number }[] } })?.ai?.criteria ?? [])) {
          sums[k.id] ??= { total: 0, count: 0 };
          sums[k.id].total += k.band;
          sums[k.id].count++;
        }
      }
      analytics = {
        accuracyByType: accuracyByType(all),
        bandTrend: [
          ...ielts.filter((a) => a.band != null).map((a) => ({ module: a.kind.replace('ielts_', ''), band: a.band, at: a.completedAt })),
          ...writing.filter((w) => w.bandEstimate != null).map((w) => ({ module: 'writing', band: w.bandEstimate, at: w.submittedAt })),
        ].sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime()),
        writingCriteria: Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, Math.round((v.total / v.count) * 10) / 10])),
      };
    }
    return {
      plan,
      series,
      totals: { xp: xpTotal.xp, minutes: Math.round(xpTotal.minutes) },
      activity,
      attempts,
      writing,
      speaking,
      assessments,
      analytics,
      analyticsLocked: plan !== 'premium',
    };
  });

  app.get('/api/achievements', async (req) => {
    const u = requireUser(req);
    const earned = await db.select().from(schema.achievements).where(eq(schema.achievements.userId, u.id));
    const map = new Map(earned.map((e) => [e.code, e.earnedAt]));
    return { achievements: ACHIEVEMENTS.map((a) => ({ ...a, earnedAt: map.get(a.code) ?? null })) };
  });

  // ---------------------------------------------------------------- notifications

  app.get('/api/notifications', async (req) => {
    const u = requireUser(req);
    const rows = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, u.id)).orderBy(desc(schema.notifications.createdAt)).limit(100);
    return { notifications: rows };
  });

  app.get('/api/notifications/unread-count', async (req) => {
    const u = requireUser(req);
    const [r] = await db.select({ c: n }).from(schema.notifications).where(and(eq(schema.notifications.userId, u.id), isNull(schema.notifications.readAt)));
    return { unread: r.c };
  });

  app.post('/api/notifications/:id/read', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    await db.update(schema.notifications).set({ readAt: new Date() }).where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, u.id)));
    return { ok: true };
  });

  app.post('/api/notifications/read-all', async (req) => {
    const u = requireUser(req);
    await db.update(schema.notifications).set({ readAt: new Date() }).where(and(eq(schema.notifications.userId, u.id), isNull(schema.notifications.readAt)));
    return { ok: true };
  });

  app.delete('/api/notifications/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    await db.delete(schema.notifications).where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, u.id)));
    return { ok: true };
  });

}
