import { FOOD_MAP } from '../data/foods';
import { MEALS, MEAL_MAP } from '../data/meals';
import type { Allergen, FoodLogEntry, Meal, MealSlot, NutritionPerServing, UserProfile } from '../domain/types';
import { hashString } from './dates';
import { ageGroup, requiresLowIntensity } from './safety';

/**
 * Nutrition calculations. All outputs are approximate ranges, and calorie targets are
 * only produced for adults without medical flags. No extreme deficits or surpluses.
 */

export interface EnergyGuidance {
  mode: 'targets' | 'general';
  /** Why general guidance is shown instead of numbers. */
  reason?: string;
  kcalRange?: [number, number];
  proteinRange?: [number, number];
  maintenance?: [number, number];
  goalAdjustment?: string;
  method: string;
}

const ACTIVITY: Record<UserProfile['activityLevel'], number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, 'very-active': 1.725 };

export function bmr(weightKg: number, heightCm: number, age: number, sex: 'female' | 'male'): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

const round50 = (x: number) => Math.round(x / 50) * 50;

export function energyGuidance(p: Pick<UserProfile, 'age' | 'weightKg' | 'heightCm' | 'sex' | 'activityLevel' | 'primaryGoal' | 'bodyGoal' | 'readiness' | 'limitations'>): EnergyGuidance {
  const method = 'Mifflin-St Jeor equation × activity factor, rounded to the nearest 50 kcal. Estimates can be off by 10–20% for an individual.';
  const group = ageGroup(p.age);
  if (group === 'teen' || group === 'too-young') {
    return {
      mode: 'general',
      reason: 'Under 18s are still growing, so BODYQUEST does not set calorie targets or restrictions. Eat regular balanced meals, enough to fuel growth and training, and talk to a doctor or registered dietitian for personalised advice.',
      method,
    };
  }
  if (requiresLowIntensity(p) || p.limitations.includes('pregnancy')) {
    return {
      mode: 'general',
      reason: 'Because of the health information you shared, BODYQUEST shows general balanced-eating guidance only. Please ask a doctor or registered dietitian for personalised targets.',
      method,
    };
  }
  const bm = p.sex === 'unspecified' ? [bmr(p.weightKg, p.heightCm, p.age, 'female'), bmr(p.weightKg, p.heightCm, p.age, 'male')] : [bmr(p.weightKg, p.heightCm, p.age, p.sex), bmr(p.weightKg, p.heightCm, p.age, p.sex)];
  const f = ACTIVITY[p.activityLevel];
  const maint: [number, number] = [round50(bm[0] * f), round50(bm[1] * f)];
  let adj: [number, number] = [0, 0];
  let goalAdjustment = 'Eat around maintenance — enough to fuel training and recovery.';
  const muscleGoal = p.primaryGoal === 'build-muscle' || p.bodyGoal === 'muscular-athletic' || p.bodyGoal === 'balanced-muscular' || p.bodyGoal === 'broad-shoulders';
  if (p.primaryGoal === 'recomp' || p.primaryGoal === 'lean-athletic') {
    adj = [-400, -200];
    goalAdjustment = 'A small deficit (about 200–400 kcal below maintenance) supports gradual fat loss while keeping muscle. Never go below the floor shown.';
  } else if (muscleGoal) {
    adj = [150, 300];
    goalAdjustment = 'A small surplus (about 150–300 kcal above maintenance) supports muscle gain without unnecessary fat gain.';
  }
  const floor = Math.max(Math.min(...bm), 1400);
  const lo = Math.max(floor, round50(maint[0] + adj[0]));
  const hi = Math.max(lo + 100, round50(maint[1] + adj[1]));
  const proteinRange: [number, number] = [Math.round(p.weightKg * 1.2), Math.round(p.weightKg * (muscleGoal || p.primaryGoal === 'recomp' ? 2.0 : 1.6))];
  return { mode: 'targets', kcalRange: [lo, hi], proteinRange, maintenance: maint, goalAdjustment, method };
}

// ---------------------------------------------------------------------------
// Meal suitability
// ---------------------------------------------------------------------------

export function mealAllergens(meal: Meal): Allergen[] {
  return Array.from(new Set(meal.items.flatMap((it) => FOOD_MAP[it.foodId]?.allergens ?? [])));
}

