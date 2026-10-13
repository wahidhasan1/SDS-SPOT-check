import { Stack } from 'expo-router';
import { fmtDate, useApi } from '../src/lib/hooks';
import { Card, Disclaimer, ErrorText, H2, Loading, P, ProgressBar, Row, Screen } from '../src/components/ui';

export default function Progress() {
  const { data, loading, error } = useApi<any>('/me/dashboard');
  const plan = useApi<any>('/me/study-plan');
  if (loading) return <Loading />;
  if (error) return <Screen><ErrorText error={error} /></Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Progress' }} />
      <Card>
        <Row between><P>English level (placement)</P><P>{data.profile.cefrLevel ?? '—'}</P></Row>
        <Row between><P>IELTS estimate</P><P>{data.ielts.estimatedOverall ?? 'needs all 4 skills'}</P></Row>
        <Row between><P>Battle rating</P><P>{data.battles.rating}</P></Row>
        <Row between><P>Words mastered</P><P>{data.vocabulary.mastered}/{data.vocabulary.saved}</P></Row>
      </Card>
      <Card>
        <H2>IELTS skills</H2>
        {(['listening', 'reading', 'writing', 'speaking'] as const).map((k) => (
          <Card key={k} style={{ padding: 10 }}>
            <Row between><P>{k}</P><P small>{data.ielts.skills[k].band ?? 'not scored'}</P></Row>
            <ProgressBar value={data.ielts.skills[k].band ?? 0} max={9} />
          </Card>
        ))}
        <Disclaimer />
      </Card>
      {plan.data && (
        <Card>
          <H2>This week's plan</H2>
          {plan.data.week.map((w: any) => <Row key={w.day} between><P small>{w.day}</P><P small>{w.focus.replace('_', ' ')} · {w.minutes} min</P></Row>)}
        </Card>
      )}
      <Card>
        <H2>Level history</H2>
        {data.levelHistory.map((l: any, i: number) => <P key={i} small>{fmtDate(l.created_at)} — {l.level}</P>)}
      </Card>
    </Screen>
  );
}
