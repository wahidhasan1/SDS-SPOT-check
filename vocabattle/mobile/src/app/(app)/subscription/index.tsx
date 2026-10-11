import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Linking, View } from 'react-native';

import { Badge, Banner, Button, Card, ErrorView, Icon, LoadingView, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { env } from '@/lib/env';

const FEATURES: { key: string; label: string; format?: (v: unknown) => string }[] = [
  { key: 'battles_per_day', label: 'Anonymous battles per day' },
  { key: 'vocab_collection_max', label: 'Saved vocabulary' },
  { key: 'ai_word_lookups_per_day', label: 'AI word explanations / day (Phase 2)' },
  { key: 'ocr_pages_per_day', label: 'Book pages scanned / day (Phase 2)' },
  { key: 'page_translations_per_day', label: 'Full-page translations / day (Phase 2)' },
  { key: 'writing_feedback_per_day', label: 'AI writing feedback / day (Phase 3)' },
  { key: 'gender_preference', label: 'Choose opponent gender preference' },
  { key: 'advanced_analytics', label: 'Detailed performance analytics' },
];

const show = (v: unknown) => (v === null || v === undefined ? 'Unlimited*' : v === true ? '✓' : v === false ? '—' : String(v));

/** Subscription plans. Limits come from the server config, so they always match what is enforced. */
export default function Plans() {
  const plans = useQuery({ queryKey: ['plans'], queryFn: api.getPlansConfig });
  const ent = useQuery({ queryKey: ['entitlements'], queryFn: api.getEntitlements });
  if (plans.isPending) return <LoadingView />;
  if (plans.error) return <Screen title="Plans" back><ErrorView error={plans.error} onRetry={() => plans.refetch()} /></Screen>;
  const p = plans.data!;
  const premium = ent.data?.plan === 'premium';

  return (
    <Screen title="Vocabattle Premium" subtitle="Learning stays free. Premium expands what you can do each day." back>
      {premium ? <Banner tone="success" title="You're Premium" message="Thank you for supporting Vocabattle." /> : null}
      <Banner tone="phase" title="In-app purchases are not enabled in this build"
        message="Store products (App Store / Google Play via RevenueCat) must be configured before anyone can subscribe. Premium status is only ever granted by the verified billing webhook — never by this screen." />

      <Row gap={Spacing.sm} style={{ alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }}>
          <Badge label="Monthly" tone="primary" />
          <Text variant="h2">Premium</Text>
          <Text variant="small" color="textMuted">Price shown by your app store</Text>
          <Button title="Subscribe" disabled size="sm" />
        </Card>
        <Card style={{ flex: 1 }} tone="primary">
          <Badge label="Annual · best value" tone="success" />
          <Text variant="h2">Premium</Text>
          <Text variant="small" color="textMuted">Price shown by your app store</Text>
          <Button title="Subscribe" disabled size="sm" />
        </Card>
      </Row>

      <SectionHeader title="Compare plans" />
      <Card>
        <Row><Text variant="tiny" color="textMuted" style={{ flex: 2 }}>FEATURE</Text><Text variant="tiny" color="textMuted" style={{ flex: 1 }} align="center">FREE</Text><Text variant="tiny" color="primary" style={{ flex: 1 }} align="center">PREMIUM</Text></Row>
        {FEATURES.map((f) => (
          <Row key={f.key} style={{ paddingVertical: 6 }}>
            <Text variant="small" style={{ flex: 2 }}>{f.label}</Text>
            <Text variant="smallStrong" style={{ flex: 1 }} align="center">{show(p.free[f.key])}</Text>
            <Text variant="smallStrong" color="primary" style={{ flex: 1 }} align="center">{show(p.premium[f.key])}</Text>
          </Row>
        ))}
        <Text variant="tiny" color="textFaint">*Subject to fair-use and anti-abuse limits. Premium battles have a high daily fair-use ceiling.</Text>
      </Card>
      <Card>
        {['Unlimited quizzes, vocabulary and spaced review on every plan', 'Advanced IELTS practice and extra practice tests (Phase 3)', 'Expanded AI reading assistance (Phase 2)'].map((t) => (
          <Row key={t} style={{ alignItems: 'flex-start' }}><Icon name="checkmark-circle" color="success" size={18} /><Text variant="small" style={{ flex: 1 }}>{t}</Text></Row>
        ))}
      </Card>

      <View style={{ gap: Spacing.sm }}>
        <Button title="Restore purchases" variant="secondary" disabled />
        <Button title="Manage subscription" variant="secondary" onPress={() => router.push('/subscription/manage')} />
        <Row style={{ justifyContent: 'center' }} gap={Spacing.lg}>
          <Button title="Terms of Service" variant="ghost" size="sm" disabled={!env.termsUrl} onPress={() => Linking.openURL(env.termsUrl)} />
          <Button title="Privacy Policy" variant="ghost" size="sm" disabled={!env.privacyUrl} onPress={() => Linking.openURL(env.privacyUrl)} />
        </Row>
      </View>
    </Screen>
  );
}
