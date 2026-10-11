import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, ErrorView, LevelBadge, LoadingView, Row, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';

/** Words in a topic, filterable by level. */
export default function TopicWords() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const topics = useQuery({ queryKey: ['topics'], queryFn: api.getTopics });
  const words = useQuery({ queryKey: ['topic-words', topic], queryFn: () => api.getTopicWords(topic!), enabled: !!topic });
  const [level, setLevel] = useState<string | null>(null);
  const meta = topics.data?.find((t) => t.id === topic);
  const levels = useMemo(() => Array.from(new Set((words.data ?? []).map((w) => w.level))), [words.data]);
  const shown = (words.data ?? []).filter((w) => !level || w.level === level);

  if (words.isPending) return <LoadingView />;
  if (words.error) return <Screen title={meta?.name ?? 'Topic'} back><ErrorView error={words.error} onRetry={() => words.refetch()} /></Screen>;

  return (
    <Screen
      title={meta?.name ?? 'Topic'}
      subtitle={meta?.description ?? undefined}
      back
      footer={<Button testID="topic-quiz" title="Quiz this topic" icon="play" size="lg" onPress={() => router.push({ pathname: '/quiz', params: { kind: 'topic', topic: topic!, title: meta?.name ?? 'Topic quiz' } })} />}>
      <Row wrap>
        <Chip label="All levels" selected={!level} onPress={() => setLevel(null)} />
        {levels.map((l) => <Chip key={l} label={l} selected={level === l} onPress={() => setLevel(l)} />)}
      </Row>
      <View style={{ gap: Spacing.sm }}>
        {shown.map((w) => (
          <Card key={w.id} onPress={() => router.push(`/word/${w.id}`)} accessibilityLabel={w.word}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{w.word} <Text variant="small" color="textMuted">{w.part_of_speech}</Text></Text>
                <Text variant="small" color="textMuted" numberOfLines={2}>{w.definition}</Text>
              </View>
              <LevelBadge level={w.level} />
            </Row>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
