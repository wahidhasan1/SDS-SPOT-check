import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db, json } from '../db/index.ts'
import { requireUser } from '../lib/auth.ts'
import { usage } from '../lib/plans.ts'
import { conflict, newId, notFound, now } from '../lib/util.ts'
import { checkReports, endCallForUser, liveCallFor, matchingConfig, queueSize } from '../realtime/calls.ts'
import { audit } from '../lib/events.ts'

type CallRow = {
  id: string
  user_a: string | null
  user_b: string | null
  mode: string
  topic: string
  status: string
  created_at: number
  connected_at: number | null
  ended_at: number | null
  end_reason: string | null
  ended_by: string | null
  duration_s: number | null
  anon_a: string
  anon_b: string
  level_a: string | null
  level_b: string | null
  role_a: string | null
  role_b: string | null
  prompts: string
}

/** Loads a call the user took part in. Anyone else gets 404, so ids can't be probed. */
function callFor(userId: string, id: string) {
  const row = db().one<CallRow>('SELECT * FROM call_sessions WHERE id = ? AND (user_a = ?2 OR user_b = ?2)', id, userId)
  if (!row) throw notFound('Call not found.')
  const isA = row.user_a === userId
  return { row, isA, partnerId: isA ? row.user_b : row.user_a }
}

function view(userId: string, row: CallRow) {
  const isA = row.user_a === userId
  const fb = db().one<{ rating: number | null; tags: string; self_assessment: string | null; note: string | null }>('SELECT rating, tags, self_assessment, note FROM call_feedback WHERE session_id = ? AND user_id = ?', row.id, userId)
  const fromPartner = db().one<{ tags: string }>('SELECT tags FROM call_feedback WHERE session_id = ? AND user_id <> ?', row.id, userId)
  return {
    id: row.id,
    mode: row.mode,
    topic: row.topic,
    status: row.status,
    createdAt: row.created_at,
    connected: !!row.connected_at,
    durationS: row.duration_s ?? 0,
    endReason: row.end_reason,
    endedBy: row.ended_by === null ? (row.end_reason ? 'system' : null) : row.ended_by === userId ? 'you' : 'partner',
    myRole: isA ? row.role_a : row.role_b,
    partner: { anonName: isA ? row.anon_b : row.anon_a, level: isA ? row.level_b : row.level_a, formerMember: !(isA ? row.user_b : row.user_a) },
    prompts: json(row.prompts, {}),
    myFeedback: fb ? { rating: fb.rating, tags: json<string[]>(fb.tags, []), selfAssessment: json(fb.self_assessment, null), note: fb.note } : null,
    // Positive tags the partner chose for you (anonymous, never free text).
    partnerTags: fromPartner ? json<string[]>(fromPartner.tags, []) : [],
  }
}

export const FEEDBACK_TAGS = ['Clear speaker', 'Good listener', 'Friendly', 'Rich vocabulary', 'Fluent', 'Helpful corrections', 'Patient'] as const
export const REPORT_REASONS = ['harassment', 'hate', 'sexual', 'spam', 'scam', 'underage', 'silent', 'other'] as const

