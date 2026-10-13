import { useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Text, TextInput } from 'react-native';
import { Badge, Button, Card, Chip, H1, H2, Loading, Notice, P, Screen } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';
import { useTheme } from '../../src/lib/theme';
import { useApi } from '../../src/lib/useApi';

interface Data { lesson: { slug: string; title: string; summary: string; body: string; cefrLevel: string; examples: { text: string; note?: string; correct?: boolean }[] }; exercises: { id: string; type: 'mcq' | 'fill'; prompt: string; options: string[] }[]; next: { slug: string; title: string } | null }
interface Result { score: number; maxScore: number; passed: boolean; results: { id: string; correct: boolean; correctAnswer: string; explanation: string }[] }

/** Renders the lesson markdown-lite body: ## headings, - bullets, **bold** markers removed. */
function Body({ text }: { text: string }) {
  const t = useTheme();
  return (
    <>
      {text.split(/\n\s*\n/).map((block, i) => {
        const clean = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/~~([^~]+)~~/g, '$1').replace(/\*([^*]+)\*/g, '$1');
        if (block.startsWith('## ')) {
          const [h, ...rest] = block.split('\n');
          return (
            <Text key={i} style={{ color: t.text }}>
              <Text style={{ fontWeight: '800', fontSize: 17 }}>{clean(h.slice(3))}{'\n'}</Text>
              {rest.map((l) => clean(l.replace(/^- /, '• '))).join('\n')}
            </Text>
          );
        }
        return <Text key={i} style={{ color: t.text, fontSize: 15, lineHeight: 23 }}>{block.split('\n').map((l) => clean(l.replace(/^- /, '• '))).join('\n')}</Text>;
      })}
    </>
  );
}

export default function LessonScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = useTheme();
  const { data, error } = useApi<Data>(`/api/lessons/${slug}`, [slug]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (error) return <Screen><Notice tone="error" text={error} /></Screen>;
  if (!data) return <Screen><Loading /></Screen>;
  const byId = new Map(result?.results.map((r) => [r.id, r]));
  return (
    <Screen>
      <Stack.Screen options={{ title: data.lesson.title }} />
      <Badge text={data.lesson.cefrLevel} />
      <H1>{data.lesson.title}</H1>
      <Card><Body text={data.lesson.body} /></Card>
      <H2>Examples</H2>
      <Card>{data.lesson.examples.map((e, i) => <P key={i} style={{ color: e.correct === false ? t.danger : t.text }}>{e.correct === false ? '✗ ' : '✓ '}{e.text}{e.note ? ` — ${e.note}` : ''}</P>)}</Card>
      <H2>Practice</H2>
      {result && <Notice tone={result.passed ? 'success' : 'warning'} text={`${result.score}/${result.maxScore} correct${result.passed ? ' — lesson completed!' : ' — 70% needed to complete.'}`} />}
      {data.exercises.map((e, i) => {
        const r = byId.get(e.id);
        return (
          <Card key={e.id}>
            <P>{i + 1}. {e.prompt}</P>
            {e.type === 'mcq' ? e.options.map((o) => <Chip key={o} label={o} selected={answers[e.id] === o} onPress={() => !result && setAnswers({ ...answers, [e.id]: o })} />) : (
              <TextInput accessibilityLabel={`Answer ${i + 1}`} editable={!result} value={answers[e.id] ?? ''} onChangeText={(v) => setAnswers({ ...answers, [e.id]: v })} autoCapitalize="none" style={{ borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 10, color: t.text }} />
            )}
            {r && <Notice tone={r.correct ? 'success' : 'error'} text={`${r.correct ? 'Correct.' : `Answer: ${r.correctAnswer}.`} ${r.explanation}`} />}
          </Card>
        );
      })}
      {err && <Notice tone="error" text={err} />}
      {!result ? (
        <Button title="Check my answers" loading={busy} onPress={async () => { setBusy(true); try { setResult(await api.post<Result>(`/api/lessons/${slug}/submit`, { answers })); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); } }} />
      ) : (
        <>
          <Button title="Try again" variant="secondary" onPress={() => { setResult(null); setAnswers({}); }} />
          {data.next && <Button title={`Next: ${data.next.title}`} onPress={() => router.replace(`/lesson/${data.next!.slug}`)} />}
        </>
      )}
    </Screen>
  );
}
