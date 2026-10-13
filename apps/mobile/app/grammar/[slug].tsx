import { useState } from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { api, errorMessage } from '../../src/lib/api';
import { useApi } from '../../src/lib/hooks';
import { Button, Card, ErrorText, H2, Input, Loading, Option, P, Screen } from '../../src/components/ui';

export default function Lesson() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, loading } = useApi<any>(`/grammar/lessons/${slug}`);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  if (loading || !data) return <Loading />;
  const r = (id: string) => result?.results.find((x: any) => x.id === id);
  return (
    <Screen>
      <Stack.Screen options={{ title: data.title }} />
      <Card>{data.body.split('\n').filter(Boolean).map((line: string, i: number) => <P key={i}>{line.replace(/\*\*/g, '').replace(/^- /, '• ')}</P>)}</Card>
      {data.exercises.map((e: any, i: number) => (
        <Card key={e.id}>
          <P style={{ fontWeight: '700' }}>{i + 1}. {e.prompt}</P>
          {e.kind === 'mcq' ? e.options.map((o: string) => (
            <Option key={o} label={o} selected={answers[e.id] === o} disabled={!!result} state={r(e.id) ? (o === r(e.id).correctAnswer ? 'correct' : answers[e.id] === o ? 'wrong' : null) : null} onPress={() => setAnswers({ ...answers, [e.id]: o })} />
          )) : <Input value={answers[e.id] ?? ''} editable={!result} onChangeText={(v) => setAnswers({ ...answers, [e.id]: v })} autoCapitalize="none" />}
          {r(e.id) && <P small>{r(e.id).correct ? '✅' : `❌ ${r(e.id).correctAnswer}`} — {r(e.id).explanation}</P>}
        </Card>
      ))}
      <ErrorText error={err} />
      {result ? <H2>Score {result.score}/{result.total}</H2> : <Button title="Check answers" onPress={async () => { try { setResult(await api.post(`/grammar/lessons/${slug}/submit`, { answers })); } catch (e) { setErr(errorMessage(e)); } }} />}
    </Screen>
  );
}
