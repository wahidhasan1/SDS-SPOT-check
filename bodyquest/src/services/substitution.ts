import { EXERCISES, EXERCISE_MAP } from '../data/exercises';
import type { Exercise, UserProfile } from '../domain/types';
import { isAllowed } from './safety';

export interface Alternative {
  exercise: Exercise;
  relation: 'easier' | 'harder' | 'similar';
}

type Prof = Pick<UserProfile, 'age' | 'experience' | 'readiness' | 'limitations'>;

/**
 * Approved alternatives for an exercise: its listed easier/harder variations plus
 * same-category movements of similar difficulty — all filtered through the safety rules.
 * Only these may replace an exercise during a workout.
 */
export function getAlternatives(exerciseId: string, profile: Prof, opts: { includeHarder?: boolean } = {}): Alternative[] {
  const ex = EXERCISE_MAP[exerciseId];
  if (!ex) return [];
  const out: Alternative[] = [];
  const seen = new Set<string>([ex.id]);
  const push = (e: Exercise | undefined, relation: Alternative['relation']) => {
    if (!e || seen.has(e.id) || !isAllowed(e, profile)) return;
    seen.add(e.id);
    out.push({ exercise: e, relation });
  };
  ex.easier.forEach((id) => push(EXERCISE_MAP[id], 'easier'));
  if (opts.includeHarder !== false) ex.harder.forEach((id) => push(EXERCISE_MAP[id], 'harder'));
  EXERCISES.filter((e) => e.category === ex.category && Math.abs(e.difficulty - ex.difficulty) <= 1)
    .sort((a, b) => a.difficulty - b.difficulty)
    .forEach((e) => push(e, e.difficulty < ex.difficulty ? 'easier' : e.difficulty > ex.difficulty ? 'harder' : 'similar'));
  return out;
}

export function isApprovedAlternative(fromId: string, toId: string, profile: Prof): boolean {
  return getAlternatives(fromId, profile).some((a) => a.exercise.id === toId);
}

/** First allowed easier alternative (used after pain reports / too-hard ratings). */
export function easierAlternative(exerciseId: string, profile: Prof): Exercise | null {
  return getAlternatives(exerciseId, profile).find((a) => a.relation === 'easier')?.exercise ?? null;
}

export function harderAlternative(exerciseId: string, profile: Prof): Exercise | null {
  const ex = EXERCISE_MAP[exerciseId];
  if (!ex) return null;
  for (const id of ex.harder) {
    const h = EXERCISE_MAP[id];
    if (h && isAllowed(h, profile)) return h;
  }
  return null;
}
