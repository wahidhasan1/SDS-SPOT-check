import { useState } from 'react';
import { Stack } from 'expo-router';
import { useApi } from '../../src/lib/hooks';
import { Button, Card, Chip, ErrorText, H2, Loading, Notice, P, Row, Screen } from '../../src/components/ui';
import { SpeakingRecorder } from '../../src/components/SpeakingRecorder';

export default function SpeakingPractice() {
  const { data, loading, error } = useApi<any>('/ielts/speaking/prompts');
  const [part, setPart] = useState<1 | 2 | 3>(1);
  const [i, setI] = useState(0);
  const [q, setQ] = useState(0);
  if (loading) return <Loading />;
  if (error) return <Screen><ErrorText error={error} /></Screen>;
  const list = part === 1 ? data.part1 : part === 2 ? data.part2 : data.part3;
  const p = list[i % list.length];
  const question = part === 2 ? p.text : p.questions[q % p.questions.length];
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Speaking practice' }} />
      {!data.aiFeedback && <Notice text="AI feedback isn't configured on the server; you'll get transcript statistics without a band." />}
      <Row wrap>{[1, 2, 3].map((n) => <Chip key={n} label={`Part ${n}`} on={part === n} onPress={() => { setPart(n as 1 | 2 | 3); setI(0); setQ(0); }} />)}</Row>
      <Card>
        <P small muted>{p.topic}</P>
        <H2>{question}</H2>
        {part === 2 && p.bullets.map((b: string) => <P key={b} small>• {b}</P>)}
        <Row><Button small variant="ghost" title="New topic" onPress={() => { setI(i + 1); setQ(0); }} />{part !== 2 && <Button small variant="ghost" title="Next question" onPress={() => setQ(q + 1)} />}</Row>
        <SpeakingRecorder key={`${part}-${i}-${q}`} part={part} question={question} promptId={p.id} prepSeconds={part === 2 ? 60 : 0} speakSeconds={part === 2 ? 120 : part === 1 ? 60 : 90} />
      </Card>
    </Screen>
  );
}
