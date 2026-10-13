import { ACHIEVEMENTS, DAILY_MISSIONS, WEEKLY_MISSIONS } from '../data/achievements';
import { OPPONENT_MAP } from '../data/demoOpponents';
import type { Achievement, DateKey, MissionProgress } from '../domain/types';
import { EXERCISE_MAP } from '../data/exercises';
import { sessionsCompleted } from '../services/analytics';
import { decideResult, demoActivity, findMatches, isBattleOver } from '../services/battle';
import { addDays, diffDays, formatDate, startOfWeek } from '../services/dates';
import { dayStatus, perfectWeeks, sessionsNeedingAttention, streakSummary, templateForDate, weekProgress } from '../services/schedule';
import { blockComplete } from '../services/session';
import { levelFor, totalXp, XP } from '../services/xp';
import { giveXp, notify, startBattle, type AppEvent, type Env } from './actions';
import { battleScores, foodLoggedSlots, hydrationMet, mobilityDoneOn, scheduleCtx, sleepLogged } from './selectors';
import { newId } from './storage';
import type { UserData } from './userData';

/**
 * Derived-state synchronisation. Runs after every action, on load and on a timer.
 * Every step is idempotent (keyed XP, keyed notifications), so running it repeatedly is
 * safe and can never double-award anything.
 */

export const DEMO_ACCEPT_DELAY_MS = 6000;
const MAX_TOKENS_HELD = 3;

export function missionProgress(data: UserData, today: DateKey): { daily: MissionProgress[]; weekly: MissionProgress[] } {
  if (!data.plan) return { daily: [], weekly: [] };
  const ctx = scheduleCtx(data, today)!;
  const training = Boolean(templateForDate(data.plan, today));
  const planned = data.sessions.find((s) => s.kind === 'planned' && s.plannedDate === today);
  const claimed = (key: string) => data.xp.some((x) => x.key === key);
  const daily = DAILY_MISSIONS[training ? 'training' : 'rest'].map((m) => {
    let progress = 0;
    switch (m.id) {
      case 'd-warmup':
        progress = planned && blockComplete(planned, 'warmup') ? 1 : 0;
        break;
      case 'd-workout':
        progress = dayStatus(ctx, today) === 'completed' ? 1 : 0;
        break;
      case 'd-hydration':
        progress = hydrationMet(data, today) ? 1 : 0;
        break;
      case 'd-rest-mobility':
        progress = mobilityDoneOn(data, today) ? 1 : 0;
        break;
      case 'd-sleep':
        progress = sleepLogged(data, today) ? 1 : 0;
        break;
      case 'd-food':
        progress = foodLoggedSlots(data, today);
        break;
    }
    return { mission: m, progress: Math.min(progress, m.target), complete: progress >= m.target, claimed: claimed(`mission:${m.id}:${today}`) };
  });
  const ws = startOfWeek(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i)).filter((d) => diffDays(d, today) <= 0);
  const wp = weekProgress(ctx, today);
  const weekly = WEEKLY_MISSIONS.map((m) => {
    let progress = 0;
    let target = m.target;
    switch (m.id) {
      case 'w-sessions':
        target = Math.max(1, Math.min(m.target, wp.total));
        progress = wp.kept;
        break;
      case 'w-food':
        progress = days.filter((d) => foodLoggedSlots(data, d) >= 2).length;
        break;
      case 'w-hydration':
        progress = days.filter((d) => hydrationMet(data, d)).length;
        break;
    }
    const mission = { ...m, target };
    return { mission, progress: Math.min(progress, target), complete: progress >= target, claimed: claimed(`mission:${m.id}:${ws}`) };
  });
  return { daily, weekly };
}

function achievementMet(a: Achievement, data: UserData, today: DateKey): boolean {
  const ctx = scheduleCtx(data, today);
  if (!ctx) return false;
  const completedPlanned = sessionsCompleted(data.sessions, 'planned');
  switch (a.id) {
    case 'first-workout':
      return completedPlanned >= 1;
    case 'three-day':
      return streakSummary(ctx).longest >= 3;
    case 'first-full-week':
      return perfectWeeks(ctx).length >= 1;
    case 'ten-workouts':
      return completedPlanned >= 10;
    case 'pushup-progress':
      return Object.values(data.progressions).some((p) => (p.variationId !== p.exerciseId || p.repBonus > 0) && EXERCISE_MAP[p.exerciseId]?.category === 'push');
    case 'mobility-master':
      return data.sessions.filter((s) => s.status === 'completed' && (s.kind === 'mobility' || s.workout.intensity === 'light')).length >= 5;
    case 'comeback-champion':
      return sessionsCompleted(data.sessions, 'comeback') >= 1;
    case 'monthly-consistency': {
      const since = addDays(today, -29);
      let kept = 0;
      for (let i = 0; i < 30; i++) {
        const d = addDays(since, i);
        if (['completed', 'comeback', 'protected'].includes(dayStatus(ctx, d))) kept++;
      }
      return kept >= 12;
    }
    case 'personal-record':
      return hasImprovedPerformance(data) || hasExerciseRecord(data);
    case 'warmup-pro':
      return data.sessions.filter((s) => s.kind === 'planned' && s.status === 'completed' && blockComplete(s, 'warmup')).length >= 5;
    case 'hydration-habit':
      return countDays(data, today, (d) => hydrationMet(data, d)) >= 5;
    case 'food-logger':
      return countDays(data, today, (d) => foodLoggedSlots(data, d) >= 2) >= 5;
    case 'first-battle':
      return data.battles.some((b) => b.status === 'active' || b.status === 'completed');
    case 'battle-winner':
      return data.battles.some((b) => b.result && b.result.outcome !== 'loss');
    case 'listen-to-body':
      return data.sessions.some((s) => s.symptomReport && s.symptomReport.symptoms.length > 0);
  }
  return false;
}

