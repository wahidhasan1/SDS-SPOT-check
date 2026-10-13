import type { XpEvent } from '../domain/types';

/**
 * XP RULES — every award has an idempotency key so the same activity can only ever be
 * rewarded once (no farming by re-marking things complete).
 *
 *  Activity                                  XP      Key / limit
 *  Planned workout completed (≥70% sets)     50–100  workout:<plannedDate>  (scaled by completion)
 *  Full warm-up completed in a workout       15      warmup:<plannedDate>
 *  Full cooldown completed                   10      cooldown:<plannedDate>
 *  Approved comeback session                 40      comeback:<missedDate>
 *  Optional mobility session                 30      mobility:<date>  (max 1/day)
 *  Hydration target reached (not exceeded)   10      hydration:<date>
 *  Food logged (any 2 meals)                 10      food:<date>
 *  Sleep logged                               5      sleep:<date>
 *  Daily checklist completed                 15      checklist:<date>
 *  Missions / achievements                   as listed, once each
 *
 * Nothing rewards extra workouts beyond the plan, training through pain, less sleep,
 * eating less, or drinking more than the target.
 */

export const XP = {
  workoutBase: 50,
  workoutCompletionBonus: 50,
  warmup: 15,
  cooldown: 10,
  comeback: 40,
  mobility: 30,
  hydration: 10,
  food: 10,
  sleep: 5,
  checklist: 15,
} as const;

export function hasXp(ledger: XpEvent[], key: string): boolean {
  return ledger.some((e) => e.key === key);
}

export function awardXp(ledger: XpEvent[], key: string, amount: number, reason: string, at: string): { ledger: XpEvent[]; awarded: number } {
  if (amount <= 0 || hasXp(ledger, key)) return { ledger, awarded: 0 };
  const amt = Math.round(Math.min(amount, 500));
  return { ledger: [...ledger, { key, amount: amt, reason, at }], awarded: amt };
}

export function totalXp(ledger: XpEvent[]): number {
  return ledger.reduce((s, e) => s + e.amount, 0);
}

/** Cumulative XP required to reach a level (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelFor(xp: number): { level: number; current: number; next: number; progress: number; title: string } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, current, next, progress: (xp - current) / (next - current), title: levelTitle(level) };
}

const TITLES = ['Rookie', 'Mover', 'Builder', 'Challenger', 'Contender', 'Athlete', 'Warrior', 'Champion', 'Titan', 'Legend'];

export function levelTitle(level: number): string {
  return TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 2))];
}

export function workoutXp(completionRatio: number): number {
  return Math.round(XP.workoutBase + XP.workoutCompletionBonus * Math.min(1, Math.max(0, completionRatio)));
}
