import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import type { Question } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const TYPE_LABEL: Record<string, string> = {
  meaning: 'Word meaning', synonym: 'Synonym', antonym: 'Antonym', fill_blank: 'Complete the sentence',
  context: 'Meaning in context', grammar: 'Grammar', ielts: 'IELTS practice',
};

/** Renders a sentence, highlighting the ____ blank. */
export function Sentence({ text }: { text: string }) {
  const parts = text.split('____');
  return (
    <Text variant="h3" style={{ fontWeight: '500' }}>
      {parts.map((p, i) => (
        <Text key={i} variant="h3" style={{ fontWeight: '500' }}>
          {p}
          {i < parts.length - 1 ? <Text variant="h3" color="primary">{' ______ '}</Text> : null}
        </Text>
      ))}
    </Text>
  );
}

export function QuestionCard({
  question, states, onSelect, disabled, showType = true,
}: {
  question: Pick<Question, 'prompt' | 'sentence' | 'options' | 'type'>;
  states?: OptionState[];
  onSelect: (index: number) => void;
  disabled?: boolean;
  showType?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: Spacing.lg }}>
      <View style={{ gap: Spacing.sm }}>
        {showType ? <Text variant="tiny" color="primary">{(TYPE_LABEL[question.type] ?? 'Question').toUpperCase()}</Text> : null}
        <Text variant="h2" accessibilityRole="header">{question.prompt}</Text>
        {question.sentence ? (
          <View style={[styles.sentence, { backgroundColor: colors.surfaceAlt, borderLeftColor: colors.primary }]}>
            <Sentence text={question.sentence} />
          </View>
        ) : null}
      </View>
      <View style={{ gap: Spacing.sm }} accessibilityRole="radiogroup">
        {question.options.map((opt, i) => {
          const state = states?.[i] ?? 'idle';
          const tone = {
            idle: { bg: colors.surface, border: colors.border, fg: 'text' as const },
            selected: { bg: colors.primarySoft, border: colors.primary, fg: 'primary' as const },
            correct: { bg: colors.successSoft, border: colors.success, fg: 'success' as const },
            wrong: { bg: colors.dangerSoft, border: colors.danger, fg: 'danger' as const },
            dimmed: { bg: colors.surface, border: colors.border, fg: 'textFaint' as const },
          }[state];
          return (
            <Pressable
              key={`${i}-${opt}`}
              testID={`option-${i}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: state === 'selected', disabled: !!disabled }}
              accessibilityLabel={`Option ${LETTERS[i]}: ${opt}${state === 'correct' ? ', correct answer' : state === 'wrong' ? ', incorrect' : ''}`}
              disabled={disabled}
              onPress={() => { haptic.tap(); onSelect(i); }}
              style={({ pressed }) => [styles.option, { backgroundColor: tone.bg, borderColor: tone.border },
                pressed && !disabled && { transform: [{ scale: 0.99 }], backgroundColor: colors.surfacePressed }]}>
              <View style={[styles.letter, { borderColor: tone.border }]}>
                <Text variant="smallStrong" color={tone.fg}>{LETTERS[i]}</Text>
              </View>
              <Text variant="body" color={tone.fg} style={{ flex: 1, fontWeight: state === 'idle' ? '500' : '700' }}>{opt}</Text>
              {state === 'correct' ? <Icon name="checkmark-circle" color="success" size={22} /> : null}
              {state === 'wrong' ? <Icon name="close-circle" color="danger" size={22} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function optionStates(count: number, opts: { selected?: number | null; correct?: number | null; reveal: boolean }): OptionState[] {
  return Array.from({ length: count }, (_, i) => {
    if (!opts.reveal) return opts.selected === i ? 'selected' : 'idle';
    if (i === opts.correct) return 'correct';
    if (i === opts.selected) return 'wrong';
    return 'dimmed';
  });
}

const styles = StyleSheet.create({
  sentence: { padding: Spacing.lg, borderRadius: Radius.md, borderLeftWidth: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, minHeight: 56 },
  letter: { width: 30, height: 30, borderRadius: Radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
