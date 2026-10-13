import { useState } from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { errorMessage } from '../src/lib/api';
import { buyPremium, purchasesConfigured, restorePurchases } from '../src/lib/purchases';
import { useApi } from '../src/lib/hooks';
import { Button, Card, ErrorText, H2, Notice, P, Row, Screen } from '../src/components/ui';

export default function Subscription() {
  const { user, entitlements, refreshEntitlements } = useAuth();
  const plans = useApi<any>('/billing/plans');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fmt = (v: any) => (v === null ? 'Unlimited' : v === true ? '✓' : v === false ? '—' : String(v));
  const free = plans.data?.plans.find((p: any) => p.id === 'free')?.limits;
  const prem = plans.data?.plans.find((p: any) => p.id === 'premium')?.limits;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Your plan' }} />
      <H2>{entitlements?.planName ?? '…'}</H2>
      {msg && <Notice tone="success" text={msg} />}
      <ErrorText error={err} />
      {free && prem && (
        <Card>
          {[['callsPerDay', 'Calls per day'], ['maxCallMinutes', 'Minutes per call'], ['mockTestsPerMonth', 'Mock tests / 30 days'], ['aiWritingFeedbackPerDay', 'Writing evaluations / day'], ['aiReadingScansPerDay', 'Photo scans / day'], ['premiumTopics', 'All call topics']].map(([k, l]) => (
            <Row key={k} between><P small>{l}</P><P small>{fmt(free[k])} → {fmt(prem[k])}</P></Row>
          ))}
        </Card>
      )}
      {entitlements?.plan === 'premium' ? <Notice tone="success" text="You have Premium. Manage or cancel it in your app store account." /> : (
        purchasesConfigured ? (
          <Button title="Upgrade to Premium" onPress={async () => { try { setMsg(await buyPremium(user!.id)); await refreshEntitlements(); } catch (e) { setErr(errorMessage(e)); } }} />
        ) : <Notice text="In-app purchases are not configured in this build yet." />
      )}
      <Button variant="secondary" title="Restore purchases" onPress={async () => { try { await restorePurchases(user!.id); await refreshEntitlements(); setMsg('Purchases restored.'); } catch (e) { setErr(errorMessage(e)); } }} />
      <P small muted>Premium is linked to your account, so it also works on the web. Purchases are verified by our server.</P>
    </Screen>
  );
}
