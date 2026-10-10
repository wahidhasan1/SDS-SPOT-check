import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Button, Card, EmptyState, ErrorView, Icon, LoadingView, Row, Screen, Segmented, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';

type Filter = 'all' | 'learning' | 'reviewing' | 'mastered';

/** Saved vocabulary collection. */
export default function SavedWords() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['saved-words'], queryFn: api.getSavedWords });
  const [filter, setFilter] = useState<Filter>('all');
  const remove = useMutation({
    mutationFn: (id: string) => api.removeWord(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saved-words'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });

  if (q.isPending) return <LoadingView />;
  if (q.error) return <Screen title="Saved vocabulary" back><ErrorView error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const all = q.data!;
  const due = all.filter((w) => new Date(w.due_at) <= new Date()).length;
  const shown = filter === 'all' ? all : all.filter((w) => w.status === filter);

  return (
    <Screen title="Saved vocabulary" subtitle={`${all.length} words · ${due} due for review`} back refreshing={q.isRefetching} onRefresh={() => q.refetch()}
      footer={due ? <Button title={`Review ${due} due word${due === 1 ? '' : 's'}`} icon="repeat" size="lg" onPress={() => router.push('/review')} /> : undefined}>
      <Segmented<Filter> value={filter} onChange={setFilter} options={[
        { value: 'all', label: 'All' }, { value: 'learning', label: 'Learning' }, { value: 'reviewing', label: 'Reviewing' }, { value: 'mastered', label: 'Mastered' },
      ]} />
      {shown.length === 0 ? (
        <EmptyState icon="bookmarks-outline" title="No words here yet" message="Tap “Save word” after a quiz question, in a battle summary or on any word page." />
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {shown.map((w) => (
            <Card key={w.id} onPress={w.entry_id ? () => router.push(`/word/${w.entry_id}`) : undefined}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Row><Text variant="bodyStrong">{w.word}</Text>
                    <Badge label={w.status} tone={w.status === 'mastered' ? 'success' : w.status === 'reviewing' ? 'info' : 'muted'} /></Row>
                  {w.definition ? <Text variant="small" color="textMuted" numberOfLines={2}>{w.definition}</Text> : null}
                  <Text variant="tiny" color="textFaint">
                    {new Date(w.due_at) <= new Date() ? 'DUE NOW' : `NEXT REVIEW ${new Date(w.due_at).toLocaleDateString().toUpperCase()}`} · FROM {w.source.toUpperCase()}
                  </Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${w.word}`} hitSlop={10} onPress={() => remove.mutate(w.id)}>
                  <Icon name="trash-outline" color="textFaint" />
                </Pressable>
              </Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
