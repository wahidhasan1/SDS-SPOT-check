import crypto from 'node:crypto'
import { CALL_TOPICS, CEFR_LEVELS, cefrIndex, type CallMode } from '../../shared/config.ts'
import { db, json } from '../db/index.ts'
import { env } from '../env.ts'
import { consume, entitlements, hasFlag, refund, usage } from '../lib/plans.ts'
import { HttpError, newId, now, shuffle } from '../lib/util.ts'
import { isAdult } from '../routes/me.ts'
import { audit, notify, recordActivity } from '../lib/events.ts'
import { type Client, clientsOf, findClient, onClose, onMessage, send } from './hub.ts'

// ---------------------------------------------------------------------------------------------
// Configuration (admin-editable via app_config key "matching")
// ---------------------------------------------------------------------------------------------
export const MATCHING_DEFAULTS = {
  baseLevelRange: 1, // start by matching within ±1 CEFR level
  widenEverySec: 15, // then widen by one level every N seconds of waiting
  maxLevelRange: 5, // …up to any level
  topicStrictSec: 20, // prefer the same topic for this long
  roleStrictSec: 30, // IELTS mode: prefer candidate + partner pairs for this long
  recentPartnerCount: 3, // avoid re-pairing with your last N partners…
  recentAvoidSec: 45, // …unless you have waited this long
  premiumHeadStartSec: 10, // premium priority: counted as having waited this much longer
  connectTimeoutSec: 30, // matched users must establish audio within this time
  reconnectGraceSec: 30, // a dropped participant can rejoin within this time
  maxStartsPer10Min: 20,
  earlyHangupsPerHour: 8, // more very short calls than this → short cooldown
  cooldownMin: 10,
  reportsForSuspension: 3, // distinct reporters within 7 days → calls paused pending review
}
export type MatchingConfig = typeof MATCHING_DEFAULTS
export const matchingConfig = (): MatchingConfig => ({
  ...MATCHING_DEFAULTS,
  ...json<Partial<MatchingConfig>>(db().one<{ value: string }>("SELECT value FROM app_config WHERE key = 'matching'")?.value, {}),
})

// ---------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------
type Role = 'candidate' | 'partner' | 'either'
type QueueEntry = {
  userId: string
  clientId: string
  mode: CallMode
  topic: string
  role: Role
  level: number
  gender: string | null
  genderPref: string | null
  premium: boolean
  joinedAt: number
  maxMinutes: number
  excluded: Set<string> // blocked in either direction
  recent: string[] // last partners
}
type Participant = { userId: string; clientId: string; role: string }
type Live = {
  id: string
  a: Participant
  b: Participant
  connected: Set<string>
  maxSeconds: number
  connectTimer?: NodeJS.Timeout
  warnTimer?: NodeJS.Timeout
  endTimer?: NodeJS.Timeout
  grace: Map<string, NodeJS.Timeout>
}

const queue = new Map<string, QueueEntry>()
const live = new Map<string, Live>()
const liveByUser = new Map<string, string>()
const starts = new Map<string, number[]>()

export const queueSize = (mode?: CallMode) => [...queue.values()].filter((e) => !mode || e.mode === mode).length
export const liveCallFor = (userId: string) => liveByUser.get(userId)
/** For tests. */
export const _state = { queue, live, liveByUser }

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------
const err = (code: string, message: string, extra?: Record<string, unknown>) => new HttpError(400, code, message, extra)
const other = (s: Live, userId: string) => (s.a.userId === userId ? s.b : s.a)
const me = (s: Live, userId: string) => (s.a.userId === userId ? s.a : s.b)

