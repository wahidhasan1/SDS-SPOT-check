import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { PLAN_INFO, PLAN_LIMITS } from '@fluentpath/shared';
import { config } from '../config';
import { db, schema } from '../db';
import { badRequest, forbidden, HttpError } from '../lib/errors';
import { requireUser } from '../plugins/auth';
import { userTimezone } from '../services/activity';
import { devSubscriptionsEnabled, getStripe, notifyPlanChange, paymentsConfigured, setSubscription, syncStripeSubscription } from '../services/billing';
import { getPlan, getSubscription, getUsage } from '../services/entitlements';

export async function billingRoutes(app: FastifyInstance) {
  app.get('/api/billing', async (req) => {
    const u = requireUser(req);
    const plan = await getPlan(u.id);
    return {
      plan,
      subscription: await getSubscription(u.id),
      paymentsConfigured: paymentsConfigured(),
      devMode: devSubscriptionsEnabled(),
      plans: PLAN_INFO,
      limits: PLAN_LIMITS,
      usage: await getUsage(u.id, await userTimezone(u.id)),
    };
  });

  app.post('/api/billing/checkout', async (req) => {
    const u = requireUser(req);
    const stripe = getStripe();
    if ((await getPlan(u.id)) === 'premium') throw badRequest('You already have Premium.');
    const sub = await getSubscription(u.id);
    let customer = sub?.providerCustomerId ?? undefined;
    if (!customer) {
      const c = await stripe.customers.create({ email: u.email, metadata: { userId: u.id } });
      customer = c.id;
      await setSubscription(u.id, { providerCustomerId: customer });
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: u.id,
      line_items: [{ price: config.stripePriceId, quantity: 1 }],
      subscription_data: { metadata: { userId: u.id } },
      success_url: `${config.appUrl}/premium?checkout=success`,
      cancel_url: `${config.appUrl}/premium?checkout=cancelled`,
    });
    return { url: session.url };
  });

  app.post('/api/billing/portal', async (req) => {
    const u = requireUser(req);
    const stripe = getStripe();
    const sub = await getSubscription(u.id);
    if (!sub?.providerCustomerId) throw badRequest('No billing account found.');
    const portal = await stripe.billingPortal.sessions.create({ customer: sub.providerCustomerId, return_url: `${config.appUrl}/premium` });
    return { url: portal.url };
  });

  // Development mode: lets testers try Premium features when no payment provider is configured.
  // It never charges money, is labelled "development" everywhere and is disabled in production.
  app.post('/api/billing/dev/activate', async (req) => {
    const u = requireUser(req);
    if (!devSubscriptionsEnabled()) throw forbidden('Development subscriptions are disabled on this server.');
    await setSubscription(u.id, { plan: 'premium', status: 'active', provider: 'development', currentPeriodEnd: new Date(Date.now() + 30 * 86400_000), cancelAtPeriodEnd: false });
    await notifyPlanChange(u.id, true, 'Premium was activated in development mode for 30 days. No payment was taken.');
    return { ok: true };
  });

  app.post('/api/billing/dev/cancel', async (req) => {
    const u = requireUser(req);
    const sub = await getSubscription(u.id);
    if (sub?.provider !== 'development' && sub?.provider !== 'admin') throw badRequest('Only development or admin-granted subscriptions can be cancelled here.');
    await setSubscription(u.id, { plan: 'free', status: 'active', provider: 'none', currentPeriodEnd: null });
    return { ok: true };
  });

  // Stripe webhooks need the raw body to verify the signature.
  await app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
    scope.post('/api/billing/webhook', async (req, reply) => {
      if (!paymentsConfigured() || !config.stripeWebhookSecret) throw new HttpError(503, 'not_configured', 'Webhooks are not configured.');
      const stripe = getStripe();
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, String(req.headers['stripe-signature'] ?? ''), config.stripeWebhookSecret);
      } catch {
        return reply.code(400).send({ error: { code: 'bad_signature', message: 'Invalid signature.' } });
      }
      switch (event.type) {
        case 'checkout.session.completed': {
          const s = event.data.object as Stripe.Checkout.Session;
          if (s.subscription) {
            const sub = await stripe.subscriptions.retrieve(typeof s.subscription === 'string' ? s.subscription : s.subscription.id);
            await syncStripeSubscription(sub, s.client_reference_id);
            if (s.client_reference_id) await notifyPlanChange(s.client_reference_id, true, 'Thank you! Your Premium subscription is active.');
          }
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await syncStripeSubscription(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_failed': {
          const inv = event.data.object as Stripe.Invoice;
          const customer = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
          if (customer) {
            const [row] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.providerCustomerId, customer));
            if (row) await notifyPlanChange(row.userId, true, 'Your last payment failed. Please update your payment method to keep Premium.');
          }
          break;
        }
      }
      return { received: true };
    });
  });
}
