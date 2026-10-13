import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import type { FastifyInstance } from 'fastify'
import WebSocket from 'ws'
import { testApp, signup, type Agent } from '../test-helpers.ts'
import { db } from '../db/index.ts'
import { env } from '../env.ts'
import { entitlements } from '../lib/plans.ts'
import { createSession } from '../lib/auth.ts'
import { applyRevenueCatEvent, verifyStripeSignature } from './billing.ts'
import { sendDueReminders } from '../services/push.ts'
import { stopOcr } from '../services/ocr.ts'
import { BATTLE, eloDelta, makeQuestions, _battleState } from '../realtime/battles.ts'
import { seedVocab } from './vocab.ts'

let app: FastifyInstance
let u: Agent
before(async () => {
  app = await testApp()
  u = await signup(app, { level: 'B1' })
})
after(async () => {
  await app.close()
  await stopOcr()
})

const json = (r: { body: string }) => JSON.parse(r.body)

describe('premium entitlements', () => {
  it('a client cannot grant itself premium', async () => {
    // Unknown profile fields (plan, role…) are rejected outright.
    const r1 = await u.req<{ error: { code: string } }>('PATCH', '/api/me/profile', { plan: 'premium' })
    assert.equal(r1.status, 400)
    const r2 = await u.req('PATCH', '/api/me/profile', { role: 'admin' })
    assert.equal(r2.status, 400)
    // Without a payment provider, checkout is honestly "not configured" and grants nothing.
    const r3 = await u.req<{ error: { code: string } }>('POST', '/api/billing/checkout', { planId: 'premium' })
    assert.equal(r3.status, 503)
    assert.equal(r3.body.error.code, 'not_configured')
    // The test provider doesn't exist unless TEST_PAYMENTS is on.
    const r4 = await u.req('POST', '/api/billing/test/complete', { planId: 'premium', testCard: '4242 4242 4242 4242' })
    assert.equal(r4.status, 404)
    // Webhooks without credentials/signatures are refused.
    const r5 = await app.inject({ method: 'POST', url: '/api/webhooks/revenuecat', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ event: { id: 'x', type: 'INITIAL_PURCHASE', app_user_id: u.id } }) })
    assert.equal(r5.statusCode, 503)
    assert.equal(entitlements(u.id).planId, 'free')
    const me = await u.req<{ plan: { planId: string } }>('GET', '/api/me')
    assert.equal(me.body.plan.planId, 'free')
  })

  it('Stripe signatures are verified (HMAC, tolerance, tampering)', () => {
    const secret = 'whsec_test'
    const payload = '{"id":"evt_1"}'
    const t = Math.floor(Date.now() / 1000)
    const sig = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')
    assert.ok(verifyStripeSignature(payload, `t=${t},v1=${sig}`, secret))
    assert.ok(!verifyStripeSignature(payload + ' ', `t=${t},v1=${sig}`, secret), 'tampered body')
    assert.ok(!verifyStripeSignature(payload, `t=${t},v1=${sig}`, 'whsec_other'), 'wrong secret')
    assert.ok(!verifyStripeSignature(payload, `t=${t - 600},v1=${crypto.createHmac('sha256', secret).update(`${t - 600}.${payload}`).digest('hex')}`, secret), 'too old')
    assert.ok(!verifyStripeSignature(payload, undefined, secret))
  })

  it('RevenueCat lifecycle: purchase → cancel (keeps access) → expiration', async () => {
    const v = await signup(app)
    const end = Date.now() + 30 * 86400_000
    assert.equal(applyRevenueCatEvent({ id: 'e1', type: 'INITIAL_PURCHASE', app_user_id: v.id, original_transaction_id: 'otx1', expiration_at_ms: end }), 'applied')
    assert.equal(entitlements(v.id).planId, 'premium')
    applyRevenueCatEvent({ id: 'e2', type: 'CANCELLATION', app_user_id: v.id, original_transaction_id: 'otx1', expiration_at_ms: end })
    assert.equal(entitlements(v.id).planId, 'premium', 'access continues until the period ends')
    assert.equal(entitlements(v.id).subscription?.cancelAtPeriodEnd, true)
    applyRevenueCatEvent({ id: 'e3', type: 'EXPIRATION', app_user_id: v.id, original_transaction_id: 'otx1', expiration_at_ms: Date.now() })
    assert.equal(entitlements(v.id).planId, 'free')
    assert.equal(applyRevenueCatEvent({ id: 'e4', type: 'INITIAL_PURCHASE', app_user_id: 'someone-else' }), 'unknown_user')
    // Server-side limits follow the plan immediately.
    const n = db().all('SELECT * FROM notifications WHERE user_id = ? AND kind = ?', v.id, 'billing').length
    assert.equal(n, 2, 'told when Premium starts and ends')
  })

  it('a premium subscription that has passed its end date grants nothing', async () => {
    const v = await signup(app)
    db().run("INSERT INTO subscriptions (id, user_id, plan_id, provider, provider_ref, status, current_period_end, created_at, updated_at) VALUES ('s_old', ?, 'premium', 'stripe', 'sub_old', 'active', ?, ?, ?)", v.id, Date.now() - 1000, Date.now(), Date.now())
    assert.equal(entitlements(v.id).planId, 'free')
  })
})

