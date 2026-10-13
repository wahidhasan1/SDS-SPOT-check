import { and, eq, or } from 'drizzle-orm';
import { CALL_MODES, CALL_TOPICS, cefrIndex, type CallMode, type ClientMessage, type LevelPreference } from '@fluentpath/shared';
import { db, schema } from '../db';
import { randomAlias } from '../lib/alias';
import { logActivity, userTimezone } from '../services/activity';
import { canUse, consume } from '../services/entitlements';
import { on, onClose, send, type Conn } from './hub';
import { iceServersFor } from './ice';

export const ACCEPT_WINDOW_MS = 20_000;
export const RECONNECT_GRACE_MS = 20_000;

interface QueueEntry { conn: Conn; userId: string; mode: CallMode; topic: string; level: LevelPreference; cefr: string | null; showLevel: boolean; blocked: Set<string>; joinedAt: number }
interface Participant { userId: string; alias: string; conn: Conn | null; accepted: boolean; muted: boolean; graceTimer?: ReturnType<typeof setTimeout>; entry: QueueEntry }
interface Call { id: string; a: Participant; b: Participant; mode: CallMode; topic: string; state: 'pending' | 'live'; connectedAt: number | null; acceptTimer?: ReturnType<typeof setTimeout> }

const queue: QueueEntry[] = [];
const calls = new Map<string, Call>();
const userCall = new Map<string, string>(); // userId -> callId

const STARTERS: Record<string, string[]> = {
  any: ['What did you do last weekend?', 'What is something you are looking forward to?', 'Describe your hometown.'],
  'daily life': ['What does a typical day look like for you?', 'What is your morning routine?'],
  travel: ['What is the best trip you have ever taken?', 'Where would you like to travel next, and why?'],
  food: ['What is a traditional dish from your country?', 'Do you prefer cooking at home or eating out?'],
  technology: ['Which app do you use most every day?', 'Has technology made our lives better or worse?'],
  education: ['What was your favourite subject at school?', 'Should university be free for everyone?'],
  'work and careers': ['What is your dream job?', 'Would you prefer working from home or in an office?'],
  environment: ['What can individuals do to protect the environment?', 'Is your city clean and green?'],
  health: ['How do you stay healthy?', 'Is it easy to eat healthily where you live?'],
  'movies and books': ['What film or book would you recommend, and why?', 'Do you prefer films or books?'],
  sports: ['Do you play or watch any sports?', 'Should sport be compulsory at school?'],
  culture: ['What festival in your country do you enjoy most?', 'What is something visitors find surprising about your culture?'],
};
const IELTS_PROMPTS = ['Take turns: one person asks Part 1 questions about hometowns, then swap.', 'Part 2 practice: describe a place you love for 2 minutes while your partner listens.', 'Part 3 practice: discuss whether cities will be better places to live in the future.'];
const DEBATE = ['Statement: “Social media does more harm than good.” One of you agrees, the other disagrees.', 'Statement: “Homework should be banned.” Choose sides and give reasons.', 'Statement: “Everyone should learn to cook at school.” Discuss both sides.'];

function promptFor(mode: CallMode, topic: string) {
  const list = mode === 'ielts_speaking' ? IELTS_PROMPTS : mode === 'debate' ? DEBATE : STARTERS[topic] ?? STARTERS.any;
  return list[Math.floor(Math.random() * list.length)];
}

function err(conn: Conn, code: string, message: string) {
  send(conn, { type: 'error', code, message });
}

async function blockedSet(userId: string) {
  const rows = await db
    .select({ a: schema.blocks.blockerId, b: schema.blocks.blockedId })
    .from(schema.blocks)
    .where(or(eq(schema.blocks.blockerId, userId), eq(schema.blocks.blockedId, userId)));
  return new Set(rows.map((r) => (r.a === userId ? r.b : r.a)));
}

function compatible(x: QueueEntry, y: QueueEntry) {
  if (x.userId === y.userId) return false;
  if (x.mode !== y.mode) return false;
  if (x.topic !== 'any' && y.topic !== 'any' && x.topic !== y.topic) return false;
  if (x.blocked.has(y.userId) || y.blocked.has(x.userId)) return false;
  if ((x.level === 'similar' || y.level === 'similar') && x.cefr && y.cefr && Math.abs(cefrIndex(x.cefr) - cefrIndex(y.cefr)) > 1) return false;
  return true;
}

