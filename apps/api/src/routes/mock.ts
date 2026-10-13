import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { countWords, roundBand, type ListeningContent, type ReadingContent } from '@fluentpath/shared';
import { db, schema } from '../db';
import { badRequest, notFound } from '../lib/errors';
import { parse, uuidParam } from '../lib/validate';
import { requireUser } from '../plugins/auth';
import { logActivity, userTimezone } from '../services/activity';
import { consume, getPlan, requirePremium } from '../services/entitlements';
import { bandFor, publicContent, scoreContent } from '../services/ielts';
import { submitWriting } from './writing';

const GRACE_MS = 60_000;
type SectionState = { startedAt?: string; deadlineAt?: string; answers: Record<string, string>; submittedAt?: string; result?: unknown };
type MockSection = { module: 'listening' | 'reading' | 'writing' | 'speaking'; refs: string[]; timeLimitSec: number };

export async function mockRoutes(app: FastifyInstance) {
  app.get('/api/mock-tests', async (req) => {
    const u = requireUser(req);
    const plan = await getPlan(u.id);
    const tests = await db.select().from(schema.mockTests).where(eq(schema.mockTests.status, 'published')).orderBy(schema.mockTests.createdAt);
    const attempts = await db
      .select({ id: schema.mockAttempts.id, mockTestId: schema.mockAttempts.mockTestId, status: schema.mockAttempts.status, startedAt: schema.mockAttempts.startedAt, completedAt: schema.mockAttempts.completedAt })
      .from(schema.mockAttempts)
      .where(eq(schema.mockAttempts.userId, u.id))
      .orderBy(desc(schema.mockAttempts.startedAt));
    return {
      plan,
      tests: tests.map((t) => ({
        id: t.id,
        slug: t.slug,
        variant: t.variant,
        title: t.title,
        description: t.description,
        isPremium: t.isPremium,
        locked: t.isPremium && plan !== 'premium',
        sections: t.sections.map((s) => ({ module: s.module, timeLimitSec: s.timeLimitSec })),
        totalMinutes: Math.round(t.sections.reduce((a, s) => a + s.timeLimitSec, 0) / 60),
        inProgressId: attempts.find((a) => a.mockTestId === t.id && a.status === 'in_progress')?.id ?? null,
        completedCount: attempts.filter((a) => a.mockTestId === t.id && a.status === 'completed').length,
      })),
      history: attempts.filter((a) => a.status === 'completed'),
    };
  });

  app.post('/api/mock-tests/:id/start', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const [t] = await db.select().from(schema.mockTests).where(and(eq(schema.mockTests.id, id), eq(schema.mockTests.status, 'published')));
    if (!t) throw notFound('Mock test not found.');
    if (t.isPremium) await requirePremium(u.id, 'This mock test');
    const [open] = await db.select().from(schema.mockAttempts).where(and(eq(schema.mockAttempts.userId, u.id), eq(schema.mockAttempts.mockTestId, id), eq(schema.mockAttempts.status, 'in_progress')));
    if (open) return { attemptId: open.id, resumed: true };
    await consume(u.id, 'mock_test', await userTimezone(u.id));
    const state: SectionState[] = t.sections.map(() => ({ answers: {} }));
    state[0] = { answers: {}, startedAt: new Date().toISOString(), deadlineAt: new Date(Date.now() + t.sections[0].timeLimitSec * 1000).toISOString() };
    const [a] = await db.insert(schema.mockAttempts).values({ userId: u.id, mockTestId: id, sectionState: state }).returning({ id: schema.mockAttempts.id });
    return { attemptId: a.id, resumed: false };
  });

  app.get('/api/mock-attempts/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    let { attempt, test } = await load(id, u.id);
    // Auto-submit a section whose time ran out (e.g. the learner closed the tab).
    while (attempt.status === 'in_progress') {
      const st = attempt.sectionState[attempt.currentSection];
      if (!st.deadlineAt || new Date(st.deadlineAt).getTime() + GRACE_MS > Date.now()) break;
      await submitSection(attempt, test);
      ({ attempt, test } = await load(id, u.id));
    }
    const sections = test.sections as MockSection[];
    const base = {
      attempt: { id: attempt.id, status: attempt.status, currentSection: attempt.currentSection, startedAt: attempt.startedAt, completedAt: attempt.completedAt },
      test: { id: test.id, title: test.title, variant: test.variant, description: test.description, sections: sections.map((s) => ({ module: s.module, timeLimitSec: s.timeLimitSec })) },
      serverTime: Date.now(),
    };
    if (attempt.status === 'completed') return { ...base, results: await computeResults(attempt, test) };
    const idx = attempt.currentSection;
    const st = attempt.sectionState[idx];
    return { ...base, section: { index: idx, module: sections[idx].module, deadlineAt: st.deadlineAt, answers: st.answers, ...(await sectionContent(sections[idx], attempt.id)) } };
  });

  app.put('/api/mock-attempts/:id/answers', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ section: z.number().int().min(0), answers: z.record(z.string().max(100), z.string().max(20000)) }), req.body);
    const { attempt } = await load(id, u.id);
    if (attempt.status !== 'in_progress' || attempt.currentSection !== body.section) throw badRequest('This section is no longer active.');
    const st = attempt.sectionState[body.section];
    if (st.deadlineAt && new Date(st.deadlineAt).getTime() + GRACE_MS < Date.now()) throw badRequest('Time is up for this section.');
    const state = [...attempt.sectionState];
    state[body.section] = { ...st, answers: body.answers };
    await db.update(schema.mockAttempts).set({ sectionState: state }).where(eq(schema.mockAttempts.id, id));
    return { ok: true, savedAt: new Date().toISOString() };
  });

  app.post('/api/mock-attempts/:id/submit-section', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ section: z.number().int().min(0), answers: z.record(z.string().max(100), z.string().max(20000)).optional() }), req.body);
    const { attempt, test } = await load(id, u.id);
    if (attempt.status !== 'in_progress' || attempt.currentSection !== body.section) throw badRequest('This section has already been submitted.');
    const st = attempt.sectionState[body.section];
    const late = st.deadlineAt != null && new Date(st.deadlineAt).getTime() + GRACE_MS < Date.now();
    if (body.answers && !late) attempt.sectionState[body.section] = { ...st, answers: body.answers };
    await submitSection(attempt, test);
    return { ok: true, late };
  });

  app.post('/api/mock-attempts/:id/abandon', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const res = await db
      .update(schema.mockAttempts)
      .set({ status: 'abandoned', completedAt: new Date() })
      .where(and(eq(schema.mockAttempts.id, id), eq(schema.mockAttempts.userId, u.id), eq(schema.mockAttempts.status, 'in_progress')))
      .returning({ id: schema.mockAttempts.id });
    if (!res.length) throw notFound('No active mock test to abandon.');
    return { ok: true };
  });
}