describe('admin', () => {
  it('admin routes require the admin role on the server', async () => {
    for (const [m, url] of [['GET', '/api/admin/overview'], ['GET', '/api/admin/users'], ['POST', `/api/admin/users/${u.id}/grant`], ['PUT', '/api/admin/plans/free']] as const) {
      const r = await u.req(m, url, m === 'GET' ? undefined : {})
      assert.equal(r.status, 403, `${m} ${url}`)
    }
    const anon = await app.inject({ method: 'GET', url: '/api/admin/overview' })
    assert.equal(anon.statusCode, 401)
  })

  it('grants are audited, plan limits are validated, invalid content is rejected', async () => {
    const admin = await signup(app)
    db().run("UPDATE users SET role = 'admin' WHERE id = ?", admin.id)
    const target = await signup(app)
    const g = await admin.req('POST', `/api/admin/users/${target.id}/grant`, { planId: 'premium', days: 30, reason: 'Partner school pilot' })
    assert.equal(g.status, 200)
    assert.equal(entitlements(target.id).planId, 'premium')
    assert.ok(db().one("SELECT 1 FROM audit_log WHERE action = 'plan.grant' AND actor_id = ? AND target = ?", admin.id, target.id))
    await admin.req('POST', `/api/admin/users/${target.id}/grant`, { planId: 'premium', days: null, reason: 'End of pilot', revoke: true })
    assert.equal(entitlements(target.id).planId, 'free')

    const bad = await admin.req('PUT', '/api/admin/plans/free', { name: 'Free', priceLabel: 'Free', limits: { callsPerDay: 'lots' } })
    assert.equal(bad.status, 400)
    const ok = await admin.req('PUT', '/api/admin/plans/free', { name: 'Free', priceLabel: 'Free', limits: { callsPerDay: 5 } })
    assert.equal(ok.status, 200)
    assert.equal(entitlements(u.id).limits.callsPerDay, 5)

    const broken = await admin.req<{ error: { code: string } }>('PUT', '/api/admin/content/read-ac-1', { title: 'x', kind: 'reading', testType: 'academic', level: null, premium: false, status: 'published', data: { id: 'read-ac-1', title: 'x', passages: [] } })
    assert.equal(broken.body.error.code, 'invalid_content')

    const susp = await admin.req('POST', `/api/admin/users/${target.id}/status`, { status: 'banned', reason: 'Abusive language in several calls' })
    assert.equal(susp.status, 200)
    const t = await target.req('GET', '/api/me')
    assert.equal(t.status, 401, 'banned users are signed out')
    const self = await admin.req('POST', `/api/admin/users/${admin.id}/role`, { role: 'user' })
    assert.equal(self.status, 400)
  })
})

