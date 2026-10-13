import type { IeltsVariant } from './ielts';

/** Normalise a typed answer for comparison: case, whitespace, surrounding punctuation. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s.,;:!?"'()]+|[\s.,;:!?"'()]+$/g, '');
}

export function isAnswerCorrect(given: string | undefined | null, accepted: string[]): boolean {
  if (given == null) return false;
  const g = normalizeAnswer(given);
  if (!g) return false;
  return accepted.some((a) => normalizeAnswer(a) === g);
}

type BandRow = [minRaw: number, band: number];

// Widely published approximate conversion tables for a 40-question paper.
const LISTENING: BandRow[] = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0]];
const READING_ACADEMIC: BandRow[] = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1], [0, 0]];
const READING_GENERAL: BandRow[] = [[40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [3, 2], [1, 1], [0, 0]];

/**
 * Approximate band for a practice section. Practice sets usually have fewer than 40 questions,
 * so the raw score is scaled to 40 first. The result is an estimate only.
 */
export function estimateBand(module: 'listening' | 'reading', variant: IeltsVariant, correct: number, total: number): number {
  if (total <= 0) return 0;
  const scaled = Math.round((correct / total) * 40);
  const table = module === 'listening' ? LISTENING : variant === 'general' ? READING_GENERAL : READING_ACADEMIC;
  for (const [min, band] of table) if (scaled >= min) return band;
  return 0;
}

/** IELTS-style rounding of an average to the nearest half band (.25 rounds up to .5, .75 rounds up to next whole). */
export function roundBand(avg: number): number {
  const whole = Math.floor(avg);
  const frac = avg - whole;
  if (frac < 0.25) return whole;
  if (frac < 0.75) return whole + 0.5;
  return whole + 1;
}

export function countWords(text: string): number {
  const m = text.trim().match(/[A-Za-z0-9À-ɏ]+(?:['’\-][A-Za-z0-9À-ɏ]+)*/g);
  return m ? m.length : 0;
}

/** SM-2 style spaced repetition update. quality: 0 (forgot) .. 5 (perfect). */
export function sm2(prev: { ease: number; intervalDays: number; repetitions: number }, quality: number) {
  let { ease, intervalDays, repetitions } = prev;
  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 3;
    else intervalDays = Math.round(intervalDays * ease);
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  return { ease: Math.round(ease * 100) / 100, intervalDays, repetitions };
}

/** Word learning status derived from review history (implemented criteria, shown to users). */
export function wordStatus(repetitions: number, intervalDays: number): 'learning' | 'reviewing' | 'mastered' {
  if (repetitions >= 4 && intervalDays >= 21) return 'mastered';
  if (repetitions >= 2) return 'reviewing';
  return 'learning';
}

export const WORD_STATUS_RULES =
  'Learning: new or recently forgotten. Reviewing: recalled correctly at least twice in a row. Mastered: recalled correctly 4+ times in a row with a review interval of 21+ days.';
