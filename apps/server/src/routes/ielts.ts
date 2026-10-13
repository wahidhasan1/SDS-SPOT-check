import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  countWords,
  isAnswerCorrect,
  NOTICE_UNOFFICIAL,
  overallBand,
  rawToBand,
  roundToHalf,
  saveAnswersSchema,
  speakingAnalyseSchema,
  wordLimitOk,
  writingDraftSchema,
} from '@app/shared';
import type pg from 'pg';
import { one, q, tx, type Queryable, pool } from '../db/pool';
import { requireAuth } from '../lib/auth';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { parse } from '../lib/validate';
import { recordActivity } from '../services/activity';
import { aiAvailable, aiSpeakingFeedback, aiWritingFeedback } from '../services/ai';
import { consumeDaily, getPlanId, getPlanLimits, refundDaily } from '../services/entitlements';
import { analyseSpeaking, analyseWriting } from '../services/feedback';
import { serverSttAvailable, transcribe } from '../services/speech';

const CHOICE_TYPES = new Set(['tfng', 'ynng', 'mcq', 'matching_headings', 'matching_info', 'matching_features', 'matching_names', 'matching_endings', 'map_labelling']);
const GRACE_MS = 30_000;

function questionIndex(content: any): Map<string, { group: any; number: number }> {
  const m = new Map();
  for (const g of content.groups) for (const qq of g.questions) m.set(qq.id, { group: g, number: qq.number });
  return m;
}

/** Server-side objective scoring. */
export function scoreSet(content: any, answerKey: any, answers: Record<string, string>) {
  const idx = questionIndex(content);
  const perQuestion: Record<string, { number: number; given: string; correct: boolean; answer: string; explanation: string }> = {};
  let score = 0;
  for (const [qid, key] of Object.entries<any>(answerKey)) {
    const meta = idx.get(qid);
    if (!meta) continue;
    const given = String(answers[qid] ?? '').trim();
    const isChoice = CHOICE_TYPES.has(meta.group.type) || !!meta.group.wordBox;
    let correct: boolean;
    if (isChoice) correct = key.accepted.some((a: string) => a.toUpperCase() === given.toUpperCase());
    else correct = isAnswerCorrect(given, key.accepted) && wordLimitOk(given, key.maxWords ?? meta.group.maxWords);
    if (correct) score++;
    perQuestion[qid] = {
      number: meta.number,
      given,
      correct,
      answer: String(key.accepted[0]).split('|')[0].replace(/[[\]]/g, ''),
      explanation: key.explanation,
    };
  }
  return { score, total: Object.keys(perQuestion).length, perQuestion };
}

function publicContent(content: any, includeTranscript: boolean) {
  const { transcript, ...rest } = content;
  return includeTranscript ? { ...rest, transcript } : rest;
}

function skillKey(set: any, testType: string) {
  if (set.skill === 'listening') return 'listening' as const;
  return testType === 'general' || set.test_type === 'general' ? ('reading_general' as const) : ('reading_academic' as const);
}

async function userTestType(userId: string, db: Queryable = pool) {
  const p = await one<any>('SELECT test_type FROM user_profiles WHERE user_id=$1', [userId], db);
  return p?.test_type === 'general' ? 'general' : 'academic';
}

async function submitAttempt(c: pg.PoolClient, attemptId: string, userId: string, finalAnswers?: Record<string, string>) {
  const a = await one<any>(
    `SELECT a.*, s.content, s.answer_key, s.skill, s.test_type, s.slug, s.title FROM practice_attempts a JOIN ielts_sets s ON s.id=a.set_id
     WHERE a.id=$1 AND a.user_id=$2 FOR UPDATE OF a`,
    [attemptId, userId],
    c,
  );
  if (!a) throw notFound('Attempt not found.');
  if (a.status === 'submitted') return a;
  const late = a.deadline && Date.now() > new Date(a.deadline).getTime() + GRACE_MS;
  const answers = finalAnswers && !late ? { ...a.answers, ...finalAnswers } : a.answers;
  const r = scoreSet(a.content, a.answer_key, answers);
  const tt = await userTestType(userId, c);
  const est = rawToBand(skillKey(a, tt), r.score, r.total);
  const elapsed = Math.round((Date.now() - new Date(a.started_at).getTime()) / 1000);
  const updated = await one<any>(
    `UPDATE practice_attempts SET status='submitted', submitted_at=now(), answers=$2, score=$3, total=$4, band=$5, result=$6,
       elapsed_sec=GREATEST(elapsed_sec, LEAST($7, 36000)) WHERE id=$1 RETURNING *`,
    [attemptId, answers, r.score, r.total, a.mock_attempt_id ? null : est.band, { perQuestion: r.perQuestion, scaled: est.scaled }, elapsed],
    c,
  );
  await recordActivity(userId, `ielts_${a.skill}`, attemptId, { score: r.score, total: r.total, band: est.band, slug: a.slug }, c);
  return { ...updated, content: a.content, skill: a.skill, slug: a.slug, title: a.title };
}