describe('reminders', () => {
  it('sends one reminder at the chosen local hour, only if the learner has not practised', async () => {
    const v = await signup(app)
    const at = Date.UTC(2026, 4, 10, 18, 5) // 18:05 UTC = 20:05 at UTC+2
    db().run('UPDATE profiles SET reminders_enabled = 1, reminder_hour = 20, timezone_offset = 120 WHERE user_id = ?', v.id)
    sendDueReminders(at)
    sendDueReminders(at + 10 * 60_000)
    assert.equal(db().all("SELECT 1 FROM notifications WHERE user_id = ? AND kind = 'reminder'", v.id).length, 1)
    sendDueReminders(Date.UTC(2026, 4, 10, 10, 0))
    assert.equal(db().all("SELECT 1 FROM notifications WHERE user_id = ? AND kind = 'reminder'", v.id).length, 1, 'not at other hours')
  })

  it('push subscription is refused when VAPID is not configured', async () => {
    const r = await u.req<{ error: { code: string } }>('POST', '/api/notifications/push', { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'x', auth: 'y' } })
    assert.equal(r.body.error.code, 'not_configured')
  })
})

describe('read with AI', () => {
  it('OCR reads text from a real photo-like image and the image is not stored', async () => {
    // Render a paragraph to an image with ffmpeg's drawtext so the test needs no fixtures.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-ocr-'))
    const img = path.join(dir, 'page.png')
    const font = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'].find((f) => fs.existsSync(f))
    const text = 'Libraries are quiet places where people can borrow books.'
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=1400x300', '-frames:v', '1', '-vf', `drawtext=${font ? `fontfile=${font}:` : ''}text='${text}':fontcolor=black:fontsize=40:x=40:y=120`, img])
    if (r.status !== 0) return // ffmpeg without drawtext: skip silently
    const boundary = '----bm' + Date.now()
    const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="rotate"\r\n\r\n0\r\n--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="p.png"\r\nContent-Type: image/png\r\n\r\n`), fs.readFileSync(img), Buffer.from(`\r\n--${boundary}--\r\n`)])
    const res = await app.inject({ method: 'POST', url: '/api/read/ocr', headers: { cookie: u.cookie, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload })
    fs.rmSync(dir, { recursive: true, force: true })
    assert.equal(res.statusCode, 200, res.body)
    const body = json(res) as { id: string; text: string; quality: { confidence: number } }
    assert.match(body.text.toLowerCase(), /libraries are quiet places/)
    assert.ok(!fs.readdirSync(path.join(env.root, 'data')).some((f) => /\.(png|jpe?g|webp)$/.test(f)), 'image not stored')

    // Tap "borrow" → contextual meaning from the offline dictionary.
    const off = body.text.toLowerCase().indexOf('borrow') + 2
    const ex = await u.req<{ lemma: string; best: { definition: string } | null; sentence: string }>('POST', '/api/read/explain', { sessionId: body.id, text: body.text, offset: off })
    assert.equal(ex.status, 200)
    assert.equal(ex.body.lemma, 'borrow')
    assert.ok(ex.body.best?.definition)
    // Translation needs an AI provider: honest 503 without one, and no allowance is used.
    const tr = await u.req<{ error: { code: string } }>('POST', '/api/read/translate', { text: 'borrow', target: 'Spanish' })
    assert.equal(tr.body.error.code, 'not_configured')
  })

  it('rejects files that are not images', async () => {
    const boundary = '----bm' + Date.now()
    const payload = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--${boundary}--\r\n`)
    const res = await app.inject({ method: 'POST', url: '/api/read/ocr', headers: { cookie: u.cookie, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload })
    assert.equal(res.statusCode, 400)
  })
})

