import fs from 'node:fs'
import path from 'node:path'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db, json } from '../db/index.ts'
import { env } from '../env.ts'
import { requireUser } from '../lib/auth.ts'
import { hasFlag } from '../lib/plans.ts'
import { readContent, upsertSeed } from '../content/seed.ts'
import { HttpError, newId, notFound, now } from '../lib/util.ts'
import { recordActivity } from '../lib/events.ts'
import { bandFor, publicTest, questionNumbers, score, sections, type ObjectiveTest } from './tests.ts'

export function seedObjective() {
  const files = fs.readdirSync(path.join(env.root, 'content')).filter((f) => f.startsWith('reading-') && f.endsWith('.json'))
  const reading = files.map((f) => readContent<ObjectiveTest>(f))
  const listening = readContent<ObjectiveTest[]>('listening.json')
  upsertSeed([
    ...reading.map((t, i) => ({ id: t.id, kind: 'reading' as const, test_type: t.testType as 'academic' | 'general_training', title: t.title, sort: i, data: t })),
    ...listening.map((t, i) => ({ id: t.id, kind: 'listening' as const, test_type: 'both' as const, title: t.title, sort: i, data: t })),
  ])
}

type ContentRow = { id: string; kind: string; test_type: string | null; title: string; premium: number; data: string }
export function loadTest(id: string) {
  const row = db().one<ContentRow>("SELECT id, kind, test_type, title, premium, data FROM content_items WHERE id = ? AND kind IN ('reading','listening') AND status = 'published'", id)
  if (!row) throw notFound('Test not found.')
  return { row, test: JSON.parse(row.data) as ObjectiveTest }
}

const audioManifest = () => {
  const f = path.join(env.root, 'public', 'audio', 'manifest.json')
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, { duration: number }>) : {}
}

/** Time limits: reading 60 min (20 per passage); listening = audio length + 10 min to check/transfer answers. */
export function timeLimitS(kind: string, test: ObjectiveTest, scope: number | null) {
  if (kind === 'reading') return scope === null ? (test.minutes ?? 60) * 60 : 20 * 60
  const m = audioManifest()
  const parts = sections(test).filter((_, i) => scope === null || i === scope)
  const audio = parts.reduce((n, p) => n + (m[`listening/${p.id}`]?.duration ?? 300), 0)
  return Math.round(audio + (scope === null ? 600 : 120))
}

type AttemptRow = { id: string; user_id: string; content_id: string; kind: string; mode: string; status: string; answers: string; flagged: string; score: number | null; max_score: number | null; band: number | null; results: string | null; time_spent_s: number; started_at: number; submitted_at: number | null; mock_attempt_id: string | null }

const GRACE_S = 90

function attemptView(a: AttemptRow) {
  const { test, row } = loadTest(a.content_id)
  const res = json<{ scope: number | null; played?: number[]; late?: boolean; items?: unknown[]; byType?: unknown }>(a.results, { scope: null })
  const scope = res.scope ?? null
  const limit = timeLimitS(a.kind, test, scope)
  const submitted = a.status === 'submitted'
  return {
    id: a.id,
    contentId: a.content_id,
    kind: a.kind,
    testType: row.test_type,
    mode: a.mode,
    status: a.status,
    scope,
    answers: json<Record<string, string>>(a.answers, {}),
    flagged: json<number[]>(a.flagged, []),
    played: res.played ?? [],
    startedAt: a.started_at,
    serverNow: now(),
    timeLimitS: limit,
    timeSpentS: a.time_spent_s,
    mockAttemptId: a.mock_attempt_id,
    test: publicTest(test, { includeScript: submitted }),
    questionNumbers: questionNumbers(test, scope ?? undefined),
    result: submitted ? { score: a.score, max: a.max_score, band: a.band, late: !!res.late, items: res.items, byType: res.byType, submittedAt: a.submitted_at } : null,
  }
}

function getAttempt(userId: string, id: string) {
  const a = db().one<AttemptRow>("SELECT * FROM attempts WHERE id = ? AND user_id = ? AND kind IN ('reading','listening')", id, userId)
  if (!a) throw notFound('Attempt not found.')
  return a
}

