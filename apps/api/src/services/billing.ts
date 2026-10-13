import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db, schema } from '../db';
import { notConfigured } from '../lib/errors';
import { notify } from './notifications';

let stripe: Stripe | null = null;

export function paymentsConfigured() {
  return Boolean(config.stripeSecretKey && config.stripePriceId);
}

export function devSubscriptionsEnabled() {
  return config.allowDevSubscriptions && !paymentsConfigured();
}

export function getStripe() {
  if (!paymentsConfigured()) throw notConfigured('Payments are not configured on this server (STRIPE_SECRET_KEY and STRIPE_PRICE_ID).');
  stripe ??= new Stripe(config.stripeSecretKey);
  return stripe;
}

export async function setSubscription(userId: string, values: Partial<typeof schema.subscriptions.$inferInsert>) {
  await db
    .insert(schema.subscriptions)
    .values({ userId, plan: 'free', status: 'active', provider: 'none', ...values })
    .onConflictDoUpdate({ target: schema.subscriptions.userId, set: { ...values, updatedAt: new Date() } });
}

/** Apply a Stripe subscription object to our entitlement record. */
export async function syncStripeSubscription(sub: Stripe.Subscription, userIdHint?: string | null) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  let userId = userIdHint ?? (sub.metadata?.userId as string | undefined) ?? null;
  if (!userId) {
    const [row] = await db.select({ userId: schema.subscriptions.userId }).from(schema.subscriptions).where(eq(schema.subscriptions.providerCustomerId, customerId));
    userId = row?.userId ?? null;
  }
  if (!userId) return;
  const active = sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';
  const periodEnd = (sub as unknown as { current_period_end?: number; items?: { data?: { current_period_end?: number }[] } }).current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  await setSubscription(userId, {
    plan: active ? 'premium' : 'free',
    status: sub.status === 'trialing' ? 'active' : sub.status === 'canceled' ? 'canceled' : sub.status === 'past_due' ? 'past_due' : active ? 'active' : 'canceled',
    provider: 'stripe',
    providerCustomerId: customerId,
    providerSubscriptionId: sub.id,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  });
}

export async function cancelStripeSubscriptionNow(userId: string) {
  if (!paymentsConfigured()) return;
  const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
  if (sub?.provider === 'stripe' && sub.providerSubscriptionId) await getStripe().subscriptions.cancel(sub.providerSubscriptionId);
}

export async function notifyPlanChange(userId: string, premium: boolean, note: string) {
  await notify(userId, { type: 'billing', title: premium ? 'Premium is active' : 'You are on the Free plan', body: note, link: '/premium' });
}
