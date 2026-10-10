import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, EmptyState, ErrorView, Icon, LoadingView, Row, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';

const ICONS: Record<string, string> = { achievement: 'trophy', assessment: 'analytics', battle: 'flash', streak: 'flame', review: 'repeat', subscription: 'star', system: 'information-circle' };

/** In-app notification inbox. */
export default function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: api.getNotifications });
  const markAll = useMutation({ mutationFn: api.markAllNotificationsRead, onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboard'] }); } });
  const del = useMutation({ mutationFn: api.deleteNotification, onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });

  // Opening the inbox marks everything as read.
  useEffect(() => { if (q.data?.some((n) => !n.read_at)) markAll.mutate(); }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isPending) return <LoadingView />;
  if (q.error) return <Screen title="Notifications" back><ErrorView error={q.error} onRetry={() => q.refetch()} /></Screen>;
  return (
    <Screen title="Notifications" back right={<Button title="Settings" variant="ghost" size="sm" onPress={() => router.push('/settings/notifications')} />}
      refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.data!.length === 0 ? <EmptyState icon="notifications-off-outline" title="You're all caught up" message="Achievements and assessment results will appear here." /> : q.data!.map((n) => (
        <Card key={n.id} tone={n.read_at ? 'surface' : 'primary'}>
          <Row gap={Spacing.md} style={{ alignItems: 'flex-start' }}>
            <Icon name={ICONS[n.kind] ?? 'notifications'} color="primary" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{n.title}</Text>
              {n.body ? <Text variant="small" color="textMuted">{n.body}</Text> : null}
              <Text variant="tiny" color="textFaint">{new Date(n.created_at).toLocaleString()}</Text>
            </View>
            <Pressable onPress={() => del.mutate(n.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Delete notification">
              <Icon name="close" color="textFaint" size={18} />
            </Pressable>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
