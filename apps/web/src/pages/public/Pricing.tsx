import { Check } from 'lucide-react';
import { PLAN_INFO } from '@fluentpath/shared';
import { ButtonLink } from '../../components/ui';
import { useAuth } from '../../lib/auth';

export default function Pricing() {
  const { me } = useAuth();
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="text-center text-4xl font-bold">Simple plans</h1>
      <p className="muted mx-auto mt-3 max-w-xl text-center">Start free with real learning features. Upgrade when you want higher limits and extra practice.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {(['free', 'premium'] as const).map((id) => (
          <div key={id} className={`card p-6 ${id === 'premium' ? 'ring-2 ring-brand-500' : ''}`}>
            <h2 className="text-xl font-semibold">{PLAN_INFO[id].name}</h2>
            <div className="mt-2 text-3xl font-bold">{PLAN_INFO[id].priceLabel}</div>
            <ul className="mt-6 space-y-2.5 text-sm">
              {PLAN_INFO[id].perks.map((p) => (
                <li key={p} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-600" />{p}</li>
              ))}
            </ul>
            <div className="mt-6">
              <ButtonLink to={me ? '/premium' : '/register'} variant={id === 'premium' ? 'primary' : 'secondary'} className="w-full">
                {id === 'premium' ? 'Get Premium' : 'Start free'}
              </ButtonLink>
            </div>
          </div>
        ))}
      </div>
      <p className="muted mt-6 text-center text-xs">Payments are processed by Stripe when configured. Mobile app subscriptions follow App Store and Google Play rules.</p>
    </div>
  );
}