function attemptDto(a: any, set: any) {
  const submitted = a.status === 'submitted';
  return {
    id: a.id,
    status: a.status,
    mode: a.mode,
    mockAttemptId: a.mock_attempt_id,
    answers: a.answers,
    flagged: a.flagged,
    startedAt: a.started_at,
    deadline: a.deadline,
    submittedAt: a.submitted_at,
    elapsedSec: a.elapsed_sec,
    audioPlays: a.audio_plays,
    score: a.score,
    total: a.total,
    band: a.band,
    result: submitted ? a.result : null,
    set: {
      id: set.id,
      slug: set.slug,
      skill: set.skill,
      testType: set.test_type,
      title: set.title,
      description: set.description,
      timeLimitSec: set.time_limit_sec,
      questionCount: set.question_count,
      content: publicContent(set.content, submitted),
    },
  };
}

function visualSummary(visual: any): string | null {
  if (!visual) return null;
  if (visual.type === 'bar' || visual.type === 'line') {
    return `${visual.type} chart (${visual.unit}); categories: ${visual.categories.join(', ')}. ` +
      visual.series.map((s: any) => `${s.name}: ${s.values.join(', ')}`).join('; ');
  }
  if (visual.type === 'table') return `${visual.headers.join(' | ')}\n${visual.rows.map((r: string[]) => r.join(' | ')).join('\n')}${visual.note ? `\n${visual.note}` : ''}`;
  if (visual.type === 'process') return visual.steps.map((s: any, i: number) => `${i + 1}. ${s.label}: ${s.detail}`).join('\n');
  if (visual.type === 'maps') return visual.maps.map((m: any) => `${m.title}: ${m.items.map((i: any) => i.label).join(', ')}`).join('\n');
  return null;
}

async function evaluateWriting(c: Queryable, sub: any, prompt: any, userId: string, useQuota: boolean) {
  const analysis = await analyseWriting(sub.text, { task: prompt.task, kind: prompt.kind, testType: prompt.test_type === 'general' ? 'general' : 'academic', minWords: prompt.min_words });
  let feedback: any = null;
  let source = 'metrics_only';
  let band: number | null = null;
  let aiError: string | null = null;
  if (aiAvailable() && sub.text.trim().length > 0) {
    let consumed = false;
    try {
      if (useQuota) {
        await consumeDaily(userId, 'aiWritingFeedback', c);
        consumed = true;
      }
      feedback = await aiWritingFeedback({
        testType: prompt.test_type === 'general' ? 'general' : 'academic',
        task: prompt.task,
        kind: prompt.kind,
        prompt: prompt.prompt,
        visualSummary: visualSummary(prompt.visual),
        minWords: prompt.min_words,
        text: sub.text,
        wordCount: analysis.metrics.words,
      });
      source = 'ai';
      band = roundToHalf(feedback.bandEstimates.overall);
    } catch (e) {
      if (consumed) await refundDaily(userId, 'aiWritingFeedback');
      aiError = (e as Error).message;
    }
  } else if (!aiAvailable()) {
    aiError = 'AI feedback is not configured on this server, so only measurable text checks are shown and no band is estimated.';
  }
  const row = await one<any>(
    `UPDATE writing_submissions SET status='evaluated', submitted_at=COALESCE(submitted_at, now()), word_count=$2, metrics=$3,
       feedback=$4, feedback_source=$5, band_estimate=$6, updated_at=now() WHERE id=$1 RETURNING *`,
    [sub.id, analysis.metrics.words, { ...analysis, aiError }, feedback, source, band],
    c,
  );
  await recordActivity(userId, 'ielts_writing', sub.id, { band, words: analysis.metrics.words }, c);
  return row;
}

function writingDto(s: any, prompt?: any) {
  return {
    id: s.id,
    promptId: s.prompt_id,
    mockAttemptId: s.mock_attempt_id,
    status: s.status,
    text: s.text,
    wordCount: s.word_count,
    elapsedSec: s.elapsed_sec,
    metrics: s.metrics,
    feedback: s.feedback,
    feedbackSource: s.feedback_source,
    bandEstimate: s.band_estimate,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    submittedAt: s.submitted_at,
    prompt: prompt ? promptDto(prompt) : undefined,
    notice: NOTICE_UNOFFICIAL,
  };
}

function promptDto(p: any) {
  return {
    id: p.id, slug: p.slug, testType: p.test_type, task: p.task, kind: p.kind, title: p.title, prompt: p.prompt,
    instructions: p.instructions, visual: p.visual, minWords: p.min_words, timeLimitSec: p.time_limit_sec, isPremium: p.is_premium,
  };
}

async function assertPremiumAccess(userId: string, isPremium: boolean) {
  if (!isPremium) return;
  if ((await getPlanId(userId)) !== 'premium') throw new HttpError(402, 'premium_required', 'This practice set is part of Premium.');
}

// ---------- Mock tests ----------
interface MockSection {
  skill: 'listening' | 'reading' | 'writing' | 'speaking';
  timeLimitSec: number;
  setSlugs?: string[];
  promptSlugs?: string[];
  status: 'pending' | 'active' | 'submitted';
  startedAt?: string | null;
  deadline?: string | null;
  attemptIds?: string[];
  submissionIds?: string[];
  result?: { raw?: number; total?: number; band: number | null; note?: string } | null;
}

