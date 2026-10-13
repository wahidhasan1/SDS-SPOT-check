import crypto from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { LIMIT_KEYS, type LimitKey } from '../../shared/config.ts'
import { db, json } from '../db/index.ts'
import { env } from '../env.ts'
import { requireUser } from '../lib/auth.ts'
import { entitlements, usage } from '../lib/plans.ts'
import { audit, notify } from '../lib/events.ts'
import { HttpError, newId, notConfigured, notFound, now } from '../lib/util.ts'

/**
 * Subscriptions. Premium access is ONLY granted by rows in `subscriptions`, written by:
 *  - verified Stripe webhooks (web), - authenticated RevenueCat webhooks (iOS/Android in-app purchases),
 *  - an admin grant (audited), - the TEST_PAYMENTS provider (development only; refused in production).
 * The client never tells the server what plan it has.
 */

export const providers = () => ({
  stripe: !!(env.stripeSecret && env.stripeWebhookSecret && env.stripePremiumPrice),
  revenuecat: !!env.revenueCatWebhookAuth,
  test: env.testPayments,
})

type SubStatus = 'active' | 'canceled' | 'expired' | 'past_due'

/** Inserts or updates one provider subscription, keyed by (provider, provider_ref). */
export function upsertSubscription(s: { userId: string; planId: string; provider: 'stripe' | 'revenuecat' | 'admin' | 'test'; ref: string; status: SubStatus; periodEnd: number | null; cancelAtPeriodEnd: boolean }) {
  const before = entitlements(s.userId).planId
  db().tx(() => {
    const row = db().one<{ id: string }>('SELECT id FROM subscriptions WHERE provider = ? AND provider_ref = ?', s.provider, s.ref)
    if (row) {
      db().run('UPDATE subscriptions SET user_id = ?, plan_id = ?, status = ?, current_period_end = ?, cancel_at_period_end = ?, updated_at = ? WHERE id = ?', s.userId, s.planId, s.status, s.periodEnd, s.cancelAtPeriodEnd ? 1 : 0, now(), row.id)
    } else {
      db().run('INSERT INTO subscriptions (id, user_id, plan_id, provider, provider_ref, status, current_period_end, cancel_at_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', newId('sub_'), s.userId, s.planId, s.provider, s.ref, s.status, s.periodEnd, s.cancelAtPeriodEnd ? 1 : 0, now(), now())
    }
  })
  const after = entitlements(s.userId).planId
  if (before !== after) {
    audit(null, 'subscription.plan_changed', s.userId, { from: before, to: after, provider: s.provider })
    notify(s.userId, after === 'free' ? { kind: 'billing', title: 'Your Premium plan has ended', body: 'You are now on the Free plan. Your progress is kept.', link: '/account/plan' } : { kind: 'billing', title: 'Premium is active', body: 'Thank you! Your Premium features are now unlocked.', link: '/account/plan' })
  }
}

/** Webhook idempotency: returns false if this event id was already processed. */
function firstTime(provider: string, id: string, type: string) {
  const r = db().run('INSERT OR IGNORE INTO payment_events (id, provider, type, received_at) VALUES (?, ?, ?, ?)', `${provider}:${id}`, provider, type, now())
  return Number(r.changes) > 0
}

// ------------------------------------------------------------------------------------------- Stripe (REST, no SDK)
const form = (obj: Record<string, string | number | undefined>) => new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))

async function stripe<T>(method: 'GET' | 'POST', path: string, body?: Record<string, string | number | undefined>): Promise<T> {
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { authorization: `Bearer ${env.stripeSecret}`, 'content-type': 'application/x-www-form-urlencoded', 'stripe-version': '2024-06-20' },
    body: body ? form(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  })
  const data = (await r.json()) as T & { error?: { message: string } }
  if (!r.ok) throw new HttpError(502, 'payment_provider_error', `Payment provider error: ${data.error?.message ?? r.status}`)
  return data
}

