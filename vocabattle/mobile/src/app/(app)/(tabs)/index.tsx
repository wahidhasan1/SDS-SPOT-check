import { useQuery } from '@tanstack/react-query';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AnimatedNumber, Avatar, Badge, Banner, Button, Card, ErrorView, Icon, type IconName, LevelBadge, LoadingView,
  ProgressBar, ProgressRing, Row, Screen, SectionHeader, StatTile, Text,
} from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { recommendationHref } from '@/lib/navigation';
import type { Dashboard } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const ACTIONS: { title: string; subtitle: string; icon: IconName; href: Href; tone: 'primary' | 'info' | 'success' | 'warning'; testID: string }[] = [
  { title: 'Start Learning', subtitle: 'Vocabulary, grammar & review', icon: 'book', href: '/learn', tone: 'primary', testID: 'action-learn' },
  { title: 'Anonymous Battle', subtitle: 'Duel a learner at your level', icon: 'flash', href: '/battle', tone: 'warning', testID: 'action-battle' },
  { title: 'Practice IELTS', subtitle: 'Academic vocabulary & skills', icon: 'school', href: '/ielts', tone: 'info', testID: 'action-ielts' },
  { title: 'Read with AI', subtitle: 'Tap any word in a book', icon: 'scan', href: '/read', tone: 'success', testID: 'action-read' },
  { title: 'Take a Practice Test', subtitle: '20 mixed questions', icon: 'clipboard', href: { pathname: '/quiz', params: { kind: 'daily', count: '20', title: 'Practice test', types: 'meaning,synonym,antonym,fill_blank,context,grammar' } }, tone: 'primary', testID: 'action-test' },
];

/** Home dashboard. */
export default function Home() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: api.getDashboard });
  useFocusEffect(useCallback(() => { q.refetch(); }, [q.refetch])); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isPending) return <LoadingView />;
  if (q.error || !q.data) return <Screen><ErrorView error={q.error} onRetry={() => q.refetch()} /></Screen>;
  return <DashboardView d={q.data} refreshing={q.isRefetching} onRefresh={() => q.refetch()} />;
}

