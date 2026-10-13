import { router, Stack } from 'expo-router';
import { useApi } from '../../src/lib/hooks';
import { Badge, Card, ErrorText, H2, Loading, P, Row, Screen } from '../../src/components/ui';

export default function Grammar() {
  const { data, loading, error } = useApi<any[]>('/grammar/lessons');
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Grammar' }} />
      <ErrorText error={error} />
      {loading ? <Loading /> : data!.map((l) => (
        <Card key={l.slug} onPress={() => router.push(`/grammar/${l.slug}`)}>
          <Row between><Badge label={`${l.cefr} · ${l.topic}`} />{l.recommended && <Badge label="Recommended" tone="primary" />}</Row>
          <H2>{l.title}</H2>
          <P small muted>{l.summary}</P>
          {l.best != null && <P small>Best: {l.best}%</P>}
        </Card>
      ))}
    </Screen>
  );
}
