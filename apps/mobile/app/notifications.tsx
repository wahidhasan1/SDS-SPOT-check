import { Text } from 'react-native';
import { Stack } from 'expo-router';
import { Button, Card, Empty, Loading, P, Screen } from '../src/components/ui';
import { api } from '../src/lib/api';
import { useTheme } from '../src/lib/theme';
import { useApi } from '../src/lib/useApi';

interface N { id: string; title: string; body: string; readAt: string | null; createdAt: string }

export default function Notifications() {
  const t = useTheme();
  const n = useApi<{ notifications: N[] }>('/api/notifications');
  if (!n.data) return <Screen><Loading /></Screen>;
  return (
    <Screen onRefresh={n.reload}>
      <Stack.Screen options={{ title: 'Notifications' }} />
      {n.data.notifications.some((x) => !x.readAt) && <Button small variant="secondary" title="Mark all as read" onPress={async () => { await api.post('/api/notifications/read-all'); n.reload(); }} />}
      {n.data.notifications.length === 0 ? <Empty title="No notifications" /> : n.data.notifications.map((x) => (
        <Card key={x.id} onPress={async () => { if (!x.readAt) { await api.post(`/api/notifications/${x.id}/read`).catch(() => {}); n.reload(); } }}>
          <Text style={{ color: t.text, fontWeight: x.readAt ? '500' : '800' }}>{x.title}</Text>
          <P muted>{x.body}</P>
          <P muted style={{ fontSize: 12 }}>{new Date(x.createdAt).toLocaleString()}</P>
        </Card>
      ))}
    </Screen>
  );
}