export function iceServers(userId: string) {
  const servers: { urls: string[]; username?: string; credential?: string }[] = [{ urls: env.stunUrls }]
  if (env.turnUrls.length && env.turnSecret) {
    // TURN REST API (coturn use-auth-secret): credentials valid for one hour, minted per user, never stored.
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${userId}`
    const credential = crypto.createHmac('sha1', env.turnSecret).update(username).digest('base64')
    servers.push({ urls: env.turnUrls, username, credential })
  }
  return servers
}

function partnerCard(userId: string) {
  const p = db().one<{ anon_name: string; avatar_icon: string; avatar_color: string; cefr_level: string | null; show_level_to_partners: number }>(
    'SELECT anon_name, avatar_icon, avatar_color, cefr_level, show_level_to_partners FROM profiles WHERE user_id = ?',
    userId,
  )!
  // Only the anonymous identity and (if the user allows it) their earned level. No email, name or id.
  return { anonName: p.anon_name, avatarIcon: p.avatar_icon, avatarColor: p.avatar_color, level: p.show_level_to_partners ? p.cefr_level : null }
}

function activeRestriction(userId: string) {
  return db().one<{ action: string; expires_at: number | null; reason: string }>(
    `SELECT action, expires_at, reason FROM moderation_actions
     WHERE user_id = ? AND action IN ('call_suspension','cooldown') AND (expires_at IS NULL OR expires_at > ?)
     AND NOT EXISTS (SELECT 1 FROM moderation_actions m2 WHERE m2.user_id = moderation_actions.user_id AND m2.action = 'lift' AND m2.created_at > moderation_actions.created_at)
     ORDER BY created_at DESC LIMIT 1`,
    userId,
    now(),
  )
}

function exclusionsOf(userId: string) {
  return new Set(
    db()
      .all<{ id: string }>('SELECT blocked_id AS id FROM blocks WHERE blocker_id = ?1 UNION SELECT blocker_id AS id FROM blocks WHERE blocked_id = ?1', userId)
      .map((r) => r.id),
  )
}

function recentPartners(userId: string, n: number) {
  return db()
    .all<{ p: string }>(
      `SELECT CASE WHEN user_a = ?1 THEN user_b ELSE user_a END AS p FROM call_sessions
       WHERE (user_a = ?1 OR user_b = ?1) AND created_at > ?2 ORDER BY created_at DESC LIMIT ?3`,
      userId,
      now() - 86400_000,
      n,
    )
    .map((r) => r.p)
    .filter(Boolean)
}

const speaking = () => JSON.parse(db().one<{ value: string }>("SELECT value FROM app_config WHERE key = 'call_prompts'")?.value ?? '{"part1":[],"part2":[],"casual":{}}') as {
  part1: { topic: string; questions: string[] }[]
  part2: { title: string; cue: string; points: string[]; explain: string; part3: string[] }[]
  casual: Record<string, string[]>
}

function buildPrompts(mode: CallMode, topic: string) {
  const s = speaking()
  if (mode === 'ielts') {
    if (topic === 'ielts-1') {
      const sets = shuffle(s.part1).slice(0, 2)
      return { kind: 'part1', sets: sets.map((x) => ({ title: x.topic, questions: x.questions })) }
    }
    const card = shuffle(s.part2)[0]
    if (topic === 'ielts-2') return { kind: 'part2', card: { title: card.title, cue: card.cue, points: card.points, explain: card.explain }, followUp: card.part3.slice(0, 2), prepSeconds: 60, speakSeconds: 120 }
    return { kind: 'part3', title: card.title, questions: card.part3 }
  }
  const key = topic in s.casual ? topic : shuffle(Object.keys(s.casual))[0]
  return { kind: 'casual', topic: key, questions: shuffle(s.casual[key] ?? []).slice(0, 6) }
}

// ---------------------------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------------------------
const CASUAL_TOPICS: string[] = CALL_TOPICS.filter((t) => !('ielts' in t)).map((t) => t.id)
const IELTS_TOPICS: string[] = CALL_TOPICS.filter((t) => 'ielts' in t).map((t) => t.id)
const flexible = (t: string) => t === 'random' || t === 'free'

/** Returns a penalty (lower is better) or null when the two queued users must not be paired yet. */
export function compatibility(x: QueueEntry, y: QueueEntry, cfg: MatchingConfig, at = now()): number | null {
  if (x.userId === y.userId || x.mode !== y.mode) return null
  if (x.excluded.has(y.userId) || y.excluded.has(x.userId)) return null
  if (x.genderPref && y.gender !== x.genderPref) return null
  if (y.genderPref && x.gender !== y.genderPref) return null
  const waited = Math.max(at - x.joinedAt + (x.premium ? cfg.premiumHeadStartSec * 1000 : 0), at - y.joinedAt + (y.premium ? cfg.premiumHeadStartSec * 1000 : 0)) / 1000
  const range = Math.min(cfg.maxLevelRange, cfg.baseLevelRange + Math.floor(waited / cfg.widenEverySec))
  const diff = Math.abs(x.level - y.level)
  if (diff > range) return null
  let penalty = diff * 2
  const sameTopic = x.topic === y.topic || (x.mode === 'casual' && (flexible(x.topic) || flexible(y.topic)))
  if (!sameTopic) {
    if (waited < cfg.topicStrictSec) return null
    penalty += 3
  }
  if (x.mode === 'ielts' && ((x.role === 'candidate' && y.role === 'candidate') || (x.role === 'partner' && y.role === 'partner'))) {
    if (waited < cfg.roleStrictSec) return null
    penalty += 2
  }
  if (x.recent.includes(y.userId) || y.recent.includes(x.userId)) {
    if (waited < cfg.recentAvoidSec) return null
    penalty += 5
  }
  return penalty
}

let ticking = false
/** Pairs waiting users. Synchronous end to end, so no user can be handed to two sessions. */
export function tick() {
  if (ticking) return
  ticking = true
  try {
    const cfg = matchingConfig()
    const at = now()
    // Longest (effective) wait first: fairness, with a small head start for premium users.
    const effectiveStart = (e: QueueEntry) => e.joinedAt - (e.premium ? cfg.premiumHeadStartSec * 1000 : 0)
    const order = [...queue.values()].sort((p, q) => effectiveStart(p) - effectiveStart(q))
    for (const x of order) {
      if (!queue.has(x.userId)) continue
      let best: QueueEntry | null = null
      let bestPenalty = Infinity
      for (const y of queue.values()) {
        const p = compatibility(x, y, cfg, at)
        if (p !== null && p < bestPenalty) {
          best = y
          bestPenalty = p
        }
      }
      if (best) pair(x, best)
    }
  } finally {
    ticking = false
  }
}
setInterval(tick, 1000).unref()

function resolveTopic(x: QueueEntry, y: QueueEntry) {
  if (x.mode === 'ielts') return x.topic === y.topic ? x.topic : shuffle([x.topic, y.topic])[0]
  if (!flexible(x.topic)) return x.topic
  if (!flexible(y.topic)) return y.topic
  if (x.topic === 'free' && y.topic === 'free') return 'free'
  return shuffle(CASUAL_TOPICS.filter((t) => !flexible(t)))[0]
}

function resolveRoles(x: QueueEntry, y: QueueEntry): [string, string] {
  if (x.mode !== 'ielts') return ['speaker', 'speaker']
  if (x.role === 'candidate' && y.role !== 'candidate') return ['candidate', 'examiner']
  if (y.role === 'candidate' && x.role !== 'candidate') return ['examiner', 'candidate']
  if (x.role === 'partner' && y.role !== 'partner') return ['examiner', 'candidate']
  if (y.role === 'partner' && x.role !== 'partner') return ['candidate', 'examiner']
  // Both wanted the same role: take turns, starting with a random candidate.
  return Math.random() < 0.5 ? ['candidate', 'examiner'] : ['examiner', 'candidate']
}

function pair(x: QueueEntry, y: QueueEntry) {
  const cx = findClient(x.userId, x.clientId)
  const cy = findClient(y.userId, y.clientId)
  if (!cx) return void queue.delete(x.userId)
  if (!cy) return void queue.delete(y.userId)
  let session: { id: string; topic: string; roles: [string, string]; prompts: unknown; maxSeconds: number }
  try {
    session = db().tx(() => {
      // Re-check everything inside the transaction: blocks made after joining, live sessions, limits.
      const liveRow = db().one("SELECT 1 FROM call_sessions WHERE status <> 'ended' AND (user_a IN (?1, ?2) OR user_b IN (?1, ?2))", x.userId, y.userId)
      if (liveRow || liveByUser.has(x.userId) || liveByUser.has(y.userId)) throw err('in_call', 'Already in a call.')
      if (exclusionsOf(x.userId).has(y.userId)) {
        x.excluded.add(y.userId)
        throw err('blocked', 'Blocked pair.')
      }
      consume(x.userId, 'callsPerDay', 'voice calls')
      consume(y.userId, 'callsPerDay', 'voice calls')
      const topic = resolveTopic(x, y)
      const roles = resolveRoles(x, y)
      const prompts = buildPrompts(x.mode, topic)
      const maxSeconds = Math.min(x.maxMinutes, y.maxMinutes) * 60
      const id = newId('call_')
      const px = partnerCard(x.userId)
      const py = partnerCard(y.userId)
      db().run(
        `INSERT INTO call_sessions (id, user_a, user_b, mode, topic, status, created_at, max_seconds, anon_a, anon_b, level_a, level_b, role_a, role_b, prompts)
         VALUES (?, ?, ?, ?, ?, 'connecting', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, x.userId, y.userId, x.mode, topic, now(), maxSeconds, px.anonName, py.anonName,
        CEFR_LEVELS[x.level] ?? null, CEFR_LEVELS[y.level] ?? null, roles[0], roles[1], JSON.stringify(prompts),
      )
      return { id, topic, roles, prompts, maxSeconds }
    })
  } catch (e) {
    const code = (e as HttpError).code
    if (code === 'limit_reached') {
      // One of the two ran out of calls in the meantime: drop them from the queue and tell them why.
      for (const [entry, client] of [[x, cx], [y, cy]] as const) {
        if (usage(entry.userId, 'callsPerDay').remaining <= 0) {
          queue.delete(entry.userId)
          send(client, { t: 'match.error', code: 'limit_reached', message: 'You have used all your voice calls for today.' })
        }
      }
    }
    return
  }
  queue.delete(x.userId)
  queue.delete(y.userId)
  const s: Live = {
    id: session.id,
    a: { userId: x.userId, clientId: x.clientId, role: session.roles[0] },
    b: { userId: y.userId, clientId: y.clientId, role: session.roles[1] },
    connected: new Set(),
    maxSeconds: session.maxSeconds,
    grace: new Map(),
  }
  live.set(s.id, s)
  liveByUser.set(x.userId, s.id)
  liveByUser.set(y.userId, s.id)
  const base = { t: 'match.found', sessionId: s.id, mode: x.mode, topic: session.topic, prompts: session.prompts, maxSeconds: s.maxSeconds }
  send(cx, { ...base, initiator: true, role: s.a.role, partner: { ...partnerCard(y.userId), role: s.b.role }, iceServers: iceServers(x.userId) })
  send(cy, { ...base, initiator: false, role: s.b.role, partner: { ...partnerCard(x.userId), role: s.a.role }, iceServers: iceServers(y.userId) })
  s.connectTimer = setTimeout(() => endCall(s.id, 'connection_failed', null), matchingConfig().connectTimeoutSec * 1000)
  s.connectTimer.unref()
}

