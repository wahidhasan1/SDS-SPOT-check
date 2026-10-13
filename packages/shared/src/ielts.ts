import { z } from 'zod';

export const IELTS_VARIANTS = ['academic', 'general'] as const;
export type IeltsVariant = (typeof IELTS_VARIANTS)[number];

export const QUESTION_TYPES = [
  'mcq',
  'tfng',
  'ynng',
  'matching_headings',
  'matching_information',
  'matching_features',
  'sentence_completion',
  'summary_completion',
  'short_answer',
  'form_completion',
  'note_completion',
  'table_completion',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple choice',
  tfng: 'True / False / Not Given',
  ynng: 'Yes / No / Not Given',
  matching_headings: 'Matching headings',
  matching_information: 'Matching information',
  matching_features: 'Matching',
  sentence_completion: 'Sentence completion',
  summary_completion: 'Summary completion',
  short_answer: 'Short answer',
  form_completion: 'Form completion',
  note_completion: 'Note completion',
  table_completion: 'Table completion',
};

/** Question types where the learner picks from a list of keys rather than typing. */
export const CHOICE_TYPES: QuestionType[] = ['mcq', 'tfng', 'ynng', 'matching_headings', 'matching_information', 'matching_features'];

export const optionSchema = z.object({ key: z.string().min(1).max(10), text: z.string().min(1).max(500) });

export const questionSchema = z.object({
  n: z.number().int().positive(),
  prompt: z.string().min(1).max(1000),
  options: z.array(optionSchema).optional(),
  answer: z.array(z.string().min(1)).min(1, 'Every question needs at least one accepted answer'),
  explanation: z.string().min(1, 'Every question needs an explanation').max(2000),
});

export const groupSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(QUESTION_TYPES),
    instructions: z.string().min(1),
    passageId: z.string().optional(),
    sectionId: z.string().optional(),
    options: z.array(optionSchema).optional(),
    /** Optional text with gaps written as {{n}} where n is the question number. */
    gapText: z.string().optional(),
    title: z.string().optional(),
    questions: z.array(questionSchema).min(1),
  })
  .superRefine((g, ctx) => {
    for (const q of g.questions) {
      if (g.type === 'tfng' && !q.answer.every((a) => ['TRUE', 'FALSE', 'NOT GIVEN'].includes(a)))
        ctx.addIssue({ code: 'custom', message: `Q${q.n}: TFNG answers must be TRUE, FALSE or NOT GIVEN` });
      if (g.type === 'ynng' && !q.answer.every((a) => ['YES', 'NO', 'NOT GIVEN'].includes(a)))
        ctx.addIssue({ code: 'custom', message: `Q${q.n}: YNNG answers must be YES, NO or NOT GIVEN` });
      const keys = (q.options ?? g.options ?? []).map((o) => o.key);
      if (['mcq', 'matching_headings', 'matching_information', 'matching_features'].includes(g.type)) {
        if (keys.length < 2) ctx.addIssue({ code: 'custom', message: `Q${q.n}: choice questions need at least two options` });
        else if (!q.answer.every((a) => keys.includes(a)))
          ctx.addIssue({ code: 'custom', message: `Q${q.n}: answer must be one of the option keys (${keys.join(', ')})` });
      }
    }
  });

export const passageSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  paragraphs: z.array(z.object({ label: z.string().optional(), text: z.string().min(1) })).min(1),
});

export const readingContentSchema = z
  .object({ passages: z.array(passageSchema).min(1), groups: z.array(groupSchema).min(1) })
  .superRefine((c, ctx) => checkNumbering(c.groups, ctx));

export const listeningSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  audioUrl: z.string().min(1, 'Each listening section needs an audio file'),
  transcript: z.string().min(1, 'Each listening section needs a transcript'),
  context: z.string().optional(),
});

export const listeningContentSchema = z
  .object({ sections: z.array(listeningSectionSchema).min(1), groups: z.array(groupSchema).min(1) })
  .superRefine((c, ctx) => checkNumbering(c.groups, ctx));

function checkNumbering(groups: { questions: { n: number }[] }[], ctx: z.RefinementCtx) {
  const ns = groups.flatMap((g) => g.questions.map((q) => q.n));
  const seen = new Set<number>();
  for (const n of ns) {
    if (seen.has(n)) ctx.addIssue({ code: 'custom', message: `Question number ${n} is used more than once` });
    seen.add(n);
  }
}

export type IeltsOption = z.infer<typeof optionSchema>;
export type IeltsQuestion = z.infer<typeof questionSchema>;
export type IeltsGroup = z.infer<typeof groupSchema>;
export type ReadingContent = z.infer<typeof readingContentSchema>;
export type ListeningContent = z.infer<typeof listeningContentSchema>;

/** Questions as delivered to the learner before submission (answers removed). */
export type PublicQuestion = Omit<IeltsQuestion, 'answer' | 'explanation'>;
export type PublicGroup = Omit<IeltsGroup, 'questions'> & { questions: PublicQuestion[] };

export const chartSchema = z.object({
  kind: z.enum(['bar', 'line', 'pie', 'table', 'process', 'map']),
  title: z.string(),
  unit: z.string().optional(),
  categories: z.array(z.string()).optional(),
  series: z.array(z.object({ name: z.string(), values: z.array(z.number()) })).optional(),
  rows: z.array(z.array(z.string())).optional(),
  steps: z.array(z.string()).optional(),
  /** Simple map description: labelled features before/after */
  mapBefore: z.array(z.object({ label: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number() })).optional(),
  mapAfter: z.array(z.object({ label: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number() })).optional(),
});
export type ChartSpec = z.infer<typeof chartSchema>;

export const WRITING_TASK_TYPES = ['bar', 'line', 'pie', 'table', 'process', 'map', 'letter', 'essay'] as const;

export const WRITING_CRITERIA = [
  { id: 'task', label: 'Task achievement / response' },
  { id: 'coherence', label: 'Coherence and cohesion' },
  { id: 'lexical', label: 'Lexical resource' },
  { id: 'grammar', label: 'Grammatical range and accuracy' },
] as const;

export const SPEAKING_CRITERIA = [
  { id: 'fluency', label: 'Fluency and coherence' },
  { id: 'lexical', label: 'Lexical resource' },
  { id: 'grammar', label: 'Grammatical range and accuracy' },
] as const;

export const BAND_DISCLAIMER =
  'Band scores shown in FluentPath are unofficial, approximate estimates for practice only. They are not IELTS results.';