/** Scores and closes an attempt. Exam-mode answers sent after the time limit are ignored (saved answers are used). */
export function submitAttempt(a: AttemptRow, incoming?: Record<string, string>) {
  const { test, row } = loadTest(a.content_id)
  const res = json<{ scope: number | null; played?: number[] }>(a.results, { scope: null })
  const scope = res.scope ?? null
  const deadline = a.started_at + (timeLimitS(a.kind, test, scope) + GRACE_S) * 1000
  const late = a.mode === 'exam' && now() > deadline
  const answers = incoming && !late ? incoming : json<Record<string, string>>(a.answers, {})
  const s = score(test, answers, scope ?? undefined)
  const bandKind = a.kind === 'listening' ? 'listening' : row.test_type === 'general_training' ? 'general_training' : 'academic'
  const band = scope === null ? bandFor(bandKind, s.raw, s.max) : null
  db().run(
    "UPDATE attempts SET status = 'submitted', answers = ?, score = ?, max_score = ?, band = ?, results = ?, submitted_at = ?, time_spent_s = ? WHERE id = ? AND status = 'in_progress'",
    JSON.stringify(answers), s.raw, s.max, band, JSON.stringify({ ...res, late, items: s.items, byType: s.byType }), now(), Math.round((Math.min(now(), deadline) - a.started_at) / 1000), a.id,
  )
  recordActivity(a.user_id)
  return getAttempt(a.user_id, a.id)
}

const answersSchema = z.record(z.string().regex(/^\d{1,2}$/), z.string().max(120)).refine((r) => Object.keys(r).length <= 60, 'Too many answers')