function DashboardView({ d, refreshing, onRefresh }: { d: Dashboard; refreshing: boolean; onRefresh: () => void }) {
  const { colors } = useTheme();
  const goalProgress = d.today.goal ? d.today.xp / d.today.goal : 0;
  const lastQuiz = d.recent_quizzes[0];

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={Spacing.md} style={{ flex: 1 }}>
          <Avatar emoji={d.profile.avatar} size={48} ring="primary" />
          <View style={{ flex: 1 }}>
            <Text variant="small" color="textMuted">{greeting()},</Text>
            <Text variant="h2" numberOfLines={1} testID="home-name">{d.profile.display_name ?? d.profile.username}</Text>
          </View>
        </Row>
        <Pressable accessibilityRole="button" accessibilityLabel={`Notifications, ${d.unread_notifications} unread`} onPress={() => router.push('/notifications')}
          style={[styles.bell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="notifications-outline" size={22} />
          {d.unread_notifications > 0 ? <View style={[styles.dot, { backgroundColor: colors.danger }]}><Text variant="tiny" style={{ color: '#fff' }}>{Math.min(d.unread_notifications, 9)}</Text></View> : null}
        </Pressable>
      </Row>

      {d.active_battle_id ? (
        <Card tone="warning" onPress={() => router.push(`/arena/${d.active_battle_id}`)}>
          <Row><Icon name="flash" color="warning" /><Text variant="bodyStrong" style={{ flex: 1 }}>You have a battle in progress</Text><Text variant="smallStrong" color="warning">Rejoin →</Text></Row>
        </Card>
      ) : null}

      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 6, flex: 1 }}>
            <Text variant="tiny" color="textMuted">ENGLISH PROFICIENCY</Text>
            <LevelBadge level={d.proficiency.level} provisional={d.proficiency.status === 'provisional'} size="lg" />
            <Text variant="small" color="textMuted">Assessed by Vocabattle · not an official CEFR/IELTS result</Text>
          </View>
          <ProgressRing value={goalProgress} tone={goalProgress >= 1 ? 'success' : 'primary'} size={88}>
            <AnimatedNumber value={d.today.xp} variant="h3" />
            <Text variant="tiny" color="textMuted">/ {d.today.goal} XP</Text>
          </ProgressRing>
        </Row>
        <Row gap={Spacing.md} style={{ marginTop: Spacing.sm }}>
          <Badge tone={d.streak.current > 0 ? 'warning' : 'muted'} icon="flame" label={`${d.streak.current}-day streak`} />
          <Badge tone="primary" icon="star" label={`${d.xp} XP total`} />
          {goalProgress >= 1 ? <Badge tone="success" icon="checkmark" label="Goal met" /> : null}
        </Row>
      </Card>

      <Row gap={Spacing.sm}>
        <StatTile icon="sparkles" label="Words learned" value={d.vocabulary.learned} />
        <StatTile icon="repeat" label="Due reviews" value={d.vocabulary.due} tone="warning" />
        <StatTile icon="trophy" label="Battle rating" value={d.battle?.rating ?? 1000} tone="success" />
      </Row>

      <Card tone="primary" onPress={() => router.push(lastQuiz?.topic_id ? `/vocab/${lastQuiz.topic_id}` : { pathname: '/quiz', params: { kind: 'daily', title: 'Daily quiz' } })} testID="continue-learning">
        <Row gap={Spacing.md}>
          <Icon name="play-circle" color="primary" size={34} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{lastQuiz ? 'Continue learning' : 'Start your first quiz'}</Text>
            <Text variant="small" color="textMuted">
              {lastQuiz ? `Last quiz: ${lastQuiz.score}/${lastQuiz.total} correct` : 'Ten questions matched to your level'}
            </Text>
          </View>
          <Icon name="chevron-forward" color="primary" />
        </Row>
      </Card>

      <View style={styles.grid}>
        {ACTIONS.map((a) => (
          <Card key={a.title} onPress={() => router.push(a.href)} style={styles.action} testID={a.testID} accessibilityLabel={a.title}>
            <View style={[styles.actionIcon, { backgroundColor: colors[`${a.tone}Soft` as const] }]}>
              <Icon name={a.icon} color={a.tone} size={22} />
            </View>
            <Text variant="bodyStrong">{a.title}</Text>
            <Text variant="small" color="textMuted">{a.subtitle}</Text>
          </Card>
        ))}
      </View>

      {d.recommendations.length ? (
        <>
          <SectionHeader title="Recommended for you" />
          {d.recommendations.slice(0, 3).map((r, i) => (
            <Card key={i} onPress={() => router.push(recommendationHref(r))}>
              <Row gap={Spacing.md}>
                <Icon name={r.kind === 'review' ? 'repeat' : r.kind === 'battle' ? 'flash' : 'bulb'} color="primary" />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{r.title}</Text>
                  <Text variant="small" color="textMuted">{r.description}</Text>
                </View>
                <Icon name="chevron-forward" color="textFaint" />
              </Row>
            </Card>
          ))}
        </>
      ) : null}

      <SectionHeader title="Recent quiz scores" action={d.recent_quizzes.length ? 'Learn' : undefined} onAction={() => router.push('/learn')} />
      {d.recent_quizzes.length ? (
        <Card>
          {d.recent_quizzes.map((r) => (
            <View key={r.id} style={{ gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="smallStrong">{r.kind === 'daily' ? 'Daily quiz' : r.topic_id ? r.topic_id.replace(/_/g, ' ') : 'Practice'}</Text>
                <Text variant="small" color="textMuted">{r.score}/{r.total} · +{r.xp} XP</Text>
              </Row>
              <ProgressBar value={r.total ? r.score / r.total : 0} tone={r.score / r.total >= 0.7 ? 'success' : 'warning'} height={6} />
            </View>
          ))}
        </Card>
      ) : <Text color="textMuted">No quizzes yet — your scores will appear here.</Text>}

      <SectionHeader title="Battle statistics" action="Lobby" onAction={() => router.push('/battle')} />
      <Row gap={Spacing.sm}>
        <StatTile icon="game-controller" label="Battles" value={d.battle?.games ?? 0} />
        <StatTile icon="ribbon" label="Wins" value={d.battle?.wins ?? 0} tone="success" />
        <StatTile icon="pie-chart" label="Win rate" value={`${d.battle?.win_rate ?? 0}%`} tone="info" />
      </Row>

      <SectionHeader title="IELTS preparation" />
      <Card onPress={() => router.push('/ielts')}>
        <Row gap={Spacing.md}>
          <Icon name="school" color="info" size={28} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{d.profile.ielts_target_band ? `Target band ${Number(d.profile.ielts_target_band).toFixed(1)}` : 'IELTS Center'}</Text>
            <Text variant="small" color="textMuted">Academic vocabulary is available now. Full skills practice arrives in Phase 3.</Text>
          </View>
        </Row>
      </Card>
      {d.plan === 'free' ? (
        <Banner tone="info" title="Vocabattle Free" message="Learning is free. Premium adds more battles, AI reading quota and advanced IELTS practice.">
          <Button title="See plans" variant="ghost" size="sm" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => router.push('/subscription')} />
        </Banner>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bell: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  dot: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  action: { flexGrow: 1, flexBasis: '45%', minWidth: 150 },
  actionIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
