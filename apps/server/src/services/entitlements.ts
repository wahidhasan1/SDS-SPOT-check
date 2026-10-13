import type { Entitlements, PlanLimits } from '@app/shared';
import { one, q, type Queryable, pool } from '../db/pool';
import { limitReached } from '../lib/errors';

export const DEFAULT_PLAN_LIMITS: Record<'free' | 'premium', PlanLimits> = {
  free: {
    callsPerDay: 3,
    maxCallMinutes: 10,
    premiumTopics: false,
    ieltsSpeakingMode: true,
    matchingPreferences: false,
    priorityMatching: false,
    aiWritingFeedbackPerDay: 2,
    aiReadingScansPerDay: 3,
    wordLookupsPerDay: 30,
    translationsPerDay: 10,
    mockTestsPerMonth: 1,
    speakingAnalysesPerDay: 5,
    rankedBattlesPerDay: 10,
    advancedReports: false,
  },
  premium: {
    callsPerDay: null,
    maxCallMinutes: 30,
    premiumTopics: true,
    ieltsSpeakingMode: true,
    matchingPreferences: true,
    priorityMatching: true,
    aiWritingFeedbackPerDay: 20,
    aiReadingScansPerDay: 50,
    wordLookupsPerDay: null,
    translationsPerDay: 200,
    mockTestsPerMonth: null,
    speakingAnalysesPerDay: 50,
    rankedBattlesPerDay: null,
    advancedReports: true,
  },
};

/** Free topics; everything else needs plan.limits.premiumTopics. */
export const FREE_TOPIC_IDS = new Set([
  'random', 'daily_life', 'education', 'technology', 'travel', 'food', 'hobbies', 'ielts_part1', 'ielts_part2', 'ielts_part3',
]);

export type UsageKey =
  | 'calls'
  | 'aiWritingFeedback'
  | 'aiReadingScans'
  | 'wordLookups'
  | 'translations'
  | 'speakingAnalyses'
  | 'rankedBattles'
  | 'matchRequests';

const LIMIT_FOR: Partial<Record<UsageKey, keyof PlanLimits>> = {
  calls: 'callsPerDay',
  aiWritingFeedback: 'aiWritingFeedbackPerDay',
  aiReadingScans: 'aiReadingScansPerDay',
  wordLookups: 'wordLookupsPerDay',
  translations: 'translationsPerDay',
  speakingAnalyses: 'speakingAnalysesPerDay',
  rankedBattles: 'rankedBattlesPerDay',
};

const LABEL: Record<string, string> = {
  calls: 'speaking calls',
  aiWritingFeedback: 'writing evaluations',
  aiReadingScans: 'photo scans',
  wordLookups: 'word lookups',
  translations: 'translations',
  speakingAnalyses: 'speaking analyses',
  rankedBattles: 'ranked battles',
};

export async function getPlanLimits(planId: 'free' | 'premium', db: Queryable = pool): Promise<PlanLimits> {
  const row = await one<{ limits: PlanLimits }>('SELECT limits FROM plans WHERE id=$1', [planId], db);
  return { ...DEFAULT_PLAN_LIMITS[planId], ...(row?.limits ?? {}) };
}

/** The active subscription (if any) decides the plan. Only server-verified records count. */
export async function activeSubscription(userId: string, db: Queryable = pool) {
  return one<{
    plan_id: string;
    provider: string;
    status: string;
    current_period_end: string | null;
  }>(
    `SELECT plan_id, provider, status, current_period_end FROM subscriptions
     WHERE user_id=$1 AND status IN ('active','trialing','past_due')
       AND (current_period_end IS NULL OR current_period_end > now() - interval '3 days')
     ORDER BY (plan_id='premium') DESC, current_period_end DESC NULLS FIRST LIMIT 1`,
    [userId],
    db,
  );
}

