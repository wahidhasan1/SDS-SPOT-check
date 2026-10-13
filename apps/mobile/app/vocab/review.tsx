import { useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { Badge, Button, Card, Empty, H1, Loading, Notice, P, Progress, Row, Screen } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';
import { playUrl } from '../../src/lib/audio';
import { useApi } from '../../src/lib/useApi';

interface CardItem { id: string; word: string; definition: string; context: string | null; translation: string | null; status: string; audioUrl: string | null; partOfSpeech: string | null }

export default function Review() {
  const { data, loading, reload } = useApi<{ cards: CardItem[]; totalDue: number }>('/api/vocab/review?limit=20');
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [done, setDone] = useState<{ reviewed: number; correct: number } | null>(null);
  const [stats, setStats] = useState({ reviewed: 0, correct: 0 });
  const [err, setErr] = useState<string | null>(null);
  const start = useRef(Date.now());
  if (loading && !data) return <Screen><Loading /></Screen>;
  if (done) return <Screen><H1>Session complete</H1><P>You reviewed {done.reviewed} cards and recalled {done.correct}.</P><Button title="Check for more" onPress={() => { setDone(null); setI(0); setStats({ reviewed: 0, correct: 0 }); reload(); }} /></Screen>;
  if (!data?.cards.length) return <Screen><Stack.Screen options={{ title: 'Flashcards' }} /><Empty title="No cards due" text="Save words to start reviewing them with spaced repetition." /></Screen>;
  const c = data.cards[i];
  const rate = async (q: number) => {
    try {
      await api.post(`/api/vocab/review/${c.id}`, { quality: q });
      const next = { reviewed: stats.reviewed + 1, correct: stats.correct + (q >= 3 ? 1 : 0) };
      setStats(next);
      if (i + 1 >= data.cards.length) {
        await api.post('/api/vocab/review-session', { ...next, durationSec: Math.round((Date.now() - start.current) / 1000) }).catch(() => {});
        setDone(next);
      } else {
        setI(i + 1);
        setFlip(false);
      }
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Flashcards' }} />
      <P muted>Card {i + 1} of {data.cards.length}</P>
      <Progress value={i} max={data.cards.length} />
      <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
        <Badge text={c.status} tone="slate" />
        <H1>{c.word}</H1>
        {c.audioUrl && <Button small variant="ghost" title="🔊 Listen" onPress={() => playUrl(c.audioUrl!)} />}
        {flip ? (
          <>
            <P muted>{c.partOfSpeech ?? ''}</P>
            <P>{c.definition}</P>
            {c.translation && <P muted>{c.translation}</P>}
            {c.context && <P muted>“{c.context}”</P>}
          </>
        ) : <Button title="Show meaning" onPress={() => setFlip(true)} />}
      </Card>
      {err && <Notice tone="error" text={err} />}
      {flip && (
        <Row>
          <Button small variant="danger" title="Forgot" onPress={() => rate(1)} />
          <Button small variant="secondary" title="Hard" onPress={() => rate(3)} />
          <Button small title="Good" onPress={() => rate(4)} />
          <Button small variant="success" title="Easy" onPress={() => rate(5)} />
        </Row>
      )}
    </Screen>
  );
}