/** Verifies the Stripe-Signature header (HMAC-SHA256 over "t.payload"), with a 5-minute tolerance. */
export function verifyStripeSignature(payload: string, header: string | undefined, secret: string, at = Date.now()) {
  if (!header) return false
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]).filter((p) => p.length === 2).map(([k, v]) => [k, v]))
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3))
  const t = Number(parts.t)
  if (!t || !sigs.length || Math.abs(at / 1000 - t) > 300) return false
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)))
}

type StripeSub = { id: string; customer: string; status: string; cancel_at_period_end: boolean; current_period_end?: number; items?: { data: { current_period_end?: number; price?: { id: string } }[] }; metadata?: Record<string, string> }

function applyStripeSubscription(sub: StripeSub) {
  const userId = sub.metadata?.user_id || db().one<{ user_id: string }>("SELECT user_id FROM billing_customers WHERE provider = 'stripe' AND customer_id = ?", sub.customer)?.user_id
  if (!userId || !db().one('SELECT 1 FROM users WHERE id = ?', userId)) return
  if (sub.status === 'incomplete') return // payment not finished yet: grant nothing
  const status: SubStatus = ['active', 'trialing'].includes(sub.status) ? 'active' : ['past_due', 'unpaid'].includes(sub.status) ? 'past_due' : sub.status === 'canceled' ? 'canceled' : 'expired'
  const end = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end ?? null
  upsertSubscription({ userId, planId: 'premium', provider: 'stripe', ref: sub.id, status, periodEnd: end ? end * 1000 : null, cancelAtPeriodEnd: !!sub.cancel_at_period_end })
}

async function stripeCustomer(userId: string) {
  const row = db().one<{ customer_id: string }>("SELECT customer_id FROM billing_customers WHERE user_id = ? AND provider = 'stripe'", userId)
  if (row) return row.customer_id
  const email = db().one<{ email: string }>('SELECT email FROM users WHERE id = ?', userId)!.email
  const c = await stripe<{ id: string }>('POST', '/customers', { email, 'metadata[user_id]': userId })
  db().run("INSERT INTO billing_customers (user_id, provider, customer_id, created_at) VALUES (?, 'stripe', ?, ?)", userId, c.id, now())
  return c.id
}

// ------------------------------------------------------------------------------------------- RevenueCat
type RcEvent = { id: string; type: string; app_user_id: string; original_app_user_id?: string; aliases?: string[]; original_transaction_id?: string; transaction_id?: string; product_id?: string; entitlement_ids?: string[] | null; expiration_at_ms?: number | null; environment?: string }

export function applyRevenueCatEvent(e: RcEvent) {
  const candidates = [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])].filter(Boolean) as string[]
  const userId = candidates.find((id) => db().one('SELECT 1 FROM users WHERE id = ?', id))
  if (!userId) return 'unknown_user'
  const ref = e.original_transaction_id || e.transaction_id || `${e.app_user_id}:${e.product_id}`
  const end = e.expiration_at_ms ?? null
  const active = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT']
  if (active.includes(e.type)) upsertSubscription({ userId, planId: 'premium', provider: 'revenuecat', ref, status: 'active', periodEnd: end, cancelAtPeriodEnd: false })
  else if (e.type === 'CANCELLATION') upsertSubscription({ userId, planId: 'premium', provider: 'revenuecat', ref, status: 'active', periodEnd: end, cancelAtPeriodEnd: true })
  else if (e.type === 'BILLING_ISSUE') upsertSubscription({ userId, planId: 'premium', provider: 'revenuecat', ref, status: 'past_due', periodEnd: end, cancelAtPeriodEnd: false })
  else if (e.type === 'EXPIRATION') upsertSubscription({ userId, planId: 'premium', provider: 'revenuecat', ref, status: 'expired', periodEnd: end, cancelAtPeriodEnd: false })
  else return 'ignored'
  return 'applied'
}

