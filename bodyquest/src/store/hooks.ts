import { useMemo } from 'react';
import type { MealSlot } from '../domain/types';
import { dayTotal } from '../services/hydration';
import { energyGuidance, logTotals, resolveMeal } from '../services/nutrition';
import { dayStatus, nextRestDay, sessionsNeedingAttention, streakSummary, templateForDate } from '../services/schedule';
import { levelFor, totalXp } from '../services/xp';
import { useApp } from './AppStore';
import { activeBattle, availableTokens, battleScores, findSession, hydrationTargetFor, nextTraining, plannedSessionId, plannedWorkoutFor, scheduleCtx } from './selectors';
import { missionProgress } from './sync';
import { SLOTS } from '../data/meals';

/** Commonly needed derived values, memoised per data change. */
export function useDerived() {
  const { data, today } = useApp();
  return useMemo(() => {
    const ctx = scheduleCtx(data, today)!;
    const profile = data.profile!;
    const plan = data.plan!;
    const todayTemplate = templateForDate(plan, today);
    const movedHere = Object.values(data.overrides).filter((o) => o.resolution === 'rescheduled' && o.movedTo === today).map((o) => o.date);
    const todayWorkout = plannedWorkoutFor(data, today, today);
    const todaySession = findSession(data, plannedSessionId(today));
    const xp = totalXp(data.xp);
    const target = hydrationTargetFor(data, today);
    const meals = Object.fromEntries(SLOTS.map((s) => [s, resolveMeal(today, s, data.mealDays[today]?.selections[s], profile)])) as Record<MealSlot, ReturnType<typeof resolveMeal>>;
    const battle = activeBattle(data);
    return {
      ctx,
      profile,
      plan,
      todayTemplate,
      todayStatus: dayStatus(ctx, today),
      movedHere,
      todayWorkout,
      todaySession,
      streak: streakSummary(ctx),
      overdue: sessionsNeedingAttention(ctx),
      nextRest: nextRestDay(ctx, today),
      next: nextTraining(data, today),
      xp,
      level: levelFor(xp),
      tokens: availableTokens(data.tokens),
      hydration: { target, total: dayTotal(data.hydration, today) },
      food: { totals: logTotals(data.foodLog.filter((e) => e.date === today)), guidance: energyGuidance(profile), meals },
      battle,
      battleScore: battle ? battleScores(data, battle, today) : null,
      missions: missionProgress(data, today),
    };
  }, [data, today]);
}
