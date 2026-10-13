import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../db/index.ts'
import { requireUser } from '../lib/auth.ts'
import { consume, refund } from '../lib/plans.ts'
import { recordActivity } from '../lib/events.ts'
import { HttpError, newId, notConfigured, notFound, now } from '../lib/util.ts'
import { ocr } from '../services/ocr.ts'
import { explainInContext, sentenceAt } from '../services/dictionary.ts'
import { llmConfigured, llmJson } from '../services/llm.ts'

type SessionRow = { id: string; user_id: string; title: string; text: string; confidence: number | null; source: string; created_at: number; updated_at: number }
const view = (r: SessionRow) => ({ id: r.id, title: r.title, text: r.text, confidence: r.confidence, source: r.source, createdAt: r.created_at, updatedAt: r.updated_at })

const titleFrom = (text: string) => {
  const first = text.split(/\n|(?<=[.!?])\s/)[0]?.trim() ?? ''
  return (first.length > 60 ? `${first.slice(0, 57)}…` : first) || 'Untitled text'
}

function getSession(userId: string, id: string) {
  const r = db().one<SessionRow>('SELECT * FROM reading_sessions WHERE id = ? AND user_id = ?', id, userId)
  if (!r) throw notFound('Text not found.')
  return r
}

const Translation = z.object({ translation: z.string(), note: z.string().nullable() })

