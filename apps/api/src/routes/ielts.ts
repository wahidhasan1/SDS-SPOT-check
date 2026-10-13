import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { ListeningContent, ReadingContent } from '@fluentpath/shared';
import { db, schema } from '../db';
import { badRequest, notFound } from '../lib/errors';
import { parse, uuidParam } from '../lib/validate';
import { requireUser } from '../plugins/auth';
import { logActivity } from '../services/activity';
import { getPlan, requirePremium } from '../services/entitlements';
import { bandFor, publicContent, scoreContent } from '../services/ielts';

const GRACE_MS = 60_000;
const answersSchema = z.record(z.string().regex(/^\d+$/), z.string().max(200));

export async function ieltsRoutes(app: FastifyInstance) {
  app.get('/api/ielts/sets', async (req) => {
    const u = requireUser(req);
    const q = parse(z.object({ module: z.enum(['reading', 'listening']), variant: z.enum(['academic', 'general']).optional() }), req.query);
    const plan = await getPlan(u.id);
    const rows = await db
      .select({
        id: schema.ieltsSets.id,
        slug: schema.ieltsSets.slug,
        module: schema.ieltsSets.module,
        variant: schema.ieltsSets.variant,
        title: schema.ieltsSets.title,
        description: schema.ieltsSets.description,
        difficulty: schema.ieltsSets.difficulty,
        timeLimitSec: schema.ieltsSets.timeLimitSec,
        questionCount: schema.ieltsSets.questionCount,
        isPremium: schema.ieltsSets.isPremium,
        attempts: sql<number>`(select count(*)::int from attempts a where a.ref_id = ${schema.ieltsSets.id} and a.user_id = ${u.id} and a.status = 'completed')`,
        bestScore: sql<number | null>`(select max(a.score) from attempts a where a.ref_id = ${schema.ieltsSets.id} and a.user_id = ${u.id} and a.status = 'completed')`,
        bestBand: sql<number | null>`(select max(a.band_estimate) from attempts a where a.ref_id = ${schema.ieltsSets.id} and a.user_id = ${u.id} and a.status = 'completed')`,
        inProgressId: sql<string | null>`(select a.id from attempts a where a.ref_id = ${schema.ieltsSets.id} and a.user_id = ${u.id} and a.status = 'in_progress' order by a.started_at desc limit 1)`,
      })
      .from(schema.ieltsSets)
      .where(
        and(
          eq(schema.ieltsSets.module, q.module),
          eq(schema.ieltsSets.status, 'published'),
          eq(schema.ieltsSets.mockOnly, false),
          q.module === 'reading' && q.variant ? eq(schema.ieltsSets.variant, q.variant) : undefined,
        ),
      )
      .orderBy(asc(schema.ieltsSets.isPremium), asc(schema.ieltsSets.createdAt));
    return { plan, sets: rows.map((r) => ({ ...r, locked: r.isPremium && plan !== 'premium' })) };
  });

  app.post('/api/ielts/sets/:id/start', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const [set] = await db.select().from(schema.ieltsSets).where(and(eq(schema.ieltsSets.id, id), eq(schema.ieltsSets.status, 'published')));
    if (!set || set.mockOnly) throw notFound('Practice set not found.');
    if (set.isPremium) await requirePremium(u.id, 'This practice set');
    const [open] = await db
      .select()
      .from(schema.attempts)
      .where(and(eq(schema.attempts.userId, u.id), eq(schema.attempts.refId, id), eq(schema.attempts.status, 'in_progress')))
      .orderBy(desc(schema.attempts.startedAt))
      .limit(1);
    if (open && open.deadlineAt && open.deadlineAt.getTime() + GRACE_MS > Date.now()) return { attemptId: open.id };
    if (open) await finalize(open.id); // expired attempt: submit what was saved
    const [a] = await db
      .insert(schema.attempts)
      .values({ userId: u.id, kind: `ielts_${set.module}`, refId: id, title: set.title, deadlineAt: new Date(Date.now() + set.timeLimitSec * 1000) })
      .returning({ id: schema.attempts.id });
    return { attemptId: a.id };
  });

  app.get('/api/ielts/attempts/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const [a] = await db.select().from(schema.attempts).where(and(eq(schema.attempts.id, id), eq(schema.attempts.userId, u.id)));
    if (!a || !a.kind.startsWith('ielts_') || !a.refId) throw notFound('Attempt not found.');
    const [set] = await db.select().from(schema.ieltsSets).where(eq(schema.ieltsSets.id, a.refId));
    if (!set) throw notFound('Practice set no longer exists.');
    const meta = { id: set.id, title: set.title, module: set.module, variant: set.variant, timeLimitSec: set.timeLimitSec, questionCount: set.questionCount };
    if (a.status === 'completed') {
      // After submission the learner may see answers, explanations and transcripts.
      return { attempt: a, set: meta, content: set.content, serverTime: Date.now() };
    }
    return { attempt: { ...a, results: null }, set: meta, content: publicContent(set.module, set.content as ReadingContent), serverTime: Date.now() };
  });

  app.put('/api/ielts/attempts/:id/answers', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ answers: answersSchema }), req.body);
    const [a] = await db.select().from(schema.attempts).where(and(eq(schema.attempts.id, id), eq(schema.attempts.userId, u.id)));
    if (!a || a.status !== 'in_progress') throw notFound('Attempt not found or already submitted.');
    if (a.deadlineAt && a.deadlineAt.getTime() + GRACE_MS < Date.now()) throw badRequest('Time is up for this attempt.');
    await db.update(schema.attempts).set({ answers: body.answers }).where(eq(schema.attempts.id, id));
    return { ok: true, savedAt: new Date().toISOString() };
  });

  app.post('/api/ielts/attempts/:id/submit', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ answers: answersSchema.optional() }), req.body);
    const [a] = await db.select().from(schema.attempts).where(and(eq(schema.attempts.id, id), eq(schema.attempts.userId, u.id)));
    if (!a || !a.kind.startsWith('ielts_')) throw notFound('Attempt not found.');
    if (a.status === 'completed') throw badRequest('This attempt has already been submitted.');
    // Late submissions only count answers saved before the deadline.
    const late = a.deadlineAt != null && a.deadlineAt.getTime() + GRACE_MS < Date.now();
    if (body.answers && !late) await db.update(schema.attempts).set({ answers: body.answers }).where(eq(schema.attempts.id, id));
    const result = await finalize(id);
    return { ...result, late };
  });

  app.get('/api/ielts/history', async (req) => {
    const u = requireUser(req);
    const q = parse(z.object({ module: z.enum(['reading', 'listening']).optional() }), req.query);
    const rows = await db
      .select({ id: schema.attempts.id, kind: schema.attempts.kind, title: schema.attempts.title, score: schema.attempts.score, maxScore: schema.attempts.maxScore, bandEstimate: schema.attempts.bandEstimate, durationSec: schema.attempts.durationSec, completedAt: schema.attempts.completedAt })
      .from(schema.attempts)
      .where(
        and(
          eq(schema.attempts.userId, u.id),
          eq(schema.attempts.status, 'completed'),
          q.module ? eq(schema.attempts.kind, `ielts_${q.module}`) : or(eq(schema.attempts.kind, 'ielts_reading'), eq(schema.attempts.kind, 'ielts_listening')),
        ),
      )
      .orderBy(desc(schema.attempts.completedAt))
      .limit(100);
    return { attempts: rows };
  });

}