function leaveQueue(userId: string) {
  const i = queue.findIndex((q) => q.userId === userId);
  if (i >= 0) queue.splice(i, 1);
  return i >= 0;
}

function broadcastQueue() {
  queue.forEach((q, i) => send(q.conn, { type: 'call.queued', position: i + 1, waiting: queue.filter((x) => x.mode === q.mode).length }));
}

export function queueStats() {
  const byMode: Record<string, number> = {};
  for (const q of queue) byMode[q.mode] = (byMode[q.mode] ?? 0) + 1;
  return { waiting: queue.length, byMode, activeCalls: [...calls.values()].filter((c) => c.state === 'live').length };
}

async function tryMatch(entry: QueueEntry) {
  const partnerEntry = queue.find((q) => q !== entry && compatible(entry, q));
  if (!partnerEntry) return false;
  leaveQueue(entry.userId);
  leaveQueue(partnerEntry.userId);
  const topic = entry.topic !== 'any' ? entry.topic : partnerEntry.topic;
  const aliasA = randomAlias();
  let aliasB = randomAlias();
  while (aliasB === aliasA) aliasB = randomAlias();
  const [row] = await db
    .insert(schema.callSessions)
    .values({ userA: partnerEntry.userId, userB: entry.userId, aliasA, aliasB, mode: entry.mode, topic, status: 'matched' })
    .returning({ id: schema.callSessions.id });
  const call: Call = {
    id: row.id,
    // The person who waited longer is "a" (the WebRTC offerer).
    a: { userId: partnerEntry.userId, alias: aliasA, conn: partnerEntry.conn, accepted: false, muted: false, entry: partnerEntry },
    b: { userId: entry.userId, alias: aliasB, conn: entry.conn, accepted: false, muted: false, entry },
    mode: entry.mode,
    topic,
    state: 'pending',
    connectedAt: null,
  };
  calls.set(call.id, call);
  userCall.set(call.a.userId, call.id);
  userCall.set(call.b.userId, call.id);
  const prompt = promptFor(call.mode, topic);
  const expiresAt = Date.now() + ACCEPT_WINDOW_MS;
  for (const [me, other] of [[call.a, call.b], [call.b, call.a]] as const) {
    send(me.conn!, {
      type: 'call.matched',
      callId: call.id,
      partnerAlias: other.alias,
      partnerLevel: other.entry.showLevel ? other.entry.cefr : null,
      mode: call.mode,
      topic,
      prompt,
      expiresAt,
    });
  }
  call.acceptTimer = setTimeout(() => expire(call.id), ACCEPT_WINDOW_MS);
  broadcastQueue();
  return true;
}

async function expire(callId: string) {
  const call = calls.get(callId);
  if (!call || call.state !== 'pending') return;
  await db.update(schema.callSessions).set({ status: 'expired', endReason: 'not_accepted', endedAt: new Date() }).where(eq(schema.callSessions.id, callId));
  cleanup(call);
  for (const p of [call.a, call.b]) {
    if (!p.conn) continue;
    if (p.accepted) {
      // The partner did not answer: put the waiting user straight back in the queue.
      send(p.conn, { type: 'call.declined', callId, byYou: false });
      await requeue(p);
    } else {
      send(p.conn, { type: 'call.ended', callId, reason: 'not_accepted', durationSec: 0 });
    }
  }
}

async function requeue(p: Participant) {
  if (!p.conn || userCall.has(p.userId) || queue.some((q) => q.userId === p.userId)) return;
  const entry = { ...p.entry, conn: p.conn, joinedAt: Date.now(), blocked: await blockedSet(p.userId) };
  queue.push(entry);
  if (!(await tryMatch(entry))) broadcastQueue();
}

function cleanup(call: Call) {
  clearTimeout(call.acceptTimer);
  clearTimeout(call.a.graceTimer);
  clearTimeout(call.b.graceTimer);
  calls.delete(call.id);
  if (userCall.get(call.a.userId) === call.id) userCall.delete(call.a.userId);
  if (userCall.get(call.b.userId) === call.id) userCall.delete(call.b.userId);
}

function sides(call: Call, userId: string) {
  return call.a.userId === userId ? { me: call.a, other: call.b } : call.b.userId === userId ? { me: call.b, other: call.a } : null;
}