// ---------------------------------------------------------------------------------------------
// Ending
// ---------------------------------------------------------------------------------------------
export type EndReason = 'hangup' | 'partner_left' | 'connection_failed' | 'time_limit' | 'blocked' | 'reported' | 'moderation' | 'server_restart'

export function endCall(sessionId: string, reason: EndReason, byUserId: string | null) {
  const s = live.get(sessionId)
  if (!s) return
  live.delete(sessionId)
  for (const p of [s.a, s.b]) if (liveByUser.get(p.userId) === sessionId) liveByUser.delete(p.userId)
  clearTimeout(s.connectTimer)
  clearTimeout(s.warnTimer)
  clearTimeout(s.endTimer)
  s.grace.forEach((t) => clearTimeout(t))

  const row = db().one<{ connected_at: number | null }>('SELECT connected_at FROM call_sessions WHERE id = ?', sessionId)
  const connected = !!row?.connected_at
  const duration = connected ? Math.round((now() - row!.connected_at!) / 1000) : 0
  db().tx(() => {
    db().run("UPDATE call_sessions SET status = 'ended', ended_at = ?, end_reason = ?, ended_by = ?, duration_s = ?, counted = ? WHERE id = ? AND status <> 'ended'", now(), reason, byUserId, duration, connected ? 1 : 0, sessionId)
    if (!connected) {
      // Calls that never connected don't use up anyone's daily allowance.
      refund(s.a.userId, 'callsPerDay')
      refund(s.b.userId, 'callsPerDay')
    }
  })
  if (connected && duration >= 60) {
    recordActivity(s.a.userId)
    recordActivity(s.b.userId)
  }
  for (const p of [s.a, s.b]) {
    const msg = { t: 'call.ended', sessionId, reason, endedBy: byUserId === null ? 'system' : byUserId === p.userId ? 'you' : 'partner', durationS: duration }
    const c = findClient(p.userId, p.clientId)
    if (c) send(c, msg)
    else clientsOf(p.userId).forEach((x) => send(x, msg))
  }
  if (byUserId && connected && duration < 15 && reason === 'hangup') checkEarlyHangups(byUserId)
}

