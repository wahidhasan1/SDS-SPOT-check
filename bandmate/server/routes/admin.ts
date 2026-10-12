import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { LIMIT_KEYS, UNLIMITED } from '../../shared/config.ts'
import { db, json } from '../db/index.ts'
import { requireAdmin } from '../lib/auth.ts'
import { entitlements } from '../lib/plans.ts'
import { audit, notify } from '../lib/events.ts'
import { HttpError, badRequest, notFound, now } from '../lib/util.ts'
import { MATCHING_DEFAULTS, endCallForUser, matchingConfig } from '../realtime/calls.ts'
import { leaveBattle } from '../realtime/battles.ts'
import { refreshCallPrompts } from '../content/seed.ts'
import { answerKey, questionNumbers, type ObjectiveTest } from '../ielts/tests.ts'
import { upsertSubscription } from './billing.ts'

/**
 * Admin API. Every route checks the admin role on the server (requireAdmin) and every change is
 * written to the audit log with the acting admin's id.
 */

const KINDS = ['reading', 'listening', 'writing', 'speaking', 'grammar', 'assessment', 'mock'] as const

/** Content must stay usable by the app after an edit: validate the shape each player relies on. */
function validateContent(kind: (typeof KINDS)[number], data: unknown) {
  const d = data as Record<string, unknown>
  try {
    if (kind === 'reading' || kind === 'listening') {
      const t = d as unknown as ObjectiveTest
      const nums = questionNumbers(t)
      const key = answerKey(t)
      if (!nums.length) throw new Error('no questions')
      for (const n of nums) if (!key.has(n)) throw new Error(`question ${n} has no answer`)
    } else if (kind === 'writing') {
      z.object({ task: z.union([z.literal(1), z.literal(2)]), title: z.string().min(1), prompt: z.string().min(10), minWords: z.number().int().positive(), minutes: z.number().int().positive(), structure: z.array(z.string()) }).passthrough().parse(d)
    } else if (kind === 'speaking') {
      z.union([
        z.object({ part: z.literal(1), topic: z.string().min(1), questions: z.array(z.string().min(3)).min(1) }).passthrough(),
        z.object({ part: z.literal(2), title: z.string(), cue: z.string(), points: z.array(z.string()).min(1), explain: z.string(), part3: z.array(z.string()).min(1) }).passthrough(),
      ]).parse(d)
    } else if (kind === 'grammar') {
      z.object({ title: z.string(), level: z.string(), exercises: z.array(z.object({ type: z.enum(['mcq', 'fill', 'fix']), prompt: z.string() }).passthrough()).min(1) }).passthrough().parse(d)
    }
  } catch (e) {
    throw badRequest(`This content can’t be used by the app: ${e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : (e as Error).message}`, 'invalid_content')
  }
}

