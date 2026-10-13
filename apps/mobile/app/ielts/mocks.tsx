import { useState } from 'react';
import { router, Stack } from 'expo-router';
import { api, errorMessage } from '../../src/lib/api';
import { fmtDate, useApi } from '../../src/lib/hooks';
import { Button, Card, ErrorText, H2, Loading, Notice, P, Screen } from '../../src/components/ui';

export default function Mocks() {
  const { data, loading, error } = useApi<any>('/ielts/mocks');
  const [err, setErr] = useState<string | null>(null);
  const start = async (slug: string) => {
    try {
      const r = await api.post<any>(`/ielts/mocks/${slug}/start`, { strict: true });
      router.push(`/ielts/mock/${r.id}`);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  if (loading) return <Loading />;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Mock tests' }} />
      <ErrorText error={error ?? err} />
      <P small muted>{data.quota.limit == null ? 'Unlimited mock tests.' : `${data.quota.usedLast30Days}/${data.quota.limit} used in the last 30 days.`}</P>
      {!data.aiFeedback && <Notice text="Writing and Speaking need AI feedback (not configured), so only Listening and Reading are scored." />}
      {data.tests.map((t: any) => (
        <Card key={t.slug}><H2>{t.title}</H2><P small muted>{t.description}</P><Button title="Start (strict conditions)" onPress={() => start(t.slug)} /></Card>
      ))}
      {data.attempts.map((a: any) => (
        <Card key={a.id} onPress={() => router.push(`/ielts/mock/${a.id}`)}><P>{a.title} · {a.status}</P><P small muted>{fmtDate(a.started_at)} · overall {a.overall_band ?? '—'}</P></Card>
      ))}
    </Screen>
  );
}
