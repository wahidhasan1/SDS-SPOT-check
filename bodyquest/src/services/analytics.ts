import { EXERCISE_MAP } from '../data/exercises';
import type { DateKey, MeasurementKey, PerformanceKey, ProgressEntry, WorkoutSession } from '../domain/types';
import { addDays, diffDays, startOfWeek } from './dates';
import { weekProgress, type ScheduleContext } from './schedule';
import { triageSymptoms } from './safety';

export interface Point {
  date: DateKey;
  value: number;
}

export const MEASUREMENT_LABEL: Record<MeasurementKey, string> = {
  weightKg: 'Body weight (kg)',
  waistCm: 'Waist (cm)',
  chestCm: 'Chest (cm)',
  hipsCm: 'Hips (cm)',
  armCm: 'Upper arm (cm)',
  thighCm: 'Thigh (cm)',
};

export const PERFORMANCE_LABEL: Record<PerformanceKey, string> = {
  pushupMaxReps: 'Max push-ups (any variation, good form)',
  plankSeconds: 'Plank hold (seconds)',
  squats60s: 'Bodyweight squats in 60 s',
  wallSitSeconds: 'Wall sit (seconds)',
};

export const MEASUREMENT_BOUNDS: Record<MeasurementKey, [number, number]> = {
  weightKg: [25, 350],
  waistCm: [40, 250],
  chestCm: [50, 250],
  hipsCm: [50, 250],
  armCm: [15, 80],
  thighCm: [25, 120],
};

export const PERFORMANCE_BOUNDS: Record<PerformanceKey, [number, number]> = {
  pushupMaxReps: [0, 200],
  plankSeconds: [0, 1200],
  squats60s: [0, 120],
  wallSitSeconds: [0, 1200],
};

export function series(entries: ProgressEntry[], pick: (e: ProgressEntry) => number | undefined): Point[] {
  const byDate = new Map<DateKey, number>();
  for (const e of [...entries].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))) {
    const v = pick(e);
    if (v !== undefined && Number.isFinite(v)) byDate.set(e.date, v); // latest entry per day wins
  }
  return [...byDate.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Trailing moving average over `windowDays` calendar days. */
export function movingAverage(points: Point[], windowDays = 7): Point[] {
  return points.map((p) => {
    const win = points.filter((q) => diffDays(p.date, q.date) >= 0 && diffDays(p.date, q.date) < windowDays);
    return { date: p.date, value: win.reduce((s, q) => s + q.value, 0) / win.length };
  });
}

export interface TrendSummary {
  text: string;
  delta: number | null;
}

/** Long-term trend wording that avoids over-interpreting daily fluctuations. */
export function weightTrend(points: Point[]): TrendSummary {
  if (points.length < 2) return { text: 'Log a few entries over several weeks to see a trend. Daily weight naturally moves up and down.', delta: null };
  const span = diffDays(points[points.length - 1].date, points[0].date);
  const avg = movingAverage(points, 7);
  const delta = avg[avg.length - 1].value - avg[0].value;
  if (span < 14) {
    return { text: `Less than two weeks of data. Day-to-day changes are mostly water, food and timing — not fat or muscle. Keep logging occasionally and judge the trend over 3–4 weeks.`, delta };
  }
  const dir = Math.abs(delta) < 0.5 ? 'stable' : delta > 0 ? 'up' : 'down';
  return {
    text:
      dir === 'stable'
        ? `Your 7-day average has been stable over ${span} days. Stable weight with better performance is great progress.`
        : `Your 7-day average is ${dir} about ${Math.abs(delta).toFixed(1)} kg over ${span} days. Look at this alongside performance, measurements and how you feel.`,
    delta,
  };
}

export interface PersonalRecord {
  key: string;
  label: string;
  value: number;
  unit: string;
  date: DateKey;
}

export function personalRecords(entries: ProgressEntry[], sessions: WorkoutSession[]): PersonalRecord[] {
  const out: PersonalRecord[] = [];
  for (const k of Object.keys(PERFORMANCE_LABEL) as PerformanceKey[]) {
    const pts = series(entries, (e) => e.performance[k]);
    if (!pts.length) continue;
    const best = pts.reduce((a, b) => (b.value > a.value ? b : a));
    out.push({ key: `perf:${k}`, label: PERFORMANCE_LABEL[k], value: best.value, unit: k.includes('Seconds') ? 's' : 'reps', date: best.date });
  }
  const bestSet = new Map<string, PersonalRecord>();
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    for (const we of s.workout.exercises) {
      if (we.block !== 'main') continue;
      const p = s.progress[we.id];
      const ex = EXERCISE_MAP[p.performedExerciseId];
      if (!ex) continue;
      for (const set of p.sets) {
        const v = ex.measure === 'reps' ? set.repsDone : set.secondsDone;
        if (v === undefined) continue;
        const cur = bestSet.get(ex.id);
        if (!cur || v > cur.value) {
          bestSet.set(ex.id, { key: `ex:${ex.id}`, label: ex.name, value: v, unit: ex.measure === 'reps' ? 'reps' : 's', date: s.performedDate ?? s.plannedDate });
        }
      }
    }
  }
  return [...out, ...[...bestSet.values()].sort((a, b) => a.label.localeCompare(b.label))];
}

export function weeklyConsistency(ctx: ScheduleContext, weeks = 8): Array<{ weekStart: DateKey; kept: number; due: number; pct: number }> {
  const out = [];
  const thisWeek = startOfWeek(ctx.today);
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(thisWeek, -7 * i);
    if (diffDays(addDays(ws, 6), ctx.plan.startDate) < 0) continue;
    const w = weekProgress(ctx, ws);
    out.push({ weekStart: ws, kept: w.kept, due: w.due, pct: w.pct });
  }
  return out;
}

/**
 * The phase's extra volume is only applied when recent performance and recovery support it:
 * ≥ 75% of due sessions kept over the last 14 days and no stop/emergency symptom reports.
 */
export function volumeReady(ctx: ScheduleContext): boolean {
  const since = addDays(ctx.today, -14);
  const recent = ctx.sessions.filter((s) => s.performedDate && diffDays(s.performedDate, since) >= 0);
  const flagged = recent.some((s) => s.symptomReport && ['stop', 'emergency', 'modify'].includes(triageSymptoms(s.symptomReport.symptoms).level));
  if (flagged) return false;
  const w1 = weekProgress(ctx, ctx.today);
  const w0 = weekProgress(ctx, addDays(ctx.today, -7));
  const due = w0.due + w1.due;
  const kept = w0.kept + w1.kept;
  return due >= 2 && kept / due >= 0.75;
}

export function sessionsCompleted(sessions: WorkoutSession[], kind?: WorkoutSession['kind']): number {
  return sessions.filter((s) => s.status === 'completed' && (!kind || s.kind === kind)).length;
}
