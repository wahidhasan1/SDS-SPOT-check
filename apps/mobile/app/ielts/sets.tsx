import { useState } from 'react';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { api, errorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { fmtDuration, useApi } from '../../src/lib/hooks';
import { Badge, Button, Card, ErrorText, H2, Loading, P, Row, Screen } from '../../src/components/ui';

export default function Sets() {
  const { skill } = useLocalSearchParams<{ skill: 'reading' | 'listening' }>();
  const { user } = useAuth();
  const tt = user?.testType === 'general' ? 'general' : 'academic';
  const { data, loading, error } = useApi<any[]>(`/ielts/sets?skill=${skill}${skill === 'reading' ? `&testType=${tt}` : ''}`);
  const [err, setErr] = useState<string | null>(null);
  const start = async (slug: string, mode: string) => {
    try {
      const r = await api.post<any>(`/ielts/sets/${slug}/attempts`, { mode });
      router.push(`/ielts/practice/${r.attempt.id}`);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: skill === 'reading' ? `Reading (${tt === 'general' ? 'GT' : 'Academic'})` : 'Listening' }} />
      <ErrorText error={error ?? err} />
      {loading ? <Loading /> : data!.map((s) => (
        <Card key={s.slug}>
          <Row between><H2>{s.title}</H2>{s.isPremium && <Badge label="Premium" tone="warning" />}</Row>
          <P small muted>{s.description}</P>
          <P small>{s.questionCount} questions · {fmtDuration(s.timeLimitSec)} · {s.difficulty}</P>
          {s.lastAttempt && <P small>Last: {s.lastAttempt.status === 'submitted' ? `${s.lastAttempt.score}/${s.lastAttempt.total}` : 'in progress'}</P>}
          <Row><Button small title="Practice" onPress={() => start(s.slug, 'practice')} /><Button small variant="secondary" title="Timed test" onPress={() => start(s.slug, 'timed')} /></Row>
        </Card>
      ))}
    </Screen>
  );
}
