import { cefrIndex, CEFR_LEVELS } from '../../shared/config.ts'
import { db, json } from '../db/index.ts'
import { consume, refund } from '../lib/plans.ts'
import { HttpError, newId, now, shuffle } from '../lib/util.ts'
import { recordActivity } from '../lib/events.ts'
import { buildItem } from '../routes/vocab.ts'
import { type Client, clientsOf, findClient, onClose, onMessage, send } from './hub.ts'

/**
 * Real-time quiz battles between two real learners. The server is the only authority:
 * it picks the questions, keeps the answers secret, times every question with its own clock,
 * scores answers, and updates the battle rating (separate from the learner's CEFR level).
 */

export const BATTLE = {
  questions: 7,
  countdownMs: 3000,
  questionMs: 15_000,
  revealMs: 2500,
  graceMs: 10_000, // a disconnected player can come back within this time
  baseRatingRange: 150,
  widenPer5s: 50,
  maxRatingRange: 800,
}

export const BATTLE_MODES = ['vocab', 'grammar', 'mixed'] as const
export type BattleMode = (typeof BATTLE_MODES)[number]

export type BattleQuestion = { kind: 'vocab' | 'grammar'; prompt: string; options: string[]; answer: string; explanation: string; wordId?: number }
export const publicQuestion = (q: BattleQuestion, index: number) => ({ index, kind: q.kind, prompt: q.prompt, options: q.options })

// ------------------------------------------------------------------------------------------- questions
type WordRow = Parameters<typeof buildItem>[0]

/** Multiple-choice questions near the players' level. Spelling items (audio) are excluded so it's fair on mute. */
export function makeQuestions(mode: BattleMode, levelIdx: number, n = BATTLE.questions): BattleQuestion[] {
  const levels = CEFR_LEVELS.filter((_, i) => Math.abs(i - levelIdx) <= 1)
  const out: BattleQuestion[] = []
  const nGrammar = mode === 'grammar' ? n : mode === 'mixed' ? Math.floor(n / 2) : 0
  if (nGrammar) {
    const lessons = db().all<{ data: string }>(`SELECT data FROM content_items WHERE kind = 'grammar' AND status = 'published'`).map((r) => JSON.parse(r.data) as { level: string; exercises: { type: string; prompt: string; options?: string[]; answer: number | string[]; explanation: string }[] })
    const near = lessons.filter((l) => levels.includes(l.level as (typeof CEFR_LEVELS)[number]))
    const pool = (near.length ? near : lessons).flatMap((l) => l.exercises.filter((e) => e.type === 'mcq' && e.options && typeof e.answer === 'number'))
    for (const e of shuffle(pool).slice(0, nGrammar)) out.push({ kind: 'grammar', prompt: e.prompt, options: shuffle(e.options!), answer: e.options![e.answer as number], explanation: e.explanation })
  }
  const nVocab = n - out.length
  if (nVocab) {
    let words = db().all<WordRow>(`SELECT * FROM vocab_words WHERE status = 'published' AND level IN (${levels.map(() => '?').join(',')}) ORDER BY random() LIMIT ?`, ...levels, nVocab)
    if (words.length < nVocab) words = [...words, ...db().all<WordRow>("SELECT * FROM vocab_words WHERE status = 'published' ORDER BY random() LIMIT ?", nVocab - words.length)]
    for (const w of words) {
      const t = shuffle(['meaning', 'word', 'synonym', 'gap'] as const)[0]
      let it = buildItem(w, t)
      if (!it.options) it = buildItem(w, 'meaning')
      out.push({ kind: 'vocab', prompt: it.prompt, options: it.options!, answer: it.answer, explanation: it.explanation, wordId: w.id })
    }
  }
  return shuffle(out)
}

// ------------------------------------------------------------------------------------------- rating
export const rating = (userId: string) => db().one<{ rating: number; games: number; wins: number }>('SELECT rating, games, wins FROM ratings WHERE user_id = ?', userId) ?? { rating: 1000, games: 0, wins: 0 }

/** Elo with a larger K for the first 10 games so new players settle quickly. */
export function eloDelta(r: number, opp: number, score: 0 | 0.5 | 1, games: number) {
  const k = games < 10 ? 40 : 24
  const expected = 1 / (1 + 10 ** ((opp - r) / 400))
  return Math.round(k * (score - expected))
}

