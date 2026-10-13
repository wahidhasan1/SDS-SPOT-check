import { UNLIMITED, type LimitKey, type PlanLimits } from '../../shared/config.ts'
import { db, json } from '../db/index.ts'
import { dayKey, limitReached, now, weekKey } from './util.ts'

/** Default plan rules. Seeded once; after that admins edit them in the database (Admin → Plans). */
export const DEFAULT_PLANS: { id: string; name: string; price_label: string; limits: PlanLimits }[] = [
  {
    id: 'free',
    name: 'Free',
    price_label: 'Free',
    limits: {
      callsPerDay: 3,
      callMaxMinutes: 15,
      writingFeedbackPerDay: 2,
      speakingAnalysesPerDay: 5,
      ocrPagesPerDay: 3,
      translationsPerDay: 10,
      mockTestsPerWeek: 1,
      battlesPerDay: 10,
      premiumContent: false,
      genderPreference: false,
      advancedReports: false,
    },
  },
  {
    id: 'premium',
    name: 'Premium',
    price_label: 'Set your price in the payment provider',
    limits: {
      callsPerDay: UNLIMITED,
      callMaxMinutes: 45,
      writingFeedbackPerDay: 20,
      speakingAnalysesPerDay: 60,
      ocrPagesPerDay: 40,
      translationsPerDay: 300,
      mockTestsPerWeek: UNLIMITED,
      battlesPerDay: UNLIMITED,
      premiumContent: true,
      genderPreference: true,
      advancedReports: true,
    },
  },
]

export function seedPlans() {
  for (const p of DEFAULT_PLANS) {
    db().run('INSERT OR IGNORE INTO plans (id, name, limits, price_label, sort) VALUES (?, ?, ?, ?, ?)', p.id, p.name, JSON.stringify(p.limits), p.price_label, p.id === 'free' ? 0 : 1)
  }
}

export type Entitlements = {
  planId: string
  planName: string
  limits: PlanLimits
  subscription: { status: string; provider: string; currentPeriodEnd: number | null; cancelAtPeriodEnd: boolean } | null
}

/** Entitlements are always derived on the server from the subscriptions table, never from client input. */
export function entitlements(userId: string): Entitlements {
  const sub = db().one<{ plan_id: string; status: string; provider: string; current_period_end: number | null; cancel_at_period_end: number }>(
    `SELECT plan_id, status, provider, current_period_end, cancel_at_period_end FROM subscriptions
     WHERE user_id = ? AND status IN ('active','past_due') AND (current_period_end IS NULL OR current_period_end > ?)
     ORDER BY CASE plan_id WHEN 'free' THEN 1 ELSE 0 END, updated_at DESC LIMIT 1`,
    userId,
    now(),
  )
  // past_due keeps access only during the provider's grace period; providers move it to expired afterwards.
  const planId = sub?.plan_id ?? 'free'
  const plan = db().one<{ id: string; name: string; limits: string }>('SELECT id, name, limits FROM plans WHERE id = ?', planId) ?? db().one<{ id: string; name: string; limits: string }>("SELECT id, name, limits FROM plans WHERE id = 'free'")!
  const defaults = DEFAULT_PLANS.find((p) => p.id === plan.id)?.limits ?? DEFAULT_PLANS[0].limits
  return {
    planId: plan.id,
    planName: plan.name,
    limits: { ...defaults, ...json<Partial<PlanLimits>>(plan.limits, {}) },
    subscription: sub ? { status: sub.status, provider: sub.provider, currentPeriodEnd: sub.current_period_end, cancelAtPeriodEnd: !!sub.cancel_at_period_end } : null,
  }
}

const userOffset = (userId: string) => db().one<{ o: number }>('SELECT timezone_offset AS o FROM profiles WHERE user_id = ?', userId)?.o ?? 0

const periodKey = (key: LimitKey, userId: string) => (key === 'mockTestsPerWeek' ? weekKey(userOffset(userId)) : dayKey(userOffset(userId)))

export function usage(userId: string, key: LimitKey) {
  const ent = entitlements(userId)
  const limit = ent.limits[key] as number
  const used = db().one<{ count: number }>('SELECT count FROM usage_counters WHERE user_id = ? AND metric = ? AND day = ?', userId, key, periodKey(key, userId))?.count ?? 0
  return { used, limit, remaining: limit === UNLIMITED ? Infinity : Math.max(0, limit - used), planId: ent.planId }
}

/**
 * Atomically checks and consumes one unit of a metered limit. Throws 402 limit_reached when exhausted.
 * Call `refund` if the metered operation then fails for reasons outside the user's control.
 */
export function consume(userId: string, key: LimitKey, label: string) {
  return db().tx(() => {
    const u = usage(userId, key)
    if (u.limit !== UNLIMITED && u.used >= u.limit) {
      throw limitReached(`You have used all ${u.limit} ${label} on the ${u.planId === 'free' ? 'Free' : 'current'} plan for this ${key === 'mockTestsPerWeek' ? 'week' : 'day'}.`, { key, limit: u.limit, plan: u.planId })
    }
    db().run(
      `INSERT INTO usage_counters (user_id, metric, day, count) VALUES (?, ?, ?, 1)
       ON CONFLICT (user_id, metric, day) DO UPDATE SET count = count + 1`,
      userId,
      key,
      periodKey(key, userId),
    )
    return { ...u, used: u.used + 1 }
  })
}

export function refund(userId: string, key: LimitKey) {
  db().run('UPDATE usage_counters SET count = MAX(0, count - 1) WHERE user_id = ? AND metric = ? AND day = ?', userId, key, periodKey(key, userId))
}

export const hasFlag = (userId: string, key: LimitKey) => entitlements(userId).limits[key] === true