export const readRoutes: FastifyPluginAsync = async (app) => {
  /** Photo → text. The image is processed in memory and discarded; only the recognised text is saved. */
  app.post('/ocr', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req) => {
    const user = requireUser(req)
    const file = await req.file()
    if (!file) throw new HttpError(400, 'no_image', 'No image was received.')
    if (!/^image\/(jpeg|png|webp|heic|heif|gif|bmp|tiff)$/.test(file.mimetype)) throw new HttpError(400, 'bad_image', 'Please upload a photo (JPEG, PNG or WebP).')
    const fields = Object.fromEntries(Object.entries(file.fields).map(([k, v]) => [k, (v as { value?: string }).value])) as Record<string, string | undefined>
    const meta = z
      .object({
        rotate: z.coerce.number().int().refine((n) => [0, 90, 180, 270].includes(n)).default(0),
        crop: z
          .string()
          .optional()
          .transform((s) => (s ? (JSON.parse(s) as unknown) : undefined))
          .pipe(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0.02).max(1), h: z.number().min(0.02).max(1) }).optional()),
      })
      .parse(fields)
    const buf = await file.toBuffer()
    consume(user.id, 'ocrPagesPerDay', 'photo scans')
    try {
      const r = await ocr(buf, { rotate: meta.rotate, crop: meta.crop })
      if (r.text.replace(/\W/g, '').length < 3) throw new HttpError(422, 'no_text', 'We couldn’t find any text in this photo. Try better light, hold the camera straight, or crop closer to the text.')
      const id = newId('rd_')
      db().run("INSERT INTO reading_sessions (id, user_id, title, text, confidence, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'photo', ?, ?)", id, user.id, titleFrom(r.text), r.text.slice(0, 20_000), r.confidence, now(), now())
      recordActivity(user.id)
      return { ...view(getSession(user.id, id)), quality: { confidence: r.confidence, words: r.words, lowConfidenceWords: r.lowConfidenceWords } }
    } catch (e) {
      refund(user.id, 'ocrPagesPerDay')
      if (e instanceof HttpError) throw e
      req.log.warn({ err: (e as Error).message }, 'ocr failed')
      throw new HttpError(422, 'unreadable_image', 'This image couldn’t be read. Please try a different photo.')
    }
  })

  /** Pasted text (no OCR). */
  app.post('/text', async (req) => {
    const user = requireUser(req)
    const body = z.object({ text: z.string().trim().min(3).max(20_000), title: z.string().trim().max(120).optional() }).parse(req.body)
    const id = newId('rd_')
    db().run("INSERT INTO reading_sessions (id, user_id, title, text, source, created_at, updated_at) VALUES (?, ?, ?, ?, 'text', ?, ?)", id, user.id, body.title || titleFrom(body.text), body.text, now(), now())
    return view(getSession(user.id, id))
  })

  app.get('/sessions', async (req) => {
    const user = requireUser(req)
    return db().all<SessionRow>('SELECT * FROM reading_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50', user.id).map((r) => ({ ...view(r), text: r.text.slice(0, 160) }))
  })

  app.get('/sessions/:id', async (req) => {
    const user = requireUser(req)
    const r = getSession(user.id, (req.params as { id: string }).id)
    const lookups = db().all<{ word: string }>('SELECT DISTINCT word FROM word_lookups WHERE reading_session_id = ? ORDER BY id DESC LIMIT 50', r.id).map((x) => x.word)
    return { ...view(r), lookups }
  })

  /** Learners can correct OCR mistakes. */
  app.patch('/sessions/:id', async (req) => {
    const user = requireUser(req)
    const r = getSession(user.id, (req.params as { id: string }).id)
    const body = z.object({ text: z.string().trim().min(1).max(20_000).optional(), title: z.string().trim().min(1).max(120).optional() }).parse(req.body)
    db().run('UPDATE reading_sessions SET text = COALESCE(?, text), title = COALESCE(?, title), updated_at = ? WHERE id = ?', body.text ?? null, body.title ?? null, now(), r.id)
    return view(getSession(user.id, r.id))
  })

  app.delete('/sessions/:id', async (req) => {
    const user = requireUser(req)
    const r = getSession(user.id, (req.params as { id: string }).id)
    db().run('DELETE FROM reading_sessions WHERE id = ?', r.id)
    return { ok: true }
  })

  /** Meaning of the tapped word in its sentence (offline dictionary + phrase/idiom detection). */
  app.post('/explain', { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } }, async (req) => {
    const user = requireUser(req)
    const body = z.object({ sessionId: z.string().optional(), text: z.string().max(20_000), offset: z.number().int().min(0) }).parse(req.body)
    const { sentence, start } = sentenceAt(body.text, body.offset)
    // Index of the tapped word inside the (trimmed) sentence.
    const lead = body.text.slice(start).length - body.text.slice(start).trimStart().length
    const rel = body.offset - (start + lead)
    let idx = -1
    let n = 0
    for (const m of sentence.matchAll(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)) {
      if (rel >= m.index && rel < m.index + m[0].length) {
        idx = n
        break
      }
      n++
    }
    if (idx < 0) throw new HttpError(400, 'no_word', 'Tap on a word.')
    const r = explainInContext(sentence, idx)
    if (!r) throw new HttpError(400, 'no_word', 'Tap on a word.')
    if (body.sessionId && db().one('SELECT 1 FROM reading_sessions WHERE id = ? AND user_id = ?', body.sessionId, user.id))
      db().run('INSERT INTO word_lookups (user_id, reading_session_id, word, sentence, created_at) VALUES (?, ?, ?, ?, ?)', user.id, body.sessionId, r.lemma, sentence.slice(0, 500), now())
    return { ...r, sentence }
  })

  /** Optional translation into the learner's language (AI provider; metered). */
  app.post('/translate', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const user = requireUser(req)
    const body = z.object({ text: z.string().trim().min(1).max(2000), target: z.string().trim().min(2).max(40).optional(), context: z.string().max(1000).optional() }).parse(req.body)
    if (!llmConfigured()) throw notConfigured('Translation', 'Set ANTHROPIC_API_KEY to enable AI translation.')
    const target = body.target || db().one<{ l: string | null }>('SELECT native_language AS l FROM profiles WHERE user_id = ?', user.id)?.l
    if (!target) throw new HttpError(400, 'no_language', 'Choose the language to translate into (Profile → Goals → Native language).')
    consume(user.id, 'translationsPerDay', 'translations')
    try {
      const r = await llmJson({
        system: 'You translate English text for language learners. Translate faithfully and naturally. If the text is a single word or phrase, translate its meaning in the given context and add a short note on usage. Never add content that is not in the text.',
        prompt: `Translate into ${target}.\n${body.context ? `Context sentence: """${body.context}"""\n` : ''}Text: """${body.text}"""`,
        schema: Translation,
        maxTokens: 2000,
        effort: 'low',
      })
      return { ...r, target, provider: 'ai' }
    } catch (e) {
      refund(user.id, 'translationsPerDay')
      throw e
    }
  })
}
