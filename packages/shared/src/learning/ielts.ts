/**
 * Raw-score to band conversion for IELTS-style practice.
 * These tables follow widely published approximate conversion charts for 40-question
 * Listening/Reading tests. They are NOT official; real conversion varies per test form.
 * For practice sets with fewer than 40 questions we scale the raw score to /40 and
 * flag the result as an estimate.
 */
type Row = [minRaw: number, band: number];

const LISTENING: Row[] = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5],
  [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0],
];
const ACADEMIC_READING: Row[] = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5],
  [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0],
];
const GENERAL_READING: Row[] = [
  [40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5],
  [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [3, 2], [1, 1], [0, 0],
];

export type ObjectiveSkill = 'listening' | 'reading_academic' | 'reading_general';

export interface BandEstimate {
  band: number;
  scaledRaw: number;
  raw: number;
  total: number;
  scaled: boolean;
}

export function rawToBand(skill: ObjectiveSkill, raw: number, total: number): BandEstimate {
  if (total <= 0) return { band: 0, scaledRaw: 0, raw: 0, total: 0, scaled: false };
  const clamped = Math.max(0, Math.min(raw, total));
  const scaled = total !== 40;
  const scaledRaw = scaled ? Math.round((clamped / total) * 40) : clamped;
  const table = skill === 'listening' ? LISTENING : skill === 'reading_academic' ? ACADEMIC_READING : GENERAL_READING;
  const row = table.find(([min]) => scaledRaw >= min) ?? [0, 0];
  return { band: row[1], scaledRaw, raw: clamped, total, scaled };
}

/** IELTS overall band rounding: averages ending .25 round up to .5, .75 round up to next whole. */
export function overallBand(bands: number[]): number | null {
  if (bands.length === 0) return null;
  const avg = bands.reduce((a, b) => a + b, 0) / bands.length;
  const whole = Math.floor(avg);
  const frac = avg - whole;
  if (frac < 0.25) return whole;
  if (frac < 0.75) return whole + 0.5;
  return whole + 1;
}

export function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

/** Normalise free-text answers for objective scoring (case, whitespace, punctuation, articles optional). */
export function normaliseAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.,;:!?"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Accepts answers listed in `accepted`. Each accepted entry may contain alternatives
 * separated by "|" and optional words in square brackets, e.g. "[the] library|libraries".
 */
export function isAnswerCorrect(given: string, accepted: string[]): boolean {
  const g = normaliseAnswer(given);
  if (!g) return false;
  for (const entry of accepted) {
    for (const alt of entry.split('|')) {
      const required = normaliseAnswer(alt.replace(/\[[^\]]*\]/g, ' '));
      const full = normaliseAnswer(alt.replace(/[[\]]/g, ''));
      if (g === required || g === full) return true;
    }
  }
  return false;
}

export function wordLimitOk(answer: string, maxWords: number | null | undefined): boolean {
  if (!maxWords) return true;
  const words = normaliseAnswer(answer).split(' ').filter(Boolean);
  // Numbers count as words in IELTS; we count tokens.
  return words.length <= maxWords;
}
