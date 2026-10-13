import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CEFR_LEVELS, LANGUAGES } from '@fluentpath/shared';
import { db, schema } from '../db';
import { badRequest, notFound } from '../lib/errors';
import { isValidTimezone } from '../lib/time';
import { parse, uuidParam } from '../lib/validate';
import { requireUser } from '../plugins/auth';
import { logActivity } from '../services/activity';
import { getMe } from '../services/users';

const goalIds = ['ielts', 'study', 'work', 'immigration', 'travel', 'confidence'] as const;
const activityIds = ['speaking', 'vocabulary', 'grammar', 'reading', 'listening', 'writing', 'battles'] as const;
const language = z.enum(LANGUAGES).nullable().optional();

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(40).optional(),
  bio: z.string().trim().max(300).optional(),
  nativeLanguage: language,
  preferredLanguage: language,
  goals: z.array(z.enum(goalIds)).max(6).optional(),
  preferredActivities: z.array(z.enum(activityIds)).max(7).optional(),
  ieltsModule: z.enum(['academic', 'general']).nullable().optional(),
  ieltsTargetBand: z.number().min(4).max(9).multipleOf(0.5).nullable().optional(),
  ieltsExamDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  confidence: z.number().int().min(1).max(5).nullable().optional(),
  timezone: z.string().max(64).refine(isValidTimezone, 'Unknown timezone').optional(),
});

const settingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']).optional(),
  dailyGoalMinutes: z.number().int().min(5).max(240).optional(),
  notifyEmail: z.boolean().optional(),
  notifyStreak: z.boolean().optional(),
  notifyFeedback: z.boolean().optional(),
  notifyProduct: z.boolean().optional(),
  allowCalls: z.boolean().optional(),
  showLevelInCalls: z.boolean().optional(),
  profileVisibleOnLeaderboard: z.boolean().optional(),
});

/** Placement result: highest level passed consecutively (>= 60% correct at that level). */
export function placementLevel(byLevel: Record<string, { correct: number; total: number }>): string {
  let result = 'A1';
  for (const lvl of CEFR_LEVELS) {
    const s = byLevel[lvl];
    if (!s || s.total === 0) break;
    if (s.correct / s.total >= 0.6) result = lvl;
    else break;
  }
  return result;
}

