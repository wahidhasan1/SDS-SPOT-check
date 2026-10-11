import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { optionStates, QuestionCard } from '@/components/learning/question-card';
import { Banner, Button, ErrorView, LoadingView, ProgressBar, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import type { AssessmentState } from '@/lib/types';

/** Adaptive vocabulary assessment (initial and retakes). Correctness is never revealed mid-assessment. */
export default function AssessmentRun() {
  const queryClient = useQueryClient();
  const start = useQuery({ queryKey: ['assessment-start'], queryFn: api.startAssessment, staleTime: Infinity, gcTime: 0, retry: false });
  const [updated, setState] = useState<AssessmentState | null>(null);
  const state = updated ?? start.data ?? null;
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (state?.finished) {
      for (const key of ['dashboard', 'assessment-status', 'achievements', 'battle-lobby']) queryClient.invalidateQueries({ queryKey: [key] });
      router.replace({ pathname: '/assessment/result', params: { id: state.assessment_id } });
    }
  }, [state, queryClient]);

  const submit = useMutation({
    mutationFn: () => api.submitAssessmentAnswer(state!.assessment_id, state!.question!.id, selected!),
    onSuccess: (next) => { setState(next); setSelected(null); },
  });

  if (start.isPending || !state) {
    if (start.error) {
      return (
        <Screen title="Assessment" back>
          <ErrorView error={start.error} title="Can't start the assessment" onRetry={() => start.refetch()} />
        </Screen>
      );
    }
    return <LoadingView label="Preparing your assessment…" />;
  }
  if (state.finished || !state.question) return <LoadingView label="Calculating your level…" />;

  const index = state.index ?? 0;
  const total = state.total ?? 15;

  const leave = () => {
    const go = () => (router.canGoBack() ? router.back() : router.replace('/'));
    if (Platform.OS === 'web') { go(); return; }
    Alert.alert('Pause assessment?', 'Your progress is saved for an hour. You can resume where you left off.', [
      { text: 'Keep going', style: 'cancel' }, { text: 'Pause', onPress: go },
    ]);
  };

  return (
    <Screen
      title={state.kind === 'retake' ? 'Level check' : 'Vocabulary assessment'}
      back={false}
      right={<Button title="Pause" variant="ghost" size="sm" onPress={leave} />}
      footer={
        <Button testID="assessment-next" title={index + 1 === total ? 'Finish' : 'Next'} size="lg" disabled={selected === null}
          loading={submit.isPending} onPress={() => submit.mutate()} />
      }>
      <View style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="smallStrong" color="textMuted">Question {index + 1} of {total}</Text>
          <Text variant="small" color="textFaint">Adaptive</Text>
        </Row>
        <ProgressBar value={index / total} />
      </View>
      {submit.error ? <Banner tone="danger" message={errorMessage(submit.error)} /> : null}
      <QuestionCard
        key={state.question.id}
        question={state.question}
        states={optionStates(state.question.options.length, { selected, reveal: false })}
        onSelect={setSelected}
        disabled={submit.isPending}
      />
    </Screen>
  );
}
