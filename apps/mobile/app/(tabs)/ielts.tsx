import { router } from 'expo-router';
import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { Card, Chip, Disclaimer, H1, P, Row, Screen } from '../../src/components/ui';

export default function Ielts() {
  const { user, setUser } = useAuth();
  const set = async (testType: string) => setUser(await api.patch('/me', { testType }));
  return (
    <Screen>
      <H1>IELTS preparation</H1>
      <Row wrap>
        <Chip label="Academic" on={user?.testType !== 'general'} onPress={() => set('academic')} />
        <Chip label="General Training" on={user?.testType === 'general'} onPress={() => set('general')} />
      </Row>
      {[
        ['📖', 'Reading', 'Passages with every major question type', '/ielts/sets?skill=reading'],
        ['🎧', 'Listening', 'Four sections with real audio', '/ielts/sets?skill=listening'],
        ['✍️', 'Writing', 'Task 1 and Task 2 with autosave and feedback', '/ielts/writing'],
        ['🗣️', 'Speaking', 'Parts 1–3 with timers and transcripts', '/ielts/speaking'],
        ['📝', 'Mock tests', 'Timed four-skill practice tests', '/ielts/mocks'],
        ['📈', 'Progress', 'Skills, history and study plan', '/progress'],
      ].map(([i, t, d, h]) => (
        <Card key={t} onPress={() => router.push(h as any)}>
          <P>{i} <P style={{ fontWeight: '700' }}>{t}</P></P>
          <P small muted>{d}</P>
        </Card>
      ))}
      <Disclaimer />
    </Screen>
  );
}
