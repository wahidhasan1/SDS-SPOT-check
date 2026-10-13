import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db, json } from '../db/index.ts'
import { requireUser } from '../lib/auth.ts'
import { usage } from '../lib/plans.ts'
import { recordActivity } from '../lib/events.ts'
import { HttpError, newId, now } from '../lib/util.ts'
import { BATTLE, BATTLE_MODES, battleQueueSize, liveBattleFor, makeQuestions, publicQuestion, rating, soloView, type BattleQuestion } from '../realtime/battles.ts'
import { cefrIndex } from '../../shared/config.ts'
import { recordWordResult } from './vocab.ts'

// When each solo question was shown (server clock), so speed points can't be faked by the client.
const soloShown = new Map<string, number>()

export const battleRoutes: FastifyPluginAsync = async (app) => {
  app.get('/status', async (req) => {
    const user = requireUser(req)
    const u = usage(user.id, 'battlesPerDay')
    return {
      rating: rating(user.id),
      usedToday: u.used,
      limit: u.limit,
      liveBattleId: liveBattleFor(user.id),
      searching: Object.fromEntries(BATTLE_MODES.map((m) => [m, battleQueueSize(m)])),
      timing: { questions: BATTLE.questions, questionMs: BATTLE.questionMs },
    }
  })

  app.get('/history', async (req) => {
    const user = requireUser(req)
    const rows = db().all<{ id: string; mode: string; kind: string; status: string; created_at: number; score: number; correct: number; result: string | null; rating_before: number | null; rating_after: number | null; total: number }>(
      `SELECT b.id, b.mode, b.kind, b.status, b.created_at, p.score, p.correct, p.result, p.rating_before, p.rating_after, json_array_length(b.questions) AS total
       FROM battles b JOIN battle_participants p ON p.battle_id = b.id WHERE p.user_id = ? AND b.status <> 'active' ORDER BY b.created_at DESC LIMIT 30`,
      user.id,
    )
    return rows.map((r) => {
      const opp = r.kind === 'live' ? db().one<{ anon_name: string; avatar_color: string; avatar_icon: string; score: number }>('SELECT pr.anon_name, pr.avatar_color, pr.avatar_icon, p.score FROM battle_participants p LEFT JOIN profiles pr ON pr.user_id = p.user_id WHERE p.battle_id = ? AND p.user_id <> ?', r.id, user.id) : null
      return { id: r.id, mode: r.mode, kind: r.kind, status: r.status, at: r.created_at, score: r.score, correct: r.correct, total: r.total, result: r.result, ratingChange: r.rating_after !== null && r.rating_before !== null ? r.rating_after - r.rating_before : null, opponent: opp ? { name: opp.anon_name ?? 'Deleted user', color: opp.avatar_color, icon: opp.avatar_icon, score: opp.score } : null }
    })
  })

  /** Public leaderboard: anonymous names only, and only learners who opted in. */
  app.get('/leaderboard', async (req) => {
    const user = requireUser(req)
    const top = db().all<{ user_id: string; rating: number; games: number; wins: number; anon_name: string; avatar_color: string; avatar_icon: string; cefr_level: string | null; show_level_to_partners: number }>(
      `SELECT r.user_id, r.rating, r.games, r.wins, p.anon_name, p.avatar_color, p.avatar_icon, p.cefr_level, p.show_level_to_partners
       FROM ratings r JOIN profiles p ON p.user_id = r.user_id JOIN users u ON u.id = r.user_id
       WHERE p.show_on_leaderboard = 1 AND u.status = 'active' AND r.games >= 1 ORDER BY r.rating DESC, r.wins DESC LIMIT 50`,
    )
    const mine = rating(user.id)
    const optedIn = !!db().one<{ v: number }>('SELECT show_on_leaderboard AS v FROM profiles WHERE user_id = ?', user.id)?.v
    const rank = mine.games ? db().one<{ n: number }>("SELECT COUNT(*) AS n FROM ratings r JOIN profiles p ON p.user_id = r.user_id JOIN users u ON u.id = r.user_id WHERE p.show_on_leaderboard = 1 AND u.status = 'active' AND r.games >= 1 AND r.rating > ?", mine.rating)!.n + 1 : null
    return {
      top: top.map((t, i) => ({ rank: i + 1, name: t.anon_name, color: t.avatar_color, icon: t.avatar_icon, rating: t.rating, games: t.games, wins: t.wins, level: t.show_level_to_partners ? t.cefr_level : null, you: t.user_id === user.id })),
      you: { ...mine, rank: optedIn ? rank : null, optedIn },
    }
  })

  // ---- Solo practice: same questions, server-timed, no opponent and no rating change.
  app.post('/solo', { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req) => {
    const user = requireUser(req)
    const { mode } = z.object({ mode: z.enum(BATTLE_MODES) }).parse(req.body)
    const level = Math.max(0, cefrIndex(db().one<{ l: string | null }>('SELECT cefr_level AS l FROM profiles WHERE user_id = ?', user.id)?.l ?? 'B1'))
    const id = newId('bt_')
    db().tx(() => {
      db().run("INSERT INTO battles (id, mode, kind, status, questions, created_at, started_at) VALUES (?, ?, 'solo', 'active', ?, ?, ?)", id, mode, JSON.stringify(makeQuestions(mode, level)), now(), now())
      db().run('INSERT INTO battle_participants (battle_id, user_id) VALUES (?, ?)', id, user.id)
    })
    return soloView(id, user.id)
  })

  app.get('/solo/:id', async (req) => soloView((req.params as { id: string }).id, requireUser(req).id))

  /** Reveals the next question and starts its clock. */
  app.post('/solo/:id/next', async (req) => {
    const user = requireUser(req)
    const v = soloView((req.params as { id: string }).id, user.id)
    if (v.status !== 'active' || v.answered >= v.questions.length) throw new HttpError(409, 'finished', 'This round is finished.')
    const q = v.answered
    const key = `${v.id}:${q}`
    if (!soloShown.has(key)) soloShown.set(key, now())
    return { q, question: publicQuestion(json<BattleQuestion[]>(db().one<{ questions: string }>('SELECT questions FROM battles WHERE id = ?', v.id)!.questions, [])[q], q), endsIn: Math.max(0, soloShown.get(key)! + BATTLE.questionMs - now()) }
  })

  app.post('/solo/:id/answer', async (req) => {
    const user = requireUser(req)
    const id = (req.params as { id: string }).id
    const body = z.object({ q: z.number().int().min(0), answer: z.string().max(300) }).parse(req.body)
    const v = soloView(id, user.id)
    if (v.status !== 'active' || body.q !== v.answered) throw new HttpError(409, 'not_open', 'This question is closed.')
    const qs = json<BattleQuestion[]>(db().one<{ questions: string }>('SELECT questions FROM battles WHERE id = ?', id)!.questions, [])
    const q = qs[body.q]
    const shown = soloShown.get(`${id}:${body.q}`)
    if (!shown) throw new HttpError(409, 'not_open', 'Open the question first.')
    soloShown.delete(`${id}:${body.q}`)
    const ms = now() - shown
    const inTime = ms <= BATTLE.questionMs + 500
    const correct = inTime && body.answer === q.answer
    const points = correct ? 100 + Math.round((50 * Math.max(0, BATTLE.questionMs - ms)) / BATTLE.questionMs) : 0
    db().run('INSERT INTO battle_answers (battle_id, user_id, q_index, answer, correct, points, ms) VALUES (?, ?, ?, ?, ?, ?, ?)', id, user.id, body.q, inTime ? body.answer : '', correct ? 1 : 0, points, ms)
    if (q.wordId) recordWordResult(user.id, q.wordId, correct)
    const last = body.q === qs.length - 1
    if (last) {
      const s = db().one<{ score: number; correct: number }>('SELECT SUM(points) AS score, SUM(correct) AS correct FROM battle_answers WHERE battle_id = ? AND user_id = ?', id, user.id)!
      db().run("UPDATE battles SET status = 'finished', ended_at = ? WHERE id = ?", now(), id)
      db().run("UPDATE battle_participants SET score = ?, correct = ?, result = 'solo' WHERE battle_id = ? AND user_id = ?", s.score, s.correct, id, user.id)
      recordActivity(user.id)
    }
    return { correct, points, timedOut: !inTime, answer: q.answer, explanation: q.explanation, finished: last }
  })
}
