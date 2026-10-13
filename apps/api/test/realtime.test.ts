import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import WebSocket from 'ws';
import type { ServerMessage } from '@fluentpath/shared';
import { db, pool, schema } from '../src/db';
import { pointsFor } from '../src/realtime/battles';
import { call, getApp, registerUser, type TestUser } from './helpers';

let base = '';

beforeAll(async () => {
  const app = await getApp();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address() as { port: number };
  base = `127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await (await getApp()).close();
  await pool.end();
});

class Client {
  ws: WebSocket;
  inbox: ServerMessage[] = [];
  waiters: { pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
  constructor(user: TestUser) {
    this.ws = new WebSocket(`ws://${base}/ws`, { headers: { authorization: `Bearer ${user.token}` } });
    this.ws.on('message', (raw) => {
      const m = JSON.parse(String(raw)) as ServerMessage;
      const w = this.waiters.find((x) => x.pred(m));
      if (w) {
        this.waiters.splice(this.waiters.indexOf(w), 1);
        w.resolve(m);
      } else this.inbox.push(m);
    });
  }
  send(m: unknown) {
    this.ws.send(JSON.stringify(m));
  }
  next<T extends ServerMessage['type']>(type: T, timeout = 5000): Promise<Extract<ServerMessage, { type: T }>> {
    const i = this.inbox.findIndex((m) => m.type === type);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0] as Extract<ServerMessage, { type: T }>);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout waiting for ${type}; inbox=${JSON.stringify(this.inbox.map((m) => m.type))}`)), timeout);
      this.waiters.push({ pred: (m) => m.type === type, resolve: (m) => (clearTimeout(t), resolve(m as Extract<ServerMessage, { type: T }>)) });
    });
  }
  close() {
    this.ws.close();
  }
}

async function connected(u: TestUser) {
  const c = new Client(u);
  await c.next('ready');
  return c;
}

async function newPair() {
  const a = await registerUser({ mobile: true });
  const b = await registerUser({ mobile: true });
  return { a, b, ca: await connected(a), cb: await connected(b) };
}

describe('anonymous voice call signaling', () => {
  it('matches two users, relays WebRTC signals and mute state, ends the call and records history with aliases only', async () => {
    const { a, b, ca, cb } = await newPair();
    ca.send({ type: 'call.queue.join', mode: 'general', topic: 'travel', level: 'any' });
    await ca.next('call.queued');
    cb.send({ type: 'call.queue.join', mode: 'general', topic: 'any', level: 'any' });
    const ma = await ca.next('call.matched');
    const mb = await cb.next('call.matched');
    expect(ma.callId).toBe(mb.callId);
    expect(ma.topic).toBe('travel');
    expect(ma.partnerAlias).not.toContain('Test User');
    expect(JSON.stringify(ma)).not.toContain(b.email);

    // Duplicate session protection
    cb.send({ type: 'call.queue.join', mode: 'general', topic: 'any', level: 'any' });
    expect((await cb.next('error')).code).toBe('already_in_call');

    ca.send({ type: 'call.accept', callId: ma.callId });
    cb.send({ type: 'call.accept', callId: mb.callId });
    const sa = await ca.next('call.start');
    const sb = await cb.next('call.start');
    expect(sa.role).toBe('offerer');
    expect(sb.role).toBe('answerer');
    expect(sa.iceServers.length).toBeGreaterThan(0);

    ca.send({ type: 'call.signal', callId: ma.callId, data: { sdp: { type: 'offer', sdp: 'v=0 fake' } } });
    expect((await cb.next('call.signal')).data).toEqual({ sdp: { type: 'offer', sdp: 'v=0 fake' } });
    cb.send({ type: 'call.signal', callId: ma.callId, data: { candidate: { candidate: 'x' } } });
    expect((await ca.next('call.signal')).data).toEqual({ candidate: { candidate: 'x' } });
    ca.send({ type: 'call.connected', callId: ma.callId });
    cb.send({ type: 'call.mute', callId: ma.callId, muted: true });
    expect((await ca.next('call.partner_mute')).muted).toBe(true);
    await new Promise((r) => setTimeout(r, 1100));
    ca.send({ type: 'call.end', callId: ma.callId });
    const ea = await ca.next('call.ended');
    const eb = await cb.next('call.ended');
    expect(ea.reason).toBe('hung_up');
    expect(eb.durationSec).toBeGreaterThanOrEqual(1);

    const [row] = await db.select().from(schema.callSessions).where(eq(schema.callSessions.id, ma.callId));
    expect(row.status).toBe('ended');
    const hist = await call(a, 'GET', '/api/calls/history');
    expect(hist.json.calls[0].partnerAlias).toBe(ma.partnerAlias);
    expect(JSON.stringify(hist.json)).not.toContain(b.id);
    ca.close();
    cb.close();
  });

  it('puts the waiting user back in the queue when the partner declines', async () => {
    const { ca, cb } = await newPair();
    ca.send({ type: 'call.queue.join', mode: 'debate', topic: 'any', level: 'any' });
    await ca.next('call.queued');
    cb.send({ type: 'call.queue.join', mode: 'debate', topic: 'any', level: 'any' });
    const m = await ca.next('call.matched');
    await cb.next('call.matched');
    ca.send({ type: 'call.accept', callId: m.callId });
    cb.send({ type: 'call.decline', callId: m.callId });
    expect((await cb.next('call.declined')).byYou).toBe(true);
    expect((await ca.next('call.declined')).byYou).toBe(false);
    expect((await ca.next('call.queued')).position).toBeGreaterThan(0);
    ca.send({ type: 'call.queue.leave' });
    await ca.next('call.queue.left');
    ca.close();
    cb.close();
  });

  it('never matches users who blocked each other, and lets users report a call', async () => {
    const { a, ca, cb } = await newPair();
    ca.send({ type: 'call.queue.join', mode: 'ielts_speaking', topic: 'any', level: 'any' });
    await ca.next('call.queued');
    cb.send({ type: 'call.queue.join', mode: 'ielts_speaking', topic: 'any', level: 'any' });
    const m = await ca.next('call.matched');
    await cb.next('call.matched');
    const rep = await call(a, 'POST', `/api/calls/${m.callId}/report`, { reason: 'harassment', details: 'test report', block: true });
    expect(rep.status).toBe(201);
    const blocks = await call(a, 'GET', '/api/blocks');
    expect(blocks.json.blocks).toHaveLength(1);
    expect(blocks.json.blocks[0].alias).toBe(m.partnerAlias);
    // Reporting ends the match for both sides.
    expect((await ca.next('call.ended')).reason).toBe('reported');
    expect((await cb.next('call.ended')).reason).toBe('reported');
    // Both re-queue: they must not be matched again.
    ca.send({ type: 'call.queue.join', mode: 'ielts_speaking', topic: 'any', level: 'any' });
    await ca.next('call.queued');
    cb.send({ type: 'call.queue.join', mode: 'ielts_speaking', topic: 'any', level: 'any' });
    const q = await cb.next('call.queued');
    expect(q.waiting).toBe(2);
    expect(ca.inbox.some((x) => x.type === 'call.matched')).toBe(false);
    // Unblock works with the opaque id
    expect((await call(a, 'DELETE', `/api/blocks/${blocks.json.blocks[0].id}`)).status).toBe(200);
    ca.close();
    cb.close();
  });

  it('signals reconnecting when a partner drops and lets them rejoin', async () => {
    const { b, ca, cb } = await newPair();
    ca.send({ type: 'call.queue.join', mode: 'general', topic: 'food', level: 'any' });
    await ca.next('call.queued');
    cb.send({ type: 'call.queue.join', mode: 'general', topic: 'food', level: 'any' });
    const m = await ca.next('call.matched');
    await cb.next('call.matched');
    ca.send({ type: 'call.accept', callId: m.callId });
    cb.send({ type: 'call.accept', callId: m.callId });
    await ca.next('call.start');
    await cb.next('call.start');
    cb.ws.terminate();
    expect((await ca.next('call.partner_status')).status).toBe('reconnecting');
    const cb2 = await connected(b);
    cb2.send({ type: 'call.rejoin', callId: m.callId });
    expect((await ca.next('call.partner_status')).status).toBe('connected');
    expect((await cb2.next('call.start')).role).toBe('answerer');
    expect((await ca.next('call.start')).role).toBe('offerer');
    cb2.send({ type: 'call.end', callId: m.callId });
    await ca.next('call.ended');
    ca.close();
    cb2.close();
  });

  it('rejects unauthenticated sockets', async () => {
    const ws = new WebSocket(`ws://${base}/ws`);
    const code = await new Promise<number>((resolve) => {
      ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', token: 'invalid' })));
      ws.on('close', (c) => resolve(c));
    });
    expect(code).toBe(4401);
  });
});

