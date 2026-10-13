import { describe, expect, it } from 'vitest';
import { MEALS } from '../data/meals';
import { FOOD_MAP } from '../data/foods';
import { makeProfile } from '../test/fixtures';
import { coachReply, findExerciseInText, type CoachContext } from './coach';
import { DAILY_CAUTION_ML, dayTotal, hydrationTarget, hydrationWarnings, validateAmount } from './hydration';
import { defaultMeal, eligibleMeals, energyGuidance, logTotals, mealSuitable, mealTotals, validateFoodEntry } from './nutrition';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg, validateBody, validateComplete } from './profileValidation';
import { checkExercise, detectRedFlags, triageSymptoms } from './safety';
import { EXERCISE_MAP } from '../data/exercises';
import { DEFAULT_HYDRATION } from '../store/userData';

describe('nutrition', () => {
  it('gives calorie ranges to adults with only modest adjustments', () => {
    const g = energyGuidance(makeProfile({ primaryGoal: 'recomp', sex: 'female', weightKg: 60, heightCm: 160, age: 30, activityLevel: 'light' }));
    expect(g.mode).toBe('targets');
    expect(g.kcalRange![0]).toBeGreaterThanOrEqual(1400);
    expect(g.maintenance![0] - g.kcalRange![0]).toBeLessThanOrEqual(400);
  });
  it('never sets calorie targets for under-18s or medical flags', () => {
    expect(energyGuidance(makeProfile({ age: 16 })).mode).toBe('general');
    expect(energyGuidance(makeProfile({ limitations: ['pregnancy'] })).mode).toBe('general');
    expect(energyGuidance(makeProfile({ readiness: { heartConditionOrSupervised: true, chestPainOnActivity: false, dizzinessOrFainting: false, otherMedicalReason: false } })).mode).toBe('general');
  });
  it('shows a range when sex is not specified', () => {
    const g = energyGuidance(makeProfile({ sex: 'unspecified' }));
    expect(g.maintenance![1]).toBeGreaterThan(g.maintenance![0]);
  });
  it('never suggests meals containing the user’s allergens or outside their diet', () => {
    const p = makeProfile({ allergies: ['fish', 'egg', 'gluten'], diet: 'vegetarian' });
    for (const slot of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
      for (const m of eligibleMeals(slot, p)) {
        for (const it of m.items) {
          const f = FOOD_MAP[it.foodId];
          expect(f.allergens.some((a) => p.allergies.includes(a)), `${m.id}/${f.id}`).toBe(false);
          expect(f.dietTags).toContain('vegetarian');
        }
      }
    }
  });
  it('prefers regional (Bangladesh) meals', () => {
    const m = defaultMeal('2026-10-13', 'lunch', makeProfile({ region: 'BD' }))!;
    expect(m.regions === 'all' || m.regions.includes('BD')).toBe(true);
  });
  it('excludes unknown nutrition from totals and reports it instead of inventing values', () => {
    const khichuri = MEALS.find((m) => m.id === 'b-khichuri-egg')!;
    const t = mealTotals(khichuri);
    expect(t.unknownItems).toBe(1);
    expect(t.kcal).toBe(78);
    const log = logTotals([
      { id: '1', date: 'd', slot: 'lunch', customName: 'Biryani', createdAt: '' },
      { id: '2', date: 'd', slot: 'lunch', foodId: 'egg', servings: 2, createdAt: '' },
    ]);
    expect(log.unknownItems).toBe(1);
    expect(log.protein).toBeCloseTo(12.6);
  });
  it('validates food entries', () => {
    expect(validateFoodEntry({})).toMatch(/Choose/);
    expect(validateFoodEntry({ foodId: 'egg', servings: 0 })).toMatch(/Servings/);
    expect(validateFoodEntry({ customName: 'x', customNutrition: { kcal: 5000 } })).toMatch(/Calories/);
    expect(validateFoodEntry({ foodId: 'egg', servings: 1 })).toBeNull();
  });
  it('every sample meal references existing foods and is suitable for at least one diet', () => {
    for (const m of MEALS) {
      for (const it of m.items) expect(FOOD_MAP[it.foodId], `${m.id}:${it.foodId}`).toBeDefined();
      expect(mealSuitable(m, { diet: 'omnivore', allergies: [] })).toBe(true);
    }
  });
});

describe('hydration', () => {
  const p = makeProfile({ weightKg: 70 });
  it('estimates a reasonable starting target and adjusts for workouts and heat', () => {
    const base = hydrationTarget(p, DEFAULT_HYDRATION, 0);
    expect(base.ml).toBe(2100);
    expect(hydrationTarget(p, { ...DEFAULT_HYDRATION, hotClimate: true }, 30).ml).toBe(2100 + 250 + 500);
  });
  it('a medical fluid limit overrides everything', () => {
    const t = hydrationTarget(p, { ...DEFAULT_HYDRATION, medicalLimitMl: 1200, customTargetMl: 3000 }, 60);
    expect(t.ml).toBe(1200);
    expect(t.isLimit).toBe(true);
  });
  it('rejects invalid quantities', () => {
    expect(validateAmount(0)).toBeTruthy();
    expect(validateAmount(-50)).toBeTruthy();
    expect(validateAmount(2500)).toBeTruthy();
    expect(validateAmount(12.5)).toBeTruthy();
    expect(validateAmount(NaN)).toBeTruthy();
    expect(validateAmount(250)).toBeNull();
  });
  it('warns about drinking a lot quickly or exceeding a limit', () => {
    const now = '2026-10-13T10:00:00.000Z';
    const entries = [{ id: 'a', date: '2026-10-13', ml: 800, beverage: 'water' as const, at: '2026-10-13T09:40:00.000Z' }];
    const t = hydrationTarget(p, DEFAULT_HYDRATION, 0);
    expect(hydrationWarnings(entries, '2026-10-13', now, 500, t).some((w) => w.level === 'caution')).toBe(true);
    expect(dayTotal(entries, '2026-10-13')).toBe(800);
    const big = Array.from({ length: 6 }, (_, i) => ({ id: String(i), date: '2026-10-13', ml: 900, beverage: 'water' as const, at: '2026-10-13T01:00:00.000Z' }));
    expect(dayTotal(big, '2026-10-13') + 200).toBeGreaterThan(DAILY_CAUTION_ML);
    expect(hydrationWarnings(big, '2026-10-13', now, 200, t).some((w) => w.message.includes('5 litres'))).toBe(true);
    const lim = hydrationTarget(p, { ...DEFAULT_HYDRATION, medicalLimitMl: 1000 }, 0);
    expect(hydrationWarnings(entries, '2026-10-13', '2026-10-13T20:00:00.000Z', 300, lim).some((w) => w.level === 'limit')).toBe(true);
  });
});

