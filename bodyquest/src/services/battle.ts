import { WEEKLY_CHALLENGES } from '../data/achievements';
import { DEMO_OPPONENTS } from '../data/demoOpponents';
import type {
  Battle,
  BattleResult,
  BattleScoreBreakdown,
  DateKey,
  DayStatus,
  DemoOpponent,
  Experience,
  PrimaryGoal,
  UserProfile,
  WeeklyChallenge,
} from '../domain/types';
import { addDays, diffDays, hashString, rangeDays, seededRandom, weekdayOf } from './dates';
import { ageGroup } from './safety';

/**
 * BATTLE SCORING (transparent, capped, identical for both participants)
 *
 * Per battle week (max 100 points):
 *   Planned sessions kept      60 × (kept ÷ scheduled)        → up to 60
 *   Warm-ups completed         10 × (warm-ups ÷ scheduled)     → up to 10
 *   Approved weekly challenges 10 each, 2 per week             → up to 20
 *   Recovery / mobility        2 each, max 5 per week          → up to 10
 *
 * Points are proportional to each person’s *own* schedule, so someone training 3 days a
 * week has exactly the same opportunity as someone training 5. Extra workouts beyond the
 * plan earn nothing. Excused (unwell) days are removed from both numerator and denominator.
 * Equal totals are a tie — there is no tie-breaker that rewards doing more.
 *
 * Production note: in a real deployment these scores must be calculated on the server
 * from verified activity records. Client-submitted scores must never be trusted.
 */

export const SCORING = { session: 60, warmup: 10, challengeEach: 10, challengesPerWeek: 2, mobilityEach: 2, mobilityMaxPerWeek: 5 } as const;

export interface ActivityProvider {
  status(date: DateKey): DayStatus;
  warmupDone(date: DateKey): boolean;
  mobilityDone(date: DateKey): boolean;
  hydrationMet(date: DateKey): boolean;
  foodLogged(date: DateKey): boolean;
  ratedAllSets(date: DateKey): boolean;
}

export function challengesForWeek(battleId: string, weekIndex: number): WeeklyChallenge[] {
  const h = hashString(`${battleId}:${weekIndex}`);
  const a = h % WEEKLY_CHALLENGES.length;
  let b = (h >>> 8) % WEEKLY_CHALLENGES.length;
  if (b === a) b = (b + 1) % WEEKLY_CHALLENGES.length;
  return [WEEKLY_CHALLENGES[a], WEEKLY_CHALLENGES[b]];
}

export function battleWeeks(b: Pick<Battle, 'startDate' | 'durationDays'>): Array<{ index: number; days: DateKey[] }> {
  if (!b.startDate) return [];
  const out: Array<{ index: number; days: DateKey[] }> = [];
  for (let w = 0; w < b.durationDays / 7; w++) {
    const start = addDays(b.startDate, w * 7);
    out.push({ index: w, days: rangeDays(start, addDays(start, 6)) });
  }
  return out;
}

const KEPT: DayStatus[] = ['completed', 'comeback', 'protected'];

function checkChallenge(c: WeeklyChallenge, days: DateKey[], a: ActivityProvider, scheduled: number, kept: number, plannedInWeek: number): boolean {
  const count = (f: (d: DateKey) => boolean) => days.filter(f).length;
  switch (c.check) {
    case 'warmups-3':
      // Threshold uses the whole week's plan, so it can't be met early with fewer warm-ups.
      return count(a.warmupDone) >= Math.min(3, Math.max(1, plannedInWeek));
    case 'mobility-2':
      return count(a.mobilityDone) >= 2;
    case 'all-planned':
      return scheduled > 0 && kept === scheduled;
    case 'hydration-4':
      return count(a.hydrationMet) >= 4;
    case 'food-log-4':
      return count(a.foodLogged) >= 4;
    case 'technique-1':
      return count(a.ratedAllSets) >= 1;
  }
}

