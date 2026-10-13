import { OPPONENT_MAP } from '../data/demoOpponents';
import { MEAL_MAP } from '../data/meals';
import type {
  AppNotification,
  AppSettings,
  Battle,
  BeverageType,
  DateKey,
  DayResolution,
  FoodLogEntry,
  HydrationSettings,
  MealSlot,
  ProgressEntry,
  SessionTemplateId,
  SkipReason,
  SymptomReport,
  UserProfile,
  WorkoutSession,
  WorkoutSet,
} from '../domain/types';
import { ageCompatible } from '../services/battle';
import { addDays, diffDays } from '../services/dates';
import { validateAmount } from '../services/hydration';
import { mealSuitable, resolveMeal, validateFoodEntry } from '../services/nutrition';
import { buildPlan, buildWeekTemplate } from '../services/plan';
import { hasErrors, validateComplete } from '../services/profileValidation';
import { applySuggestion, updateProgressions } from '../services/progression';
import { triageSymptoms } from '../services/safety';
import { dayStatus, rescheduleOptions, templateForDate, workoutDoneOn } from '../services/schedule';
import * as S from '../services/session';
import { isApprovedAlternative } from '../services/substitution';
import { generateWorkout } from '../services/workoutGenerator';
import { awardXp, workoutXp, XP } from '../services/xp';
import { MEASUREMENT_BOUNDS, PERFORMANCE_BOUNDS } from '../services/analytics';
import { coachReply, type CoachContext } from '../services/coach';
import {
  availableTokens,
  comebackSessionId,
  findSession,
  mobilitySessionId,
  nextTraining,
  plannedSessionId,
  plannedWorkoutFor,
  scheduleCtx,
} from './selectors';
import { newId } from './storage';
import type { UserData } from './userData';
import { sessionsNeedingAttention, streakSummary } from '../services/schedule';

export interface Env {
  nowIso: string;
  today: DateKey;
  userId: string;
}

export type AppEvent = { kind: 'success' | 'info' | 'error' | 'xp' | 'achievement' | 'level-up'; message: string };

export interface ActionResult {
  data: UserData;
  events: AppEvent[];
}

export class ActionError extends Error {}

const ok = (data: UserData, events: AppEvent[] = []): ActionResult => ({ data, events });

export function notify(data: UserData, n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>, nowIso: string): UserData {
  if (data.notifications.some((x) => x.key === n.key)) return data;
  const note: AppNotification = { ...n, id: newId('ntf'), createdAt: nowIso, read: false };
  return { ...data, notifications: [note, ...data.notifications].slice(0, 200) };
}

export function giveXp(data: UserData, key: string, amount: number, reason: string, env: Env, events: AppEvent[]): UserData {
  const r = awardXp(data.xp, key, amount, reason, env.nowIso);
  if (r.awarded) events.push({ kind: 'xp', message: `+${r.awarded} XP · ${reason}` });
  return r.awarded ? { ...data, xp: r.ledger } : data;
}

function requirePlan(data: UserData) {
  if (!data.profile || !data.plan) throw new ActionError('Complete onboarding to generate your plan first.');
  return { profile: data.profile, plan: data.plan };
}

// ---------------------------------------------------------------------------
// Onboarding & profile
// ---------------------------------------------------------------------------

export function saveDraft(data: UserData, _env: Env, draft: Partial<UserProfile>): ActionResult {
  return ok({ ...data, draft: { ...(data.draft ?? {}), ...draft } });
}

export function completeOnboarding(data: UserData, env: Env, input: Partial<UserProfile>): ActionResult {
  const errors = validateComplete(input);
  if (hasErrors(errors)) throw new ActionError(Object.values(errors)[0] as string);
  const profile: UserProfile = {
    ...(input as UserProfile),
    userId: env.userId,
    limitations: input.limitations ?? [],
    allergies: input.allergies ?? [],
    limitationNotes: input.limitationNotes ?? '',
    secondaryGoal: input.secondaryGoal ?? null,
    avatar: input.avatar ?? { emoji: '💪', color: '#c8f031' },
    createdAt: data.profile?.createdAt ?? env.nowIso,
    updatedAt: env.nowIso,
  };
  let next: UserData = { ...data, profile, draft: null };
  const events: AppEvent[] = [];
  if (data.plan) {
    next = regeneratePlan(next, env);
    events.push({ kind: 'success', message: 'Your plan has been updated. Past history is preserved.' });
  } else {
    const plan = buildPlan(profile, env.today, env.nowIso, newId('plan'));
    next = {
      ...next,
      plan,
      tokens: [{ id: newId('tok'), earnedAt: env.nowIso, reason: 'Starter recovery token' }],
    };
    next = notify(next, { kind: 'system', title: 'Your plan is ready', body: 'Welcome to BODYQUEST! Your personalised plan and first workout are ready.', link: '/app', key: 'welcome' }, env.nowIso);
    events.push({ kind: 'success', message: 'Your personalised plan is ready!' });
  }
  return ok(next, events);
}

