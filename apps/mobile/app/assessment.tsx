import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { CEFR_INFO, LEVEL_DISCLAIMER, type CefrLevel } from '@fluentpath/shared';
import { Badge, Button, Card, Chip, H1, H2, Loading, Notice, P, Progress, Screen } from '../src/components/ui';
import { api, errorMessage } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';

interface Q { id: string; skill: string; prompt: string; passage: string | null; options: string[] }

export default function Assessment() {
  const { refresh } = useAuth();
  const [id, setId] = useState<string | null>(null);
  const [qs, setQs] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [i, setI] = useState(0);
  const [result, setResult] = useState<{ level: CefrLevel; score: number; maxScore: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.post<{ assessmentId: string; questions: Q[]; answers: Record<string, string> }>('/api/assessment/start').then((r) => { setId(r.assessmentId); setQs(r.questions); setAnswers(r.answers ?? {}); }).catch((e) => setError(errorMessage(e)));
  }, []);
  if (error && !qs.length) return <Screen><Notice tone="error" text={error} /></Screen>;
  if (!qs.length) return <Screen><Loading /></Screen>;
  if (result)
    return (
      <Screen>
        <P muted>Your estimated level</P>
        <H1>{result.level} · {CEFR_INFO[result.level].name}</H1>
        <P>{CEFR_INFO[result.level].description}</P>
        <Badge text={`${result.score}/${result.maxScore} correct`} />
        <P muted style={{ fontSize: 12 }}>{LEVEL_DISCLAIMER}</P>
        <Button title="Go to my dashboard" onPress={() => router.replace('/home')} />
      </Screen>
    );
  const q = qs[i];
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ level: CefrLevel; score: number; maxScore: number }>(`/api/assessment/${id}/submit`, { answers });
      setResult(r);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <P muted>Question {i + 1} of {qs.length}</P>
      <Progress value={i + 1} max={qs.length} />
      <Card>
        <Badge text={q.skill} tone="slate" />
        {q.passage && <P muted>{q.passage}</P>}
        <H2>{q.prompt}</H2>
        {q.options.map((o) => <Chip key={o} label={o} selected={answers[q.id] === o} onPress={() => setAnswers({ ...answers, [q.id]: o })} />)}
      </Card>
      {error && <Notice tone="error" text={error} />}
      {i < qs.length - 1 ? <Button title={answers[q.id] ? 'Next' : 'Skip'} onPress={() => setI(i + 1)} /> : <Button title="Finish and see my level" onPress={submit} loading={busy} />}
      {i > 0 && <Button title="Previous" variant="secondary" onPress={() => setI(i - 1)} />}
    </Screen>
  );
}
