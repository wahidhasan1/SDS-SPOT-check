import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { and, asc, desc, eq, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CEFR_LEVELS, cefrIndex, sm2, wordStatus, WORD_STATUS_RULES } from '@fluentpath/shared';
import { db, schema } from '../db';
import { badRequest, conflict, notFound } from '../lib/errors';
import { parse, uuidParam } from '../lib/validate';
import { requireUser } from '../plugins/auth';
import { logActivity } from '../services/activity';
import { localDay } from '../lib/time';

const saveSchema = z.union([
  z.object({ wordId: z.string().uuid(), source: z.enum(['daily', 'lesson', 'reading', 'reader', 'listening', 'manual', 'browse']).default('browse'), context: z.string().max(500).optional() }),
  z.object({
    word: z.string().trim().min(1).max(60),
    definition: z.string().trim().min(1).max(500),
    context: z.string().trim().max(500).optional(),
    translation: z.string().trim().max(300).optional(),
    source: z.enum(['daily', 'lesson', 'reading', 'reader', 'listening', 'manual', 'browse']).default('manual'),
  }),
]);

function shuffle<T>(arr: T[], seed?: string): T[] {
  const a = [...arr];
  let h = seed ? parseInt(createHash('sha1').update(seed).digest('hex').slice(0, 8), 16) : 0;
  const rnd = () => {
    if (!seed) return Math.random();
    h = (h * 1664525 + 1013904223) % 4294967296;
    return h / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function vocabRoutes(app: FastifyInstance) {
  app.get('/api/vocab/categories', async (req) => {
    const u = requireUser(req);
    const cats = await db.select().from(schema.categories).where(eq(schema.categories.kind, 'vocabulary')).orderBy(asc(schema.categories.sortOrder));
    const counts = await db
      .select({
        slug: schema.words.categorySlug,
        total: sql<number>`count(*)::int`,
        saved: sql<number>`count(uw.id)::int`,
      })
      .from(schema.words)
      .leftJoin(sql`user_words uw`, sql`uw.word_id = ${schema.words.id} and uw.user_id = ${u.id}`)
      .where(eq(schema.words.status, 'published'))
      .groupBy(schema.words.categorySlug);
    const map = new Map(counts.map((c) => [c.slug, c]));
    return { categories: cats.map((c) => ({ ...c, total: map.get(c.slug)?.total ?? 0, saved: map.get(c.slug)?.saved ?? 0 })) };
  });

  app.get('/api/vocab/words', async (req) => {
    const u = requireUser(req);
    const q = parse(
      z.object({
        category: z.string().max(60).optional(),
        level: z.enum(CEFR_LEVELS).optional(),
        q: z.string().trim().max(60).optional(),
        page: z.coerce.number().int().min(1).max(1000).default(1),
      }),
      req.query,
    );
    const pageSize = 30;
    const where = and(
      eq(schema.words.status, 'published'),
      q.category ? eq(schema.words.categorySlug, q.category) : undefined,
      q.level ? eq(schema.words.cefrLevel, q.level) : undefined,
      q.q ? or(ilike(schema.words.word, `%${q.q}%`), ilike(schema.words.definition, `%${q.q}%`)) : undefined,
    );
    const rows = await db
      .select({
        id: schema.words.id,
        word: schema.words.word,
        partOfSpeech: schema.words.partOfSpeech,
        phonetic: schema.words.phonetic,
        definition: schema.words.definition,
        example: schema.words.example,
        synonyms: schema.words.synonyms,
        antonyms: schema.words.antonyms,
        cefrLevel: schema.words.cefrLevel,
        categorySlug: schema.words.categorySlug,
        audioUrl: schema.words.audioUrl,
        savedId: schema.userWords.id,
        savedStatus: schema.userWords.status,
      })
      .from(schema.words)
      .leftJoin(schema.userWords, and(eq(schema.userWords.wordId, schema.words.id), eq(schema.userWords.userId, u.id)))
      .where(where)
      .orderBy(asc(schema.words.word))
      .limit(pageSize + 1)
      .offset((q.page - 1) * pageSize);
    return { words: rows.slice(0, pageSize), hasMore: rows.length > pageSize, page: q.page };
  });

  /** Five words for today, chosen deterministically from the learner's level and the next level up. */
  app.get('/api/vocab/daily', async (req) => {
    const u = requireUser(req);
    const [p] = await db.select({ level: schema.profiles.cefrLevel, tz: schema.profiles.timezone }).from(schema.profiles).where(eq(schema.profiles.userId, u.id));
    const idx = Math.max(0, cefrIndex(p?.level ?? 'B1'));
    const levels = [CEFR_LEVELS[idx], CEFR_LEVELS[Math.min(idx + 1, 5)]];
    const day = localDay(p?.tz ?? 'UTC');
    const pool = await db
      .select({ id: schema.words.id })
      .from(schema.words)
      .where(and(eq(schema.words.status, 'published'), inArray(schema.words.cefrLevel, levels)))
      .orderBy(asc(schema.words.word));
    const picked = shuffle(pool, `${u.id}:${day}`).slice(0, 5).map((w) => w.id);
    if (!picked.length) return { day, words: [] };
    const words = await db
      .select({
        id: schema.words.id,
        word: schema.words.word,
        partOfSpeech: schema.words.partOfSpeech,
        phonetic: schema.words.phonetic,
        definition: schema.words.definition,
        example: schema.words.example,
        synonyms: schema.words.synonyms,
        antonyms: schema.words.antonyms,
        cefrLevel: schema.words.cefrLevel,
        categorySlug: schema.words.categorySlug,
        audioUrl: schema.words.audioUrl,
        savedId: schema.userWords.id,
      })
      .from(schema.words)
      .leftJoin(schema.userWords, and(eq(schema.userWords.wordId, schema.words.id), eq(schema.userWords.userId, u.id)))
      .where(inArray(schema.words.id, picked));
    return { day, levels, words: picked.map((id) => words.find((w) => w.id === id)!).filter(Boolean) };
  });

  app.get('/api/vocab/my', async (req) => {
    const u = requireUser(req);
    const q = parse(z.object({ status: z.enum(['learning', 'reviewing', 'mastered']).optional(), q: z.string().trim().max(60).optional() }), req.query);
    const rows = await db
      .select({
        id: schema.userWords.id,
        wordId: schema.userWords.wordId,
        word: schema.userWords.word,
        definition: schema.userWords.definition,
        context: schema.userWords.context,
        translation: schema.userWords.translation,
        source: schema.userWords.source,
        status: schema.userWords.status,
        dueAt: schema.userWords.dueAt,
        intervalDays: schema.userWords.intervalDays,
        repetitions: schema.userWords.repetitions,
        correctCount: schema.userWords.correctCount,
        wrongCount: schema.userWords.wrongCount,
        createdAt: schema.userWords.createdAt,
        phonetic: schema.words.phonetic,
        audioUrl: schema.words.audioUrl,
        partOfSpeech: schema.words.partOfSpeech,
        example: schema.words.example,
      })
      .from(schema.userWords)
      .leftJoin(schema.words, eq(schema.words.id, schema.userWords.wordId))
      .where(
        and(
          eq(schema.userWords.userId, u.id),
          q.status ? eq(schema.userWords.status, q.status) : undefined,
          q.q ? ilike(schema.userWords.word, `%${q.q}%`) : undefined,
        ),
      )
      .orderBy(desc(schema.userWords.createdAt));
    const stats = await vocabStats(u.id);
    return { words: rows, stats, rules: WORD_STATUS_RULES };
  });

  app.post('/api/vocab/my', async (req, reply) => {
    const u = requireUser(req);
    const body = parse(saveSchema, req.body);
    let values: typeof schema.userWords.$inferInsert;
    if ('wordId' in body) {
      const [w] = await db.select().from(schema.words).where(and(eq(schema.words.id, body.wordId), eq(schema.words.status, 'published')));
      if (!w) throw notFound('Word not found.');
      values = { userId: u.id, wordId: w.id, word: w.word, definition: w.definition, context: body.context ?? w.example, source: body.source };
    } else {
      // Link to the dictionary entry when we have one.
      const [w] = await db.select({ id: schema.words.id }).from(schema.words).where(sql`lower(${schema.words.word}) = ${body.word.toLowerCase()}`).limit(1);
      values = { userId: u.id, wordId: w?.id ?? null, word: body.word, definition: body.definition, context: body.context ?? null, translation: body.translation ?? null, source: body.source };
    }
    const inserted = await db.insert(schema.userWords).values(values).onConflictDoNothing().returning();
    if (!inserted.length) throw conflict(`"${values.word}" is already in your vocabulary list.`);
    await logActivity(u.id, { type: 'word_saved', title: `Saved word: ${values.word}`, refId: inserted[0].id, xp: 2, minutes: 0.5 });
    reply.code(201);
    return { word: inserted[0] };
  });

  app.patch('/api/vocab/my/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ definition: z.string().trim().min(1).max(500).optional(), context: z.string().trim().max(500).nullable().optional(), translation: z.string().trim().max(300).nullable().optional() }), req.body);
    const res = await db.update(schema.userWords).set(body).where(and(eq(schema.userWords.id, id), eq(schema.userWords.userId, u.id))).returning();
    if (!res.length) throw notFound('Word not found in your list.');
    return { word: res[0] };
  });

  app.delete('/api/vocab/my/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const res = await db.delete(schema.userWords).where(and(eq(schema.userWords.id, id), eq(schema.userWords.userId, u.id))).returning({ id: schema.userWords.id });
    if (!res.length) throw notFound('Word not found in your list.');
    return { ok: true };
  });

  // ---------------------------------------------------------------- spaced repetition

  app.get('/api/vocab/review', async (req) => {
    const u = requireUser(req);
    const q = parse(z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }), req.query);
    const cards = await db
      .select({
        id: schema.userWords.id,
        word: schema.userWords.word,
        definition: schema.userWords.definition,
        context: schema.userWords.context,
        translation: schema.userWords.translation,
        status: schema.userWords.status,
        repetitions: schema.userWords.repetitions,
        intervalDays: schema.userWords.intervalDays,
        phonetic: schema.words.phonetic,
        audioUrl: schema.words.audioUrl,
        partOfSpeech: schema.words.partOfSpeech,
      })
      .from(schema.userWords)
      .leftJoin(schema.words, eq(schema.words.id, schema.userWords.wordId))
      .where(and(eq(schema.userWords.userId, u.id), lte(schema.userWords.dueAt, new Date())))
      .orderBy(asc(schema.userWords.dueAt))
      .limit(q.limit);
    const [{ n: totalDue }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.userWords)
      .where(and(eq(schema.userWords.userId, u.id), lte(schema.userWords.dueAt, new Date())));
    const [next] = await db
      .select({ dueAt: schema.userWords.dueAt })
      .from(schema.userWords)
      .where(eq(schema.userWords.userId, u.id))
      .orderBy(asc(schema.userWords.dueAt))
      .limit(1);
    return { cards, totalDue, nextDueAt: next?.dueAt ?? null };
  });

  app.post('/api/vocab/review/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ quality: z.number().int().min(0).max(5) }), req.body);
    const [card] = await db.select().from(schema.userWords).where(and(eq(schema.userWords.id, id), eq(schema.userWords.userId, u.id)));
    if (!card) throw notFound('Card not found.');
    const next = sm2({ ease: card.ease, intervalDays: card.intervalDays, repetitions: card.repetitions }, body.quality);
    const status = wordStatus(next.repetitions, next.intervalDays);
    const dueAt = new Date(Date.now() + next.intervalDays * 86400_000);
    const correct = body.quality >= 3;
    const [updated] = await db
      .update(schema.userWords)
      .set({
        ...next,
        status,
        dueAt,
        lastReviewedAt: new Date(),
        correctCount: correct ? card.correctCount + 1 : card.correctCount,
        wrongCount: correct ? card.wrongCount : card.wrongCount + 1,
      })
      .where(eq(schema.userWords.id, id))
      .returning();
    return { card: updated, promoted: status !== card.status ? status : null };
  });

  /** Called by the client when a review session ends, to log study time once per session. */
  app.post('/api/vocab/review-session', async (req) => {
    const u = requireUser(req);
    const body = parse(z.object({ reviewed: z.number().int().min(1).max(200), correct: z.number().int().min(0).max(200), durationSec: z.number().int().min(0).max(7200) }), req.body);
    const r = await logActivity(u.id, {
      type: 'vocab_review',
      title: `Reviewed ${body.reviewed} flashcard${body.reviewed === 1 ? '' : 's'} (${body.correct} recalled)`,
      xp: body.reviewed + body.correct,
      minutes: body.durationSec / 60,
    });
    return { ok: true, newAchievements: r.newAchievements };
  });

  // ---------------------------------------------------------------- quizzes

  app.post('/api/vocab/quiz/start', async (req) => {
    const u = requireUser(req);
    const body = parse(
      z.object({ source: z.enum(['my', 'category', 'level']), category: z.string().max(60).optional(), level: z.enum(CEFR_LEVELS).optional(), size: z.number().int().min(4).max(20).default(10) }),
      req.body,
    );
    type Item = { word: string; definition: string; wordId: string | null; userWordId: string | null; category: string | null };
    let items: Item[] = [];
    if (body.source === 'my') {
      const rows = await db.select().from(schema.userWords).where(eq(schema.userWords.userId, u.id));
      items = rows.map((r) => ({ word: r.word, definition: r.definition, wordId: r.wordId, userWordId: r.id, category: null }));
      if (items.length < 4) throw badRequest('Save at least 4 words to your list to take a quiz on them.');
    } else {
      const rows = await db
        .select()
        .from(schema.words)
        .where(
          and(
            eq(schema.words.status, 'published'),
            body.source === 'category' && body.category ? eq(schema.words.categorySlug, body.category) : undefined,
            body.source === 'level' && body.level ? eq(schema.words.cefrLevel, body.level) : undefined,
          ),
        );
      items = rows.map((r) => ({ word: r.word, definition: r.definition, wordId: r.id, userWordId: null, category: r.categorySlug }));
      if (items.length < 4) throw badRequest('Not enough words in this selection for a quiz.');
    }
    const distractorPool = items.length >= 8 ? items : [...items, ...(await db.select().from(schema.words).where(eq(schema.words.status, 'published')).limit(60)).map((r) => ({ word: r.word, definition: r.definition, wordId: r.id, userWordId: null, category: r.categorySlug }))];
    const chosen = shuffle(items).slice(0, Math.min(body.size, items.length));
    const questions = chosen.map((it, i) => {
      const reverse = i % 2 === 1; // alternate: definition -> word, word -> definition
      const others = shuffle(distractorPool.filter((d) => d.word.toLowerCase() !== it.word.toLowerCase())).slice(0, 3);
      const options = shuffle([it, ...others]).map((o) => (reverse ? o.definition : o.word));
      return {
        index: i,
        prompt: reverse ? `What does “${it.word}” mean?` : `Which word matches this definition? “${it.definition}”`,
        options,
        answer: reverse ? it.definition : it.word,
        userWordId: it.userWordId,
        word: it.word,
      };
    });
    const [attempt] = await db
      .insert(schema.attempts)
      .values({ userId: u.id, kind: 'vocab_quiz', title: body.source === 'my' ? 'Vocabulary quiz: my words' : `Vocabulary quiz: ${body.category ?? body.level ?? 'all words'}`, results: { key: questions } })
      .returning({ id: schema.attempts.id });
    return { attemptId: attempt.id, questions: questions.map(({ index, prompt, options }) => ({ index, prompt, options })) };
  });

  app.post('/api/vocab/quiz/:id/submit', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ answers: z.record(z.string(), z.string().max(600)), durationSec: z.number().int().min(0).max(7200).optional() }), req.body);
    const [a] = await db.select().from(schema.attempts).where(and(eq(schema.attempts.id, id), eq(schema.attempts.userId, u.id), eq(schema.attempts.kind, 'vocab_quiz')));
    if (!a) throw notFound('Quiz not found.');
    if (a.status === 'completed') throw badRequest('This quiz has already been submitted.');
    const key = (a.results as { key: { index: number; prompt: string; answer: string; userWordId: string | null; word: string }[] }).key;
    const results = key.map((k) => {
      const given = body.answers[String(k.index)] ?? null;
      return { index: k.index, prompt: k.prompt, word: k.word, given, correctAnswer: k.answer, correct: given === k.answer };
    });
    const score = results.filter((r) => r.correct).length;
    for (const k of key) {
      if (!k.userWordId) continue;
      const ok = results[k.index].correct;
      await db
        .update(schema.userWords)
        .set(ok ? { correctCount: sql`${schema.userWords.correctCount} + 1` } : { wrongCount: sql`${schema.userWords.wrongCount} + 1` })
        .where(and(eq(schema.userWords.id, k.userWordId), eq(schema.userWords.userId, u.id)));
    }
    await db
      .update(schema.attempts)
      .set({ status: 'completed', answers: body.answers, results: { key, results }, score, maxScore: key.length, durationSec: body.durationSec ?? null, completedAt: new Date() })
      .where(eq(schema.attempts.id, id));
    const r = await logActivity(u.id, { type: 'vocab_quiz', title: `${a.title} (${score}/${key.length})`, refId: id, xp: 5 + score * 2, minutes: body.durationSec ? body.durationSec / 60 : 3 });
    return { score, maxScore: key.length, results, newAchievements: r.newAchievements };
  });

  app.get('/api/vocab/stats', async (req) => {
    const u = requireUser(req);
    return { stats: await vocabStats(u.id) };
  });

}

export async function vocabStats(userId: string) {
  const rows = await db
    .select({ status: schema.userWords.status, n: sql<number>`count(*)::int` })
    .from(schema.userWords)
    .where(eq(schema.userWords.userId, userId))
    .groupBy(schema.userWords.status);
  const s = { learning: 0, reviewing: 0, mastered: 0, total: 0, due: 0 };
  for (const r of rows) {
    if (r.status === 'learning' || r.status === 'reviewing' || r.status === 'mastered') s[r.status] = r.n;
    s.total += r.n;
  }
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.userWords)
    .where(and(eq(schema.userWords.userId, userId), lte(schema.userWords.dueAt, new Date())));
  s.due = n;
  return s;
}
