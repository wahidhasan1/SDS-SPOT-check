import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { CEFR_INFO, type CefrLevel } from '@fluentpath/shared';
import { Badge, Card, Empty, H1, H2, Loading, Notice, P, Progress, Row, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { useTheme } from '../../src/lib/theme';
import { useApi } from '../../src/lib/useApi';

interface Dash {
  profile: { cefrLevel: CefrLevel | null; examInDays: number | null; ieltsTargetBand: number | null };
  streak: { current: number; longest: number };
  today: { minutes: number; xp: number; goalMinutes: number };
  series: { day: string; minutes: number }[];
  totals: { lessonsCompleted: number; lessonsTotal: number; vocab: { total: number; due: number; mastered: number }; reading: { count: number; latestBand: number | null }; listening: { count: number; latestBand: number | null }; writing: { count: number }; calls: { count: number } };
  recent: { id: number; title: string; xp: number }[];
  recommendations: { id: string; title: string; description: string; link: string }[];
}

/** Maps web links from the API to mobile routes. */
export function mobileRoute(link: string) {
  if (link.startsWith('/grammar/')) return `/lesson/${link.split('/')[2]}`;
  if (link === '/vocabulary/review') return '/vocab/review';
  if (link === '/vocabulary') return '/learn';
  if (link === '/speak') return '/speak';
  if (link.startsWith('/ielts')) return '/ielts';
  if (link === '/assessment') return '/assessment';
  if (link.startsWith('/reader')) return '/reader';
  if (link.startsWith('/progress')) return '/progress';
  return '/home';
}

export default function Home() {
  const { me } = useAuth();
  const t = useTheme();
  const { data, error, loading, reload } = useApi<Dash>('/api/dashboard');
  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <H1>Hi, {me?.profile.displayName}</H1>
      {error && <Notice tone="error" text={error} />}
      {!data ? <Loading /> : (
        <>
          <Row style={{ gap: 10 }}>
            <Card style={{ flex: 1, minWidth: 140 }}><P muted>Level</P><H2>{data.profile.cefrLevel ? `${data.profile.cefrLevel} · ${CEFR_INFO[data.profile.cefrLevel].name}` : 'Not assessed'}</H2></Card>
            <Card style={{ flex: 1, minWidth: 140 }}><P muted>Streak</P><H2>🔥 {data.streak.current} day{data.streak.current === 1 ? '' : 's'}</H2></Card>
          </Row>
          <Card>
            <P muted>Today</P>
            <H2>{Math.round(data.today.minutes)} / {data.today.goalMinutes} min · {data.today.xp} XP</H2>
            <Progress value={data.today.minutes} max={data.today.goalMinutes} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 60, marginTop: 8 }} accessibilityLabel="Study minutes for the last 14 days">
              {data.series.map((d) => {
                const max = Math.max(10, ...data.series.map((x) => x.minutes));
                return <View key={d.day} style={{ flex: 1, height: Math.max(2, (d.minutes / max) * 60), backgroundColor: t.brand, borderTopLeftRadius: 3, borderTopRightRadius: 3, opacity: d.minutes ? 1 : 0.25 }} />;
              })}
            </View>
          </Card>
          <H2>Recommended next</H2>
          {data.recommendations.map((r) => (
            <Card key={r.id} onPress={() => router.push(mobileRoute(r.link) as never)}><Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{r.title}</Text><P muted>{r.description}</P></Card>
          ))}
          <H2>Your numbers</H2>
          <Card>
            <P>Lessons completed: {data.totals.lessonsCompleted}/{data.totals.lessonsTotal}</P>
            <P>Saved words: {data.totals.vocab.total} ({data.totals.vocab.mastered} mastered, {data.totals.vocab.due} due)</P>
            <P>IELTS reading: {data.totals.reading.count}{data.totals.reading.latestBand != null ? ` · latest ≈ ${data.totals.reading.latestBand}` : ''}</P>
            <P>IELTS listening: {data.totals.listening.count}{data.totals.listening.latestBand != null ? ` · latest ≈ ${data.totals.listening.latestBand}` : ''}</P>
            <P>Essays submitted: {data.totals.writing.count} · Voice calls: {data.totals.calls.count}</P>
          </Card>
          <H2>Recent activity</H2>
          {data.recent.length ? data.recent.map((a) => <Row key={a.id}><Badge text={`+${a.xp} XP`} tone="green" /><P style={{ flex: 1 }}>{a.title}</P></Row>) : <Empty title="No activity yet" text="Complete a lesson or practice test to see your progress." />}
          <P muted style={{ fontSize: 12 }}>Band scores and levels are unofficial estimates.</P>
        </>
      )}
    </Screen>
  );
}
