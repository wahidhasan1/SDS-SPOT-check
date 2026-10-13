import { describe, expect, it } from 'vitest';
import type { UserProfile, Weekday } from '../domain/types';
import { makeProfile } from '../test/fixtures';
import { totalXp } from '../services/xp';
import * as A from './actions';
import { DemoAuth } from './auth';
import { plannedSessionId, scheduleCtx } from './selectors';
import { MemoryAdapter } from './storage';
import { runSync } from './sync';
import { emptyUserData, loadUserData, saveUserData, type UserData } from './userData';
import { dayStatus, streakSummary } from '../services/schedule';

const MON = '2026-10-12';
const env = (today: string, minute = 0): A.Env => ({ today, nowIso: new Date(Date.parse(`${today}T08:00:00.000Z`) + minute * 60000).toISOString(), userId: 'u1' });

function apply(_d: UserData, r: A.ActionResult, e: A.Env): UserData {
  return runSync(r.data, e).data;
}

function onboarded(over: Partial<UserProfile> = {}): UserData {
  const p = makeProfile({ trainingDays: [1, 3, 5] as Weekday[], ...over });
  const e = env(MON);
  return apply(emptyUserData(), A.completeOnboarding(emptyUserData(), e, p), e);
}

function doWorkout(d: UserData, date: string, today = date): UserData {
  const e0 = env(today, 0);
  d = apply(d, A.startPlanned(d, e0, date), e0);
  const id = plannedSessionId(date);
  const s = d.sessions.find((x) => x.id === id)!;
  for (const we of s.workout.exercises) {
    if (we.block === 'main') {
      for (let i = 0; i < we.sets; i++) d = A.logSet(d, e0, id, we.id, we.reps ? { repsDone: we.reps[1], rating: 2 } : { secondsDone: we.seconds, rating: 2 }).data;
    } else d = A.markDone(d, e0, id, we.id).data;
  }
  const e1 = env(today, 20);
  return apply(d, A.finishWorkout(d, e1, id), e1);
}

describe('onboarding → plan', () => {
  it('rejects incomplete profiles', () => {
    expect(() => A.completeOnboarding(emptyUserData(), env(MON), { age: 30 })).toThrow(A.ActionError);
  });
  it('creates a plan, a starter recovery token, a welcome notification and a demo invite', () => {
    const d = onboarded();
    expect(d.plan).not.toBeNull();
    expect(d.tokens).toHaveLength(1);
    expect(d.notifications.some((n) => n.key === 'welcome')).toBe(true);
    expect(d.battles.some((b) => b.status === 'invited')).toBe(true);
  });
});

describe('workout completion & rewards', () => {
  it('awards XP once, unlocks First Workout and counts toward the streak', () => {
    let d = doWorkout(onboarded(), MON);
    const s = d.sessions.find((x) => x.id === plannedSessionId(MON))!;
    expect(s.status).toBe('completed');
    expect(d.xp.find((x) => x.key === `workout:${MON}`)?.amount).toBe(100);
    expect(d.xp.some((x) => x.key === `warmup:${MON}`)).toBe(true);
    expect(d.achievements.some((a) => a.achievementId === 'first-workout')).toBe(true);
    const before = totalXp(d.xp);
    expect(() => A.finishWorkout(d, env(MON, 30), plannedSessionId(MON))).toThrow(/already completed/);
    expect(() => A.startPlanned(d, env(MON, 30), MON)).toThrow(/already completed/);
    d = runSync(runSync(d, env(MON, 40)).data, env(MON, 50)).data;
    expect(totalXp(d.xp)).toBe(before);
    expect(streakSummary(scheduleCtx(d, MON)!).current).toBe(1);
  });
  it('blocks future sessions and a second full workout on the same day', () => {
    let d = onboarded();
    expect(() => A.startPlanned(d, env(MON), '2026-10-14')).toThrow(/future/);
    // Miss Monday, do Wednesday on Wednesday; Monday is no longer in its window anyway.
    d = doWorkout(d, '2026-10-14');
    // Late completion of Monday on Tuesday is fine (if nothing done Tuesday)…
    const d2 = doWorkout(onboarded(), MON, '2026-10-13');
    expect(dayStatus(scheduleCtx(d2, '2026-10-13')!, MON)).toBe('completed');
    // …but not if a full workout was already done that day: on Wednesday, after
    // Wednesday's session, the still-overdue Monday session cannot be stacked on top.
    const d3 = doWorkout(onboarded(), '2026-10-14');
    expect(dayStatus(scheduleCtx(d3, '2026-10-14')!, MON)).toBe('overdue');
    expect(() => A.startPlanned(d3, env('2026-10-14', 30), MON)).toThrow(/already completed a full workout today/);
  });
  it('a session opened then abandoned does not count', () => {
    let d = onboarded();
    d = A.startPlanned(d, env(MON), MON).data;
    d = A.finishWorkout(d, env(MON, 1), plannedSessionId(MON)).data;
    expect(d.sessions[0].status).toBe('ended-early');
    expect(d.xp.some((x) => x.key.startsWith('workout:'))).toBe(false);
  });
});

