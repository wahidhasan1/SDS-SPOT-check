import { describe, expect, it } from 'vitest';
import type { Battle, DateKey, DayStatus } from '../domain/types';
import { makeProfile } from '../test/fixtures';
import { ageCompatible, challengesForWeek, decideResult, demoActivity, findMatches, scoreParticipant, type ActivityProvider } from './battle';
import { DEMO_OPPONENTS } from '../data/demoOpponents';
import { addDays } from './dates';
import { awardXp, levelFor, totalXp, workoutXp, xpForLevel } from './xp';

describe('XP awards', () => {
  it('is idempotent per key (no farming)', () => {
    let l = awardXp([], 'workout:2026-10-14', 100, 'x', 't').ledger;
    const again = awardXp(l, 'workout:2026-10-14', 100, 'x', 't');
    expect(again.awarded).toBe(0);
    l = again.ledger;
    expect(totalXp(l)).toBe(100);
  });
  it('rejects zero/negative awards and caps huge ones', () => {
    expect(awardXp([], 'a', 0, 'x', 't').awarded).toBe(0);
    expect(awardXp([], 'b', -5, 'x', 't').awarded).toBe(0);
    expect(awardXp([], 'c', 99999, 'x', 't').awarded).toBe(500);
  });
  it('scales workout XP by completion and never exceeds the maximum', () => {
    expect(workoutXp(0.7)).toBe(85);
    expect(workoutXp(1)).toBe(100);
    expect(workoutXp(3)).toBe(100);
  });
  it('computes levels from cumulative XP', () => {
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(xpForLevel(2)).level).toBe(2);
    expect(levelFor(xpForLevel(3) - 1).level).toBe(2);
    expect(levelFor(150).progress).toBeCloseTo(0.25);
  });
});

function provider(statuses: Record<DateKey, DayStatus>, extra: Partial<ActivityProvider> = {}): ActivityProvider {
  return {
    status: (d) => statuses[d] ?? 'rest',
    warmupDone: () => false,
    mobilityDone: () => false,
    hydrationMet: () => false,
    foodLogged: () => false,
    ratedAllSets: () => false,
    ...extra,
  };
}

const battle: Battle = {
  id: 'b1',
  status: 'active',
  createdAt: '',
  initiatedBy: 'me',
  opponentId: 'demo-sam',
  sharedGoal: 'build-muscle',
  durationDays: 7,
  startDate: '2026-10-12',
  endDate: '2026-10-18',
  participants: [],
};