// ------------------------------------------------------------------------------------------- state
type QueueEntry = { userId: string; clientId: string; mode: BattleMode; rating: number; level: number; joinedAt: number; excluded: Set<string> }
type Player = { userId: string; clientId: string; score: number; correct: number; answers: Map<number, { answer: string; correct: boolean; points: number; ms: number }>; connected: boolean; graceTimer?: NodeJS.Timeout; anon: { name: string; color: string; icon: string }; rating: number; games: number }
type Battle = { id: string; mode: BattleMode; players: [Player, Player]; questions: BattleQuestion[]; q: number; phase: 'countdown' | 'question' | 'reveal' | 'done'; qStartedAt: number; timer?: NodeJS.Timeout; startedAt: number }

const queue = new Map<string, QueueEntry>()
const battles = new Map<string, Battle>()
const battleByUser = new Map<string, string>()
export const _battleState = { queue, battles, battleByUser }

const anonOf = (userId: string) => {
  const p = db().one<{ anon_name: string; avatar_color: string; avatar_icon: string }>('SELECT anon_name, avatar_color, avatar_icon FROM profiles WHERE user_id = ?', userId)!
  return { name: p.anon_name, color: p.avatar_color, icon: p.avatar_icon }
}
const levelOf = (userId: string) => Math.max(0, cefrIndex(db().one<{ cefr_level: string | null }>('SELECT cefr_level FROM profiles WHERE user_id = ?', userId)?.cefr_level ?? 'B1'))
const blockedPairs = (userId: string) => new Set(db().all<{ id: string }>('SELECT blocked_id AS id FROM blocks WHERE blocker_id = ? UNION SELECT blocker_id AS id FROM blocks WHERE blocked_id = ?', userId, userId).map((r) => r.id))

const toPlayer = (b: Battle, userId: string) => b.players.find((p) => p.userId === userId)!
const other = (b: Battle, userId: string) => b.players.find((p) => p.userId !== userId)!
const sendPlayer = (p: Player, msg: Record<string, unknown>) => send(findClient(p.userId, p.clientId), msg)
const broadcast = (b: Battle, msg: Record<string, unknown>) => b.players.forEach((p) => sendPlayer(p, msg))
const scores = (b: Battle) => Object.fromEntries(b.players.map((p) => [p.userId, p.score]))

/** What a (re)connecting player needs to render the battle. */
function snapshot(b: Battle, userId: string) {
  const me = toPlayer(b, userId)
  const opp = other(b, userId)
  return {
    battleId: b.id,
    mode: b.mode,
    total: b.questions.length,
    you: { score: me.score, rating: me.rating },
    opponent: { ...opp.anon, rating: opp.rating, score: opp.score, connected: opp.connected },
    phase: b.phase,
    q: b.q,
    question: b.phase === 'question' || b.phase === 'reveal' ? publicQuestion(b.questions[b.q], b.q) : null,
    endsIn: b.phase === 'question' ? Math.max(0, b.qStartedAt + BATTLE.questionMs - now()) : null,
    answered: b.phase === 'question' ? me.answers.has(b.q) : null,
  }
}

// ------------------------------------------------------------------------------------------- matching
export function battleTick(at = now()) {
  const entries = [...queue.values()].sort((a, b) => a.joinedAt - b.joinedAt)
  const used = new Set<string>()
  for (const a of entries) {
    if (used.has(a.userId)) continue
    const rangeA = Math.min(BATTLE.maxRatingRange, BATTLE.baseRatingRange + BATTLE.widenPer5s * Math.floor((at - a.joinedAt) / 5000))
    const match = entries.find((b) => {
      if (b.userId === a.userId || used.has(b.userId) || b.mode !== a.mode) return false
      if (a.excluded.has(b.userId) || b.excluded.has(a.userId)) return false
      const rangeB = Math.min(BATTLE.maxRatingRange, BATTLE.baseRatingRange + BATTLE.widenPer5s * Math.floor((at - b.joinedAt) / 5000))
      return Math.abs(a.rating - b.rating) <= Math.max(rangeA, rangeB)
    })
    if (!match) continue
    used.add(a.userId)
    used.add(match.userId)
    queue.delete(a.userId)
    queue.delete(match.userId)
    createBattle(a, match)
  }
}