/** True when a completed session beat the best earlier performance of the same exercise. */
function hasExerciseRecord(data: UserData): boolean {
  const best = new Map<string, number>();
  const done = data.sessions.filter((s) => s.status === 'completed').sort((a, b) => ((a.finishedAt ?? '') < (b.finishedAt ?? '') ? -1 : 1));
  for (const s of done) {
    for (const we of s.workout.exercises) {
      if (we.block !== 'main') continue;
      const p = s.progress[we.id];
      const vals = p.sets.map((x) => x.repsDone ?? x.secondsDone ?? 0);
      if (!vals.length) continue;
      const top = Math.max(...vals);
      const prev = best.get(p.performedExerciseId);
      if (prev !== undefined && top > prev) return true;
      best.set(p.performedExerciseId, Math.max(prev ?? 0, top));
    }
  }
  return false;
}

function hasImprovedPerformance(data: UserData): boolean {
  const byKey = new Map<string, number[]>();
  for (const p of [...data.progress].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    for (const [k, v] of Object.entries(p.performance)) {
      if (v === undefined) continue;
      byKey.set(k, [...(byKey.get(k) ?? []), v]);
    }
  }
  for (const vals of byKey.values()) {
    for (let i = 1; i < vals.length; i++) if (vals[i] > Math.max(...vals.slice(0, i))) return true;
  }
  return false;
}

function countDays(data: UserData, today: DateKey, f: (d: DateKey) => boolean): number {
  if (!data.plan) return 0;
  let n = 0;
  const span = Math.min(120, Math.max(0, diffDays(today, data.plan.startDate)));
  for (let i = 0; i <= span; i++) if (f(addDays(today, -i))) n++;
  return n;
}