function checkEarlyHangups(userId: string) {
  const cfg = matchingConfig()
  const n = db().one<{ n: number }>("SELECT COUNT(*) AS n FROM call_sessions WHERE ended_by = ? AND end_reason = 'hangup' AND duration_s < 15 AND ended_at > ?", userId, now() - 3600_000)!.n
  if (n >= cfg.earlyHangupsPerHour) {
    db().run("INSERT INTO moderation_actions (user_id, action, reason, actor, created_at, expires_at) VALUES (?, 'cooldown', 'Many very short calls in a short time', 'system', ?, ?)", userId, now(), now() + cfg.cooldownMin * 60_000)
    notify(userId, { kind: 'safety', title: 'Short break from calls', body: `You ended many calls within a few seconds. Calls are paused for ${cfg.cooldownMin} minutes so everyone gets a fair chance to practise.` })
  }
}

/** Called after reports: pauses calling for users reported by several different people. */
export function checkReports(reportedId: string) {
  const cfg = matchingConfig()
  const n = db().one<{ n: number }>("SELECT COUNT(DISTINCT reporter_id) AS n FROM reports WHERE reported_id = ? AND created_at > ? AND status <> 'dismissed'", reportedId, now() - 7 * 86400_000)!.n
  if (n >= cfg.reportsForSuspension && !activeRestriction(reportedId)) {
    db().run("INSERT INTO moderation_actions (user_id, action, reason, actor, created_at) VALUES (?, 'call_suspension', 'Several reports from different users; pending review', 'system', ?)", reportedId, now())
    audit(null, 'moderation.auto_suspend', reportedId, { reports: n })
    queue.delete(reportedId)
    const sid = liveByUser.get(reportedId)
    if (sid) endCall(sid, 'moderation', null)
    notify(reportedId, { kind: 'safety', title: 'Calls paused', body: 'Your voice calls are paused while our team reviews reports. Learning features are still available.' })
  }
}

