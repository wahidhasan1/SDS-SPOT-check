import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'
import { Db, db, setDb } from '../db/index.ts'
import { seedPlans } from '../lib/plans.ts'
import { seedSpeaking } from '../content/seed.ts'
import { createSession } from '../lib/auth.ts'
import { buildApp } from '../app.ts'
import { MATCHING_DEFAULTS, _state, compatibility, tick } from './calls.ts'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance
let url: string
let n = 0

function makeUser(level = 'B1', opts: { birthYear?: number; consent?: number; gender?: string | null } = {}) {
  const id = `u_test${++n}`
  db().run('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)', id, `${id}@t.test`, 'x', Date.now())
  db().run(
    'INSERT INTO profiles (user_id, display_name, anon_name, avatar_color, avatar_icon, birth_year, cefr_level, voice_consent, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, 'T', `Anon${n}`, '#000', 'star', opts.birthYear ?? 1990, level, opts.consent ?? 1, opts.gender ?? null,
  )
  return { id, token: createSession(id) }
}

type Client = { ws: WebSocket; msgs: Record<string, unknown>[]; send: (m: object) => void; next: (t: string, ms?: number) => Promise<Record<string, unknown>> }

async function connect(token: string): Promise<Client> {
  const ws = new WebSocket(url, { headers: { cookie: `bm_session=${token}` } })
  const msgs: Record<string, unknown>[] = []
  const waiters: { t: string; resolve: (m: Record<string, unknown>) => void }[] = []
  ws.on('message', (d) => {
    const m = JSON.parse(String(d))
    msgs.push(m)
    for (const w of [...waiters]) if (w.t === m.t) (waiters.splice(waiters.indexOf(w), 1), w.resolve(m))
  })
  await new Promise((r) => ws.once('open', r))
  return {
    ws,
    msgs,
    send: (m) => ws.send(JSON.stringify(m)),
    next: (t, ms = 3000) =>
      new Promise((resolve, reject) => {
        const found = msgs.find((m) => m.t === t)
        if (found) return resolve(found)
        waiters.push({ t, resolve })
        setTimeout(() => reject(new Error(`no ${t}`)), ms)
      }),
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

before(async () => {
  setDb(new Db(':memory:'))
  seedPlans()
  seedSpeaking()
  app = await buildApp()
  await app.listen({ port: 0, host: '127.0.0.1' })
  const addr = app.server.address() as { port: number }
  url = `ws://127.0.0.1:${addr.port}/ws`
})
after(async () => {
  await app.close()
})
beforeEach(() => {
  _state.queue.clear()
})

describe('matching', () => {
  it('pairs ten simultaneous users into five distinct sessions, never double-booking anyone', async () => {
    const users = Array.from({ length: 10 }, () => makeUser('B1'))
    const clients = await Promise.all(users.map((u) => connect(u.token)))
    clients.forEach((c) => c.send({ t: 'match.start', mode: 'casual', topic: 'random' }))
    const found = await Promise.all(clients.map((c) => c.next('match.found')))
    const sessions = new Map<string, number>()
    for (const f of found) sessions.set(String(f.sessionId), (sessions.get(String(f.sessionId)) ?? 0) + 1)
    assert.equal(sessions.size, 5)
    assert.ok([...sessions.values()].every((v) => v === 2))
    const rows = db().all<{ user_a: string; user_b: string }>("SELECT user_a, user_b FROM call_sessions WHERE status <> 'ended'")
    const everyone = rows.flatMap((r) => [r.user_a, r.user_b])
    assert.equal(new Set(everyone).size, everyone.length, 'a user appears in two live sessions')
    // Exactly one side of each pair is the initiator.
    for (const id of sessions.keys()) assert.equal(found.filter((f) => f.sessionId === id && f.initiator).length, 1)
    clients.forEach((c) => c.ws.close())
    await wait(200)
  })

  it('an odd user waits; spamming match.start never creates a second queue entry or session', async () => {
    const [a, b, c] = [makeUser(), makeUser(), makeUser()]
    const ca = await connect(a.token)
    for (let i = 0; i < 5; i++) ca.send({ t: 'match.start', mode: 'casual', topic: 'random' })
    await wait(150)
    assert.equal([..._state.queue.values()].filter((e) => e.userId === a.id).length, 1)
    const cb = await connect(b.token)
    const cc = await connect(c.token)
    cb.send({ t: 'match.start', mode: 'casual', topic: 'random' })
    cc.send({ t: 'match.start', mode: 'casual', topic: 'random' })
    await wait(400)
    const live = db().all<{ id: string }>("SELECT id FROM call_sessions WHERE status <> 'ended' AND (user_a IN (?1,?2,?3) OR user_b IN (?1,?2,?3))", a.id, b.id, c.id)
    assert.equal(live.length, 1)
    assert.equal(_state.queue.size, 1, 'the third user keeps waiting')
    // A user already in a call cannot queue again.
    const inCall = [ca, cb, cc].find((x) => x.msgs.some((m) => m.t === 'match.found'))!
    inCall.send({ t: 'match.start', mode: 'casual', topic: 'random' })
    const err = await inCall.next('error')
    assert.equal(err.code, 'in_call')
    ;[ca, cb, cc].forEach((x) => x.ws.close())
    await wait(200)
  })

  it('refuses minors, users without the level check, and users who have not accepted the guidelines', async () => {
    for (const [u, code] of [
      [makeUser('B1', { birthYear: new Date().getFullYear() - 16 }), 'age_restricted'],
      [makeUser('B1', { consent: 0 }), 'guidelines_required'],
    ] as const) {
      const c = await connect(u.token)
      c.send({ t: 'match.start', mode: 'casual', topic: 'random' })
      assert.equal((await c.next('error')).code, code)
      c.ws.close()
    }
    const noLevel = makeUser('B1')
    db().run('UPDATE profiles SET cefr_level = NULL WHERE user_id = ?', noLevel.id)
    const c = await connect(noLevel.token)
    c.send({ t: 'match.start', mode: 'casual', topic: 'random' })
    assert.equal((await c.next('error')).code, 'assessment_required')
    c.ws.close()
  })

  it('only relays signalling between the two participants of a session', async () => {
    const [a, b, x] = [makeUser(), makeUser(), makeUser()]
    const [ca, cb, cx] = await Promise.all([connect(a.token), connect(b.token), connect(x.token)])
    ca.send({ t: 'match.start', mode: 'casual', topic: 'random' })
    cb.send({ t: 'match.start', mode: 'casual', topic: 'random' })
    const f = await ca.next('match.found')
    cx.send({ t: 'call.signal', sessionId: f.sessionId, data: { type: 'offer', sdp: 'x' } })
    assert.equal((await cx.next('error')).code, 'no_session')
    ca.send({ t: 'call.end', sessionId: f.sessionId })
    const ended = await cb.next('call.ended')
    assert.equal(ended.reason, 'hangup')
    assert.equal(ended.endedBy, 'partner')
    // Never connected → the daily allowance is refunded.
    const used = db().one<{ count: number }>("SELECT count FROM usage_counters WHERE user_id = ? AND metric = 'callsPerDay'", a.id)?.count ?? 0
    assert.equal(used, 0)
    ;[ca, cb, cx].forEach((c) => c.ws.close())
    await wait(200)
  })
})

describe('compatibility rules', () => {
  const base = { clientId: 'c', mode: 'casual' as const, topic: 'random', role: 'either' as const, gender: null, genderPref: null, premium: false, maxMinutes: 15, excluded: new Set<string>(), recent: [] as string[] }
  const t0 = 1_000_000
  const q = (id: string, level: number, extra: Partial<typeof base> & { joinedAt?: number } = {}) => ({ ...base, userId: id, level, joinedAt: t0, ...extra })

  it('starts within ±1 level and widens with waiting time', () => {
    assert.notEqual(compatibility(q('a', 2), q('b', 3), MATCHING_DEFAULTS, t0), null)
    assert.equal(compatibility(q('a', 0), q('b', 3), MATCHING_DEFAULTS, t0), null)
    assert.notEqual(compatibility(q('a', 0), q('b', 3), MATCHING_DEFAULTS, t0 + 31_000), null) // 1 + floor(31/15) = 3
  })
  it('never pairs blocked users, however long they wait', () => {
    const a = q('a', 2, { excluded: new Set(['b']) })
    assert.equal(compatibility(a, q('b', 2), MATCHING_DEFAULTS, t0 + 3_600_000), null)
    assert.equal(compatibility(q('b', 2), a, MATCHING_DEFAULTS, t0 + 3_600_000), null)
  })
  it('respects topic preference first, then relaxes it', () => {
    const a = q('a', 2, { topic: 'travel' })
    const b = q('b', 2, { topic: 'food' })
    assert.equal(compatibility(a, b, MATCHING_DEFAULTS, t0), null)
    assert.notEqual(compatibility(a, b, MATCHING_DEFAULTS, t0 + 25_000), null)
    assert.notEqual(compatibility(a, q('c', 2, { topic: 'random' }), MATCHING_DEFAULTS, t0), null)
  })
  it('avoids recent partners until the wait is long', () => {
    const a = q('a', 2, { recent: ['b'] })
    assert.equal(compatibility(a, q('b', 2), MATCHING_DEFAULTS, t0), null)
    assert.notEqual(compatibility(a, q('b', 2), MATCHING_DEFAULTS, t0 + 50_000), null)
  })
  it('gender preference only matches people who chose to share that gender', () => {
    const a = q('a', 2, { genderPref: 'female' })
    assert.equal(compatibility(a, q('b', 2, { gender: null }), MATCHING_DEFAULTS, t0 + 999_000), null)
    assert.notEqual(compatibility(a, q('b', 2, { gender: 'female' }), MATCHING_DEFAULTS, t0), null)
  })
  it('never mixes casual and IELTS modes', () => {
    assert.equal(compatibility(q('a', 2), q('b', 2, { mode: 'ielts' as never, topic: 'ielts-1' }), MATCHING_DEFAULTS, t0 + 999_000), null)
  })
  void tick
})