/** Rebuild the plan from the current profile, keeping start date & schedule history. */
function regeneratePlan(data: UserData, env: Env): UserData {
  const profile = data.profile!;
  const old = data.plan!;
  const fresh = buildPlan(profile, old.startDate, env.nowIso, old.id);
  const history = [...(old.scheduleHistory ?? [{ from: old.startDate, weekTemplate: old.weekTemplate }])];
  // Changes apply from today; earlier days keep the schedule that was in force then.
  const from = diffDays(env.today, old.startDate) <= 0 ? old.startDate : env.today;
  const filtered = history.filter((h) => diffDays(h.from, from) < 0);
  filtered.push({ from, weekTemplate: fresh.weekTemplate });
  // Planned sessions today or later that haven't started are regenerated automatically.
  const sessions = data.sessions.filter((s) => !(s.kind === 'planned' && s.status === 'not-started' && diffDays(s.plannedDate, env.today) >= 0));
  return { ...data, sessions, plan: { ...fresh, scheduleHistory: filtered, version: old.version + 1, createdAt: old.createdAt } };
}

export function updateProfile(data: UserData, env: Env, patch: Partial<UserProfile>): ActionResult {
  if (!data.profile) throw new ActionError('No profile yet.');
  const merged = { ...data.profile, ...patch, updatedAt: env.nowIso };
  const errors = validateComplete(merged);
  if (hasErrors(errors)) throw new ActionError(Object.values(errors)[0] as string);
  const planFields: Array<keyof UserProfile> = ['experience', 'trainingDays', 'trainingPattern', 'limitations', 'readiness', 'primaryGoal', 'secondaryGoal', 'bodyGoal', 'timelineMonths', 'dailyMinutes', 'age'];
  const affectsPlan = planFields.some((k) => JSON.stringify(patch[k]) !== undefined && JSON.stringify(patch[k]) !== JSON.stringify(data.profile![k]));
  let next: UserData = { ...data, profile: merged };
  if (affectsPlan && data.plan) next = regeneratePlan(next, env);
  return ok(next, [{ kind: 'success', message: affectsPlan ? 'Profile saved — plan updated from today.' : 'Profile saved.' }]);
}

// ---------------------------------------------------------------------------
// Workout sessions
// ---------------------------------------------------------------------------

function putSession(data: UserData, s: WorkoutSession): UserData {
  const exists = data.sessions.some((x) => x.id === s.id);
  return { ...data, sessions: exists ? data.sessions.map((x) => (x.id === s.id ? s : x)) : [...data.sessions, s] };
}

function mutateSession(data: UserData, id: string, fn: (s: WorkoutSession) => WorkoutSession): UserData {
  const s = findSession(data, id);
  if (!s) throw new ActionError('Workout session not found.');
  return putSession(data, fn(s));
}

/** Can the planned session for `date` be started today? Returns an explanation if not. */
export function canStartPlanned(data: UserData, env: Env, date: DateKey): { ok: boolean; reason?: string } {
  if (!data.plan || !data.profile) return { ok: false, reason: 'No plan yet.' };
  const ctx = scheduleCtx(data, env.today)!;
  const st = dayStatus(ctx, date);
  const override = data.overrides[date];
  const movedHere = override?.resolution === 'rescheduled' && override.movedTo === env.today;
  const existing = findSession(data, plannedSessionId(date));
  if (st === 'completed') return { ok: false, reason: 'This session is already completed.' };
  if (existing && (existing.status === 'in-progress' || existing.status === 'paused')) return { ok: true };
  if (diffDays(date, env.today) > 0 && !movedHere) return { ok: false, reason: 'You can’t start a future session early — rest days are part of the plan.' };
  if (!(st === 'scheduled' || st === 'overdue' || movedHere)) {
    return { ok: false, reason: st === 'rescheduled' ? 'This session was moved to another day.' : 'This session can no longer be completed.' };
  }
  if (workoutDoneOn(ctx, env.today)) return { ok: false, reason: 'You’ve already completed a full workout today. One per day keeps recovery on track — rest and come back tomorrow.' };
  return { ok: true };
}

