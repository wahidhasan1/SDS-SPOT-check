import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { optionStates, QuestionCard } from '@/components/learning/question-card';
import {
  AnimatedNumber, Badge, Banner, Button, Card, EmptyState, ErrorView, Icon, LoadingView, ProgressBar, ProgressRing, Row, Screen, SectionHeader, Text,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { errorMessage, toAppError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import type { QuestionType, QuizAnswer, QuizSummary } from '@/lib/types';

/** Vocabulary / grammar quiz. Answers are checked by the server one at a time. */
export default function Quiz() {
  const params = useLocalSearchParams<{ kind?: string; topic?: string; types?: string; count?: string; title?: string }>();
  const qc = useQueryClient();
  const types = params.types ? (params.types.split(',').filter(Boolean) as QuestionType[]) : null;
  const start = useQuery({
    queryKey: ['quiz-start', params],
    queryFn: () => api.startQuiz({ kind: params.kind || (params.topic ? 'topic' : 'practice'), topicId: params.topic || null, types, count: Number(params.count) || 10 }),
    staleTime: Infinity, gcTime: 0, retry: false,
  });
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answer, setAnswer] = useState<QuizAnswer | null>(null);
  const [savedEntries, setSavedEntries] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<QuizSummary | null>(null);
  const [correct, setCorrect] = useState(0);

  const submit = useMutation({
    mutationFn: (choice: number) => api.answerQuiz(start.data!.attempt_id, index, choice),
    onSuccess: (res) => {
      setAnswer(res);
      if (res.is_correct) { setCorrect((c) => c + 1); haptic.success(); } else haptic.error();
    },
  });
  const finish = useMutation({
    mutationFn: () => api.finishQuiz(start.data!.attempt_id),
    onSuccess: (s) => { setSummary(s); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['topics'] }); },
  });
  const save = useMutation({
    mutationFn: (entryId: string) => api.saveWord(entryId, 'quiz'),
    onSuccess: (_, entryId) => { setSavedEntries((s) => new Set(s).add(entryId)); qc.invalidateQueries({ queryKey: ['saved-words'] }); },
  });

  const title = params.title || 'Quiz';
  if (start.isPending) return <LoadingView label="Choosing questions for your level…" />;
  if (start.error) {
    const e = toAppError(start.error);
    return (
      <Screen title={title} back>
        {e.kind === 'not_found'
          ? <EmptyState icon="file-tray-outline" title="No questions yet" message={e.message} />
          : <ErrorView error={e} onRetry={() => start.refetch()} />}
      </Screen>
    );
  }
  if (summary) return <Summary title={title} s={summary} />;

  const quiz = start.data!;
  const q = quiz.questions[index];
  const last = index + 1 === quiz.total;

  const choose = (i: number) => {
    if (answer || submit.isPending) return;
    setSelected(i);
    submit.mutate(i);
  };
  const next = () => {
    if (last) { finish.mutate(); return; }
    setIndex((i) => i + 1);
    setSelected(null);
    setAnswer(null);
  };

  return (
    <Screen
      title={title}
      back
      right={<Button title="End" variant="ghost" size="sm" loading={finish.isPending} onPress={() => finish.mutate()} />}
      footer={answer ? <Button testID="quiz-next" title={last ? 'See results' : 'Next question'} size="lg" loading={finish.isPending} onPress={next} /> : undefined}>
      <View style={{ gap: 6 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="smallStrong" color="textMuted">Question {index + 1} of {quiz.total}</Text>
          <Badge label={`${correct} correct`} tone="success" icon="checkmark" />
        </Row>
        <ProgressBar value={(index + (answer ? 1 : 0)) / quiz.total} />
      </View>
      {submit.error ? <Banner tone="danger" message={errorMessage(submit.error)} /> : null}
      {finish.error ? <Banner tone="danger" message={errorMessage(finish.error)} /> : null}
      <QuestionCard
        key={q.id}
        question={q}
        states={optionStates(q.options.length, { selected, correct: answer?.correct_index ?? null, reveal: !!answer })}
        onSelect={choose}
        disabled={!!answer || submit.isPending}
      />
      {answer ? (
        <Card tone={answer.is_correct ? 'success' : 'danger'} testID="quiz-feedback">
          <Row>
            <Icon name={answer.is_correct ? 'checkmark-circle' : 'close-circle'} color={answer.is_correct ? 'success' : 'danger'} />
            <Text variant="bodyStrong">{answer.is_correct ? 'Correct!' : `Answer: ${q.options[answer.correct_index]}`}</Text>
          </Row>
          {answer.explanation ? <Text variant="small">{answer.explanation}</Text> : null}
          {answer.entry ? (
            <Row style={{ justifyContent: 'space-between', marginTop: Spacing.xs }}>
              <Button title="View word" variant="ghost" size="sm" style={{ paddingHorizontal: 0 }} onPress={() => router.push(`/word/${answer.entry!.id}`)} />
              <Button
                title={answer.entry.saved || savedEntries.has(answer.entry.id) ? 'Saved' : 'Save word'}
                icon={answer.entry.saved || savedEntries.has(answer.entry.id) ? 'bookmark' : 'bookmark-outline'}
                size="sm" variant="secondary"
                disabled={answer.entry.saved || savedEntries.has(answer.entry.id)}
                loading={save.isPending}
                onPress={() => save.mutate(answer.entry!.id)}
              />
            </Row>
          ) : null}
          {save.error ? <Text variant="small" color="danger">{errorMessage(save.error)}</Text> : null}
        </Card>
      ) : null}
    </Screen>
  );
}

function Summary({ title, s }: { title: string; s: QuizSummary }) {
  if (s.status === 'abandoned') {
    return (
      <Screen title={title} back>
        <EmptyState icon="exit-outline" title="Quiz ended" message="No questions were answered, so nothing was recorded." action={<Button title="Back" onPress={() => router.back()} />} />
      </Screen>
    );
  }
  const pct = s.total ? s.correct / s.total : 0;
  return (
    <Screen title="Quiz results" footer={
      <>
        <Button testID="quiz-done" title="Done" size="lg" onPress={() => router.back()} />
        <Button title="Review mistakes later" variant="ghost" onPress={() => router.replace('/saved-words')} />
      </>
    }>
      <Card style={{ alignItems: 'center', paddingVertical: Spacing.xl }}>
        <ProgressRing value={pct} size={120} stroke={12} tone={pct >= 0.7 ? 'success' : 'warning'}>
          <Text variant="h1" testID="quiz-score">{s.correct}/{s.total}</Text>
        </ProgressRing>
        <Text variant="h2">{pct === 1 ? 'Perfect score!' : pct >= 0.7 ? 'Great work!' : pct >= 0.4 ? 'Good effort' : 'Keep practising'}</Text>
        <Row gap={Spacing.lg}>
          <View style={{ alignItems: 'center' }}><AnimatedNumber value={s.xp} prefix="+" color="primary" /><Text variant="tiny" color="textMuted">XP EARNED</Text></View>
          <View style={{ alignItems: 'center' }}><Text variant="h2" color="warning">{s.streak}🔥</Text><Text variant="tiny" color="textMuted">DAY STREAK</Text></View>
        </Row>
      </Card>
      {s.new_achievements.length ? <Banner tone="success" icon="trophy" title="Achievement unlocked!" message={s.new_achievements.map((a) => a.replace(/_/g, ' ')).join(', ')} /> : null}
      {s.missed.length ? (
        <>
          <SectionHeader title="Learn from your mistakes" />
          {s.missed.map((m, i) => (
            <Card key={i}>
              <Text variant="smallStrong">{m.prompt}</Text>
              {m.sentence ? <Text variant="small" color="textMuted">{m.sentence}</Text> : null}
              <Text variant="small" color="danger">Your answer: {m.your_answer ?? '—'}</Text>
              <Text variant="small" color="success">Correct: {m.correct_answer}</Text>
              {m.explanation ? <Text variant="small" color="textMuted">{m.explanation}</Text> : null}
              {m.entry_id ? <Button title="Open word" variant="ghost" size="sm" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} onPress={() => router.push(`/word/${m.entry_id}`)} /> : null}
            </Card>
          ))}
        </>
      ) : null}
      <Text variant="small" color="textFaint">XP is lower for questions you answered correctly in the last 7 days, so learning new words always pays most.</Text>
    </Screen>
  );
}
