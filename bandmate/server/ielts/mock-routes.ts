import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db, json } from '../db/index.ts'
import { requireUser } from '../lib/auth.ts'
import { consume } from '../lib/plans.ts'
import { upsertSeed } from '../content/seed.ts'
import { HttpError, newId, notFound, now } from '../lib/util.ts'
import { overallBand } from './tests.ts'
import { submitAttempt } from './objective-routes.ts'
import { analyseWriting } from '../services/writing-checks.ts'
import { loadPrompt } from './writing-routes.ts'

type MockDef = { title: string; testType: 'academic' | 'general_training'; listening: string; reading: string; writing: [string, string]; speaking: { part1: string; part2: string } }

export function seedMocks() {
  const mocks: { id: string; data: MockDef }[] = [
    { id: 'mock-ac-1', data: { title: 'Academic Mock Test 1', testType: 'academic', listening: 'listen-1', reading: 'read-ac-1', writing: ['w-ac-t1-line', 'w-t2-technology'], speaking: { part1: 'p1-hometown', part2: 'p2-teacher' } } },
    { id: 'mock-gt-1', data: { title: 'General Training Mock Test 1', testType: 'general_training', listening: 'listen-1', reading: 'read-gt-1', writing: ['w-gt-t1-complaint', 'w-t2-cities'], speaking: { part1: 'p1-work-study', part2: 'p2-trip' } } },
  ]
  upsertSeed(mocks.map((m, i) => ({ id: m.id, kind: 'mock' as const, test_type: m.data.testType, title: m.data.title, sort: i, data: m.data })))
}

export const SECTIONS = ['listening', 'reading', 'writing', 'speaking'] as const
export const WRITING_MINUTES = 60

type MockRow = { id: string; user_id: string; mock_id: string; status: string; section_index: number; section_started_at: number | null; results: string | null; started_at: number; finished_at: number | null }

const loadMock = (id: string) => {
  const r = db().one<{ data: string }>("SELECT data FROM content_items WHERE id = ? AND kind = 'mock' AND status = 'published'", id)
  if (!r) throw notFound('Mock test not found.')
  return JSON.parse(r.data) as MockDef
}

function speakingQuestions(def: MockDef) {
  const p1 = db().one<{ data: string }>("SELECT data FROM content_items WHERE id = ? AND kind = 'speaking'", def.speaking.part1)
  const p2 = db().one<{ data: string }>("SELECT data FROM content_items WHERE id = ? AND kind = 'speaking'", def.speaking.part2)
  const part1 = p1 ? (JSON.parse(p1.data) as { topic: string; questions: string[] }) : { topic: '', questions: [] }
  const card = p2 ? (JSON.parse(p2.data) as { title: string; cue: string; points: string[]; explain: string; part3: string[] }) : null
  return {
    part1: { topic: part1.topic, questions: part1.questions.slice(0, 4), promptId: def.speaking.part1 },
    part2: card && { promptId: def.speaking.part2, cue: card.cue, points: card.points, explain: card.explain, prepSeconds: 60, speakSeconds: 120 },
    part3: card ? card.part3.slice(0, 3) : [],
  }
}

