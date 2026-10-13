import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { api } from '../src/lib/api';
import { fmtDate, useApi } from '../src/lib/hooks';
import { Card, Empty, Loading, P, Screen } from '../src/components/ui';

export default function Notifications() {
  const { data, loading } = useApi<any>('/me/notifications');
  useEffect(() => {
    if (data?.unread) void api.post('/me/notifications/read', {});
  }, [data]);
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Notifications' }} />
      {loading ? <Loading /> : !data.items.length ? <Empty icon="🔔" title="No notifications" /> : data.items.map((n: any) => (
        <Card key={n.id}><P style={{ fontWeight: '700' }}>{n.title}</P><P small>{n.body}</P><P small muted>{fmtDate(n.created_at)}</P></Card>
      ))}
    </Screen>
  );
}