function createBattle(a: QueueEntry, b: QueueEntry) {
  // Both players must still have a battle left today; whoever doesn't is told so and the other re-queues.
  const ok: QueueEntry[] = []
  for (const e of [a, b]) {
    try {
      consume(e.userId, 'battlesPerDay', 'battles')
      ok.push(e)
    } catch (err) {
      const h = err as HttpError
      send(findClient(e.userId, e.clientId), { t: 'battle.error', code: h.code, message: h.message })
    }
  }
  if (ok.length < 2) {
    for (const e of ok) {
      refund(e.userId, 'battlesPerDay')
      queue.set(e.userId, { ...e, joinedAt: e.joinedAt })
    }
    return
  }
  const id = newId('bt_')
  const questions = makeQuestions(a.mode, Math.round((a.level + b.level) / 2))
  const mk = (e: QueueEntry): Player => {
    const r = rating(e.userId)
    return { userId: e.userId, clientId: e.clientId, score: 0, correct: 0, answers: new Map(), connected: true, anon: anonOf(e.userId), rating: r.rating, games: r.games }
  }
  const battle: Battle = { id, mode: a.mode, players: [mk(a), mk(b)], questions, q: -1, phase: 'countdown', qStartedAt: 0, startedAt: now() }
  db().tx(() => {
    db().run("INSERT INTO battles (id, mode, kind, status, questions, created_at, started_at) VALUES (?, ?, 'live', 'active', ?, ?, ?)", id, a.mode, JSON.stringify(questions), now(), now())
    for (const p of battle.players) db().run('INSERT INTO battle_participants (battle_id, user_id, rating_before) VALUES (?, ?, ?)', id, p.userId, p.rating)
  })
  battles.set(id, battle)
  for (const p of battle.players) battleByUser.set(p.userId, id)
  for (const p of battle.players) sendPlayer(p, { t: 'battle.found', ...snapshot(battle, p.userId), startsIn: BATTLE.countdownMs })
  battle.timer = setTimeout(() => nextQuestion(battle), BATTLE.countdownMs)
}

// ------------------------------------------------------------------------------------------- game loop
function nextQuestion(b: Battle) {
  if (b.phase === 'done') return
  b.q++
  if (b.q >= b.questions.length) return finish(b)
  b.phase = 'question'
  b.qStartedAt = now()
  broadcast(b, { t: 'battle.question', battleId: b.id, q: b.q, total: b.questions.length, question: publicQuestion(b.questions[b.q], b.q), endsIn: BATTLE.questionMs, scores: scores(b) })
  clearTimeout(b.timer)
  b.timer = setTimeout(() => reveal(b), BATTLE.questionMs + 300) // small allowance for network latency
}

function reveal(b: Battle) {
  if (b.phase !== 'question') return
  b.phase = 'reveal'
  clearTimeout(b.timer)
  const q = b.questions[b.q]
  for (const p of b.players) {
    const mine = p.answers.get(b.q)
    const opp = other(b, p.userId).answers.get(b.q)
    sendPlayer(p, { t: 'battle.reveal', battleId: b.id, q: b.q, answer: q.answer, explanation: q.explanation, yours: mine ?? null, opponent: opp ? { correct: opp.correct, points: opp.points } : null, scores: scores(b) })
  }
  b.timer = setTimeout(() => nextQuestion(b), BATTLE.revealMs)
}

