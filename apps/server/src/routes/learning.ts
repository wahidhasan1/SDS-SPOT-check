import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import {
  CEFR_LEVELS,
  dueDate,
  grammarAnswerSchema,
  isAnswerCorrect,
  nextSrsState,
  reviewWordSchema,
  saveWordSchema,
} from '@app/shared';
import { one, q, tx } from '../db/pool';
import { requireAuth } from '../lib/auth';
import { conflict, notFound } from '../lib/errors';
import { parse } from '../lib/validate';
import { generateQuestions } from '../realtime/battles';
import { recordActivity } from '../services/activity';
import { lookupWord } from '../services/dictionary';

function vocabDto(r: any) {
  return {
    id: r.id,
    word: r.word,
    ipa: r.ipa,
    partOfSpeech: r.part_of_speech,
    meaning: r.meaning,
    examples: r.examples,
    synonyms: r.synonyms,
    antonyms: r.antonyms,
    cefr: r.cefr,
    tags: r.tags,
    usageNote: r.usage_note,
    saved: r.saved_id ? true : false,
    savedId: r.saved_id ?? null,
  };
}

function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function learningRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // ---------- Vocabulary ----------
  app.get('/vocabulary', async (req) => {
    const qs = parse(
      z.object({
        level: z.enum(CEFR_LEVELS).optional(),
        tag: z.string().max(30).optional(),
        q: z.string().max(60).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        offset: z.coerce.number().int().min(0).default(0),
      }),
      req.query,
    );
    const where = [`v.status='published'`];
    const vals: unknown[] = [req.userId];
    if (qs.level) {
      vals.push(qs.level);
      where.push(`v.cefr=$${vals.length}`);
    }
    if (qs.tag) {
      vals.push(qs.tag);
      where.push(`$${vals.length} = ANY(v.tags)`);
    }
    if (qs.q) {
      vals.push(`%${qs.q.toLowerCase()}%`);
      where.push(`(lower(v.word) LIKE $${vals.length} OR lower(v.meaning) LIKE $${vals.length})`);
    }
    vals.push(qs.limit, qs.offset);
    const rows = await q(
      `SELECT v.*, s.id AS saved_id, count(*) OVER() AS total FROM vocabulary v
       LEFT JOIN saved_words s ON s.user_id=$1 AND lower(s.word)=lower(v.word)
       WHERE ${where.join(' AND ')} ORDER BY array_position(ARRAY['A1','A2','B1','B2','C1','C2'], v.cefr), v.word
       LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
      vals,
    );
    return { items: rows.map(vocabDto), total: Number((rows[0] as any)?.total ?? 0) };
  });

  app.get('/vocabulary/daily', async (req) => {
    const p = await one<any>('SELECT cefr_level, test_type FROM user_profiles WHERE user_id=$1', [req.userId]);
    const lvl = p?.cefr_level ?? 'B1';
    const idx = CEFR_LEVELS.indexOf(lvl);
    const levels = CEFR_LEVELS.slice(Math.max(0, idx), Math.min(6, idx + 2));
    const day = new Date().toISOString().slice(0, 10);
    const rows = await q<any>(
      `SELECT v.*, s.id AS saved_id FROM vocabulary v LEFT JOIN saved_words s ON s.user_id=$1 AND lower(s.word)=lower(v.word)
       WHERE v.status='published' AND v.cefr = ANY($2)`,
      [req.userId, levels],
    );
    // Deterministic per user per day, preferring words not yet saved.
    const seeded = rows
      .map((r) => ({ r, k: createHash('md5').update(req.userId + day + r.word).digest('hex') }))
      .sort((a, b) => Number(!!a.r.saved_id) - Number(!!b.r.saved_id) || a.k.localeCompare(b.k));
    return { date: day, level: lvl, words: seeded.slice(0, 5).map((x) => vocabDto(x.r)) };
  });

  app.get('/vocabulary/saved', async (req) => {
    const rows = await q(
      `SELECT s.*, v.ipa, v.part_of_speech, v.cefr FROM saved_words s LEFT JOIN vocabulary v ON v.id=s.vocabulary_id
       WHERE s.user_id=$1 ORDER BY s.created_at DESC`,
      [req.userId],
    );
    return rows.map((r: any) => ({
      id: r.id,
      word: r.word,
      meaning: r.meaning,
      example: r.example,
      context: r.context,
      source: r.source,
      ipa: r.ipa,
      partOfSpeech: r.part_of_speech,
      cefr: r.cefr,
      dueAt: r.due_at,
      intervalDays: r.interval_days,
      repetitions: r.repetitions,
      mastered: r.interval_days >= 21,
      createdAt: r.created_at,
    }));
  });

  app.post('/vocabulary/saved', async (req) => {
    const input = parse(saveWordSchema, req.body);
    let vocab = input.vocabularyId
      ? await one<any>('SELECT * FROM vocabulary WHERE id=$1', [input.vocabularyId])
      : await one<any>(`SELECT * FROM vocabulary WHERE lower(word)=lower($1) AND status='published' LIMIT 1`, [input.word]);
    let meaning = input.meaning ?? vocab?.meaning ?? null;
    let example = input.example ?? vocab?.examples?.[0] ?? null;
    if (!meaning) {
      // Fill from the offline dictionary so saved words are always reviewable.
      const d = lookupWord(input.word, input.context);
      if (d) {
        meaning = d.senses[0].definition;
        example = example ?? d.senses[0].examples[0] ?? null;
      }
    }
    const row = await one<any>(
      `INSERT INTO saved_words (user_id, vocabulary_id, word, meaning, example, context, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id, lower(word)) DO UPDATE SET meaning=COALESCE(EXCLUDED.meaning, saved_words.meaning),
         example=COALESCE(saved_words.example, EXCLUDED.example), context=COALESCE(EXCLUDED.context, saved_words.context)
       RETURNING id, word, meaning`,
      [req.userId, vocab?.id ?? null, input.word, meaning, example, input.context ?? null, input.source],
    );
    return row;
  });

  app.delete('/vocabulary/saved/:id', async (req) => {
    const { id } = req.params as { id: string };
    await q('DELETE FROM saved_words WHERE id=$1 AND user_id=$2', [id, req.userId]);
    return { ok: true };
  });

  app.get('/vocabulary/review', async (req) => {
    const rows = await q<any>(
      `SELECT s.*, v.ipa, v.part_of_speech, v.synonyms FROM saved_words s LEFT JOIN vocabulary v ON v.id=s.vocabulary_id
       WHERE s.user_id=$1 AND s.due_at <= now() ORDER BY s.due_at LIMIT 20`,
      [req.userId],
    );
    return rows.map((r) => ({
      id: r.id, word: r.word, meaning: r.meaning, example: r.example, context: r.context, ipa: r.ipa, partOfSpeech: r.part_of_speech,
      synonyms: r.synonyms ?? [], repetitions: r.repetitions,
    }));
  });

  app.post('/vocabulary/saved/:id/review', async (req) => {
    const { id } = req.params as { id: string };
    const { quality } = parse(reviewWordSchema, req.body);
    return tx(async (c) => {
      const s = await one<any>('SELECT * FROM saved_words WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, req.userId], c);
      if (!s) throw notFound('Word not found.');
      const next = nextSrsState({ easeFactor: Number(s.ease_factor), intervalDays: s.interval_days, repetitions: s.repetitions }, quality);
      const due = dueDate(new Date(), next.intervalDays);
      await c.query(
        `UPDATE saved_words SET ease_factor=$2, interval_days=$3, repetitions=$4, due_at=$5, last_reviewed_at=now() WHERE id=$1`,
        [id, next.easeFactor, next.intervalDays, next.repetitions, due],
      );
      await c.query('INSERT INTO word_reviews (saved_word_id, user_id, quality) VALUES ($1,$2,$3)', [id, req.userId, quality]);
      await recordActivity(req.userId, 'vocab_review', id, { quality }, c);
      return { nextDue: due, intervalDays: next.intervalDays };
    });
  });

  app.get('/vocabulary/stats', async (req) => {
    const r = await one<any>(
      `SELECT count(*)::int AS saved,
              count(*) FILTER (WHERE interval_days >= 21)::int AS mastered,
              count(*) FILTER (WHERE due_at <= now())::int AS due,
              (SELECT count(*)::int FROM word_reviews w WHERE w.user_id=$1 AND w.reviewed_at > now() - interval '7 days') AS reviewed_week,
              (SELECT count(*)::int FROM quiz_attempts qa WHERE qa.user_id=$1 AND qa.status='submitted') AS quizzes
       FROM saved_words WHERE user_id=$1`,
      [req.userId],
    );
    return r;
  });

  app.post('/vocabulary/quiz', async (req) => {
    const { kind } = parse(z.object({ kind: z.enum(['vocabulary', 'synonym', 'ielts_vocabulary', 'spelling']).default('vocabulary') }), req.body ?? {});
    const questions = await generateQuestions(kind, 10);
    if (questions.length < 3) throw notFound('Not enough vocabulary content for a quiz yet.');
    const row = await one<any>(
      `INSERT INTO quiz_attempts (user_id, kind, questions, total) VALUES ($1,$2,$3,$4) RETURNING id`,
      [req.userId, kind, JSON.stringify(questions), questions.length],
    );
    return {
      id: row.id,
      kind,
      questions: questions.map((qq, i) => ({ index: i, kind: qq.kind, prompt: qq.prompt, hint: qq.hint, options: qq.options })),
    };
  });

  app.post('/vocabulary/quiz/:id/submit', async (req) => {
    const { id } = req.params as { id: string };
    const { answers } = parse(z.object({ answers: z.record(z.string(), z.string().max(200)) }), req.body);
    return tx(async (c) => {
      const qa = await one<any>('SELECT * FROM quiz_attempts WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, req.userId], c);
      if (!qa) throw notFound('Quiz not found.');
      if (qa.status === 'submitted') throw conflict('This quiz was already submitted.');
      const results = (qa.questions as any[]).map((qq, i) => {
        const given = answers[String(i)] ?? '';
        const correct = qq.kind === 'mcq' ? given === qq.answer : isAnswerCorrect(given, qq.accepted ?? [qq.answer]);
        return { index: i, prompt: qq.prompt, given, correct, correctAnswer: qq.answer, explanation: qq.explanation ?? null };
      });
      const score = results.filter((r) => r.correct).length;
      await c.query(`UPDATE quiz_attempts SET answers=$2, score=$3, status='submitted', submitted_at=now() WHERE id=$1`, [id, answers, score]);
      await recordActivity(req.userId, 'quiz', id, { score, total: results.length }, c);
      return { score, total: results.length, results };
    });
  });

  // ---------- Grammar ----------
  app.get('/grammar/lessons', async (req) => {
    const p = await one<any>('SELECT cefr_level FROM user_profiles WHERE user_id=$1', [req.userId]);
    const lvl = CEFR_LEVELS.indexOf(p?.cefr_level ?? 'B1');
    const rows = await q<any>(
      `SELECT l.id, l.slug, l.title, l.cefr, l.topic, l.summary, l.order_index,
              (SELECT count(*)::int FROM grammar_exercises e WHERE e.lesson_id=l.id) AS exercises,
              (SELECT max(score::float / NULLIF(total,0)) FROM grammar_attempts a WHERE a.lesson_id=l.id AND a.user_id=$1) AS best,
              (SELECT count(*)::int FROM grammar_attempts a WHERE a.lesson_id=l.id AND a.user_id=$1) AS attempts
       FROM grammar_lessons l WHERE l.status='published' ORDER BY array_position(ARRAY['A1','A2','B1','B2','C1','C2'], l.cefr), l.order_index`,
      [req.userId],
    );
    // Recommend lessons near the learner's level that they have not mastered (< 80%).
    const recommended = rows
      .filter((r) => (r.best ?? 0) < 0.8 && Math.abs(CEFR_LEVELS.indexOf(r.cefr) - lvl) <= 1)
      .slice(0, 3)
      .map((r) => r.slug);
    return rows.map((r) => ({ ...r, best: r.best === null ? null : Math.round(r.best * 100), recommended: recommended.includes(r.slug) }));
  });

  app.get('/grammar/lessons/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const l = await one<any>(`SELECT * FROM grammar_lessons WHERE slug=$1 AND status='published'`, [slug]);
    if (!l) throw notFound('Lesson not found.');
    const ex = await q<any>('SELECT id, kind, prompt, options FROM grammar_exercises WHERE lesson_id=$1 ORDER BY order_index', [l.id]);
    const history = await q('SELECT score, total, created_at FROM grammar_attempts WHERE lesson_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 5', [l.id, req.userId]);
    return {
      slug: l.slug, title: l.title, cefr: l.cefr, topic: l.topic, summary: l.summary, body: l.body, examples: l.examples,
      exercises: ex.map((e) => ({ ...e, options: e.options ? shuffle(e.options) : null })), history,
    };
  });

  app.post('/grammar/lessons/:slug/submit', async (req) => {
    const { slug } = req.params as { slug: string };
    const { answers } = parse(grammarAnswerSchema, req.body);
    const l = await one<any>(`SELECT * FROM grammar_lessons WHERE slug=$1`, [slug]);
    if (!l) throw notFound('Lesson not found.');
    const ex = await q<any>('SELECT * FROM grammar_exercises WHERE lesson_id=$1 ORDER BY order_index', [l.id]);
    const results = ex.map((e) => {
      const given = answers[e.id] ?? '';
      const correct = e.kind === 'mcq' ? given === e.answers[0] : isAnswerCorrect(given, e.answers);
      return { id: e.id, prompt: e.prompt, given, correct, correctAnswer: e.answers[0], explanation: e.explanation };
    });
    const score = results.filter((r) => r.correct).length;
    await q('INSERT INTO grammar_attempts (user_id, lesson_id, score, total, details) VALUES ($1,$2,$3,$4,$5)', [
      req.userId, l.id, score, results.length, JSON.stringify(results),
    ]);
    await recordActivity(req.userId, 'grammar', l.id, { score, total: results.length, slug });
    return { score, total: results.length, results };
  });
}