// ---------------------------------------------------------------------------------------------
// Socket messages
// ---------------------------------------------------------------------------------------------
function startMatching(client: Client, msg: Record<string, unknown>) {
  const userId = client.user.id
  const mode = msg.mode === 'ielts' ? 'ielts' : 'casual'
  const topic = String(msg.topic ?? (mode === 'ielts' ? 'ielts-1' : 'random'))
  if (mode === 'ielts' ? !IELTS_TOPICS.includes(topic) : !CASUAL_TOPICS.includes(topic)) throw err('bad_topic', 'Please choose a topic from the list.')
  const role: Role = msg.role === 'candidate' || msg.role === 'partner' ? msg.role : 'either'

  if (client.user.status !== 'active') throw err('suspended', 'Your account is restricted. Voice calls are not available.')
  const p = db().one<{ cefr_level: string | null; birth_year: number | null; gender: string | null; voice_consent: number }>('SELECT cefr_level, birth_year, gender, voice_consent FROM profiles WHERE user_id = ?', userId)!
  if (!p.cefr_level) throw err('assessment_required', 'Finish the level check first so we can match you with the right partner.')
  if (!isAdult(p.birth_year)) throw err('age_restricted', 'Voice calls with strangers are only available to users aged 18 or over.')
  if (!p.voice_consent) throw err('guidelines_required', 'Please read and accept the community guidelines first.')
  const r = activeRestriction(userId)
  if (r) throw err(r.action === 'cooldown' ? 'cooldown' : 'call_suspended', r.action === 'cooldown' ? `Calls are paused until ${new Date(r.expires_at!).toLocaleTimeString()}.` : 'Your voice calls are paused while reports are reviewed.', { until: r.expires_at })
  const liveId = liveByUser.get(userId)
  if (liveId) throw err('in_call', 'You are already in a call.', { sessionId: liveId })

  const cfg = matchingConfig()
  const recentStarts = (starts.get(userId) ?? []).filter((t) => now() - t < 600_000)
  if (recentStarts.length >= cfg.maxStartsPer10Min) throw err('rate_limited', 'You have started matching many times. Please wait a few minutes.')
  starts.set(userId, [...recentStarts, now()])

  const u = usage(userId, 'callsPerDay')
  if (u.remaining <= 0) throw new HttpError(402, 'limit_reached', `You have used all ${u.limit} voice calls for today. Calls reset tomorrow, or upgrade for more.`)
  const ent = entitlements(userId)
  const genderPref = msg.genderPref === 'female' || msg.genderPref === 'male' ? msg.genderPref : null
  if (genderPref && !hasFlag(userId, 'genderPreference')) throw new HttpError(402, 'premium_required', 'Partner preferences are a Premium feature.')

  const prev = queue.get(userId)
  queue.set(userId, {
    userId,
    clientId: client.id,
    mode,
    topic,
    role,
    level: Math.max(0, cefrIndex(p.cefr_level)),
    gender: p.gender,
    genderPref,
    premium: ent.planId !== 'free',
    joinedAt: prev?.joinedAt ?? now(),
    maxMinutes: ent.limits.callMaxMinutes as number,
    excluded: exclusionsOf(userId),
    recent: recentPartners(userId, cfg.recentPartnerCount),
  })
  send(client, { t: 'match.searching', mode, topic, role, level: p.cefr_level, waiting: queueSize(mode) - 1 })
  tick()
}