export function answer(b: Battle, userId: string, qIndex: number, value: string) {
  if (b.phase !== 'question' || qIndex !== b.q) throw new HttpError(409, 'not_open', 'This question is closed.')
  const p = toPlayer(b, userId)
  if (p.answers.has(qIndex)) throw new HttpError(409, 'already_answered', 'You already answered.')
  const q = b.questions[qIndex]
  if (!q.options.includes(value)) throw new HttpError(400, 'invalid', 'Choose one of the options.')
  const ms = now() - b.qStartedAt
  const correct = value === q.answer
  const remaining = Math.max(0, BATTLE.questionMs - ms)
  const points = correct ? 100 + Math.round((50 * remaining) / BATTLE.questionMs) : 0
  p.answers.set(qIndex, { answer: value, correct, points, ms })
  p.score += points
  if (correct) p.correct++
  db().run('INSERT INTO battle_answers (battle_id, user_id, q_index, answer, correct, points, ms) VALUES (?, ?, ?, ?, ?, ?, ?)', b.id, userId, qIndex, value, correct ? 1 : 0, points, ms)
  sendPlayer(p, { t: 'battle.answered', battleId: b.id, q: qIndex, correct, points, scores: scores(b) })
  sendPlayer(other(b, userId), { t: 'battle.opponent_answered', battleId: b.id, q: qIndex })
  if (b.players.every((x) => x.answers.has(qIndex))) reveal(b)
}

function finish(b: Battle, forfeitBy?: string) {
  if (b.phase === 'done') return
  b.phase = 'done'
  clearTimeout(b.timer)
  b.players.forEach((p) => clearTimeout(p.graceTimer))
  const anyAnswer = b.players.some((p) => p.answers.size > 0)
  // Someone left before the first question was answered: no result, both get their battle back.
  if (forfeitBy && !anyAnswer) {
    db().run("UPDATE battles SET status = 'aborted', ended_at = ? WHERE id = ?", now(), b.id)
    for (const p of b.players) {
      refund(p.userId, 'battlesPerDay')
      battleByUser.delete(p.userId)
      if (p.userId !== forfeitBy) sendPlayer(p, { t: 'battle.aborted', battleId: b.id, message: 'Your opponent left before the battle started. This battle didn’t count.' })
    }
    battles.delete(b.id)
    return
  }
  const [x, y] = b.players
  const res = (p: Player, o: Player): 0 | 0.5 | 1 => (forfeitBy ? (p.userId === forfeitBy ? 0 : 1) : p.score > o.score ? 1 : p.score === o.score ? 0.5 : 0)
  const out = b.players.map((p) => {
    const o = p === x ? y : x
    const r = res(p, o)
    const delta = eloDelta(p.rating, o.rating, r, p.games)
    return { p, r, delta, after: Math.max(100, p.rating + delta) }
  })
  db().tx(() => {
    db().run("UPDATE battles SET status = 'finished', ended_at = ? WHERE id = ?", now(), b.id)
    for (const o of out) {
      db().run('UPDATE battle_participants SET score = ?, correct = ?, result = ?, rating_after = ?, left_early = ? WHERE battle_id = ? AND user_id = ?', o.p.score, o.p.correct, o.r === 1 ? 'win' : o.r === 0 ? 'loss' : 'draw', o.after, forfeitBy === o.p.userId ? 1 : 0, b.id, o.p.userId)
      db().run(
        `INSERT INTO ratings (user_id, rating, games, wins, updated_at) VALUES (?, ?, 1, ?, ?)
         ON CONFLICT (user_id) DO UPDATE SET rating = excluded.rating, games = games + 1, wins = wins + excluded.wins, updated_at = excluded.updated_at`,
        o.p.userId, o.after, o.r === 1 ? 1 : 0, now(),
      )
    }
  })
  for (const o of out) {
    recordActivity(o.p.userId)
    const opp = out.find((z) => z !== o)!
    sendPlayer(o.p, {
      t: 'battle.end',
      battleId: b.id,
      result: o.r === 1 ? 'win' : o.r === 0 ? 'loss' : 'draw',
      forfeit: forfeitBy ? (forfeitBy === o.p.userId ? 'you' : 'opponent') : null,
      you: { score: o.p.score, correct: o.p.correct, ratingBefore: o.p.rating, ratingAfter: o.after },
      opponent: { ...opp.p.anon, score: opp.p.score, correct: opp.p.correct },
      total: b.questions.length,
    })
    battleByUser.delete(o.p.userId)
  }
  battles.delete(b.id)
}

/** Ends any battle the user is in by forfeit (account deletion, ban, explicit leave). */
export function leaveBattle(userId: string) {
  queue.delete(userId)
  const id = battleByUser.get(userId)
  const b = id ? battles.get(id) : undefined
  if (b) finish(b, userId)
}