export function startPlanned(data: UserData, env: Env, date: DateKey): ActionResult {
  requirePlan(data);
  const check = canStartPlanned(data, env, date);
  if (!check.ok) throw new ActionError(check.reason!);
  const id = plannedSessionId(date);
  const existing = findSession(data, id);
  if (existing) {
    const s = existing.status === 'paused' || existing.status === 'ended-early' ? S.resumeSession(existing, env.nowIso) : S.startSession(existing, env.nowIso, env.today);
    return ok(putSession(data, s), [{ kind: 'info', message: 'Workout resumed.' }]);
  }
  const workout = plannedWorkoutFor(data, date, env.today);
  if (!workout) throw new ActionError('No workout is planned for this day.');
  const s = S.startSession(S.createSession(workout, 'planned', date, id), env.nowIso, env.today);
  return ok(putSession(data, s), [{ kind: 'info', message: 'Workout started — warm up first!' }]);
}

export function startComeback(data: UserData, env: Env, missedDate: DateKey, template: SessionTemplateId): ActionResult {
  const { profile, plan } = requirePlan(data);
  if (template !== 'comeback-mobility' && template !== 'comeback-technique') throw new ActionError('Not an approved comeback session.');
  const ctx = scheduleCtx(data, env.today)!;
  const id = comebackSessionId(missedDate);
  const existing = findSession(data, id);
  if (existing && existing.status !== 'completed') return ok(putSession(data, S.resumeSession(S.startSession(existing, env.nowIso, env.today), env.nowIso)));
  if (dayStatus(ctx, missedDate) !== 'overdue') throw new ActionError('Comeback sessions are available for recently missed sessions only.');
  const w = generateWorkout(profile, plan, env.today, template, { progressions: data.progressions });
  if (!w) throw new ActionError('Could not create the session.');
  const s = S.startSession(S.createSession({ ...w, id: `alt-${missedDate}` }, 'comeback', missedDate, id), env.nowIso, env.today);
  return ok({ ...putSession(data, s), overrides: { ...data.overrides, [missedDate]: { date: missedDate, resolution: 'comeback', createdAt: env.nowIso } } }, [
    { kind: 'info', message: 'Comeback session started. Nice choice!' },
  ]);
}

export function startMobility(data: UserData, env: Env): ActionResult {
  const { profile, plan } = requirePlan(data);
  const id = mobilitySessionId(env.today);
  const existing = findSession(data, id);
  if (existing?.status === 'completed') throw new ActionError('You already completed today’s optional mobility session. Enjoy the rest!');
  if (existing) return ok(putSession(data, S.resumeSession(S.startSession(existing, env.nowIso, env.today), env.nowIso)));
  const w = generateWorkout(profile, plan, env.today, 'mobility-b', { minutes: 15 });
  if (!w) throw new ActionError('Could not create the session.');
  const s = S.startSession(S.createSession({ ...w, id: `mob-${env.today}`, title: 'Optional Mobility Session', xpAvailable: XP.mobility }, 'mobility', env.today, id), env.nowIso, env.today);
  return ok(putSession(data, s));
}

export const pauseWorkout = (data: UserData, env: Env, id: string) => ok(mutateSession(data, id, (s) => S.pauseSession(s, env.nowIso)), [{ kind: 'info', message: 'Paused. Take your time.' }]);
export const resumeWorkout = (data: UserData, env: Env, id: string) => ok(mutateSession(data, id, (s) => S.resumeSession(s, env.nowIso)));

