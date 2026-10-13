import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { one, q, tx } from '../db/pool';
import { requireAuth } from '../lib/auth';
import { hmacSha256Hex, safeEqual } from '../lib/crypto';
import { HttpError, badRequest, notConfigured, unauthorized } from '../lib/errors';
import { getEntitlements } from '../services/entitlements';
import { notify } from '../services/notifications';

async function stripe(path: string, params: Record<string, string>) {
  if (!config.stripeSecretKey) throw notConfigured('Web payments are not configured yet.');
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.stripeSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data: any = await res.json();
  if (!res.ok) throw new HttpError(502, 'payment_provider_error', data?.error?.message ?? 'The payment provider returned an error.');
  return data;
}

const STRIPE_STATUS: Record<string, string> = {
  active: 'active', trialing: 'trialing', past_due: 'past_due', unpaid: 'past_due', canceled: 'canceled', incomplete_expired: 'expired', paused: 'canceled',
};

/** Verifies Stripe's webhook signature (t=…,v1=…) over the raw request body. */
export function verifyStripeSignature(raw: string, header: string | undefined, secret: string, toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = hmacSha256Hex(secret, `${t}.${raw}`);
  return header.split(',').filter((p) => p.startsWith('v1=')).some((p) => safeEqual(p.slice(3), expected));
}

async function recordEvent(provider: string, eventId: string, type: string, payload: unknown): Promise<boolean> {
  const r = await q(
    `INSERT INTO billing_events (provider, event_id, event_type, payload) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id`,
    [provider, eventId, type, payload],
  );
  return r.length > 0; // false = already processed (idempotency)
}

