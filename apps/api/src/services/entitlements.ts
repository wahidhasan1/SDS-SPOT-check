import { and, eq, sql } from 'drizzle-orm';
import { FEATURE_LABELS, PLAN_LIMITS, type Feature, type PlanId } from '@fluentpath/shared';
import { db, schema } from '../db';
import { limitReached } from '../lib/errors';
import { localDay } from '../lib/time';

export async function getSubscription(userId: string) {
  const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
  return sub ?? null;
}

/** Effective plan, evaluated on the server. */
export async function getPlan(userId: string): Promise<PlanId> {
  const sub = await getSubscription(userId);
  if (!sub || sub.plan !== 'premium') return 'free';
  if (sub.status !== 'active' && sub.status !== 'past_due') return 'free';
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < Date.now()) return 'free';
  return 'premium';
}

export async function getUsage(userId: string, tz: string) {
  const day = localDay(tz);
  const rows = await db
    .select()
    .from(schema.usageCounters)
    .where(and(eq(schema.usageCounters.userId, userId), eq(schema.usageCounters.day, day)));
  const used: Partial<Record<Feature, number>> = {};
  for (const r of rows) used[r.feature as Feature] = r.count;
  return used;
}

/** Check the daily limit for a feature and count one use. Throws 429 when the limit is reached. */
export async function consume(userId: string, feature: Feature, tz = 'UTC') {
  const plan = await getPlan(userId);
  const limit = PLAN_LIMITS[plan][feature];
  const day = localDay(tz);
  if (limit === null) {
    await bump(userId, feature, day);
    return { plan, limit, used: null };
  }
  // Atomic: only increment when below the limit.
  const res = await db.execute(sql`
    INSERT INTO usage_counters (user_id, feature, day, count) VALUES (${userId}, ${feature}, ${day}, 1)
    ON CONFLICT (user_id, feature, day) DO UPDATE SET count = usage_counters.count + 1
    WHERE usage_counters.count < ${limit}
    RETURNING count`);
  if (res.rows.length === 0) {
    throw limitReached(
      plan === 'free'
        ? `You have reached today's free limit (${limit} ${FEATURE_LABELS[feature].toLowerCase()}). Upgrade to Premium for more, or come back tomorrow.`
        : `You have reached today's limit (${limit} ${FEATURE_LABELS[feature].toLowerCase()}).`,
      { feature, limit, plan },
    );
  }
  return { plan, limit, used: Number((res.rows[0] as { count: number }).count) };
}

/** Give back one use, e.g. when an external service failed after consume(). */
export async function refund(userId: string, feature: Feature, tz = 'UTC') {
  await db.execute(sql`UPDATE usage_counters SET count = GREATEST(count - 1, 0)
    WHERE user_id = ${userId} AND feature = ${feature} AND day = ${localDay(tz)}`);
}

async function bump(userId: string, feature: string, day: string) {
  await db.execute(sql`
    INSERT INTO usage_counters (user_id, feature, day, count) VALUES (${userId}, ${feature}, ${day}, 1)
    ON CONFLICT (user_id, feature, day) DO UPDATE SET count = usage_counters.count + 1`);
}

export async function requirePremium(userId: string, what: string) {
  if ((await getPlan(userId)) !== 'premium') throw limitReached(`${what} is a Premium feature.`, { premiumRequired: true });
}
