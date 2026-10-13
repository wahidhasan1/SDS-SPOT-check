import { eq } from 'drizzle-orm';
import { PLAN_LIMITS } from '@fluentpath/shared';
import { config } from '../config';
import { db, schema } from '../db';
import { notFound } from '../lib/errors';
import { isValidTimezone } from '../lib/time';
import { getPlan, getSubscription, getUsage } from './entitlements';

export async function createUserAccount(input: {
  email: string;
  passwordHash: string | null;
  displayName: string;
  googleSub?: string;
  timezone?: string;
}) {
  const role = config.adminEmails.includes(input.email.toLowerCase()) ? 'admin' : 'user';
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ email: input.email, passwordHash: input.passwordHash, googleSub: input.googleSub ?? null, role, emailVerified: Boolean(input.googleSub) })
      .returning();
    await tx.insert(schema.profiles).values({
      userId: user.id,
      displayName: input.displayName,
      timezone: input.timezone && isValidTimezone(input.timezone) ? input.timezone : 'UTC',
    });
    await tx.insert(schema.userSettings).values({ userId: user.id });
    await tx.insert(schema.subscriptions).values({ userId: user.id, plan: 'free', status: 'active', provider: 'none' });
    return user;
  });
}

/** The signed-in user's own account summary. Only ever returned to that user. */
export async function getMe(userId: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) throw notFound('Account not found');
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
  const [settings] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
  const plan = await getPlan(userId);
  const sub = await getSubscription(userId);
  const usage = await getUsage(userId, profile?.timezone ?? 'UTC');
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    hasPassword: Boolean(user.passwordHash),
    googleLinked: Boolean(user.googleSub),
    profile,
    settings,
    plan,
    subscription: sub
      ? { plan: sub.plan, status: sub.status, provider: sub.provider, currentPeriodEnd: sub.currentPeriodEnd, cancelAtPeriodEnd: sub.cancelAtPeriodEnd }
      : null,
    limits: PLAN_LIMITS[plan],
    usage,
  };
}