export async function getPlanId(userId: string, db: Queryable = pool): Promise<'free' | 'premium'> {
  const sub = await activeSubscription(userId, db);
  return sub?.plan_id === 'premium' ? 'premium' : 'free';
}

export async function usageToday(userId: string, db: Queryable = pool): Promise<Record<string, number>> {
  const rows = await q<{ key: string; count: number }>(
    'SELECT key, count FROM usage_counters WHERE user_id=$1 AND day=current_date',
    [userId],
    db,
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.count]));
}

export async function getEntitlements(userId: string): Promise<Entitlements> {
  const sub = await activeSubscription(userId);
  const plan = sub?.plan_id === 'premium' ? 'premium' : 'free';
  const limits = await getPlanLimits(plan);
  const planRow = await one<{ name: string }>('SELECT name FROM plans WHERE id=$1', [plan]);
  const u = await usageToday(userId);
  const status = sub
    ? (sub.status as Entitlements['status'])
    : 'none';
  return {
    plan,
    planName: planRow?.name ?? (plan === 'premium' ? 'Premium' : 'Free'),
    source: (sub?.provider as Entitlements['source']) ?? 'default',
    status,
    currentPeriodEnd: sub?.current_period_end ?? null,
    limits,
    usageToday: {
      calls: u.calls ?? 0,
      aiWritingFeedback: u.aiWritingFeedback ?? 0,
      aiReadingScans: u.aiReadingScans ?? 0,
      wordLookups: u.wordLookups ?? 0,
      translations: u.translations ?? 0,
      speakingAnalyses: u.speakingAnalyses ?? 0,
      rankedBattles: u.rankedBattles ?? 0,
    },
  };
}

/**
 * Atomically consumes one unit of a daily quota. Throws 402 limit_reached if exhausted.
 * The conditional upsert makes concurrent requests safe (no over-consumption).
 */
export async function consumeDaily(userId: string, key: UsageKey, db: Queryable = pool): Promise<void> {
  const limitKey = LIMIT_FOR[key];
  const plan = await getPlanId(userId, db);
  const limits = await getPlanLimits(plan, db);
  const limit = limitKey ? (limits[limitKey] as number | null) : null;
  if (limit === null || limit === undefined) {
    await q(
      `INSERT INTO usage_counters (user_id, day, key, count) VALUES ($1, current_date, $2, 1)
       ON CONFLICT (user_id, day, key) DO UPDATE SET count = usage_counters.count + 1`,
      [userId, key],
      db,
    );
    return;
  }
  const row = await one(
    `INSERT INTO usage_counters (user_id, day, key, count) VALUES ($1, current_date, $2, 1)
     ON CONFLICT (user_id, day, key) DO UPDATE SET count = usage_counters.count + 1
       WHERE usage_counters.count < $3
     RETURNING count`,
    [userId, key, limit],
    db,
  );
  if (!row || limit === 0) {
    throw limitReached(
      `You have used all ${limit} ${LABEL[key] ?? key} included in the ${plan === 'free' ? 'Free' : 'Premium'} plan today. ${plan === 'free' ? 'Upgrade to Premium for more, or ' : ''}try again tomorrow.`,
      { key, limit, plan },
    );
  }
}

/** Gives back a unit (e.g. when an external AI call failed after consuming quota). */
export async function refundDaily(userId: string, key: UsageKey): Promise<void> {
  await q(
    `UPDATE usage_counters SET count = GREATEST(count - 1, 0) WHERE user_id=$1 AND day=current_date AND key=$2`,
    [userId, key],
  );
}

export async function checkDailyAvailable(userId: string, key: UsageKey): Promise<{ ok: boolean; limit: number | null; used: number }> {
  const limitKey = LIMIT_FOR[key];
  const limits = await getPlanLimits(await getPlanId(userId));
  const limit = limitKey ? (limits[limitKey] as number | null) : null;
  const used = (await usageToday(userId))[key] ?? 0;
  return { ok: limit === null || used < limit, limit, used };
}
