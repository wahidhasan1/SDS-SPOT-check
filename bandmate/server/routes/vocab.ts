import fs from 'node:fs'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { CEFR_LEVELS, cefrIndex } from '../../shared/config.ts'
import { db, json } from '../db/index.ts'
import { requireUser } from '../lib/auth.ts'
import { readContent } from '../content/seed.ts'
import { HttpError, dayKey, newId, notFound, now, shuffle } from '../lib/util.ts'
import { recordActivity } from '../lib/events.ts'
import { explainInContext, ipa, lookup, type Pos } from '../services/dictionary.ts'
import { wordAudio } from '../services/tts.ts'
import { ttsReady } from '../services/features.ts'

// ------------------------------------------------------------------------------------------- seed
type VocabFile = { topics: Record<string, string>; words: string[] }
const POS_MAP: Record<string, Pos | undefined> = { noun: 'noun', verb: 'verb', adjective: 'adj', adverb: 'adv' }

export function seedVocab() {
  const v = readContent<VocabFile>('vocabulary.json')
  db().tx(() => {
    for (const line of v.words) {
      const [word, pos, level, topic, definition, example] = line.split('|')
      if (db().one('SELECT 1 FROM vocab_words WHERE word = ?', word)) continue
      const wn = lookup(word, POS_MAP[pos])
      const sense = wn?.senses[0]
      db().run(
        'INSERT INTO vocab_words (word, pos, ipa, level, tags, definition, examples, synonyms, antonyms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        word, pos, ipa(word), level, JSON.stringify([topic]), definition, JSON.stringify([example]), JSON.stringify(sense?.synonyms ?? []), JSON.stringify(sense?.antonyms ?? []),
      )
    }
  })
}
export const vocabTopics = () => readContent<VocabFile>('vocabulary.json').topics

type WordRow = { id: number; word: string; pos: string; ipa: string | null; level: string; tags: string; definition: string; examples: string; synonyms: string; antonyms: string }
const wordView = (w: WordRow) => ({ id: w.id, word: w.word, pos: w.pos, ipa: w.ipa, level: w.level, topic: json<string[]>(w.tags, [])[0], definition: w.definition, examples: json<string[]>(w.examples, []), synonyms: json<string[]>(w.synonyms, []), antonyms: json<string[]>(w.antonyms, []) })

// ------------------------------------------------------------------------------------------- spaced repetition
/** Leitner boxes. A correct review moves the word up one box; a miss sends it back to box 0. */
export const SRS_INTERVALS_H = [0.17, 24, 72, 168, 336, 720, 2160]
export function nextReview(box: number, knew: boolean, at = now()) {
  const nb = knew ? Math.min(box + 1, SRS_INTERVALS_H.length - 1) : 0
  return { box: nb, dueAt: at + SRS_INTERVALS_H[nb] * 3600_000 }
}

