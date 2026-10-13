import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Check, Crown } from 'lucide-react';
import { FEATURE_LABELS, type Feature, type PlanId } from '@fluentpath/shared';
import { Alert, Badge, Button, Card, CardHeader, ErrorState, PageHeader, PageLoader, ProgressBar, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDate } from '../../lib/format';
import { useApi } from '../../lib/useApi';

interface Billing {
  plan: PlanId;
  subscription: { plan: PlanId; status: string; provider: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  paymentsConfigured: boolean;
  devMode: boolean;
  plans: Record<PlanId, { name: string; priceLabel: string; perks: string[] }>;
  limits: Record<PlanId, Record<Feature, number | null>>;
  usage: Partial<Record<Feature, number>>;
}

export default function Premium() {
  const { refresh } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const { data, error, loading, reload } = useApi<Billing>('/api/billing');
  const [busy, setBusy] = useState(false);
  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;
  const sub = data.subscription;
  const premium = data.plan === 'premium';

  const go = async (path: string) => {
    setBusy(true);
    try {
      const r = await api.post<{ url?: string }>(path);
      if (r.url) window.location.href = r.url;
      else {
        await refresh();
        await reload();
        toast(path.includes('activate') ? 'Premium activated in development mode' : 'Plan updated');
      }
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="FluentPath Premium" description="Higher limits, every mock test and practice set, detailed AI feedback and advanced analytics." />
      {params.get('checkout') === 'success' && <Alert tone="success" className="mb-4">Thank you! Your payment is being confirmed. Premium appears here as soon as Stripe confirms it (usually within seconds).</Alert>}
      {params.get('checkout') === 'cancelled' && <Alert tone="info" className="mb-4">Checkout was cancelled. You have not been charged.</Alert>}

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="muted text-sm">Current plan</div>
            <div className="mt-1 flex items-center gap-2 text-2xl font-bold">{premium && <Crown className="h-6 w-6 text-amber-500" />}{data.plans[data.plan].name}</div>
            {sub?.provider === 'development' && <Badge tone="amber" className="mt-1">Development mode — no payment was taken</Badge>}
            {sub?.provider === 'admin' && <Badge tone="violet" className="mt-1">Granted by an administrator</Badge>}
            {premium && sub?.currentPeriodEnd && <p className="muted mt-1 text-sm">{sub.cancelAtPeriodEnd || sub.provider !== 'stripe' ? 'Ends' : 'Renews'} {formatDate(sub.currentPeriodEnd)}</p>}
            {sub?.status === 'past_due' && <Alert tone="warning" className="mt-2">Your last payment failed. Please update your payment method.</Alert>}
          </div>
          <div className="flex flex-wrap gap-2">
            {!premium && data.paymentsConfigured && <Button size="lg" icon={<Crown className="h-5 w-5" />} loading={busy} onClick={() => go('/api/billing/checkout')}>Upgrade — {data.plans.premium.priceLabel}</Button>}
            {premium && sub?.provider === 'stripe' && <Button variant="secondary" loading={busy} onClick={() => go('/api/billing/portal')}>Manage subscription</Button>}
            {premium && (sub?.provider === 'development' || sub?.provider === 'admin') && <Button variant="secondary" loading={busy} onClick={() => go('/api/billing/dev/cancel')}>Return to Free</Button>}
          </div>
        </div>
        {!data.paymentsConfigured && (
          <Alert tone="info" className="mt-4" title="Payments are not configured on this server">
            {data.devMode ? (
              <>
                No real purchases can be made here yet. For testing, you can turn on Premium in <strong>development mode</strong> for 30 days — no money is charged and it is clearly labelled as a test.
                {!premium && <div className="mt-3"><Button size="sm" loading={busy} onClick={() => go('/api/billing/dev/activate')}>Activate Premium (development mode)</Button></div>}
              </>
            ) : 'Premium will be available once the operator configures Stripe.'}
          </Alert>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {(['free', 'premium'] as const).map((id) => (
          <Card key={id} className={`p-6 ${id === 'premium' ? 'ring-2 ring-brand-500' : ''}`}>
            <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{data.plans[id].name}</h2>{data.plan === id && <Badge tone="green">Your plan</Badge>}</div>
            <div className="mt-1 text-2xl font-bold">{data.plans[id].priceLabel}</div>
            <ul className="mt-4 space-y-2 text-sm">{data.plans[id].perks.map((p) => <li key={p} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{p}</li>)}</ul>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader title="Today’s usage" subtitle="Limits reset at midnight in your time zone" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {(Object.keys(FEATURE_LABELS) as Feature[]).map((f) => {
            const limit = data.limits[data.plan][f];
            const used = data.usage[f] ?? 0;
            return (
              <div key={f}>
                <div className="mb-1 flex justify-between text-sm"><span>{FEATURE_LABELS[f]}</span><span className="muted">{used} / {limit ?? '∞'}</span></div>
                {limit != null ? <ProgressBar value={used} max={limit} tone={used >= limit ? 'amber' : 'brand'} /> : <div className="h-2 rounded-full bg-emerald-100 dark:bg-emerald-900/40" />}
              </div>
            );
          })}
        </div>
      </Card>
      <p className="muted mt-4 text-xs">Subscriptions bought on the web are processed by Stripe. In the mobile apps, digital subscriptions must use App Store / Google Play billing; until that is set up, the apps show your plan but do not sell subscriptions.</p>
    </div>
  );
}
