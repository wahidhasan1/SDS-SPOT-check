import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SpeakButton } from '@/components/learning/speak-button';
import { Banner, Button, Card, EmptyState, ErrorView, LoadingView, ProgressBar, Row, Screen, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

const GRADES = [
  { grade: 'again', label: 'Again', hint: '10 min', variant: 'danger' },
  { grade: 'hard', label: 'Hard', hint: 'sooner', variant: 'secondary' },
  { grade: 'good', label: 'Good', hint: 'later', variant: 'secondary' },
  { grade: 'easy', label: 'Easy', hint: 'much later', variant: 'success' },
] as const;

/** Spaced-repetition review of saved words (server-side SM-2 scheduling). */
export default function Review() {
  const qc = useQueryClient();
  const queue = useQuery({ queryKey: ['review-queue'], queryFn: () => api.getReviewQueue(20), staleTime: Infinity, gcTime: 0 });
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [xp, setXp] = useState(0);
  const grade = useMutation({
    mutationFn: (g: (typeof GRADES)[number]['grade']) => api.reviewWord(queue.data![i].id, g),
    onSuccess: (res) => {
      setXp((x) => x + res.xp);
      setRevealed(false);
      setI((n) => n + 1);
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['saved-words'] });
    },
  });

  if (queue.isPending) return <LoadingView />;
  if (queue.error) return <Screen title="Review" back><ErrorView error={queue.error} onRetry={() => queue.refetch()} /></Screen>;
  const words = queue.data!;

  if (words.length === 0 || i >= words.length) {
    return (
      <Screen title="Review" back>
        <EmptyState
          icon={words.length ? 'checkmark-done-circle' : 'leaf-outline'}
          title={words.length ? 'Review complete!' : 'Nothing to review'}
          message={words.length ? `You reviewed ${words.length} word${words.length === 1 ? '' : 's'} and earned ${xp} XP. They'll come back right before you forget them.` : 'Save words from quizzes, battles or the word list. They will appear here when they are due.'}
          action={<Button title={words.length ? 'Done' : 'Browse vocabulary'} onPress={() => (words.length ? router.back() : router.replace('/vocab'))} />}
        />
      </Screen>
    );
  }

  const w = words[i];
  return (
    <Screen title="Review" subtitle={`${i + 1} of ${words.length} due`} back
      footer={revealed ? (
        <Row gap={Spacing.sm}>
          {GRADES.map((g) => (
            <View key={g.grade} style={{ flex: 1, gap: 2 }}>
              <Button testID={`grade-${g.grade}`} title={g.label} variant={g.variant} size="md" disabled={grade.isPending} onPress={() => grade.mutate(g.grade)} />
              <Text variant="tiny" color="textFaint" align="center">{g.hint}</Text>
            </View>
          ))}
        </Row>
      ) : <Button testID="review-show" title="Show meaning" size="lg" onPress={() => setRevealed(true)} />}>
      <ProgressBar value={i / words.length} />
      {grade.error ? <Banner tone="danger" message={errorMessage(grade.error)} /> : null}
      <Card style={{ alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md }}>
        <Text variant="display" align="center">{w.word}</Text>
        <Row>
          {w.phonetic ? <Text color="textMuted">{w.phonetic}</Text> : null}
          {w.part_of_speech ? <Text variant="smallStrong" color="primary">{w.part_of_speech}</Text> : null}
          <SpeakButton text={w.word} />
        </Row>
        {revealed ? (
          <View style={{ gap: Spacing.sm, alignItems: 'center' }}>
            <Text variant="h3" align="center" style={{ fontWeight: '500' }}>{w.definition}</Text>
            {w.example ? <Text color="textMuted" align="center" style={{ fontStyle: 'italic' }}>“{w.example}”</Text> : null}
            {w.context_sentence ? <Text variant="small" color="textMuted" align="center">Seen in: {w.context_sentence}</Text> : null}
          </View>
        ) : <Text color="textMuted">Do you remember what it means?</Text>}
      </Card>
    </Screen>
  );
}