describe('battles', () => {
  it('uses deterministic scoring rules', () => {
    expect(pointsFor(false, 100)).toBe(0);
    expect(pointsFor(true, 0)).toBe(150);
    expect(pointsFor(true, 7500)).toBe(125);
    expect(pointsFor(true, 20000)).toBe(100);
  });

  it('matches two players with the same questions and scores real answers on the server', async () => {
    const { a, ca, cb } = await newPair();
    ca.send({ type: 'battle.queue.join', kind: 'vocabulary' });
    await ca.next('battle.queued');
    cb.send({ type: 'battle.queue.join', kind: 'vocabulary' });
    const sa = await ca.next('battle.start');
    const sb = await cb.next('battle.start');
    expect(sa.questions).toEqual(sb.questions);
    expect(sa.questions).toHaveLength(10);
    expect(JSON.stringify(sa.questions)).not.toContain('"answer"');
    await new Promise((r) => setTimeout(r, sa.startsAt - Date.now() + 50));
    const [battle] = await db.select().from(schema.battles).where(eq(schema.battles.id, sa.battleId));
    for (let i = 0; i < 10; i++) {
      // Player A always answers correctly; B always picks a wrong option.
      ca.send({ type: 'battle.answer', battleId: sa.battleId, index: i, choice: battle.questions[i].answer });
      const ra = await ca.next('battle.answer_result');
      expect(ra.correct).toBe(true);
      cb.send({ type: 'battle.answer', battleId: sb.battleId, index: i, choice: sb.questions[i].options.find((o) => o !== battle.questions[i].answer) });
      const rb = await cb.next('battle.answer_result');
      expect(rb.correct).toBe(false);
      expect(rb.points).toBe(0);
      await new Promise((r) => setTimeout(r, 850));
    }
    const ea = await ca.next('battle.end', 10000);
    const eb = await cb.next('battle.end', 10000);
    expect(ea.results.outcome).toBe('win');
    expect(eb.results.outcome).toBe('loss');
    expect(ea.results.you).toBeGreaterThanOrEqual(1000);
    expect(eb.results.you).toBe(0);
    const hist = await call(a, 'GET', '/api/battles/history');
    expect(hist.json.battles[0].outcome).toBe('win');
    ca.close();
    cb.close();
  }, 30000);
});
