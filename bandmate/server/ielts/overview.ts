import type { FastifyPluginAsync } from 'fastify'
import { db, json } from '../db/index.ts'
import { requireUser } from '../lib/auth.ts'
import { overallBand } from './tests.ts'

const TYPE_LABEL: Record<string, string> = {
  tfng: 'True / False / Not Given', ynng: 'Yes / No / Not Given', mcq: 'Multiple choice', multi: 'Choose two', heading: 'Matching headings',
  match_info: 'Matching information', match_features: 'Matching features', endings: 'Sentence endings', gap: 'Completion (notes, tables, sentences)', bank: 'Summary with word list', map: 'Map / plan labelling',
}

/** IELTS dashboard: only real practice data. Missing data is reported as missing, never invented. */
export const overviewRoutes: FastifyPluginAsync = async (app) => {
  app.get('/overview', async (req) => {
    const user = requireUser(req)
    const p = db().one<{ test_type: string | null; target_band: number | null; goal: string | null }>('SELECT test_type, target_band, goal FROM profiles WHERE user_id = ?', user.id)!
    const objective = (kind: string) => {
      const rows = db().all<{ band: number | null; score: number; max_score: number; results: string; submitted_at: number }>("SELECT band, score, max_score, results, submitted_at FROM attempts WHERE user_id = ? AND kind = ? AND status = 'submitted' ORDER BY submitted_at DESC LIMIT 30", user.id, kind)
      const full = rows.filter((r) => r.band !== null)
      const types: Record<string, { correct: number; total: number }> = {}
      for (const r of rows) for (const [t, v] of Object.entries(json<{ byType?: Record<string, { correct: number; total: number }> }>(r.results, {}).byType ?? {})) {
        types[t] ??= { correct: 0, total: 0 }
        types[t].correct += v.correct
        types[t].total += v.total
      }
      const recent = rows.slice(0, 5)
      return {
        attempts: rows.length,
        latestBand: full[0]?.band ?? null,
        bestBand: full.length ? Math.max(...full.map((r) => r.band!)) : null,
        recentAccuracy: recent.length ? Math.round((recent.reduce((n, r) => n + r.score / r.max_score, 0) / recent.length) * 100) : null,
        history: full.slice(0, 10).map((r) => ({ band: r.band, at: r.submitted_at })).reverse(),
        questionTypes: Object.entries(types).map(([t, v]) => ({ type: t, label: TYPE_LABEL[t] ?? t, correct: v.correct, total: v.total, accuracy: Math.round((v.correct / v.total) * 100) })),
      }
    }
    const listening = objective('listening')
    const reading = objective('reading')
    const ws = db().all<{ ai_feedback: string | null; submitted_at: number | null; status: string }>("SELECT ai_feedback, submitted_at, status FROM writing_submissions WHERE user_id = ? AND status = 'submitted' ORDER BY submitted_at DESC LIMIT 20", user.id)
    const wBands = ws.map((w) => json<{ overall_band_estimate?: number }>(w.ai_feedback, {}).overall_band_estimate).filter((b): b is number => typeof b === 'number')
    const sp = db().all<{ ai_feedback: string | null; metrics: string; created_at: number }>("SELECT ai_feedback, metrics, created_at FROM speaking_sessions WHERE user_id = ? AND mode = 'answer' ORDER BY created_at DESC LIMIT 20", user.id)
    const sBands = sp.map((s) => json<{ fluency_band?: number; lexical_band?: number; grammar_band?: number }>(s.ai_feedback, {})).filter((f) => f.fluency_band !== undefined).map((f) => Math.round(((f.fluency_band! + f.lexical_band! + f.grammar_band!) / 3) * 2) / 2)
    const wpm = sp.slice(0, 5).map((s) => json<{ articulationRate?: number }>(s.metrics, {}).articulationRate).filter((x): x is number => !!x)
    const writing = { submissions: ws.length, latestBand: wBands[0] ?? null, aiReviewed: wBands.length }
    const speaking = { recordings: sp.length, latestBand: sBands[0] ?? null, aiReviewed: sBands.length, avgSpeakingRate: wpm.length ? Math.round(wpm.reduce((a, b) => a + b, 0) / wpm.length) : null }

    const vocab = db().one<{ saved: number; mastered: number }>('SELECT COUNT(*) AS saved, SUM(CASE WHEN box >= 3 THEN 1 ELSE 0 END) AS mastered FROM saved_words WHERE user_id = ?', user.id)!
    const grammar = db().one<{ lessons: number }>("SELECT COUNT(DISTINCT ref) AS lessons FROM quiz_sessions WHERE user_id = ? AND kind = 'grammar' AND score * 1.0 / total >= 0.8", user.id)!
    const mocks = db().all<{ id: string; status: string; finished_at: number | null }>('SELECT id, status, finished_at FROM mock_attempts WHERE user_id = ? ORDER BY started_at DESC LIMIT 10', user.id)

    const latest = { listening: listening.latestBand, reading: reading.latestBand, writing: writing.latestBand, speaking: speaking.latestBand }
    const have = Object.values(latest).filter((b): b is number => b !== null)
    const estimate = have.length === 4 ? overallBand(have) : null

    // Weak areas: question types with enough evidence and low accuracy; skills furthest below target.
    const weakTypes = [...listening.questionTypes.map((t) => ({ ...t, skill: 'listening' })), ...reading.questionTypes.map((t) => ({ ...t, skill: 'reading' }))].filter((t) => t.total >= 4 && t.accuracy < 65).sort((a, b) => a.accuracy - b.accuracy).slice(0, 4)
    const target = p.target_band ?? 6.5
    const gaps = Object.entries(latest).filter(([, b]) => b !== null && b < target).sort((a, b) => a[1]! - b[1]!)

    let next: { title: string; reason: string; to: string }
    if (!listening.attempts) next = { title: 'Try a Listening practice part', reason: 'You haven’t practised Listening yet.', to: '/ielts/listening' }
    else if (!reading.attempts) next = { title: 'Try a Reading passage', reason: 'You haven’t practised Reading yet.', to: '/ielts/reading' }
    else if (!writing.submissions) next = { title: 'Write your first Task 2 essay', reason: 'Writing feedback shows exactly what to improve.', to: '/ielts/writing' }
    else if (!speaking.recordings) next = { title: 'Record a Speaking answer', reason: 'See your transcript, speed and pauses.', to: '/speak/practice' }
    else if (weakTypes.length) next = { title: `Practise ${weakTypes[0].label}`, reason: `Your accuracy on this question type is ${weakTypes[0].accuracy}% (${weakTypes[0].skill}).`, to: `/ielts/${weakTypes[0].skill}` }
    else if (gaps.length) next = { title: `Focus on ${gaps[0][0]}`, reason: `Your latest ${gaps[0][0]} estimate (${gaps[0][1]}) is below your target (${target}).`, to: gaps[0][0] === 'speaking' ? '/speak/practice' : `/ielts/${gaps[0][0]}` }
    else if (!mocks.some((m) => m.status === 'completed')) next = { title: 'Take a full mock test', reason: 'Practise all four sections under exam conditions.', to: '/ielts/mock' }
    else next = { title: 'Keep practising with a speaking partner', reason: 'Real conversations build fluency.', to: '/speak/call?topic=ielts-3' }

    return {
      testType: p.test_type,
      targetBand: p.target_band,
      goal: p.goal,
      skills: { listening, reading, writing, speaking },
      latestBands: latest,
      estimate,
      estimateNote: estimate === null ? `An overall estimate appears when you have a result in all four skills (${have.length}/4 so far).` : 'Unofficial practice estimate based on your most recent results. It is not an official IELTS score.',
      vocab: { saved: vocab.saved, mastered: vocab.mastered ?? 0 },
      grammarMastered: grammar.lessons,
      mocks: mocks.length,
      weakTypes,
      next,
    }
  })
}