// ------------------------------------------------------------------------------------------- routes
export const billingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const user = requireUser(req)
    const plans = db().all<{ id: string; name: string; limits: string; price_label: string | null }>('SELECT id, name, limits, price_label FROM plans ORDER BY sort')
    const metered = (Object.keys(LIMIT_KEYS) as LimitKey[]).filter((k) => typeof entitlements(user.id).limits[k] === 'number' && k !== 'callMaxMinutes')
    return {
      plans: plans.map((p) => ({ id: p.id, name: p.name, priceLabel: p.price_label, limits: json(p.limits, {}) })),
      current: entitlements(user.id),
      usage: Object.fromEntries(metered.map((k) => [k, (({ used, limit }) => ({ used, limit }))(usage(user.id, k))])),
      providers: providers(),
      hasStripeCustomer: !!db().one("SELECT 1 FROM billing_customers WHERE user_id = ? AND provider = 'stripe'", user.id),
    }
  })

  /** Starts a checkout. Never grants anything itself: access starts when the provider confirms payment. */
  app.post('/checkout', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req) => {
    const user = requireUser(req)
    z.object({ planId: z.literal('premium') }).parse(req.body)
    if (entitlements(user.id).planId === 'premium') throw new HttpError(409, 'already_premium', 'You already have Premium.')
    const p = providers()
    if (p.stripe) {
      const customer = await stripeCustomer(user.id)
      const s = await stripe<{ url: string }>('POST', '/checkout/sessions', {
        mode: 'subscription',
        customer,
        client_reference_id: user.id,
        'line_items[0][price]': env.stripePremiumPrice,
        'line_items[0][quantity]': 1,
        'subscription_data[metadata][user_id]': user.id,
        'metadata[user_id]': user.id,
        allow_promotion_codes: 'true',
        success_url: `${env.publicUrl}/account/plan?checkout=success`,
        cancel_url: `${env.publicUrl}/account/plan?checkout=cancelled`,
      })
      return { provider: 'stripe', url: s.url }
    }
    if (p.test) return { provider: 'test', url: '/account/plan/test-checkout' }
    throw notConfigured('Payments', 'Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and STRIPE_PREMIUM_PRICE_ID (web) and/or REVENUECAT_WEBHOOK_AUTH (mobile in-app purchases).')
  })

  /** Stripe customer portal: change card, cancel, view invoices. */
  app.post('/portal', async (req) => {
    const user = requireUser(req)
    if (!providers().stripe) throw notConfigured('Payments', 'Stripe is not configured.')
    const row = db().one<{ customer_id: string }>("SELECT customer_id FROM billing_customers WHERE user_id = ? AND provider = 'stripe'", user.id)
    if (!row) throw notFound('No billing account yet.')
    const s = await stripe<{ url: string }>('POST', '/billing_portal/sessions', { customer: row.customer_id, return_url: `${env.publicUrl}/account/plan` })
    return { url: s.url }
  })

  /** "Restore purchases" on the web: re-reads the user's subscriptions from Stripe. */
  app.post('/sync', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req) => {
    const user = requireUser(req)
    if (providers().stripe) {
      const row = db().one<{ customer_id: string }>("SELECT customer_id FROM billing_customers WHERE user_id = ? AND provider = 'stripe'", user.id)
      if (row) {
        const list = await stripe<{ data: StripeSub[] }>('GET', `/subscriptions?customer=${encodeURIComponent(row.customer_id)}&status=all&limit=10`)
        for (const s of list.data) applyStripeSubscription({ ...s, metadata: { ...s.metadata, user_id: user.id } })
      }
    }
    // Lazily expire anything whose period has ended (providers normally tell us, this is a safety net).
    db().run("UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE user_id = ? AND status IN ('active','past_due') AND current_period_end IS NOT NULL AND current_period_end < ?", now(), user.id, now())
    return { current: entitlements(user.id) }
  })

  // ---- Development-only test provider (TEST_PAYMENTS=true, never in production). No money moves.
  app.post('/test/complete', async (req) => {
    const user = requireUser(req)
    if (!env.testPayments) throw new HttpError(404, 'not_found', 'Not found.')
    z.object({ planId: z.literal('premium'), testCard: z.literal('4242 4242 4242 4242') }).parse(req.body)
    upsertSubscription({ userId: user.id, planId: 'premium', provider: 'test', ref: `test_${user.id}`, status: 'active', periodEnd: now() + 30 * 86400_000, cancelAtPeriodEnd: false })
    audit(user.id, 'billing.test_purchase', user.id)
    return { current: entitlements(user.id) }
  })

  app.post('/test/cancel', async (req) => {
    const user = requireUser(req)
    if (!env.testPayments) throw new HttpError(404, 'not_found', 'Not found.')
    const { immediately } = z.object({ immediately: z.boolean().default(false) }).parse(req.body ?? {})
    const sub = db().one<{ current_period_end: number | null }>("SELECT current_period_end FROM subscriptions WHERE provider = 'test' AND provider_ref = ?", `test_${user.id}`)
    if (!sub) throw notFound('No test subscription.')
    upsertSubscription({ userId: user.id, planId: 'premium', provider: 'test', ref: `test_${user.id}`, status: immediately ? 'expired' : 'active', periodEnd: immediately ? now() : sub.current_period_end, cancelAtPeriodEnd: !immediately })
    return { current: entitlements(user.id) }
  })
}

