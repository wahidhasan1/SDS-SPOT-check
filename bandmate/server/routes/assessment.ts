import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { CEFR_LEVELS, cefrIndex, type Cefr } from '../../shared/config.ts'
import { db, json } from '../db/index.ts'
import { requireUser } from '../lib/auth.ts'
import { readContent } from '../content/seed.ts'
import { HttpError, clamp, newId, now, shuffle } from '../lib/util.ts'
import { recordActivity } from '../lib/events.ts'

type Item = { id: string; section: 'vocabulary' | 'grammar' | 'reading' | 'listening'; level: Cefr; prompt: string; options: string[]; answer: number; passage?: string; script?: string }

let bankCache: Item[] | null = null
const bank = () => (bankCache ??= readContent<{ items: Item[] }>('assessment.json').items)

/** Sections in order and how many adaptive items each contributes. */
const PLAN: { section: Item['section']; count: number }[] = [
  { section: 'vocabulary', count: 7 },
  { section: 'grammar', count: 7 },
  { section: 'reading', count: 4 },
  { section: 'listening', count: 4 },
]
const TOTAL = PLAN.reduce((n, p) => n + p.count, 0)
export const RETAKE_DAYS = 7

type State = {
  theta: number // ability on the CEFR index scale (0 = A1 … 5 = C2)
  asked: { id: string; level: number; section: string; correct: boolean; ms: number }[]
  current: { id: string; order: number[]; shownAt: number } | null
}

/**
 * Adaptive placement (1-parameter logistic model on the CEFR scale).
 * After each answer the ability estimate moves towards the evidence; the next item is the unused item
 * in the current section whose difficulty is closest to the estimate. Step size shrinks as evidence grows.
 */
export function updateTheta(theta: number, itemLevel: number, correct: boolean, n: number) {
  const p = 1 / (1 + Math.exp(-1.7 * (theta - itemLevel)))
  const k = Math.max(0.35, 1.2 / Math.sqrt(n + 1))
  return clamp(theta + k * ((correct ? 1 : 0) - p), -0.5, 5.5)
}

export function pickNext(state: State, items = bank()): Item | null {
  const n = state.asked.length
  if (n >= TOTAL) return null
  let idx = n
  let section = PLAN[0].section
  for (const p of PLAN) {
    if (idx < p.count) {
      section = p.section
      break
    }
    idx -= p.count
  }
  const used = new Set(state.asked.map((a) => a.id))
  const pool = items.filter((i) => i.section === section && !used.has(i.id))
  if (!pool.length) return null
  const target = Math.round(clamp(state.theta, 0, 5))
  const best = Math.min(...pool.map((i) => Math.abs(cefrIndex(i.level) - target)))
  return shuffle(pool.filter((i) => Math.abs(cefrIndex(i.level) - target) === best))[0]
}

function present(item: Item, order: number[], index: number) {
  return {
    id: item.id,
    section: item.section,
    index,
    total: TOTAL,
    prompt: item.prompt,
    passage: item.passage ?? null,
    audio: item.section === 'listening' ? `/audio/assessment/${item.id}.mp3` : null,
    options: order.map((i) => item.options[i]),
  }
}

export function finalResult(state: State) {
  const level = CEFR_LEVELS[clamp(Math.round(state.theta), 0, 5)]
  const bySection: Record<string, { correct: number; total: number }> = {}
  for (const a of state.asked) {
    bySection[a.section] ??= { correct: 0, total: 0 }
    bySection[a.section].total++
    if (a.correct) bySection[a.section].correct++
  }
  return { level, score: +clamp(state.theta, 0, 5).toFixed(2), sections: bySection }
}

