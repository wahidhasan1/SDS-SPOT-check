import { afterAll, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { closeAll, getApp, makeAdmin, newUser } from './setup';
import { one, q } from '../src/db/pool';
import { sha256 } from '../src/lib/crypto';
import { consumeDaily } from '../src/services/entitlements';
import { scoreSet } from '../src/routes/ielts';
import { verifyStripeSignature } from '../src/routes/billing';

afterAll(closeAll);

describe('authentication', () => {
  it('rejects under-age registration and weak passwords', async () => {
    const app = await getApp();
    const young = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `y${Date.now()}@test.dev`, password: 'Passw0rd!x', displayName: 'Young', birthYear: new Date().getFullYear() - 10, acceptTerms: true } });
    expect(young.statusCode).toBe(403);
    const weak = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: `w${Date.now()}@test.dev`, password: 'password', displayName: 'Weak', birthYear: 1990, acceptTerms: true } });
    expect(weak.statusCode).toBe(400);
  });

  it('logs in, rejects bad credentials, and rotates refresh tokens with reuse detection', async () => {
    const app = await getApp();
    const u = await newUser();
    const bad = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: u.email, password: 'nope-nope1' } });
    expect(bad.statusCode).toBe(401);
    const r1 = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: u.refreshToken } });
    expect(r1.statusCode).toBe(200);
    // Reusing the old refresh token is treated as theft: all sessions are revoked.
    const reuse = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: u.refreshToken } });
    expect(reuse.statusCode).toBe(401);
    const afterTheft = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: r1.json().refreshToken } });
    expect(afterTheft.statusCode).toBe(401);
  });

  it('resets a password with a single-use token and revokes sessions', async () => {
    const app = await getApp();
    const u = await newUser();
    const token = `test-reset-token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await q(`INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '1 hour')`, [u.user.id, sha256(token)]);
    const ok = await app.inject({ method: 'POST', url: '/auth/reset-password', payload: { token, password: 'NewPassw0rd' } });
    expect(ok.statusCode).toBe(200);
    const again = await app.inject({ method: 'POST', url: '/auth/reset-password', payload: { token, password: 'Another1pass' } });
    expect(again.statusCode).toBe(400);
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: u.email, password: 'NewPassw0rd' } });
    expect(login.statusCode).toBe(200);
    const oldRefresh = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: u.refreshToken } });
    expect(oldRefresh.statusCode).toBe(401);
  });

  it('deletes an account and its data', async () => {
    const app = await getApp();
    const u = await newUser();
    await app.inject({ method: 'POST', url: '/vocabulary/saved', headers: u.auth, payload: { word: 'resilient', source: 'manual' } });
    const del = await app.inject({ method: 'POST', url: '/auth/delete-account', headers: u.auth, payload: { password: 'Passw0rd!x', confirm: 'DELETE' } });
    expect(del.statusCode).toBe(200);
    expect(await one('SELECT 1 FROM users WHERE id=$1', [u.user.id])).toBeNull();
    expect(await one('SELECT 1 FROM saved_words WHERE user_id=$1', [u.user.id])).toBeNull();
  });
});

describe('authorization boundaries', () => {
  it('prevents reading or modifying another user’s data', async () => {
    const app = await getApp();
    const a = await newUser();
    const b = await newUser();
    const att = (await app.inject({ method: 'POST', url: '/ielts/sets/academic-reading-urban-bees/attempts', headers: a.auth, payload: {} })).json().attempt;
    expect((await app.inject({ method: 'GET', url: `/ielts/attempts/${att.id}`, headers: b.auth })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url: `/ielts/attempts/${att.id}/answers`, headers: b.auth, payload: { answers: { q1: 'TRUE' } } })).statusCode).toBe(404);
    const saved = (await app.inject({ method: 'POST', url: '/vocabulary/saved', headers: a.auth, payload: { word: 'vital', source: 'manual' } })).json();
    await app.inject({ method: 'DELETE', url: `/vocabulary/saved/${saved.id}`, headers: b.auth });
    expect(await one('SELECT 1 FROM saved_words WHERE id=$1', [saved.id])).not.toBeNull();
    expect((await app.inject({ method: 'GET', url: '/admin/stats', headers: a.auth })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
  });

  it('never sends answer keys before submission', async () => {
    const app = await getApp();
    const u = await newUser();
    const res = await app.inject({ method: 'POST', url: '/ielts/sets/listening-s1-course-booking/attempts', headers: u.auth, payload: {} });
    expect(res.body).not.toContain('accepted');
    expect(res.body).not.toContain('Whitlock');
    expect(res.json().attempt.set.content.transcript).toBeUndefined();
  });
});

describe('scoring', () => {
  it('scores objective answers including word limits and alternatives', () => {
    const content = { groups: [
      { id: 'g', type: 'sentence_completion', maxWords: 2, questions: [{ id: 'q1', number: 1 }, { id: 'q2', number: 2 }] },
      { id: 'h', type: 'tfng', questions: [{ id: 'q3', number: 3 }] },
    ] };
    const key = { q1: { accepted: ['car park|carpark'], explanation: '' }, q2: { accepted: ['density'], explanation: '' }, q3: { accepted: ['NOT GIVEN'], explanation: '' } };
    const r = scoreSet(content, key, { q1: 'Car Park', q2: 'the density of hives', q3: 'not given' });
    expect(r.score).toBe(2);
    expect(r.perQuestion.q2.correct).toBe(false);
  });

  it('auto-submits timed attempts after the deadline using saved answers', async () => {
    const app = await getApp();
    const u = await newUser();
    const att = (await app.inject({ method: 'POST', url: '/ielts/sets/academic-reading-urban-bees/attempts', headers: u.auth, payload: { mode: 'timed' } })).json().attempt;
    await app.inject({ method: 'PUT', url: `/ielts/attempts/${att.id}/answers`, headers: u.auth, payload: { answers: { q1: 'TRUE' } } });
    await q(`UPDATE practice_attempts SET deadline = now() - interval '5 minutes' WHERE id=$1`, [att.id]);
    const late = await app.inject({ method: 'PUT', url: `/ielts/attempts/${att.id}/answers`, headers: u.auth, payload: { answers: { q2: 'TRUE' } } });
    expect(late.statusCode).toBe(409);
    const got = (await app.inject({ method: 'GET', url: `/ielts/attempts/${att.id}`, headers: u.auth })).json();
    expect(got.status).toBe('submitted');
    expect(got.score).toBe(1);
  });
});

describe('entitlements and quotas', () => {
  it('consumes daily quotas atomically under concurrency', async () => {
    const u = await newUser();
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => consumeDaily(u.user.id, 'aiReadingScans')));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3); // free plan: 3 scans/day
  });

  it('grants premium only from verified Stripe webhooks, idempotently', async () => {
    const app = await getApp();
    const u = await newUser();
    const event = {
      id: `evt_${Date.now()}`,
      type: 'customer.subscription.created',
      livemode: false,
      data: { object: { id: `sub_${Date.now()}`, customer: 'cus_123', status: 'active', current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, metadata: { user_id: u.user.id } } },
    };
    const raw = JSON.stringify(event);
    const ts = Math.floor(Date.now() / 1000);
    const sig = createHmac('sha256', 'whsec_test_secret').update(`${ts}.${raw}`).digest('hex');
    const forged = await app.inject({ method: 'POST', url: '/billing/stripe/webhook', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${ts},v1=${'0'.repeat(64)}` }, payload: raw });
    expect(forged.statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/me/entitlements', headers: u.auth })).json().plan).toBe('free');
    const ok = await app.inject({ method: 'POST', url: '/billing/stripe/webhook', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${ts},v1=${sig}` }, payload: raw });
    expect(ok.statusCode).toBe(200);
    const replay = await app.inject({ method: 'POST', url: '/billing/stripe/webhook', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${ts},v1=${sig}` }, payload: raw });
    expect(replay.json().duplicate).toBe(true);
    const ent = (await app.inject({ method: 'GET', url: '/me/entitlements', headers: u.auth })).json();
    expect(ent.plan).toBe('premium');
    expect(ent.source).toBe('stripe');
    expect(verifyStripeSignature(raw, `t=${ts - 3600},v1=${sig}`, 'whsec_test_secret')).toBe(false); // stale timestamp
  });

  it('handles RevenueCat lifecycle events (purchase, expiry) with webhook auth', async () => {
    const app = await getApp();
    const u = await newUser();
    const send = (type: string, exp: number, auth = 'Bearer rc-test-auth') =>
      app.inject({ method: 'POST', url: '/billing/revenuecat/webhook', headers: { authorization: auth, 'content-type': 'application/json' }, payload: { event: { id: `rc-${type}-${Date.now()}`, type, app_user_id: u.user.id, entitlement_ids: ['premium'], expiration_at_ms: exp, environment: 'SANDBOX' } } });
    expect((await send('INITIAL_PURCHASE', Date.now() + 86400000, 'Bearer wrong')).statusCode).toBe(401);
    await send('INITIAL_PURCHASE', Date.now() + 86400000);
    expect((await app.inject({ method: 'GET', url: '/me/entitlements', headers: u.auth })).json().plan).toBe('premium');
    await send('EXPIRATION', Date.now() - 5 * 86400000);
    expect((await app.inject({ method: 'GET', url: '/me/entitlements', headers: u.auth })).json().plan).toBe('free');
  });

  it('lets admins edit plan limits with validation and audit logging', async () => {
    const app = await getApp();
    const admin = await newUser();
    await makeAdmin(admin.user.id);
    const bad = await app.inject({ method: 'PUT', url: '/admin/plans/free', headers: admin.auth, payload: { limits: { callsPerDay: -1 } } });
    expect(bad.statusCode).toBe(400);
    const plans = (await app.inject({ method: 'GET', url: '/admin/plans', headers: admin.auth })).json();
    const free = plans.find((p: any) => p.id === 'free');
    const ok = await app.inject({ method: 'PUT', url: '/admin/plans/free', headers: admin.auth, payload: { limits: { ...free.limits, callsPerDay: 4 } } });
    expect(ok.statusCode).toBe(200);
    await app.inject({ method: 'POST', url: '/admin/plans/free/reset', headers: admin.auth });
    const audit = await q(`SELECT action FROM admin_audit_log WHERE admin_id=$1`, [admin.user.id]);
    expect(audit.map((a: any) => a.action)).toEqual(expect.arrayContaining(['update_plan', 'reset_plan']));
  });
});

describe('call credentials', () => {
  it('issues short-lived TURN credentials (coturn REST format)', async () => {
    const { iceServersFor } = await import('../src/realtime/calls');
    const servers = iceServersFor('user-1');
    const turn = servers.find((s) => s.username);
    expect(turn).toBeDefined();
    const [expiry, uid] = turn!.username!.split(':');
    expect(uid).toBe('user-1');
    expect(Number(expiry)).toBeGreaterThan(Date.now() / 1000);
    expect(turn!.credential).toBe(createHmac('sha1', 'turn-test-secret').update(turn!.username!).digest('base64'));
  });
});
