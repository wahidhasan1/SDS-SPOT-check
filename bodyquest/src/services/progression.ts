import { EXERCISE_MAP } from '../data/exercises';
import type { ExerciseProgression, ProgressionSuggestion, UserProfile, WorkoutSession } from '../domain/types';
import { easierAlternative, harderAlternative } from './substitution';

/**
 * Progressive overload — performance-based and opt-in.
 *
 * After each completed session we look at the last two performances of every main
 * exercise. Difficulty is only ever *suggested*; it changes when the user accepts.
 *   • Hit the top of the rep range (or target time) on every set, with ratings ≤ 3
 *     ("moderate" or easier), twice in a row, with no pain → suggest +2 reps
 *     (or +5 s), then a harder variation once the range is maxed.
 *   • Rated 5 ("too hard"), or completed under 60% of prescribed work → suggest an
 *     easier variation (or hold).
 *   • Skipped for pain, or pain reported → suggest an easier variation; never progress.
 */

export interface Performance {
  date: string;
  exerciseId: string;
  baseExerciseId: string;
  setsPrescribed: number;
  setsDone: number;
  hitTop: boolean;
  avgRating: number | null;
  belowMin: boolean;
  pain: boolean;
}

export function extractPerformances(s: WorkoutSession): Performance[] {
  if (s.status !== 'completed' && s.status !== 'ended-early') return [];
  const painSession = Boolean(s.symptomReport?.symptoms.some((x) => x === 'sharp-pain' || x === 'joint-pain'));
  const out: Performance[] = [];
  for (const we of s.workout.exercises) {
    if (we.block !== 'main') continue;
    const p = s.progress[we.id];
    const ratings = p.sets.map((x) => x.rating).filter((r): r is NonNullable<typeof r> => r !== undefined);
    const top = we.reps ? we.reps[1] : we.seconds ?? 0;
    const min = we.reps ? we.reps[0] : (we.seconds ?? 0) * 0.6;
    const values = p.sets.map((x) => (we.reps ? x.repsDone ?? 0 : x.secondsDone ?? 0));
    out.push({
      date: s.performedDate ?? s.plannedDate,
      exerciseId: p.performedExerciseId,
      baseExerciseId: we.baseExerciseId,
      setsPrescribed: we.sets,
      setsDone: p.sets.length,
      hitTop: p.sets.length >= we.sets && values.every((v) => v >= top),
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      belowMin: p.sets.length < we.sets * 0.6 || values.some((v) => v < min * 0.75),
      pain: p.skipped?.reason === 'pain' || painSession,
    });
  }
  return out;
}

export function suggestFor(
  history: Performance[],
  current: ExerciseProgression | undefined,
  baseExerciseId: string,
  profile: Pick<UserProfile, 'age' | 'experience' | 'readiness' | 'limitations'>,
): ProgressionSuggestion | null {
  const variationId = current?.variationId ?? baseExerciseId;
  const relevant = history.filter((h) => h.exerciseId === variationId).sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = relevant[0];
  if (!last) return null;
  const ex = EXERCISE_MAP[variationId];
  if (!ex) return null;

  if (last.pain) {
    const easier = easierAlternative(variationId, profile);
    return easier
      ? { kind: 'easier-variation', targetExerciseId: easier.id, reason: `Pain was reported during ${ex.name}. Switch to ${easier.name} and keep every rep pain-free.` }
      : { kind: 'hold', reason: `Pain was reported during ${ex.name}. Keep the range small and pain-free, or skip it until it settles.` };
  }
  if ((last.avgRating !== null && last.avgRating >= 4.5) || last.belowMin) {
    const easier = easierAlternative(variationId, profile);
    return easier
      ? { kind: 'easier-variation', targetExerciseId: easier.id, reason: `${ex.name} felt too hard last time. ${easier.name} will let you build quality reps first.` }
      : { kind: 'hold', reason: `${ex.name} felt very hard. Stay at the lower end of the range until it feels manageable.` };
  }
  const lastTwo = relevant.slice(0, 2);
  const ready = lastTwo.length === 2 && lastTwo.every((h) => h.hitTop && (h.avgRating === null || h.avgRating <= 3) && !h.pain);
  if (!ready) return null;
  const dose = ex.dosing[profile.experience];
  const range = dose.reps ? dose.reps[1] - dose.reps[0] : 30;
  const bonus = current?.repBonus ?? 0;
  if (bonus + 2 <= range) {
    return {
      kind: 'add-reps',
      reason: dose.reps
        ? `You hit the top of the range on every set of ${ex.name} twice in a row. Add 2 reps to your target.`
        : `You held every set of ${ex.name} for the full time twice in a row. Add 5 seconds.`,
    };
  }
  const harder = harderAlternative(variationId, profile);
  if (harder) {
    return { kind: 'harder-variation', targetExerciseId: harder.id, reason: `You’ve mastered ${ex.name}. Ready to try ${harder.name}?` };
  }
  return { kind: 'hold', reason: `You’ve maxed out ${ex.name} for your current level. Slow the tempo (3 s down) to keep challenging yourself.` };
}

export function applySuggestion(p: ExerciseProgression, s: ProgressionSuggestion, nowIso: string): ExerciseProgression {
  const ex = EXERCISE_MAP[p.variationId];
  switch (s.kind) {
    case 'add-reps':
      return { ...p, repBonus: p.repBonus + (ex?.measure === 'time' ? 5 : 2), suggestion: undefined, updatedAt: nowIso };
    case 'harder-variation':
    case 'easier-variation':
      return { ...p, variationId: s.targetExerciseId ?? p.variationId, repBonus: 0, suggestion: undefined, updatedAt: nowIso };
    default:
      return { ...p, suggestion: undefined, updatedAt: nowIso };
  }
}

/** Recompute suggestions after a session; returns updated progression map. */
export function updateProgressions(
  map: Record<string, ExerciseProgression>,
  sessions: WorkoutSession[],
  profile: Pick<UserProfile, 'age' | 'experience' | 'readiness' | 'limitations'>,
  nowIso: string,
): Record<string, ExerciseProgression> {
  const history = sessions.flatMap(extractPerformances);
  const bases = new Set(history.map((h) => h.baseExerciseId));
  const next = { ...map };
  for (const base of bases) {
    const cur = next[base] ?? { exerciseId: base, variationId: base, repBonus: 0, updatedAt: nowIso };
    const sug = suggestFor(history, cur, base, profile);
    next[base] = { ...cur, suggestion: sug ?? undefined };
  }
  return next;
}
