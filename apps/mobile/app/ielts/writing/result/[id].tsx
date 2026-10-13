import { useLocalSearchParams, Stack } from 'expo-router';
import { useApi } from '../../../../src/lib/hooks';
import { Badge, Card, Disclaimer, ErrorText, H2, Loading, Notice, P, Row, Screen } from '../../../../src/components/ui';

export default function WritingResult() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error } = useApi<any>(`/ielts/writing/submissions/${id}`);
  if (loading) return <Loading />;
  if (error) return <Screen><ErrorText error={error} /></Screen>;
  const fb = data.feedback;
  const m = data.metrics;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Feedback' }} />
      <Card><H2>{data.prompt.title}</H2><P small muted>{data.wordCount} words</P><P>{data.text}</P></Card>
      {fb ? (
        <Card>
          <Row between><H2>Feedback</H2><Badge label={`Band ≈ ${data.bandEstimate}`} tone="primary" /></Row>
          <Disclaimer />
          <P>{fb.summary}</P>
          {Object.entries(fb.criteria).map(([k, v]: any) => <P key={k} small><P small style={{ fontWeight: '700' }}>{k} ({fb.bandEstimates[k]}): </P>{v}</P>)}
          <H2>Focus on next</H2>
          {fb.priorities.map((p: string) => <P key={p}>• {p}</P>)}
          {fb.errors.map((e: any, i: number) => <P key={i} small>“{e.excerpt}” → {e.correction} — {e.explanation}</P>)}
        </Card>
      ) : <Notice text={`${m?.aiError ?? 'AI feedback was not available.'} No band is estimated from text checks alone.`} />}
      {m && (
        <Card>
          <H2>Measurable checks</H2>
          {m.checks.map((c: any) => <P key={c.id} small>{c.status === 'good' ? '✅' : c.status === 'warn' ? '⚠️' : 'ℹ️'} {c.title} — <P small muted>{c.detail}</P></P>)}
          {m.spelling?.length > 0 && <P small>Possible spelling: {m.spelling.map((s: any) => `${s.word}${s.suggestions[0] ? ` → ${s.suggestions[0]}` : ''}`).join(', ')}</P>}
        </Card>
      )}
    </Screen>
  );
}