export const liveBattleFor = (userId: string) => battleByUser.get(userId) ?? null
export const battleQueueSize = (mode: BattleMode) => [...queue.values()].filter((e) => e.mode === mode).length

// ------------------------------------------------------------------------------------------- messages
onMessage('battle.', (client: Client, msg) => {
  const userId = client.user.id
  switch (msg.t) {
    case 'battle.queue': {
      const mode = BATTLE_MODES.includes(msg.mode as BattleMode) ? (msg.mode as BattleMode) : 'mixed'
      if (battleByUser.has(userId)) throw new HttpError(409, 'in_battle', 'You are already in a battle.')
      if (db().one<{ status: string }>('SELECT status FROM users WHERE id = ?', userId)?.status !== 'active') throw new HttpError(403, 'suspended', 'Your account can’t join battles right now.')
      const r = rating(userId)
      queue.set(userId, { userId, clientId: client.id, mode, rating: r.rating, level: levelOf(userId), joinedAt: now(), excluded: blockedPairs(userId) })
      send(client, { t: 'battle.queued', mode, rating: r.rating })
      return
    }
    case 'battle.cancel':
      queue.delete(userId)
      send(client, { t: 'battle.cancelled' })
      return
    case 'battle.answer': {
      const b = battles.get(String(msg.battleId))
      if (!b || !b.players.some((p) => p.userId === userId)) throw new HttpError(404, 'not_found', 'Battle not found.')
      answer(b, userId, Number(msg.q), String(msg.answer))
      return
    }
    case 'battle.resume': {
      const id = battleByUser.get(userId)
      const b = id ? battles.get(id) : undefined
      if (!b) return send(client, { t: 'battle.gone' })
      const p = toPlayer(b, userId)
      clearTimeout(p.graceTimer)
      p.clientId = client.id
      p.connected = true
      sendPlayer(other(b, userId), { t: 'battle.opponent_status', connected: true })
      send(client, { t: 'battle.state', ...snapshot(b, userId) })
      return
    }
    case 'battle.leave':
      leaveBattle(userId)
      send(client, { t: 'battle.left' })
      return
  }
  throw new HttpError(400, 'unknown_type', 'Unknown battle message.')
})

onClose((client) => {
  const userId = client.user.id
  const q = queue.get(userId)
  if (q && q.clientId === client.id) queue.delete(userId)
  const id = battleByUser.get(userId)
  const b = id ? battles.get(id) : undefined
  if (!b) return
  const p = toPlayer(b, userId)
  if (p.clientId !== client.id) return
  // Another open tab of the same user takes over silently.
  const alt = clientsOf(userId)[0]
  if (alt) {
    p.clientId = alt.id
    send(alt, { t: 'battle.state', ...snapshot(b, userId) })
    return
  }
  p.connected = false
  sendPlayer(other(b, userId), { t: 'battle.opponent_status', connected: false })
  p.graceTimer = setTimeout(() => finish(b, userId), BATTLE.graceMs)
})

setInterval(() => battleTick(), 1000).unref()

/** Solo practice uses the same question generator but no opponent and no rating. */
export function soloView(id: string, userId: string) {
  const row = db().one<{ id: string; mode: string; questions: string; status: string; created_at: number }>("SELECT b.id, b.mode, b.questions, b.status, b.created_at FROM battles b JOIN battle_participants p ON p.battle_id = b.id WHERE b.id = ? AND p.user_id = ? AND b.kind = 'solo'", id, userId)
  if (!row) throw new HttpError(404, 'not_found', 'Practice round not found.')
  const qs = json<BattleQuestion[]>(row.questions, [])
  const answers = db().all<{ q_index: number; answer: string; correct: number; points: number }>('SELECT q_index, answer, correct, points FROM battle_answers WHERE battle_id = ? AND user_id = ? ORDER BY q_index', id, userId)
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    questions: qs.map((q, i) => ({ ...publicQuestion(q, i), ...(answers.find((a) => a.q_index === i) ? { yourAnswer: answers.find((a) => a.q_index === i)!.answer, answer: q.answer, explanation: q.explanation } : {}) })),
    score: answers.reduce((n, a) => n + a.points, 0),
    correct: answers.filter((a) => a.correct).length,
    answered: answers.length,
  }
}