export const assessmentRoutes: FastifyPluginAsync = async (app) => {
  /** Starts (or resumes) the placement test. Retakes are allowed once every RETAKE_DAYS days. */
  app.post('/start', async (req) => {
    const user = requireUser(req)
    const open = db().one<{ id: string; state: string }>("SELECT id, state FROM assessments WHERE user_id = ? AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1", user.id)
    if (open) {
      const st = json<State>(open.state, { theta: 2, asked: [], current: null })
      const item = st.current && bank().find((i) => i.id === st.current!.id)
      if (item) return { id: open.id, item: present(item, st.current!.order, st.asked.length + 1) }
    }
    const last = db().one<{ finished_at: number }>("SELECT finished_at FROM assessments WHERE user_id = ? AND status = 'completed' ORDER BY finished_at DESC LIMIT 1", user.id)
    if (last && now() - last.finished_at < RETAKE_DAYS * 86400_000) {
      const next = new Date(last.finished_at + RETAKE_DAYS * 86400_000)
      throw new HttpError(429, 'too_soon', `You can retake the level check on ${next.toDateString()}. Keep practising until then!`, { nextAt: next.getTime() })
    }
    db().run("UPDATE assessments SET status = 'abandoned' WHERE user_id = ? AND status = 'in_progress'", user.id)
    const state: State = { theta: 2, asked: [], current: null }
    const item = pickNext(state)!
    state.current = { id: item.id, order: shuffle(item.options.map((_, i) => i)), shownAt: now() }
    const id = newId('as_')
    db().run('INSERT INTO assessments (id, user_id, state, started_at) VALUES (?, ?, ?, ?)', id, user.id, JSON.stringify(state), now())
    return { id, item: present(item, state.current.order, 1) }
  })

  app.post('/answer', async (req) => {
    const user = requireUser(req)
    const body = z.object({ assessmentId: z.string(), itemId: z.string(), choice: z.number().int().min(0).max(5) }).parse(req.body)
    return db().tx(() => {
      const row = db().one<{ state: string; status: string }>('SELECT state, status FROM assessments WHERE id = ? AND user_id = ?', body.assessmentId, user.id)
      if (!row || row.status !== 'in_progress') throw new HttpError(404, 'not_found', 'This level check is no longer active. Start again.')
      const state = json<State>(row.state, { theta: 2, asked: [], current: null })
      // Only the item currently shown can be answered, exactly once.
      if (!state.current || state.current.id !== body.itemId) throw new HttpError(409, 'stale', 'This question was already answered.')
      const item = bank().find((i) => i.id === body.itemId)!
      const correct = state.current.order[body.choice] === item.answer
      const level = cefrIndex(item.level)
      state.theta = updateTheta(state.theta, level, correct, state.asked.length)
      state.asked.push({ id: item.id, level, section: item.section, correct, ms: now() - state.current.shownAt })
      const next = pickNext(state)
      if (next) {
        state.current = { id: next.id, order: shuffle(next.options.map((_, i) => i)), shownAt: now() }
        db().run('UPDATE assessments SET state = ? WHERE id = ?', JSON.stringify(state), body.assessmentId)
        return { done: false, item: present(next, state.current.order, state.asked.length + 1) }
      }
      state.current = null
      const result = finalResult(state)
      db().run("UPDATE assessments SET state = ?, status = 'completed', finished_at = ? WHERE id = ?", JSON.stringify(state), now(), body.assessmentId)
      db().run('UPDATE profiles SET cefr_level = ?, cefr_score = ? WHERE user_id = ?', result.level, result.score, user.id)
      const first = !db().one('SELECT 1 FROM proficiency_history WHERE user_id = ?', user.id)
      db().run('INSERT INTO proficiency_history (user_id, level, score, source, details, created_at) VALUES (?, ?, ?, ?, ?, ?)', user.id, result.level, result.score, first ? 'placement' : 'reassessment', JSON.stringify(result.sections), now())
      recordActivity(user.id)
      return { done: true, result }
    })
  })

  app.get('/status', async (req) => {
    const user = requireUser(req)
    const last = db().one<{ finished_at: number }>("SELECT finished_at FROM assessments WHERE user_id = ? AND status = 'completed' ORDER BY finished_at DESC LIMIT 1", user.id)
    return { lastAt: last?.finished_at ?? null, nextAt: last ? last.finished_at + RETAKE_DAYS * 86400_000 : null, items: TOTAL }
  })
}

