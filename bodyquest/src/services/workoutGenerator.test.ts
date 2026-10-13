import { describe, expect, it } from 'vitest';
import { EXERCISE_MAP, EXERCISES } from '../data/exercises';
import { POSES } from '../illustrations/poses';
import { makeProfile } from '../test/fixtures';
import { addDays } from './dates';
import { buildPlan, buildWeekTemplate, recommendPattern } from './plan';
import { checkExercise } from './safety';
import { estimateSeconds, generateWorkout } from './workoutGenerator';
import type { Weekday } from '../domain/types';

const START = '2026-10-12'; // a Monday

describe('exercise library integrity', () => {
  it('every exercise has instructions, dosing, valid references and real illustration poses', () => {
    for (const e of EXERCISES) {
      expect(e.instructions.steps.length, e.id).toBeGreaterThan(0);
      expect(e.instructions.commonMistakes.length, e.id).toBeGreaterThan(0);
      expect(e.frames.length, e.id).toBeGreaterThan(0);
      for (const f of e.frames) expect(POSES[f.pose], `${e.id} pose ${f.pose}`).toBeDefined();
      for (const id of [...e.easier, ...e.harder]) expect(EXERCISE_MAP[id], `${e.id} → ${id}`).toBeDefined();
      for (const lvl of ['beginner', 'intermediate', 'advanced'] as const) {
        const d = e.dosing[lvl];
        expect(d.sets).toBeGreaterThan(0);
        expect(Boolean(d.reps) !== Boolean(d.seconds), `${e.id} dose shape`).toBe(true);
        if (e.measure === 'reps') expect(d.reps, e.id).toBeDefined();
        else expect(d.seconds, e.id).toBeDefined();
      }
    }
  });
  it('requires no purchased equipment', () => {
    for (const e of EXERCISES) for (const eq of e.equipment) expect(['none', 'wall', 'chair', 'towel', 'step']).toContain(eq);
  });
});

describe('pattern recommendation', () => {
  it('recommends full-body for beginners and explains splits are unnecessary', () => {
    const r = recommendPattern(makeProfile());
    expect(r.pattern).toBe('full-body');
    expect(r.reasons.join(' ')).toMatch(/not necessary/);
  });
  it('recommends upper/lower for intermediate with 4 days', () => {
    expect(recommendPattern(makeProfile({ experience: 'intermediate', trainingDays: [1, 2, 4, 5] })).pattern).toBe('upper-lower');
  });
  it('recommends mobility when medical clearance is needed', () => {
    const p = makeProfile({ readiness: { heartConditionOrSupervised: true, chestPainOnActivity: false, dizzinessOrFainting: false, otherMedicalReason: false } });
    expect(recommendPattern(p).pattern).toBe('mobility-general');
  });
});

describe('weekly schedule recovery rules', () => {
  it('never schedules full-body hard sessions on consecutive days', () => {
    const wt = buildWeekTemplate('full-body', [1, 2, 3, 4] as Weekday[], { experience: 'beginner', age: 30 });
    expect(wt[1]).toBe('full-a');
    expect(['technique', 'mobility-b']).toContain(wt[2]);
    expect(wt[3]).toMatch(/full/);
    expect(['technique', 'mobility-b']).toContain(wt[4]);
  });
  it('caps beginner hard days at 4 and converts extras to mobility', () => {
    const wt = buildWeekTemplate('upper-lower', [1, 2, 3, 4, 5, 6] as Weekday[], { experience: 'beginner', age: 30 });
    const hard = Object.values(wt).filter((t) => t === 'upper' || t === 'lower').length;
    expect(hard).toBeLessThanOrEqual(4);
  });
  it('allows upper/lower on consecutive days (different muscles)', () => {
    const wt = buildWeekTemplate('upper-lower', [1, 2, 4, 5] as Weekday[], { experience: 'intermediate', age: 30 });
    expect([wt[1], wt[2], wt[4], wt[5]]).toEqual(['upper', 'lower', 'upper', 'lower']);
  });
});