export const objectiveRoutes: FastifyPluginAsync = async (app) => {
  /** Tests available to the user's chosen IELTS type, with their attempt history. */
  app.get('/tests', async (req) => {
    const user = requireUser(req)
    const kind = z.object({ kind: z.enum(['reading', 'listening']) }).parse(req.query).kind
    const tt = db().one<{ test_type: string | null }>('SELECT test_type FROM profiles WHERE user_id = ?', user.id)?.test_type ?? 'academic'
    const rows = db().all<ContentRow>("SELECT id, kind, test_type, title, premium, data FROM content_items WHERE kind = ? AND status = 'published' AND (test_type = ? OR test_type = 'both' OR ? = 'all') ORDER BY sort", kind, tt, (req.query as { all?: string }).all ? 'all' : '')
    return rows.map((r) => {
      const t = JSON.parse(r.data) as ObjectiveTest
      const attempts = db().all<{ id: string; status: string; score: number | null; max_score: number | null; band: number | null; started_at: number; results: string | null; mode: string }>('SELECT id, status, score, max_score, band, started_at, results, mode FROM attempts WHERE user_id = ? AND content_id = ? ORDER BY started_at DESC LIMIT 10', user.id, r.id)
      return {
        id: r.id,
        title: r.title,
        testType: r.test_type,
        premium: !!r.premium,
        sections: sections(t).map((s, i) => ({ index: i, title: s.title, questions: questionNumbers(t, i).length })),
        questions: questionNumbers(t).length,
        attempts: attempts.map((a) => ({ id: a.id, status: a.status, score: a.score, max: a.max_score, band: a.band, startedAt: a.started_at, mode: a.mode, scope: json<{ scope: number | null }>(a.results, { scope: null }).scope ?? null })),
      }
    })
  })

  /** Starts (or resumes) an attempt. scope = one passage/part index for focused practice, or null for the full test. */
  app.post('/attempts', async (req) => {
    const user = requireUser(req)
    const body = z.object({ contentId: z.string(), mode: z.enum(['practice', 'exam']), scope: z.number().int().min(0).max(5).nullable().default(null), mockAttemptId: z.string().optional() }).parse(req.body)
    const { row, test } = loadTest(body.contentId)
    if (row.premium && !hasFlag(user.id, 'premiumContent')) throw new HttpError(402, 'premium_required', 'This test is part of Premium.')
    if (body.scope !== null && body.scope >= sections(test).length) throw new HttpError(400, 'bad_scope', 'No such section.')
    if (body.mode === 'exam' && body.scope !== null) throw new HttpError(400, 'bad_scope', 'Exam mode uses the full test.')
    if (!body.mockAttemptId) {
      const open = db().one<AttemptRow>("SELECT * FROM attempts WHERE user_id = ? AND content_id = ? AND mode = ? AND status = 'in_progress' AND mock_attempt_id IS NULL ORDER BY started_at DESC LIMIT 1", user.id, body.contentId, body.mode)
      if (open && (json<{ scope: number | null }>(open.results, { scope: null }).scope ?? null) === body.scope) {
        // Strict exam attempts that ran out of time are closed instead of resumed.
        if (open.mode === 'exam' && now() > open.started_at + (timeLimitS(open.kind, test, null) + GRACE_S) * 1000) submitAttempt(open)
        else return attemptView(open)
      }
    }
    const id = newId('at_')
    db().run(
      'INSERT INTO attempts (id, user_id, content_id, kind, mode, results, started_at, mock_attempt_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id, user.id, body.contentId, row.kind, body.mode, JSON.stringify({ scope: body.scope, played: [] }), now(), body.mockAttemptId ?? null,
    )
    return attemptView(getAttempt(user.id, id))
  })

  app.get('/attempts/:id', async (req) => {
    const user = requireUser(req)
    const a = getAttempt(user.id, (req.params as { id: string }).id)
    if (a.status === 'in_progress' && a.mode === 'exam') {
      const { test } = loadTest(a.content_id)
      if (now() > a.started_at + (timeLimitS(a.kind, test, null) + GRACE_S) * 1000) return attemptView(submitAttempt(a))
    }
    return attemptView(a)
  })

  /** Autosave. */
  app.patch('/attempts/:id', async (req) => {
    const user = requireUser(req)
    const a = getAttempt(user.id, (req.params as { id: string }).id)
    if (a.status !== 'in_progress') throw new HttpError(409, 'submitted', 'This attempt has already been submitted.')
    const body = z.object({ answers: answersSchema.optional(), flagged: z.array(z.number().int().min(1).max(60)).max(60).optional(), timeSpentS: z.number().int().min(0).max(86400).optional() }).parse(req.body)
    db().run(
      'UPDATE attempts SET answers = COALESCE(?, answers), flagged = COALESCE(?, flagged), time_spent_s = MAX(time_spent_s, COALESCE(?, 0)) WHERE id = ?',
      body.answers ? JSON.stringify(body.answers) : null, body.flagged ? JSON.stringify(body.flagged) : null, body.timeSpentS ?? null, a.id,
    )
    return { ok: true, savedAt: now() }
  })

  /** Exam mode: records that a listening part has been played, so it can't be replayed after a reload. */
  app.post('/attempts/:id/played', async (req) => {
    const user = requireUser(req)
    const a = getAttempt(user.id, (req.params as { id: string }).id)
    const part = z.object({ part: z.number().int().min(0).max(5) }).parse(req.body).part
    const res = json<{ scope: number | null; played?: number[] }>(a.results, { scope: null })
    if (a.mode === 'exam' && res.played?.includes(part)) throw new HttpError(409, 'already_played', 'In exam mode each recording can be played only once.')
    res.played = [...new Set([...(res.played ?? []), part])]
    db().run('UPDATE attempts SET results = ? WHERE id = ?', JSON.stringify(res), a.id)
    return { played: res.played }
  })

  app.post('/attempts/:id/submit', async (req) => {
    const user = requireUser(req)
    const a = getAttempt(user.id, (req.params as { id: string }).id)
    if (a.status !== 'in_progress') return attemptView(a) // idempotent: a double submit returns the same result
    const body = z.object({ answers: answersSchema }).parse(req.body)
    return attemptView(submitAttempt(a, body.answers))
  })

  app.get('/history', async (req) => {
    const user = requireUser(req)
    const kind = z.object({ kind: z.enum(['reading', 'listening']).optional() }).parse(req.query).kind
    return db().all(
      `SELECT a.id, a.content_id AS contentId, c.title, a.kind, a.mode, a.status, a.score, a.max_score AS max, a.band, a.time_spent_s AS timeSpentS, a.started_at AS startedAt, a.submitted_at AS submittedAt
       FROM attempts a JOIN content_items c ON c.id = a.content_id WHERE a.user_id = ? AND a.kind IN ('reading','listening') AND (? IS NULL OR a.kind = ?) ORDER BY a.started_at DESC LIMIT 50`,
      user.id, kind ?? null, kind ?? null,
    )
  })
}
