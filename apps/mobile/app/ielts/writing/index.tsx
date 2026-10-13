import { router, Stack } from 'expo-router';
import { useAuth } from '../../../src/lib/auth';
import { useApi } from '../../../src/lib/hooks';
import { Badge, Card, ErrorText, H2, Loading, P, Row, Screen } from '../../../src/components/ui';

export default function WritingList() {
  const { user } = useAuth();
  const tt = user?.testType === 'general' ? 'general' : 'academic';
  const { data, loading, error } = useApi<any[]>(`/ielts/writing/prompts?testType=${tt}`);
  const subs = useApi<any[]>('/ielts/writing/submissions');
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Writing' }} />
      <ErrorText error={error} />
      {loading ? <Loading /> : data!.map((p) => (
        <Card key={p.slug} onPress={() => router.push(`/ielts/writing/${p.slug}`)}>
          <Row between><Badge label={`Task ${p.task}`} tone="primary" />{p.latest && <P small muted>{p.latest.status}</P>}</Row>
          <H2>{p.title}</H2>
        </Card>
      ))}
      {subs.data && subs.data.filter((s) => s.status !== 'draft').length > 0 && <H2>Your feedback</H2>}
      {subs.data?.filter((s) => s.status !== 'draft').map((s) => (
        <Card key={s.id} onPress={() => router.push(`/ielts/writing/result/${s.id}`)}><P>{s.title}</P><P small muted>{s.word_count} words · band {s.band_estimate ?? 'not scored'}</P></Card>
      ))}
    </Screen>
  );
}