function sessionFor(client: Client, msg: Record<string, unknown>) {
  const sid = String(msg.sessionId ?? '')
  const s = live.get(sid)
  if (!s || (s.a.userId !== client.user.id && s.b.userId !== client.user.id)) throw err('no_session', 'This call is no longer active.')
  return s
}

onMessage('match.', (client, msg) => {
  if (msg.t === 'match.start') return startMatching(client, msg)
  if (msg.t === 'match.cancel') {
    const e = queue.get(client.user.id)
    if (e) queue.delete(client.user.id)
    send(client, { t: 'match.cancelled' })
    return
  }
  throw err('unknown_type', 'Unknown matching message.')
})

const SYNC_KINDS = new Set(['prompt', 'timer', 'part', 'swap'])

onMessage('call.', (client, msg) => {
  const s = sessionFor(client, msg)
  const self = me(s, client.user.id)
  const peer = other(s, client.user.id)
  // Only the socket that owns the call may drive it (another tab of the same user can't hijack it).
  // Ending or rejoining is allowed from any of the user's sockets (e.g. after a page reload).
  if (msg.t !== 'call.resume' && msg.t !== 'call.end' && self.clientId !== client.id) throw err('wrong_device', 'This call is active on another tab or device.')
  const peerClient = findClient(peer.userId, peer.clientId)

  switch (msg.t) {
    case 'call.signal': {
      const data = msg.data as { type?: string } | undefined
      if (!data || !['offer', 'answer', 'candidate'].includes(String(data.type)) || JSON.stringify(data).length > 64_000) throw err('bad_signal', 'Invalid signalling data.')
      return send(peerClient, { t: 'call.signal', sessionId: s.id, data })
    }
    case 'call.connected': {
      s.connected.add(client.user.id)
      if (s.connected.size === 2) {
        clearTimeout(s.connectTimer)
        const row = db().one<{ connected_at: number | null }>('SELECT connected_at FROM call_sessions WHERE id = ?', s.id)
        if (!row?.connected_at) {
          const startedAt = now()
          db().run("UPDATE call_sessions SET status = 'active', connected_at = ? WHERE id = ?", startedAt, s.id)
          s.warnTimer = setTimeout(() => [s.a, s.b].forEach((p) => send(findClient(p.userId, p.clientId), { t: 'call.warning', sessionId: s.id, secondsLeft: 60 })), Math.max(0, s.maxSeconds - 60) * 1000)
          s.endTimer = setTimeout(() => endCall(s.id, 'time_limit', null), s.maxSeconds * 1000)
          for (const p of [s.a, s.b]) send(findClient(p.userId, p.clientId), { t: 'call.active', sessionId: s.id, elapsedMs: 0, maxSeconds: s.maxSeconds })
        }
      }
      return
    }
    case 'call.media':
      return send(peerClient, { t: 'call.partner_media', sessionId: s.id, muted: !!msg.muted })
    case 'call.sync': {
      const payload = msg.payload as { kind?: string } | undefined
      if (!payload || !SYNC_KINDS.has(String(payload.kind)) || JSON.stringify(payload).length > 2000) throw err('bad_sync', 'Invalid sync message.')
      return send(peerClient, { t: 'call.sync', sessionId: s.id, payload })
    }
    case 'call.end':
      return endCall(s.id, 'hangup', client.user.id)
    case 'call.resume': {
      // A participant came back after a network drop (new socket). Rebind and renegotiate media.
      self.clientId = client.id
      clearTimeout(s.grace.get(client.user.id))
      s.grace.delete(client.user.id)
      s.connected.delete(client.user.id)
      send(peerClient, { t: 'call.partner_connection', sessionId: s.id, status: 'back' })
      const row = db().one<{ connected_at: number | null }>('SELECT connected_at FROM call_sessions WHERE id = ?', s.id)
      send(client, { t: 'call.resumed', sessionId: s.id, startedAt: row?.connected_at ?? null, maxSeconds: s.maxSeconds, iceServers: iceServers(client.user.id) })
      for (const p of [s.a, s.b]) send(findClient(p.userId, p.clientId), { t: 'call.restart', sessionId: s.id, initiator: p.userId === s.a.userId })
      return
    }
  }
  throw err('unknown_type', 'Unknown call message.')
})

