export type Q = { n: number; text: string; options?: string[]; paragraph?: string }
export type Group =
  | { type: 'tfng' | 'ynng'; instructions: string; questions: Q[] }
  | { type: 'mcq'; instructions: string; questions: (Q & { options: string[] })[] }
  | { type: 'mcq_multi'; instructions: string; numbers: number[]; text: string; options: string[] }
  | { type: 'headings'; instructions: string; headings: string[]; questions: (Q & { paragraph: string })[] }
  | { type: 'match_info'; instructions: string; letters: string[]; questions: Q[] }
  | { type: 'match_features'; instructions: string; features: string[]; questions: Q[] }
  | { type: 'endings'; instructions: string; endings: string[]; questions: Q[] }
  | { type: 'map'; instructions: string; image: string; imageAlt: string; letters: string[]; questions: Q[] }
  | { type: 'gaps'; format: string; title?: string; instructions: string; wordLimit?: number; allowNumber?: boolean; bank?: string[]; lines?: string[]; table?: { columns: string[]; rows: string[][] }; steps?: string[]; numbers: number[] }

export type Section = { id?: string; title: string; intro?: string; context?: string; paragraphs?: { label: string; text: string }[]; groups: Group[]; script?: { s: string; text: string }[] }
export type PublicTest = { id: string; title: string; testType?: string; minutes?: number; passages?: Section[]; parts?: Section[] }

export type ResultItem = { n: number; given: string; correct: boolean; answer: string; why: string; kind: string }
export type Attempt = {
  id: string
  contentId: string
  kind: 'reading' | 'listening'
  testType: string | null
  mode: 'practice' | 'exam'
  status: 'in_progress' | 'submitted'
  scope: number | null
  answers: Record<string, string>
  flagged: number[]
  played: number[]
  startedAt: number
  serverNow: number
  timeLimitS: number
  timeSpentS: number
  mockAttemptId: string | null
  test: PublicTest
  questionNumbers: number[]
  result: { score: number; max: number; band: number | null; late: boolean; items: ResultItem[]; byType: Record<string, { correct: number; total: number }>; submittedAt: number } | null
}

export const LETTERS = 'ABCDEFGHIJKLMNOP'.split('')
export const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii']
export const sectionsOf = (t: PublicTest) => t.passages ?? t.parts ?? []

export const TYPE_LABEL: Record<string, string> = {
  tfng: 'True / False / Not Given', ynng: 'Yes / No / Not Given', mcq: 'Multiple choice', multi: 'Choose two', heading: 'Matching headings',
  match_info: 'Matching information', match_features: 'Matching features', endings: 'Sentence endings', gap: 'Completion', bank: 'Summary (word list)', map: 'Map labelling',
}

export const wordLimitText = (n?: number, num?: boolean) => (n ? `${['', 'ONE WORD', 'NO MORE THAN TWO WORDS', 'NO MORE THAN THREE WORDS'][n] ?? `NO MORE THAN ${n} WORDS`}${num ? ' AND/OR A NUMBER' : ''}` : '')