describe('battle scoring', () => {
  const after = '2026-10-19';
  it('gives equal opportunity regardless of training days per week', () => {
    const three = provider({ '2026-10-12': 'completed', '2026-10-14': 'completed', '2026-10-16': 'completed' });
    const five = provider({ '2026-10-12': 'completed', '2026-10-13': 'completed', '2026-10-14': 'completed', '2026-10-15': 'completed', '2026-10-16': 'completed' });
    expect(scoreParticipant('a', battle, three, after).sessionPoints).toBe(60);
    expect(scoreParticipant('b', battle, five, after).sessionPoints).toBe(60);
  });
  it('awards no extra points for workouts beyond the plan, and caps mobility', () => {
    const p = provider({ '2026-10-12': 'completed' }, { mobilityDone: () => true });
    const s = scoreParticipant('a', battle, p, after);
    expect(s.sessionPoints).toBe(60);
    expect(s.mobility).toBe(5);
    expect(s.mobilityPoints).toBe(10);
    expect(s.total).toBeLessThanOrEqual(100);
  });
  it('excuses unwell days from the denominator', () => {
    const p = provider({ '2026-10-12': 'completed', '2026-10-14': 'excused', '2026-10-16': 'completed' });
    expect(scoreParticipant('a', battle, p, after).consistencyPct).toBe(100);
  });
  it('counts missed sessions against consistency', () => {
    const p = provider({ '2026-10-12': 'completed', '2026-10-14': 'missed', '2026-10-16': 'completed' });
    const s = scoreParticipant('a', battle, p, after);
    expect(s.sessionPoints).toBe(40);
    expect(s.consistencyPct).toBe(67);
  });
  it('only counts days that have happened (today counts only if kept)', () => {
    const p = provider({ '2026-10-12': 'completed', '2026-10-14': 'scheduled', '2026-10-16': 'scheduled' });
    const s = scoreParticipant('a', battle, p, '2026-10-14');
    expect(s.scheduledSessions).toBe(1);
  });
  it('warm-up challenge needs 3 warm-ups even mid-week', () => {
    let id = '';
    for (let i = 0; i < 200 && !id; i++) if (challengesForWeek(`b${i}`, 0).some((c) => c.check === 'warmups-3')) id = `b${i}`;
    expect(id).not.toBe('');
    const b = { ...battle, id };
    const planned = { '2026-10-12': 'completed', '2026-10-14': 'completed', '2026-10-16': 'completed' } as Record<string, DayStatus>;
    const oneWarmup = provider({ ...planned, '2026-10-14': 'scheduled', '2026-10-16': 'scheduled' }, { warmupDone: (d) => d === '2026-10-12' });
    expect(scoreParticipant('a', b, oneWarmup, '2026-10-12').challenges).toBe(0);
    const threeWarmups = provider(planned, { warmupDone: () => true });
    expect(scoreParticipant('a', b, threeWarmups, '2026-10-16').challenges).toBeGreaterThanOrEqual(1);
  });
  it('handles ties without a tie-breaker', () => {
    const a = provider({ '2026-10-12': 'completed' });
    const sa = scoreParticipant('me', battle, a, after);
    const sb = { ...sa, participantId: 'demo' };
    expect(decideResult('me', [sa, sb], 't').outcome).toBe('tie');
  });
  it('decides wins and losses', () => {
    const me = scoreParticipant('me', battle, provider({ '2026-10-12': 'completed' }), after);
    const opp = scoreParticipant('o', battle, provider({ '2026-10-12': 'missed' }), after);
    expect(decideResult('me', [me, opp], 't').outcome).toBe('win');
    expect(decideResult('me', [opp, { ...me, participantId: 'o' }].map((s, i) => ({ ...s, participantId: i === 0 ? 'me' : 'o' })), 't').outcome).toBe('loss');
  });
  it('demo simulation is deterministic', () => {
    const a = demoActivity(DEMO_OPPONENTS[0], 'b1');
    const b = demoActivity(DEMO_OPPONENTS[0], 'b1');
    for (let i = 0; i < 14; i++) expect(a.status(addDays('2026-10-12', i))).toBe(b.status(addDays('2026-10-12', i)));
  });
});

describe('matchmaking', () => {
  it('matches under-18s only with under-18s and vice versa', () => {
    const teen = findMatches(makeProfile({ age: 16 }));
    expect(teen.length).toBeGreaterThan(0);
    expect(teen.every((m) => m.opponent.ageBand === 'teen')).toBe(true);
    const adult = findMatches(makeProfile({ age: 30 }));
    expect(adult.every((m) => m.opponent.ageBand !== 'teen')).toBe(true);
    expect(ageCompatible(16, 'adult')).toBe(false);
  });
  it('ranks same goal & experience first and never uses height/weight', () => {
    const m = findMatches(makeProfile({ primaryGoal: 'build-muscle', experience: 'beginner', trainingDays: [1, 3, 5] }));
    expect(m[0].opponent.goal).toBe('build-muscle');
    expect(m[0].reasons).toContain('Same primary goal');
    const heavy = findMatches(makeProfile({ weightKg: 140, heightCm: 200 }));
    expect(heavy.map((x) => x.opponent.id)).toEqual(m.map((x) => x.opponent.id));
  });
});
