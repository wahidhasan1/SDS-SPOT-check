/**
 * SM-2 style spaced repetition. Pure function so it can be unit tested and run
 * on the server (authoritative) or the client (preview).
 * quality: 0 = forgot, 3 = hard, 4 = good, 5 = easy
 */
export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export const SRS_INITIAL: SrsState = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

export function nextSrsState(prev: SrsState, quality: number): SrsState {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { easeFactor, intervalDays, repetitions } = prev;
  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 3;
    else intervalDays = Math.round(intervalDays * easeFactor);
  }
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;
  return { easeFactor: Math.round(easeFactor * 100) / 100, intervalDays, repetitions };
}

export function dueDate(from: Date, intervalDays: number): Date {
  return new Date(from.getTime() + intervalDays * 86_400_000);
}