describe('missed sessions & recovery', () => {
  it('uses a recovery token once and protects the streak', () => {
    let d = onboarded();
    const e = env('2026-10-13');
    d = apply(d, A.resolveDay(d, e, MON, 'token'), e);
    expect(dayStatus(scheduleCtx(d, '2026-10-13')!, MON)).toBe('protected');
    expect(d.tokens.filter((t) => !t.usedOn)).toHaveLength(0);
    expect(() => A.resolveDay(d, e, MON, 'token')).toThrow();
  });
  it('comeback session resolves the missed day with comeback XP', () => {
    let d = onboarded();
    const e = env('2026-10-13');
    d = apply(d, A.startComeback(d, e, MON, 'comeback-mobility'), e);
    const id = `cb-${MON}`;
    const s = d.sessions.find((x) => x.id === id)!;
    for (const we of s.workout.exercises) {
      if (we.block === 'main') for (let i = 0; i < we.sets; i++) d = A.logSet(d, e, id, we.id, { repsDone: 8, secondsDone: 30 }).data;
    }
    const e2 = env('2026-10-13', 15);
    d = apply(d, A.finishWorkout(d, e2, id), e2);
    expect(dayStatus(scheduleCtx(d, '2026-10-13')!, MON)).toBe('comeback');
    expect(d.xp.some((x) => x.key === `comeback:${MON}`)).toBe(true);
    expect(d.achievements.some((a) => a.achievementId === 'comeback-champion')).toBe(true);
  });
  it('marking unwell never counts as failure, even after the window', () => {
    let d = onboarded();
    d = A.resolveDay(d, env('2026-10-13'), MON, 'unwell').data;
    expect(dayStatus(scheduleCtx(d, '2026-10-20')!, MON)).toBe('excused');
  });
  it('changing the schedule preserves past history', () => {
    let d = doWorkout(onboarded(), MON);
    const e = env('2026-10-13');
    d = apply(d, A.changeTrainingDays(d, e, [2, 4, 6] as Weekday[]), e);
    const ctx = scheduleCtx(d, '2026-10-13')!;
    expect(dayStatus(ctx, MON)).toBe('completed');
    expect(dayStatus(ctx, '2026-10-13')).toBe('scheduled'); // Tuesday now a training day
    expect(dayStatus(ctx, '2026-10-14')).toBe('rest');
  });
});