export function saveWord(userId: string, word: string, opts: { meaning?: string | null; context?: string | null; source: string }) {
  const w = word.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!/^[a-z][a-z' -]{0,59}$/.test(w)) throw new HttpError(400, 'bad_word', 'Please enter a single English word or short phrase.')
  let meaning = opts.meaning?.trim() || null
  if (!meaning) {
    const bank = db().one<{ definition: string }>('SELECT definition FROM vocab_words WHERE word = ?', w)
    meaning = bank?.definition ?? null
  }
  if (!meaning && opts.context) {
    const words = opts.context.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? []
    const i = words.findIndex((x) => x.toLowerCase() === w.split(' ')[0])
    if (i >= 0) meaning = explainInContext(opts.context, i)?.best?.definition ?? null
  }
  meaning ??= lookup(w)?.senses[0]?.definition ?? null
  if (!meaning) throw new HttpError(404, 'unknown_word', `We couldn't find “${w}” in the dictionary. Check the spelling.`)
  const count = db().one<{ n: number }>('SELECT COUNT(*) AS n FROM saved_words WHERE user_id = ?', userId)!.n
  if (count >= 5000) throw new HttpError(400, 'too_many', 'Your word list is full (5,000 words). Remove some words first.')
  db().run(
    `INSERT INTO saved_words (user_id, word, meaning, context, source, box, due_at, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT (user_id, word) DO UPDATE SET context = COALESCE(excluded.context, saved_words.context)`,
    userId, w, meaning, opts.context?.slice(0, 400) ?? null, opts.source, now(), now(),
  )
  return { word: w, meaning }
}

// ------------------------------------------------------------------------------------------- quiz generation
export type QuizItem = {
  type: 'meaning' | 'word' | 'synonym' | 'gap' | 'spelling'
  wordId: number
  word: string
  prompt: string
  options?: string[]
  answer: string // kept on the server
  explanation: string
  audio?: string
}

function pickWords(userId: string, n: number, opts: { topic?: string; level?: string }) {
  const me = db().one<{ cefr_level: string | null }>('SELECT cefr_level FROM profiles WHERE user_id = ?', userId)
  const li = cefrIndex(opts.level ?? me?.cefr_level ?? 'B1')
  const lo = CEFR_LEVELS[Math.max(0, li - 1)]
  const hi = CEFR_LEVELS[Math.min(5, li + 1)]
  const rows = db().all<WordRow & { seen: number | null; correct: number | null; last_seen_at: number | null }>(
    `SELECT w.*, p.seen, p.correct, p.last_seen_at FROM vocab_words w
     LEFT JOIN word_progress p ON p.word_id = w.id AND p.user_id = ?
     WHERE w.status = 'published' ${opts.topic ? "AND w.tags LIKE '%\"' || ? || '\"%'" : ''} AND w.level BETWEEN ? AND ?`,
    ...(opts.topic ? [userId, opts.topic, lo, hi] : [userId, lo, hi]),
  )
  // Priority: unseen words, then words often answered wrong, then words not seen recently.
  const scored = rows.map((r) => {
    const acc = r.seen ? (r.correct ?? 0) / r.seen : 0
    const recentPenalty = r.last_seen_at && now() - r.last_seen_at < 48 * 3600_000 ? 3 : 0
    return { r, score: (r.seen ? 0 : 4) + (1 - acc) * 3 - recentPenalty + Math.random() * 1.5 }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, n).map((s) => s.r)
}

function distractors(field: 'definition' | 'word', exclude: WordRow, n: number, sameTopic = true) {
  const topic = json<string[]>(exclude.tags, [])[0]
  let pool = db().all<{ v: string }>(`SELECT ${field} AS v FROM vocab_words WHERE id <> ? AND status = 'published' ${sameTopic ? "AND tags LIKE '%\"' || ? || '\"%'" : ''} ORDER BY random() LIMIT ?`, ...(sameTopic ? [exclude.id, topic, n * 3] : [exclude.id, n * 3])).map((r) => r.v)
  if (pool.length < n) pool = [...pool, ...db().all<{ v: string }>(`SELECT ${field} AS v FROM vocab_words WHERE id <> ? ORDER BY random() LIMIT ?`, exclude.id, n * 3).map((r) => r.v)]
  return shuffle([...new Set(pool)]).slice(0, n)
}

export function buildItem(w: WordRow, type?: QuizItem['type']): QuizItem {
  const v = wordView(w)
  const example = v.examples[0] ?? ''
  const canGap = !v.word.includes(' ') && !!example && new RegExp(`\\b${v.word}`, 'i').test(example)
  // Only learner-level synonyms (ones that are themselves in our word bank) make fair questions.
  const easySyn = v.synonyms.filter((x) => db().one('SELECT 1 FROM vocab_words WHERE word = ?', x.toLowerCase()))
  const types: QuizItem['type'][] = ['meaning', 'word', ...(easySyn.length ? (['synonym'] as const) : []), ...(canGap ? (['gap'] as const) : []), ...(v.word.length >= 5 && !v.word.includes(' ') && ttsReady() ? (['spelling'] as const) : [])]
  const t = type && types.includes(type) ? type : shuffle(types)[0]
  const why = `“${v.word}” (${v.pos}) means: ${v.definition}${example ? ` — e.g. “${example}”` : ''}`
  switch (t) {
    case 'meaning':
      return { type: t, wordId: w.id, word: v.word, prompt: `What does “${v.word}” mean?`, options: shuffle([v.definition, ...distractors('definition', w, 3)]), answer: v.definition, explanation: why }
    case 'word':
      return { type: t, wordId: w.id, word: v.word, prompt: `Which word means: “${v.definition}”?`, options: shuffle([v.word, ...distractors('word', w, 3)]), answer: v.word, explanation: why }
    case 'synonym': {
      const syn = easySyn[0]
      const opts = distractors('word', w, 3, false)
      return { type: t, wordId: w.id, word: v.word, prompt: `Which word is closest in meaning to “${v.word}”?`, options: shuffle([syn, ...opts]), answer: syn, explanation: `“${syn}” is a synonym of “${v.word}”. ${why}` }
    }
    case 'gap': {
      // All options are base forms, so an inflected answer ("increased") can't give itself away.
      const shown = example.match(new RegExp(`\\b${v.word}[a-z]*`, 'i'))![0]
      const gapped = example.replace(shown, '_____')
      return { type: t, wordId: w.id, word: v.word, prompt: `Which word completes the sentence? (It may need a different form.) ${gapped}`, options: shuffle([v.word, ...distractors('word', w, 3).filter((d) => !d.includes(' '))]).slice(0, 4), answer: v.word, explanation: `The answer is “${shown}”. ${why}` }
    }
    case 'spelling':
      return { type: t, wordId: w.id, word: v.word, prompt: 'Listen and type the word you hear.', answer: v.word, explanation: why, audio: `/api/vocab/audio/${encodeURIComponent(v.word)}` }
  }
}

const publicItem = (it: QuizItem, i: number) => ({ index: i, type: it.type, prompt: it.prompt, options: it.options ?? null, audio: it.audio ?? null })

export function recordWordResult(userId: string, wordId: number, correct: boolean) {
  db().run(
    `INSERT INTO word_progress (user_id, word_id, seen, correct, last_seen_at) VALUES (?, ?, 1, ?, ?)
     ON CONFLICT (user_id, word_id) DO UPDATE SET seen = seen + 1, correct = correct + excluded.correct, last_seen_at = excluded.last_seen_at`,
    userId, wordId, correct ? 1 : 0, now(),
  )
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

// ------------------------------------------------------------------------------------------- routes
export const vocabRoutes: FastifyPluginAsync = async (app) => {
  app.get('/topics', async (req) => {
    const user = requireUser(req)
    const topics = vocabTopics()
    const counts = db().all<{ topic: string; total: number; seen: number; mastered: number }>(
      `SELECT json_extract(w.tags, '$[0]') AS topic, COUNT(*) AS total, COUNT(p.word_id) AS seen,
         SUM(CASE WHEN p.correct >= 2 AND p.correct * 1.0 / p.seen >= 0.7 THEN 1 ELSE 0 END) AS mastered
       FROM vocab_words w LEFT JOIN word_progress p ON p.word_id = w.id AND p.user_id = ?
       WHERE w.status = 'published' GROUP BY topic`,
      user.id,
    )
    return Object.entries(topics).map(([id, label]) => ({ id, label, ...(counts.find((c) => c.topic === id) ?? { total: 0, seen: 0, mastered: 0 }) }))
  })

  app.get('/words', async (req) => {
    const user = requireUser(req)
    const q = z.object({ topic: z.string().max(40).optional(), level: z.enum(CEFR_LEVELS).optional(), q: z.string().max(60).optional() }).parse(req.query)
    const rows = db().all<WordRow & { saved: number | null; seen: number | null; correct: number | null }>(
      `SELECT w.*, s.box AS saved, p.seen, p.correct FROM vocab_words w
       LEFT JOIN saved_words s ON s.user_id = ?1 AND s.word = w.word
       LEFT JOIN word_progress p ON p.user_id = ?1 AND p.word_id = w.id
       WHERE w.status = 'published' AND (?2 IS NULL OR w.tags LIKE '%"' || ?2 || '"%') AND (?3 IS NULL OR w.level = ?3) AND (?4 IS NULL OR w.word LIKE ?4 || '%')
       ORDER BY w.level, w.word LIMIT 300`,
      user.id, q.topic ?? null, q.level ?? null, q.q ?? null,
    )
    return rows.map((r) => ({ ...wordView(r), saved: r.saved !== null, seen: r.seen ?? 0, correct: r.correct ?? 0 }))
  })

  /** Any English word: our learner entry if we have one, plus dictionary senses. */
  app.get('/lookup/:word', async (req) => {
    requireUser(req)
    const word = String((req.params as { word: string }).word).slice(0, 60)
    const bank = db().one<WordRow>('SELECT * FROM vocab_words WHERE word = ?', word.toLowerCase())
    const entry = lookup(word)
    if (!bank && !entry) throw notFound(`“${word}” is not in our dictionary.`)
    return { word: bank?.word ?? entry!.lemma, ipa: bank?.ipa ?? entry?.ipa ?? null, learner: bank ? wordView(bank) : null, senses: entry?.senses.slice(0, 8) ?? [] }
  })

  /** Pronunciation audio from the offline voice (cached). */
  app.get('/audio/:word', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    requireUser(req)
    if (!ttsReady()) throw new HttpError(503, 'not_configured', 'Pronunciation audio is not set up on this server.')
    const word = decodeURIComponent((req.params as { word: string }).word)
    const accent = (req.query as { accent?: string }).accent === 'us' ? 'us' : 'gb'
    if (!/^[a-zA-Z][a-zA-Z' -]{0,59}$/.test(word)) throw new HttpError(400, 'bad_word', 'Invalid word.')
    const file = await wordAudio(word, accent)
    reply.header('Cache-Control', 'private, max-age=604800').type('audio/mpeg')
    return reply.send(fs.createReadStream(file))
  })

  // ---------------------------------------------------------------- saved words + SRS
  app.get('/saved', async (req) => {
    const user = requireUser(req)
    const rows = db().all<{ word: string; meaning: string; context: string | null; source: string; box: number; due_at: number; correct: number; wrong: number; created_at: number }>(
      'SELECT word, meaning, context, source, box, due_at, correct, wrong, created_at FROM saved_words WHERE user_id = ? ORDER BY created_at DESC',
      user.id,
    )
    return { due: rows.filter((r) => r.due_at <= now()).length, items: rows.map((r) => ({ word: r.word, meaning: r.meaning, context: r.context, source: r.source, box: r.box, dueAt: r.due_at, correct: r.correct, wrong: r.wrong, createdAt: r.created_at, ipa: ipa(r.word) })) }
  })

  app.post('/saved', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req) => {
    const user = requireUser(req)
    const body = z.object({ word: z.string().min(1).max(60), meaning: z.string().max(400).nullable().optional(), context: z.string().max(400).nullable().optional(), source: z.enum(['manual', 'call', 'reading', 'quiz', 'writing', 'speaking', 'battle', 'lesson']).default('manual') }).parse(req.body)
    return saveWord(user.id, body.word, { meaning: body.meaning, context: body.context, source: body.source })
  })

  app.delete('/saved/:word', async (req) => {
    const user = requireUser(req)
    db().run('DELETE FROM saved_words WHERE user_id = ? AND word = ?', user.id, decodeURIComponent((req.params as { word: string }).word).toLowerCase())
    return { ok: true }
  })

  /** Words due for review, as flashcards with multiple-choice meanings. */
  app.get('/review', async (req) => {
    const user = requireUser(req)
    const due = db().all<{ word: string; meaning: string; context: string | null; box: number }>('SELECT word, meaning, context, box FROM saved_words WHERE user_id = ? AND due_at <= ? ORDER BY due_at LIMIT 20', user.id, now())
    const others = db().all<{ meaning: string }>('SELECT meaning FROM saved_words WHERE user_id = ? UNION SELECT definition AS meaning FROM vocab_words', user.id).map((r) => r.meaning)
    return due.map((d) => ({ word: d.word, context: d.context, box: d.box, ipa: ipa(d.word), options: shuffle([d.meaning, ...shuffle(others.filter((m) => m !== d.meaning)).slice(0, 3)]), meaning: d.meaning }))
  })

  app.post('/review', async (req) => {
    const user = requireUser(req)
    const body = z.object({ word: z.string().min(1).max(60), knew: z.boolean() }).parse(req.body)
    const row = db().one<{ box: number; due_at: number }>('SELECT box, due_at FROM saved_words WHERE user_id = ? AND word = ?', user.id, body.word.toLowerCase())
    if (!row) throw notFound('This word is not in your list.')
    if (row.due_at > now() + 60_000) throw new HttpError(409, 'not_due', 'This word is not due for review yet.')
    const n = nextReview(row.box, body.knew)
    db().run(`UPDATE saved_words SET box = ?, due_at = ?, last_reviewed_at = ?, ${body.knew ? 'correct = correct + 1' : 'wrong = wrong + 1'} WHERE user_id = ? AND word = ?`, n.box, n.dueAt, now(), user.id, body.word.toLowerCase())
    recordActivity(user.id)
    return { box: n.box, dueAt: n.dueAt }
  })

  // ---------------------------------------------------------------- quizzes
  app.post('/quiz', async (req) => {
    const user = requireUser(req)
    const body = z.object({ kind: z.enum(['daily', 'vocab']), topic: z.string().max(40).optional(), level: z.enum(CEFR_LEVELS).optional() }).parse(req.body)
    const off = db().one<{ o: number }>('SELECT timezone_offset AS o FROM profiles WHERE user_id = ?', user.id)?.o ?? 0
    const today = dayKey(off)
    if (body.kind === 'daily') {
      const existing = db().one<{ id: string; items: string; answers: string; finished_at: number | null }>("SELECT id, items, answers, finished_at FROM quiz_sessions WHERE user_id = ? AND kind = 'daily' AND day = ?", user.id, today)
      if (existing) {
        const items = json<QuizItem[]>(existing.items, [])
        return { id: existing.id, kind: 'daily', items: items.map(publicItem), answered: json<Record<string, unknown>>(existing.answers, {}), finished: !!existing.finished_at }
      }
    }
    const words = pickWords(user.id, 10, { topic: body.topic, level: body.level })
    if (words.length < 4) throw new HttpError(404, 'no_words', 'There aren’t enough words for this topic at your level yet.')
    const items = words.map((w) => buildItem(w))
    const id = newId('qz_')
    db().run('INSERT INTO quiz_sessions (id, user_id, kind, ref, day, items, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', id, user.id, body.kind, body.topic ?? null, body.kind === 'daily' ? today : null, JSON.stringify(items), items.length, now())
    return { id, kind: body.kind, items: items.map(publicItem), answered: {}, finished: false }
  })

  /** Answers one quiz question. Each question can be answered once; the server decides if it's right. */
  app.post('/quiz/:id/answer', async (req) => {
    const user = requireUser(req)
    const id = (req.params as { id: string }).id
    const body = z.object({ index: z.number().int().min(0).max(50), answer: z.string().max(400) }).parse(req.body)
    return db().tx(() => {
      const row = db().one<{ items: string; answers: string; finished_at: number | null }>('SELECT items, answers, finished_at FROM quiz_sessions WHERE id = ? AND user_id = ?', id, user.id)
      if (!row) throw notFound('Quiz not found.')
      const items = json<QuizItem[]>(row.items, [])
      const answers = json<Record<string, { answer: string; correct: boolean }>>(row.answers, {})
      const it = items[body.index]
      if (!it) throw new HttpError(400, 'bad_index', 'No such question.')
      if (answers[body.index]) throw new HttpError(409, 'already_answered', 'You already answered this question.')
      const correct = norm(body.answer) === norm(it.answer)
      answers[body.index] = { answer: body.answer, correct }
      const score = Object.values(answers).filter((a) => a.correct).length
      const done = Object.keys(answers).length === items.length
      db().run('UPDATE quiz_sessions SET answers = ?, score = ?, finished_at = ? WHERE id = ?', JSON.stringify(answers), score, done ? now() : null, id)
      recordWordResult(user.id, it.wordId, correct)
      if (done) recordActivity(user.id)
      return { correct, answer: it.answer, explanation: it.explanation, word: it.word, score, done, total: items.length }
    })
  })

  app.get('/history', async (req) => {
    const user = requireUser(req)
    return db().all("SELECT id, kind, ref, score, total, created_at AS createdAt, finished_at AS finishedAt FROM quiz_sessions WHERE user_id = ? AND kind IN ('daily','vocab') AND finished_at IS NOT NULL ORDER BY created_at DESC LIMIT 30", user.id)
  })
}