export const callRoutes: FastifyPluginAsync = async (app) => {
  /** What the matching screen needs before starting: allowance, eligibility and real queue size. */
  app.get('/status', async (req) => {
    const user = requireUser(req)
    const u = usage(user.id, 'callsPerDay')
    return {
      callsUsedToday: u.used,
      callsLimit: u.limit,
      inCall: liveCallFor(user.id) ?? null,
      searchingNow: { casual: queueSize('casual'), ielts: queueSize('ielts') },
      config: { baseLevelRange: matchingConfig().baseLevelRange },
    }
  })

  app.get('/history', async (req) => {
    const user = requireUser(req)
    const q = z.object({ before: z.coerce.number().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }).parse(req.query)
    const rows = db().all<CallRow>(
      'SELECT * FROM call_sessions WHERE (user_a = ?1 OR user_b = ?1) AND created_at < ?2 ORDER BY created_at DESC LIMIT ?3',
      user.id,
      q.before ?? now() + 1,
      q.limit,
    )
    return rows.map((r) => view(user.id, r))
  })

  app.get('/:id', async (req) => {
    const user = requireUser(req)
    const { row } = callFor(user.id, (req.params as { id: string }).id)
    return view(user.id, row)
  })

  app.post('/:id/feedback', async (req) => {
    const user = requireUser(req)
    const { row } = callFor(user.id, (req.params as { id: string }).id)
    const body = z
      .object({
        rating: z.number().int().min(1).max(5).nullable().default(null),
        tags: z.array(z.enum(FEEDBACK_TAGS)).max(4).default([]),
        selfAssessment: z.object({ fluency: z.number().int().min(1).max(5), vocabulary: z.number().int().min(1).max(5), confidence: z.number().int().min(1).max(5) }).nullable().default(null),
        note: z.string().trim().max(500).nullable().default(null),
      })
      .parse(req.body)
    if (row.status !== 'ended') throw conflict('You can leave feedback after the call ends.')
    db().run(
      `INSERT INTO call_feedback (session_id, user_id, rating, tags, self_assessment, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (session_id, user_id) DO UPDATE SET rating = excluded.rating, tags = excluded.tags, self_assessment = excluded.self_assessment, note = excluded.note`,
      row.id, user.id, body.rating, JSON.stringify(body.tags), body.selfAssessment ? JSON.stringify(body.selfAssessment) : null, body.note, now(),
    )
    return view(user.id, db().one<CallRow>('SELECT * FROM call_sessions WHERE id = ?', row.id)!)
  })

  /** Block the partner from a call. Ends the call if it is still running. They will never be matched again. */
  app.post('/:id/block', async (req) => {
    const user = requireUser(req)
    const { row, partnerId } = callFor(user.id, (req.params as { id: string }).id)
    if (partnerId) db().run('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)', user.id, partnerId, now())
    if (row.status !== 'ended') endCallForUser(user.id, 'blocked')
    return { ok: true }
  })

  app.post('/:id/report', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const user = requireUser(req)
    const { row, partnerId } = callFor(user.id, (req.params as { id: string }).id)
    const body = z
      .object({ reason: z.enum(REPORT_REASONS), details: z.string().trim().max(1000).nullable().default(null), block: z.boolean().default(true) })
      .parse(req.body)
    if (!partnerId) throw notFound('This account no longer exists.')
    const id = newId('rep_')
    const inserted = db().run('INSERT OR IGNORE INTO reports (id, reporter_id, reported_id, session_id, context, reason, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', id, user.id, partnerId, row.id, 'call', body.reason, body.details, now())
    if (body.block) db().run('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)', user.id, partnerId, now())
    if (row.status !== 'ended') endCallForUser(user.id, 'reported')
    if (inserted.changes) {
      audit(user.id, 'report.created', id, { reason: body.reason, session: row.id })
      checkReports(partnerId)
    }
    return { ok: true, alreadyReported: !inserted.changes }
  })

  app.get('/blocked', async (req) => {
    const user = requireUser(req)
    // Blocked partners are shown by the anonymous name they had in the most recent shared call.
    return db().all(
      `SELECT b.created_at AS blockedAt,
        (SELECT CASE WHEN c.user_a = b.blocked_id THEN c.anon_a ELSE c.anon_b END FROM call_sessions c
         WHERE (c.user_a = b.blocker_id AND c.user_b = b.blocked_id) OR (c.user_b = b.blocker_id AND c.user_a = b.blocked_id)
         ORDER BY c.created_at DESC LIMIT 1) AS anonName,
        (SELECT c.id FROM call_sessions c WHERE (c.user_a = b.blocker_id AND c.user_b = b.blocked_id) OR (c.user_b = b.blocker_id AND c.user_a = b.blocked_id) ORDER BY c.created_at DESC LIMIT 1) AS sessionId
       FROM blocks b WHERE b.blocker_id = ? ORDER BY b.created_at DESC`,
      user.id,
    )
  })

  app.delete('/:id/block', async (req) => {
    const user = requireUser(req)
    const { partnerId } = callFor(user.id, (req.params as { id: string }).id)
    if (partnerId) db().run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', user.id, partnerId)
    return { ok: true }
  })
}

