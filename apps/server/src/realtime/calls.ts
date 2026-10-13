import type pg from 'pg';
import {
  CEFR_LEVELS,
  findTopic,
  type CallInfo,
  type CallHistoryItem,
  type IceServer,
  type IeltsCallScript,
  type PracticeMode,
} from '@app/shared';
import { config } from '../config';
import { one, q, tx, pool } from '../db/pool';
import { turnCredentials } from '../lib/crypto';
import { HttpError } from '../lib/errors';
import { recordActivity } from '../services/activity';
import { checkDailyAvailable, FREE_TOPIC_IDS, getPlanId, getPlanLimits } from '../services/entitlements';
import { ageFromBirthYear } from '../services/users';
import { deliverToUser } from './hub';

const MATCH_LOCK = 4242;
const SWEEP_LOCK = 4243;
const CONNECT_TIMEOUT_SEC = 45;
const DISCONNECT_GRACE_SEC = 20;
const QUEUE_MAX_WAIT_SEC = 10 * 60;

const joinHistory = new Map<string, number[]>();

export function iceServersFor(userId: string): IceServer[] {
  const servers: IceServer[] = [];
  if (config.stunUrls.length) servers.push({ urls: config.stunUrls });
  const turn = turnCredentials(userId);
  if (turn) servers.push({ urls: config.turnUrls, username: turn.username, credential: turn.credential });
  return servers;
}

function callErr(code: string, message: string) {
  return new HttpError(400, code, message);
}

