import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { BAND_DISCLAIMER } from '@fluentpath/shared';
import { Questions, type G, type R } from '../../../src/components/Questions';
import { Badge, Button, Card, H2, Loading, Notice, P, Screen } from '../../../src/components/ui';
import { api, errorMessage } from '../../../src/lib/api';
import { playUrl, stopAudio } from '../../../src/lib/audio';
import { useTheme } from '../../../src/lib/theme';

interface Resp {
  attempt: { status: string; answers: Record<string, string>; results: R[] | null; score: number | null; maxScore: number | null; bandEstimate: number | null; deadlineAt: string | null };
  set: { title: string; module: 'reading' | 'listening'; questionCount: number };
  content: { passages?: { id: string; title: string; paragraphs: { label?: string; text: string }[] }[]; sections?: { id: string; title: string; context?: string; audioUrl: string; transcript?: string }[]; groups: G[] };
  serverTime: number;
}

export default function Practice() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const [data, setData] = useState<Resp | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const offset = useRef(0);
  const load = useCallback(async () => {
    try {
      const r = await api.get<Resp>(`/api/ielts/attempts/${id}`);
      offset.current = r.serverTime - Date.now();
      setData(r);
      setAnswers(r.attempt.answers ?? {});
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [id]);
  useEffect(() => { load(); return () => stopAudio(); }, [load]);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const completed = data?.attempt.status === 'completed';
  const remaining = data?.attempt.deadlineAt && !completed ? Math.max(0, Math.floor((new Date(data.attempt.deadlineAt).getTime() - now - offset.current) / 1000)) : null;

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      await api.post(`/api/ielts/attempts/${id}/submit`, { answers });
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [answers, id, load]);
  useEffect(() => { if (remaining === 0 && !busy) submit(); }, [remaining]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err && !data) return <Screen><Notice tone="error" text={err} /></Screen>;
  if (!data) return <Screen><Loading /></Screen>;
  const onChange = (n: number, v: string) => {
    const next = { ...answers, [String(n)]: v };
    setAnswers(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => api.put(`/api/ielts/attempts/${id}/answers`, { answers: next }).catch(() => {}), 1200);
  };
  const results = data.attempt.results ? Object.fromEntries(data.attempt.results.map((r) => [r.n, r])) : null;
  return (
    <Screen>
      <Stack.Screen options={{ title: data.set.title }} />
      {remaining != null && <Badge text={`⏱ ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`} tone={remaining < 120 ? 'red' : 'slate'} />}
      {completed && (
        <Card>
          <H2>Score {data.attempt.score}/{data.attempt.maxScore} · band ≈ {data.attempt.bandEstimate}</H2>
          <P muted style={{ fontSize: 12 }}>{BAND_DISCLAIMER}</P>
        </Card>
      )}
      {data.content.passages?.map((p) => (
        <Card key={p.id}>
          <H2>{p.title}</H2>
          {p.paragraphs.map((para, i) => <Text key={i} style={{ color: t.text, lineHeight: 23, fontSize: 15 }}>{para.label ? `${para.label}  ` : ''}{para.text}</Text>)}
        </Card>
      ))}
      {data.content.sections?.map((s) => (
        <Card key={s.id}>
          <H2>{s.title}</H2>
          {s.context && <P muted>{s.context}</P>}
          <Button title="▶ Play recording" onPress={() => playUrl(s.audioUrl)} />
          <Button small variant="secondary" title="Pause" onPress={stopAudio} />
          {completed && s.transcript && <P muted>{s.transcript}</P>}
        </Card>
      ))}
      <Questions groups={data.content.groups} answers={answers} onChange={completed ? undefined : onChange} results={results} />
      {err && <Notice tone="error" text={err} />}
      {!completed && <Button title="Submit answers" loading={busy} onPress={() => Alert.alert('Submit answers?', 'Unanswered questions will be marked wrong.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Submit', onPress: submit }])} />}
    </Screen>
  );
}