describe('workout generation', () => {
  const profile = makeProfile();
  const plan = buildPlan(profile, START, '2026-10-12T08:00:00Z', 'p1');

  it('returns null on rest days and a structured workout on training days', () => {
    expect(generateWorkout(profile, plan, addDays(START, 1))).toBeNull(); // Tuesday
    const w = generateWorkout(profile, plan, START)!;
    expect(w).not.toBeNull();
    expect(w.exercises.filter((e) => e.block === 'warmup').length).toBeGreaterThanOrEqual(3);
    expect(w.exercises.filter((e) => e.block === 'main').length).toBeGreaterThanOrEqual(3);
    expect(w.exercises.filter((e) => e.block === 'cooldown').length).toBeGreaterThanOrEqual(2);
    expect(w.recoveryAdvice.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same inputs', () => {
    expect(generateWorkout(profile, plan, START)).toEqual(generateWorkout(profile, plan, START));
  });

  it('keeps beginners at or below difficulty 2 for main work', () => {
    const w = generateWorkout(profile, plan, START)!;
    for (const e of w.exercises.filter((x) => x.block === 'main')) expect(EXERCISE_MAP[e.exerciseId].difficulty).toBeLessThanOrEqual(2);
  });

  it('roughly respects the available time', () => {
    for (const mins of [15, 20, 30, 45, 60] as const) {
      const p = makeProfile({ dailyMinutes: mins });
      const pl = buildPlan(p, START, '2026-10-12T08:00:00Z', 'p');
      const w = generateWorkout(p, pl, START)!;
      const total = w.exercises.reduce((s, e) => s + estimateSeconds(e), 0) / 60;
      expect(total, `${mins} min`).toBeLessThanOrEqual(mins * 1.35 + 3);
    }
  });

  it('excludes contraindicated exercises for every limitation', () => {
    const lims = ['knee', 'lower-back', 'shoulder', 'wrist', 'no-high-impact', 'no-floor-work', 'pregnancy', 'balance'] as const;
    for (const lim of lims) {
      const p = makeProfile({ limitations: [lim], experience: 'advanced', primaryGoal: 'lean-athletic', trainingPattern: 'athletic-conditioning', trainingDays: [1, 3, 5, 6] as Weekday[] });
      const pl = buildPlan(p, START, '2026-10-12T08:00:00Z', 'p');
      for (let d = 0; d < 7; d++) {
        const w = generateWorkout(p, pl, addDays(START, d));
        if (!w) continue;
        for (const e of w.exercises) {
          const res = checkExercise(EXERCISE_MAP[e.exerciseId], p);
          expect(res.allowed, `${lim}: ${e.exerciseId} ${res.reasons.join(';')}`).toBe(true);
        }
      }
    }
  });

  it('builds a low-intensity mobility plan when medical clearance is needed', () => {
    const p = makeProfile({ readiness: { heartConditionOrSupervised: false, chestPainOnActivity: true, dizzinessOrFainting: false, otherMedicalReason: false } });
    const pl = buildPlan(p, START, '2026-10-12T08:00:00Z', 'p');
    expect(pl.lowIntensityOnly).toBe(true);
    const w = generateWorkout(p, pl, START)!;
    expect(w.intensity).toBe('light');
    for (const e of w.exercises) expect(EXERCISE_MAP[e.exerciseId].impact).toBe('low');
  });

  it('applies accepted progressions (variation + rep target)', () => {
    const w = generateWorkout(profile, plan, START)!;
    const main = w.exercises.find((e) => e.block === 'main' && EXERCISE_MAP[e.exerciseId].measure === 'reps')!;
    const w2 = generateWorkout(profile, plan, START, undefined, {
      progressions: { [main.baseExerciseId]: { exerciseId: main.baseExerciseId, variationId: main.baseExerciseId, repBonus: 2, updatedAt: '' } },
    })!;
    const m2 = w2.exercises.find((e) => e.id === main.id)!;
    expect(m2.targetReps).toBe(Math.min(m2.reps![1], m2.reps![0] + 2));
  });

  it('builds a 24-month plan with distinct progressive phases and monthly milestones', () => {
    const p = makeProfile({ timelineMonths: 24 });
    const pl = buildPlan(p, START, '2026-10-12T08:00:00Z', 'p');
    expect(pl.phases.length).toBeGreaterThanOrEqual(8);
    expect(new Set(pl.phases.map((x) => x.name)).size).toBe(pl.phases.length);
    expect(pl.milestones).toHaveLength(24);
    expect(pl.milestones[0].title).toMatch(/technique|habit|Learn/i);
  });

  it('body goal changes training emphasis', () => {
    const lower = makeProfile({ bodyGoal: 'strong-lower', experience: 'intermediate', trainingPattern: 'upper-lower', trainingDays: [1, 2, 4, 5] as Weekday[] });
    const pl = buildPlan(lower, START, 'x', 'p');
    const w = generateWorkout(lower, pl, addDays(START, 1))!; // lower day
    const muscles = w.exercises.filter((e) => e.block === 'main').flatMap((e) => EXERCISE_MAP[e.exerciseId].muscles);
    expect(muscles.filter((m) => m === 'glutes' || m === 'quads').length).toBeGreaterThanOrEqual(3);
  });
});

describe('impact limits', () => {
  it('includes at most one high-impact exercise per session, max 3 sets', () => {
    const p = makeProfile({ experience: 'advanced', primaryGoal: 'lean-athletic', trainingPattern: 'athletic-conditioning', trainingDays: [1, 3, 5, 6] as Weekday[], dailyMinutes: 60 });
    const pl = buildPlan(p, START, 'x', 'p');
    for (let d = 0; d < 28; d++) {
      const w = generateWorkout(p, pl, addDays(START, d));
      if (!w) continue;
      const hi = w.exercises.filter((e) => e.block === 'main' && EXERCISE_MAP[e.exerciseId].impact === 'high');
      expect(hi.length).toBeLessThanOrEqual(1);
      for (const e of hi) expect(e.sets).toBeLessThanOrEqual(3);
    }
  });
});