/** Results are computed from the underlying attempts each time, so later AI feedback updates the mock. */
function results(m: MockRow, def: MockDef) {
  const la = db().one<{ band: number | null; score: number | null; max_score: number | null }>("SELECT band, score, max_score FROM attempts WHERE mock_attempt_id = ? AND kind = 'listening' AND status = 'submitted'", m.id)
  const ra = db().one<{ band: number | null; score: number | null; max_score: number | null }>("SELECT band, score, max_score FROM attempts WHERE mock_attempt_id = ? AND kind = 'reading' AND status = 'submitted'", m.id)
  const ws = db().all<{ id: string; prompt_id: string; ai_feedback: string | null; word_count: number }>('SELECT id, prompt_id, ai_feedback, word_count FROM writing_submissions WHERE mock_attempt_id = ? ORDER BY created_at', m.id)
  const t1 = ws.find((w) => w.prompt_id === def.writing[0])
  const t2 = ws.find((w) => w.prompt_id === def.writing[1])
  const b = (w?: { ai_feedback: string | null }) => json<{ overall_band_estimate?: number }>(w?.ai_feedback ?? null, {}).overall_band_estimate ?? null
  // In IELTS, Task 2 counts twice as much as Task 1.
  const writingBand = b(t1) !== null && b(t2) !== null ? Math.round(((b(t1)! + 2 * b(t2)!) / 3) * 2) / 2 : null
  const sp = db().all<{ id: string; part: number; ai_feedback: string | null; duration_s: number }>("SELECT id, part, ai_feedback, duration_s FROM speaking_sessions WHERE mock_attempt_id = ? AND mode = 'answer' ORDER BY created_at", m.id)
  const spBands = sp.map((s) => json<{ fluency_band?: number; lexical_band?: number; grammar_band?: number }>(s.ai_feedback, {})).filter((f) => f.fluency_band !== undefined)
  const speakingBand = spBands.length ? Math.round((spBands.reduce((n, f) => n + (f.fluency_band! + f.lexical_band! + f.grammar_band!) / 3, 0) / spBands.length) * 2) / 2 : null
  const bands = { listening: la?.band ?? null, reading: ra?.band ?? null, writing: writingBand, speaking: speakingBand }
  const all = Object.values(bands).every((x) => x !== null)
  return {
    bands,
    raw: { listening: la ? `${la.score}/${la.max_score}` : null, reading: ra ? `${ra.score}/${ra.max_score}` : null },
    writing: [t1, t2].map((w, i) => (w ? { submissionId: w.id, task: i + 1, wordCount: w.word_count, band: b(w) } : null)),
    speaking: { recordings: sp.length, withAiFeedback: spBands.length, sessionIds: sp.map((s) => s.id) },
    overall: all ? overallBand(Object.values(bands) as number[]) : null,
    note: 'Unofficial practice estimate. Listening and Reading use an approximate score conversion; Writing and Speaking estimates come from AI feedback (pronunciation is not assessed).',
  }
}

function view(m: MockRow) {
  const def = loadMock(m.mock_id)
  const section = SECTIONS[m.section_index] ?? null
  const underlying = {
    listening: db().one<{ id: string; status: string }>("SELECT id, status FROM attempts WHERE mock_attempt_id = ? AND kind = 'listening'", m.id) ?? null,
    reading: db().one<{ id: string; status: string }>("SELECT id, status FROM attempts WHERE mock_attempt_id = ? AND kind = 'reading'", m.id) ?? null,
    writing: db().all<{ id: string; status: string; prompt_id: string }>('SELECT id, status, prompt_id FROM writing_submissions WHERE mock_attempt_id = ? ORDER BY created_at', m.id),
    speaking: db().all<{ id: string; part: number; question: string }>('SELECT id, part, question FROM speaking_sessions WHERE mock_attempt_id = ? ORDER BY created_at', m.id),
  }
  return {
    id: m.id,
    mockId: m.mock_id,
    title: def.title,
    testType: def.testType,
    status: m.status,
    sectionIndex: m.section_index,
    section,
    sectionStartedAt: m.section_started_at,
    serverNow: now(),
    writingMinutes: WRITING_MINUTES,
    sections: SECTIONS.map((s, i) => ({ id: s, status: i < m.section_index || m.status === 'completed' ? 'done' : i === m.section_index ? 'current' : 'locked' })),
    content: { listening: def.listening, reading: def.reading, writing: def.writing, speaking: speakingQuestions(def) },
    underlying,
    startedAt: m.started_at,
    finishedAt: m.finished_at,
    results: m.status === 'completed' ? results(m, def) : null,
  }
}

function getMock(userId: string, id: string) {
  const m = db().one<MockRow>('SELECT * FROM mock_attempts WHERE id = ? AND user_id = ?', id, userId)
  if (!m) throw notFound('Mock test not found.')
  return m
}

