import { useState } from 'react';
import { Stack } from 'expo-router';
import * as Speech from 'expo-speech';
import { api, errorMessage } from '../src/lib/api';
import { useApi } from '../src/lib/hooks';
import { Badge, Button, Card, Chip, Empty, ErrorText, H2, Input, Loading, P, Row, Screen } from '../src/components/ui';

function Word({ w, onChange }: { w: any; onChange: () => void }) {
  const [saved, setSaved] = useState<boolean>(w.saved);
  return (
    <Card>
      <Row between>
        <Row><H2>{w.word}</H2><Button small variant="ghost" title="🔊" onPress={() => Speech.speak(w.word, { language: 'en-GB' })} /></Row>
        <Button small variant={saved ? 'secondary' : 'primary'} title={saved ? '✓ Saved' : '+ Save'} onPress={async () => {
          if (saved && w.savedId) await api.del(`/vocabulary/saved/${w.savedId}`);
          else await api.post('/vocabulary/saved', { word: w.word, vocabularyId: w.id, source: 'manual' });
          setSaved(!saved);
          onChange();
        }} />
      </Row>
      <P small muted>{w.ipa} · {w.partOfSpeech} · {w.cefr}</P>
      <P>{w.meaning}</P>
      {w.examples?.slice(0, 1).map((e: string) => <P key={e} small muted>“{e}”</P>)}
      {w.synonyms?.length > 0 && <P small>≈ {w.synonyms.join(', ')}</P>}
    </Card>
  );
}

export default function Vocabulary() {
  const [tab, setTab] = useState<'daily' | 'browse' | 'saved'>('daily');
  const [q, setQ] = useState('');
  const stats = useApi<any>('/vocabulary/stats');
  const daily = useApi<any>(tab === 'daily' ? '/vocabulary/daily' : null);
  const browse = useApi<any>(tab === 'browse' ? `/vocabulary?limit=40${q ? `&q=${encodeURIComponent(q)}` : ''}` : null, [q]);
  const saved = useApi<any[]>(tab === 'saved' ? '/vocabulary/saved' : null);
  const [add, setAdd] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Vocabulary' }} />
      {stats.data && <P>📚 {stats.data.saved} saved · 🔁 {stats.data.due} due · ⭐ {stats.data.mastered} mastered</P>}
      <Row>
        <Chip label="Today" on={tab === 'daily'} onPress={() => setTab('daily')} />
        <Chip label="Browse" on={tab === 'browse'} onPress={() => setTab('browse')} />
        <Chip label="My words" on={tab === 'saved'} onPress={() => setTab('saved')} />
      </Row>
      {tab === 'daily' && (daily.loading ? <Loading /> : daily.data?.words.map((w: any) => <Word key={w.id} w={w} onChange={stats.reload} />))}
      {tab === 'browse' && (
        <>
          <Input placeholder="Search words" value={q} onChangeText={setQ} autoCapitalize="none" />
          {browse.loading ? <Loading /> : browse.data?.items.map((w: any) => <Word key={w.id} w={w} onChange={stats.reload} />)}
        </>
      )}
      {tab === 'saved' && (
        <>
          <Row><Input style={{ flex: 1 }} placeholder="Add a word" value={add} onChangeText={setAdd} autoCapitalize="none" /><Button small title="Add" onPress={async () => { try { await api.post('/vocabulary/saved', { word: add.trim(), source: 'manual' }); setAdd(''); saved.reload(); stats.reload(); } catch (e) { setErr(errorMessage(e)); } }} /></Row>
          <ErrorText error={err} />
          {saved.loading ? <Loading /> : !saved.data?.length ? <Empty icon="📚" title="No saved words yet" /> : saved.data.map((w) => (
            <Card key={w.id}>
              <Row between><H2>{w.word}</H2>{w.mastered ? <Badge label="mastered" tone="success" /> : new Date(w.dueAt) <= new Date() ? <Badge label="due" tone="warning" /> : null}</Row>
              <P small>{w.meaning ?? '—'}</P>
              <P small muted>from {w.source}</P>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