describe('safety & coach', () => {
  it('triages emergencies, pain and fatigue appropriately', () => {
    expect(triageSymptoms(['chest-pain']).level).toBe('emergency');
    expect(triageSymptoms(['sharp-pain']).level).toBe('stop');
    expect(triageSymptoms(['fatigue']).level).toBe('modify');
    expect(triageSymptoms(['normal-soreness']).level).toBe('ok');
  });
  it('detects red flags in free text', () => {
    expect(detectRedFlags('I feel dizzy and my chest hurts')).toEqual(expect.arrayContaining(['faint-dizzy']));
    expect(detectRedFlags('chest pain during push ups')).toContain('chest-pain');
    expect(detectRedFlags('how do I do a squat')).toEqual([]);
  });
  const ctx: CoachContext = { profile: makeProfile(), plan: null, today: '2026-10-13', todayWorkout: null, nextWorkout: null, streak: null, overdue: [], useProfile: true };
  it('tells the user to stop and seek help on concerning symptoms', () => {
    const r = coachReply('I have chest pain while training, should I push through?', ctx);
    expect(r.urgent).toBe(true);
    expect(r.text).toMatch(/Stop/);
    expect(r.text).not.toMatch(/push through it/i);
  });
  it('explains exercises from the library and offers only approved substitutions', () => {
    expect(findExerciseInText('how do I do a reverse lunge')?.id).toBe('reverse-lunge');
    expect(coachReply('How do I perform a glute bridge?', ctx).text).toMatch(/Glute Bridge/);
    const r = coachReply('Can I replace push-ups?', ctx);
    expect(r.text).toMatch(/alternatives/i);
    expect(r.text).not.toMatch(/Burpee/);
  });
  it('handles missed workouts without punishment', () => {
    const r = coachReply('I missed yesterday’s workout. What should I do?', ctx);
    expect(r.text).toMatch(/never need to do two hard workouts/);
  });
  it('treats supplements as optional', () => {
    expect(coachReply('Do I need protein powder?', ctx).text).toMatch(/optional/);
  });
  it('safety checks block contraindicated exercises', () => {
    expect(checkExercise(EXERCISE_MAP['burpee'], makeProfile({ limitations: ['knee'], experience: 'advanced' })).allowed).toBe(false);
    expect(checkExercise(EXERCISE_MAP['glute-bridge'], makeProfile({ limitations: ['pregnancy'] })).allowed).toBe(false);
    expect(checkExercise(EXERCISE_MAP['wall-pushup'], makeProfile({ limitations: ['no-floor-work'] })).allowed).toBe(true);
    expect(checkExercise(EXERCISE_MAP['pike-pushup'], makeProfile({ experience: 'beginner' })).allowed).toBe(false);
  });
});

describe('profile validation & units', () => {
  const valid = { displayName: 'Ana', age: 30, heightCm: 170, weightKg: 70, region: 'BD' as const, experience: 'beginner' as const, activityLevel: 'light' as const, sleepHours: 7, dailyMinutes: 30 as const, trainingDays: [1, 3] as Array<0 | 1 | 2 | 3 | 4 | 5 | 6>, diet: 'omnivore' as const };
  it('accepts a valid profile', () => {
    expect(validateBody(valid)).toEqual({});
  });
  it('rejects missing and invalid values', () => {
    expect(validateBody({ ...valid, age: undefined }).age).toBeDefined();
    expect(validateBody({ ...valid, age: 12 }).age).toMatch(/13/);
    expect(validateBody({ ...valid, age: 25.5 }).age).toBeDefined();
    expect(validateBody({ ...valid, heightCm: 50 }).heightCm).toBeDefined();
    expect(validateBody({ ...valid, weightKg: 900 }).weightKg).toBeDefined();
    expect(validateBody({ ...valid, trainingDays: [1] }).trainingDays).toBeDefined();
    expect(validateBody({ ...valid, trainingDays: [0, 1, 2, 3, 4, 5, 6] }).trainingDays).toBeDefined();
    expect(validateComplete(valid).primaryGoal).toBeDefined();
  });
  it('converts units both ways', () => {
    expect(cmToFtIn(180)).toEqual({ ft: 5, inch: 11 });
    expect(Math.abs(ftInToCm(5, 11) - 180.3)).toBeLessThan(0.2);
    expect(lbToKg(kgToLb(70))).toBeCloseTo(70, 0);
  });
});
