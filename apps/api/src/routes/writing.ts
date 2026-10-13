import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { countWords, roundBand, type ChartSpec } from '@fluentpath/shared';
import { db, schema } from '../db';
import { badRequest, HttpError, notFound } from '../lib/errors';
import { parse, uuidParam } from '../lib/validate';
import { requireUser } from '../plugins/auth';
import { logActivity, userTimezone } from '../services/activity';
import { aiConfigured, evaluateWriting } from '../services/ai';
import { consume, getPlan, refund, requirePremium } from '../services/entitlements';
import { notify } from '../services/notifications';
import { describeVisual, writingStats } from '../services/textstats';

let academicWordCache: Set<string> | null = null;
async function academicWords() {
  if (!academicWordCache) {
    const rows = await db.select({ w: schema.words.word }).from(schema.words).where(inArray(schema.words.cefrLevel, ['B2', 'C1', 'C2']));
    academicWordCache = new Set(rows.map((r) => r.w.toLowerCase()).filter((w) => !w.includes(' ')));
  }
  return academicWordCache;
}

export async function writingRoutes(app: FastifyInstance) {
  app.get('/api/writing/tasks', async (req) => {
    const u = requireUser(req);
    const q = parse(z.object({ variant: z.enum(['academic', 'general']).optional(), task: z.coerce.number().int().min(1).max(2).optional() }), req.query);
    const plan = await getPlan(u.id);
    const rows = await db
      .select({
        id: schema.writingTasks.id,
        slug: schema.writingTasks.slug,
        variant: schema.writingTasks.variant,
        taskNumber: schema.writingTasks.taskNumber,
        taskType: schema.writingTasks.taskType,
        title: schema.writingTasks.title,
        isPremium: schema.writingTasks.isPremium,
        minWords: schema.writingTasks.minWords,
        timeMinutes: schema.writingTasks.timeMinutes,
        submissions: sql<number>`(select count(*)::int from writing_submissions s where s.task_id = ${schema.writingTasks.id} and s.user_id = ${u.id} and s.submitted_at is not null)`,
        bestBand: sql<number | null>`(select max(s.band_estimate) from writing_submissions s where s.task_id = ${schema.writingTasks.id} and s.user_id = ${u.id})`,
        draftId: sql<string | null>`(select s.id from writing_submissions s where s.task_id = ${schema.writingTasks.id} and s.user_id = ${u.id} and s.status = 'draft' and s.mock_attempt_id is null order by s.updated_at desc limit 1)`,
      })
      .from(schema.writingTasks)
      .where(
        and(
          eq(schema.writingTasks.status, 'published'),
          eq(schema.writingTasks.mockOnly, false),
          q.variant ? eq(schema.writingTasks.variant, q.variant) : undefined,
          q.task ? eq(schema.writingTasks.taskNumber, q.task) : undefined,
        ),
      )
      .orderBy(asc(schema.writingTasks.taskNumber), asc(schema.writingTasks.isPremium), asc(schema.writingTasks.createdAt));
    return { plan, aiConfigured: aiConfigured(), tasks: rows.map((r) => ({ ...r, locked: r.isPremium && plan !== 'premium' })) };
  });

  app.get('/api/writing/tasks/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const [task] = await db.select().from(schema.writingTasks).where(and(eq(schema.writingTasks.id, id), eq(schema.writingTasks.status, 'published')));
    if (!task) throw notFound('Writing task not found.');
    if (task.isPremium && !task.mockOnly) await requirePremium(u.id, 'This writing task');
    const { modelOutline, ...rest } = task;
    return { task: rest, modelOutline };
  });

  app.get('/api/writing/submissions', async (req) => {
    const u = requireUser(req);
    const q = parse(z.object({ taskId: z.string().uuid().optional() }), req.query);
    const rows = await db
      .select({
        id: schema.writingSubmissions.id,
        taskId: schema.writingSubmissions.taskId,
        status: schema.writingSubmissions.status,
        wordCount: schema.writingSubmissions.wordCount,
        bandEstimate: schema.writingSubmissions.bandEstimate,
        createdAt: schema.writingSubmissions.createdAt,
        updatedAt: schema.writingSubmissions.updatedAt,
        submittedAt: schema.writingSubmissions.submittedAt,
        taskTitle: schema.writingTasks.title,
        taskNumber: schema.writingTasks.taskNumber,
        variant: schema.writingTasks.variant,
      })
      .from(schema.writingSubmissions)
      .innerJoin(schema.writingTasks, eq(schema.writingTasks.id, schema.writingSubmissions.taskId))
      .where(and(eq(schema.writingSubmissions.userId, u.id), q.taskId ? eq(schema.writingSubmissions.taskId, q.taskId) : undefined))
      .orderBy(desc(schema.writingSubmissions.updatedAt))
      .limit(100);
    return { submissions: rows };
  });

  app.post('/api/writing/submissions', async (req, reply) => {
    const u = requireUser(req);
    const body = parse(z.object({ taskId: z.string().uuid() }), req.body);
    const [task] = await db.select().from(schema.writingTasks).where(and(eq(schema.writingTasks.id, body.taskId), eq(schema.writingTasks.status, 'published')));
    if (!task || task.mockOnly) throw notFound('Writing task not found.');
    if (task.isPremium) await requirePremium(u.id, 'This writing task');
    const [draft] = await db
      .select()
      .from(schema.writingSubmissions)
      .where(and(eq(schema.writingSubmissions.userId, u.id), eq(schema.writingSubmissions.taskId, task.id), eq(schema.writingSubmissions.status, 'draft'), sql`mock_attempt_id is null`))
      .orderBy(desc(schema.writingSubmissions.updatedAt))
      .limit(1);
    if (draft) return { submission: draft };
    const [s] = await db.insert(schema.writingSubmissions).values({ userId: u.id, taskId: task.id }).returning();
    reply.code(201);
    return { submission: s };
  });

  app.get('/api/writing/submissions/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const [s] = await db.select().from(schema.writingSubmissions).where(and(eq(schema.writingSubmissions.id, id), eq(schema.writingSubmissions.userId, u.id)));
    if (!s) throw notFound('Submission not found.');
    const [task] = await db.select().from(schema.writingTasks).where(eq(schema.writingTasks.id, s.taskId));
    return { submission: s, task, aiConfigured: aiConfigured() };
  });

  app.put('/api/writing/submissions/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ text: z.string().max(20000), timeSpentSec: z.number().int().min(0).max(36000).optional() }), req.body);
    const res = await db
      .update(schema.writingSubmissions)
      .set({ text: body.text, wordCount: countWords(body.text), ...(body.timeSpentSec != null ? { timeSpentSec: body.timeSpentSec } : {}), updatedAt: new Date() })
      .where(and(eq(schema.writingSubmissions.id, id), eq(schema.writingSubmissions.userId, u.id), eq(schema.writingSubmissions.status, 'draft')))
      .returning({ id: schema.writingSubmissions.id, updatedAt: schema.writingSubmissions.updatedAt, wordCount: schema.writingSubmissions.wordCount });
    if (!res.length) throw notFound('Draft not found (it may already have been submitted).');
    return { ok: true, ...res[0] };
  });

  app.delete('/api/writing/submissions/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const res = await db.delete(schema.writingSubmissions).where(and(eq(schema.writingSubmissions.id, id), eq(schema.writingSubmissions.userId, u.id))).returning({ id: schema.writingSubmissions.id });
    if (!res.length) throw notFound('Submission not found.');
    return { ok: true };
  });

  app.post('/api/writing/submissions/:id/submit', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ text: z.string().max(20000).optional(), timeSpentSec: z.number().int().min(0).max(36000).optional() }), req.body);
    const [s] = await db.select().from(schema.writingSubmissions).where(and(eq(schema.writingSubmissions.id, id), eq(schema.writingSubmissions.userId, u.id)));
    if (!s) throw notFound('Submission not found.');
    if (s.status !== 'draft') throw badRequest('This answer has already been submitted.');
    const text = body.text ?? s.text;
    if (countWords(text) < 20) throw badRequest('Please write at least 20 words before submitting.');
    const result = await submitWriting(u.id, id, text, body.timeSpentSec ?? s.timeSpentSec);
    return result;
  });

  app.post('/api/writing/submissions/:id/evaluate', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const [s] = await db.select().from(schema.writingSubmissions).where(and(eq(schema.writingSubmissions.id, id), eq(schema.writingSubmissions.userId, u.id)));
    if (!s) throw notFound('Submission not found.');
    if (!['submitted', 'evaluation_failed', 'not_evaluated'].includes(s.status)) throw badRequest('This submission cannot be evaluated again.');
    const outcome = await startEvaluation(u.id, id);
    return { status: outcome };
  });
}

