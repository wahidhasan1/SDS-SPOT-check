import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Avatar, Badge, Card, Icon, LevelBadge, ListRow, Row, Screen, SectionHeader, StatTile, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

/** User profile. Level and competitive stats are read-only (server-calculated). */
export default function Profile() {
  const { profile, session } = useAuth();
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: api.getDashboard });
  const ach = useQuery({ queryKey: ['achievements'], queryFn: api.getAchievements });
  const roles = useQuery({ queryKey: ['roles'], queryFn: api.getMyRoles });
  const d = dash.data;
  const earned = (ach.data ?? []).filter((a) => a.earned_at);

  return (
    <Screen refreshing={dash.isRefetching} onRefresh={() => { dash.refetch(); ach.refetch(); }}>
      <View style={{ alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.md }}>
        <Avatar emoji={profile?.avatar ?? '🦊'} size={88} ring="primary" />
        <Text variant="h1" testID="profile-name">{profile?.display_name}</Text>
        <Text color="textMuted">@{profile?.username}</Text>
        <LevelBadge level={d?.proficiency.level} provisional={d?.proficiency.status === 'provisional'} size="lg" />
        <Text variant="tiny" color="textFaint">VERIFIED BY ASSESSMENT · CANNOT BE EDITED MANUALLY</Text>
        <Badge label={d?.plan === 'premium' ? 'Premium' : 'Free plan'} tone={d?.plan === 'premium' ? 'warning' : 'muted'} icon="star" />
      </View>

      <Row gap={Spacing.sm}>
        <StatTile icon="trophy" label="Battle rating" value={d?.battle?.rating ?? 1000} tone="success" />
        <StatTile icon="game-controller" label="Battles" value={d?.battle?.games ?? 0} />
        <StatTile icon="pie-chart" label="Win rate" value={`${d?.battle?.win_rate ?? 0}%`} tone="info" />
      </Row>
      <Row gap={Spacing.sm}>
        <StatTile icon="flame" label="Streak" value={d?.streak.current ?? 0} tone="warning" />
        <StatTile icon="star" label="Total XP" value={d?.xp ?? 0} />
        <StatTile icon="sparkles" label="Words learned" value={d?.vocabulary.learned ?? 0} tone="success" />
      </Row>

      <SectionHeader title="Achievements" action="See all" onAction={() => router.push('/achievements')} />
      <Card onPress={() => router.push('/achievements')}>
        {earned.length ? (
          <Row wrap>{earned.slice(0, 6).map((a) => <Badge key={a.code} label={a.title} tone="warning" icon="trophy" />)}</Row>
        ) : <Text color="textMuted">Complete quizzes and battles to earn badges.</Text>}
      </Card>

      <SectionHeader title="Learning" />
      <Card>
        <ListRow icon="bookmarks" title="Saved vocabulary" subtitle={`${d?.vocabulary.saved ?? 0} saved · ${d?.vocabulary.mastered ?? 0} mastered`} onPress={() => router.push('/saved-words')} />
        <ListRow icon="checkmark-done" title="Completed quizzes" subtitle={`${d?.recent_quizzes.length ?? 0} recent · ${d?.today.quizzes ?? 0} today`} onPress={() => router.push('/learn')} />
        <ListRow icon="school" title="IELTS practice progress" subtitle={profile?.ielts_target_band ? `Target band ${Number(profile.ielts_target_band).toFixed(1)}` : 'Set a target in Edit profile'} onPress={() => router.push('/ielts')} />
        <ListRow icon="flash" title="Battle history" onPress={() => router.push('/arena/history')} />
        <ListRow icon="podium" title="Leaderboards" onPress={() => router.push('/leaderboard')} />
      </Card>

      <SectionHeader title="Account" />
      <Card>
        <ListRow icon="create" title="Edit profile" onPress={() => router.push('/profile-edit')} testID="profile-edit" />
        <ListRow icon="notifications" title="Notifications" onPress={() => router.push('/notifications')} />
        <ListRow icon="star" title="Subscription" subtitle={d?.plan === 'premium' ? 'Premium' : 'Free'} onPress={() => router.push('/subscription')} />
        <ListRow icon="settings" title="Settings" subtitle={session?.user.email} onPress={() => router.push('/settings')} testID="profile-settings" />
        <ListRow icon="help-circle" title="Help & support" onPress={() => router.push('/help')} />
        {roles.data?.length ? <ListRow icon="shield" title="Admin dashboard" subtitle={roles.data.join(', ')} onPress={() => router.push('/admin')} /> : null}
      </Card>
      <Row style={{ justifyContent: 'center' }}><Icon name="lock-closed" size={14} color="textFaint" /><Text variant="small" color="textFaint">Your email is never shown to other learners.</Text></Row>
    </Screen>
  );
}