/** Validates eligibility and places the user in the matching queue. */
export async function joinQueue(
  userId: string,
  input: { mode: PracticeMode; topicId: string; levelPreference?: 'similar' | 'any' | 'higher' },
): Promise<void> {
  // Rate limit: at most 8 join requests per minute per user.
  const now = Date.now();
  const hist = (joinHistory.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (hist.length >= 8) throw new HttpError(429, 'rate_limited', 'Too many matching requests. Please wait a minute and try again.');
  hist.push(now);
  joinHistory.set(userId, hist);

  const u = await one<any>(
    `SELECT u.suspended_until, u.suspension_reason, u.birth_year, p.cefr_level
     FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.id=$1`,
    [userId],
  );
  if (!u) throw callErr('not_found', 'Account not found.');
  if (u.suspended_until && new Date(u.suspended_until) > new Date()) {
    throw new HttpError(403, 'suspended', `Speaking calls are paused on your account until ${new Date(u.suspended_until).toUTCString()}.`);
  }
  const age = ageFromBirthYear(u.birth_year);
  if (age === null) throw new HttpError(403, 'age_required', 'Please confirm your birth year in your profile before joining live calls.');
  if (age < config.callingMinimumAge) {
    throw new HttpError(403, 'age_restricted', `Live calls with other learners are available to users aged ${config.callingMinimumAge}+. You can still practise speaking with AI.`);
  }
  const active = await one('SELECT call_id FROM user_active_calls WHERE user_id=$1', [userId]);
  if (active) throw callErr('already_in_call', 'You are already in a call. End it before finding a new partner.');

  const topic = findTopic(input.topicId);
  if (!topic) throw callErr('invalid_topic', 'Unknown conversation topic.');
  if (topic.mode !== 'any' && topic.mode !== input.mode) throw callErr('invalid_topic', 'That topic does not belong to this practice mode.');

  const plan = await getPlanId(userId);
  const limits = await getPlanLimits(plan);
  if (input.mode === 'ielts_speaking' && !limits.ieltsSpeakingMode) {
    throw new HttpError(402, 'premium_required', 'IELTS Speaking partner mode is part of Premium.');
  }
  if (!FREE_TOPIC_IDS.has(topic.id) && !limits.premiumTopics) {
    throw new HttpError(402, 'premium_required', `The "${topic.label}" topic is part of Premium. Choose a free topic or upgrade.`);
  }
  const pref = input.levelPreference ?? 'similar';
  if (pref !== 'similar' && !limits.matchingPreferences) {
    throw new HttpError(402, 'premium_required', 'Matching preferences are part of Premium.');
  }
  const avail = await checkDailyAvailable(userId, 'calls');
  if (!avail.ok) {
    throw new HttpError(402, 'limit_reached', `You have completed ${avail.used} of ${avail.limit} calls included today. Upgrade to Premium for more calls, or come back tomorrow.`);
  }

  const levelIdx = u.cefr_level ? CEFR_LEVELS.indexOf(u.cefr_level) : null;
  await q(
    `INSERT INTO match_queue (user_id, mode, topic_id, level_idx, level_preference, priority, joined_at)
     VALUES ($1,$2,$3,$4,$5,$6, now())
     ON CONFLICT (user_id) DO UPDATE SET mode=EXCLUDED.mode, topic_id=EXCLUDED.topic_id, level_idx=EXCLUDED.level_idx,
       level_preference=EXCLUDED.level_preference, priority=EXCLUDED.priority, joined_at=now()`,
    [userId, input.mode, topic.id, levelIdx, pref, limits.priorityMatching],
  );
  deliverToUser(userId, { t: 'match.status', status: 'queued', queuedAt: new Date().toISOString(), levelRange: 1 });
  void runMatcher();
}

export async function leaveQueue(userId: string, notify = true): Promise<void> {
  const rows = await q('DELETE FROM match_queue WHERE user_id=$1 RETURNING user_id', [userId]);
  if (notify) deliverToUser(userId, { t: 'match.status', status: rows.length ? 'cancelled' : 'idle' });
}

interface QueueEntry {
  user_id: string;
  mode: PracticeMode;
  topic_id: string;
  level_idx: number | null;
  level_preference: 'similar' | 'any' | 'higher';
  priority: boolean;
  joined_at: Date;
}

function allowedDiff(e: QueueEntry, nowMs: number): number {
  if (e.level_preference === 'any') return 5;
  const wait = (nowMs - e.joined_at.getTime()) / 1000;
  return Math.min(5, 1 + Math.floor(wait / 15));
}

export function pairScore(
  a: QueueEntry,
  b: QueueEntry,
  nowMs: number,
  blocked: (x: string, y: string) => boolean,
  recentlyPaired: (x: string, y: string) => boolean,
): number | null {
  if (a.user_id === b.user_id) return null;
  if (a.mode !== b.mode) return null;
  if (blocked(a.user_id, b.user_id)) return null;
  const topicExact = a.topic_id === b.topic_id;
  if (a.mode === 'free_talk' && !topicExact && a.topic_id !== 'random' && b.topic_id !== 'random') return null;
  const la = a.level_idx ?? 2;
  const lb = b.level_idx ?? 2;
  const diff = Math.abs(la - lb);
  if (diff > allowedDiff(a, nowMs) || diff > allowedDiff(b, nowMs)) return null;
  if (a.level_preference === 'higher' && lb < la) return null;
  if (b.level_preference === 'higher' && la < lb) return null;
  let score = diff * 10 + (topicExact ? 0 : 3);
  if (recentlyPaired(a.user_id, b.user_id)) {
    const waitA = (nowMs - a.joined_at.getTime()) / 1000;
    const waitB = (nowMs - b.joined_at.getTime()) / 1000;
    if (waitA < 20 || waitB < 20) return null; // avoid immediately re-matching the same person
    score += 20;
  }
  return score;
}

let matcherRunning = false;
let matcherAgain = false;
let lastStatusBroadcast = 0;

/** Pairs compatible queued users. Single-flight per instance and serialised across instances via an advisory lock. */
export async function runMatcher(): Promise<void> {
  if (matcherRunning) {
    matcherAgain = true;
    return;
  }
  matcherRunning = true;
  try {
    do {
      matcherAgain = false;
      const created = await tx(async (c) => {
        const lock = await one<{ ok: boolean }>('SELECT pg_try_advisory_xact_lock($1) AS ok', [MATCH_LOCK], c);
        if (!lock?.ok) return [];
        const entries = await q<QueueEntry>(
          `SELECT * FROM match_queue WHERE user_id NOT IN (SELECT user_id FROM user_active_calls)
           ORDER BY priority DESC, joined_at ASC FOR UPDATE`,
          [],
          c,
        );
        if (entries.length < 2) return [];
        const ids = entries.map((e) => e.user_id);
        const blocks = await q<{ blocker_id: string; blocked_id: string }>(
          'SELECT blocker_id, blocked_id FROM user_blocks WHERE blocker_id = ANY($1) AND blocked_id = ANY($1)',
          [ids],
          c,
        );
        const blockSet = new Set(blocks.map((b) => `${b.blocker_id}:${b.blocked_id}`));
        const recent = await q<{ a: string; b: string }>(
          `SELECT p1.user_id AS a, p2.user_id AS b FROM call_participants p1
           JOIN call_participants p2 ON p1.call_id=p2.call_id AND p1.role<>p2.role
           JOIN call_sessions s ON s.id=p1.call_id
           WHERE p1.user_id = ANY($1) AND s.created_at > now() - interval '30 minutes'`,
          [ids],
          c,
        );
        const recentSet = new Set(recent.map((r) => `${r.a}:${r.b}`));
        const nowMs = Date.now();
        const used = new Set<string>();
        const pairs: [QueueEntry, QueueEntry][] = [];
        for (const a of entries) {
          if (used.has(a.user_id)) continue;
          let best: QueueEntry | null = null;
          let bestScore = Infinity;
          for (const b of entries) {
            if (b === a || used.has(b.user_id)) continue;
            const s = pairScore(
              a,
              b,
              nowMs,
              (x, y) => blockSet.has(`${x}:${y}`) || blockSet.has(`${y}:${x}`),
              (x, y) => recentSet.has(`${x}:${y}`),
            );
            if (s !== null && s < bestScore) {
              best = b;
              bestScore = s;
            }
          }
          if (best) {
            used.add(a.user_id);
            used.add(best.user_id);
            pairs.push([a, best]);
          }
        }
        const out: string[] = [];
        for (const [a, b] of pairs) {
          await c.query('SAVEPOINT pair');
          try {
            out.push(await createCall(c, a, b));
            await c.query('RELEASE SAVEPOINT pair');
          } catch (e) {
            await c.query('ROLLBACK TO SAVEPOINT pair');
            console.warn('pair creation failed', (e as Error).message);
          }
        }
        return out;
      });
      for (const callId of created) await announceCall(callId);
      await broadcastQueueStatus();
    } while (matcherAgain);
  } catch (e) {
    console.error('matcher error', e);
  } finally {
    matcherRunning = false;
  }
}

async function buildIeltsScript(c: pg.PoolClient): Promise<IeltsCallScript | null> {
  const p1 = await one<any>(`SELECT topic, questions FROM speaking_prompts WHERE part=1 AND status='published' ORDER BY random() LIMIT 1`, [], c);
  const p2 = await one<any>(`SELECT text, bullets, group_key FROM speaking_prompts WHERE part=2 AND status='published' ORDER BY random() LIMIT 1`, [], c);
  if (!p1 || !p2) return null;
  const p3 =
    (await one<any>(`SELECT questions FROM speaking_prompts WHERE part=3 AND group_key=$1 LIMIT 1`, [p2.group_key], c)) ??
    (await one<any>(`SELECT questions FROM speaking_prompts WHERE part=3 ORDER BY random() LIMIT 1`, [], c));
  return {
    part1: { topic: p1.topic, questions: p1.questions.slice(0, 5) },
    part2: { cueCard: p2.text, bullets: p2.bullets, prepSeconds: 60, speakSeconds: 120 },
    part3: { questions: (p3?.questions ?? []).slice(0, 5) },
  };
}

async function createCall(c: pg.PoolClient, a: QueueEntry, b: QueueEntry): Promise<string> {
  const users = await q<any>(
    `SELECT u.id, u.anon_name, u.avatar, p.cefr_level, p.show_level_to_partners FROM users u
     JOIN user_profiles p ON p.user_id=u.id WHERE u.id = ANY($1)`,
    [[a.user_id, b.user_id]],
    c,
  );
  const ua = users.find((u) => u.id === a.user_id);
  const ub = users.find((u) => u.id === b.user_id);
  if (!ua || !ub) throw new Error('user vanished');
  const [la, lb] = await Promise.all([getPlanLimits(await getPlanId(a.user_id, c), c), getPlanLimits(await getPlanId(b.user_id, c), c)]);
  const maxSec = Math.min(la.maxCallMinutes, lb.maxCallMinutes) * 60;
  const topicId = a.topic_id === 'random' ? b.topic_id : a.topic_id;
  const script = a.mode === 'ielts_speaking' ? await buildIeltsScript(c) : null;
  const call = await one<{ id: string }>(
    `INSERT INTO call_sessions (mode, topic_id, max_duration_sec, ielts_script) VALUES ($1,$2,$3,$4) RETURNING id`,
    [a.mode, topicId, maxSec, script],
    c,
  );
  const callId = call!.id;
  // Primary key on user_active_calls guarantees nobody holds two active calls.
  await c.query('INSERT INTO user_active_calls (user_id, call_id) VALUES ($1,$3),($2,$3)', [a.user_id, b.user_id, callId]);
  for (const [entry, u, role] of [
    [a, ua, 'offerer'],
    [b, ub, 'answerer'],
  ] as const) {
    await c.query(
      `INSERT INTO call_participants (call_id, user_id, role, anon_name, avatar, level) VALUES ($1,$2,$3,$4,$5,$6)`,
      [callId, entry.user_id, role, u.anon_name, u.avatar, u.show_level_to_partners ? u.cefr_level : null],
    );
  }
  await c.query('DELETE FROM match_queue WHERE user_id = ANY($1)', [[a.user_id, b.user_id]]);
  return callId;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function callInfoFor(callId: string, userId: string): Promise<CallInfo | null> {
  const call = await one<any>('SELECT * FROM call_sessions WHERE id=$1', [callId]);
  if (!call) return null;
  const parts = await q<any>('SELECT * FROM call_participants WHERE call_id=$1', [callId]);
  const me = parts.find((p) => p.user_id === userId);
  const partner = parts.find((p) => p.user_id !== userId);
  if (!me || !partner) return null;
  const topic = findTopic(call.topic_id);
  return {
    id: callId,
    mode: call.mode,
    topicId: call.topic_id,
    topicLabel: topic?.label ?? 'Conversation',
    role: me.role,
    partner: { anonName: partner.anon_name, avatar: partner.avatar, level: partner.level },
    iceServers: iceServersFor(userId),
    maxDurationSec: call.max_duration_sec,
    prompts: shuffle(topic?.prompts ?? []),
    ielts: call.ielts_script ?? undefined,
    matchedAt: new Date(call.created_at).toISOString(),
  };
}

async function announceCall(callId: string) {
  const parts = await q<{ user_id: string }>('SELECT user_id FROM call_participants WHERE call_id=$1', [callId]);
  for (const p of parts) {
    const info = await callInfoFor(callId, p.user_id);
    if (info) deliverToUser(p.user_id, { t: 'match.found', call: info });
  }
}

async function broadcastQueueStatus(force = false) {
  const now = Date.now();
  if (!force && now - lastStatusBroadcast < 3000) return;
  lastStatusBroadcast = now;
  const rows = await q<QueueEntry>('SELECT * FROM match_queue');
  for (const r of rows) {
    const others = rows.filter((x) => x.user_id !== r.user_id && x.mode === r.mode).length;
    deliverToUser(r.user_id, {
      t: 'match.status',
      status: 'queued',
      queuedAt: r.joined_at.toISOString(),
      waitingCount: others,
      levelRange: allowedDiff(r, now),
    });
  }
}

async function participant(callId: string, userId: string) {
  return one<any>(
    `SELECT p.*, s.status AS call_status FROM call_participants p JOIN call_sessions s ON s.id=p.call_id
     WHERE p.call_id=$1 AND p.user_id=$2`,
    [callId, userId],
  );
}

async function partnerOf(callId: string, userId: string): Promise<string | null> {
  const r = await one<{ user_id: string }>('SELECT user_id FROM call_participants WHERE call_id=$1 AND user_id<>$2', [callId, userId]);
  return r?.user_id ?? null;
}

const ACTIVE = new Set(['matched', 'connected']);

export async function relaySignal(userId: string, callId: string, data: unknown) {
  const p = await participant(callId, userId);
  if (!p || !ACTIVE.has(p.call_status)) return;
  if (JSON.stringify(data ?? null).length > 16_000) return;
  const partner = await partnerOf(callId, userId);
  if (partner) deliverToUser(partner, { t: 'call.signal', callId, data });
}

export async function relayIeltsStep(userId: string, callId: string, step: unknown) {
  const p = await participant(callId, userId);
  if (!p || !ACTIVE.has(p.call_status)) return;
  const partner = await partnerOf(callId, userId);
  if (partner) deliverToUser(partner, { t: 'call.ielts', callId, step: step as any });
}

export async function mediaState(userId: string, callId: string, state: 'connected' | 'disconnected' | 'failed') {
  const p = await participant(callId, userId);
  if (!p || !ACTIVE.has(p.call_status)) return;
  const partner = await partnerOf(callId, userId);
  if (state === 'connected') {
    const connected = await tx(async (c) => {
      await c.query('SELECT 1 FROM call_sessions WHERE id=$1 FOR UPDATE', [callId]);
      await c.query(
        'UPDATE call_participants SET media_connected_at = COALESCE(media_connected_at, now()) WHERE call_id=$1 AND user_id=$2',
        [callId, userId],
      );
      const both = await one<{ n: number }>(
        'SELECT count(*)::int AS n FROM call_participants WHERE call_id=$1 AND media_connected_at IS NOT NULL',
        [callId],
        c,
      );
      if (both!.n === 2) {
        return one<{ connected_at: Date; users: string[] }>(
          `UPDATE call_sessions SET status='connected', connected_at=now() WHERE id=$1 AND status='matched'
           RETURNING connected_at`,
          [callId],
          c,
        );
      }
      return null;
    });
    if (connected) {
      const users = await q<{ user_id: string }>('SELECT user_id FROM call_participants WHERE call_id=$1', [callId]);
      for (const u of users) {
        // Count the call against the daily allowance once audio is actually flowing.
        await q(
          `INSERT INTO usage_counters (user_id, day, key, count) VALUES ($1, current_date, 'calls', 1)
           ON CONFLICT (user_id, day, key) DO UPDATE SET count = usage_counters.count + 1`,
          [u.user_id],
        );
        deliverToUser(u.user_id, { t: 'call.connected', callId, connectedAt: connected.connected_at.toISOString() });
      }
    } else if (partner && p.call_status === 'connected') {
      deliverToUser(partner, { t: 'call.partner_state', callId, state: 'connected' });
    }
  } else if (partner) {
    deliverToUser(partner, { t: 'call.partner_state', callId, state: 'reconnecting' });
  }
}

export async function setMuted(userId: string, callId: string, muted: boolean) {
  const p = await participant(callId, userId);
  if (!p || !ACTIVE.has(p.call_status)) return;
  await q('UPDATE call_participants SET muted=$3 WHERE call_id=$1 AND user_id=$2', [callId, userId, muted]);
  const partner = await partnerOf(callId, userId);
  if (partner) deliverToUser(partner, { t: 'call.partner_mute', callId, muted });
}

export function classifyCall(connectedAt: Date | null, durationSec: number, reason: string | null): CallHistoryItem['status'] {
  if (connectedAt) return durationSec >= 60 ? 'completed' : 'short';
  if (reason === 'hangup' || reason === 'blocked' || reason === 'client_reset') return 'cancelled';
  return 'failed';
}

/** Ends a call exactly once (row lock + status check), frees both users, and notifies them. */
export async function endCall(callId: string, reason: string, endedBy: string | null): Promise<void> {
  const ended = await tx(async (c) => {
    const call = await one<any>('SELECT * FROM call_sessions WHERE id=$1 FOR UPDATE', [callId], c);
    if (!call || !ACTIVE.has(call.status)) return null;
    const duration = call.connected_at ? Math.max(0, Math.round((Date.now() - new Date(call.connected_at).getTime()) / 1000)) : 0;
    const status = call.connected_at ? 'ended' : 'failed';
    await c.query(
      `UPDATE call_sessions SET status=$2, ended_at=now(), end_reason=$3, ended_by=$4, duration_sec=$5 WHERE id=$1`,
      [callId, status, reason, endedBy, Math.min(duration, call.max_duration_sec + 5)],
    );
    await c.query('UPDATE call_participants SET left_at=COALESCE(left_at, now()) WHERE call_id=$1', [callId]);
    await c.query('DELETE FROM user_active_calls WHERE call_id=$1', [callId]);
    const users = await q<{ user_id: string }>('SELECT user_id FROM call_participants WHERE call_id=$1 AND user_id IS NOT NULL', [callId], c);
    return { users: users.map((u) => u.user_id), duration: Math.min(duration, call.max_duration_sec + 5), connectedAt: call.connected_at, mode: call.mode, topic: call.topic_id };
  });
  if (!ended) return;
  const status = classifyCall(ended.connectedAt, ended.duration, reason);
  for (const u of ended.users) {
    // Tell each side whether the other person ended it.
    const r = endedBy && endedBy !== u && reason === 'hangup' ? 'partner_ended' : reason;
    deliverToUser(u, { t: 'call.ended', callId, reason: r, durationSec: ended.duration, status });
    if (ended.connectedAt) {
      await recordActivity(u, 'call', callId, { durationSec: ended.duration, mode: ended.mode, topic: ended.topic }).catch(() => undefined);
    }
  }
}

export async function userEndsCall(userId: string, callId: string, reason = 'hangup') {
  const p = await participant(callId, userId);
  if (!p) return;
  const allowed = new Set(['hangup', 'mic_denied', 'mic_error', 'connection_failed', 'client_reset']);
  await endCall(callId, allowed.has(reason) ? reason : 'hangup', userId);
}

/** Called after a socket authenticates: restores call/queue state for the user. */
export async function onUserConnected(userId: string) {
  const active = await one<{ call_id: string }>('SELECT call_id FROM user_active_calls WHERE user_id=$1', [userId]);
  if (!active) return;
  await q('UPDATE call_participants SET ws_disconnected_at=NULL WHERE call_id=$1 AND user_id=$2', [active.call_id, userId]);
  const info = await callInfoFor(active.call_id, userId);
  const call = await one<any>('SELECT connected_at FROM call_sessions WHERE id=$1', [active.call_id]);
  const partner = await one<any>('SELECT user_id, muted FROM call_participants WHERE call_id=$1 AND user_id<>$2', [active.call_id, userId]);
  if (info) {
    deliverToUser(userId, {
      t: 'call.resume',
      call: info,
      connectedAt: call?.connected_at ? new Date(call.connected_at).toISOString() : null,
      partnerMuted: !!partner?.muted,
    });
  }
  if (partner?.user_id) deliverToUser(partner.user_id, { t: 'call.partner_state', callId: active.call_id, state: 'online' });
}

/** Called when the user's last local socket closes. */
export async function onUserDisconnected(userId: string) {
  await q('DELETE FROM match_queue WHERE user_id=$1', [userId]);
  const active = await one<{ call_id: string }>('SELECT call_id FROM user_active_calls WHERE user_id=$1', [userId]);
  if (!active) return;
  await q('UPDATE call_participants SET ws_disconnected_at=now() WHERE call_id=$1 AND user_id=$2', [active.call_id, userId]);
  const partner = await partnerOf(active.call_id, userId);
  if (partner) deliverToUser(partner, { t: 'call.partner_state', callId: active.call_id, state: 'reconnecting' });
}

/** Periodic maintenance: timeouts, duration limits, abandoned sessions, stale queue entries. */
export async function sweep(): Promise<void> {
  const toEnd = await tx(async (c) => {
    const lock = await one<{ ok: boolean }>('SELECT pg_try_advisory_xact_lock($1) AS ok', [SWEEP_LOCK], c);
    if (!lock?.ok) return [] as { id: string; reason: string; by: string | null }[];
    const out: { id: string; reason: string; by: string | null }[] = [];
    const timeouts = await q<{ id: string }>(
      `SELECT id FROM call_sessions WHERE status='matched' AND created_at < now() - make_interval(secs => $1)`,
      [CONNECT_TIMEOUT_SEC],
      c,
    );
    timeouts.forEach((r) => out.push({ id: r.id, reason: 'connect_timeout', by: null }));
    const over = await q<{ id: string }>(
      `SELECT id FROM call_sessions WHERE status='connected' AND connected_at + make_interval(secs => max_duration_sec) < now()`,
      [],
      c,
    );
    over.forEach((r) => out.push({ id: r.id, reason: 'time_limit', by: null }));
    const gone = await q<{ call_id: string; user_id: string }>(
      `SELECT p.call_id, p.user_id FROM call_participants p JOIN call_sessions s ON s.id=p.call_id
       WHERE s.status IN ('matched','connected') AND p.ws_disconnected_at < now() - make_interval(secs => $1)`,
      [DISCONNECT_GRACE_SEC],
      c,
    );
    gone.forEach((r) => out.push({ id: r.call_id, reason: 'partner_disconnected', by: r.user_id }));
    const warn = await q<{ id: string; left: number }>(
      `UPDATE call_sessions SET warned_at=now()
       WHERE status='connected' AND warned_at IS NULL
         AND connected_at + make_interval(secs => max_duration_sec) < now() + interval '60 seconds'
       RETURNING id, EXTRACT(EPOCH FROM (connected_at + make_interval(secs => max_duration_sec) - now()))::int AS left`,
      [],
      c,
    );
    for (const w of warn) {
      const users = await q<{ user_id: string }>('SELECT user_id FROM call_participants WHERE call_id=$1', [w.id], c);
      users.forEach((u) => deliverToUser(u.user_id, { t: 'call.warning', callId: w.id, secondsLeft: Math.max(0, w.left) }));
    }
    const stale = await q<{ user_id: string }>(
      `DELETE FROM match_queue WHERE joined_at < now() - make_interval(secs => $1) RETURNING user_id`,
      [QUEUE_MAX_WAIT_SEC],
      c,
    );
    stale.forEach((s) =>
      deliverToUser(s.user_id, {
        t: 'match.status',
        status: 'idle',
        message: 'No partner was available for 10 minutes. Try again later or practise with AI meanwhile.',
      }),
    );
    return out;
  });
  for (const e of toEnd) await endCall(e.id, e.reason, e.by);
  await runMatcher();
}

export async function callHistory(userId: string, limit = 50): Promise<CallHistoryItem[]> {
  const rows = await q<any>(
    `SELECT s.id, s.mode, s.topic_id, s.status, s.end_reason, s.created_at, s.connected_at, s.duration_sec,
            me.feedback_rating AS my_rating, me.feedback_comment AS my_comment,
            other.anon_name AS partner_name, other.avatar AS partner_avatar, other.feedback_rating AS partner_rating
     FROM call_participants me
     JOIN call_sessions s ON s.id = me.call_id
     LEFT JOIN call_participants other ON other.call_id = me.call_id AND other.role <> me.role
     WHERE me.user_id = $1 AND s.status IN ('ended','failed')
     ORDER BY s.created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    mode: r.mode,
    topicLabel: findTopic(r.topic_id)?.label ?? r.topic_id,
    status: classifyCall(r.connected_at, r.duration_sec, r.end_reason),
    endReason: r.end_reason,
    startedAt: new Date(r.created_at).toISOString(),
    connectedAt: r.connected_at ? new Date(r.connected_at).toISOString() : null,
    durationSec: r.duration_sec,
    partner: r.partner_name ? { anonName: r.partner_name, avatar: r.partner_avatar } : null,
    myFeedback: r.my_rating ? { rating: r.my_rating, comment: r.my_comment } : null,
    partnerFeedbackRating: r.partner_rating ?? null,
  }));
}

export async function queueSnapshot() {
  return q('SELECT mode, count(*)::int AS waiting FROM match_queue GROUP BY mode');
}

export { pool };
