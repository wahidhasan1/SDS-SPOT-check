import { describe, expect, it } from 'vitest';
import type { DayOverride, TrainingPlan, Weekday, WorkoutSession } from '../domain/types';
import { makeProfile } from '../test/fixtures';
import { addDays } from './dates';
import { buildPlan } from './plan';
import { dayStatus, perfectWeeks, rescheduleOptions, sessionsNeedingAttention, streakSummary, weekProgress, type ScheduleContext } from './schedule';
import { createSession } from './session';
import { generateWorkout } from './workoutGenerator';

const START = '2026-10-12'; // Monday. Training Mon/Wed/Fri.
const profile = makeProfile({ trainingDays: [1, 3, 5] as Weekday[] });
const plan: TrainingPlan = buildPlan(profile, START, 'x', 'p');

function completed(date: string, kind: WorkoutSession['kind'] = 'planned', performed = date): WorkoutSession {
  const w = generateWorkout(profile, plan, date)!;
  const s = createSession(w, kind, date, `${kind}-${date}`);
  return { ...s, status: 'completed', performedDate: performed, finishedAt: `${performed}T10:00:00Z` };
}

const ctx = (today: string, sessions: WorkoutSession[] = [], overrides: Record<string, DayOverride> = {}): ScheduleContext => ({ plan, sessions, overrides, today });

describe('day status', () => {
  it('rest days are rest; today and future training days are scheduled', () => {
    const c = ctx('2026-10-14');
    expect(dayStatus(c, '2026-10-13')).toBe('rest');
    expect(dayStatus(c, '2026-10-14')).toBe('scheduled');
    expect(dayStatus(c, '2026-10-16')).toBe('scheduled');
    expect(dayStatus(c, '2026-10-11')).toBe('before-plan');
  });
  it('an unresolved past session is overdue within the window, then missed', () => {
    expect(dayStatus(ctx('2026-10-13'), START)).toBe('overdue');
    expect(dayStatus(ctx('2026-10-14'), START)).toBe('overdue');
    expect(dayStatus(ctx('2026-10-15'), START)).toBe('missed');
  });
  it('a session completed late (within the window) still counts for its planned date', () => {
    expect(dayStatus(ctx('2026-10-13', [completed(START, 'planned', '2026-10-13')]), START)).toBe('completed');
  });
  it('opening/starting a session does not count as completion', () => {
    const w = generateWorkout(profile, plan, START)!;
    const s = { ...createSession(w, 'planned', START, 's'), status: 'in-progress' as const };
    expect(dayStatus(ctx(START, [s]), START)).toBe('scheduled');
  });
});

describe('streak calculation', () => {
  it('counts consecutive kept sessions and ignores rest days', () => {
    const sessions = [completed('2026-10-12'), completed('2026-10-14'), completed('2026-10-16'), completed('2026-10-19')];
    const s = streakSummary(ctx('2026-10-20', sessions));
    expect(s.current).toBe(4);
    expect(s.longest).toBe(4);
  });
  it('scheduled rest days never break the streak', () => {
    const s = streakSummary(ctx('2026-10-18', [completed('2026-10-12'), completed('2026-10-14'), completed('2026-10-16')]));
    expect(s.current).toBe(3); // Sat/Sun rest after Friday
  });
  it('a missed session resets the current streak but keeps the longest', () => {
    const sessions = [completed('2026-10-12'), completed('2026-10-14'), completed('2026-10-19')];
    const s = streakSummary(ctx('2026-10-20', sessions)); // Fri 16th missed
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
  });
  it('unwell days are excused (neutral), tokens and comebacks keep the streak', () => {
    const o: Record<string, DayOverride> = {
      '2026-10-14': { date: '2026-10-14', resolution: 'unwell', createdAt: '' },
      '2026-10-16': { date: '2026-10-16', resolution: 'token', createdAt: '' },
      '2026-10-19': { date: '2026-10-19', resolution: 'comeback', createdAt: '' },
    };
    const sessions = [completed('2026-10-12'), completed('2026-10-19', 'comeback', '2026-10-20')];
    const c = ctx('2026-10-20', sessions, o);
    expect(dayStatus(c, '2026-10-14')).toBe('excused');
    expect(dayStatus(c, '2026-10-16')).toBe('protected');
    expect(dayStatus(c, '2026-10-19')).toBe('comeback');
    expect(streakSummary(c).current).toBe(3);
  });
  it('a started-but-unfinished comeback becomes missed after the window', () => {
    const o = { [START]: { date: START, resolution: 'comeback' as const, createdAt: '' } };
    expect(dayStatus(ctx('2026-10-13', [], o), START)).toBe('overdue');
    expect(dayStatus(ctx('2026-10-16', [], o), START)).toBe('missed');
  });
  it('a rescheduled session counts when completed on its new day', () => {
    const o = { [START]: { date: START, resolution: 'rescheduled' as const, movedTo: '2026-10-13', createdAt: '' } };
    expect(dayStatus(ctx('2026-10-13', [], o), START)).toBe('rescheduled');
    expect(dayStatus(ctx('2026-10-13', [completed(START, 'planned', '2026-10-13')], o), START)).toBe('completed');
    expect(dayStatus(ctx('2026-10-16', [], o), START)).toBe('missed');
  });
});

