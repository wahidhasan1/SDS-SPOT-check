import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, H2, Loading, Notice, P, Screen } from '../../../src/components/ui';
import { api, errorMessage } from '../../../src/lib/api';
import { speakingForm, useSpeechRecorder } from '../../../src/lib/recorder';
import { useTheme } from '../../../src/lib/theme';
import { useApi } from '../../../src/lib/useApi';

interface Prompt { id: string; part: number; topic: string; questions: string[]; cueCard: string | null; speakSeconds: number }
interface Attempt { id: string; metrics: { wordCount: number; wordsPerMinute: number; fillerCount: number }; feedback: { aiStatus?: string; ai?: { overallBand: number; summary: string; tips: string[] } } | null }

export default function Speaking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { data } = useApi<{ prompt: Prompt }>(`/api/speaking/prompts/${id}`);
  const rec = useSpeechRecorder();
  const [qi, setQi] = useState(0);
  const [last, setLast] = useState<Attempt | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const p = data?.prompt;
  useEffect(() => { if (p && rec.state === 'recording' && rec.seconds >= p.speakSeconds) rec.stop(); }, [rec, p]);
  useEffect(() => {
    if (!last || last.feedback?.aiStatus !== 'evaluating') return;
    const i = setInterval(async () => setLast((await api.get<{ attempt: Attempt }>(`/api/speaking/attempts/${last.id}`)).attempt), 4000);
    return () => clearInterval(i);
  }, [last]);
  if (!p) return <Screen><Loading /></Screen>;
  const question = p.part === 2 ? p.cueCard! : p.questions[qi];
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ attempt: Attempt }>('/api/speaking/attempts', speakingForm({ mode: 'ielts', promptId: p.id, question, transcript: rec.transcript, transcriptSource: rec.mode === 'speech' ? 'device' : rec.transcript ? 'manual' : 'none', durationSec: rec.seconds }, rec.uri));
      setLast(r.attempt);
      rec.reset();
      if (p.part !== 2 && qi < p.questions.length - 1) setQi(qi + 1);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: `Part ${p.part}: ${p.topic}` }} />
      <Card>
        <Badge text={p.part === 2 ? 'Cue card · 1 min prep, up to 2 min speaking' : `Question ${qi + 1} of ${p.questions.length}`} />
        <H2>{question}</H2>
        {p.part === 2 && p.questions.map((x) => <P key={x}>• {x}</P>)}
      </Card>
      <Notice text="Pronunciation is not scored — only the words in your transcript are analysed." />
      {rec.error && <Notice tone="error" text={rec.error} />}
      {rec.state !== 'recording' ? <Button title={rec.state === 'stopped' ? 'Record again' : 'Start recording'} onPress={rec.start} /> : <Button variant="danger" title={`Stop (${rec.seconds}s)`} onPress={rec.stop} />}
      {(rec.state === 'recording' || rec.state === 'stopped') && (
        <TextInput multiline editable={rec.state === 'stopped'} value={rec.transcript + (rec.interim ? ` ${rec.interim}` : '')} onChangeText={rec.setTranscript} placeholder={rec.mode === 'speech' ? 'Listening…' : 'Type what you said (speech recognition unavailable)'} placeholderTextColor={t.muted} accessibilityLabel="Transcript" style={{ minHeight: 100, borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 12, color: t.text, textAlignVertical: 'top' }} />
      )}
      {rec.state === 'stopped' && <Button title="Save answer" loading={busy} onPress={submit} />}
      {err && <Notice tone="error" text={err} />}
      {last && (
        <Card>
          <H2>Last answer</H2>
          <P>{last.metrics.wordCount} words · {last.metrics.wordsPerMinute} words/min · {last.metrics.fillerCount} filler words</P>
          {last.feedback?.aiStatus === 'evaluating' && <P muted>AI feedback in progress…</P>}
          {last.feedback?.aiStatus === 'not_configured' && <P muted>AI feedback is not configured on this server.</P>}
          {last.feedback?.ai && <><P>Estimated band ≈ {last.feedback.ai.overallBand} (unofficial)</P><P>{last.feedback.ai.summary}</P>{last.feedback.ai.tips.map((x) => <P key={x} muted>• {x}</P>)}</>}
        </Card>
      )}
    </Screen>
  );
}
