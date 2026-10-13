import type {
  DateKey,
  DayOverride,
  DayStatus,
  SessionTemplateId,
  StreakSummary,
  TrainingPlan,
  UserProfile,
  WorkoutSession,
} from '../domain/types';
import { addDays, diffDays, rangeDays, startOfWeek, weekdayOf } from './dates';
import { isHardTemplate } from './plan';
import { TEMPLATES } from './workoutGenerator';

/**
 * STREAK & SCHEDULE RULES (also displayed in the app on the Streak Calendar page)
 *
 *  1. Your streak counts consecutive *planned sessions kept* — not calendar days.
 *  2. Scheduled rest days are neutral: they never add to or break a streak.
 *  3. A planned session is "kept" when you complete it (on its day or late within
 *     the window), complete an approved comeback session for it, or use a recovery token.
 *  4. Marking a day as "unwell / medical rest" excuses the session: it never counts as
 *     a failure and never breaks a streak.
 *  5. A rescheduled session counts when completed on its new date.
 *  6. Each planned session can be resolved up to RESOLVE_WINDOW_DAYS days after its date.
 *     After that, an unresolved session is "missed" and the current streak resets
 *     (your longest streak and all history are kept).
 *  7. At most one full (hard) workout per calendar day — you never have to double up.
 */

export const RESOLVE_WINDOW_DAYS = 2;
export const RESCHEDULE_LOOKAHEAD_DAYS = 3;

export interface ScheduleContext {
  plan: TrainingPlan;
  sessions: WorkoutSession[];
  overrides: Record<DateKey, DayOverride>;
  today: DateKey;
}

export function templateForDate(plan: TrainingPlan, date: DateKey): SessionTemplateId | undefined {
  if (diffDays(date, plan.startDate) < 0) return undefined;
  const hist = plan.scheduleHistory?.length ? plan.scheduleHistory : [{ from: plan.startDate, weekTemplate: plan.weekTemplate }];
  let tpl = hist[0].weekTemplate;
  for (const h of hist) if (diffDays(date, h.from) >= 0) tpl = h.weekTemplate;
  return tpl[weekdayOf(date)];
}

export function completedPlannedSession(ctx: ScheduleContext, plannedDate: DateKey): WorkoutSession | undefined {
  return ctx.sessions.find((s) => s.kind === 'planned' && s.plannedDate === plannedDate && s.status === 'completed');
}

export function completedComeback(ctx: ScheduleContext, plannedDate: DateKey): WorkoutSession | undefined {
  return ctx.sessions.find((s) => s.kind === 'comeback' && s.plannedDate === plannedDate && s.status === 'completed');
}

/** Sessions moved into this date from elsewhere. */
export function movedInto(ctx: ScheduleContext, date: DateKey): DayOverride[] {
  return Object.values(ctx.overrides).filter((o) => o.resolution === 'rescheduled' && o.movedTo === date);
}

export function dayStatus(ctx: ScheduleContext, date: DateKey): DayStatus {
  const { plan, today } = ctx;
  if (diffDays(date, plan.startDate) < 0) return 'before-plan';
  const tpl = templateForDate(plan, date);
  if (!tpl) return 'rest';
  if (completedPlannedSession(ctx, date)) return 'completed';
  const o = ctx.overrides[date];
  if (o) {
    switch (o.resolution) {
      case 'unwell':
        return 'excused';
      case 'token':
        return 'protected';
      case 'comeback':
        if (completedComeback(ctx, date)) return 'comeback';
        return diffDays(today, date) <= RESOLVE_WINDOW_DAYS ? 'overdue' : 'missed';
      case 'acknowledged-missed':
        return 'missed';
      case 'rescheduled': {
        const to = o.movedTo!;
        const age = diffDays(today, to);
        if (age < 0 || age === 0) return 'rescheduled';
        return age <= 1 ? 'rescheduled' : 'missed';
      }
    }
  }
  const age = diffDays(today, date);
  if (age <= 0) return 'scheduled';
  return age <= RESOLVE_WINDOW_DAYS ? 'overdue' : 'missed';
}

const KEPT: DayStatus[] = ['completed', 'comeback', 'protected'];

export function streakSummary(ctx: ScheduleContext): StreakSummary {
  const { plan, today } = ctx;
  let current = 0;
  let longest = 0;
  if (diffDays(today, plan.startDate) >= 0) {
    for (const d of rangeDays(plan.startDate, today)) {
      const st = dayStatus(ctx, d);
      if (KEPT.includes(st)) {
        current++;
        longest = Math.max(longest, current);
      } else if (st === 'missed') {
        current = 0;
      }
    }
  }
  const w = weekProgress(ctx, today);
  return { current, longest, weeklyCompletionPct: w.pct, weekScheduled: w.due, weekKept: w.kept };
}