/** Score one participant from their activity. `today` limits counting to days that have happened. */
export function scoreParticipant(participantId: string, battle: Battle, a: ActivityProvider, today: DateKey): BattleScoreBreakdown {
  let scheduled = 0, kept = 0, warmups = 0, challenges = 0, mobility = 0;
  let sessionPoints = 0, warmupPoints = 0, challengePoints = 0, mobilityPoints = 0;
  for (const week of battleWeeks(battle)) {
    const elapsed = week.days.filter((d) => diffDays(d, today) <= 0);
    let wSched = 0, wKept = 0, wWarm = 0, wMob = 0;
    for (const d of elapsed) {
      const st = a.status(d);
      if (st === 'rest' || st === 'before-plan' || st === 'excused') {
        if (a.mobilityDone(d)) wMob++;
        continue;
      }
      const isToday = d === today;
      const isKept = KEPT.includes(st);
      if (isToday && !isKept) continue; // today still open
      wSched++;
      if (isKept) {
        wKept++;
        if (a.warmupDone(d)) wWarm++;
      }
      if (a.mobilityDone(d)) wMob++;
    }
    wMob = Math.min(SCORING.mobilityMaxPerWeek, wMob);
    const weekDone = diffDays(today, week.days[6]) > 0;
    const plannedInWeek = week.days.filter((d) => !['rest', 'before-plan', 'excused'].includes(a.status(d))).length;
    const wCh = challengesForWeek(battle.id, week.index).filter((c) =>
      // Challenges are evaluated over the elapsed part of the week; "all planned" only once the week is over.
      c.check === 'all-planned' && !weekDone ? false : checkChallenge(c, elapsed, a, wSched, wKept, plannedInWeek),
    ).length;
    scheduled += wSched;
    kept += wKept;
    warmups += wWarm;
    challenges += wCh;
    mobility += wMob;
    sessionPoints += wSched ? Math.round((SCORING.session * wKept) / wSched) : 0;
    warmupPoints += wSched ? Math.round((SCORING.warmup * wWarm) / wSched) : 0;
    challengePoints += Math.min(SCORING.challengesPerWeek, wCh) * SCORING.challengeEach;
    mobilityPoints += wMob * SCORING.mobilityEach;
  }
  const total = sessionPoints + warmupPoints + challengePoints + mobilityPoints;
  return {
    participantId,
    scheduledSessions: scheduled,
    keptSessions: kept,
    warmups,
    challenges,
    mobility,
    sessionPoints,
    warmupPoints,
    challengePoints,
    mobilityPoints,
    total,
    consistencyPct: scheduled ? Math.round((kept / scheduled) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Demo opponent simulation (deterministic, clearly labeled as demo)
// ---------------------------------------------------------------------------

const DAY_PATTERNS: Record<number, number[]> = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] };

export function demoActivity(o: DemoOpponent, seed: string): ActivityProvider {
  const days = DAY_PATTERNS[Math.max(2, Math.min(6, o.trainingDaysPerWeek))];
  const rnd = (d: DateKey, k: string) => seededRandom(`${seed}:${o.id}:${d}:${k}`)();
  const status = (d: DateKey): DayStatus => {
    if (!days.includes(weekdayOf(d))) return 'rest';
    return rnd(d, 'kept') < o.reliability ? 'completed' : 'missed';
  };
  return {
    status,
    warmupDone: (d) => status(d) === 'completed' && rnd(d, 'warm') < 0.85,
    mobilityDone: (d) => status(d) === 'rest' && rnd(d, 'mob') < 0.35,
    hydrationMet: (d) => rnd(d, 'hyd') < o.reliability - 0.1,
    foodLogged: (d) => rnd(d, 'food') < o.reliability - 0.15,
    ratedAllSets: (d) => status(d) === 'completed' && rnd(d, 'rate') < 0.6,
  };
}

export function decideResult(myId: string, scores: BattleScoreBreakdown[], nowIso: string): BattleResult {
  const mine = scores.find((s) => s.participantId === myId)!;
  const other = scores.find((s) => s.participantId !== myId)!;
  const outcome = mine.total === other.total ? 'tie' : mine.total > other.total ? 'win' : 'loss';
  return { scores, outcome, decidedAt: nowIso };
}

export function isBattleOver(b: Battle, today: DateKey): boolean {
  return Boolean(b.endDate && diffDays(today, b.endDate) > 0);
}

// ---------------------------------------------------------------------------
// Matchmaking
// ---------------------------------------------------------------------------

export interface MatchCandidate {
  opponent: DemoOpponent;
  score: number;
  reasons: string[];
}

const EXP_ORDER: Experience[] = ['beginner', 'intermediate', 'advanced'];

const RELATED_GOALS: Partial<Record<PrimaryGoal, PrimaryGoal[]>> = {
  'build-muscle': ['balanced', 'strength', 'recomp'],
  'lean-athletic': ['recomp', 'endurance', 'overall-fitness'],
  strength: ['build-muscle', 'balanced'],
  endurance: ['lean-athletic', 'overall-fitness'],
  recomp: ['lean-athletic', 'build-muscle'],
  balanced: ['build-muscle', 'overall-fitness'],
  'overall-fitness': ['balanced', 'endurance', 'mobility'],
  mobility: ['overall-fitness'],
};

/** Age-appropriate pools: under-18s only ever match with under-18s, and vice versa. */
export function ageCompatible(age: number, band: DemoOpponent['ageBand']): boolean {
  const g = ageGroup(age);
  if (g === 'teen') return band === 'teen';
  return band !== 'teen';
}

export function findMatches(p: Pick<UserProfile, 'primaryGoal' | 'experience' | 'trainingDays' | 'dailyMinutes' | 'age'>, opponents: DemoOpponent[] = DEMO_OPPONENTS): MatchCandidate[] {
  return opponents
    .filter((o) => ageCompatible(p.age, o.ageBand))
    .map((o) => {
      let score = 0;
      const reasons: string[] = [];
      if (o.goal === p.primaryGoal) {
        score += 40;
        reasons.push('Same primary goal');
      } else if (RELATED_GOALS[p.primaryGoal]?.includes(o.goal)) {
        score += 20;
        reasons.push('Related goal');
      }
      const ed = Math.abs(EXP_ORDER.indexOf(o.experience) - EXP_ORDER.indexOf(p.experience));
      if (ed === 0) {
        score += 25;
        reasons.push('Same experience level');
      } else if (ed === 1) score += 10;
      const dd = Math.abs(o.trainingDaysPerWeek - p.trainingDays.length);
      if (dd <= 1) {
        score += 15;
        reasons.push('Similar weekly schedule');
      }
      if (Math.abs(o.dailyMinutes - p.dailyMinutes) <= 15) {
        score += 10;
        reasons.push('Similar session length');
      }
      if (o.lastActiveDaysAgo <= 3) {
        score += 10;
        reasons.push('Recently active');
      }
      return { opponent: o, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}
