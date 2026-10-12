import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { cefrIndex } from '../../shared/config.ts'
import { db } from '../db/index.ts'
import { requireUser } from '../lib/auth.ts'
import { readContent, upsertSeed } from '../content/seed.ts'
import { newId, notFound, now } from '../lib/util.ts'
import { recordActivity } from '../lib/events.ts'

export type GrammarExercise =
  | { type: 'mcq'; prompt: string; options: string[]; answer: number; explanation: string }
  | { type: 'fill'; prompt: string; answer: string[]; explanation: string }
  | { type: 'fix'; prompt: string; tokens: string[]; answer: number; correction: string; explanation: string }
export type GrammarLesson = { id: string; title: string; level: string; topic: string; summary: string; sections: { heading: string; text: string; examples: string[] }[]; mistakes: [string, string, string][]; exercises: GrammarExercise[] }

export function seedGrammar() {
  const g = readContent<{ lessons: GrammarLesson[] }>('grammar.json')
  upsertSeed(g.lessons.map((l, i) => ({ id: l.id, kind: 'grammar' as const, title: l.title, level: l.level, sort: i, data: l })))
}

const lessons = () => db().all<{ id: string; data: string; premium: number }>("SELECT id, data, premium FROM content_items WHERE kind = 'grammar' AND status = 'published' ORDER BY sort").map((r) => ({ ...(JSON.parse(r.data) as GrammarLesson), id: r.id, premium: !!r.premium }))

/** Exercises as sent to the client: no answers or explanations until checked. */
const publicExercise = (e: GrammarExercise, i: number) => ({ index: i, type: e.type, prompt: e.prompt, options: e.type === 'mcq' ? e.options : null, tokens: e.type === 'fix' ? e.tokens : null })

const norm = (s: string) => s.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').replace(/[.!?]$/, '')

export function checkExercise(e: GrammarExercise, value: string | number | null): boolean {
  if (value === null || value === undefined) return false
  if (e.type === 'mcq' || e.type === 'fix') return Number(value) === e.answer
  return e.answer.some((a) => norm(a) === norm(String(value)))
}

export const grammarRoutes: FastifyPluginAsync = async (app) => {
  app.get('/lessons', async (req) => {
    const user = requireUser(req)
    const best = new Map(db().all<{ ref: string; best: number; total: number; attempts: number }>("SELECT ref, MAX(score) AS best, MAX(total) AS total, COUNT(*) AS attempts FROM quiz_sessions WHERE user_id = ? AND kind = 'grammar' GROUP BY ref", user.id).map((r) => [r.ref, r]))
    const level = db().one<{ cefr_level: string | null }>('SELECT cefr_level FROM profiles WHERE user_id = ?', user.id)?.cefr_level ?? 'B1'
    const list = lessons().map((l) => {
      const b = best.get(l.id)
      return { id: l.id, title: l.title, level: l.level, topic: l.topic, summary: l.summary, exercises: l.exercises.length, bestScore: b?.best ?? null, attempts: b?.attempts ?? 0, mastered: !!b && b.best / b.total >= 0.8 }
    })
    // Recommend the first lesson not yet mastered, up to one level above the learner.
    const rec = list.find((l) => !l.mastered && cefrIndex(l.level) <= cefrIndex(level) + 1 && cefrIndex(l.level) >= cefrIndex(level) - 1) ?? list.find((l) => !l.mastered)
    return { lessons: list, recommended: rec?.id ?? null }
  })

  app.get('/lessons/:id', async (req) => {
    requireUser(req)
    const l = lessons().find((x) => x.id === (req.params as { id: string }).id)
    if (!l) throw notFound('Lesson not found.')
    return { ...l, exercises: l.exercises.map(publicExercise) }
  })

  /** Checks a full set of answers on the server and records the attempt. */
  app.post('/lessons/:id/check', async (req) => {
    const user = requireUser(req)
    const l = lessons().find((x) => x.id === (req.params as { id: string }).id)
    if (!l) throw notFound('Lesson not found.')
    const body = z.object({ answers: z.array(z.union([z.string().max(200), z.number().int(), z.null()])).max(50) }).parse(req.body)
    const results = l.exercises.map((e, i) => {
      const correct = checkExercise(e, body.answers[i] ?? null)
      return {
        index: i,
        correct,
        answer: e.type === 'mcq' ? e.options[e.answer] : e.type === 'fix' ? `“${e.tokens[e.answer]}” → ${e.correction}` : e.answer[0],
        explanation: e.explanation,
      }
    })
    const score = results.filter((r) => r.correct).length
    db().run("INSERT INTO quiz_sessions (id, user_id, kind, ref, items, answers, score, total, created_at, finished_at) VALUES (?, ?, 'grammar', ?, '[]', ?, ?, ?, ?, ?)", newId('qz_'), user.id, l.id, JSON.stringify(body.answers), score, results.length, now(), now())
    recordActivity(user.id)
    return { score, total: results.length, results }
  })
}

