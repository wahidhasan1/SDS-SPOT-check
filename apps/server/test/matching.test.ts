import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { AddressInfo } from 'node:net';
import { closeAll, getApp, newUser } from './setup';
import { pairScore } from '../src/realtime/calls';
import { q } from '../src/db/pool';

let base = '';
beforeAll(async () => {
  const app = await getApp();
  await app.listen({ port: 0, host: '127.0.0.1' });
  base = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/ws`;
});
afterAll(closeAll);

function client(token: string) {
  const ws = new WebSocket(base);
  const msgs: any[] = [];
  ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
  const ready = new Promise<void>((res) => ws.on('open', () => { ws.send(JSON.stringify({ t: 'auth', token })); setTimeout(res, 150); }));
  const waitFor = async (pred: (m: any) => boolean, ms = 4000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const m = msgs.find(pred);
      if (m) return m;
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  };
  return { ws, msgs, ready, waitFor, send: (m: any) => ws.send(JSON.stringify(m)) };
}

const entry = (over: Partial<any> = {}): any => ({ user_id: 'a', mode: 'free_talk', topic_id: 'random', level_idx: 2, level_preference: 'similar', priority: false, joined_at: new Date(), ...over });

describe('pair scoring rules', () => {
  const never = () => false;
  it('requires the same practice mode and compatible topics', () => {
    expect(pairScore(entry(), entry({ user_id: 'b', mode: 'ielts_speaking' }), Date.now(), never, never)).toBeNull();
    expect(pairScore(entry({ topic_id: 'travel' }), entry({ user_id: 'b', topic_id: 'food' }), Date.now(), never, never)).toBeNull();
    expect(pairScore(entry({ topic_id: 'travel' }), entry({ user_id: 'b', topic_id: 'random' }), Date.now(), never, never)).not.toBeNull();
  });
  it('never pairs blocked users', () => {
    expect(pairScore(entry(), entry({ user_id: 'b' }), Date.now(), () => true, never)).toBeNull();
  });
  it('starts with similar levels and widens the range as waiting time grows', () => {
    const now = Date.now();
    const a = entry({ level_idx: 0 });
    const b = entry({ user_id: 'b', level_idx: 3 });
    expect(pairScore(a, b, now, never, never)).toBeNull();
    const longWait = new Date(now - 60_000);
    expect(pairScore({ ...a, joined_at: longWait }, { ...b, joined_at: longWait }, now, never, never)).not.toBeNull();
  });
  it('avoids re-matching recent partners unless both have waited', () => {
    const now = Date.now();
    expect(pairScore(entry(), entry({ user_id: 'b' }), now, never, () => true)).toBeNull();
    const waited = new Date(now - 30_000);
    expect(pairScore(entry({ joined_at: waited }), entry({ user_id: 'b', joined_at: waited }), now, never, () => true)).not.toBeNull();
  });
});

describe('live matching over WebSockets', () => {
  it('matches two users once, prevents a second active call, and ends exactly once', async () => {
    const a = await newUser();
    const b = await newUser();
    const A = client(a.accessToken);
    const B = client(b.accessToken);
    await Promise.all([A.ready, B.ready]);
    A.send({ t: 'match.join', mode: 'free_talk', topicId: 'random' });
    B.send({ t: 'match.join', mode: 'free_talk', topicId: 'random' });
    const fa = await A.waitFor((m) => m.t === 'match.found');
    const fb = await B.waitFor((m) => m.t === 'match.found');
    expect(fa.call.id).toBe(fb.call.id);
    expect(new Set([fa.call.role, fb.call.role])).toEqual(new Set(['offerer', 'answerer']));
    expect(JSON.stringify(fa.call)).not.toContain(b.email); // anonymity: no private details
    A.send({ t: 'match.join', mode: 'free_talk', topicId: 'random' });
    expect(await A.waitFor((m) => m.t === 'error' && m.code === 'already_in_call')).not.toBeNull();
    // Not connected yet: no usage counted.
    const used = await q(`SELECT count FROM usage_counters WHERE user_id=$1 AND key='calls'`, [a.user.id]);
    expect(used.length).toBe(0);
    A.send({ t: 'call.end', callId: fa.call.id });
    B.send({ t: 'call.end', callId: fa.call.id });
    expect(await B.waitFor((m) => m.t === 'call.ended')).not.toBeNull();
    await new Promise((r) => setTimeout(r, 300));
    expect(A.msgs.filter((m) => m.t === 'call.ended')).toHaveLength(1);
    const rows = await q(`SELECT status FROM call_sessions WHERE id=$1`, [fa.call.id]);
    expect(rows[0].status).toBe('failed'); // ended before media connected
    A.ws.close();
    B.ws.close();
  });

  it('blocks under-18 users from live calls and enforces daily limits', async () => {
    const teen = await newUser({ birthYear: new Date().getFullYear() - 15 });
    const T = client(teen.accessToken);
    await T.ready;
    T.send({ t: 'match.join', mode: 'free_talk', topicId: 'random' });
    expect(await T.waitFor((m) => m.t === 'error' && m.code === 'age_restricted')).not.toBeNull();
    const u = await newUser();
    await q(`INSERT INTO usage_counters (user_id, day, key, count) VALUES ($1, current_date, 'calls', 3)`, [u.user.id]);
    const U = client(u.accessToken);
    await U.ready;
    U.send({ t: 'match.join', mode: 'free_talk', topicId: 'random' });
    expect(await U.waitFor((m) => m.t === 'error' && m.code === 'limit_reached')).not.toBeNull();
    U.send({ t: 'match.join', mode: 'free_talk', topicId: 'business' });
    expect(await U.waitFor((m) => m.t === 'error' && m.code === 'premium_required')).not.toBeNull();
    T.ws.close();
    U.ws.close();
  });

  it('auto-pauses an account after reports from three different users', async () => {
    const app = await getApp();
    const target = await newUser();
    for (let i = 0; i < 3; i++) {
      const reporter = await newUser();
      const R = client(reporter.accessToken);
      const X = client(target.accessToken);
      await Promise.all([R.ready, X.ready]);
      R.send({ t: 'match.join', mode: 'free_talk', topicId: 'random' });
      X.send({ t: 'match.join', mode: 'free_talk', topicId: 'random' });
      const f = await R.waitFor((m) => m.t === 'match.found');
      expect(f).not.toBeNull();
      const rep = await app.inject({ method: 'POST', url: '/safety/report', headers: reporter.auth, payload: { callId: f.call.id, reason: 'harassment', alsoBlock: true } });
      expect(rep.statusCode).toBe(200);
      await X.waitFor((m) => m.t === 'call.ended');
      R.ws.close();
      X.ws.close();
      await new Promise((r) => setTimeout(r, 200));
    }
    const u = await q(`SELECT suspended_until FROM users WHERE id=$1`, [target.user.id]);
    expect(new Date(u[0].suspended_until).getTime()).toBeGreaterThan(Date.now());
    const X = client(target.accessToken);
    await X.ready;
    X.send({ t: 'match.join', mode: 'free_talk', topicId: 'random' });
    expect(await X.waitFor((m) => m.t === 'error' && m.code === 'suspended')).not.toBeNull();
    X.ws.close();
  });
});
