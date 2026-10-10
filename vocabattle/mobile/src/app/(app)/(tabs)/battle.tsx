import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import {
  Avatar, Badge, Banner, Button, Card, ErrorView, Icon, LevelBadge, LoadingView, Row, Screen, SectionHeader, StatTile, Text,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { BATTLE_MODE_KEY } from '@/lib/storage-keys';

/** Battle lobby. */
export default function BattleLobby() {
  const lobby = useQuery({ queryKey: ['battle-lobby'], queryFn: api.getBattleLobby });
  const active = useQuery({ queryKey: ['active-battle'], queryFn: api.getActiveBattle });
  const [modeId, setModeId] = useState('vocab_duel');

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(BATTLE_MODE_KEY).then((m) => { if (m) setModeId(m); }).catch(() => {});
    lobby.refetch();
    active.refetch();
  }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  if (lobby.isPending) return <LoadingView />;
  if (lobby.error || !lobby.data) return <Screen title="Battle"><ErrorView error={lobby.error} onRetry={() => lobby.refetch()} /></Screen>;
  const l = lobby.data;
  const mode = l.modes.find((m) => m.id === modeId && m.enabled) ?? l.modes.find((m) => m.enabled)!;
  const outOfBattles = l.battles_remaining_today !== null && l.battles_remaining_today <= 0;

  return (
    <Screen title="Battle" subtitle="Anonymous, real-time English duels." refreshing={lobby.isRefetching} onRefresh={() => lobby.refetch()}>
      {active.data ? (
        <Card tone="warning" onPress={() => router.push(`/arena/${active.data}`)}>
          <Row><Icon name="flash" color="warning" /><Text variant="bodyStrong" style={{ flex: 1 }}>Battle in progress</Text><Text variant="smallStrong" color="warning">Rejoin →</Text></Row>
        </Card>
      ) : null}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text variant="tiny" color="textMuted">BATTLE RATING</Text>
            <Text variant="display" testID="lobby-rating">{l.rating.rating}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            {l.rating.provisional ? <Badge label="Provisional" tone="info" icon="hourglass" /> : <Badge label={`Peak ${l.rating.peak}`} tone="primary" icon="trending-up" />}
            {l.rating.current_win_streak > 1 ? <Badge label={`${l.rating.current_win_streak} wins in a row`} tone="warning" icon="flame" /> : null}
          </View>
        </Row>
        <Text variant="small" color="textMuted">Your competitive rating is separate from your English proficiency level.</Text>
      </Card>

      <Row gap={Spacing.sm}>
        <StatTile icon="game-controller" label="Battles" value={l.rating.games} />
        <StatTile icon="ribbon" label="W / L / D" value={`${l.rating.wins}/${l.rating.losses}/${l.rating.draws}`} tone="success" />
        <StatTile icon="locate" label="Accuracy" value={l.rating.accuracy !== null ? `${l.rating.accuracy}%` : '—'} tone="info" />
      </Row>

      {!l.assessed ? (
        <Banner tone="warning" title="Assessment needed" message="Battles are matched by level, so complete your assessment first." />
      ) : outOfBattles ? (
        <Banner tone="warning" title="Daily battles used" message={`Your plan includes ${l.battles_limit} battles per day. Practise solo now, or upgrade for more.`}>
          <Button title="See Premium" variant="ghost" size="sm" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => router.push('/subscription')} />
        </Banner>
      ) : null}

      <Card tone="primary">
        <Row gap={Spacing.md}>
          <Icon name={mode.icon} color="primary" size={28} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{mode.name}</Text>
            <Text variant="small" color="textMuted">{mode.description}</Text>
          </View>
          <Button title="Change" variant="ghost" size="sm" onPress={() => router.push('/arena/modes')} testID="lobby-change-mode" />
        </Row>
        <Button
          testID="lobby-start"
          title="Start Random Battle"
          icon="flash"
          size="lg"
          disabled={!l.assessed || outOfBattles || !!active.data}
          onPress={() => router.push({ pathname: '/arena/matchmaking', params: { mode: mode.id } })}
        />
        <Text variant="small" color="textMuted" align="center">
          {l.battles_remaining_today === null ? 'Fair-use limits apply' : `${l.battles_remaining_today} of ${l.battles_limit} battles left today`}
          {l.gender_preference !== 'any' && l.gender_preference_available ? ` · Opponent preference: ${l.gender_preference}` : ''}
        </Text>
      </Card>

      <Row gap={Spacing.sm}>
        <Button style={{ flex: 1 }} title="Practice first" icon="barbell" variant="secondary"
          onPress={() => router.push({ pathname: '/quiz', params: { kind: 'battle_practice', types: mode.types.join(','), title: `${mode.name} practice` } })} />
        <Button style={{ flex: 1 }} title="Leaderboards" icon="podium" variant="secondary" onPress={() => router.push('/leaderboard')} testID="lobby-leaderboard" />
      </Row>

      <SectionHeader title="Recent opponents" action="Battle history" onAction={() => router.push('/arena/history')} />
      {l.recent_opponents.length ? (
        <Card>
          {l.recent_opponents.map((o, i) => (
            <Row key={i} gap={Spacing.md}>
              <Avatar emoji={o.avatar} size={36} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{o.alias}</Text>
                <Text variant="tiny" color="textMuted">{new Date(o.at).toLocaleString()}</Text>
              </View>
              <LevelBadge level={o.level} />
              <Badge label={o.result} tone={o.result === 'win' ? 'success' : o.result === 'loss' ? 'danger' : 'muted'} />
            </Row>
          ))}
        </Card>
      ) : <Text color="textMuted">No battles yet. Opponents are shown by temporary pseudonyms.</Text>}

      <Banner tone="info" icon="shield-checkmark" title="Fair play"
        message="Scores, timing and ratings are calculated on the server. Opponents never see your email or private details. You can report or block anyone after a match." />
    </Screen>
  );
}