const PlanLimitsSchema = z.object(Object.fromEntries(Object.keys(LIMIT_KEYS).map((k) => [k, z.union([z.number().int().min(UNLIMITED), z.boolean()])])) as Record<keyof typeof LIMIT_KEYS, z.ZodUnion<[z.ZodNumber, z.ZodBoolean]>>).partial()

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (req) => {
    requireAdmin(req)
  })

  // ---------------------------------------------------------------------------------------- overview
  app.get('/overview', async () => {
    const day = 86400_000
    const count = (sql: string, ...args: (string | number)[]) => db().one<{ n: number }>(sql, ...args)!.n
    const days = Array.from({ length: 14 }, (_, i) => new Date(now() - (13 - i) * day).toISOString().slice(0, 10))
    return {
      users: count('SELECT COUNT(*) AS n FROM users'),
      newUsers7d: count('SELECT COUNT(*) AS n FROM users WHERE created_at > ?', now() - 7 * day),
      active7d: count('SELECT COUNT(DISTINCT user_id) AS n FROM activity_days WHERE day >= ?', days[7]),
      premium: count("SELECT COUNT(DISTINCT user_id) AS n FROM subscriptions WHERE plan_id <> 'free' AND status IN ('active','past_due') AND (current_period_end IS NULL OR current_period_end > ?)", now()),
      calls24h: count("SELECT COUNT(*) AS n FROM call_sessions WHERE created_at > ? AND connected_at IS NOT NULL", now() - day),
      avgCallMin7d: db().one<{ m: number | null }>("SELECT AVG((ended_at - connected_at) / 60000.0) AS m FROM call_sessions WHERE connected_at IS NOT NULL AND ended_at IS NOT NULL AND created_at > ?", now() - 7 * day)!.m,
      openReports: count("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
      battles24h: count("SELECT COUNT(*) AS n FROM battles WHERE kind = 'live' AND status = 'finished' AND created_at > ?", now() - day),
      essays7d: count("SELECT COUNT(*) AS n FROM writing_submissions WHERE status = 'submitted' AND submitted_at > ?", now() - 7 * day),
      tests7d: count("SELECT COUNT(*) AS n FROM attempts WHERE status = 'submitted' AND submitted_at > ?", now() - 7 * day),
      activeByDay: days.map((d) => ({ day: d, users: count('SELECT COUNT(DISTINCT user_id) AS n FROM activity_days WHERE day = ?', d) })),
    }
  })

  // ---------------------------------------------------------------------------------------- users
  app.get('/users', async (req) => {
    const { q, status } = z.object({ q: z.string().trim().max(100).optional(), status: z.enum(['active', 'suspended', 'banned']).optional() }).parse(req.query)
    const like = `%${q ?? ''}%`
    const rows = db().all<{ id: string; email: string; role: string; status: string; created_at: number; last_seen_at: number | null; anon_name: string; display_name: string; cefr_level: string | null }>(
      `SELECT u.id, u.email, u.role, u.status, u.created_at, u.last_seen_at, p.anon_name, p.display_name, p.cefr_level FROM users u JOIN profiles p ON p.user_id = u.id
       WHERE (u.email LIKE ?1 OR p.anon_name LIKE ?1 OR p.display_name LIKE ?1 OR u.id = ?2) ${status ? 'AND u.status = ?3' : ''} ORDER BY u.created_at DESC LIMIT 100`,
      like, q ?? '', ...(status ? [status] : []),
    )
    return rows.map((r) => ({ id: r.id, email: r.email, role: r.role, status: r.status, createdAt: r.created_at, lastSeenAt: r.last_seen_at, anonName: r.anon_name, displayName: r.display_name, level: r.cefr_level, plan: entitlements(r.id).planId }))
  })

  app.get('/users/:id', async (req) => {
    const id = (req.params as { id: string }).id
    const u = db().one<{ id: string; email: string; role: string; status: string; created_at: number; last_seen_at: number | null }>('SELECT id, email, role, status, created_at, last_seen_at FROM users WHERE id = ?', id)
    if (!u) throw notFound('User not found.')
    const p = db().one<Record<string, unknown>>('SELECT anon_name, display_name, cefr_level, goal, test_type, target_band, birth_year FROM profiles WHERE user_id = ?', id)
    return {
      ...u,
      profile: p,
      plan: entitlements(id),
      subscriptions: db().all('SELECT id, plan_id AS planId, provider, status, current_period_end AS currentPeriodEnd, cancel_at_period_end AS cancelAtPeriodEnd, created_at AS createdAt FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC', id),
      reportsAgainst: db().all("SELECT r.id, r.reason, r.details, r.status, r.created_at AS createdAt, rp.anon_name AS reporter FROM reports r LEFT JOIN profiles rp ON rp.user_id = r.reporter_id WHERE r.reported_id = ? ORDER BY r.created_at DESC LIMIT 50", id),
      reportsMade: db().one<{ n: number }>('SELECT COUNT(*) AS n FROM reports WHERE reporter_id = ?', id)!.n,
      moderation: db().all('SELECT action, reason, actor, created_at AS createdAt, expires_at AS expiresAt FROM moderation_actions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', id),
      calls: db().one<{ n: number }>('SELECT COUNT(*) AS n FROM call_sessions WHERE (user_a = ?1 OR user_b = ?1) AND connected_at IS NOT NULL', id)!.n,
    }
  })

  app.post('/users/:id/status', async (req) => {
    const admin = requireAdmin(req)
    const id = (req.params as { id: string }).id
    const body = z.object({ status: z.enum(['active', 'suspended', 'banned']), reason: z.string().trim().min(3).max(500) }).parse(req.body)
    if (id === admin.id) throw badRequest('You can’t change your own status.')
    if (!db().one('SELECT 1 FROM users WHERE id = ?', id)) throw notFound('User not found.')
    db().tx(() => {
      db().run('UPDATE users SET status = ? WHERE id = ?', body.status, id)
      db().run('INSERT INTO moderation_actions (user_id, action, reason, actor, created_at) VALUES (?, ?, ?, ?, ?)', id, body.status === 'active' ? 'lift' : body.status === 'banned' ? 'ban' : 'account_suspension', body.reason, admin.id, now())
      if (body.status === 'banned') db().run('DELETE FROM sessions WHERE user_id = ?', id)
    })
    if (body.status !== 'active') {
      endCallForUser(id, 'moderation')
      leaveBattle(id)
    }
    if (body.status !== 'banned') notify(id, body.status === 'active' ? { kind: 'moderation', title: 'Your account restrictions were lifted' } : { kind: 'moderation', title: 'Your account is restricted', body: `Reason: ${body.reason}. You can still use learning features.` })
    audit(admin.id, `user.status.${body.status}`, id, { reason: body.reason })
    return { ok: true }
  })

  /** Lifts an automatic or manual call suspension without changing the account status. */
  app.post('/users/:id/lift-call-suspension', async (req) => {
    const admin = requireAdmin(req)
    const id = (req.params as { id: string }).id
    const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body)
    db().run("INSERT INTO moderation_actions (user_id, action, reason, actor, created_at) VALUES (?, 'lift', ?, ?, ?)", id, reason, admin.id, now())
    notify(id, { kind: 'moderation', title: 'Voice calls are available again' })
    audit(admin.id, 'user.call_suspension_lifted', id, { reason })
    return { ok: true }
  })

  app.post('/users/:id/role', async (req) => {
    const admin = requireAdmin(req)
    const id = (req.params as { id: string }).id
    const { role } = z.object({ role: z.enum(['user', 'admin']) }).parse(req.body)
    if (id === admin.id) throw badRequest('You can’t change your own role.')
    db().run('UPDATE users SET role = ? WHERE id = ?', role, id)
    audit(admin.id, 'user.role', id, { role })
    return { ok: true }
  })

  /** Manual Premium grant (support, partnerships). Expires after `days` unless null. Audited. */
  app.post('/users/:id/grant', async (req) => {
    const admin = requireAdmin(req)
    const id = (req.params as { id: string }).id
    const body = z.object({ planId: z.string(), days: z.number().int().min(1).max(3650).nullable(), reason: z.string().trim().min(3).max(300), revoke: z.boolean().default(false) }).parse(req.body)
    if (!db().one('SELECT 1 FROM plans WHERE id = ?', body.planId)) throw notFound('Plan not found.')
    if (!db().one('SELECT 1 FROM users WHERE id = ?', id)) throw notFound('User not found.')
    upsertSubscription({ userId: id, planId: body.planId, provider: 'admin', ref: `admin_${id}`, status: body.revoke ? 'expired' : 'active', periodEnd: body.revoke ? now() : body.days ? now() + body.days * 86400_000 : null, cancelAtPeriodEnd: false })
    audit(admin.id, body.revoke ? 'plan.revoke' : 'plan.grant', id, { planId: body.planId, days: body.days, reason: body.reason })
    return { plan: entitlements(id) }
  })

  // ---------------------------------------------------------------------------------------- reports
  app.get('/reports', async (req) => {
    const { status } = z.object({ status: z.enum(['open', 'actioned', 'dismissed']).default('open') }).parse(req.query)
    return db().all(
      `SELECT r.id, r.reason, r.details, r.context, r.status, r.created_at AS createdAt, r.resolution, r.resolved_at AS resolvedAt, r.session_id AS sessionId,
              r.reported_id AS reportedId, rd.anon_name AS reported, r.reporter_id AS reporterId, rp.anon_name AS reporter,
              (SELECT COUNT(DISTINCT reporter_id) FROM reports x WHERE x.reported_id = r.reported_id AND x.created_at > ?) AS recentReports,
              c.mode AS callMode, c.topic AS callTopic, c.connected_at AS callConnectedAt, c.ended_at AS callEndedAt
       FROM reports r LEFT JOIN profiles rd ON rd.user_id = r.reported_id LEFT JOIN profiles rp ON rp.user_id = r.reporter_id LEFT JOIN call_sessions c ON c.id = r.session_id
       WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200`,
      now() - 30 * 86400_000,
      status,
    )
  })

  app.post('/reports/:id/resolve', async (req) => {
    const admin = requireAdmin(req)
    const id = (req.params as { id: string }).id
    const body = z.object({ action: z.enum(['dismiss', 'warn', 'suspend_calls', 'suspend', 'ban']), note: z.string().trim().min(3).max(500) }).parse(req.body)
    const r = db().one<{ reported_id: string | null; status: string }>('SELECT reported_id, status FROM reports WHERE id = ?', id)
    if (!r) throw notFound('Report not found.')
    db().run("UPDATE reports SET status = ?, resolved_at = ?, resolved_by = ?, resolution = ? WHERE id = ?", body.action === 'dismiss' ? 'dismissed' : 'actioned', now(), admin.id, `${body.action}: ${body.note}`, id)
    const target = r.reported_id
    if (target && body.action !== 'dismiss') {
      if (body.action === 'warn') notify(target, { kind: 'moderation', title: 'A warning about your behaviour in calls', body: `${body.note} Please follow the community guidelines.`, link: '/guidelines' })
      if (body.action === 'suspend_calls') {
        db().run("INSERT INTO moderation_actions (user_id, action, reason, actor, created_at, expires_at) VALUES (?, 'call_suspension', ?, ?, ?, ?)", target, body.note, admin.id, now(), now() + 7 * 86400_000)
        endCallForUser(target, 'moderation')
        notify(target, { kind: 'moderation', title: 'Voice calls paused for 7 days', body: body.note, link: '/guidelines' })
      }
      if (body.action === 'suspend' || body.action === 'ban') {
        db().run('UPDATE users SET status = ? WHERE id = ?', body.action === 'ban' ? 'banned' : 'suspended', target)
        db().run('INSERT INTO moderation_actions (user_id, action, reason, actor, created_at) VALUES (?, ?, ?, ?, ?)', target, body.action === 'ban' ? 'ban' : 'account_suspension', body.note, admin.id, now())
        if (body.action === 'ban') db().run('DELETE FROM sessions WHERE user_id = ?', target)
        endCallForUser(target, 'moderation')
        leaveBattle(target)
      }
    }
    audit(admin.id, `report.${body.action}`, id, { reported: target, note: body.note })
    return { ok: true }
  })

  // ---------------------------------------------------------------------------------------- content CMS
  app.get('/content', async (req) => {
    const { kind } = z.object({ kind: z.enum(KINDS).optional() }).parse(req.query)
    return db().all(`SELECT id, kind, test_type AS testType, title, level, premium, status, source, sort, updated_at AS updatedAt FROM content_items ${kind ? 'WHERE kind = ?' : ''} ORDER BY kind, sort`, ...(kind ? [kind] : []))
  })

  app.get('/content/:id', async (req) => {
    const r = db().one<Record<string, unknown> & { data: string }>('SELECT * FROM content_items WHERE id = ?', (req.params as { id: string }).id)
    if (!r) throw notFound('Content not found.')
    return { ...r, data: JSON.parse(r.data) }
  })

  const ContentBody = z.object({
    title: z.string().trim().min(1).max(200),
    kind: z.enum(KINDS),
    testType: z.enum(['academic', 'general_training', 'both']).nullable(),
    level: z.string().max(4).nullable(),
    premium: z.boolean(),
    status: z.enum(['published', 'draft', 'pending_review', 'archived']),
    sort: z.number().int().default(0),
    data: z.record(z.string(), z.unknown()),
  })

  app.put('/content/:id', async (req) => {
    const admin = requireAdmin(req)
    const id = z.string().regex(/^[a-z0-9-]{3,60}$/, 'Use lowercase letters, numbers and dashes').parse((req.params as { id: string }).id)
    const body = ContentBody.parse(req.body)
    validateContent(body.kind, body.data)
    const existing = db().one<{ kind: string }>('SELECT kind FROM content_items WHERE id = ?', id)
    if (existing && existing.kind !== body.kind) throw badRequest('The content type can’t be changed.')
    // Admin edits are marked source = 'admin', so re-seeding on deploy never overwrites them.
    db().run(
      `INSERT INTO content_items (id, kind, test_type, title, level, premium, status, source, data, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET test_type = excluded.test_type, title = excluded.title, level = excluded.level, premium = excluded.premium, status = excluded.status, source = 'admin', data = excluded.data, sort = excluded.sort, updated_at = excluded.updated_at`,
      id, body.kind, body.testType, body.title, body.level, body.premium ? 1 : 0, body.status, JSON.stringify(body.data), body.sort, now(), now(),
    )
    if (body.kind === 'speaking') refreshCallPrompts()
    audit(admin.id, existing ? 'content.update' : 'content.create', id, { kind: body.kind, status: body.status })
    return { ok: true }
  })

  // ---------------------------------------------------------------------------------------- vocabulary
  app.get('/vocab', async (req) => {
    const { q } = z.object({ q: z.string().trim().max(60).optional() }).parse(req.query)
    return db().all('SELECT id, word, pos, level, tags, definition, examples, synonyms, status FROM vocab_words WHERE word LIKE ? ORDER BY word LIMIT 200', `%${q ?? ''}%`).map((r) => {
      const w = r as Record<string, string>
      return { ...w, tags: json(w.tags, []), examples: json(w.examples, []), synonyms: json(w.synonyms, []) }
    })
  })

  app.put('/vocab', async (req) => {
    const admin = requireAdmin(req)
    const b = z.object({ id: z.number().int().optional(), word: z.string().trim().min(1).max(60), pos: z.string().max(20), level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']), tags: z.array(z.string().max(30)).min(1).max(5), definition: z.string().trim().min(3).max(300), examples: z.array(z.string().max(300)).max(5), synonyms: z.array(z.string().max(60)).max(10), status: z.enum(['published', 'draft']) }).parse(req.body)
    if (b.id) db().run('UPDATE vocab_words SET word = ?, pos = ?, level = ?, tags = ?, definition = ?, examples = ?, synonyms = ?, status = ? WHERE id = ?', b.word, b.pos, b.level, JSON.stringify(b.tags), b.definition, JSON.stringify(b.examples), JSON.stringify(b.synonyms), b.status, b.id)
    else db().run('INSERT INTO vocab_words (word, pos, level, tags, definition, examples, synonyms, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', b.word, b.pos, b.level, JSON.stringify(b.tags), b.definition, JSON.stringify(b.examples), JSON.stringify(b.synonyms), b.status)
    audit(admin.id, b.id ? 'vocab.update' : 'vocab.create', b.word)
    return { ok: true }
  })

  // ---------------------------------------------------------------------------------------- plans & limits
  app.get('/plans', async () => db().all<{ id: string; name: string; limits: string; price_label: string | null }>('SELECT id, name, limits, price_label FROM plans ORDER BY sort').map((p) => ({ id: p.id, name: p.name, priceLabel: p.price_label, limits: json(p.limits, {}) })))

  app.put('/plans/:id', async (req) => {
    const admin = requireAdmin(req)
    const id = (req.params as { id: string }).id
    const body = z.object({ name: z.string().trim().min(1).max(40), priceLabel: z.string().trim().max(80).nullable(), limits: PlanLimitsSchema }).parse(req.body)
    const cur = db().one<{ limits: string }>('SELECT limits FROM plans WHERE id = ?', id)
    if (!cur) throw notFound('Plan not found.')
    for (const [k, v] of Object.entries(body.limits)) if (typeof v !== (k in LIMIT_KEYS && ['premiumContent', 'genderPreference', 'advancedReports'].includes(k) ? 'boolean' : 'number')) throw badRequest(`${k} has the wrong type.`)
    const limits = { ...json<Record<string, unknown>>(cur.limits, {}), ...body.limits }
    db().run('UPDATE plans SET name = ?, price_label = ?, limits = ? WHERE id = ?', body.name, body.priceLabel, JSON.stringify(limits), id)
    audit(admin.id, 'plan.update', id, { limits: body.limits })
    return { ok: true }
  })

  // ---------------------------------------------------------------------------------------- matching config
  app.get('/config/matching', async () => ({ current: matchingConfig(), defaults: MATCHING_DEFAULTS }))

  app.put('/config/matching', async (req) => {
    const admin = requireAdmin(req)
    const shape = Object.fromEntries(Object.keys(MATCHING_DEFAULTS).map((k) => [k, z.number().min(0).max(100_000)]))
    const body = z.object(shape).partial().strict().parse(req.body)
    const next = { ...matchingConfig(), ...body }
    if (next.baseLevelRange > next.maxLevelRange) throw badRequest('baseLevelRange can’t be larger than maxLevelRange.')
    db().run("INSERT INTO app_config (key, value) VALUES ('matching', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", JSON.stringify(next))
    audit(admin.id, 'config.matching', null, body)
    return { current: matchingConfig() }
  })

  // ---------------------------------------------------------------------------------------- audit log
  app.get('/audit', async (req) => {
    const { before } = z.object({ before: z.coerce.number().int().optional() }).parse(req.query)
    return db().all(
      'SELECT a.id, a.action, a.target, a.details, a.created_at AS createdAt, u.email AS actor FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id WHERE a.id < ? ORDER BY a.id DESC LIMIT 100',
      before ?? Number.MAX_SAFE_INTEGER,
    ).map((r) => ({ ...(r as Record<string, unknown>), details: json((r as { details: string }).details, {}) }))
  })

  app.setNotFoundHandler(() => {
    throw new HttpError(404, 'not_found', 'Not found.')
  })
}
