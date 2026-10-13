import { Stack } from 'expo-router';
import { FEATURE_LABELS, PLAN_INFO, PLAN_LIMITS, type Feature } from '@fluentpath/shared';
import { Badge, Card, H2, Loading, Notice, P, Screen } from '../src/components/ui';
import { useAuth } from '../src/lib/auth';

export default function Premium() {
  const { me } = useAuth();
  if (!me) return <Screen><Loading /></Screen>;
  const features = Object.keys(FEATURE_LABELS) as Feature[];
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Your plan' }} />
      <Card>
        <H2>Current plan: {PLAN_INFO[me.plan].name}</H2>
        {me.subscription && <Badge text={`${me.subscription.status}${me.subscription.currentPeriodEnd ? ` · renews ${new Date(me.subscription.currentPeriodEnd).toLocaleDateString()}` : ''}`} tone="slate" />}
      </Card>
      {(['free', 'premium'] as const).map((plan) => (
        <Card key={plan}>
          <H2>{PLAN_INFO[plan].name} · {PLAN_INFO[plan].priceLabel}</H2>
          {PLAN_INFO[plan].perks.map((p) => <P key={p}>• {p}</P>)}
          {features.map((f) => <P key={f} muted>{FEATURE_LABELS[f]}: {PLAN_LIMITS[plan][f] ?? 'unlimited'}</P>)}
        </Card>
      ))}
      <Notice text="This app does not offer in-app purchases. Your plan is linked to your account and is the same on every device." />
    </Screen>
  );
}
