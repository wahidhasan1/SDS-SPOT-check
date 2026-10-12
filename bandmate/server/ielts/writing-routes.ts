import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db, json } from '../db/index.ts'
import { requireUser } from '../lib/auth.ts'
import { consume, hasFlag, refund } from '../lib/plans.ts'
import { readContent, upsertSeed } from '../content/seed.ts'
import { HttpError, newId, notFound, now, wordsOf } from '../lib/util.ts'
import { recordActivity } from '../lib/events.ts'
import { analyseWriting, type Prompt } from '../services/writing-checks.ts'
import { llmJson } from '../services/llm.ts'

type WritingPrompt = Prompt & { title: string; prompt: string; chart?: unknown; structure: string[]; minutes: number }

export function seedWriting() {
  const w = readContent<{ prompts: WritingPrompt[] }>('writing.json')
  upsertSeed(w.prompts.map((p, i) => ({ id: p.id, kind: 'writing' as const, test_type: p.testType as 'academic' | 'general_training' | 'both', title: p.title, sort: i, premium: i >= 10, data: p })))
}

export function loadPrompt(id: string) {
  const row = db().one<{ id: string; data: string; premium: number }>("SELECT id, data, premium FROM content_items WHERE id = ? AND kind = 'writing' AND status = 'published'", id)
  if (!row) throw notFound('Writing task not found.')
  return { ...(JSON.parse(row.data) as WritingPrompt), id: row.id, premium: !!row.premium }
}

type SubRow = { id: string; user_id: string; prompt_id: string; text: string; word_count: number; status: string; checks: string | null; ai_feedback: string | null; ai_status: string | null; time_spent_s: number; created_at: number; updated_at: number; submitted_at: number | null; mock_attempt_id: string | null }

const subView = (s: SubRow) => ({
  id: s.id,
  promptId: s.prompt_id,
  prompt: loadPrompt(s.prompt_id),
  text: s.text,
  wordCount: s.word_count,
  status: s.status,
  checks: json(s.checks, null),
  aiFeedback: json(s.ai_feedback, null),
  aiStatus: s.ai_status,
  timeSpentS: s.time_spent_s,
  createdAt: s.created_at,
  updatedAt: s.updated_at,
  submittedAt: s.submitted_at,
  mockAttemptId: s.mock_attempt_id,
})

function getSub(userId: string, id: string) {
  const s = db().one<SubRow>('SELECT * FROM writing_submissions WHERE id = ? AND user_id = ?', id, userId)
  if (!s) throw notFound('Essay not found.')
  return s
}