export function logSet(data: UserData, env: Env, id: string, weId: string, set: Omit<WorkoutSet, 'setIndex' | 'completedAt'>): ActionResult {
  try {
    return ok(mutateSession(data, id, (s) => S.logSet(s, weId, { ...set, completedAt: env.nowIso })));
  } catch (e) {
    throw new ActionError((e as Error).message);
  }
}

export const undoSet = (data: UserData, _env: Env, id: string, weId: string) => ok(mutateSession(data, id, (s) => S.undoLastSet(s, weId)));

export function markDone(data: UserData, env: Env, id: string, weId: string): ActionResult {
  try {
    return ok(mutateSession(data, id, (s) => S.markItemDone(s, weId, env.nowIso)));
  } catch (e) {
    throw new ActionError((e as Error).message);
  }
}

export const skip = (data: UserData, _env: Env, id: string, weId: string, reason: SkipReason, note?: string) => {
  const events: AppEvent[] = reason === 'pain' ? [{ kind: 'info', message: 'Skipped for pain — that never counts against you. Consider reporting it at the end.' }] : [];
  return ok(mutateSession(data, id, (s) => S.skipExercise(s, weId, reason, note)), events);
};
export const unskip = (data: UserData, _env: Env, id: string, weId: string) => ok(mutateSession(data, id, (s) => S.unskipExercise(s, weId)));

export function replace(data: UserData, _env: Env, id: string, weId: string, newExerciseId: string): ActionResult {
  const { profile } = requirePlan(data);
  const s = findSession(data, id);
  if (!s) throw new ActionError('Session not found.');
  const we = s.workout.exercises.find((w) => w.id === weId);
  if (!we) throw new ActionError('Exercise not found.');
  const original = s.progress[weId].replacedFrom ?? we.exerciseId;
  if (!isApprovedAlternative(original, newExerciseId, profile) && !isApprovedAlternative(we.exerciseId, newExerciseId, profile)) {
    throw new ActionError('That exercise is not an approved alternative for your plan.');
  }
  if (s.progress[weId].sets.length > 0) throw new ActionError('Replace an exercise before logging its sets (or undo them first).');
  return ok(putSession(data, S.replaceExercise(s, weId, newExerciseId)), [{ kind: 'success', message: 'Exercise replaced.' }]);
}

export function finishWorkout(data: UserData, env: Env, id: string, report?: SymptomReport): ActionResult {
  const s0 = findSession(data, id);
  if (!s0) throw new ActionError('Session not found.');
  if (s0.status === 'completed') throw new ActionError('This session is already completed.');
  const s = S.finishSession(s0, env.nowIso, report);
  let next = putSession(data, s);
  const events: AppEvent[] = [];
  if (s.status === 'completed') {
    let xp = 0;
    const before = next.xp.length;
    if (s.kind === 'planned') {
      next = giveXp(next, `workout:${s.plannedDate}`, workoutXp(s.completionRatio), 'Planned workout completed', env, events);
      if (S.blockComplete(s, 'warmup')) next = giveXp(next, `warmup:${s.plannedDate}`, XP.warmup, 'Full warm-up', env, events);
      if (S.blockComplete(s, 'cooldown')) next = giveXp(next, `cooldown:${s.plannedDate}`, XP.cooldown, 'Cooldown completed', env, events);
    } else if (s.kind === 'comeback') {
      next = giveXp(next, `comeback:${s.plannedDate}`, XP.comeback, 'Comeback session', env, events);
      next = { ...next, overrides: { ...next.overrides, [s.plannedDate]: { date: s.plannedDate, resolution: 'comeback', createdAt: env.nowIso } } };
    } else {
      next = giveXp(next, `mobility:${env.today}`, XP.mobility, 'Mobility session', env, events);
    }
    xp = next.xp.slice(before).reduce((a, b) => a + b.amount, 0);
    next = { ...next, sessions: next.sessions.map((x) => (x.id === s.id ? { ...x, xpAwarded: xp } : x)) };
    next = { ...next, progressions: updateProgressions(next.progressions, next.sessions, next.profile!, env.nowIso) };
    events.unshift({ kind: 'success', message: 'Workout complete! Great work.' });
  } else {
    const check = S.finishCheck(s0, Date.parse(env.nowIso));
    events.push({ kind: 'info', message: `Session saved but not counted as complete: ${check.reasons.join(' ')}` });
  }
  if (report && triageSymptoms(report.symptoms).level !== 'ok') {
    next = { ...next, progressions: updateProgressions(next.progressions, next.sessions, next.profile!, env.nowIso) };
  }
  return ok(next, events);
}