/** Provider webhooks. Mounted at /api/webhooks (exempt from the same-origin check; authenticated per provider). */
export const webhookRoutes: FastifyPluginAsync = async (app) => {
  // Keep the raw body: Stripe signs the exact bytes.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => done(null, body))

  app.post('/stripe', { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!env.stripeSecret || !env.stripeWebhookSecret) throw notConfigured('Stripe webhooks', 'Set STRIPE_WEBHOOK_SECRET.')
    const raw = String(req.body ?? '')
    if (!verifyStripeSignature(raw, req.headers['stripe-signature'] as string | undefined, env.stripeWebhookSecret)) return reply.status(400).send({ error: { code: 'bad_signature', message: 'Invalid signature.' } })
    const event = JSON.parse(raw) as { id: string; type: string; data: { object: Record<string, unknown> } }
    if (!firstTime('stripe', event.id, event.type)) return { received: true, duplicate: true }
    const o = event.data.object
    if (event.type === 'checkout.session.completed' && o.subscription) {
      const userId = (o.client_reference_id as string) || (o.metadata as Record<string, string> | undefined)?.user_id
      if (userId && o.customer && !db().one("SELECT 1 FROM billing_customers WHERE user_id = ? AND provider = 'stripe'", userId) && db().one('SELECT 1 FROM users WHERE id = ?', userId))
        db().run("INSERT OR IGNORE INTO billing_customers (user_id, provider, customer_id, created_at) VALUES (?, 'stripe', ?, ?)", userId, o.customer as string, now())
      const sub = await stripe<StripeSub>('GET', `/subscriptions/${o.subscription as string}`)
      applyStripeSubscription({ ...sub, metadata: { ...sub.metadata, ...(userId ? { user_id: userId } : {}) } })
    } else if (event.type.startsWith('customer.subscription.')) {
      applyStripeSubscription(o as unknown as StripeSub)
    }
    return { received: true }
  })

  app.post('/revenuecat', { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!env.revenueCatWebhookAuth) throw notConfigured('RevenueCat webhooks', 'Set REVENUECAT_WEBHOOK_AUTH.')
    const auth = String(req.headers.authorization ?? '')
    const expected = env.revenueCatWebhookAuth
    const ok = [expected, `Bearer ${expected}`].some((e) => e.length === auth.length && crypto.timingSafeEqual(Buffer.from(e), Buffer.from(auth)))
    if (!ok) return reply.status(401).send({ error: { code: 'unauthorized', message: 'Unauthorized.' } })
    const { event } = JSON.parse(String(req.body ?? '{}')) as { event: RcEvent }
    if (!event?.id) return reply.status(400).send({ error: { code: 'invalid', message: 'Missing event.' } })
    if (!firstTime('revenuecat', event.id, event.type)) return { received: true, duplicate: true }
    return { received: true, result: applyRevenueCatEvent(event) }
  })
}