describe('habits & battles', () => {
  it('hydration XP only when the target is reached, once per day', () => {
    let d = onboarded();
    const e = env(MON);
    for (let i = 0; i < 10; i++) d = apply(d, A.addWater(d, e, 250), e);
    expect(d.xp.filter((x) => x.key === `hydration:${MON}`)).toHaveLength(1);
    expect(() => A.addWater(d, e, 0)).toThrow();
    const id = d.hydration[0].id;
    d = A.editWater(d, e, id, 300).data;
    expect(d.hydration[0].ml).toBe(300);
    d = A.removeWater(d, e, id).data;
    expect(d.hydration).toHaveLength(9);
  });
  it('rejects meals that conflict with allergies', () => {
    const d = onboarded({ allergies: ['fish'] });
    expect(() => A.selectMeal(d, env(MON), MON, 'lunch', 'l-rice-rui-dal')).toThrow(/diet or allergy/);
  });
  it('battle invitation → accept → scoring → result', () => {
    let d = onboarded();
    const inv = d.battles.find((b) => b.status === 'invited')!;
    d = apply(d, A.acceptInvite(d, env(MON), inv.id), env(MON));
    expect(d.battles.find((b) => b.id === inv.id)!.status).toBe('active');
    d = doWorkout(d, MON);
    d = doWorkout(d, '2026-10-14');
    d = doWorkout(d, '2026-10-16');
    const e = env('2026-10-19');
    d = runSync(d, e).data;
    const b = d.battles.find((x) => x.id === inv.id)!;
    expect(b.status).toBe('completed');
    const me = b.result!.scores.find((s) => s.participantId === 'me')!;
    expect(me.sessionPoints).toBe(60);
    expect(me.total).toBeLessThanOrEqual(100);
    expect(d.notifications.some((n) => n.key === `result:${inv.id}`)).toBe(true);
    // Results are frozen: re-syncing never re-awards or changes them.
    const again = runSync(d, env('2026-10-25')).data;
    expect(again.battles.find((x) => x.id === inv.id)!.result).toEqual(b.result);
  });
  it('demo challenges sent by the user are accepted after a short delay', () => {
    let d = onboarded();
    d = A.createBattle(d, env(MON), 'demo-tanvir', 7).data;
    expect(d.battles[0].status).toBe('pending-acceptance');
    expect(() => A.createBattle(d, env(MON), 'demo-tanvir', 7)).toThrow(/already/);
    d = runSync(d, env(MON, 1)).data;
    expect(d.battles.find((b) => b.opponentId === 'demo-tanvir')!.status).toBe('active');
  });
  it('rejects age-inappropriate matches', () => {
    const d = onboarded({ age: 16 });
    expect(() => A.createBattle(d, env(MON), 'demo-omar', 7)).toThrow(/age/);
  });
});

describe('persistence & auth', () => {
  it('persists slices and reloads identical data', () => {
    const store = new MemoryAdapter();
    const d = doWorkout(onboarded(), MON);
    saveUserData(store, 'u1', null, d);
    expect(loadUserData(store, 'u1')).toEqual(d);
  });
  it('demo auth hashes passwords, rejects wrong ones and isolates/deletes user data', async () => {
    const store = new MemoryAdapter();
    const auth = new DemoAuth(store);
    const u = await auth.signUp('a@b.co', 'secret123', 'Ana');
    expect(JSON.stringify(store.get('users'))).not.toContain('secret123');
    await expect(auth.signUp('a@b.co', 'secret123', 'Ana')).rejects.toThrow(/exists/);
    await expect(auth.signIn('a@b.co', 'wrongpass1')).rejects.toThrow(/incorrect/);
    expect((await auth.signIn('A@B.co', 'secret123')).id).toBe(u.id);
    await expect(auth.signUp('bad', 'secret123', 'X')).rejects.toThrow();
    await expect(auth.signUp('c@d.co', 'short', 'Cy')).rejects.toThrow(/8 characters/);
    saveUserData(store, u.id, null, onboarded());
    const other = await auth.signUp('z@z.co', 'secret123', 'Zed');
    expect(loadUserData(store, other.id).profile).toBeNull();
    auth.deleteAccount(u.id);
    expect(store.keys(`u:${u.id}:`)).toHaveLength(0);
  });
});
