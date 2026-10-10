import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Badge, Banner, Button, Card, ErrorView, Icon, LevelBadge, LoadingView, ProgressRing, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { levelNames, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { recommendationHref } from '@/lib/navigation';
import { useAuth } from '@/providers/auth-provider';

/** Assessment results: provisional level, score, strengths, weaknesses and next steps. */
export default function AssessmentResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, refreshProfile } = useAuth();
  const q = useQuery({ queryKey: ['assessment-result', id], queryFn: () => api.getAssessmentResult(id!), enabled: !!id });
  const [leaving, setLeaving] = useState(false);
  const [firstTime] = useState(() => profile?.onboarding_step !== 'done');

  // Navigate only after the navigator has re-rendered with onboarding complete
  // (until then the home routes are still protected).
  useEffect(() => {
    if (!leaving || profile?.onboarding_step !== 'done') return;
    const t = setTimeout(() => router.replace('/'), 0);
    return () => clearTimeout(t);
  }, [leaving, profile?.onboarding_step]);

  if (q.isPending) return <LoadingView label="Calculating your level…" />;
  if (q.error || !q.data) return <Screen title="Results" back><ErrorView error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const r = q.data;

  const finish = async () => {
    setLeaving(true);
    await refreshProfile();
  };

  return (
    <Screen
      title={r.kind === 'initial' ? 'Your starting level' : 'Level check result'}
      footer={<Button testID="assessment-continue" title={firstTime ? 'Go to my dashboard' : 'Done'} size="lg" loading={leaving} onPress={finish} />}>
      <Card style={{ alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl }}>
        <Text variant="tiny" color="textMuted">ESTIMATED ENGLISH PROFICIENCY</Text>
        <Text variant="display" testID="assessment-level">{r.level}</Text>
        <LevelBadge level={r.level} provisional size="lg" />
        {r.kind === 'retake' && r.estimated_level !== r.level ? (
          <Text variant="small" color="textMuted" align="center">
            This attempt estimated {r.estimated_level}. Levels move one step per check so a single attempt can’t swing your level.
          </Text>
        ) : null}
      </Card>

      <Row gap={Spacing.md}>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <ProgressRing value={r.score / 100} tone="success"><Text variant="h3">{r.score}%</Text></ProgressRing>
          <Text variant="small" color="textMuted">Assessment score</Text>
          <Text variant="smallStrong">{r.correct} / {r.total} correct</Text>
        </Card>
        <Card style={{ flex: 1, gap: 6 }}>
          <Text variant="smallStrong">What {r.level} means</Text>
          <Text variant="small" color="textMuted">{levelNames[r.level]} learners {LEVEL_DESCRIPTIONS[r.level]}</Text>
        </Card>
      </Row>

      <SectionHeader title="Strong areas" />
      <Row wrap>
        {r.strengths.length ? r.strengths.map((s) => <Badge key={s.key} tone="success" icon="checkmark" label={`${s.label} · ${s.accuracy}%`} />)
          : <Text color="textMuted">Keep practising — strengths will appear as you learn.</Text>}
      </Row>
      <SectionHeader title="Areas to improve" />
      <Row wrap>
        {r.weaknesses.length ? r.weaknesses.map((s) => <Badge key={s.key} tone="warning" icon="trending-up" label={`${s.label} · ${s.accuracy}%`} />)
          : <Text color="textMuted">No clear weak spots in this short test.</Text>}
      </Row>

      <SectionHeader title="Recommended next" />
      <View style={{ gap: Spacing.sm }}>
        {r.recommendations.map((rec, i) => (
          <Card key={i} onPress={firstTime ? undefined : () => router.push(recommendationHref(rec))}>
            <Row gap={Spacing.md}>
              <Icon name={rec.kind === 'battle' ? 'flash' : rec.kind === 'topics' ? 'library' : 'create'} color="primary" />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{rec.title}</Text>
                <Text variant="small" color="textMuted">{rec.description}</Text>
              </View>
            </Row>
          </Card>
        ))}
      </View>
      <Banner tone="info" message={r.disclaimer} />
    </Screen>
  );
}

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  A1: 'understand and use familiar everyday words and very basic phrases.',
  A2: 'handle routine tasks and common expressions about familiar topics.',
  B1: 'deal with most everyday situations and understand the main points of clear texts.',
  B2: 'understand complex texts and discuss a wide range of topics with some fluency.',
  C1: 'use English flexibly for academic and professional purposes with precise vocabulary.',
  C2: 'understand almost everything and express themselves with nuance and precision.',
};