/** Score an attempt with its saved answers and mark it completed. */
export async function finalize(attemptId: string) {
  const [a] = await db.select().from(schema.attempts).where(eq(schema.attempts.id, attemptId));
  const [set] = await db.select().from(schema.ieltsSets).where(eq(schema.ieltsSets.id, a.refId!));
  const content = set.content as ReadingContent | ListeningContent;
  const { results, score, maxScore } = scoreContent(content, a.answers);
  const module = set.module as 'reading' | 'listening';
  const band = bandFor(module, set.variant, score, maxScore);
  const durationSec = Math.round(Math.min(Date.now() - a.startedAt.getTime(), set.timeLimitSec * 1000 + GRACE_MS) / 1000);
  await db
    .update(schema.attempts)
    .set({ status: 'completed', results, score, maxScore, bandEstimate: band, durationSec, completedAt: new Date() })
    .where(eq(schema.attempts.id, attemptId));
  const r = await logActivity(a.userId, {
    type: `ielts_${module}`,
    title: `IELTS ${module}: ${set.title} (${score}/${maxScore}, band ≈ ${band})`,
    refId: attemptId,
    xp: 20 + score * 2,
    minutes: durationSec / 60,
  });
  return { score, maxScore, bandEstimate: band, results, newAchievements: r.newAchievements };
}
