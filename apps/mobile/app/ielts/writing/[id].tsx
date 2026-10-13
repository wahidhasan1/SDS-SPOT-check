import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text, TextInput } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { countWords } from '@fluentpath/shared';
import { Badge, Button, Card, H2, Loading, Notice, P, Screen } from '../../../src/components/ui';
import { api, errorMessage } from '../../../src/lib/api';
import { useTheme } from '../../../src/lib/theme';

interface Sub { id: string; status: string; text: string; bandEstimate: number | null; feedback: { stats?: { wordCount: number; paragraphs: number; linkersUsed: string[]; underLength: boolean }; ai?: { summary: string; criteria: { id: string; band: number; comment: string }[] }; aiStatus?: string } | null; feedbackError: string | null }
interface Task { title: string; prompt: string; instructions: string; minWords: number; visual: { kind: string; title: string; categories?: string[]; series?: { name: string; values: number[] }[]; rows?: string[][]; steps?: string[] } | null }

export default function Writing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const [sub, setSub] = useState<Sub | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const load = useCallback(async () => {
    const r = await api.get<{ submission: Sub; task: Task }>(`/api/writing/submissions/${id}`);
    setSub(r.submission);
    setTask(r.task);
    setText(r.submission.text);
  }, [id]);
  useEffect(() => { load().catch((e) => setErr(errorMessage(e))); }, [load]);
  useEffect(() => {
    if (sub?.status !== 'evaluating') return;
    const i = setInterval(load, 4000);
    return () => clearInterval(i);
  }, [sub?.status, load]);
  if (!sub || !task) return <Screen>{err ? <Notice tone="error" text={err} /> : <Loading />}</Screen>;
  const draft = sub.status === 'draft';
  const words = countWords(text);
  return (
    <Screen>
      <Stack.Screen options={{ title: task.title }} />
      <Card><P>{task.prompt}</P><P muted>{task.instructions}</P></Card>
      {task.visual && (
        <Card>
          <H2>{task.visual.title}</H2>
          {task.visual.series?.map((s) => <P key={s.name}>{s.name}: {task.visual!.categories?.map((c, i) => `${c} ${s.values[i]}`).join(' · ')}</P>)}
          {task.visual.rows?.map((r, i) => <P key={i}>{r.join(' | ')}</P>)}
          {task.visual.steps?.map((s, i) => <P key={i}>{i + 1}. {s}</P>)}
          <P muted style={{ fontSize: 12 }}>Open this task in the web app to see the full chart.</P>
        </Card>
      )}
      {draft ? (
        <>
          <Badge text={`${words} / ${task.minWords} words`} tone={words >= task.minWords ? 'green' : 'amber'} />
          <TextInput multiline value={text} onChangeText={(v) => { setText(v); clearTimeout(timer.current); timer.current = setTimeout(() => api.put(`/api/writing/submissions/${id}`, { text: v }).catch(() => {}), 1500); }} placeholder="Write your answer…" placeholderTextColor={t.muted} accessibilityLabel="Your answer" style={{ minHeight: 320, borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 12, color: t.text, textAlignVertical: 'top', fontSize: 16, lineHeight: 24 }} />
          {err && <Notice tone="error" text={err} />}
          <Button title="Submit" loading={busy} disabled={words < 20} onPress={() => Alert.alert('Submit your answer?', words < task.minWords ? `You have ${words} words (minimum ${task.minWords}).` : 'You cannot edit it afterwards.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Submit', onPress: async () => { setBusy(true); try { await api.post(`/api/writing/submissions/${id}/submit`, { text }); await load(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); } } }])} />
        </>
      ) : (
        <>
          <Card><Text style={{ color: t.text, lineHeight: 22 }}>{sub.text}</Text></Card>
          {sub.status === 'evaluating' && <Notice text="AI feedback in progress…" />}
          {sub.feedback?.aiStatus === 'not_configured' && <Notice text="AI feedback is not configured on this server. Automatic statistics are shown below." />}
          {sub.feedbackError && <Notice tone="error" text={sub.feedbackError} />}
          {sub.feedback?.ai && <Card><H2>Estimated band ≈ {sub.bandEstimate} (unofficial)</H2><P>{sub.feedback.ai.summary}</P>{sub.feedback.ai.criteria.map((c) => <P key={c.id}>• {c.id}: ≈ {c.band} — {c.comment}</P>)}</Card>}
          {sub.feedback?.stats && <Card><H2>Text statistics</H2><P>Words: {sub.feedback.stats.wordCount}{sub.feedback.stats.underLength ? ' (below minimum)' : ''}</P><P>Paragraphs: {sub.feedback.stats.paragraphs}</P><P>Linking words: {sub.feedback.stats.linkersUsed.join(', ') || 'none'}</P></Card>}
        </>
      )}
    </Screen>
  );
}
