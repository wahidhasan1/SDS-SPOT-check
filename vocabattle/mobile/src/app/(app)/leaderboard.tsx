import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Banner, Button, Card, EmptyState, ErrorView, LevelBadge, LoadingView, Row, Screen, Segmented, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import type { Leaderboard as LB, LeaderboardEntry } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

type Period = LB['period'];

/** Leaderboards (daily / weekly / monthly by rating gained, global by rating). */
export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>('weekly');
  const q = useQuery({ queryKey: ['leaderboard', period], queryFn: () => api.getLeaderboard(period) });

  return (
    <Screen title="Leaderboards" subtitle="Battle rating only — not a measure of English proficiency." back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Segmented<Period> value={period} onChange={setPeriod} options={[
        { value: 'daily', label: 'Today' }, { value: 'weekly', label: 'Week' }, { value: 'monthly', label: 'Month' }, { value: 'global', label: 'All-time' },
      ]} />
      {q.isPending ? <LoadingView /> : q.error ? <ErrorView error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          <Text variant="small" color="textMuted">{q.data!.metric === 'rating' ? 'Ranked by current battle rating.' : 'Ranked by rating gained in rated battles this period.'}</Text>
          {!q.data!.participating ? (
            <Banner tone="info" message="You've hidden yourself from leaderboards.">
              <Button title="Privacy settings" variant="ghost" size="sm" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => router.push('/settings/privacy')} />
            </Banner>
          ) : null}
          {q.data!.entries.length === 0 ? (
            <EmptyState icon="podium-outline" title="No ranked battles yet" message="Win a rated battle to claim the top spot." />
          ) : (
            <Card>
              {q.data!.entries.map((e) => <EntryRow key={`${e.rank}-${e.username}`} e={e} metric={q.data!.metric} />)}
            </Card>
          )}
          {q.data!.me && !q.data!.entries.some((e) => e.is_me) ? (
            <Card tone="primary"><EntryRow e={q.data!.me} metric={q.data!.metric} /></Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function EntryRow({ e, metric }: { e: LeaderboardEntry; metric: LB['metric'] }) {
  const { colors } = useTheme();
  const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : null;
  return (
    <Row gap={Spacing.md} style={{ paddingVertical: 6, backgroundColor: e.is_me ? colors.primarySoft : 'transparent', borderRadius: 8 }}>
      <View style={{ width: 32, alignItems: 'center' }}>{medal ? <Text variant="h3">{medal}</Text> : <Text variant="bodyStrong" color="textMuted">{e.rank}</Text>}</View>
      <Avatar emoji={e.avatar} size={34} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>{e.username}{e.is_me ? ' (you)' : ''}</Text>
        <Text variant="tiny" color="textMuted">{e.wins} WINS · {e.games} GAMES</Text>
      </View>
      <LevelBadge level={e.level} />
      <Text variant="h3" color={metric === 'rating_gained' && e.value < 0 ? 'danger' : 'text'}>{metric === 'rating_gained' && e.value > 0 ? '+' : ''}{e.value}</Text>
    </Row>
  );
}