/** Planned sessions in the week containing `date`: kept vs. due so far (excused excluded). */
export function weekProgress(ctx: ScheduleContext, date: DateKey): { kept: number; due: number; total: number; pct: number } {
  const start = startOfWeek(date);
  let kept = 0;
  let due = 0;
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const st = dayStatus(ctx, d);
    if (st === 'rest' || st === 'before-plan' || st === 'excused') continue;
    total++;
    if (KEPT.includes(st)) {
      kept++;
      due++;
    } else if (st === 'missed' || st === 'overdue' || (st === 'rescheduled' && diffDays(ctx.today, d) > 0)) {
      due++;
    }
  }
  return { kept, due, total, pct: due === 0 ? (kept > 0 ? 100 : 0) : Math.round((kept / due) * 100) };
}

/** Past planned sessions that still need a decision (within the window). */
export function sessionsNeedingAttention(ctx: ScheduleContext): DateKey[] {
  const out: DateKey[] = [];
  for (let i = RESOLVE_WINDOW_DAYS; i >= 1; i--) {
    const d = addDays(ctx.today, -i);
    if (dayStatus(ctx, d) === 'overdue') out.push(d);
  }
  return out;
}

/** True if a full (hard or moderate) workout was already completed on this calendar day. */
export function workoutDoneOn(ctx: ScheduleContext, date: DateKey): boolean {
  return ctx.sessions.some(
    (s) => s.status === 'completed' && s.performedDate === date && (s.kind === 'planned') && s.workout.intensity !== 'light',
  );
}

export interface RescheduleOption {
  date: DateKey;
  ok: boolean;
  reason: string;
}

/**
 * Rest days in the next few days onto which a missed session may be moved without
 * stacking hard sessions that train the same muscles on consecutive days.
 */
export function rescheduleOptions(ctx: ScheduleContext, missedDate: DateKey, profile: Pick<UserProfile, 'experience'>): RescheduleOption[] {
  const tpl = templateForDate(ctx.plan, missedDate);
  if (!tpl) return [];
  const out: RescheduleOption[] = [];
  for (let i = 0; i <= RESCHEDULE_LOOKAHEAD_DAYS; i++) {
    const d = addDays(ctx.today, i);
    const own = templateForDate(ctx.plan, d);
    if (own) {
      continue; // only rest days are candidates — never two planned sessions on one day
    }
    if (movedInto(ctx, d).length) {
      out.push({ date: d, ok: false, reason: 'Another session is already moved to this day.' });
      continue;
    }
    if (i === 0 && workoutDoneOn(ctx, d)) {
      out.push({ date: d, ok: false, reason: 'You already completed a workout today.' });
      continue;
    }
    const neighbours = [addDays(d, -1), addDays(d, 1)]
      .map((n) => templateForDate(ctx.plan, n) ?? movedInto(ctx, n).map((o) => templateForDate(ctx.plan, o.date))[0])
      .filter((t): t is SessionTemplateId => Boolean(t));
    const clash = isHardTemplate(tpl) && neighbours.some((n) => isHardTemplate(n) && overlaps(tpl, n));
    if (clash && profile.experience === 'beginner') {
      out.push({ date: d, ok: false, reason: 'Would put hard sessions for the same muscles on back-to-back days.' });
      continue;
    }
    out.push({
      date: d,
      ok: true,
      reason: clash ? 'Allowed, but expect some fatigue: a neighbouring day trains similar muscles.' : 'Rest day with enough recovery either side.',
    });
  }
  return out;
}

function overlaps(a: SessionTemplateId, b: SessionTemplateId): boolean {
  const fa = TEMPLATES[a].focus;
  const fb = TEMPLATES[b].focus;
  if (fa === 'mobility' || fb === 'mobility') return false;
  return fa === 'full' || fb === 'full' || fa === fb;
}

export interface CalendarDay {
  date: DateKey;
  status: DayStatus;
  template?: SessionTemplateId;
  movedIn: DayOverride[];
  isToday: boolean;
}

export function buildCalendar(ctx: ScheduleContext, from: DateKey, to: DateKey): CalendarDay[] {
  return rangeDays(from, to).map((date) => ({
    date,
    status: dayStatus(ctx, date),
    template: templateForDate(ctx.plan, date),
    movedIn: movedInto(ctx, date),
    isToday: date === ctx.today,
  }));
}

/** Next scheduled rest day on/after `from` (within 14 days). */
export function nextRestDay(ctx: ScheduleContext, from: DateKey): DateKey | null {
  for (let i = 0; i < 14; i++) {
    const d = addDays(from, i);
    if (!templateForDate(ctx.plan, d) && movedInto(ctx, d).length === 0) return d;
  }
  return null;
}

/** Perfect weeks (every due session kept, ≥1 session) that have fully ended before today. */
export function perfectWeeks(ctx: ScheduleContext): DateKey[] {
  const out: DateKey[] = [];
  let w = startOfWeek(ctx.plan.startDate);
  while (diffDays(ctx.today, addDays(w, 6)) > 0) {
    const p = weekProgress({ ...ctx, today: addDays(w, 7 + RESOLVE_WINDOW_DAYS) }, w);
    // A week counts only if it was fully inside the plan.
    if (diffDays(w, ctx.plan.startDate) >= 0 && p.total > 0 && p.kept === p.total) out.push(w);
    w = addDays(w, 7);
  }
  return out;
}
