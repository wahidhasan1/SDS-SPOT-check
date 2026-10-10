import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { Badge, Card, ErrorView, Icon, LoadingView, Screen, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { useTheme } from '@/providers/theme-provider';

/** Achievements — awarded only by verifiable server-side events. */
export default function Achievements() {
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ['achievements'], queryFn: api.getAchievements });
  if (q.isPending) return <LoadingView />;
  if (q.error) return <Screen title="Achievements" back><ErrorView error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const list = q.data!;
  const earned = list.filter((a) => a.earned_at).length;
  return (
    <Screen title="Achievements" subtitle={`${earned} of ${list.length} unlocked`} back>
      <View style={styles.grid}>
        {list.map((a) => (
          <Card key={a.code} style={a.earned_at ? styles.card : { ...styles.card, opacity: 0.6 }}>
            <View style={[styles.icon, { backgroundColor: a.earned_at ? colors.warningSoft : colors.surfaceAlt }]}>
              <Icon name={a.earned_at ? a.icon : 'lock-closed'} color={a.earned_at ? 'warning' : 'textFaint'} size={26} />
            </View>
            <Text variant="bodyStrong">{a.title}</Text>
            <Text variant="small" color="textMuted">{a.description}</Text>
            {a.earned_at ? <Badge label={`Earned ${new Date(a.earned_at).toLocaleDateString()}`} tone="success" />
              : !a.available ? <Badge label="Coming soon" tone="muted" /> : <Badge label={`+${a.xp_reward} XP`} tone="primary" />}
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: { flexGrow: 1, flexBasis: '45%', minWidth: 150 },
  icon: { width: 48, height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