export async function profileRoutes(app: FastifyInstance) {
  app.patch('/api/profile', async (req) => {
    const u = requireUser(req);
    const body = parse(profileSchema, req.body);
    if (Object.keys(body).length === 0) throw badRequest('Nothing to update.');
    await db.update(schema.profiles).set({ ...body, updatedAt: new Date() }).where(eq(schema.profiles.userId, u.id));
    return { me: await getMe(u.id) };
  });

  app.put('/api/profile/onboarding', async (req) => {
    const u = requireUser(req);
    const body = parse(
      profileSchema.extend({
        goals: z.array(z.enum(goalIds)).min(1, 'Choose at least one goal'),
        preferredActivities: z.array(z.enum(activityIds)).min(1, 'Choose at least one activity'),
        confidence: z.number().int().min(1).max(5),
      }),
      req.body,
    );
    await db
      .update(schema.profiles)
      .set({ ...body, onboardingCompleted: true, updatedAt: new Date() })
      .where(eq(schema.profiles.userId, u.id));
    return { me: await getMe(u.id) };
  });

  app.patch('/api/settings', async (req) => {
    const u = requireUser(req);
    const body = parse(settingsSchema, req.body);
    if (Object.keys(body).length === 0) throw badRequest('Nothing to update.');
    await db.update(schema.userSettings).set({ ...body, updatedAt: new Date() }).where(eq(schema.userSettings.userId, u.id));
    return { me: await getMe(u.id) };
  });

  // ---------------------------------------------------------------- placement assessment

  app.post('/api/assessment/start', async (req) => {
    const u = requireUser(req);
    // Resume an unfinished assessment if there is one.
    const [open] = await db
      .select()
      .from(schema.assessments)
      .where(and(eq(schema.assessments.userId, u.id), isNull(schema.assessments.completedAt)))
      .orderBy(desc(schema.assessments.startedAt))
      .limit(1);
    let assessment = open;
    if (!assessment) {
      const qs = await db
        .select({ id: schema.exercises.id })
        .from(schema.exercises)
        .where(and(eq(schema.exercises.purpose, 'placement'), eq(schema.exercises.status, 'published')))
        .orderBy(asc(schema.exercises.sortOrder));
      if (qs.length === 0) throw notFound('The placement test has no questions yet.');
      [assessment] = await db.insert(schema.assessments).values({ userId: u.id, questionIds: qs.map((q) => q.id) }).returning();
    }
    const questions = await db
      .select({
        id: schema.exercises.id,
        skill: schema.exercises.skill,
        prompt: schema.exercises.prompt,
        passage: schema.exercises.passage,
        options: schema.exercises.options,
      })
      .from(schema.exercises)
      .where(inArray(schema.exercises.id, assessment.questionIds));
    const order = new Map(assessment.questionIds.map((id, i) => [id, i]));
    questions.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    return { assessmentId: assessment.id, answers: assessment.answers, questions };
  });

  app.put('/api/assessment/:id/answers', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ answers: z.record(z.string().uuid(), z.string().max(500)) }), req.body);
    const res = await db
      .update(schema.assessments)
      .set({ answers: body.answers })
      .where(and(eq(schema.assessments.id, id), eq(schema.assessments.userId, u.id), isNull(schema.assessments.completedAt)))
      .returning({ id: schema.assessments.id });
    if (!res.length) throw notFound('Assessment not found or already completed.');
    return { ok: true };
  });

  app.post('/api/assessment/:id/submit', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ answers: z.record(z.string().uuid(), z.string().max(500)) }), req.body);
    const [a] = await db.select().from(schema.assessments).where(and(eq(schema.assessments.id, id), eq(schema.assessments.userId, u.id)));
    if (!a) throw notFound('Assessment not found.');
    if (a.completedAt) throw badRequest('This assessment has already been submitted.');
    const qs = await db.select().from(schema.exercises).where(inArray(schema.exercises.id, a.questionIds));
    const byLevel: Record<string, { correct: number; total: number }> = {};
    const bySkill: Record<string, { correct: number; total: number }> = {};
    const review = qs.map((q) => {
      const given = body.answers[q.id];
      const correct = given != null && q.answers.includes(given);
      const lvl = q.cefrLevel ?? 'A1';
      const sk = q.skill ?? 'grammar';
      byLevel[lvl] ??= { correct: 0, total: 0 };
      bySkill[sk] ??= { correct: 0, total: 0 };
      byLevel[lvl].total++;
      bySkill[sk].total++;
      if (correct) {
        byLevel[lvl].correct++;
        bySkill[sk].correct++;
      }
      return { id: q.id, prompt: q.prompt, level: lvl, skill: sk, given: given ?? null, correctAnswer: q.answers[0], correct, explanation: q.explanation };
    });
    const order = new Map(a.questionIds.map((qid, i) => [qid, i]));
    review.sort((x, y) => order.get(x.id)! - order.get(y.id)!);
    const score = review.filter((r) => r.correct).length;
    const level = placementLevel(byLevel);
    await db
      .update(schema.assessments)
      .set({ answers: body.answers, score, maxScore: review.length, breakdown: { byLevel, bySkill }, cefrResult: level, completedAt: new Date() })
      .where(eq(schema.assessments.id, id));
    await db.update(schema.profiles).set({ cefrLevel: level, cefrAssessedAt: new Date(), updatedAt: new Date() }).where(eq(schema.profiles.userId, u.id));
    const started = a.startedAt.getTime();
    await logActivity(u.id, { type: 'assessment', title: `Placement assessment: estimated level ${level}`, refId: id, xp: 50, minutes: Math.min(60, (Date.now() - started) / 60000) });
    return { level, score, maxScore: review.length, byLevel, bySkill, review };
  });

  app.get('/api/assessment/history', async (req) => {
    const u = requireUser(req);
    const rows = await db
      .select({ id: schema.assessments.id, score: schema.assessments.score, maxScore: schema.assessments.maxScore, cefrResult: schema.assessments.cefrResult, completedAt: schema.assessments.completedAt, breakdown: schema.assessments.breakdown })
      .from(schema.assessments)
      .where(and(eq(schema.assessments.userId, u.id), sql`completed_at is not null`))
      .orderBy(desc(schema.assessments.completedAt));
    return { assessments: rows };
  });
}
