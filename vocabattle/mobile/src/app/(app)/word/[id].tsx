import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { SpeakButton } from '@/components/learning/speak-button';
import { Banner, Button, Card, Chip, ErrorView, LevelBadge, LoadingView, Row, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** Vocabulary detail. */
export default function WordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const word = useQuery({ queryKey: ['word', id], queryFn: () => api.getWord(id!), enabled: !!id });
  const saved = useQuery({ queryKey: ['word-saved', id], queryFn: () => api.isWordSaved(id!), enabled: !!id });
  const toggle = useMutation({
    mutationFn: async () => (saved.data ? api.removeWord(saved.data) : api.saveWord(id!, 'library')),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['word-saved', id] }); qc.invalidateQueries({ queryKey: ['saved-words'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });

  if (word.isPending) return <LoadingView />;
  if (word.error || !word.data) return <Screen title="Word" back><ErrorView error={word.error} onRetry={() => word.refetch()} /></Screen>;
  const w = word.data;

  return (
    <Screen back title=" "
      footer={<Button testID="word-save" title={saved.data ? 'Remove from my vocabulary' : 'Save to my vocabulary'} icon={saved.data ? 'bookmark' : 'bookmark-outline'}
        variant={saved.data ? 'secondary' : 'primary'} loading={toggle.isPending || saved.isPending} onPress={() => toggle.mutate()} />}>
      <View style={{ gap: Spacing.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="display" testID="word-title">{w.word}</Text>
          <SpeakButton text={w.word} size={22} />
        </Row>
        <Row wrap>
          {w.phonetic ? <Text color="textMuted">{w.phonetic}</Text> : null}
          <Text variant="smallStrong" color="primary">{w.part_of_speech}</Text>
          <LevelBadge level={w.level} />
        </Row>
      </View>
      {toggle.error ? <Banner tone="danger" message={errorMessage(toggle.error)} /> : null}
      <Card>
        <Text variant="tiny" color="textMuted">DEFINITION</Text>
        <Text variant="h3" style={{ fontWeight: '500' }}>{w.definition}</Text>
        <Text variant="tiny" color="textMuted" style={{ marginTop: Spacing.sm }}>EXAMPLE</Text>
        <Row style={{ alignItems: 'flex-start' }}>
          <Text style={{ flex: 1, fontStyle: 'italic' }}>“{w.example}”</Text>
          <SpeakButton text={w.example} size={16} />
        </Row>
        {w.usage_note ? <><Text variant="tiny" color="textMuted" style={{ marginTop: Spacing.sm }}>USAGE</Text><Text>{w.usage_note}</Text></> : null}
      </Card>
      {w.synonyms.length ? (
        <View style={{ gap: Spacing.sm }}>
          <Text variant="h3">Synonyms</Text>
          <Row wrap>{w.synonyms.map((s) => <Chip key={s} label={s} />)}</Row>
        </View>
      ) : null}
      {w.antonyms.length ? (
        <View style={{ gap: Spacing.sm }}>
          <Text variant="h3">Antonyms</Text>
          <Row wrap>{w.antonyms.map((s) => <Chip key={s} label={s} />)}</Row>
        </View>
      ) : null}
      {w.ielts_note ? <Banner tone="info" icon="school" title="IELTS usage" message={w.ielts_note} /> : null}
      <Text variant="small" color="textFaint">Topic: {w.topic_id.replace(/_/g, ' ')} · Pronunciation uses your device’s text-to-speech voice.</Text>
    </Screen>
  );
}
