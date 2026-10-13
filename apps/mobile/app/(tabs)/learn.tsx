import { useState } from 'react';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { Badge, Button, Card, Chip, H2, Loading, Notice, P, Row, Screen } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';
import { useTheme } from '../../src/lib/theme';
import { useApi } from '../../src/lib/useApi';
import { playUrl } from '../../src/lib/audio';

interface Lesson { slug: string; title: string; pathLevel: string; cefrLevel: string; summary: string; status: string | null }
interface Word { id: string; word: string; partOfSpeech: string; definition: string; example: string; cefrLevel: string; audioUrl: string | null; savedId: string | null }

export default function Learn() {
  const t = useTheme();
  const [tab, setTab] = useState<'grammar' | 'vocab'>('vocab');
  const lessons = useApi<{ lessons: Lesson[] }>(tab === 'grammar' ? '/api/lessons' : null, [tab]);
  const daily = useApi<{ words: Word[] }>(tab === 'vocab' ? '/api/vocab/daily' : null, [tab]);
  const stats = useApi<{ stats: { total: number; due: number } }>('/api/vocab/stats', [tab]);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async (w: Word) => {
    try {
      await api.post('/api/vocab/my', { wordId: w.id, source: 'daily' });
      setMsg(`“${w.word}” saved`);
      daily.reload();
      stats.reload();
    } catch (e) {
      setMsg(errorMessage(e));
    }
  };
  return (
    <Screen>
      <Row><Chip label="Vocabulary" selected={tab === 'vocab'} onPress={() => setTab('vocab')} /><Chip label="Grammar" selected={tab === 'grammar'} onPress={() => setTab('grammar')} /></Row>
      {tab === 'vocab' ? (
        <>
          <Row>
            <Button small title={`Flashcards (${stats.data?.stats.due ?? 0} due)`} onPress={() => router.push('/vocab/review')} />
            <Button small variant="secondary" title={`My words (${stats.data?.stats.total ?? 0})`} onPress={() => router.push('/vocab/my')} />
          </Row>
          {msg && <Notice text={msg} tone="success" />}
          <H2>Today’s words</H2>
          {!daily.data ? <Loading /> : daily.data.words.map((w) => (
            <Card key={w.id}>
              <Row><Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>{w.word}</Text><Badge text={w.cefrLevel} />{w.audioUrl && <Button small variant="ghost" title="🔊" onPress={() => playUrl(w.audioUrl!)} />}</Row>
              <P muted>{w.partOfSpeech}</P>
              <P>{w.definition}</P>
              <P muted>“{w.example}”</P>
              {w.savedId ? <Badge text="Saved" tone="green" /> : <Button small variant="secondary" title="Save word" onPress={() => save(w)} />}
            </Card>
          ))}
        </>
      ) : !lessons.data ? <Loading /> : (
        (['beginner', 'intermediate', 'advanced'] as const).map((level) => (
          <Card key={level}>
            <H2>{level[0].toUpperCase() + level.slice(1)}</H2>
            {lessons.data!.lessons.filter((l) => l.pathLevel === level).map((l) => (
              <Card key={l.slug} onPress={() => router.push(`/lesson/${l.slug}`)} style={{ padding: 12 }}>
                <Row><Text style={{ color: t.text, fontWeight: '600', flex: 1 }}>{l.title}</Text>{l.status === 'completed' ? <Badge text="Done" tone="green" /> : <Badge text={l.cefrLevel} tone="slate" />}</Row>
              </Card>
            ))}
          </Card>
        ))
      )}
    </Screen>
  );
}