export function runSync(input: UserData, env: Env): { data: UserData; events: AppEvent[] } {
  let data = input;
  const events: AppEvent[] = [];
  if (!data.profile || !data.plan) return { data, events };
  const { today, nowIso } = env;
  const ctx = scheduleCtx(data, today)!;
  const levelBefore = levelFor(totalXp(data.xp)).level;

  // 1. Recovery tokens for perfect weeks (max held).
  for (const w of perfectWeeks(ctx)) {
    const reason = `Perfect week of ${formatDate(w, { month: 'short', day: 'numeric' })}`;
    if (data.tokens.some((t) => t.reason === reason)) continue;
    const held = data.tokens.filter((t) => !t.usedOn).length;
    if (held >= MAX_TOKENS_HELD) break;
    data = { ...data, tokens: [...data.tokens, { id: newId('tok'), earnedAt: nowIso, reason }] };
    data = notify(data, { kind: 'system', title: 'Recovery token earned', body: `${reason} — you earned a recovery token.`, link: '/app/streaks', key: `token:${w}` }, nowIso);
  }

  // 2. Daily habit XP (today and yesterday, idempotent keys).
  for (const d of [addDays(today, -1), today]) {
    if (hydrationMet(data, d)) data = giveXp(data, `hydration:${d}`, XP.hydration, 'Hydration target reached', env, events);
    if (foodLoggedSlots(data, d) >= 2) data = giveXp(data, `food:${d}`, XP.food, 'Meals logged', env, events);
    if (sleepLogged(data, d)) data = giveXp(data, `sleep:${d}`, XP.sleep, 'Sleep logged', env, events);
  }

  // 3. Missions (auto-claimed when complete).
  const mp = missionProgress(data, today);
  const ws = startOfWeek(today);
  for (const m of mp.daily) if (m.complete) data = giveXp(data, `mission:${m.mission.id}:${today}`, m.mission.xp, `Daily mission: ${m.mission.title}`, env, events);
  for (const m of mp.weekly) if (m.complete) data = giveXp(data, `mission:${m.mission.id}:${ws}`, m.mission.xp, `Weekly mission: ${m.mission.title}`, env, events);

  // 4. Missed-session prompts.
  for (const d of sessionsNeedingAttention(ctx)) {
    data = notify(
      data,
      { kind: 'missed-session', title: 'A session needs your decision', body: `Your ${formatDate(d)} session wasn’t completed. Choose a recovery option — no double workouts needed.`, link: '/app/streaks', key: `missed:${d}` },
      nowIso,
    );
  }

  // 5. Battles.
  const now = Date.parse(nowIso);
  data = {
    ...data,
    battles: data.battles.map((b) => (b.status === 'pending-acceptance' && now - Date.parse(b.createdAt) >= DEMO_ACCEPT_DELAY_MS ? startBattle(b, today) : b)),
  };
  for (const b of data.battles) {
    const o = OPPONENT_MAP[b.opponentId];
    if (!o) continue;
    if (b.status === 'active' && b.startDate) {
      data = notify(data, { kind: 'battle-update', title: `Battle vs ${o.username} has started`, body: `${b.durationDays}-day battle is live. Points come from keeping your own plan.`, link: `/app/battles/${b.id}`, key: `battle-start:${b.id}` }, nowIso);
      const act = demoActivity(o, b.id);
      for (const d of [addDays(today, -1), today]) {
        if (diffDays(d, b.startDate) >= 0 && diffDays(d, b.endDate!) <= 0 && d !== today && act.status(d) === 'completed') {
          data = notify(data, { kind: 'opponent-workout', title: `${o.username} completed a workout`, body: `Your demo opponent kept their planned session on ${formatDate(d)}.`, link: `/app/battles/${b.id}`, key: `opp:${b.id}:${d}` }, nowIso);
        }
      }
      const half = addDays(b.startDate, Math.floor(b.durationDays / 2));
      if (diffDays(today, half) >= 0 && !isBattleOver(b, today)) {
        data = notify(data, { kind: 'battle-update', title: 'Battle halfway point', body: `You’re halfway through your battle with ${o.username}. Check the scoreboard!`, link: `/app/battles/${b.id}`, key: `half:${b.id}` }, nowIso);
      }
      if (isBattleOver(b, today)) {
        const sc = battleScores(data, b, b.endDate!)!;
        const result = decideResult('me', [sc.me, sc.opp], nowIso);
        data = { ...data, battles: data.battles.map((x) => (x.id === b.id ? { ...x, status: 'completed' as const, result } : x)) };
        const word = result.outcome === 'win' ? 'You won' : result.outcome === 'tie' ? 'It’s a tie' : `${o.username} won`;
        data = notify(data, { kind: 'battle-result', title: `Battle result: ${word}`, body: `Final score ${sc.me.total} – ${sc.opp.total}. Every kept session counts toward your progress.`, link: `/app/battles/${b.id}`, key: `result:${b.id}` }, nowIso);
      }
    }
  }
  // Incoming demo invitation (once), if enabled.
  if (data.settings.allowBattleInvites && data.battles.length === 0 && !data.notifications.some((n) => n.key === 'invite:first')) {
    const best = findMatches(data.profile!)[0];
    if (best) {
      const o = best.opponent;
      const battle = {
        id: newId('btl'),
        status: 'invited' as const,
        createdAt: nowIso,
        initiatedBy: o.id,
        opponentId: o.id,
        sharedGoal: data.profile!.primaryGoal,
        durationDays: 7 as const,
        startDate: null,
        endDate: null,
        participants: [
          { id: 'me', username: data.profile!.displayName, avatar: data.profile!.avatar, isDemo: false },
          { id: o.id, username: o.username, avatar: o.avatar, isDemo: true },
        ],
      };
      data = { ...data, battles: [battle, ...data.battles] };
      data = notify(data, { kind: 'battle-invite', title: `${o.username} challenged you (demo)`, body: 'A 7-day consistency battle. Accept or decline in Fitness Battles.', link: '/app/battles', key: 'invite:first' }, nowIso);
    }
  }

  // 6. Achievements.
  for (const a of ACHIEVEMENTS) {
    if (data.achievements.some((u) => u.achievementId === a.id)) continue;
    if (!achievementMet(a, data, today)) continue;
    data = { ...data, achievements: [...data.achievements, { achievementId: a.id, unlockedAt: nowIso }] };
    data = giveXp(data, `achievement:${a.id}`, a.xp, `Achievement: ${a.name}`, env, events);
    data = notify(data, { kind: 'achievement', title: `Achievement unlocked: ${a.name}`, body: a.description, link: '/app/achievements', key: `ach:${a.id}` }, nowIso);
    events.push({ kind: 'achievement', message: `${a.icon} Achievement unlocked: ${a.name}` });
  }

  // 7. Level-up.
  const lv = levelFor(totalXp(data.xp));
  if (lv.level > levelBefore) {
    events.push({ kind: 'level-up', message: `Level up! You’re now level ${lv.level} — ${lv.title}.` });
  }
  if (lv.level > 1) data = notify(data, { kind: 'level-up', title: `Level ${lv.level} reached`, body: `You’re now a ${lv.title}. Keep it consistent!`, link: '/app/achievements', key: `level:${lv.level}` }, nowIso);

  return { data, events };
}