describe('weekly progress & tokens', () => {
  it('computes kept / due for the week', () => {
    const w = weekProgress(ctx('2026-10-16', [completed('2026-10-12'), completed('2026-10-14')]), '2026-10-16');
    expect(w.total).toBe(3);
    expect(w.kept).toBe(2);
    expect(w.due).toBe(2); // Friday is today → not yet due
    expect(w.pct).toBe(100);
  });
  it('detects perfect weeks only after they end', () => {
    const sessions = [completed('2026-10-12'), completed('2026-10-14'), completed('2026-10-16')];
    expect(perfectWeeks(ctx('2026-10-17', sessions))).toEqual([]);
    expect(perfectWeeks(ctx('2026-10-19', sessions))).toEqual(['2026-10-12']);
  });
  it('lists sessions needing attention', () => {
    expect(sessionsNeedingAttention(ctx('2026-10-15'))).toEqual(['2026-10-14']);
  });
});

describe('rescheduling', () => {
  it('only offers rest days and blocks back-to-back hard full-body days for beginners', () => {
    const opts = rescheduleOptions(ctx('2026-10-13'), START, profile);
    // Tue 13 sits between Mon & Wed full-body days → blocked for beginners.
    const tue = opts.find((o) => o.date === '2026-10-13')!;
    expect(tue.ok).toBe(false);
    // No training day is ever offered.
    for (const o of opts) expect(['2026-10-14', '2026-10-16'].includes(o.date)).toBe(false);
  });
  it('never requires two hard workouts on one day', () => {
    const today = '2026-10-13';
    const opts = rescheduleOptions(ctx(today, [{ ...completed('2026-10-12', 'planned', today) }]), START, makeProfile({ experience: 'advanced' }));
    const t = opts.find((o) => o.date === today);
    expect(t?.ok).toBe(false);
  });
  it('lets non-beginners move to a rest day next to a hard day, with a fatigue note', () => {
    const p2 = makeProfile({ trainingDays: [1, 4] as Weekday[], experience: 'intermediate' });
    const pl = buildPlan(p2, START, 'x', 'p');
    const c: ScheduleContext = { plan: pl, sessions: [], overrides: {}, today: '2026-10-13' };
    const wed = rescheduleOptions(c, START, p2).find((o) => o.date === '2026-10-14')!;
    expect(wed.ok).toBe(true);
    expect(wed.reason).toMatch(/fatigue/);
    // the beginner version of the same schedule blocks it
    const pb = makeProfile({ trainingDays: [1, 4] as Weekday[] });
    const cb: ScheduleContext = { plan: buildPlan(pb, START, 'x', 'p'), sessions: [], overrides: {}, today: '2026-10-13' };
    expect(rescheduleOptions(cb, START, pb).find((o) => o.date === '2026-10-14')!.ok).toBe(false);
    void addDays;
  });
});