// ------------------------------------------------------------------------------------------- AI feedback schema
const Criterion = z.object({
  name: z.enum(['Task achievement / response', 'Coherence and cohesion', 'Lexical resource', 'Grammatical range and accuracy']),
  band: z.number(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
})
export const AiFeedback = z.object({
  overall_band_estimate: z.number(),
  summary: z.string(),
  criteria: z.array(Criterion),
  corrections: z.array(z.object({ original: z.string(), corrected: z.string(), explanation: z.string() })),
  improved_examples: z.array(z.object({ original: z.string(), improved: z.string(), why: z.string() })),
  next_steps: z.array(z.string()),
})

const roundBand = (b: number) => Math.max(0, Math.min(9, Math.round(b * 2) / 2))

export async function aiWritingFeedback(p: WritingPrompt, text: string) {
  const fb = await llmJson({
    system:
      'You are an experienced IELTS writing teacher. Give honest, specific, encouraging feedback to a learner. ' +
      'Assess the four IELTS writing criteria separately with an estimated band (0–9 in half bands). These are unofficial practice estimates. ' +
      'Explain WHY something is weak and HOW to fix it, quoting short phrases from the learner’s text. ' +
      'Do not rewrite the whole essay: give at most 8 corrections of real errors and at most 3 improved versions of single sentences. ' +
      'Write in clear, simple English (B1 level) because the learner may not be advanced.',
    prompt: `IELTS ${p.testType === 'general_training' ? 'General Training' : p.testType === 'academic' ? 'Academic' : ''} Writing Task ${p.task}${p.essayType ? ` (${p.essayType} essay)` : ''}.\n\nQUESTION:\n${p.prompt}\n${p.chart ? `\nCHART DATA (the learner saw this as a chart):\n${JSON.stringify(p.chart)}\n` : ''}\nMinimum length: ${p.minWords} words. The learner wrote ${wordsOf(text).length} words.\n\nLEARNER'S ANSWER:\n"""\n${text}\n"""\n\nReturn the criteria in this order: Task achievement / response, Coherence and cohesion, Lexical resource, Grammatical range and accuracy.`,
    schema: AiFeedback,
    maxTokens: 6000,
    effort: 'medium',
  })
  return { ...fb, overall_band_estimate: roundBand(fb.overall_band_estimate), criteria: fb.criteria.map((c) => ({ ...c, band: roundBand(c.band) })), unofficial: true, generatedAt: now() }
}

// ------------------------------------------------------------------------------------------- routes
export const writingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/prompts', async (req) => {
    const user = requireUser(req)
    const tt = db().one<{ test_type: string | null }>('SELECT test_type FROM profiles WHERE user_id = ?', user.id)?.test_type ?? 'academic'
    const rows = db().all<{ id: string; data: string; premium: number }>("SELECT id, data, premium FROM content_items WHERE kind = 'writing' AND status = 'published' AND (test_type = ? OR test_type = 'both') ORDER BY sort", tt)
    const subs = db().all<{ prompt_id: string; id: string; status: string; word_count: number; updated_at: number; ai_feedback: string | null }>('SELECT prompt_id, id, status, word_count, updated_at, ai_feedback FROM writing_submissions WHERE user_id = ? AND mock_attempt_id IS NULL ORDER BY updated_at DESC', user.id)
    return rows.map((r) => {
      const p = JSON.parse(r.data) as WritingPrompt
      const mine = subs.filter((s) => s.prompt_id === r.id)
      return { id: r.id, task: p.task, kind: p.kind, title: p.title, testType: p.testType, minutes: p.minutes, minWords: p.minWords, premium: !!r.premium, submissions: mine.map((s) => ({ id: s.id, status: s.status, wordCount: s.word_count, updatedAt: s.updated_at, band: json<{ overall_band_estimate?: number }>(s.ai_feedback, {}).overall_band_estimate ?? null })) }
    })
  })

  /** Opens the user's current draft for a task, or starts a new one. */
  app.post('/submissions', async (req) => {
    const user = requireUser(req)
    const body = z.object({ promptId: z.string(), fresh: z.boolean().default(false), mockAttemptId: z.string().optional() }).parse(req.body)
    const p = loadPrompt(body.promptId)
    if (p.premium && !hasFlag(user.id, 'premiumContent')) throw new HttpError(402, 'premium_required', 'This task is part of Premium.')
    if (!body.fresh && !body.mockAttemptId) {
      const draft = db().one<SubRow>("SELECT * FROM writing_submissions WHERE user_id = ? AND prompt_id = ? AND status = 'draft' AND mock_attempt_id IS NULL ORDER BY updated_at DESC LIMIT 1", user.id, p.id)
      if (draft) return subView(draft)
    }
    const id = newId('ws_')
    db().run('INSERT INTO writing_submissions (id, user_id, prompt_id, created_at, updated_at, mock_attempt_id) VALUES (?, ?, ?, ?, ?, ?)', id, user.id, p.id, now(), now(), body.mockAttemptId ?? null)
    return subView(getSub(user.id, id))
  })

  app.get('/submissions/:id', async (req) => subView(getSub(requireUser(req).id, (req.params as { id: string }).id)))

  /** Autosave. Keeps a draft-history snapshot at most once a minute (or after a big change). */
  app.patch('/submissions/:id', async (req) => {
    const user = requireUser(req)
    const s = getSub(user.id, (req.params as { id: string }).id)
    if (s.status !== 'draft') throw new HttpError(409, 'submitted', 'This essay has already been submitted.')
    const body = z.object({ text: z.string().max(20_000), timeSpentS: z.number().int().min(0).max(36_000).optional() }).parse(req.body)
    const wc = wordsOf(body.text).length
    db().tx(() => {
      db().run('UPDATE writing_submissions SET text = ?, word_count = ?, time_spent_s = MAX(time_spent_s, ?), updated_at = ? WHERE id = ?', body.text, wc, body.timeSpentS ?? 0, now(), s.id)
      const last = db().one<{ saved_at: number; word_count: number }>('SELECT saved_at, word_count FROM writing_drafts WHERE submission_id = ? ORDER BY saved_at DESC LIMIT 1', s.id)
      if (body.text.trim() && (!last || now() - last.saved_at > 60_000 || Math.abs(wc - last.word_count) >= 40)) {
        db().run('INSERT INTO writing_drafts (submission_id, text, word_count, saved_at) VALUES (?, ?, ?, ?)', s.id, body.text, wc, now())
        db().run('DELETE FROM writing_drafts WHERE submission_id = ? AND id NOT IN (SELECT id FROM writing_drafts WHERE submission_id = ? ORDER BY saved_at DESC LIMIT 30)', s.id, s.id)
      }
    })
    return { ok: true, wordCount: wc, savedAt: now() }
  })

  app.get('/submissions/:id/drafts', async (req) => {
    const user = requireUser(req)
    const s = getSub(user.id, (req.params as { id: string }).id)
    return db().all('SELECT id, text, word_count AS wordCount, saved_at AS savedAt FROM writing_drafts WHERE submission_id = ? ORDER BY saved_at DESC', s.id)
  })

  /** Submits the essay and runs the automatic checks. */
  app.post('/submissions/:id/submit', async (req) => {
    const user = requireUser(req)
    const s = getSub(user.id, (req.params as { id: string }).id)
    if (s.status === 'submitted') return subView(s)
    const body = z.object({ text: z.string().max(20_000), timeSpentS: z.number().int().min(0).max(36_000).optional() }).parse(req.body)
    if (wordsOf(body.text).length < 20) throw new HttpError(400, 'too_short', 'Please write at least a few sentences before submitting.')
    const checks = await analyseWriting(body.text, loadPrompt(s.prompt_id))
    db().run("UPDATE writing_submissions SET text = ?, word_count = ?, status = 'submitted', checks = ?, submitted_at = ?, updated_at = ?, time_spent_s = MAX(time_spent_s, ?) WHERE id = ?", body.text, checks.stats.wordCount, JSON.stringify(checks), now(), now(), body.timeSpentS ?? 0, s.id)
    recordActivity(user.id)
    return subView(getSub(user.id, s.id))
  })

  /** AI feedback (optional provider). Requires consent, counts towards the plan's daily limit, refunded on failure. */
  app.post('/submissions/:id/ai-feedback', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const user = requireUser(req)
    const s = getSub(user.id, (req.params as { id: string }).id)
    if (s.status !== 'submitted') throw new HttpError(409, 'not_submitted', 'Submit your essay first.')
    if (s.ai_feedback) return subView(s)
    const consent = db().one<{ ai_consent: number }>('SELECT ai_consent FROM profiles WHERE user_id = ?', user.id)!.ai_consent
    if (!consent) throw new HttpError(403, 'consent_required', 'Please agree to send your essay to the AI provider first.')
    if (s.ai_status === 'pending') throw new HttpError(409, 'pending', 'Feedback is already being generated.')
    consume(user.id, 'writingFeedbackPerDay', 'AI writing feedback reviews')
    db().run("UPDATE writing_submissions SET ai_status = 'pending' WHERE id = ?", s.id)
    try {
      const fb = await aiWritingFeedback(loadPrompt(s.prompt_id), s.text)
      db().run("UPDATE writing_submissions SET ai_feedback = ?, ai_status = 'done' WHERE id = ?", JSON.stringify(fb), s.id)
    } catch (e) {
      refund(user.id, 'writingFeedbackPerDay')
      db().run("UPDATE writing_submissions SET ai_status = 'failed' WHERE id = ?", s.id)
      throw e
    }
    return subView(getSub(user.id, s.id))
  })

  app.get('/history', async (req) => {
    const user = requireUser(req)
    return db()
      .all<SubRow>('SELECT * FROM writing_submissions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50', user.id)
      .map((s) => ({ id: s.id, promptId: s.prompt_id, title: loadPrompt(s.prompt_id).title, task: loadPrompt(s.prompt_id).task, status: s.status, wordCount: s.word_count, updatedAt: s.updated_at, band: json<{ overall_band_estimate?: number }>(s.ai_feedback, {}).overall_band_estimate ?? null, mock: !!s.mock_attempt_id }))
  })
}
