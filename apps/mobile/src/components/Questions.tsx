import { Text, TextInput, View } from 'react-native';
import { CHOICE_TYPES, QUESTION_TYPE_LABELS, type QuestionType } from '@fluentpath/shared';
import { useTheme } from '../lib/theme';
import { Card, Chip, Notice, P, Row } from './ui';

export interface G { id: string; type: QuestionType; instructions: string; title?: string; options?: { key: string; text: string }[]; gapText?: string; questions: { n: number; prompt: string; options?: { key: string; text: string }[] }[] }
export interface R { n: number; correct: boolean; given: string | null; correctAnswer: string; explanation: string }

/** IELTS question renderer for mobile, covering every question type used by the API. */
export function Questions({ groups, answers, onChange, results }: { groups: G[]; answers: Record<string, string>; onChange?: (n: number, v: string) => void; results?: Record<number, R> | null }) {
  const t = useTheme();
  return (
    <View style={{ gap: 14 }}>
      {groups.map((g) => {
        const choiceList = CHOICE_TYPES.includes(g.type) || (g.type === 'summary_completion' && g.options?.length);
        return (
          <Card key={g.id}>
            <Text style={{ color: t.text, fontWeight: '700' }}>Questions {g.questions[0].n}–{g.questions[g.questions.length - 1].n} · {QUESTION_TYPE_LABELS[g.type]}</Text>
            <P muted>{g.instructions}</P>
            {g.gapText && <View style={{ backgroundColor: t.bg, padding: 10, borderRadius: 10 }}><Text style={{ color: t.text, lineHeight: 22 }}>{g.title ? `${g.title}\n` : ''}{g.gapText.replace(/\{\{(\d+)\}\}/g, ' [$1] ')}</Text></View>}
            {g.options && ['matching_headings', 'matching_information', 'matching_features', 'summary_completion'].includes(g.type) && (
              <View>{g.options.map((o) => <P key={o.key} muted>{o.key}. {o.text}</P>)}</View>
            )}
            {g.questions.map((q) => {
              const r = results?.[q.n];
              const value = answers[String(q.n)] ?? '';
              const opts = q.options ?? g.options;
              return (
                <View key={q.n} style={{ gap: 6, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 8 }}>
                  <Text style={{ color: t.text }}><Text style={{ fontWeight: '800' }}>{q.n}. </Text>{g.gapText ? `Gap ${q.n}` : q.prompt}</Text>
                  {choiceList && opts ? (
                    <Row>{opts.map((o) => <Chip key={o.key} label={g.type === 'mcq' || g.type === 'tfng' || g.type === 'ynng' ? (o.key === o.text ? o.text : `${o.key}. ${o.text}`) : o.key} selected={value === o.key} onPress={() => onChange?.(q.n, o.key)} />)}</Row>
                  ) : (
                    <TextInput accessibilityLabel={`Question ${q.n}`} editable={Boolean(onChange)} value={value} onChangeText={(v) => onChange?.(q.n, v)} autoCapitalize="none" autoCorrect={false} placeholder="Your answer" placeholderTextColor={t.muted} style={{ borderWidth: 1, borderColor: r ? (r.correct ? t.success : t.danger) : t.border, borderRadius: 10, padding: 10, color: t.text }} />
                  )}
                  {r && <Notice tone={r.correct ? 'success' : 'error'} text={`${r.correct ? 'Correct.' : `Your answer: ${r.given ?? '(blank)'} · Correct: ${r.correctAnswer}.`} ${r.explanation}`} />}
                </View>
              );
            })}
          </Card>
        );
      })}
    </View>
  );
}
