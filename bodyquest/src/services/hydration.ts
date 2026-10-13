import type { HydrationEntry, HydrationSettings, UserProfile } from '../domain/types';
import { ageGroup } from './safety';

/**
 * Hydration guidance. Targets are a *starting estimate* for drinks (not total water —
 * food typically provides roughly 20% of daily water). Thirst, urine colour, climate and
 * medical advice matter more than any number. A medical fluid limit always wins.
 */

export const ENTRY_MIN_ML = 10;
export const ENTRY_MAX_ML = 1000;
export const RAPID_WINDOW_MIN = 60;
export const RAPID_LIMIT_ML = 1000;
export const DAILY_CAUTION_ML = 5000;

export interface HydrationTarget {
  ml: number;
  source: 'medical-limit' | 'custom' | 'estimate' | 'general';
  explanation: string;
  isLimit: boolean;
}

export function hydrationTarget(
  p: Pick<UserProfile, 'weightKg' | 'age' | 'activityLevel'>,
  s: HydrationSettings,
  workoutMinutesToday: number,
): HydrationTarget {
  if (s.medicalLimitMl) {
    return {
      ml: s.medicalLimitMl,
      source: 'medical-limit',
      isLimit: true,
      explanation: 'You set a fluid limit advised by a health professional. BODYQUEST treats it as a maximum and will not encourage drinking more.',
    };
  }
  if (s.customTargetMl) {
    return { ml: s.customTargetMl, source: 'custom', isLimit: false, explanation: 'Your custom daily drinks target.' };
  }
  if (ageGroup(p.age) === 'teen') {
    const ml = 1800 + (workoutMinutesToday > 0 ? 300 : 0) + (s.hotClimate ? 300 : 0);
    return { ml, source: 'general', isLimit: false, explanation: 'A general starting point for teenagers. Drink regularly and follow your thirst.' };
  }
  const base = Math.min(3000, Math.max(1500, Math.round((p.weightKg * 30) / 50) * 50));
  const activity = p.activityLevel === 'very-active' ? 250 : 0;
  const workout = workoutMinutesToday > 0 ? Math.min(750, Math.round((workoutMinutesToday / 30) * 250 / 50) * 50) : 0;
  const heat = s.hotClimate ? 500 : 0;
  const ml = base + activity + workout + heat;
  const parts = [`about 30 ml per kg of body weight (${base} ml)`];
  if (workout) parts.push(`+${workout} ml for today’s workout`);
  if (heat) parts.push('+500 ml for hot weather');
  if (activity) parts.push('+250 ml for a very active day');
  return {
    ml,
    source: 'estimate',
    isLimit: false,
    explanation: `Starting estimate for drinks: ${parts.join(', ')}. Food provides extra water. Needs vary — adjust to your thirst and climate.`,
  };
}

export function dayTotal(entries: HydrationEntry[], date: string): number {
  return entries.filter((e) => e.date === date).reduce((s, e) => s + e.ml, 0);
}

export function validateAmount(ml: number): string | null {
  if (!Number.isFinite(ml)) return 'Enter a number of millilitres.';
  if (!Number.isInteger(ml)) return 'Use whole millilitres.';
  if (ml < ENTRY_MIN_ML) return `Minimum entry is ${ENTRY_MIN_ML} ml.`;
  if (ml > ENTRY_MAX_ML) return `Maximum single entry is ${ENTRY_MAX_ML} ml. Log large amounts as separate drinks across the day.`;
  return null;
}

export interface HydrationWarning {
  level: 'info' | 'caution' | 'limit';
  message: string;
}

/** Warnings shown when logging — never block legitimate logging, but discourage overdrinking. */
export function hydrationWarnings(entries: HydrationEntry[], date: string, nowIso: string, addingMl: number, target: HydrationTarget): HydrationWarning[] {
  const out: HydrationWarning[] = [];
  const now = Date.parse(nowIso);
  const recent = entries
    .filter((e) => e.date === date && now - Date.parse(e.at) <= RAPID_WINDOW_MIN * 60000)
    .reduce((s, e) => s + e.ml, 0);
  if (recent + addingMl > RAPID_LIMIT_ML) {
    out.push({ level: 'caution', message: 'That’s more than 1 litre within an hour. Sip gradually through the day instead — drinking large amounts quickly is not recommended.' });
  }
  const total = dayTotal(entries, date) + addingMl;
  if (target.isLimit && total > target.ml) {
    out.push({ level: 'limit', message: `This goes over the fluid limit you set (${target.ml} ml). Please follow your health professional’s advice.` });
  } else if (total > DAILY_CAUTION_ML) {
    out.push({ level: 'caution', message: 'You’ve logged over 5 litres today. Unless you are sweating heavily, this is more than most people need. Drinking excessive water can be harmful.' });
  }
  return out;
}

export const HYDRATION_TIPS = [
  'Drink water regularly throughout the day rather than all at once.',
  'Start your workout normally hydrated — a glass of water an hour or two before is usually enough.',
  'Sip during exercise as needed, especially in hot or humid weather.',
  'Rehydrate after heavy sweating; include salty food or a meal to replace minerals.',
  'Tea, milk and water-rich foods (fruit, dal, soups) also count toward your fluids.',
  'Pale-yellow urine is a simple sign you are drinking enough.',
  'If a doctor has given you a fluid limit (e.g. for heart or kidney conditions), follow it over any app target.',
];
