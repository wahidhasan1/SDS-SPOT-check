import type { UserProfile } from '../domain/types';

export const LIMITS = {
  age: [13, 100] as const,
  heightCm: [120, 230] as const,
  weightKg: [30, 300] as const,
  sleepHours: [3, 14] as const,
};

export const cmToFtIn = (cm: number): { ft: number; inch: number } => {
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) {
    ft += 1;
    inch = 0;
  }
  return { ft, inch };
};
export const ftInToCm = (ft: number, inch: number): number => Math.round((ft * 12 + inch) * 2.54 * 10) / 10;
export const kgToLb = (kg: number): number => Math.round(kg * 2.20462 * 10) / 10;
export const lbToKg = (lb: number): number => Math.round((lb / 2.20462) * 10) / 10;

export type ProfileErrors = Partial<Record<keyof UserProfile | 'general', string>>;

export function validateBody(p: Partial<UserProfile>): ProfileErrors {
  const e: ProfileErrors = {};
  if (p.displayName !== undefined && (p.displayName.trim().length < 2 || p.displayName.trim().length > 40)) e.displayName = 'Enter a name between 2 and 40 characters.';
  if (p.age === undefined || !Number.isFinite(p.age)) e.age = 'Age is required.';
  else if (!Number.isInteger(p.age)) e.age = 'Enter your age in whole years.';
  else if (p.age < LIMITS.age[0]) e.age = 'BODYQUEST is for people aged 13 and over. Younger children should exercise through play, sport and school activities with adult supervision.';
  else if (p.age > LIMITS.age[1]) e.age = `Enter an age up to ${LIMITS.age[1]}.`;
  if (p.heightCm === undefined || !Number.isFinite(p.heightCm)) e.heightCm = 'Height is required.';
  else if (p.heightCm < LIMITS.heightCm[0] || p.heightCm > LIMITS.heightCm[1]) e.heightCm = `Height must be between ${LIMITS.heightCm[0]} and ${LIMITS.heightCm[1]} cm (about 3′11″ to 7′7″).`;
  if (p.weightKg === undefined || !Number.isFinite(p.weightKg)) e.weightKg = 'Weight is required.';
  else if (p.weightKg < LIMITS.weightKg[0] || p.weightKg > LIMITS.weightKg[1]) e.weightKg = `Weight must be between ${LIMITS.weightKg[0]} and ${LIMITS.weightKg[1]} kg (about 66 to 660 lb).`;
  if (!p.region) e.region = 'Choose your country or region.';
  if (!p.experience) e.experience = 'Choose your experience level.';
  if (!p.activityLevel) e.activityLevel = 'Choose your current activity level.';
  if (p.sleepHours === undefined || !Number.isFinite(p.sleepHours)) e.sleepHours = 'Enter your typical sleep.';
  else if (p.sleepHours < LIMITS.sleepHours[0] || p.sleepHours > LIMITS.sleepHours[1]) e.sleepHours = `Enter between ${LIMITS.sleepHours[0]} and ${LIMITS.sleepHours[1]} hours.`;
  if (!p.dailyMinutes) e.dailyMinutes = 'Choose how much time you have.';
  if (!p.trainingDays || p.trainingDays.length < 2) e.trainingDays = 'Choose at least 2 training days so the plan can include enough practice.';
  else if (p.trainingDays.length > 6) e.trainingDays = 'Keep at least one full rest day each week.';
  if (!p.diet) e.diet = 'Choose a dietary preference.';
  if (p.limitationNotes && p.limitationNotes.length > 300) e.limitationNotes = 'Keep notes under 300 characters.';
  return e;
}

export function validateGoals(p: Partial<UserProfile>): ProfileErrors {
  const e: ProfileErrors = {};
  if (!p.primaryGoal) e.primaryGoal = 'Choose your primary goal.';
  if (p.secondaryGoal && p.secondaryGoal === p.primaryGoal) e.secondaryGoal = 'Secondary goal must be different from the primary goal.';
  return e;
}

export function validateComplete(p: Partial<UserProfile>): ProfileErrors {
  const e = { ...validateBody(p), ...validateGoals(p) };
  if (!p.bodyGoal) e.bodyGoal = 'Choose a body goal.';
  if (!p.trainingPattern) e.trainingPattern = 'Choose a training pattern.';
  if (!p.timelineMonths) e.timelineMonths = 'Choose a timeline.';
  return e;
}

export function hasErrors(e: ProfileErrors): boolean {
  return Object.keys(e).length > 0;
}
