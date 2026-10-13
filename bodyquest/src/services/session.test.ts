import { describe, expect, it } from 'vitest';
import type { Weekday, WorkoutSession } from '../domain/types';
import { makeProfile } from '../test/fixtures';
import { buildPlan } from './plan';
import { applySuggestion, extractPerformances, suggestFor, updateProgressions } from './progression';
import * as S from './session';
import { generateWorkout } from './workoutGenerator';
import { getAlternatives, isApprovedAlternative } from './substitution';

const profile = makeProfile({ trainingDays: [1, 3, 5] as Weekday[] });
const plan = buildPlan(profile, '2026-10-12', 'x', 'p');
const workout = generateWorkout(profile, plan, '2026-10-12')!;
const T0 = '2026-10-12T08:00:00.000Z';
const at = (min: number) => new Date(Date.parse(T0) + min * 60000).toISOString();

function started(): WorkoutSession {
  return S.startSession(S.createSession(workout, 'planned', '2026-10-12', 's1'), T0, '2026-10-12');
}
function logAllMain(s: WorkoutSession, value?: number, rating?: 1 | 2 | 3 | 4 | 5): WorkoutSession {
  for (const we of s.workout.exercises.filter((w) => w.block === 'main')) {
    for (let i = 0; i < we.sets; i++) {
      s = S.logSet(s, we.id, we.reps ? { repsDone: value ?? we.reps[1], rating, completedAt: T0 } : { secondsDone: we.seconds, rating, completedAt: T0 });
    }
  }
  return s;
}

describe('workout session', () => {
  it('cannot log sets before starting', () => {
    const s = S.createSession(workout, 'planned', '2026-10-12', 's');
    const main = workout.exercises.find((w) => w.block === 'main')!;
    expect(() => S.logSet(s, main.id, { repsDone: 5, completedAt: T0 })).toThrow(/Start/);
  });
  it('validates rep values', () => {
    const s = started();
    const main = workout.exercises.find((w) => w.block === 'main' && w.reps)!;
    expect(() => S.logSet(s, main.id, { repsDone: -1, completedAt: T0 })).toThrow();
    expect(() => S.logSet(s, main.id, { repsDone: 1000, completedAt: T0 })).toThrow();
  });
  it('never logs more sets than prescribed', () => {
    let s = started();
    const main = workout.exercises.find((w) => w.block === 'main')!;
    for (let i = 0; i < main.sets + 3; i++) s = S.logSet(s, main.id, { repsDone: 8, secondsDone: 20, completedAt: T0 });
    expect(s.progress[main.id].sets.length).toBe(main.sets);
  });
  it('pause excludes time; resume continues', () => {
    let s = started();
    s = S.pauseSession(s, at(3));
    expect(S.activeMsAt(s, Date.parse(at(60)))).toBe(3 * 60000);
    s = S.resumeSession(s, at(60));
    expect(S.activeMsAt(s, Date.parse(at(62)))).toBe(5 * 60000);
  });
  it('does not count a workout opened and finished immediately', () => {
    const s = S.finishSession(started(), at(0.5));
    expect(s.status).toBe('ended-early');
  });
  it('requires 70% of main sets and minimum active time', () => {
    const tooQuick = S.finishSession(logAllMain(started()), at(2));
    expect(tooQuick.status).toBe('ended-early');
    const ok = S.finishSession(logAllMain(started()), at(10));
    expect(ok.status).toBe('completed');
    expect(ok.completionRatio).toBe(1);
  });
  it('excuses exercises skipped for pain from the completion ratio', () => {
    let s = started();
    const mains = s.workout.exercises.filter((w) => w.block === 'main');
    s = S.skipExercise(s, mains[0].id, 'pain');
    for (const we of mains.slice(1)) for (let i = 0; i < we.sets; i++) s = S.logSet(s, we.id, { repsDone: 10, secondsDone: 20, completedAt: T0 });
    expect(S.completionRatio(s)).toBe(1);
    const s2 = S.skipExercise(S.unskipExercise(s, mains[0].id), mains[0].id, 'no-time');
    expect(S.completionRatio(s2)).toBeLessThan(1);
  });
  it('survives a JSON round-trip mid-session (page refresh)', () => {
    let s = logAllMain(started());
    s = JSON.parse(JSON.stringify(s));
    expect(S.activeMsAt(s, Date.parse(at(6)))).toBe(6 * 60000);
    expect(S.finishSession(s, at(6)).status).toBe('completed');
  });
  it('replaces exercises only with approved alternatives (checked by substitution service)', () => {
    const main = workout.exercises.find((w) => w.block === 'main')!;
    const alt = getAlternatives(main.exerciseId, profile)[0];
    expect(isApprovedAlternative(main.exerciseId, alt.exercise.id, profile)).toBe(true);
    expect(isApprovedAlternative(main.exerciseId, 'burpee', profile)).toBe(false);
    const s = S.replaceExercise(started(), main.id, alt.exercise.id);
    expect(s.progress[main.id].performedExerciseId).toBe(alt.exercise.id);
    expect(s.progress[main.id].replacedFrom).toBe(main.exerciseId);
  });
  it('substitution never offers exercises outside the safety rules', () => {
    const p = makeProfile({ limitations: ['wrist', 'knee'] });
    for (const a of getAlternatives('pushup', p)) {
      expect(a.exercise.contraindications).not.toContain('wrist');
      expect(a.exercise.impact).toBe('low');
    }
  });
});

describe('progression (opt-in, performance-based)', () => {
  const finished = (rating: 1 | 2 | 3 | 4 | 5, value?: number, date = '2026-10-12') => {
    const s = S.finishSession(logAllMain(started(), value, rating), at(10));
    return { ...s, performedDate: date };
  };
  it('suggests nothing after a single good session', () => {
    const map = updateProgressions({}, [finished(2)], profile, T0);
    expect(Object.values(map).some((p) => p.suggestion?.kind === 'add-reps')).toBe(false);
  });
  it('suggests adding reps after two sessions at the top of the range with manageable ratings', () => {
    const map = updateProgressions({}, [finished(2, undefined, '2026-10-12'), finished(3, undefined, '2026-10-14')], profile, T0);
    const repEx = workout.exercises.find((w) => w.block === 'main' && w.reps)!;
    expect(map[repEx.baseExerciseId].suggestion?.kind).toBe('add-reps');
    const applied = applySuggestion(map[repEx.baseExerciseId], map[repEx.baseExerciseId].suggestion!, T0);
    expect(applied.repBonus).toBe(2);
    expect(applied.suggestion).toBeUndefined();
  });
  it('suggests an easier variation after a "too hard" session and never progresses after pain', () => {
    const hard = finished(5);
    const sug = suggestFor(extractPerformances(hard), undefined, workout.exercises.find((w) => w.block === 'main')!.baseExerciseId, profile);
    expect(['easier-variation', 'hold']).toContain(sug?.kind);
    const pain = { ...finished(1), symptomReport: { symptoms: ['joint-pain' as const], note: '', reportedAt: T0 } };
    const map = updateProgressions({}, [pain, { ...pain, performedDate: '2026-10-14' }], profile, T0);
    expect(Object.values(map).every((p) => p.suggestion?.kind !== 'add-reps' && p.suggestion?.kind !== 'harder-variation')).toBe(true);
  });
});
