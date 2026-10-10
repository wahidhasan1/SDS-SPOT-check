import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge, Card, ErrorView, Icon, LoadingView, ProgressBar, Row, Screen, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { useTheme } from '@/providers/theme-provider';

/** Vocabulary categories. */
export default function VocabTopics() {
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ['topics'], queryFn: api.getTopics });
  if (q.isPending) return <LoadingView />;
  if (q.error) return <Screen title="Vocabulary" back><ErrorView error={q.error} onRetry={() => q.refetch()} /></Screen>;
  return (
    <Screen title="Vocabulary" subtitle="Words are learned when you answer them correctly at least twice." back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <View style={styles.grid}>
        {q.data!.map((t) => (
          <Card key={t.id} style={styles.card} onPress={() => router.push(`/vocab/${t.id}`)} testID={`topic-${t.id}`} accessibilityLabel={t.name}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}><Icon name={t.icon} color="primary" /></View>
              {t.is_premium ? <Badge label="Premium" tone="warning" icon="star" /> : null}
            </Row>
            <Text variant="bodyStrong">{t.name}</Text>
            <Text variant="small" color="textMuted" numberOfLines={2}>{t.description}</Text>
            <ProgressBar value={t.word_count ? t.learned / t.word_count : 0} tone="success" height={6} />
            <Text variant="tiny" color="textMuted">{t.learned}/{t.word_count} LEARNED · {t.levels.join(' ')}</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: { flexGrow: 1, flexBasis: '45%', minWidth: 150 },
  icon: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