/** Finalise a draft: store text, compute objective statistics, and start AI evaluation when possible. */
export async function submitWriting(userId: string, submissionId: string, text: string, timeSpentSec: number) {
  const [s] = await db.select().from(schema.writingSubmissions).where(eq(schema.writingSubmissions.id, submissionId));
  const [task] = await db.select().from(schema.writingTasks).where(eq(schema.writingTasks.id, s.taskId));
  const stats = writingStats(text, task.minWords, await academicWords());
  await db
    .update(schema.writingSubmissions)
    .set({ text, wordCount: stats.wordCount, timeSpentSec, status: 'submitted', submittedAt: new Date(), updatedAt: new Date(), feedback: { stats } })
    .where(eq(schema.writingSubmissions.id, submissionId));
  const r = await logActivity(userId, {
    type: 'ielts_writing',
    title: `IELTS writing: ${task.title} (${stats.wordCount} words)`,
    refId: submissionId,
    xp: 30,
    minutes: Math.max(1, timeSpentSec / 60),
  });
  const status = await startEvaluation(userId, submissionId);
  return { status, stats, newAchievements: r.newAchievements };
}

/** Returns the resulting status: evaluating | not_configured | limit_reached */
async function startEvaluation(userId: string, submissionId: string): Promise<string> {
  if (!aiConfigured()) {
    await setAiStatus(submissionId, 'submitted', 'not_configured');
    return 'not_configured';
  }
  const tz = await userTimezone(userId);
  try {
    await consume(userId, 'ai_writing_feedback', tz);
  } catch (err) {
    if (err instanceof HttpError && err.code === 'limit_reached') {
      await setAiStatus(submissionId, 'submitted', 'limit_reached', err.message);
      return 'limit_reached';
    }
    throw err;
  }
  await db.update(schema.writingSubmissions).set({ status: 'evaluating', feedbackError: null }).where(eq(schema.writingSubmissions.id, submissionId));
  const detailed = (await getPlan(userId)) === 'premium';
  // Evaluate in the background; the client polls GET /api/writing/submissions/:id.
  void runEvaluation(userId, submissionId, detailed, tz);
  return 'evaluating';
}