async function start(call: Call) {
  clearTimeout(call.acceptTimer);
  call.state = 'live';
  for (const p of [call.a, call.b]) {
    try {
      await consume(p.userId, 'voice_call', await userTimezone(p.userId));
    } catch {
      /* limit was checked when joining the queue; do not interrupt an accepted call */
    }
  }
  await db.update(schema.callSessions).set({ status: 'active' }).where(eq(schema.callSessions.id, call.id));
  sendStart(call);
}

function sendStart(call: Call) {
  send(call.a.conn!, { type: 'call.start', callId: call.id, role: 'offerer', iceServers: iceServersFor(call.a.userId), partnerAlias: call.b.alias });
  send(call.b.conn!, { type: 'call.start', callId: call.id, role: 'answerer', iceServers: iceServersFor(call.b.userId), partnerAlias: call.a.alias });
}

export async function endCall(callId: string, reason: string, endedBy: string | null) {
  const call = calls.get(callId);
  if (!call) return;
  cleanup(call);
  const durationSec = call.connectedAt ? Math.round((Date.now() - call.connectedAt) / 1000) : 0;
  await db
    .update(schema.callSessions)
    .set({ status: call.state === 'live' ? 'ended' : 'declined', endReason: reason, endedBy, endedAt: new Date(), durationSec })
    .where(eq(schema.callSessions.id, callId));
  for (const p of [call.a, call.b]) {
    const personal = reason === 'partner_disconnected' && p.userId === endedBy ? 'you_disconnected' : reason;
    if (p.conn) send(p.conn, { type: 'call.ended', callId, reason: personal, durationSec });
    if (durationSec > 0) {
      const other = p === call.a ? call.b : call.a;
      await logActivity(p.userId, { type: 'call', title: `Voice practice with ${other.alias} (${Math.floor(durationSec / 60)} min ${durationSec % 60} s)`, refId: callId, xp: Math.min(60, 5 + Math.floor(durationSec / 30) * 2), minutes: durationSec / 60 });
    }
  }
}