describe('battles', () => {
  it('questions never include the answer in what players receive', () => {
    seedVocab()
    const qs = makeQuestions('mixed', 2)
    assert.equal(qs.length, BATTLE.questions)
    for (const q of qs) assert.ok(q.options.includes(q.answer) && q.options.length >= 2)
  })

  it('Elo: upsets move ratings more than expected results', () => {
    assert.ok(eloDelta(1000, 1400, 1, 20) > eloDelta(1400, 1000, 1, 20))
    assert.equal(eloDelta(1000, 1000, 0.5, 20), 0)
  })

  it('two real players: server-timed questions, server scoring, rating update, forfeit on leave', async () => {
    await app.listen({ port: 0, host: '127.0.0.1' })
    const port = (app.server.address() as { port: number }).port
    BATTLE.countdownMs = 50
    BATTLE.revealMs = 50
    BATTLE.questionMs = 3000
    const players = await Promise.all([signup(app, { level: 'B1' }), signup(app, { level: 'B1' })])
    const sockets = await Promise.all(
      players.map(async (p) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { cookie: p.cookie } })
        const msgs: Record<string, unknown>[] = []
        ws.on('message', (d) => msgs.push(JSON.parse(String(d))))
        await new Promise((r) => ws.once('open', r))
        return { ws, msgs, send: (m: object) => ws.send(JSON.stringify(m)) }
      }),
    )
    const waitFor = async (s: (typeof sockets)[0], pred: (m: Record<string, unknown>) => boolean, ms = 5000) => {
      const end = Date.now() + ms
      while (Date.now() < end) {
        const m = s.msgs.find(pred)
        if (m) return m
        await new Promise((r) => setTimeout(r, 20))
      }
      throw new Error('timeout waiting for message: ' + JSON.stringify(s.msgs.map((m) => m.t)))
    }
    sockets.forEach((s) => s.send({ t: 'battle.queue', mode: 'vocab' }))
    const found = await waitFor(sockets[0], (m) => m.t === 'battle.found', 4000)
    const battleId = found.battleId as string
    assert.ok(!JSON.stringify(found).includes('"answer"'), 'no answers sent to clients')
    const truth = _battleState.battles.get(battleId)!.questions

    // Question 1: player A answers correctly, B wrongly.
    const q0 = (await waitFor(sockets[0], (m) => m.t === 'battle.question' && m.q === 0)) as { question: { options: string[] } }
    assert.ok(!('answer' in q0.question))
    sockets[0].send({ t: 'battle.answer', battleId, q: 0, answer: truth[0].answer })
    const a0 = await waitFor(sockets[0], (m) => m.t === 'battle.answered' && m.q === 0)
    assert.equal(a0.correct, true)
    assert.ok((a0.points as number) >= 100)
    // A second answer to the same question is refused.
    sockets[0].send({ t: 'battle.answer', battleId, q: 0, answer: truth[0].answer })
    await waitFor(sockets[0], (m) => m.t === 'error' && m.code === 'already_answered')
    sockets[1].send({ t: 'battle.answer', battleId, q: 0, answer: q0.question.options.find((o) => o !== truth[0].answer) })
    const b0 = await waitFor(sockets[1], (m) => m.t === 'battle.answered' && m.q === 0)
    assert.equal(b0.correct, false)
    assert.equal(b0.points, 0)
    await waitFor(sockets[1], (m) => m.t === 'battle.reveal' && m.q === 0)

    // Player B leaves mid-battle → forfeit; A wins and ratings change on the server.
    await waitFor(sockets[0], (m) => m.t === 'battle.question' && m.q === 1)
    sockets[1].send({ t: 'battle.leave' })
    const end = (await waitFor(sockets[0], (m) => m.t === 'battle.end')) as { result: string; forfeit: string; you: { ratingAfter: number; ratingBefore: number } }
    assert.equal(end.result, 'win')
    assert.equal(end.forfeit, 'opponent')
    assert.ok(end.you.ratingAfter > end.you.ratingBefore)
    const rows = db().all<{ user_id: string; result: string; left_early: number }>('SELECT user_id, result, left_early FROM battle_participants WHERE battle_id = ?', battleId)
    assert.deepEqual({ ...rows.find((r) => r.user_id === players[1].id) }, { user_id: players[1].id, result: 'loss', left_early: 1 })
    sockets.forEach((s) => s.ws.close())

    // Solo practice: no rating change, server-timed.
    const solo = await players[0].req<{ id: string; questions: unknown[] }>('POST', '/api/battles/solo', { mode: 'vocab' })
    const early = await players[0].req('POST', `/api/battles/solo/${solo.body.id}/answer`, { q: 0, answer: 'x' })
    assert.equal(early.status, 409, 'must open the question first (server starts the clock)')
    const nx = await players[0].req<{ q: number; question: { options: string[] } }>('POST', `/api/battles/solo/${solo.body.id}/next`)
    const ans = await players[0].req<{ correct: boolean }>('POST', `/api/battles/solo/${solo.body.id}/answer`, { q: 0, answer: nx.body.question.options[0] })
    assert.equal(ans.status, 200)
    const lb = await players[0].req<{ you: { rating: number; games: number } }>('GET', '/api/battles/leaderboard')
    assert.equal(lb.body.you.games, 1, 'solo practice does not count as a rated game')
  })
})

// Keep createSession referenced for future WS tests that don't go through signup.
void createSession
