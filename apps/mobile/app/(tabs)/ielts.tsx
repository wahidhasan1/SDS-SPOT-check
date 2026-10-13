import { useState } from 'react';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { BAND_DISCLAIMER } from '@fluentpath/shared';
import { Badge, Button, Card, Chip, Loading, Notice, P, Row, Screen } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useTheme } from '../../src/lib/theme';
import { useApi } from '../../src/lib/useApi';

type Tab = 'reading' | 'listening' | 'writing' | 'speaking';
interface SetItem { id: string; title: string; description: string; timeLimitSec: number; questionCount: number; locked: boolean; attempts: number; bestBand: number | null; inProgressId: string | null }

export default function Ielts() {
  const { me } = useAuth();
  const t = useTheme();
  const [tab, setTab] = useState<Tab>('reading');
  const variant = me?.profile.ieltsModule ?? 'academic';
  const sets = useApi<{ sets: SetItem[] }>(tab === 'reading' || tab === 'listening' ? `/api/ielts/sets?module=${tab}&variant=${variant}` : null, [tab]);
  const tasks = useApi<{ tasks: { id: string; title: string; taskNumber: number; locked: boolean; draftId: string | null }[]; aiConfigured: boolean }>(tab === 'writing' ? `/api/writing/tasks?variant=${variant}` : null, [tab]);
  const prompts = useApi<{ prompts: { id: string; part: number; topic: string; cueCard: string | null }[] }>(tab === 'speaking' ? '/api/speaking/prompts' : null, [tab]);
  const [err, setErr] = useState<string | null>(null);

  const startSet = async (s: SetItem) => {
    if (s.locked) return router.push('/premium');
    try {
      const r = s.inProgressId ? { attemptId: s.inProgressId } : await api.post<{ attemptId: string }>(`/api/ielts/sets/${s.id}/start`);
      router.push(`/ielts/practice/${r.attemptId}`);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const openTask = async (id: string, locked: boolean) => {
    if (locked) return router.push('/premium');
    try {
      const r = await api.post<{ submission: { id: string } }>('/api/writing/submissions', { taskId: id });
      router.push(`/ielts/writing/${r.submission.id}`);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };

  return (
    <Screen>
      <P muted>Module: {variant === 'academic' ? 'IELTS Academic' : 'IELTS General Training'} (change in your profile)</P>
      <Row>{(['reading', 'listening', 'writing', 'speaking'] as Tab[]).map((x) => <Chip key={x} label={x[0].toUpperCase() + x.slice(1)} selected={tab === x} onPress={() => setTab(x)} />)}</Row>
      {err && <Notice tone="error" text={err} />}
      {(tab === 'reading' || tab === 'listening') && (!sets.data ? <Loading /> : sets.data.sets.map((s) => (
        <Card key={s.id} onPress={() => startSet(s)}>
          <Row><Text style={{ color: t.text, fontWeight: '700', flex: 1 }}>{s.title}</Text>{s.locked && <Badge text="Premium" tone="amber" />}{s.attempts > 0 && <Badge text={`Done ${s.attempts}×`} tone="green" />}</Row>
          <P muted>{s.description}</P>
          <P muted>{Math.round(s.timeLimitSec / 60)} min · {s.questionCount} questions{s.bestBand != null ? ` · best ≈ ${s.bestBand}` : ''}</P>
        </Card>
      )))}
      {tab === 'writing' && (!tasks.data ? <Loading /> : (
        <>
          {!tasks.data.aiConfigured && <Notice text="AI feedback is not configured on the server. You will get automatic text statistics after submitting." />}
          {tasks.data.tasks.map((w) => <Card key={w.id} onPress={() => openTask(w.id, w.locked)}><Row><Badge text={`Task ${w.taskNumber}`} />{w.locked && <Badge text="Premium" tone="amber" />}{w.draftId && <Badge text="Draft" tone="amber" />}</Row><Text style={{ color: t.text, fontWeight: '600' }}>{w.title}</Text></Card>)}
        </>
      ))}
      {tab === 'speaking' && (!prompts.data ? <Loading /> : prompts.data.prompts.map((p) => <Card key={p.id} onPress={() => router.push(`/ielts/speaking/${p.id}`)}><Badge text={`Part ${p.part}`} /><Text style={{ color: t.text, fontWeight: '600' }}>{p.topic}</Text>{p.cueCard && <P muted>{p.cueCard}</P>}</Card>))}
      <Button small variant="ghost" title="Mock tests are available in the web app" onPress={() => {}} disabled />
      <P muted style={{ fontSize: 12 }}>{BAND_DISCLAIMER}</P>
    </Screen>
  );
}