export function acceptProgression(data: UserData, env: Env, baseId: string): ActionResult {
  const p = data.progressions[baseId];
  if (!p?.suggestion) throw new ActionError('No suggestion to apply.');
  const applied = applySuggestion(p, p.suggestion, env.nowIso);
  return ok({ ...data, progressions: { ...data.progressions, [baseId]: applied } }, [{ kind: 'success', message: 'Progression applied to your next sessions.' }]);
}

export function dismissProgression(data: UserData, env: Env, baseId: string): ActionResult {
  const p = data.progressions[baseId];
  if (!p) return ok(data);
  return ok({ ...data, progressions: { ...data.progressions, [baseId]: { ...p, suggestion: undefined, updatedAt: env.nowIso } } });
}

// ---------------------------------------------------------------------------
// Schedule, missed sessions & recovery
// ---------------------------------------------------------------------------

export function resolveDay(data: UserData, env: Env, date: DateKey, resolution: Exclude<DayResolution, 'comeback'>, opts: { movedTo?: DateKey; note?: string } = {}): ActionResult {
  const { profile } = requirePlan(data);
  const ctx = scheduleCtx(data, env.today)!;
  const st = dayStatus(ctx, date);
  if (!templateForDate(data.plan!, date)) throw new ActionError('There is no planned session on that day.');
  if (resolution === 'unwell') {
    if (st === 'completed') throw new ActionError('That session is already completed.');
    if (diffDays(date, env.today) > 7) throw new ActionError('You can only mark days up to a week ahead.');
  } else if (st !== 'overdue') {
    throw new ActionError('Only recently missed sessions can be resolved this way.');
  }
  let next = data;
  if (resolution === 'token') {
    const tok = availableTokens(data.tokens)[0];
    if (!tok) throw new ActionError('You have no recovery tokens left. Earn one by keeping every planned session in a week.');
    next = { ...next, tokens: next.tokens.map((t) => (t.id === tok.id ? { ...t, usedOn: date } : t)) };
  }
  if (resolution === 'rescheduled') {
    const opt = rescheduleOptions(ctx, date, profile).find((o) => o.date === opts.movedTo);
    if (!opt || !opt.ok) throw new ActionError(opt?.reason ?? 'That day isn’t available for rescheduling.');
  }
  next = { ...next, overrides: { ...next.overrides, [date]: { date, resolution, movedTo: opts.movedTo, note: opts.note, createdAt: env.nowIso } } };
  const msg: Record<string, string> = {
    unwell: 'Marked as unwell / medical rest. Rest well — your streak is protected.',
    token: 'Recovery token used. Your streak is safe.',
    rescheduled: 'Session moved.',
    'acknowledged-missed': 'Got it — back to your normal schedule.',
  };
  return ok(next, [{ kind: 'success', message: msg[resolution] }]);
}

export function clearOverride(data: UserData, env: Env, date: DateKey): ActionResult {
  const o = data.overrides[date];
  if (!o) return ok(data);
  if (o.resolution === 'comeback') throw new ActionError('Completed comeback sessions can’t be undone.');
  if (o.resolution === 'rescheduled' && o.movedTo && findSession(data, plannedSessionId(date))) throw new ActionError('This session has already been started on its new day.');
  const overrides = { ...data.overrides };
  delete overrides[date];
  const tokens = o.resolution === 'token' ? data.tokens.map((t) => (t.usedOn === date ? { ...t, usedOn: undefined } : t)) : data.tokens;
  void env;
  return ok({ ...data, overrides, tokens }, [{ kind: 'info', message: 'Choice undone.' }]);
}

