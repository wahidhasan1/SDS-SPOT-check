import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Avatar, Badge, Card, EmptyState, ErrorView, LevelBadge, LoadingView, Row, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';

const MODE: Record<string, string> = { vocab_duel: 'Vocabulary Duel', syn_ant: 'Synonym & Antonym', sentence: 'Sentence Challenge', grammar: 'Grammar Battle', ielts: 'IELTS Challenge' };

/** Battle history. */
export default function BattleHistory() {
  const q = useQuery({ queryKey: ['battle-history'], queryFn: () => api.getBattleHistory(50) });
  if (q.isPending) return <LoadingView />;
  if (q.error) return <Screen title="Battle history" back><ErrorView error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const items = q.data!;
  return (
    <Screen title="Battle history" subtitle="Opponents are shown by the pseudonym they used." back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {items.length === 0 ? (
        <EmptyState icon="flash-outline" title="No battles yet" message="Your completed battles will appear here." />
      ) : items.map((b) => (
        <Card key={b.battle_id} onPress={() => router.push(`/arena/${b.battle_id}`)}>
          <Row gap={Spacing.md}>
            <Avatar emoji={b.opponent_avatar} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Row><Text variant="bodyStrong">vs {b.opponent_alias}</Text><LevelBadge level={b.opponent_level} /></Row>
              <Text variant="small" color="textMuted">{MODE[b.mode] ?? b.mode} · {b.my_score}–{b.opponent_score} · {b.my_correct}/{b.question_count} correct</Text>
              <Text variant="tiny" color="textFaint">{new Date(b.ended_at).toLocaleString()}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge label={b.status === 'void' ? 'void' : b.result ?? '—'} tone={b.result === 'win' ? 'success' : b.result === 'loss' ? 'danger' : 'muted'} />
              {b.status !== 'void' ? <Text variant="smallStrong" color={b.rating_delta >= 0 ? 'success' : 'danger'}>{b.rating_delta >= 0 ? '+' : ''}{b.rating_delta}</Text> : null}
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
