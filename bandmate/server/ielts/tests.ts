// IELTS-style objective tests (Reading and Listening): content model, public views and scoring.

export type Gaps = {
  type: 'gaps'
  format: 'notes' | 'summary' | 'sentence' | 'short' | 'form' | 'table' | 'flowchart'
  title?: string
  instructions: string
  wordLimit?: number
  allowNumber?: boolean
  bank?: string[]
  lines?: string[]
  table?: { columns: string[]; rows: string[][] }
  steps?: string[]
  answers: Record<string, string[]>
  why: Record<string, string>
}
type Q = { n: number; text: string; answer: string; why: string }
export type Group =
  | { type: 'tfng' | 'ynng'; instructions: string; questions: Q[] }
  | { type: 'mcq'; instructions: string; questions: (Q & { options: string[] })[] }
  | { type: 'mcq_multi'; instructions: string; numbers: number[]; text: string; options: string[]; answer: string[]; why: string }
  | { type: 'headings'; instructions: string; headings: string[]; questions: (Q & { paragraph: string })[] }
  | { type: 'match_info'; instructions: string; letters: string[]; questions: Q[] }
  | { type: 'match_features'; instructions: string; features: string[]; questions: Q[] }
  | { type: 'endings'; instructions: string; endings: string[]; questions: Q[] }
  | { type: 'map'; instructions: string; image: string; imageAlt: string; letters: string[]; questions: Q[] }
  | Gaps

export type Section = { id?: string; title: string; intro?: string; context?: string; paragraphs?: { label: string; text: string }[]; groups: Group[]; speakers?: Record<string, string>; script?: { s: string; text: string }[] }
export type ObjectiveTest = { id: string; title: string; testType?: string; minutes?: number; passages?: Section[]; parts?: Section[] }

export const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii']
export const LETTERS = 'ABCDEFGHIJKLMNOP'.split('')

export const sections = (t: ObjectiveTest) => t.passages ?? t.parts ?? []

type Key = { n: number; kind: string; accepted: string[]; wordLimit?: number; allowNumber?: boolean; multi?: number[]; why: string; display: string }

/** Answer key for every question number. Never sent to the client before submission. */
export function answerKey(t: ObjectiveTest): Map<number, Key> {
  const key = new Map<number, Key>()
  for (const s of sections(t))
    for (const g of s.groups) {
      switch (g.type) {
        case 'gaps':
          for (const [n, acc] of Object.entries(g.answers)) {
            const display = g.bank ? `${acc[0]} (${g.bank[LETTERS.indexOf(acc[0])]})` : acc[0]
            key.set(Number(n), { n: Number(n), kind: g.bank ? 'bank' : 'gap', accepted: acc, wordLimit: g.bank ? undefined : g.wordLimit, allowNumber: g.allowNumber, why: g.why[n] ?? '', display })
          }
          break
        case 'mcq_multi':
          for (const n of g.numbers) key.set(n, { n, kind: 'multi', accepted: g.answer, multi: g.numbers, why: g.why, display: g.answer.join(' and ') })
          break
        case 'headings':
          for (const q of g.questions) key.set(q.n, { n: q.n, kind: 'heading', accepted: [q.answer], why: q.why, display: `${q.answer} (${g.headings[ROMAN.indexOf(q.answer)]})` })
          break
        default:
          for (const q of g.questions) key.set(q.n, { n: q.n, kind: g.type, accepted: [q.answer], why: q.why, display: q.answer })
      }
    }
  return key
}

/** Strips answers and explanations (and listening scripts) for the test-taking view. */
export function publicTest(t: ObjectiveTest, opts: { includeScript?: boolean } = {}) {
  const strip = (g: Group) => {
    switch (g.type) {
      case 'gaps': {
        const { answers: _a, why: _w, ...rest } = g
        void _a
        void _w
        return { ...rest, numbers: Object.keys(g.answers).map(Number) }
      }
      case 'mcq_multi': {
        const { answer: _a, why: _w, ...rest } = g
        void _a
        void _w
        return rest
      }
      default:
        return { ...g, questions: g.questions.map(({ answer: _a, why: _w, ...q }) => (void _a, void _w, q)) }
    }
  }
  const mapSection = (s: Section) => ({ ...s, script: opts.includeScript ? s.script : undefined, speakers: undefined, groups: s.groups.map(strip) })
  return { ...t, passages: t.passages?.map(mapSection), parts: t.parts?.map(mapSection) }
}