export function registerCallHandlers() {
  on('call.', async (conn, msg: ClientMessage) => {
    const userId = conn.user.id;
    switch (msg.type) {
      case 'call.queue.join': {
        if (!CALL_MODES.some((m) => m.id === msg.mode)) return err(conn, 'bad_mode', 'Unknown practice mode.');
        if (!(CALL_TOPICS as readonly string[]).includes(msg.topic)) return err(conn, 'bad_topic', 'Unknown topic.');
        if (userCall.has(userId)) return err(conn, 'already_in_call', 'You are already in a call (maybe in another tab).');
        if (queue.some((q) => q.userId === userId)) return err(conn, 'already_queued', 'You are already looking for a partner (maybe in another tab).');
        const [settings] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
        if (settings && !settings.allowCalls) return err(conn, 'calls_disabled', 'Voice calls are turned off in your privacy settings.');
        const [user] = await db.select({ status: schema.users.status }).from(schema.users).where(eq(schema.users.id, userId));
        if (user?.status !== 'active') return err(conn, 'account_inactive', 'Your account cannot make calls.');
        const tz = await userTimezone(userId);
        const allowance = await canUse(userId, 'voice_call', tz);
        if (!allowance.allowed) return err(conn, 'limit_reached', `You have used today’s ${allowance.limit} free calls. Upgrade to Premium for unlimited calls.`);
        const [profile] = await db.select({ cefr: schema.profiles.cefrLevel }).from(schema.profiles).where(eq(schema.profiles.userId, userId));
        const entry: QueueEntry = {
          conn,
          userId,
          mode: msg.mode,
          topic: msg.topic,
          level: msg.level === 'similar' ? 'similar' : 'any',
          cefr: profile?.cefr ?? null,
          showLevel: settings?.showLevelInCalls ?? true,
          blocked: await blockedSet(userId),
          joinedAt: Date.now(),
        };
        queue.push(entry);
        if (!(await tryMatch(entry))) broadcastQueue();
        return;
      }
      case 'call.queue.leave': {
        if (leaveQueue(userId)) send(conn, { type: 'call.queue.left' });
        broadcastQueue();
        return;
      }
      case 'call.accept': {
        const call = calls.get(msg.callId);
        const s = call && sides(call, userId);
        if (!call || !s || call.state !== 'pending') return err(conn, 'no_call', 'This match is no longer available.');
        s.me.accepted = true;
        s.me.conn = conn;
        if (s.other.accepted) await start(call);
        return;
      }
      case 'call.decline': {
        const call = calls.get(msg.callId);
        const s = call && sides(call, userId);
        if (!call || !s || call.state !== 'pending') return;
        cleanup(call);
        await db.update(schema.callSessions).set({ status: 'declined', endReason: 'declined', endedBy: userId, endedAt: new Date() }).where(eq(schema.callSessions.id, call.id));
        send(conn, { type: 'call.declined', callId: call.id, byYou: true });
        if (s.other.conn) {
          send(s.other.conn, { type: 'call.declined', callId: call.id, byYou: false });
          await requeue(s.other);
        }
        return;
      }
      case 'call.signal': {
        const call = calls.get(msg.callId);
        const s = call && sides(call, userId);
        if (!call || !s || call.state !== 'live') return;
        if (JSON.stringify(msg.data ?? null).length > 64_000) return err(conn, 'too_large', 'Signal too large.');
        if (s.other.conn) send(s.other.conn, { type: 'call.signal', callId: call.id, data: msg.data });
        return;
      }
      case 'call.connected': {
        const call = calls.get(msg.callId);
        if (!call || !sides(call, userId) || call.state !== 'live') return;
        if (!call.connectedAt) {
          call.connectedAt = Date.now();
          await db.update(schema.callSessions).set({ connectedAt: new Date() }).where(eq(schema.callSessions.id, call.id));
        }
        return;
      }
      case 'call.mute': {
        const call = calls.get(msg.callId);
        const s = call && sides(call, userId);
        if (!call || !s) return;
        s.me.muted = Boolean(msg.muted);
        if (s.other.conn) send(s.other.conn, { type: 'call.partner_mute', callId: call.id, muted: s.me.muted });
        return;
      }
      case 'call.end': {
        const call = calls.get(msg.callId);
        if (!call || !sides(call, userId)) return;
        await endCall(call.id, msg.reason === 'connection_failed' ? 'connection_failed' : 'hung_up', userId);
        return;
      }
      case 'call.rejoin': {
        const call = calls.get(msg.callId);
        const s = call && sides(call, userId);
        if (!call || !s || call.state !== 'live') return send(conn, { type: 'call.ended', callId: msg.callId, reason: 'not_found', durationSec: 0 });
        clearTimeout(s.me.graceTimer);
        s.me.conn = conn;
        if (s.other.conn) {
          send(s.other.conn, { type: 'call.partner_status', callId: call.id, status: 'connected' });
          sendStart(call); // both sides rebuild their peer connection
        }
        return;
      }
      default:
        return err(conn, 'unknown_type', 'Unknown call message.');
    }
  });

  onClose(async (conn) => {
    const userId = conn.user.id;
    const qi = queue.findIndex((q) => q.conn === conn);
    if (qi >= 0) {
      queue.splice(qi, 1);
      broadcastQueue();
    }
    const callId = userCall.get(userId);
    const call = callId ? calls.get(callId) : undefined;
    const s = call && sides(call, userId);
    if (!call || !s || s.me.conn !== conn) return;
    s.me.conn = null;
    if (call.state === 'pending') {
      cleanup(call);
      await db.update(schema.callSessions).set({ status: 'declined', endReason: 'disconnected', endedAt: new Date() }).where(eq(schema.callSessions.id, call.id));
      if (s.other.conn) {
        send(s.other.conn, { type: 'call.declined', callId: call.id, byYou: false });
        if (s.other.accepted) await requeue(s.other);
      }
      return;
    }
    // Live call: give the user a short time to reconnect (e.g. network switch, page reload).
    if (s.other.conn) send(s.other.conn, { type: 'call.partner_status', callId: call.id, status: 'reconnecting' });
    s.me.graceTimer = setTimeout(() => endCall(call.id, 'partner_disconnected', userId), RECONNECT_GRACE_MS);
  });
}

/** Partner of a call from one participant's perspective (server-side only). */
export async function callPartner(callId: string, userId: string) {
  const [c] = await db
    .select()
    .from(schema.callSessions)
    .where(and(eq(schema.callSessions.id, callId), or(eq(schema.callSessions.userA, userId), eq(schema.callSessions.userB, userId))));
  if (!c) return null;
  return c.userA === userId ? { partnerId: c.userB, partnerAlias: c.aliasB, myAlias: c.aliasA, call: c } : { partnerId: c.userA, partnerAlias: c.aliasA, myAlias: c.aliasB, call: c };
}

export function activeCallOf(userId: string) {
  return userCall.get(userId) ?? null;
}

