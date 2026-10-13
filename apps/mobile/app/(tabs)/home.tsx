import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useAuth } from '../../src/lib/auth';
import { useApi } from '../../src/lib/hooks';
import { useTheme } from '../../src/lib/theme';
import { Badge, Button, Card, Disclaimer, ErrorText, H1, H2, Loading, P, ProgressBar, Row, Screen } from '../../src/components/ui';

export default function Home() {
  const t = useTheme();
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<any>('/me/dashboard');
  return (
    <Screen>
      <H1>Hi, {user?.displayName}</H1>
      <Row wrap>
        <Badge label={user?.cefrLevel ? `CEFR ${user.cefrLevel}` : 'Level not assessed'} tone="primary" />
        <P small muted>🔥 {user?.streakDays ?? 0}-day streak</P>
      </Row>
      <View style={{ backgroundColor: t.primary, borderRadius: 20, padding: 20, gap: 10 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>🎧 Find a Speaking Partner</Text>
        <Text style={{ color: '#fff' }}>Practise with a real learner now — anonymous and matched to your level.</Text>
        <Button title="Find a partner" variant="secondary" onPress={() => router.push('/(tabs)/speaking')} testID="home-find-partner" />
      </View>
      <Row wrap>
        {[
          ['🎯', 'IELTS practice', '/(tabs)/ielts'],
          ['🤖', 'Practise with AI', '/ielts/speaking'],
          ['⚔️', 'Battles', '/battles'],
          ['📷', 'Read with AI', '/read'],
          ['📝', 'Mock test', '/ielts/mocks'],
          ['🔁', 'Review words', '/review'],
        ].map(([i, l, h]) => (
          <Card key={l} style={{ width: '47%' }} onPress={() => router.push(h as any)}><Text style={{ fontSize: 24 }}>{i}</Text><P>{l}</P></Card>
        ))}
      </Row>
      {loading ? <Loading /> : error ? <ErrorText error={error} /> : data && (
        <>
          <Card>
            <H2>Continue learning</H2>
            {data.recommendations.map((r: any) => (
              <Card key={r.id} onPress={() => router.push(mapHref(r.href) as any)} style={{ padding: 12 }}>
                <P>{r.icon} {r.title}</P>
                <P small muted>{r.reason}</P>
              </Card>
            ))}
          </Card>
          <Card>
            <H2>IELTS skills</H2>
            {(['listening', 'reading', 'writing', 'speaking'] as const).map((k) => (
              <View key={k} style={{ gap: 4 }}>
                <Row between><P>{k}</P><P small>{data.ielts.skills[k].band ?? 'not scored'}{data.ielts.targetBand ? ` / ${data.ielts.targetBand}` : ''}</P></Row>
                <ProgressBar value={data.ielts.skills[k].band ?? 0} max={9} />
              </View>
            ))}
            <Disclaimer />
          </Card>
          <Card>
            <H2>Progress</H2>
            <P>📞 {data.calls.completed} calls · 📚 {data.vocabulary.saved} saved words ({data.vocabulary.mastered} mastered)</P>
            <P>✍️ {data.grammar.mastered}/{data.grammar.total} grammar lessons mastered · ⚔️ rating {data.battles.rating}</P>
            <Button small variant="ghost" title="Refresh" onPress={reload} />
          </Card>
        </>
      )}
    </Screen>
  );
}

/** Web routes in recommendations map to mobile routes. */
export function mapHref(h: string) {
  const m: Record<string, string> = { '/speaking': '/(tabs)/speaking', '/ielts': '/(tabs)/ielts', '/vocabulary/review': '/review', '/grammar': '/grammar', '/ielts/mock': '/ielts/mocks', '/ielts/writing': '/ielts/writing', '/ielts/speaking': '/ielts/speaking', '/ielts/reading': '/ielts/sets?skill=reading', '/ielts/listening': '/ielts/sets?skill=listening', '/battles': '/battles', '/assessment': '/assessment' };
  return m[h] ?? h;
}
