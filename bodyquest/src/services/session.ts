import { EXERCISE_MAP } from '../data/exercises';
import type {
  ExerciseProgress,
  SkipReason,
  SymptomReport,
  Workout,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../domain/types';

/**
 * Workout session state machine and completion rules.
 *
 * COMPLETION RULES (shown to users on the workout screen):
 *  • A planned workout counts as completed only when at least 70% of the main-block
 *    sets are logged (sets skipped because of pain are excused from the total), and
 *  • the session has at least MIN_ACTIVE_MINUTES of active (non-paused) time.
 *  • Opening the page, or tapping Finish without logging work, never counts.
 */

export const COMPLETION_THRESHOLD = 0.7;
export const MIN_ACTIVE_MINUTES = { hard: 5, moderate: 4, light: 3 } as const;

export function createSession(workout: Workout, kind: WorkoutSession['kind'], plannedDate: string, id: string): WorkoutSession {
  const progress: Record<string, ExerciseProgress> = {};
  for (const we of workout.exercises) {
    progress[we.id] = { workoutExerciseId: we.id, performedExerciseId: we.exerciseId, sets: [], completed: false };
  }
  return {
    id,
    workoutId: workout.id,
    plannedDate,
    performedDate: null,
    kind,
    status: 'not-started',
    startedAt: null,
    finishedAt: null,
    activeMs: 0,
    segmentStartedAt: null,
    progress,
    workout,
    completionRatio: 0,
    xpAwarded: 0,
  };
}

export function activeMsAt(s: WorkoutSession, nowMs: number): number {
  if (s.segmentStartedAt) return s.activeMs + Math.max(0, nowMs - Date.parse(s.segmentStartedAt));
  return s.activeMs;
}

export function startSession(s: WorkoutSession, nowIso: string, today: string): WorkoutSession {
  if (s.status === 'completed') return s;
  if (s.segmentStartedAt) return s;
  return {
    ...s,
    status: 'in-progress',
    startedAt: s.startedAt ?? nowIso,
    performedDate: s.performedDate ?? today,
    segmentStartedAt: nowIso,
  };
}

export function pauseSession(s: WorkoutSession, nowIso: string): WorkoutSession {
  if (s.status !== 'in-progress' || !s.segmentStartedAt) return s;
  return { ...s, status: 'paused', activeMs: activeMsAt(s, Date.parse(nowIso)), segmentStartedAt: null };
}

export function resumeSession(s: WorkoutSession, nowIso: string): WorkoutSession {
  if (s.status !== 'paused' && s.status !== 'ended-early') return s;
  return { ...s, status: 'in-progress', segmentStartedAt: nowIso };
}

function findWe(s: WorkoutSession, weId: string): WorkoutExercise {
  const we = s.workout.exercises.find((w) => w.id === weId);
  if (!we) throw new Error(`Unknown workout exercise ${weId}`);
  return we;
}

export function isRunning(s: WorkoutSession): boolean {
  return s.status === 'in-progress';
}

/** Log one set. Values are validated and clamped to sensible bounds. */
export function logSet(s: WorkoutSession, weId: string, set: Omit<WorkoutSet, 'setIndex'>): WorkoutSession {
  if (!isRunning(s)) throw new Error('Start or resume the workout before logging sets.');
  const we = findWe(s, weId);
  const p = s.progress[weId];
  if (p.sets.length >= we.sets) return s; // cannot exceed prescribed sets
  if (set.repsDone !== undefined && (!Number.isFinite(set.repsDone) || set.repsDone < 0 || set.repsDone > 200)) {
    throw new Error('Reps must be between 0 and 200.');
  }
  if (set.secondsDone !== undefined && (!Number.isFinite(set.secondsDone) || set.secondsDone < 0 || set.secondsDone > 1800)) {
    throw new Error('Time must be between 0 and 1800 seconds.');
  }
  const sets = [...p.sets, { ...set, setIndex: p.sets.length }];
  const completed = sets.length >= we.sets;
  const next = { ...s, progress: { ...s.progress, [weId]: { ...p, sets, completed, skipped: undefined } } };
  return { ...next, completionRatio: completionRatio(next) };
}

export function undoLastSet(s: WorkoutSession, weId: string): WorkoutSession {
  const p = s.progress[weId];
  if (!p.sets.length) return s;
  const next = { ...s, progress: { ...s.progress, [weId]: { ...p, sets: p.sets.slice(0, -1), completed: false } } };
  return { ...next, completionRatio: completionRatio(next) };
}

/** Warm-up / cooldown items are marked done as a whole. */
export function markItemDone(s: WorkoutSession, weId: string, nowIso: string): WorkoutSession {
  if (!isRunning(s)) throw new Error('Start or resume the workout first.');
  const we = findWe(s, weId);
  const p = s.progress[weId];
  const sets: WorkoutSet[] = Array.from({ length: we.sets }, (_, i) => ({
    setIndex: i,
    repsDone: we.reps ? we.reps[0] : undefined,
    secondsDone: we.seconds,
    completedAt: nowIso,
  }));
  const next = { ...s, progress: { ...s.progress, [weId]: { ...p, sets, completed: true, skipped: undefined } } };
  return { ...next, completionRatio: completionRatio(next) };
}

export function skipExercise(s: WorkoutSession, weId: string, reason: SkipReason, note?: string): WorkoutSession {
  const p = s.progress[weId];
  const next = { ...s, progress: { ...s.progress, [weId]: { ...p, completed: false, skipped: { reason, note } } } };
  return { ...next, completionRatio: completionRatio(next) };
}

export function unskipExercise(s: WorkoutSession, weId: string): WorkoutSession {
  const p = s.progress[weId];
  const next = { ...s, progress: { ...s.progress, [weId]: { ...p, skipped: undefined } } };
  return { ...next, completionRatio: completionRatio(next) };
}

/** Replace an exercise. The caller must verify the replacement is an approved alternative. */
export function replaceExercise(s: WorkoutSession, weId: string, newExerciseId: string): WorkoutSession {
  const we = findWe(s, weId);
  const p = s.progress[weId];
  const newEx = EXERCISE_MAP[newExerciseId];
  if (!newEx) throw new Error('Unknown exercise');
  const exercises = s.workout.exercises.map((w) => {
    if (w.id !== weId) return w;
    const dose = newEx.dosing.beginner;
    const reps = newEx.measure === 'reps' ? (w.reps ?? dose.reps ?? [8, 12]) : undefined;
    const seconds = newEx.measure === 'time' ? (w.seconds ?? dose.seconds ?? 30) : undefined;
    return { ...w, exerciseId: newExerciseId, reps, seconds, targetReps: reps ? reps[0] : undefined };
  });
  return {
    ...s,
    workout: { ...s.workout, exercises },
    progress: {
      ...s.progress,
      [weId]: { ...p, performedExerciseId: newExerciseId, replacedFrom: p.replacedFrom ?? we.exerciseId, skipped: undefined },
    },
  };
}

export function completionRatio(s: WorkoutSession): number {
  let required = 0;
  let done = 0;
  for (const we of s.workout.exercises) {
    if (we.block !== 'main') continue;
    const p = s.progress[we.id];
    if (p.skipped?.reason === 'pain') continue; // excused — never penalise stopping for pain
    required += we.sets;
    done += Math.min(we.sets, p.sets.length);
  }
  if (required === 0) return 0;
  return done / required;
}

export function blockComplete(s: WorkoutSession, block: 'warmup' | 'cooldown'): boolean {
  const items = s.workout.exercises.filter((w) => w.block === block);
  return items.length > 0 && items.every((w) => s.progress[w.id].completed);
}

export interface FinishCheck {
  ok: boolean;
  ratio: number;
  activeMinutes: number;
  reasons: string[];
}

export function finishCheck(s: WorkoutSession, nowMs: number): FinishCheck {
  const ratio = completionRatio(s);
  const activeMinutes = activeMsAt(s, nowMs) / 60000;
  const reasons: string[] = [];
  const mainSets = s.workout.exercises.filter((w) => w.block === 'main').length;
  if (mainSets === 0) reasons.push('This workout has no main exercises.');
  if (ratio < COMPLETION_THRESHOLD) reasons.push(`Log at least ${Math.round(COMPLETION_THRESHOLD * 100)}% of the main sets (currently ${Math.round(ratio * 100)}%).`);
  const minMin = MIN_ACTIVE_MINUTES[s.workout.intensity];
  if (activeMinutes < minMin) reasons.push(`Active workout time must be at least ${minMin} minutes (currently ${activeMinutes.toFixed(1)}).`);
  return { ok: reasons.length === 0, ratio, activeMinutes, reasons };
}

/** Finish the session. Returns completed or ended-early according to the rules. */
export function finishSession(s: WorkoutSession, nowIso: string, symptomReport?: SymptomReport): WorkoutSession {
  const paused = s.segmentStartedAt ? pauseSession(s, nowIso) : s;
  const check = finishCheck(paused, Date.parse(nowIso));
  return {
    ...paused,
    status: check.ok ? 'completed' : 'ended-early',
    finishedAt: nowIso,
    segmentStartedAt: null,
    completionRatio: check.ratio,
    symptomReport: symptomReport ?? paused.symptomReport,
  };
}

export function remainingSeconds(s: WorkoutSession, estimate: (we: WorkoutExercise) => number): number {
  return s.workout.exercises
    .filter((w) => !s.progress[w.id].completed && !s.progress[w.id].skipped)
    .reduce((sum, w) => {
      const done = s.progress[w.id].sets.length;
      return sum + estimate(w) * (1 - done / Math.max(1, w.sets));
    }, 0);
}

export function overallProgress(s: WorkoutSession): number {
  let total = 0;
  let done = 0;
  for (const we of s.workout.exercises) {
    const p = s.progress[we.id];
    total += we.sets;
    done += p.skipped ? we.sets : Math.min(we.sets, p.sets.length);
  }
  return total ? done / total : 0;
}