async function load(id: string, userId: string) {
  const [attempt] = await db.select().from(schema.mockAttempts).where(and(eq(schema.mockAttempts.id, id), eq(schema.mockAttempts.userId, userId)));
  if (!attempt) throw notFound('Mock test attempt not found.');
  const [test] = await db.select().from(schema.mockTests).where(eq(schema.mockTests.id, attempt.mockTestId));
  return { attempt, test };
}

async function sectionContent(section: MockSection, attemptId: string) {
  if (section.module === 'listening' || section.module === 'reading') {
    const [set] = await db.select().from(schema.ieltsSets).where(eq(schema.ieltsSets.slug, section.refs[0]));
    if (!set) throw notFound('Mock test content is missing.');
    return { set: { id: set.id, title: set.title, questionCount: set.questionCount }, content: publicContent(set.module, set.content as ReadingContent) };
  }
  if (section.module === 'writing') {
    const tasks = await db.select().from(schema.writingTasks).where(inArray(schema.writingTasks.slug, section.refs));
    tasks.sort((a, b) => a.taskNumber - b.taskNumber);
    return { tasks: tasks.map(({ modelOutline: _m, ...t }) => t) };
  }
  const prompts = await db.select().from(schema.speakingPrompts).where(inArray(schema.speakingPrompts.slug, section.refs));
  prompts.sort((a, b) => a.part - b.part);
  const recordings = await db
    .select({ id: schema.speakingAttempts.id, promptId: schema.speakingAttempts.promptId, question: schema.speakingAttempts.question, durationSec: schema.speakingAttempts.durationSec })
    .from(schema.speakingAttempts)
    .where(eq(schema.speakingAttempts.mockAttemptId, attemptId));
  return { prompts, recordings };
}