async function upsertSubscription(s: {
  userId: string;
  provider: string;
  ref: string;
  status: string;
  periodEnd: Date | null;
  cancelAtPeriodEnd?: boolean;
  customer?: string | null;
  environment?: string | null;
}) {
  await q(
    `INSERT INTO subscriptions (user_id, plan_id, provider, provider_ref, status, current_period_end, cancel_at_period_end, provider_customer, environment)
     VALUES ($1,'premium',$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (provider, provider_ref) DO UPDATE SET status=EXCLUDED.status, current_period_end=EXCLUDED.current_period_end,
       cancel_at_period_end=EXCLUDED.cancel_at_period_end, provider_customer=COALESCE(EXCLUDED.provider_customer, subscriptions.provider_customer),
       environment=COALESCE(EXCLUDED.environment, subscriptions.environment), updated_at=now()`,
    [s.userId, s.provider, s.ref, s.status, s.periodEnd, !!s.cancelAtPeriodEnd, s.customer ?? null, s.environment ?? null],
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function billingRoutes(app: FastifyInstance) {
  app.get('/billing/plans', async () => {
    const plans = await q('SELECT id, name, limits, price_display FROM plans ORDER BY id');
    return {
      plans,
      web: { available: !!config.stripeSecretKey && !!config.stripePremiumPriceId },
      mobile: { available: !!config.revenueCatWebhookAuth },
    };
  });

  app.register(async (r) => {
    r.addHook('preHandler', requireAuth);

    r.get('/billing/status', async (req) => {
      const ent = await getEntitlements(req.userId);
      const subs = await q(
        `SELECT provider, status, current_period_end, cancel_at_period_end, created_at FROM subscriptions WHERE user_id=$1 ORDER BY updated_at DESC`,
        [req.userId],
      );
      return { entitlements: ent, subscriptions: subs };
    });

    r.post('/billing/checkout', async (req) => {
      if (!config.stripeSecretKey || !config.stripePremiumPriceId) throw notConfigured('Web payments are not configured yet. Premium cannot be purchased on the web until Stripe keys are added.');
      const ent = await getEntitlements(req.userId);
      if (ent.plan === 'premium') throw badRequest('You already have Premium.');
      const u = await one<any>('SELECT email FROM users WHERE id=$1', [req.userId]);
      const existing = await one<any>(`SELECT provider_customer FROM subscriptions WHERE user_id=$1 AND provider='stripe' AND provider_customer IS NOT NULL LIMIT 1`, [req.userId]);
      const params: Record<string, string> = {
        mode: 'subscription',
        'line_items[0][price]': config.stripePremiumPriceId,
        'line_items[0][quantity]': '1',
        success_url: `${config.publicWebUrl}/subscription?checkout=success`,
        cancel_url: `${config.publicWebUrl}/subscription?checkout=cancelled`,
        client_reference_id: req.userId,
        'metadata[user_id]': req.userId,
        'subscription_data[metadata][user_id]': req.userId,
      };
      if (existing?.provider_customer) params.customer = existing.provider_customer;
      else params.customer_email = u.email;
      const session = await stripe('checkout/sessions', params);
      return { url: session.url };
    });

    r.post('/billing/portal', async (req) => {
      const c = await one<any>(`SELECT provider_customer FROM subscriptions WHERE user_id=$1 AND provider='stripe' AND provider_customer IS NOT NULL ORDER BY updated_at DESC LIMIT 1`, [req.userId]);
      if (!c) throw badRequest('No web subscription was found for your account.');
      const s = await stripe('billing_portal/sessions', { customer: c.provider_customer, return_url: `${config.publicWebUrl}/subscription` });
      return { url: s.url };
    });

    /** Mobile "Restore purchases": re-reads entitlements from RevenueCat's server API (never trusts the client). */
    r.post('/billing/restore', async (req) => {
      if (!config.revenueCatApiKey) throw notConfigured('Restoring app-store purchases is not configured on the server (REVENUECAT_API_KEY).');
      const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(req.userId)}`, {
        headers: { Authorization: `Bearer ${config.revenueCatApiKey}` },
      });
      if (!res.ok) throw new HttpError(502, 'payment_provider_error', 'Could not reach the app store purchase service.');
      const data: any = await res.json();
      const ent = data?.subscriber?.entitlements?.[config.revenueCatEntitlementId];
      if (ent) {
        const expires = ent.expires_date ? new Date(ent.expires_date) : null;
        await upsertSubscription({
          userId: req.userId,
          provider: 'revenuecat',
          ref: `${req.userId}:${config.revenueCatEntitlementId}`,
          status: !expires || expires > new Date() ? 'active' : 'expired',
          periodEnd: expires,
        });
      }
      return getEntitlements(req.userId);
    });
  });

  // ----- Webhooks (raw body needed for signature verification) -----
  app.register(async (r) => {
    r.removeContentTypeParser('application/json');
    r.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
      (req as any).rawBody = body;
      try {
        done(null, JSON.parse(String(body)));
      } catch (e) {
        done(e as Error, undefined);
      }
    });

    r.post('/billing/stripe/webhook', async (req, reply) => {
      if (!config.stripeWebhookSecret) throw notConfigured('Stripe webhook secret is not configured.');
      const raw = (req as any).rawBody as string;
      if (!verifyStripeSignature(raw, req.headers['stripe-signature'] as string, config.stripeWebhookSecret)) {
        return reply.status(400).send({ error: { code: 'bad_signature', message: 'Invalid signature' } });
      }
      const event = req.body as any;
      if (!(await recordEvent('stripe', event.id, event.type, event))) return { received: true, duplicate: true };
      const obj = event.data?.object ?? {};
      if (event.type.startsWith('customer.subscription.')) {
        const userId = obj.metadata?.user_id;
        if (userId && UUID.test(userId)) {
          const periodEnd = obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end;
          const status = event.type === 'customer.subscription.deleted' ? 'canceled' : STRIPE_STATUS[obj.status];
          if (status) {
            await upsertSubscription({
              userId,
              provider: 'stripe',
              ref: obj.id,
              status,
              periodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
              cancelAtPeriodEnd: !!obj.cancel_at_period_end,
              customer: obj.customer,
              environment: event.livemode ? 'production' : 'test',
            });
          }
        }
      } else if (event.type === 'invoice.payment_failed') {
        const sub = await one<any>(`SELECT user_id FROM subscriptions WHERE provider='stripe' AND provider_customer=$1 LIMIT 1`, [obj.customer]);
        if (sub) {
          await notify({ userId: sub.user_id, kind: 'billing', title: 'Payment failed', body: 'We could not renew your Premium subscription. Please update your payment method.', push: true, dedupeKey: `payfail:${obj.id}` });
        }
      }
      return { received: true };
    });

    r.post('/billing/revenuecat/webhook', async (req) => {
      if (!config.revenueCatWebhookAuth) throw notConfigured('RevenueCat webhook is not configured.');
      if (!safeEqual(String(req.headers.authorization ?? ''), config.revenueCatWebhookAuth)) throw unauthorized('Invalid webhook authorization.');
      const event = (req.body as any)?.event;
      if (!event?.id) throw badRequest('Malformed event.');
      if (!(await recordEvent('revenuecat', event.id, event.type, req.body))) return { received: true, duplicate: true };
      const userId = event.app_user_id;
      if (!UUID.test(String(userId))) return { received: true, ignored: 'unknown app_user_id' };
      if (Array.isArray(event.entitlement_ids) && !event.entitlement_ids.includes(config.revenueCatEntitlementId)) return { received: true, ignored: 'other entitlement' };
      const expires = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
      const ref = `${userId}:${config.revenueCatEntitlementId}`;
      const map: Record<string, { status: string; cancel?: boolean }> = {
        INITIAL_PURCHASE: { status: 'active' }, RENEWAL: { status: 'active' }, UNCANCELLATION: { status: 'active' }, PRODUCT_CHANGE: { status: 'active' },
        NON_RENEWING_PURCHASE: { status: 'active' }, CANCELLATION: { status: 'active', cancel: true }, EXPIRATION: { status: 'expired' },
        BILLING_ISSUE: { status: 'past_due' }, SUBSCRIPTION_PAUSED: { status: 'canceled' },
      };
      const m = map[event.type];
      if (m) {
        await upsertSubscription({ userId, provider: 'revenuecat', ref, status: m.status, periodEnd: expires, cancelAtPeriodEnd: m.cancel, environment: event.environment });
        if (event.type === 'BILLING_ISSUE') {
          await notify({ userId, kind: 'billing', title: 'Payment problem', body: 'Your app store could not renew Premium. Please check your payment details in the store.', push: true, dedupeKey: `rc-billing:${event.id}` });
        }
      }
      return { received: true };
    });
  });
}

export { tx };
