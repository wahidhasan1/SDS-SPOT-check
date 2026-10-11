import { useQuery } from '@tanstack/react-query';
import { Linking, Platform } from 'react-native';

import { Badge, Banner, Button, Card, ErrorView, LoadingView, ProgressBar, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { api } from '@/lib/api';

const USAGE: { key: string; label: string }[] = [
  { key: 'battles_per_day', label: 'Battles today' },
  { key: 'ai_word_lookups_per_day', label: 'AI word explanations today' },
  { key: 'ocr_pages_per_day', label: 'Pages scanned today' },
  { key: 'page_translations_per_day', label: 'Page translations today' },
];

/** Subscription management: server-verified plan status and today's usage. */
export default function ManageSubscription() {
  const q = useQuery({ queryKey: ['entitlements'], queryFn: api.getEntitlements });
  if (q.isPending) return <LoadingView />;
  if (q.error) return <Screen title="Subscription" back><ErrorView error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const e = q.data!;
  const storeUrl = Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions';

  return (
    <Screen title="Subscription" back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="h2">{e.plan === 'premium' ? 'Premium' : 'Free'}</Text>
          <Badge label="Verified by server" tone="success" icon="shield-checkmark" />
        </Row>
        {e.subscription ? (
          <>
            <Text color="textMuted">Status: {e.subscription.status.replace(/_/g, ' ')} · {e.subscription.billing_period ?? ''}</Text>
            {e.subscription.current_period_end ? <Text color="textMuted">{e.subscription.will_renew ? 'Renews' : 'Ends'} on {new Date(e.subscription.current_period_end).toLocaleDateString()}</Text> : null}
            <Text variant="small" color="textFaint">Billed through {e.subscription.provider.replace(/_/g, ' ')}.</Text>
          </>
        ) : <Text color="textMuted">You’re on the free plan.</Text>}
      </Card>
      <SectionHeader title="Today's usage" />
      <Card>
        {USAGE.map((u) => {
          const limit = e.limits[u.key] as number | null | undefined;
          const used = e.usage[u.key] ?? 0;
          return (
            <Row key={u.key} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}><Text variant="small">{u.label}</Text><Text variant="smallStrong">{used} / {limit ?? '∞'}</Text></Row>
              {limit ? <ProgressBar value={used / limit} tone={used >= limit ? 'danger' : 'primary'} height={6} /> : null}
            </Row>
          );
        })}
      </Card>
      {Platform.OS !== 'web' ? <Button title="Manage in app store" variant="secondary" icon="open-outline" onPress={() => Linking.openURL(storeUrl)} />
        : <Banner tone="info" message="Subscriptions are purchased and managed in the iOS and Android apps." />}
    </Screen>
  );
}