export const questionNumbers = (t: ObjectiveTest, sectionIndex?: number) => {
  const nums: number[] = []
  sections(t).forEach((s, i) => {
    if (sectionIndex !== undefined && i !== sectionIndex) return
    for (const g of s.groups) {
      if (g.type === 'gaps') nums.push(...Object.keys(g.answers).map(Number))
      else if (g.type === 'mcq_multi') nums.push(...g.numbers)
      else nums.push(...g.questions.map((q) => q.n))
    }
  })
  return nums.sort((a, b) => a - b)
}

export const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:!?]+$/g, '')
    .trim()

const countWords = (s: string, allowNumber?: boolean) => {
  const parts = normalise(s).split(' ').filter(Boolean)
  // "ONE WORD AND/OR A NUMBER": a number doesn't count against the word limit.
  return allowNumber ? parts.filter((p) => !/^[£$€]?\d[\d.,%]*$/.test(p)).length : parts.length
}

/** Marks one answer. Follows IELTS conventions: exact spelling, word limits enforced, case-insensitive. */
export function mark(k: Key, given: string | undefined, all: Record<string, string>): boolean {
  if (!given || !given.trim()) return false
  if (k.kind === 'multi') {
    // "Choose TWO": answers in either order; each correct letter scores once.
    const g = normalise(given).toUpperCase()
    if (!k.accepted.includes(g)) return false
    const first = k.multi!.find((n) => normalise(all[n] ?? '').toUpperCase() === g)
    return first === k.n
  }
  if (k.kind === 'gap') {
    if (k.wordLimit && countWords(given, k.allowNumber) > k.wordLimit) return false
    const g = normalise(given)
    return k.accepted.some((a) => normalise(a) === g || normalise(a).replace(/\s/g, '') === g.replace(/\s/g, ''))
  }
  if (k.kind === 'heading') return normalise(given) === k.accepted[0].toLowerCase()
  return normalise(given).toUpperCase() === k.accepted[0].toUpperCase()
}

// ------------------------------------------------------------------------------------------- bands
/**
 * Approximate raw-score → band conversion for full 40-question practice tests. Official conversion varies
 * slightly between test versions; these values follow the commonly published guidance and are used for
 * practice estimates only.
 */
const TABLES: Record<'listening' | 'academic' | 'general_training', [number, number][]> = {
  listening: [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 2]],
  academic: [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 2]],
  general_training: [[40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [0, 2]],
}

export function bandFor(kind: 'listening' | 'academic' | 'general_training', raw: number, max = 40) {
  if (max !== 40) return null // only full tests get a band estimate
  return TABLES[kind].find(([min]) => raw >= min)![1]
}

/** IELTS overall band rounding: average of four, rounded to the nearest half band (.25 rounds up to .5, .75 up to the next band). */
export function overallBand(bands: number[]) {
  const avg = bands.reduce((a, b) => a + b, 0) / bands.length
  const whole = Math.floor(avg)
  const frac = avg - whole
  return frac < 0.25 ? whole : frac < 0.75 ? whole + 0.5 : whole + 1
}

export function score(t: ObjectiveTest, answers: Record<string, string>, sectionIndex?: number) {
  const key = answerKey(t)
  const nums = questionNumbers(t, sectionIndex)
  const items = nums.map((n) => {
    const k = key.get(n)!
    const given = answers[n] ?? ''
    return { n, given, correct: mark(k, given, answers), answer: k.display, why: k.why, kind: k.kind }
  })
  const byType: Record<string, { correct: number; total: number }> = {}
  for (const it of items) {
    byType[it.kind] ??= { correct: 0, total: 0 }
    byType[it.kind].total++
    if (it.correct) byType[it.kind].correct++
  }
  return { raw: items.filter((i) => i.correct).length, max: items.length, items, byType }
}