export function mealSuitable(meal: Meal, p: Pick<UserProfile, 'diet' | 'allergies'>): boolean {
  return meal.items.every((it) => {
    const f = FOOD_MAP[it.foodId];
    if (!f) return false;
    if (!f.dietTags.includes(p.diet)) return false;
    return !f.allergens.some((a) => p.allergies.includes(a));
  });
}

export function eligibleMeals(slot: MealSlot, p: Pick<UserProfile, 'diet' | 'allergies' | 'region'>): Meal[] {
  const ok = MEALS.filter((m) => m.slot === slot && mealSuitable(m, p));
  const regional = ok.filter((m) => m.regions === 'all' || m.regions.includes(p.region));
  const rest = ok.filter((m) => !(m.regions === 'all' || m.regions.includes(p.region)));
  return [...regional, ...rest];
}

/** Deterministic default meal for a date & slot (rotates daily through regional options). */
export function defaultMeal(date: string, slot: MealSlot, p: Pick<UserProfile, 'diet' | 'allergies' | 'region'>): Meal | null {
  const all = eligibleMeals(slot, p);
  if (!all.length) return null;
  const regional = all.filter((m) => m.regions === 'all' || m.regions.includes(p.region));
  const pool = regional.length >= 2 ? regional : all;
  return pool[hashString(`${date}:${slot}`) % pool.length];
}

export function resolveMeal(date: string, slot: MealSlot, selectedId: string | undefined, p: Pick<UserProfile, 'diet' | 'allergies' | 'region'>): Meal | null {
  if (selectedId) {
    const m = MEAL_MAP[selectedId];
    if (m && mealSuitable(m, p)) return m;
  }
  return defaultMeal(date, slot, p);
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export interface NutritionTotals extends NutritionPerServing {
  /** Number of items whose nutrition is unknown (excluded from totals). */
  unknownItems: number;
  knownItems: number;
}

const ZERO = (): NutritionTotals => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, unknownItems: 0, knownItems: 0 });

function addScaled(t: NutritionTotals, n: Partial<NutritionPerServing> | null | undefined, servings: number): NutritionTotals {
  if (!n || n.kcal === undefined) return { ...t, unknownItems: t.unknownItems + 1 };
  return {
    kcal: t.kcal + (n.kcal ?? 0) * servings,
    protein: t.protein + (n.protein ?? 0) * servings,
    carbs: t.carbs + (n.carbs ?? 0) * servings,
    fat: t.fat + (n.fat ?? 0) * servings,
    unknownItems: t.unknownItems,
    knownItems: t.knownItems + 1,
  };
}

export function mealTotals(meal: Meal): NutritionTotals {
  return meal.items.reduce((t, it) => addScaled(t, FOOD_MAP[it.foodId]?.nutrition, it.servings), ZERO());
}

export function logTotals(entries: FoodLogEntry[]): NutritionTotals {
  return entries.reduce((t, e) => {
    if (e.foodId) return addScaled(t, FOOD_MAP[e.foodId]?.nutrition, e.servings ?? 1);
    return addScaled(t, e.customNutrition && e.customNutrition.kcal !== undefined ? e.customNutrition : null, 1);
  }, ZERO());
}

export function fmtApprox(x: number, unit = ''): string {
  return `≈${Math.round(x)}${unit}`;
}

export function validateFoodEntry(e: Partial<FoodLogEntry>): string | null {
  if (!e.foodId && !(e.customName && e.customName.trim())) return 'Choose a food or type what you ate.';
  if (e.customName && e.customName.length > 80) return 'Keep the description under 80 characters.';
  if (e.foodId && (e.servings === undefined || !Number.isFinite(e.servings) || e.servings <= 0 || e.servings > 10)) return 'Servings must be between 0.25 and 10.';
  if (e.customNutrition) {
    const { kcal, protein, carbs, fat } = e.customNutrition;
    if (kcal !== undefined && (kcal < 0 || kcal > 3000)) return 'Calories must be between 0 and 3000 for one item.';
    for (const [k, v] of Object.entries({ protein, carbs, fat })) if (v !== undefined && (v < 0 || v > 300)) return `${k} must be between 0 and 300 g.`;
  }
  return null;
}

export const SUPPLEMENT_NOTE =
  'Supplements are optional. You do not need protein powder, creatine or any other supplement to start exercising or to build strength — ordinary foods like eggs, fish, dal, beans, milk and yogurt cover protein needs for most people. Speak to a health professional before taking supplements, especially if you are under 18, pregnant, or have a medical condition.';
