import { OPPONENT_MAP } from '../data/demoOpponents';
import type { Battle, BattleScoreBreakdown, DateKey, RecoveryToken, Workout, WorkoutSession } from '../domain/types';
import { volumeReady } from '../services/analytics';
import { demoActivity, scoreParticipant, type ActivityProvider } from '../services/battle';
import { addDays, toDateKey } from '../services/dates';
import { dayTotal, hydrationTarget, type HydrationTarget } from '../services/hydration';
import { blockComplete } from '../services/session';
import { dayStatus, templateForDate, type ScheduleContext } from '../services/schedule';
import { generateWorkout } from '../services/workoutGenerator';
import type { UserData } from './userData';

export const DAY_MS = 86_400_000;

/** App clock — honours the development-only day offset used to simulate time passing. */
export function nowMs(data: Pick<UserData, 'settings'>): number {
  return Date.now() + (data.settings?.devDayOffset ?? 0) * DAY_MS;
}

export function todayKey(data: Pick<UserData, 'settings'>): DateKey {
  return toDateKey(new Date(nowMs(data)));
}

export function scheduleCtx(data: UserData, today: DateKey): ScheduleContext | null {
  if (!data.plan) return null;
  return { plan: data.plan, sessions: data.sessions, overrides: data.overrides, today };
}

export function plannedSessionId(date: DateKey) {
  return `s-${date}`;
}
export function comebackSessionId(date: DateKey) {
  return `cb-${date}`;
}
export function mobilitySessionId(date: DateKey) {
  return `mob-${date}`;
}

export function findSession(data: UserData, id: string): WorkoutSession | undefined {
  return data.sessions.find((s) => s.id === id);
}

/** The planned workout for a date (session snapshot if one exists, else freshly generated). */
export function plannedWorkoutFor(data: UserData, date: DateKey, today: DateKey): Workout | null {
  if (!data.profile || !data.plan) return null;
  const existing = findSession(data, plannedSessionId(date));
  if (existing) return existing.workout;
  const tpl = templateForDate(data.plan, date);
  if (!tpl) return null;
  const ctx = scheduleCtx(data, today)!;
  return generateWorkout(data.profile, data.plan, date, tpl, { progressions: data.progressions, volumeReady: volumeReady(ctx) });
}

export function availableTokens(tokens: RecoveryToken[]): RecoveryToken[] {
  return tokens.filter((t) => !t.usedOn);
}

export function hydrationTargetFor(data: UserData, date: DateKey): HydrationTarget | null {
  if (!data.profile || !data.plan) return null;
  const trains = Boolean(templateForDate(data.plan, date));
  return hydrationTarget(data.profile, data.hydrationSettings, trains ? data.profile.dailyMinutes : 0);
}

export function hydrationMet(data: UserData, date: DateKey): boolean {
  const t = hydrationTargetFor(data, date);
  if (!t || t.isLimit) return false; // never reward reaching a medical limit
  return dayTotal(data.hydration, date) >= t.ml;
}

export function foodLoggedSlots(data: UserData, date: DateKey): number {
  return new Set(data.foodLog.filter((e) => e.date === date).map((e) => e.slot)).size;
}

export function sleepLogged(data: UserData, date: DateKey): boolean {
  return data.progress.some((p) => p.date === date && p.sleepHours !== undefined);
}

export function mobilityDoneOn(data: UserData, date: DateKey): boolean {
  return data.sessions.some((s) => s.kind === 'mobility' && s.status === 'completed' && s.performedDate === date);
}

export function myActivity(data: UserData, today: DateKey): ActivityProvider {
  const ctx = scheduleCtx(data, today)!;
  const planned = (d: DateKey) => data.sessions.find((s) => s.kind === 'planned' && s.plannedDate === d && s.status === 'completed');
  return {
    status: (d) => dayStatus(ctx, d),
    warmupDone: (d) => {
      const s = planned(d);
      return Boolean(s && blockComplete(s, 'warmup'));
    },
    mobilityDone: (d) => mobilityDoneOn(data, d),
    hydrationMet: (d) => hydrationMet(data, d),
    foodLogged: (d) => foodLoggedSlots(data, d) >= 2,
    ratedAllSets: (d) => {
      const s = planned(d);
      if (!s) return false;
      return s.workout.exercises.filter((w) => w.block === 'main').every((w) => s.progress[w.id].sets.length > 0 && s.progress[w.id].sets.every((x) => x.rating !== undefined));
    },
  };
}

export function battleScores(data: UserData, b: Battle, today: DateKey): { me: BattleScoreBreakdown; opp: BattleScoreBreakdown } | null {
  if (!data.plan || !b.startDate) return null;
  const me = scoreParticipant('me', b, myActivity(data, today), today);
  const o = OPPONENT_MAP[b.opponentId];
  const opp = scoreParticipant(b.opponentId, b, demoActivity(o, b.id), today);
  return { me, opp };
}

export function activeBattle(data: UserData): Battle | undefined {
  return data.battles.find((b) => b.status === 'active');
}

export function unreadCount(data: UserData): number {
  return data.notifications.filter((n) => !n.read).length;
}

/** Next training day on/after tomorrow, with its workout. */
export function nextTraining(data: UserData, today: DateKey): { date: DateKey; workout: Workout } | null {
  if (!data.plan) return null;
  for (let i = 1; i <= 14; i++) {
    const d = addDays(today, i);
    const w = plannedWorkoutFor(data, d, today);
    if (w) return { date: d, workout: w };
  }
  return null;
}