async function activateSection(c: pg.PoolClient, mock: any, idx: number, userId: string) {
  const sections: MockSection[] = mock.sections;
  const s = sections[idx];
  const now = new Date();
  s.status = 'active';
  s.startedAt = now.toISOString();
  s.deadline = mock.strict ? new Date(now.getTime() + s.timeLimitSec * 1000).toISOString() : null;
  if (s.skill === 'listening' || s.skill === 'reading') {
    s.attemptIds = [];
    for (const slug of s.setSlugs ?? []) {
      const set = await one<any>('SELECT id FROM ielts_sets WHERE slug=$1', [slug], c);
      if (!set) continue;
      const a = await one<any>(
        `INSERT INTO practice_attempts (user_id, set_id, mode, mock_attempt_id, deadline) VALUES ($1,$2,'mock',$3,$4) RETURNING id`,
        [userId, set.id, mock.id, s.deadline],
        c,
      );
      s.attemptIds.push(a.id);
    }
  } else if (s.skill === 'writing') {
    s.submissionIds = [];
    for (const slug of s.promptSlugs ?? []) {
      const p = await one<any>('SELECT id FROM writing_prompts WHERE slug=$1', [slug], c);
      if (!p) continue;
      const w = await one<any>(
        `INSERT INTO writing_submissions (user_id, prompt_id, mock_attempt_id) VALUES ($1,$2,$3) RETURNING id`,
        [userId, p.id, mock.id],
        c,
      );
      s.submissionIds.push(w.id);
    }
  }
  await c.query('UPDATE mock_attempts SET sections=$2, current_section=$3 WHERE id=$1', [mock.id, JSON.stringify(sections), idx]);
}

async function submitSection(c: pg.PoolClient, mock: any, idx: number, userId: string) {
  const sections: MockSection[] = mock.sections;
  const s = sections[idx];
  if (s.status !== 'active') throw conflict('This section is not active.');
  if (s.skill === 'listening' || s.skill === 'reading') {
    let raw = 0;
    let total = 0;
    for (const id of s.attemptIds ?? []) {
      const a = await submitAttempt(c, id, userId);
      raw += a.score ?? 0;
      total += a.total ?? 0;
    }
    const tt = mock.test_type === 'general' ? 'general' : 'academic';
    const key = s.skill === 'listening' ? 'listening' : tt === 'general' ? 'reading_general' : 'reading_academic';
    const est = rawToBand(key, raw, total);
    s.result = { raw, total, band: est.band, note: est.scaled ? 'Scaled to a 40-question test.' : undefined };
  } else if (s.skill === 'writing') {
    const bands: { task: number; band: number | null }[] = [];
    for (const id of s.submissionIds ?? []) {
      const sub = await one<any>('SELECT * FROM writing_submissions WHERE id=$1 AND user_id=$2', [id, userId], c);
      const prompt = await one<any>('SELECT * FROM writing_prompts WHERE id=$1', [sub.prompt_id], c);
      const ev = sub.status === 'evaluated' ? sub : await evaluateWriting(c, sub, prompt, userId, false);
      bands.push({ task: prompt.task, band: ev.band_estimate });
    }
    const t1 = bands.find((b) => b.task === 1)?.band;
    const t2 = bands.find((b) => b.task === 2)?.band;
    s.result =
      t1 != null && t2 != null
        ? { band: roundToHalf((t1 + 2 * t2) / 3), note: 'Task 2 is weighted double, as in IELTS.' }
        : { band: null, note: aiAvailable() ? 'Writing could not be scored (empty response or AI error).' : 'Writing is not scored because AI feedback is not configured.' };
  } else {
    const sessions = await q<any>('SELECT feedback FROM speaking_sessions WHERE mock_attempt_id=$1 AND user_id=$2', [mock.id, userId], c);
    const scored = sessions.filter((x) => x.feedback?.bandEstimates);
    if (scored.length) {
      const avg = scored.reduce((acc, x) => {
        const b = x.feedback.bandEstimates;
        return acc + (b.fluencyCoherence + b.lexicalResource + b.grammaticalRangeAccuracy) / 3;
      }, 0) / scored.length;
      s.result = { band: roundToHalf(avg), note: 'Estimated from transcripts only; pronunciation is not assessed.' };
    } else {
      s.result = { band: null, note: sessions.length ? 'Speaking could not be scored without AI feedback.' : 'No speaking answers were recorded.' };
    }
  }
  s.status = 'submitted';
  const next = sections.findIndex((x) => x.status === 'pending');
  if (next >= 0) {
    await c.query('UPDATE mock_attempts SET sections=$2 WHERE id=$1', [mock.id, JSON.stringify(sections)]);
    await activateSection(c, { ...mock, sections }, next, userId);
  } else {
    const bands = sections.map((x) => x.result?.band).filter((b): b is number => b != null);
    const overall = bands.length === 4 && sections.length === 4 ? overallBand(bands) : null;
    await c.query(
      `UPDATE mock_attempts SET sections=$2, status='completed', completed_at=now(), overall_band=$3, results=$4 WHERE id=$1`,
      [mock.id, JSON.stringify(sections), overall, { bands: Object.fromEntries(sections.map((x) => [x.skill, x.result?.band ?? null])) }],
    );
    await recordActivity(userId, 'mock_test', mock.id, { overall }, c);
  }
}

