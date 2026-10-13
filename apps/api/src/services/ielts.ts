import {
  CHOICE_TYPES,
  estimateBand,
  isAnswerCorrect,
  normalizeAnswer,
  type IeltsGroup,
  type IeltsVariant,
  type ListeningContent,
  type ReadingContent,
} from '@fluentpath/shared';

type Content = ReadingContent | ListeningContent;

/** Content safe to send before submission: no answers, explanations or transcripts. */
export function publicContent(module: string, content: Content) {
  const groups = content.groups.map((g) => ({
    ...g,
    questions: g.questions.map(({ answer: _a, explanation: _e, ...q }) => q),
  }));
  if (module === 'listening') {
    const c = content as ListeningContent;
    return { sections: c.sections.map(({ transcript: _t, ...s }) => s), groups };
  }
  return { passages: (content as ReadingContent).passages, groups };
}

export interface QuestionResult {
  n: number;
  type: string;
  given: string | null;
  correct: boolean;
  correctAnswer: string;
  explanation: string;
}

function displayAnswer(g: IeltsGroup, key: string, qOptions?: { key: string; text: string }[]) {
  const opts = qOptions ?? g.options;
  const o = opts?.find((x) => x.key === key);
  if (!o || o.key === o.text) return key;
  return `${key} — ${o.text}`;
}

export function scoreContent(content: Content, answers: Record<string, string>) {
  const results: QuestionResult[] = [];
  for (const g of content.groups) {
    for (const q of g.questions) {
      const given = answers[String(q.n)]?.trim() || null;
      const isChoice = CHOICE_TYPES.includes(g.type) || (g.type === 'summary_completion' && Boolean(g.options?.length));
      const correct = isChoice
        ? given != null && q.answer.some((a) => normalizeAnswer(a) === normalizeAnswer(given))
        : isAnswerCorrect(given, q.answer);
      results.push({
        n: q.n,
        type: g.type,
        given,
        correct,
        correctAnswer: isChoice ? displayAnswer(g, q.answer[0], q.options) : q.answer.join(' / '),
        explanation: q.explanation,
      });
    }
  }
  results.sort((a, b) => a.n - b.n);
  const score = results.filter((r) => r.correct).length;
  return { results, score, maxScore: results.length };
}

export function bandFor(module: 'reading' | 'listening', variant: string, score: number, max: number) {
  return estimateBand(module, (variant === 'general' ? 'general' : 'academic') as IeltsVariant, score, max);
}

/** Accuracy by question type, for analytics. */
export function accuracyByType(results: QuestionResult[]) {
  const out: Record<string, { correct: number; total: number }> = {};
  for (const r of results) {
    out[r.type] ??= { correct: 0, total: 0 };
    out[r.type].total++;
    if (r.correct) out[r.type].correct++;
  }
  return out;
}
