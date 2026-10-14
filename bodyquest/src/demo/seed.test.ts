import { describe, expect, it } from 'vitest';
import { buildDemoData } from './seed';
import { scheduleCtx } from '../store/selectors';
import { dayStatus, sessionsNeedingAttention, streakSummary } from '../services/schedule';
import { totalXp } from '../services/xp';

describe('demo account seed', () => {
  const today = '2026-10-14';
  const d = buildDemoData('demo-user', today);
  const ctx = scheduleCtx(d, today)!;

  it('produces realistic history through the real engine', () => {
    const completed = d.sessions.filter((s) => s.status === 'completed');
    expect(completed.filter((s) => s.kind === 'planned').length).toBeGreaterThanOrEqual(6);
    expect(completed.some((s) => s.kind === 'comeback')).toBe(true);
    expect(completed.some((s) => s.kind === 'mobility')).toBe(true);
    expect(Object.values(d.overrides).some((o) => o.resolution === 'token')).toBe(true);
    expect(d.hydration.length).toBeGreaterThan(100);
    expect(d.foodLog.length).toBeGreaterThan(40);
    expect(d.progress.length).toBeGreaterThan(10);
    expect(totalXp(d.xp)).toBeGreaterThan(1000);
    expect(d.achievements.length).toBeGreaterThanOrEqual(5);
  });
  it('leaves today’s workout waiting and nothing overdue', () => {
    expect(dayStatus(ctx, today)).toBe('scheduled');
    expect(sessionsNeedingAttention(ctx)).toEqual([]);
    expect(streakSummary(ctx).current).toBeGreaterThanOrEqual(3);
  });
  it('has a finished battle with results and a live one', () => {
    expect(d.battles.some((b) => b.status === 'completed' && b.result)).toBe(true);
    expect(d.battles.some((b) => b.status === 'active')).toBe(true);
  });
  it('works for any weekday', () => {
    for (let i = 0; i < 7; i++) {
      const t = `2026-10-${String(12 + i).padStart(2, '0')}`;
      const x = buildDemoData('u', t);
      expect(dayStatus(scheduleCtx(x, t)!, t)).toBe('scheduled');
      expect(sessionsNeedingAttention(scheduleCtx(x, t)!)).toEqual([]);
    }
  });
});