onClose((client) => {
  const q = queue.get(client.user.id)
  if (q?.clientId === client.id) queue.delete(client.user.id)
  const sid = liveByUser.get(client.user.id)
  const s = sid ? live.get(sid) : undefined
  if (!s || me(s, client.user.id).clientId !== client.id) return
  const peer = other(s, client.user.id)
  send(findClient(peer.userId, peer.clientId), { t: 'call.partner_connection', sessionId: s.id, status: 'reconnecting' })
  s.connected.delete(client.user.id)
  s.grace.set(
    client.user.id,
    setTimeout(() => endCall(s.id, 'partner_left', client.user.id), matchingConfig().reconnectGraceSec * 1000),
  )
})

/** On boot, sessions left open by a previous process can't be live any more. */
export function closeStaleSessions() {
  db().run("UPDATE call_sessions SET status = 'ended', ended_at = ?, end_reason = 'server_restart', duration_s = CASE WHEN connected_at IS NULL THEN 0 ELSE (? - connected_at) / 1000 END WHERE status <> 'ended'", now(), now())
}

/** Ends a live call from outside the socket flow (block, report, moderation). */
export function endCallForUser(userId: string, reason: EndReason) {
  const sid = liveByUser.get(userId)
  if (sid) endCall(sid, reason, userId)
}