async function submitSection(attempt: typeof schema.mockAttempts.$inferSelect, test: typeof schema.mockTests.$inferSelect) {
  const sections = test.sections as MockSection[];
  const idx = attempt.currentSection;
  const sec = sections[idx];
  const st = attempt.sectionState[idx];
  let result: unknown = null;
  if (sec.module === 'listening' || sec.module === 'reading') {
    const [set] = await db.select().from(schema.ieltsSets).where(eq(schema.ieltsSets.slug, sec.refs[0]));
    const scored = scoreContent(set.content as ReadingContent | ListeningContent, st.answers);
    result = { setId: set.id, score: scored.score, maxScore: scored.maxScore, band: bandFor(sec.module, test.variant, scored.score, scored.maxScore), results: scored.results };
  } else if (sec.module === 'writing') {
    const tasks = await db.select().from(schema.writingTasks).where(inArray(schema.writingTasks.slug, sec.refs));
    const submissions: { taskId: string; submissionId: string | null; wordCount: number }[] = [];
    for (const t of tasks) {
      const text = st.answers[t.slug] ?? '';
      if (countWords(text) < 1) {
        submissions.push({ taskId: t.id, submissionId: null, wordCount: 0 });
        continue;
      }
      const [s] = await db.insert(schema.writingSubmissions).values({ userId: attempt.userId, taskId: t.id, mockAttemptId: attempt.id, text }).returning({ id: schema.writingSubmissions.id });
      await submitWriting(attempt.userId, s.id, text, 0);
      submissions.push({ taskId: t.id, submissionId: s.id, wordCount: countWords(text) });
    }
    result = { submissions };
  } else {
    const recs = await db.select({ id: schema.speakingAttempts.id }).from(schema.speakingAttempts).where(eq(schema.speakingAttempts.mockAttemptId, attempt.id));
    result = { recordings: recs.map((r) => r.id) };
  }
  const state = [...attempt.sectionState];
  state[idx] = { ...st, submittedAt: new Date().toISOString(), result };
  const last = idx === sections.length - 1;
  if (!last) {
    state[idx + 1] = { ...state[idx + 1], startedAt: new Date().toISOString(), deadlineAt: new Date(Date.now() + sections[idx + 1].timeLimitSec * 1000).toISOString() };
  }
  await db
    .update(schema.mockAttempts)
    .set({ sectionState: state, currentSection: last ? idx : idx + 1, status: last ? 'completed' : 'in_progress', completedAt: last ? new Date() : null })
    .where(eq(schema.mockAttempts.id, attempt.id));
  if (last) {
    const minutes = (Date.now() - attempt.startedAt.getTime()) / 60000;
    await logActivity(attempt.userId, { type: 'mock_test', title: `Completed mock test: ${test.title}`, refId: attempt.id, xp: 100, minutes: Math.min(minutes, 180) });
  }
}

/** Results are recomputed on read so AI writing/speaking evaluations that finish later are included. */
async function computeResults(attempt: typeof schema.mockAttempts.$inferSelect, test: typeof schema.mockTests.$inferSelect) {
  const sections = test.sections as MockSection[];
  const out: Record<string, unknown>[] = [];
  const bands: Record<string, number | null> = { listening: null, reading: null, writing: null, speaking: null };
  for (const [i, sec] of sections.entries()) {
    const r = attempt.sectionState[i]?.result as Record<string, unknown> | undefined;
    if (sec.module === 'listening' || sec.module === 'reading') {
      const rr = r as { score: number; maxScore: number; band: number; results: unknown[] } | undefined;
      bands[sec.module] = rr?.band ?? null;
      out.push({ module: sec.module, score: rr?.score ?? 0, maxScore: rr?.maxScore ?? 0, band: rr?.band ?? null, results: rr?.results ?? [] });
    } else if (sec.module === 'writing') {
      const subsMeta = ((r as { submissions?: { taskId: string; submissionId: string | null; wordCount: number }[] })?.submissions ?? []);
      const ids = subsMeta.map((s) => s.submissionId).filter((x): x is string => Boolean(x));
      const subs = ids.length ? await db.select().from(schema.writingSubmissions).where(inArray(schema.writingSubmissions.id, ids)) : [];
      const tasks = await db.select().from(schema.writingTasks).where(inArray(schema.writingTasks.slug, sec.refs));
      const items = tasks
        .sort((a, b) => a.taskNumber - b.taskNumber)
        .map((t) => {
          const meta = subsMeta.find((m) => m.taskId === t.id);
          const s = subs.find((x) => x.id === meta?.submissionId);
          return { taskNumber: t.taskNumber, title: t.title, submissionId: s?.id ?? null, wordCount: meta?.wordCount ?? 0, status: s?.status ?? 'not_answered', band: s?.bandEstimate ?? null };
        });
      const t1 = items.find((x) => x.taskNumber === 1)?.band;
      const t2 = items.find((x) => x.taskNumber === 2)?.band;
      // Task 2 counts twice as much as Task 1.
      bands.writing = t1 != null && t2 != null ? roundBand((t1 + 2 * t2) / 3) : null;
      out.push({ module: 'writing', items, band: bands.writing });
    } else {
      const ids = (r as { recordings?: string[] })?.recordings ?? [];
      const recs = ids.length ? await db.select().from(schema.speakingAttempts).where(inArray(schema.speakingAttempts.id, ids)) : [];
      const aiBands = recs.map((x) => (x.feedback as { ai?: { overallBand: number } } | null)?.ai?.overallBand).filter((b): b is number => typeof b === 'number');
      bands.speaking = aiBands.length && aiBands.length === recs.length ? roundBand(aiBands.reduce((a, b) => a + b, 0) / aiBands.length) : null;
      out.push({ module: 'speaking', recordings: recs.map((x) => ({ id: x.id, question: x.question, durationSec: x.durationSec, aiStatus: (x.feedback as { aiStatus?: string } | null)?.aiStatus ?? null })), band: bands.speaking });
    }
  }
  const all = Object.values(bands);
  const overall = all.every((b) => b != null) ? roundBand((all as number[]).reduce((a, b) => a + b, 0) / 4) : null;
  return { sections: out, bands, overall };
}
