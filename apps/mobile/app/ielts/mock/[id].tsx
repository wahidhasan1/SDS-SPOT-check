import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, Stack } from 'expo-router';
import { api, errorMessage } from '../../../src/lib/api';
import { fmtDuration, useInterval } from '../../../src/lib/hooks';
import { Badge, Button, Card, Chip, Disclaimer, ErrorText, H2, Loading, P, Row, Screen } from '../../../src/components/ui';
import { IeltsPlayer } from '../../../src/components/IeltsPlayer';
import { PromptCard, WritingEditor } from '../../../src/components/WritingEditor';
import { SpeakingRecorder } from '../../../src/components/SpeakingRecorder';

export default function MockRunner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [part, setPart] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState(false);
  useInterval(() => setNow(Date.now()), 1000);
  const load = useCallback(async () => {
    try {
      setM(await api.get(`/ielts/mock-attempts/${id}`));
      setPart(0);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }, [id]);
  useEffect(() => void load(), [load]);
  const cur = m?.current;
  const remaining = cur?.deadline ? Math.floor((Date.parse(cur.deadline) - now) / 1000) : null;
  useEffect(() => {
    if (remaining !== null && remaining < -2) void load();
  }, [remaining, load]);
  if (!m) return <Screen>{err ? <ErrorText error={err} /> : <Loading />}</Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: m.title }} />
      <Row wrap>{m.sections.map((s: any) => <Badge key={s.skill} label={`${s.skill}${s.status === 'submitted' ? ` ✓ ${s.result?.band ?? ''}` : ''}`} tone={s.status === 'active' ? 'primary' : s.status === 'submitted' ? 'success' : 'default'} />)}</Row>
      <ErrorText error={err} />
      {m.status !== 'in_progress' ? (
        <Card>
          <H2>Results</H2>
          {m.sections.map((s: any) => <P key={s.skill}>{s.skill}: {s.result?.band ?? '—'}{s.result?.raw != null ? ` (${s.result.raw}/${s.result.total})` : ''}{s.result?.note ? ` — ${s.result.note}` : ''}</P>)}
          <H2>Overall: {m.overallBand ?? 'not available'}</H2>
          <Disclaimer />
        </Card>
      ) : cur && (
        <>
          <Card>
            <Row between><H2>{cur.skill}</H2>{remaining != null && <Badge label={`⏱ ${fmtDuration(Math.max(0, remaining))}`} tone={remaining < 120 ? 'danger' : 'default'} />}</Row>
            {confirm ? (
              <Row><Button title="Submit section" onPress={async () => { try { await api.post(`/ielts/mock-attempts/${id}/sections/${cur.index}/submit`); setConfirm(false); await load(); } catch (e) { setErr(errorMessage(e)); } }} /><Button variant="secondary" title="Cancel" onPress={() => setConfirm(false)} /></Row>
            ) : <Button title="Submit section" onPress={() => setConfirm(true)} />}
          </Card>
          {(cur.skill === 'listening' || cur.skill === 'reading') && (
            <>
              <Row wrap>{cur.attempts.map((a: any, i: number) => <Chip key={a.id} label={`${cur.skill === 'listening' ? 'Part' : 'Passage'} ${i + 1}`} on={part === i} onPress={() => setPart(i)} />)}</Row>
              <IeltsPlayer key={cur.attempts[part].id} attempt={cur.attempts[part]} embedded strictAudio={m.strict} />
            </>
          )}
          {cur.skill === 'writing' && (
            <>
              <Row>{cur.submissions.map((s: any, i: number) => <Chip key={s.id} label={`Task ${s.prompt.task}`} on={part === i} onPress={() => setPart(i)} />)}</Row>
              <PromptCard prompt={cur.submissions[part].prompt} />
              <WritingEditor key={cur.submissions[part].id} prompt={cur.submissions[part].prompt} initialText={cur.submissions[part].text} submissionId={cur.submissions[part].id} mockAttemptId={m.id} deadline={cur.deadline} />
            </>
          )}
          {cur.skill === 'speaking' && cur.prompts.map((p: any) => {
            const q = p.part === 2 ? p.text : p.questions[0];
            return (
              <Card key={p.id}>
                <P small muted>Part {p.part} · {p.topic}{cur.answered.some((a: any) => a.part === p.part) ? ' · answered' : ''}</P>
                <H2>{q}</H2>
                <SpeakingRecorder part={p.part} question={q} promptId={p.id} prepSeconds={p.part === 2 ? 60 : 0} speakSeconds={p.part === 2 ? 120 : 90} mockAttemptId={m.id} onResult={() => void load()} />
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}
