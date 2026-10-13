import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { CEFR_LABELS } from '@app/shared';
import { api, errorMessage, mediaUrl } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { Badge, Button, Card, ErrorText, H1, H2, Loading, Option, P, ProgressBar, Row, Screen } from '../src/components/ui';

function Clip({ url }: { url: string }) {
  const player = useAudioPlayer(mediaUrl(url));
  const status = useAudioPlayerStatus(player);
  return <Button small variant="secondary" title={status.playing ? '⏸ Pause' : '▶ Play the recording'} onPress={() => (status.playing ? player.pause() : (player.seekTo(0), player.play()))} />;
}

export default function Assessment() {
  const { refreshUser } = useAuth();
  const [phase, setPhase] = useState<'loading' | 'intro' | 'test' | 'result'>('loading');
  const [id, setId] = useState<string | null>(null);
  const [item, setItem] = useState<any>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get<any>('/assessment/current').then((r) => {
      if (r.assessment) {
        setId(r.assessment.assessmentId);
        setItem(r.assessment.item);
        setPhase('test');
      } else setPhase('intro');
    }).catch(() => setPhase('intro'));
  }, []);
  const start = async () => {
    try {
      const r = await api.post<any>('/assessment/start');
      setId(r.assessmentId);
      setItem(r.item);
      setPhase('test');
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const next = async () => {
    setBusy(true);
    try {
      const r = await api.post<any>(`/assessment/${id}/answer`, { itemId: item.id, answer: choice });
      setChoice(null);
      if (r.done) {
        setResult(r.result);
        setPhase('result');
        await refreshUser();
      } else setItem(r.item);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (phase === 'loading') return <Loading />;
  return (
    <Screen>
      {phase === 'intro' && (
        <>
          <H1>Placement test</H1>
          <P>About 20 adaptive questions on vocabulary, grammar, reading and listening (10–15 minutes). Turn your sound on.</P>
          <P small muted>Gives an app-level CEFR estimate, not an official certificate.</P>
          <ErrorText error={err} />
          <Button title="Start" onPress={start} />
          <Button title="Skip for now" variant="ghost" onPress={() => router.replace('/(tabs)/home')} />
        </>
      )}
      {phase === 'test' && item && (
        <>
          <Row between><Badge label={item.skill} tone="primary" /><P small muted>{item.index + 1} / {item.total}</P></Row>
          <ProgressBar value={item.index} max={item.total} />
          {item.passage && <Card><P>{item.passage}</P></Card>}
          {item.audioUrl && <Clip key={item.id} url={item.audioUrl} />}
          <H2>{item.prompt}</H2>
          {item.options.map((o: string) => <Option key={o} label={o} selected={choice === o} onPress={() => setChoice(o)} />)}
          <ErrorText error={err} />
          <Button title="Next" disabled={!choice} loading={busy} onPress={next} />
        </>
      )}
      {phase === 'result' && result && (
        <>
          <H1>Your level: {result.level}</H1>
          <P>{CEFR_LABELS[result.level as keyof typeof CEFR_LABELS]} · {result.correct}/{result.answered} correct</P>
          {Object.entries(result.skills).map(([k, s]: any) => <Card key={k}><Row between><P>{k}</P><Badge label={s.level} tone="primary" /></Row></Card>)}
          <Button title="Go to my dashboard" onPress={() => router.replace('/(tabs)/home')} />
        </>
      )}
    </Screen>
  );
}
