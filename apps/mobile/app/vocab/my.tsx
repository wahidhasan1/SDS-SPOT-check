import { Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Badge, Button, Card, Empty, Loading, P, Row, Screen } from '../../src/components/ui';
import { api } from '../../src/lib/api';
import { useApi } from '../../src/lib/useApi';

interface W { id: string; word: string; definition: string; context: string | null; status: 'learning' | 'reviewing' | 'mastered'; source: string }

export default function MyWords() {
  const { data, loading, reload } = useApi<{ words: W[]; rules: string }>('/api/vocab/my');
  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <Stack.Screen options={{ title: 'My words' }} />
      {!data ? <Loading /> : data.words.length === 0 ? <Empty title="No saved words" text="Save words from daily words, lessons and the book reader." /> : (
        <>
          <P muted style={{ fontSize: 12 }}>{data.rules}</P>
          {data.words.map((w) => (
            <Card key={w.id}>
              <Row><P style={{ fontWeight: '700', flex: 1 }}>{w.word}</P><Badge text={w.status} tone={w.status === 'mastered' ? 'green' : w.status === 'reviewing' ? 'brand' : 'amber'} /></Row>
              <P>{w.definition}</P>
              {w.context && <P muted>“{w.context}”</P>}
              <Button small variant="ghost" title="Remove" onPress={() => Alert.alert('Remove word?', `Remove “${w.word}” from your list?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => { await api.del(`/api/vocab/my/${w.id}`); reload(); } }])} />
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