export const mockRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const user = requireUser(req)
    const tt = db().one<{ test_type: string | null }>('SELECT test_type FROM profiles WHERE user_id = ?', user.id)?.test_type ?? 'academic'
    const mocks = db().all<{ id: string; title: string; test_type: string }>("SELECT id, title, test_type FROM content_items WHERE kind = 'mock' AND status = 'published' AND test_type = ? ORDER BY sort", tt)
    const attempts = db().all<MockRow>('SELECT * FROM mock_attempts WHERE user_id = ? ORDER BY started_at DESC LIMIT 20', user.id)
    return {
      mocks: mocks.map((m) => ({ id: m.id, title: m.title, testType: m.test_type })),
      attempts: attempts.map((a) => ({ id: a.id, mockId: a.mock_id, status: a.status, startedAt: a.started_at, finishedAt: a.finished_at, sectionIndex: a.section_index, overall: a.status === 'completed' ? results(a, loadMock(a.mock_id)).overall : null, bands: a.status === 'completed' ? results(a, loadMock(a.mock_id)).bands : null })),
    }
  })

  /** Starts a mock test (counts towards the weekly allowance) or resumes the unfinished one. */
  app.post('/start', async (req) => {
    const user = requireUser(req)
    const { mockId } = z.object({ mockId: z.string() }).parse(req.body)
    loadMock(mockId)
    const open = db().one<MockRow>("SELECT * FROM mock_attempts WHERE user_id = ? AND mock_id = ? AND status = 'in_progress'", user.id, mockId)
    if (open) return view(open)
    consume(user.id, 'mockTestsPerWeek', 'mock tests')
    const id = newId('mk_')
    db().run('INSERT INTO mock_attempts (id, user_id, mock_id, started_at) VALUES (?, ?, ?, ?)', id, user.id, mockId, now())
    return view(getMock(user.id, id))
  })

  app.get('/attempts/:id', async (req) => view(getMock(requireUser(req).id, (req.params as { id: string }).id)))

  /** Begins the current section: creates the underlying exam-mode attempt(s) and starts the clock. */
  app.post('/attempts/:id/begin', async (req) => {
    const user = requireUser(req)
    const m = getMock(user.id, (req.params as { id: string }).id)
    if (m.status !== 'in_progress') throw new HttpError(409, 'finished', 'This mock test is finished.')
    const def = loadMock(m.mock_id)
    const section = SECTIONS[m.section_index]
    db().tx(() => {
      if ((section === 'listening' || section === 'reading') && !db().one('SELECT 1 FROM attempts WHERE mock_attempt_id = ? AND kind = ?', m.id, section)) {
        db().run("INSERT INTO attempts (id, user_id, content_id, kind, mode, results, started_at, mock_attempt_id) VALUES (?, ?, ?, ?, 'exam', ?, ?, ?)", newId('at_'), user.id, section === 'listening' ? def.listening : def.reading, section, JSON.stringify({ scope: null, played: [] }), now(), m.id)
      }
      if (section === 'writing' && !db().one('SELECT 1 FROM writing_submissions WHERE mock_attempt_id = ?', m.id)) {
        for (const pid of def.writing) db().run('INSERT INTO writing_submissions (id, user_id, prompt_id, created_at, updated_at, mock_attempt_id) VALUES (?, ?, ?, ?, ?, ?)', newId('ws_'), user.id, pid, now(), now(), m.id)
      }
      if (!m.section_started_at) db().run('UPDATE mock_attempts SET section_started_at = ? WHERE id = ?', now(), m.id)
    })
    return view(getMock(user.id, m.id))
  })

  /** Finishes the current section (auto-submitting anything left open) and moves on. There is no going back. */
  app.post('/attempts/:id/complete', async (req) => {
    const user = requireUser(req)
    const m = getMock(user.id, (req.params as { id: string }).id)
    if (m.status !== 'in_progress') return view(m)
    const { section: expected } = z.object({ section: z.enum(SECTIONS) }).parse(req.body)
    const section = SECTIONS[m.section_index]
    if (expected !== section) return view(m) // stale or duplicate request: no double-advance
    if (section === 'listening' || section === 'reading') {
      const a = db().one<Parameters<typeof submitAttempt>[0]>('SELECT * FROM attempts WHERE mock_attempt_id = ? AND kind = ?', m.id, section)
      if (a && a.status === 'in_progress') submitAttempt(a)
    }
    if (section === 'writing') {
      for (const w of db().all<{ id: string; status: string; text: string; prompt_id: string }>("SELECT id, status, text, prompt_id FROM writing_submissions WHERE mock_attempt_id = ? AND status = 'draft'", m.id)) {
        const checks = await analyseWriting(w.text, loadPrompt(w.prompt_id))
        db().run("UPDATE writing_submissions SET status = 'submitted', checks = ?, submitted_at = ?, word_count = ? WHERE id = ?", JSON.stringify(checks), now(), checks.stats.wordCount, w.id)
      }
    }
    const next = m.section_index + 1
    if (next >= SECTIONS.length) db().run("UPDATE mock_attempts SET status = 'completed', section_index = ?, finished_at = ? WHERE id = ?", next, now(), m.id)
    else db().run('UPDATE mock_attempts SET section_index = ?, section_started_at = NULL WHERE id = ?', next, m.id)
    return view(getMock(user.id, m.id))
  })
}
