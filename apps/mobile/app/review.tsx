import { useState } from 'react';
import { Stack } from 'expo-router';
import * as Speech from 'expo-speech';
import { api } from '../src/lib/api';
import { useApi } from '../src/lib/hooks';
import { Button, Card, Empty, H1, Loading, P, ProgressBar, Row, Screen } from '../src/components/ui';

export default function Review() {
  const { data, loading, reload } = useApi<any[]>('/vocabulary/review');
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [done, setDone] = useState(0);
  if (loading) return <Loading />;
  const card = data?.[i];
  const rate = async (q: number) => {
    await api.post(`/vocabulary/saved/${card.id}/review`, { quality: q });
    setDone(done + 1);
    setFlip(false);
    if (i + 1 < (data?.length ?? 0)) setI(i + 1);
    else {
      setI(0);
      reload();
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Review' }} />
      {!card ? <Empty icon="🎉" title={done ? `${done} word(s) reviewed!` : 'Nothing due right now'} sub="Words come back just before you'd forget them." /> : (
        <>
          <ProgressBar value={i} max={data!.length} />
          <Card style={{ alignItems: 'center', minHeight: 220, justifyContent: 'center' }}>
            <H1>{card.word}</H1>
            <Button small variant="ghost" title="🔊 Listen" onPress={() => Speech.speak(card.word, { language: 'en-GB' })} />
            {flip ? <><P>{card.meaning}</P>{card.example && <P small muted>“{card.example}”</P>}</> : <Button title="Show meaning" onPress={() => setFlip(true)} />}
          </Card>
          {flip && (
            <Row wrap>
              <Button small variant="danger" title="Forgot" onPress={() => rate(1)} />
              <Button small variant="secondary" title="Hard" onPress={() => rate(3)} />
              <Button small title="Good" onPress={() => rate(4)} />
              <Button small variant="success" title="Easy" onPress={() => rate(5)} />
            </Row>
          )}
        </>
      )}
    </Screen>
  );
}
