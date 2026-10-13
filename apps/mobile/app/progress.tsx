import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Badge, Card, H2, Loading, P, Row, Screen } from '../src/components/ui';
import { useTheme } from '../src/lib/theme';
import { useApi } from '../src/lib/useApi';

interface Prog { series: { day: string; minutes: number; xp: number }[]; totals: { xp: number; minutes: number }; attempts: { id: string; kind: string; title: string; score: number | null; maxScore: number | null; bandEstimate: number | null; completedAt: string }[]; writing: { id: string; title: string; bandEstimate: number | null; wordCount: number }[]; analyticsLocked: boolean }

export default function ProgressScreen() {
  const t = useTheme();
  const p = useApi<Prog>('/api/progress');
  const s = useApi<{ current: number; longest: number }>('/api/progress/streak');
  const a = useApi<{ achievements: { code: string; title: string; description: string; earnedAt: string | null }[] }>('/api/achievements');
  if (!p.data) return <Screen><Loading /></Screen>;
  const max = Math.max(1, ...p.data.series.map((d) => d.minutes));
  return (
    <Screen onRefresh={() => { p.reload(); s.reload(); a.reload(); }}>
      <Stack.Screen options={{ title: 'Progress' }} />
      <Row>
        <Badge text={`🔥 ${s.data?.current ?? 0}-day streak (best ${s.data?.longest ?? 0})`} tone="amber" />
        <Badge text={`${p.data.totals.minutes} min total`} />
        <Badge text={`${p.data.totals.xp} XP`} tone="green" />
      </Row>
      <Card>
        <H2>Minutes per day (last 30 days)</H2>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 2 }} accessibilityLabel="Bar chart of study minutes per day">
          {p.data.series.map((d) => <View key={d.day} style={{ flex: 1, height: Math.max(2, (d.minutes / max) * 100), backgroundColor: d.minutes ? t.brand : t.border, borderRadius: 2 }} />)}
        </View>
      </Card>
      <H2>Recent results</H2>
      {p.data.attempts.length === 0 && <P muted>No completed practice yet.</P>}
      {p.data.attempts.slice(0, 15).map((x) => (
        <Card key={x.id}>
          <Text style={{ color: t.text, fontWeight: '600' }}>{x.title}</Text>
          <P muted>{new Date(x.completedAt).toLocaleDateString()} · {x.score}/{x.maxScore}{x.bandEstimate != null ? ` · band ≈ ${x.bandEstimate} (unofficial)` : ''}</P>
        </Card>
      ))}
      {p.data.analyticsLocked && <P muted>Detailed IELTS analytics (accuracy by question type, band trends) are part of Premium.</P>}
      <H2>Achievements</H2>
      {a.data?.achievements.map((x) => (
        <Card key={x.code} style={{ opacity: x.earnedAt ? 1 : 0.55 }}>
          <Text style={{ color: t.text, fontWeight: '600' }}>{x.earnedAt ? '🏅 ' : ''}{x.title}</Text>
          <P muted>{x.description}</P>
        </Card>
      ))}
    </Screen>
  );
}