async function setAiStatus(submissionId: string, status: string, aiStatus: string, message?: string) {
  const [s] = await db.select({ feedback: schema.writingSubmissions.feedback }).from(schema.writingSubmissions).where(eq(schema.writingSubmissions.id, submissionId));
  await db
    .update(schema.writingSubmissions)
    .set({ status, feedback: { ...((s?.feedback as object) ?? {}), aiStatus }, feedbackError: message ?? null })
    .where(eq(schema.writingSubmissions.id, submissionId));
}

async function runEvaluation(userId: string, submissionId: string, detailed: boolean, tz: string) {
  try {
    const [s] = await db.select().from(schema.writingSubmissions).where(eq(schema.writingSubmissions.id, submissionId));
    const [task] = await db.select().from(schema.writingTasks).where(eq(schema.writingTasks.id, s.taskId));
    const ai = await evaluateWriting({
      variant: task.variant,
      taskNumber: task.taskNumber,
      taskType: task.taskType,
      prompt: task.prompt,
      visualDescription: describeVisual(task.visual as ChartSpec | null),
      text: s.text,
      wordCount: s.wordCount,
      minWords: task.minWords,
      detailed,
    });
    const crit = ai.criteria.map((c) => c.band);
    const band = crit.length === 4 ? roundBand(crit.reduce((a, b) => a + b, 0) / 4) : ai.overallBand;
    await db
      .update(schema.writingSubmissions)
      .set({ status: 'evaluated', bandEstimate: band, feedback: { ...((s.feedback as object) ?? {}), ai, aiStatus: 'done', detailed }, feedbackError: null })
      .where(eq(schema.writingSubmissions.id, submissionId));
    await notify(userId, { type: 'feedback', title: 'Your writing feedback is ready', body: `${task.title}: estimated band ${band} (unofficial).`, link: `/ielts/writing/submissions/${submissionId}` });
  } catch (err) {
    await refund(userId, 'ai_writing_feedback', tz);
    const message = err instanceof HttpError ? err.message : 'The evaluation failed unexpectedly. Please try again.';
    await db.update(schema.writingSubmissions).set({ status: 'evaluation_failed', feedbackError: message }).where(eq(schema.writingSubmissions.id, submissionId));
  }
}