async function loadMock(c: Queryable, id: string, userId: string, lock = false) {
  const m = await one<any>(
    `SELECT a.*, t.title, t.test_type, t.slug FROM mock_attempts a JOIN mock_tests t ON t.id=a.mock_test_id WHERE a.id=$1 AND a.user_id=$2 ${lock ? 'FOR UPDATE OF a' : ''}`,
    [id, userId],
    c,
  );
  if (!m) throw notFound('Mock test attempt not found.');
  return m;
}

export async function ieltsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // ----- Reading & listening practice sets -----
  app.get('/ielts/sets', async (req) => {
    const qs = parse(z.object({ skill: z.enum(['reading', 'listening']).optional(), testType: z.enum(['academic', 'general']).optional() }), req.query);
    const rows = await q<any>(
      `SELECT s.id, s.slug, s.skill, s.test_type, s.title, s.description, s.difficulty, s.time_limit_sec, s.question_count, s.is_premium,
         (SELECT row_to_json(x) FROM (SELECT id, status, score, total, band, submitted_at FROM practice_attempts a
            WHERE a.set_id=s.id AND a.user_id=$1 AND a.mode<>'mock' ORDER BY started_at DESC LIMIT 1) x) AS last_attempt,
         (SELECT max(band) FROM practice_attempts a WHERE a.set_id=s.id AND a.user_id=$1 AND a.status='submitted') AS best_band
       FROM ielts_sets s WHERE s.status='published'
         AND ($2::text IS NULL OR s.skill=$2) AND ($3::text IS NULL OR s.test_type IN ($3, 'both'))
       ORDER BY s.skill, s.created_at`,
      [req.userId, qs.skill ?? null, qs.testType ?? null],
    );
    return rows.map((r) => ({
      id: r.id, slug: r.slug, skill: r.skill, testType: r.test_type, title: r.title, description: r.description, difficulty: r.difficulty,
      timeLimitSec: r.time_limit_sec, questionCount: r.question_count, isPremium: r.is_premium, lastAttempt: r.last_attempt, bestBand: r.best_band,
    }));
  });

  app.post('/ielts/sets/:slug/attempts', async (req) => {
    const { slug } = req.params as { slug: string };
    const { mode } = parse(z.object({ mode: z.enum(['practice', 'timed']).default('practice') }), req.body ?? {});
    const set = await one<any>(`SELECT * FROM ielts_sets WHERE slug=$1 AND status='published'`, [slug]);
    if (!set) throw notFound('Practice set not found.');
    await assertPremiumAccess(req.userId, set.is_premium);
    const existing = await one<any>(
      `SELECT * FROM practice_attempts WHERE user_id=$1 AND set_id=$2 AND mode=$3 AND status='in_progress'
         AND (deadline IS NULL OR deadline > now()) ORDER BY started_at DESC LIMIT 1`,
      [req.userId, set.id, mode],
    );
    const a =
      existing ??
      (await one<any>(
        `INSERT INTO practice_attempts (user_id, set_id, mode, deadline) VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.userId, set.id, mode, mode === 'timed' ? new Date(Date.now() + set.time_limit_sec * 1000) : null],
      ));
    return { resumed: !!existing, attempt: attemptDto(a, set) };
  });

  app.get('/ielts/attempts/:id', async (req) => {
    const { id } = req.params as { id: string };
    const a = await one<any>('SELECT * FROM practice_attempts WHERE id=$1 AND user_id=$2', [id, req.userId]);
    if (!a) throw notFound('Attempt not found.');
    // Timed attempts past their deadline are submitted automatically with saved answers.
    if (a.status === 'in_progress' && a.deadline && Date.now() > new Date(a.deadline).getTime() + GRACE_MS && !a.mock_attempt_id) {
      await tx((c) => submitAttempt(c, id, req.userId));
      const fresh = await one<any>('SELECT * FROM practice_attempts WHERE id=$1', [id]);
      const set = await one<any>('SELECT * FROM ielts_sets WHERE id=$1', [a.set_id]);
      return attemptDto(fresh, set);
    }
    const set = await one<any>('SELECT * FROM ielts_sets WHERE id=$1', [a.set_id]);
    return attemptDto(a, set);
  });

  app.put('/ielts/attempts/:id/answers', async (req) => {
    const { id } = req.params as { id: string };
    const input = parse(saveAnswersSchema.extend({ flagged: z.array(z.string().max(40)).max(100).optional() }), req.body);
    const a = await one<any>('SELECT status, deadline FROM practice_attempts WHERE id=$1 AND user_id=$2', [id, req.userId]);
    if (!a) throw notFound('Attempt not found.');
    if (a.status !== 'in_progress') throw conflict('This attempt has already been submitted.', 'already_submitted');
    if (a.deadline && Date.now() > new Date(a.deadline).getTime() + GRACE_MS) throw conflict('Time is up for this test.', 'time_up');
    await q(
      `UPDATE practice_attempts SET answers = answers || $3::jsonb, flagged = COALESCE($4::jsonb, flagged),
         elapsed_sec = GREATEST(elapsed_sec, COALESCE($5, 0)) WHERE id=$1 AND user_id=$2`,
      [id, req.userId, JSON.stringify(input.answers), input.flagged ? JSON.stringify(input.flagged) : null, input.elapsedSec ?? null],
    );
    return { ok: true, savedAt: new Date().toISOString() };
  });

  app.post('/ielts/attempts/:id/audio-played', async (req) => {
    const { id } = req.params as { id: string };
    const a = await one<any>(
      `SELECT a.audio_plays, a.mode, m.strict FROM practice_attempts a LEFT JOIN mock_attempts m ON m.id=a.mock_attempt_id WHERE a.id=$1 AND a.user_id=$2`,
      [id, req.userId],
    );
    if (!a) throw notFound('Attempt not found.');
    const strict = a.mode === 'mock' && a.strict;
    if (strict && a.audio_plays >= 1) return { allowed: false, plays: a.audio_plays, message: 'In strict test conditions the recording can be played only once.' };
    await q('UPDATE practice_attempts SET audio_plays=audio_plays+1 WHERE id=$1', [id]);
    return { allowed: true, plays: a.audio_plays + 1, strict };
  });

  app.post('/ielts/attempts/:id/submit', async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(z.object({ answers: z.record(z.string().max(40), z.string().max(300)).optional() }), req.body ?? {});
    const existing = await one<any>('SELECT mock_attempt_id FROM practice_attempts WHERE id=$1 AND user_id=$2', [id, req.userId]);
    if (!existing) throw notFound('Attempt not found.');
    if (existing.mock_attempt_id) throw badRequest('Mock test answers are submitted per section.');
    await tx((c) => submitAttempt(c, id, req.userId, body.answers));
    const a = await one<any>('SELECT * FROM practice_attempts WHERE id=$1', [id]);
    const set = await one<any>('SELECT * FROM ielts_sets WHERE id=$1', [a.set_id]);
    return attemptDto(a, set);
  });

  app.get('/ielts/history', async (req) =>
    q(
      `SELECT a.id, a.mode, a.status, a.score, a.total, a.band, a.started_at, a.submitted_at, a.elapsed_sec, s.title, s.skill, s.slug
       FROM practice_attempts a JOIN ielts_sets s ON s.id=a.set_id WHERE a.user_id=$1 AND a.mode<>'mock' ORDER BY a.started_at DESC LIMIT 100`,
      [req.userId],
    ),
  );

  // ----- Writing -----
  app.get('/ielts/writing/prompts', async (req) => {
    const qs = parse(z.object({ testType: z.enum(['academic', 'general']).optional(), task: z.coerce.number().int().min(1).max(2).optional() }), req.query);
    const rows = await q<any>(
      `SELECT p.*, (SELECT row_to_json(x) FROM (SELECT id, status, band_estimate, word_count, updated_at FROM writing_submissions w
          WHERE w.prompt_id=p.id AND w.user_id=$1 AND w.mock_attempt_id IS NULL ORDER BY updated_at DESC LIMIT 1) x) AS latest
       FROM writing_prompts p WHERE p.status='published' AND ($2::text IS NULL OR p.test_type IN ($2,'both')) AND ($3::int IS NULL OR p.task=$3)
       ORDER BY p.task, p.slug`,
      [req.userId, qs.testType ?? null, qs.task ?? null],
    );
    return rows.map((r) => ({ ...promptDto(r), latest: r.latest }));
  });

  app.get('/ielts/writing/prompts/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const p = await one<any>(`SELECT * FROM writing_prompts WHERE slug=$1`, [slug]);
    if (!p) throw notFound('Writing task not found.');
    const draft = await one<any>(
      `SELECT * FROM writing_submissions WHERE user_id=$1 AND prompt_id=$2 AND status='draft' AND mock_attempt_id IS NULL ORDER BY updated_at DESC LIMIT 1`,
      [req.userId, p.id],
    );
    return { prompt: promptDto(p), draft: draft ? writingDto(draft) : null };
  });

  app.put('/ielts/writing/drafts', async (req) => {
    const input = parse(writingDraftSchema.extend({ submissionId: z.string().uuid().optional() }), req.body);
    const p = await one<any>('SELECT * FROM writing_prompts WHERE id=$1', [input.promptId]);
    if (!p) throw notFound('Writing task not found.');
    await assertPremiumAccess(req.userId, p.is_premium && !input.mockAttemptId);
    const words = countWords(input.text);
    return tx(async (c) => {
      let sub = input.submissionId
        ? await one<any>('SELECT * FROM writing_submissions WHERE id=$1 AND user_id=$2 FOR UPDATE', [input.submissionId, req.userId], c)
        : await one<any>(
            `SELECT * FROM writing_submissions WHERE user_id=$1 AND prompt_id=$2 AND status='draft'
               AND mock_attempt_id IS NOT DISTINCT FROM $3 ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
            [req.userId, p.id, input.mockAttemptId ?? null],
            c,
          );
      if (sub && sub.status !== 'draft') throw conflict('This response has already been submitted.', 'already_submitted');
      if (sub?.mock_attempt_id) {
        const m = await one<any>('SELECT sections, strict FROM mock_attempts WHERE id=$1', [sub.mock_attempt_id], c);
        const sec = (m?.sections ?? []).find((x: any) => x.skill === 'writing');
        if (sec?.status !== 'active') throw conflict('The writing section is not active.', 'section_closed');
        if (sec.deadline && Date.now() > new Date(sec.deadline).getTime() + GRACE_MS) throw conflict('Time is up for the writing section.', 'time_up');
      }
      if (!sub) {
        sub = await one<any>(
          `INSERT INTO writing_submissions (user_id, prompt_id, mock_attempt_id, text, word_count, elapsed_sec) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [req.userId, p.id, input.mockAttemptId ?? null, input.text, words, input.elapsedSec ?? 0],
          c,
        );
      } else {
        sub = await one<any>(
          `UPDATE writing_submissions SET text=$2, word_count=$3, elapsed_sec=GREATEST(elapsed_sec, $4), updated_at=now() WHERE id=$1 RETURNING *`,
          [sub.id, input.text, words, input.elapsedSec ?? 0],
          c,
        );
      }
      // Draft history: keep a snapshot when the text changed meaningfully (max one per minute).
      const last = await one<any>('SELECT text, saved_at FROM writing_drafts WHERE submission_id=$1 ORDER BY saved_at DESC LIMIT 1', [sub.id], c);
      if (input.text.trim() && (!last || (last.text !== input.text && Date.now() - new Date(last.saved_at).getTime() > 60_000))) {
        await c.query('INSERT INTO writing_drafts (submission_id, text, word_count) VALUES ($1,$2,$3)', [sub.id, input.text, words]);
        await c.query(
          `DELETE FROM writing_drafts WHERE submission_id=$1 AND id NOT IN (SELECT id FROM writing_drafts WHERE submission_id=$1 ORDER BY saved_at DESC LIMIT 30)`,
          [sub.id],
        );
      }
      return { id: sub.id, wordCount: words, savedAt: sub.updated_at };
    });
  });

  app.post('/ielts/writing/submissions/:id/submit', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const { id } = req.params as { id: string };
    const sub = await one<any>('SELECT * FROM writing_submissions WHERE id=$1 AND user_id=$2', [id, req.userId]);
    if (!sub) throw notFound('Response not found.');
    if (sub.mock_attempt_id) throw badRequest('Mock test writing is evaluated when you submit the section.');
    if (sub.status !== 'draft') return writingDto(sub);
    if (countWords(sub.text) < 20) throw badRequest('Write at least 20 words before submitting.');
    const prompt = await one<any>('SELECT * FROM writing_prompts WHERE id=$1', [sub.prompt_id]);
    // Mark as submitted first so double-clicks cannot trigger two evaluations.
    const locked = await q(`UPDATE writing_submissions SET status='submitted', submitted_at=now() WHERE id=$1 AND status='draft' RETURNING id`, [id]);
    if (!locked.length) return writingDto((await one('SELECT * FROM writing_submissions WHERE id=$1', [id]))!);
    try {
      const ev = await evaluateWriting(pool, { ...sub, status: 'submitted' }, prompt, req.userId, true);
      return writingDto(ev, prompt);
    } catch (e) {
      await q(`UPDATE writing_submissions SET status='draft', submitted_at=NULL WHERE id=$1`, [id]);
      throw e;
    }
  });

  app.get('/ielts/writing/submissions', async (req) => {
    const rows = await q<any>(
      `SELECT w.id, w.status, w.word_count, w.band_estimate, w.feedback_source, w.updated_at, w.submitted_at, w.mock_attempt_id,
              p.title, p.task, p.test_type, p.slug
       FROM writing_submissions w JOIN writing_prompts p ON p.id=w.prompt_id WHERE w.user_id=$1 ORDER BY w.updated_at DESC LIMIT 100`,
      [req.userId],
    );
    return rows;
  });

  app.get('/ielts/writing/submissions/:id', async (req) => {
    const { id } = req.params as { id: string };
    const sub = await one<any>('SELECT * FROM writing_submissions WHERE id=$1 AND user_id=$2', [id, req.userId]);
    if (!sub) throw notFound('Response not found.');
    const prompt = await one<any>('SELECT * FROM writing_prompts WHERE id=$1', [sub.prompt_id]);
    const drafts = await q('SELECT id, word_count, saved_at FROM writing_drafts WHERE submission_id=$1 ORDER BY saved_at DESC', [id]);
    return { ...writingDto(sub, prompt), drafts };
  });

  app.get('/ielts/writing/drafts/:draftId', async (req) => {
    const { draftId } = req.params as { draftId: string };
    const d = await one<any>(
      `SELECT d.* FROM writing_drafts d JOIN writing_submissions w ON w.id=d.submission_id WHERE d.id=$1 AND w.user_id=$2`,
      [draftId, req.userId],
    );
    if (!d) throw notFound('Draft not found.');
    return d;
  });

  // ----- Speaking -----
  app.get('/ielts/speaking/prompts', async () => {
    const rows = await q<any>(`SELECT id, slug, part, topic, text, bullets, questions, group_key FROM speaking_prompts WHERE status='published' ORDER BY part, slug`);
    return {
      part1: rows.filter((r) => r.part === 1),
      part2: rows.filter((r) => r.part === 2),
      part3: rows.filter((r) => r.part === 3),
      serverTranscription: serverSttAvailable(),
      aiFeedback: aiAvailable(),
    };
  });

  app.post('/ielts/speaking/transcribe', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    if (!serverSttAvailable()) throw new HttpError(503, 'not_configured', 'Server transcription is not configured. Use your browser or device speech recognition instead.');
    const file = await (req as any).file();
    if (!file) throw badRequest('Upload an audio recording.');
    if (!/^audio\//.test(file.mimetype) && file.mimetype !== 'video/webm') throw badRequest('Unsupported audio format.');
    const buf = await file.toBuffer();
    return transcribe(buf, file.filename || 'answer.webm', file.mimetype);
  });

  app.post('/ielts/speaking/analyse', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const input = parse(speakingAnalyseSchema, req.body);
    if (input.mockAttemptId) {
      const m = await one<any>('SELECT sections FROM mock_attempts WHERE id=$1 AND user_id=$2', [input.mockAttemptId, req.userId]);
      const sec = (m?.sections ?? []).find((x: any) => x.skill === 'speaking');
      if (!sec || sec.status !== 'active') throw conflict('The speaking section is not active.', 'section_closed');
    }
    const analysis = await analyseSpeaking(input.transcript, input.durationSec, input.part);
    let feedback: any = null;
    let source = 'metrics_only';
    let band: number | null = null;
    let aiError: string | null = null;
    if (aiAvailable()) {
      let consumed = false;
      try {
        if (!input.mockAttemptId) {
          await consumeDaily(req.userId, 'speakingAnalyses');
          consumed = true;
        }
        feedback = await aiSpeakingFeedback({
          part: input.part,
          question: input.question,
          transcript: input.transcript,
          durationSec: input.durationSec,
          wordsPerMinute: analysis.metrics.wordsPerMinute,
        });
        source = 'ai';
        const b = feedback.bandEstimates;
        band = roundToHalf((b.fluencyCoherence + b.lexicalResource + b.grammaticalRangeAccuracy) / 3);
      } catch (e) {
        if (consumed) await refundDaily(req.userId, 'speakingAnalyses');
        if ((e as HttpError).code === 'limit_reached') throw e;
        aiError = (e as Error).message;
      }
    } else {
      aiError = 'AI feedback is not configured, so this analysis shows measurable transcript statistics only.';
    }
    const row = await one<any>(
      `INSERT INTO speaking_sessions (user_id, prompt_id, mock_attempt_id, part, question, transcript, transcript_source, duration_sec, metrics, feedback, feedback_source, band_estimate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.userId, input.promptId ?? null, input.mockAttemptId ?? null, input.part, input.question, input.transcript, input.transcriptSource,
        input.durationSec, { ...analysis, aiError }, feedback, source, band],
    );
    await recordActivity(req.userId, 'ielts_speaking', row.id, { part: input.part, band });
    return { ...row, notice: NOTICE_UNOFFICIAL };
  });

  app.get('/ielts/speaking/sessions', async (req) =>
    q(
      `SELECT id, part, question, duration_sec, band_estimate, feedback_source, transcript_source, created_at FROM speaking_sessions
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [req.userId],
    ),
  );

  app.get('/ielts/speaking/sessions/:id', async (req) => {
    const { id } = req.params as { id: string };
    const s = await one<any>('SELECT * FROM speaking_sessions WHERE id=$1 AND user_id=$2', [id, req.userId]);
    if (!s) throw notFound('Session not found.');
    return { ...s, notice: NOTICE_UNOFFICIAL };
  });

  // ----- Mock tests -----
  app.get('/ielts/mocks', async (req) => {
    const tests = await q<any>(`SELECT id, slug, title, test_type, description, sections, is_premium FROM mock_tests WHERE status='published' ORDER BY test_type`);
    const attempts = await q<any>(
      `SELECT a.id, a.status, a.overall_band, a.results, a.started_at, a.completed_at, a.strict, t.title, t.slug, a.sections
       FROM mock_attempts a JOIN mock_tests t ON t.id=a.mock_test_id WHERE a.user_id=$1 ORDER BY a.started_at DESC`,
      [req.userId],
    );
    const limits = await getPlanLimits(await getPlanId(req.userId));
    const used = await one<{ n: number }>(`SELECT count(*)::int AS n FROM mock_attempts WHERE user_id=$1 AND started_at > now() - interval '30 days'`, [req.userId]);
    return {
      tests: tests.map((t) => ({ ...t, sections: t.sections.map((s: any) => ({ skill: s.skill, timeLimitSec: s.timeLimitSec })) })),
      attempts: attempts.map((a) => ({ ...a, sections: a.sections.map((s: any) => ({ skill: s.skill, status: s.status, result: s.result })) })),
      quota: { limit: limits.mockTestsPerMonth, usedLast30Days: used?.n ?? 0 },
      aiFeedback: aiAvailable(),
    };
  });

  app.post('/ielts/mocks/:slug/start', async (req) => {
    const { slug } = req.params as { slug: string };
    const input = parse(
      z.object({ strict: z.boolean().default(true), skills: z.array(z.enum(['listening', 'reading', 'writing', 'speaking'])).min(1).max(4).optional() }),
      req.body ?? {},
    );
    const t = await one<any>(`SELECT * FROM mock_tests WHERE slug=$1 AND status='published'`, [slug]);
    if (!t) throw notFound('Mock test not found.');
    await assertPremiumAccess(req.userId, t.is_premium);
    const limits = await getPlanLimits(await getPlanId(req.userId));
    return tx(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['mock:' + req.userId]);
      const active = await one<any>(`SELECT id FROM mock_attempts WHERE user_id=$1 AND status='in_progress' AND mock_test_id=$2`, [req.userId, t.id], c);
      if (active) return { id: active.id, resumed: true };
      if (limits.mockTestsPerMonth != null) {
        const used = await one<{ n: number }>(`SELECT count(*)::int AS n FROM mock_attempts WHERE user_id=$1 AND started_at > now() - interval '30 days'`, [req.userId], c);
        if ((used?.n ?? 0) >= limits.mockTestsPerMonth) {
          throw new HttpError(402, 'limit_reached', `Your plan includes ${limits.mockTestsPerMonth} mock test${limits.mockTestsPerMonth === 1 ? '' : 's'} every 30 days. Upgrade to Premium for unlimited mock tests.`);
        }
      }
      const sections: MockSection[] = (t.sections as any[])
        .filter((s) => !input.skills || input.skills.includes(s.skill))
        .map((s) => ({ ...s, status: 'pending' as const }));
      const m = await one<any>(
        `INSERT INTO mock_attempts (user_id, mock_test_id, strict, sections) VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.userId, t.id, input.strict, JSON.stringify(sections)],
        c,
      );
      await activateSection(c, { ...m, sections }, 0, req.userId);
      return { id: m.id, resumed: false };
    });
  });

  app.get('/ielts/mock-attempts/:id', async (req) => {
    const { id } = req.params as { id: string };
    let m = await loadMock(pool, id, req.userId);
    const active = (m.sections as MockSection[]).findIndex((s) => s.status === 'active');
    if (m.status === 'in_progress' && active >= 0) {
      const s = m.sections[active];
      if (s.deadline && Date.now() > new Date(s.deadline).getTime() + GRACE_MS) {
        await tx(async (c) => {
          const locked = await loadMock(c, id, req.userId, true);
          if (locked.sections[active].status === 'active') await submitSection(c, locked, active, req.userId);
        });
        m = await loadMock(pool, id, req.userId);
      }
    }
    const sections = m.sections as MockSection[];
    const idx = sections.findIndex((s) => s.status === 'active');
    let current: any = null;
    if (idx >= 0) {
      const s = sections[idx];
      if (s.skill === 'listening' || s.skill === 'reading') {
        const attempts = [];
        for (const aid of s.attemptIds ?? []) {
          const a = await one<any>('SELECT * FROM practice_attempts WHERE id=$1', [aid]);
          const set = await one<any>('SELECT * FROM ielts_sets WHERE id=$1', [a.set_id]);
          attempts.push(attemptDto(a, set));
        }
        current = { index: idx, skill: s.skill, deadline: s.deadline, startedAt: s.startedAt, timeLimitSec: s.timeLimitSec, attempts };
      } else if (s.skill === 'writing') {
        const subs = [];
        for (const sid of s.submissionIds ?? []) {
          const w = await one<any>('SELECT * FROM writing_submissions WHERE id=$1', [sid]);
          const p = await one<any>('SELECT * FROM writing_prompts WHERE id=$1', [w.prompt_id]);
          subs.push(writingDto(w, p));
        }
        current = { index: idx, skill: s.skill, deadline: s.deadline, startedAt: s.startedAt, timeLimitSec: s.timeLimitSec, submissions: subs };
      } else {
        const prompts = await q<any>(`SELECT id, slug, part, topic, text, bullets, questions FROM speaking_prompts WHERE slug = ANY($1) ORDER BY part`, [s.promptSlugs ?? []]);
        const done = await q<any>('SELECT id, part, question, band_estimate, created_at FROM speaking_sessions WHERE mock_attempt_id=$1 ORDER BY created_at', [id]);
        current = { index: idx, skill: s.skill, deadline: s.deadline, startedAt: s.startedAt, timeLimitSec: s.timeLimitSec, prompts, answered: done };
      }
    }
    return {
      id: m.id,
      title: m.title,
      testType: m.test_type,
      strict: m.strict,
      status: m.status,
      overallBand: m.overall_band,
      startedAt: m.started_at,
      completedAt: m.completed_at,
      sections: sections.map((s) => ({ skill: s.skill, status: s.status, timeLimitSec: s.timeLimitSec, deadline: s.deadline, result: s.result ?? null, attemptIds: s.attemptIds ?? [], submissionIds: s.submissionIds ?? [] })),
      current,
      aiFeedback: aiAvailable(),
      notice: NOTICE_UNOFFICIAL,
    };
  });

  app.post('/ielts/mock-attempts/:id/sections/:idx/submit', async (req) => {
    const { id, idx } = req.params as { id: string; idx: string };
    await tx(async (c) => {
      const m = await loadMock(c, id, req.userId, true);
      if (m.status !== 'in_progress') throw conflict('This mock test is already finished.');
      const i = Number(idx);
      if (!Number.isInteger(i) || !m.sections[i]) throw badRequest('Invalid section.');
      if (m.sections[i].status !== 'active') throw conflict('This section has already been submitted.', 'already_submitted');
      await submitSection(c, m, i, req.userId);
    });
    return { ok: true };
  });

  app.post('/ielts/mock-attempts/:id/abandon', async (req) => {
    const { id } = req.params as { id: string };
    const r = await q(`UPDATE mock_attempts SET status='abandoned', completed_at=now() WHERE id=$1 AND user_id=$2 AND status='in_progress' RETURNING id`, [id, req.userId]);
    if (!r.length) throw forbidden('This mock test cannot be abandoned.');
    return { ok: true };
  });
}