export function changeTrainingDays(data: UserData, env: Env, days: UserProfile['trainingDays']): ActionResult {
  if (!data.profile) throw new ActionError('No profile.');
  // Validate recovery impact first so the user sees the new layout.
  buildWeekTemplate(data.profile.trainingPattern, days, data.profile);
  return updateProfile(data, env, { trainingDays: days });
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

export function selectMeal(data: UserData, env: Env, date: DateKey, slot: MealSlot, mealId: string): ActionResult {
  const { profile } = requirePlan(data);
  const meal = MEAL_MAP[mealId];
  if (!meal || meal.slot !== slot) throw new ActionError('Unknown meal.');
  if (!mealSuitable(meal, profile)) throw new ActionError('That meal doesn’t match your diet or allergy settings.');
  const day = data.mealDays[date] ?? { date, selections: {}, eaten: {} };
  // Changing the plan resets any "as planned" log entries for that slot.
  const foodLog = data.foodLog.filter((e) => !(e.date === date && e.slot === slot && e.fromMealId));
  const eaten = { ...day.eaten };
  if (eaten[slot] === 'as-planned' || eaten[slot] === 'partly') delete eaten[slot];
  void env;
  return ok({ ...data, foodLog, mealDays: { ...data.mealDays, [date]: { ...day, selections: { ...day.selections, [slot]: mealId }, eaten } } }, [{ kind: 'success', message: `Meal replaced: ${meal.name}` }]);
}

export function setMealStatus(data: UserData, env: Env, date: DateKey, slot: MealSlot, status: 'as-planned' | 'partly' | 'different' | 'skipped' | null): ActionResult {
  const { profile } = requirePlan(data);
  const day = data.mealDays[date] ?? { date, selections: {}, eaten: {} };
  const meal = resolveMeal(date, slot, day.selections[slot], profile);
  let foodLog = data.foodLog.filter((e) => !(e.date === date && e.slot === slot && e.fromMealId));
  if (meal && (status === 'as-planned' || status === 'partly')) {
    const factor = status === 'partly' ? 0.5 : 1;
    foodLog = [
      ...foodLog,
      ...meal.items.map<FoodLogEntry>((it) => ({ id: newId('food'), date, slot, foodId: it.foodId, servings: Math.round(it.servings * factor * 100) / 100, fromMealId: meal.id, createdAt: env.nowIso })),
    ];
  }
  const eaten = { ...day.eaten };
  if (status) eaten[slot] = status;
  else delete eaten[slot];
  return ok({ ...data, foodLog, mealDays: { ...data.mealDays, [date]: { ...day, eaten } } });
}

export function addFood(data: UserData, env: Env, entry: Omit<FoodLogEntry, 'id' | 'createdAt'>): ActionResult {
  const err = validateFoodEntry(entry);
  if (err) throw new ActionError(err);
  const e: FoodLogEntry = { ...entry, customName: entry.customName?.trim(), id: newId('food'), createdAt: env.nowIso };
  return ok({ ...data, foodLog: [...data.foodLog, e] }, [{ kind: 'success', message: 'Food logged.' }]);
}

export function removeFood(data: UserData, _env: Env, id: string): ActionResult {
  return ok({ ...data, foodLog: data.foodLog.filter((e) => e.id !== id) });
}

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

export function addWater(data: UserData, env: Env, ml: number, beverage: BeverageType = 'water'): ActionResult {
  const err = validateAmount(ml);
  if (err) throw new ActionError(err);
  const entry = { id: newId('h2o'), date: env.today, ml, beverage, at: env.nowIso };
  return ok({ ...data, hydration: [...data.hydration, entry] }, [{ kind: 'success', message: `+${ml} ml logged` }]);
}

export function editWater(data: UserData, _env: Env, id: string, ml: number): ActionResult {
  const err = validateAmount(ml);
  if (err) throw new ActionError(err);
  if (!data.hydration.some((h) => h.id === id)) throw new ActionError('Entry not found.');
  return ok({ ...data, hydration: data.hydration.map((h) => (h.id === id ? { ...h, ml } : h)) }, [{ kind: 'success', message: 'Entry updated.' }]);
}

export function removeWater(data: UserData, _env: Env, id: string): ActionResult {
  return ok({ ...data, hydration: data.hydration.filter((h) => h.id !== id) }, [{ kind: 'info', message: 'Entry removed.' }]);
}

export function updateHydrationSettings(data: UserData, _env: Env, patch: Partial<HydrationSettings>): ActionResult {
  const next = { ...data.hydrationSettings, ...patch };
  for (const k of ['customTargetMl', 'medicalLimitMl'] as const) {
    const v = next[k];
    if (v !== null && (!Number.isFinite(v) || v < 500 || v > 6000)) throw new ActionError('Targets and limits must be between 500 and 6000 ml.');
  }
  if (next.reminderIntervalMin < 30 || next.reminderIntervalMin > 240) throw new ActionError('Reminder interval must be 30–240 minutes.');
  return ok({ ...data, hydrationSettings: next }, [{ kind: 'success', message: 'Hydration settings saved.' }]);
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export function addProgress(data: UserData, env: Env, entry: Omit<ProgressEntry, 'id' | 'createdAt'>): ActionResult {
  const m = Object.entries(entry.measurements).filter(([, v]) => v !== undefined);
  const p = Object.entries(entry.performance).filter(([, v]) => v !== undefined);
  if (!m.length && !p.length && entry.sleepHours === undefined) throw new ActionError('Enter at least one value.');
  if (diffDays(entry.date, env.today) > 0) throw new ActionError('You can’t log a future date.');
  for (const [k, v] of m) {
    const [lo, hi] = MEASUREMENT_BOUNDS[k as keyof typeof MEASUREMENT_BOUNDS];
    if (!Number.isFinite(v) || (v as number) < lo || (v as number) > hi) throw new ActionError(`Check ${k}: expected between ${lo} and ${hi}.`);
  }
  for (const [k, v] of p) {
    const [lo, hi] = PERFORMANCE_BOUNDS[k as keyof typeof PERFORMANCE_BOUNDS];
    if (!Number.isFinite(v) || (v as number) < lo || (v as number) > hi) throw new ActionError(`Check ${k}: expected between ${lo} and ${hi}.`);
  }
  if (entry.sleepHours !== undefined && (entry.sleepHours < 0 || entry.sleepHours > 16)) throw new ActionError('Sleep must be between 0 and 16 hours.');
  const e: ProgressEntry = { ...entry, id: newId('prg'), createdAt: env.nowIso };
  return ok({ ...data, progress: [...data.progress, e] }, [{ kind: 'success', message: 'Progress saved.' }]);
}

export function removeProgress(data: UserData, _env: Env, id: string): ActionResult {
  return ok({ ...data, progress: data.progress.filter((p) => p.id !== id) }, [{ kind: 'info', message: 'Entry deleted.' }]);
}

export function addPhotoMeta(data: UserData, env: Env, id: string, date: DateKey, note: string): ActionResult {
  return ok({ ...data, photos: [...data.photos, { id, date, note: note.slice(0, 120), createdAt: env.nowIso }] }, [{ kind: 'success', message: 'Photo stored privately on this device.' }]);
}

export function removePhotoMeta(data: UserData, _env: Env, id: string): ActionResult {
  return ok({ ...data, photos: data.photos.filter((p) => p.id !== id) }, [{ kind: 'info', message: 'Photo deleted.' }]);
}

// ---------------------------------------------------------------------------
// Battles (development mode with demo opponents)
// ---------------------------------------------------------------------------

export function createBattle(data: UserData, env: Env, opponentId: string, durationDays: 7 | 14): ActionResult {
  const { profile } = requirePlan(data);
  const o = OPPONENT_MAP[opponentId];
  if (!o) throw new ActionError('Opponent not found.');
  if (!ageCompatible(profile.age, o.ageBand)) throw new ActionError('This opponent is outside your age-appropriate matching group.');
  if (![7, 14].includes(durationDays)) throw new ActionError('Choose 7 or 14 days.');
  const open = data.battles.filter((b) => b.status === 'active' || b.status === 'pending-acceptance' || b.status === 'invited');
  if (open.some((b) => b.opponentId === opponentId)) throw new ActionError(`You already have an open battle with ${o.username}.`);
  if (open.filter((b) => b.status === 'active' || b.status === 'pending-acceptance').length >= 2) throw new ActionError('You can run up to 2 battles at a time — finish one first.');
  const b: Battle = {
    id: newId('btl'),
    status: 'pending-acceptance',
    createdAt: env.nowIso,
    initiatedBy: 'me',
    opponentId,
    sharedGoal: profile.primaryGoal,
    durationDays,
    startDate: null,
    endDate: null,
    participants: [
      { id: 'me', username: profile.displayName, avatar: profile.avatar, isDemo: false },
      { id: o.id, username: o.username, avatar: o.avatar, isDemo: true },
    ],
  };
  return ok({ ...data, battles: [b, ...data.battles] }, [{ kind: 'success', message: `Challenge sent to ${o.username} (demo user).` }]);
}

export function startBattle(b: Battle, today: DateKey): Battle {
  return { ...b, status: 'active', startDate: today, endDate: addDays(today, b.durationDays - 1) };
}

export function acceptInvite(data: UserData, env: Env, battleId: string): ActionResult {
  const b = data.battles.find((x) => x.id === battleId);
  if (!b || b.status !== 'invited') throw new ActionError('This invitation is no longer available.');
  const active = data.battles.filter((x) => x.status === 'active' || x.status === 'pending-acceptance').length;
  if (active >= 2) throw new ActionError('You can run up to 2 battles at a time.');
  return ok({ ...data, battles: data.battles.map((x) => (x.id === battleId ? startBattle(x, env.today) : x)) }, [{ kind: 'success', message: 'Battle accepted — it starts today!' }]);
}

export function declineInvite(data: UserData, _env: Env, battleId: string): ActionResult {
  return ok({ ...data, battles: data.battles.map((x) => (x.id === battleId && x.status === 'invited' ? { ...x, status: 'declined' as const } : x)) }, [{ kind: 'info', message: 'Invitation declined.' }]);
}

export function cancelBattle(data: UserData, _env: Env, battleId: string): ActionResult {
  const b = data.battles.find((x) => x.id === battleId);
  if (!b || b.status !== 'pending-acceptance') throw new ActionError('Only pending challenges can be cancelled.');
  return ok({ ...data, battles: data.battles.map((x) => (x.id === battleId ? { ...x, status: 'cancelled' as const } : x)) }, [{ kind: 'info', message: 'Challenge cancelled.' }]);
}

// ---------------------------------------------------------------------------
// Notifications, settings, checklist, coach
// ---------------------------------------------------------------------------

export const markRead = (data: UserData, _env: Env, id: string) => ok({ ...data, notifications: data.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) });
export const markAllRead = (data: UserData) => ok({ ...data, notifications: data.notifications.map((n) => ({ ...n, read: true })) });
export const clearNotifications = (data: UserData) => ok({ ...data, notifications: data.notifications.filter((n) => !n.read) }, [{ kind: 'info', message: 'Read notifications cleared.' }]);

export function updateSettings(data: UserData, _env: Env, patch: Partial<AppSettings>): ActionResult {
  if (patch.devDayOffset !== undefined && (patch.devDayOffset < 0 || patch.devDayOffset > 365)) throw new ActionError('Offset must be 0–365 days.');
  return ok({ ...data, settings: { ...data.settings, ...patch } });
}

export function toggleChecklist(data: UserData, env: Env, itemId: string): ActionResult {
  const cur = data.checklist[env.today] ?? [];
  const next = cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId];
  return ok({ ...data, checklist: { ...data.checklist, [env.today]: next } });
}

export function sendCoach(data: UserData, env: Env, text: string): ActionResult {
  const t = text.trim().slice(0, 500);
  if (!t) throw new ActionError('Type a question first.');
  const ctxS = data.plan ? scheduleCtx(data, env.today) : null;
  const ctx: CoachContext = {
    profile: data.profile,
    plan: data.plan,
    today: env.today,
    todayWorkout: data.plan ? plannedWorkoutFor(data, env.today, env.today) : null,
    nextWorkout: data.plan ? nextTraining(data, env.today) : null,
    streak: ctxS ? streakSummary(ctxS) : null,
    overdue: ctxS ? sessionsNeedingAttention(ctxS) : [],
    useProfile: data.settings.coachUsesProfile,
  };
  const reply = coachReply(t, ctx);
  const user = { id: newId('msg'), role: 'user' as const, text: t, at: env.nowIso };
  const coach = { id: newId('msg'), role: 'coach' as const, text: reply.text, at: env.nowIso, links: reply.links, urgent: reply.urgent };
  return ok({ ...data, coach: [...data.coach, user, coach].slice(-100) });
}

export const clearCoach = (data: UserData) => ok({ ...data, coach: [] });
