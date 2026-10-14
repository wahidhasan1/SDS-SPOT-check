import type { DateKey, UserProfile, Weekday } from '../domain/types';
import { addDays, toDateKey, weekdayOf } from '../services/dates';
import { templateForDate } from '../services/schedule';
import * as A from '../store/actions';
import { runSync } from '../store/sync';
import { emptyUserData, type UserData } from '../store/userData';

/**
 * DEMO ACCOUNT SEED — sample data, clearly labelled in the UI.
 *
 * Builds ~3½ weeks of realistic history by replaying the app's own actions day by day
 * (the same pure functions the UI uses), so every number in the demo is produced by the
 * real engine: workouts with logged sets, a missed session saved with a recovery token,
 * a comeback session, an optional mobility day, meals, water, sleep, monthly-style
 * performance tests, a finished battle and a live one. Today's workout is left for the
 * visitor to do.
 */

export const DEMO_DAYS = 24;

function at(date: DateKey, hour: number, minute = 0): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0).toISOString();
}

function envFor(userId: string, date: DateKey, hour: number, minute = 0): A.Env {
  return { userId, today: date, nowIso: at(date, hour, minute) };
}

/** Apply an action, ignoring ActionErrors (a demo step that doesn't apply is skipped). */
function step(d: UserData, fn: () => A.ActionResult): UserData {
  try {
    return fn().data;
  } catch (e) {
    if (e instanceof A.ActionError) return d;
    throw e;
  }
}

function completeSession(d: UserData, userId: string, date: DateKey, id: string, quality: { repsFromTop: number; rating: 1 | 2 | 3 | 4 | 5 }): UserData {
  const e = envFor(userId, date, 7, 5);
  const s = d.sessions.find((x) => x.id === id);
  if (!s) return d;
  for (const we of s.workout.exercises) {
    if (we.block !== 'main') {
      d = step(d, () => A.markDone(d, e, id, we.id));
      continue;
    }
    for (let i = 0; i < we.sets; i++) {
      const set = we.reps
        ? { repsDone: Math.max(we.reps[0], we.reps[1] - quality.repsFromTop - (i === we.sets - 1 ? 1 : 0)), rating: quality.rating }
        : { secondsDone: we.seconds, rating: quality.rating };
      d = step(d, () => A.logSet(d, e, id, we.id, set));
    }
  }
  const fe = envFor(userId, date, 7, 34);
  return step(d, () => A.finishWorkout(d, fe, id));
}

export function buildDemoData(userId: string, today: DateKey = toDateKey(new Date())): UserData {
  const start = addDays(today, -DEMO_DAYS);
  const wd = weekdayOf(today);
  // Three spaced training days that always include today, so a workout is waiting.
  const trainingDays = [wd, (wd + 2) % 7, (wd + 4) % 7].sort() as Weekday[];
  const profile: Partial<UserProfile> = {
    displayName: 'Ayaan (Demo)',
    age: 26,
    heightCm: 172,
    weightKg: 70.4,
    unitSystem: 'metric',
    sex: 'unspecified',
    region: 'BD',
    experience: 'beginner',
    activityLevel: 'light',
    sleepHours: 7,
    dailyMinutes: 30,
    trainingDays,
    limitations: [],
    limitationNotes: '',
    readiness: { heartConditionOrSupervised: false, chestPainOnActivity: false, dizzinessOrFainting: false, otherMedicalReason: false },
    diet: 'halal',
    allergies: [],
    primaryGoal: 'build-muscle',
    secondaryGoal: 'overall-fitness',
    bodyGoal: 'muscular-athletic',
    trainingPattern: 'full-body',
    timelineMonths: 6,
    avatar: { emoji: '🦁', color: '#c8f031' },
  };

  let d = emptyUserData();
  d = A.completeOnboarding(d, envFor(userId, start, 9), profile).data;
  d = runSync(d, envFor(userId, start, 9, 1)).data;

  let k = 0; // training-day counter
  let pendingMiss: { date: DateKey; how: 'token' | 'comeback' } | null = null;
  let mobilityDone = false;

  for (let i = 0; i < DEMO_DAYS; i++) {
    const date = addDays(start, i);
    const tpl = templateForDate(d.plan!, date);

    // Resolve yesterday's miss first thing in the morning.
    if (pendingMiss) {
      const m = pendingMiss;
      pendingMiss = null;
      if (m.how === 'token') {
        d = step(d, () => A.resolveDay(d, envFor(userId, date, 6, 30), m.date, 'token'));
      } else {
        const id = `cb-${m.date}`;
        d = step(d, () => A.startComeback(d, envFor(userId, date, 18, 0), m.date, 'comeback-mobility'));
        const s = d.sessions.find((x) => x.id === id);
        if (s) {
          const e = envFor(userId, date, 18, 2);
          for (const we of s.workout.exercises) {
            if (we.block !== 'main') d = step(d, () => A.markDone(d, e, id, we.id));
            else for (let j = 0; j < we.sets; j++) d = step(d, () => A.logSet(d, e, id, we.id, we.reps ? { repsDone: we.reps![1], rating: 1 } : { secondsDone: we.seconds, rating: 1 }));
          }
          d = step(d, () => A.finishWorkout(d, envFor(userId, date, 18, 18), id));
        }
      }
    }

    if (tpl) {
      k++;
      if (k === 4) pendingMiss = { date, how: 'token' }; // busy day at work
      else if (k === 7) pendingMiss = { date, how: 'comeback' }; // family event
      else {
        d = step(d, () => A.startPlanned(d, envFor(userId, date, 7), date));
        const quality = { repsFromTop: Math.max(0, 3 - Math.floor(k / 2)), rating: (k === 2 ? 4 : k % 3 === 0 ? 3 : 2) as 2 | 3 | 4 };
        d = completeSession(d, userId, date, `s-${date}`, quality);
        // Accept add-rep suggestions now and then, like a real user.
        if (k % 2 === 0) {
          const sug = Object.values(d.progressions).find((p) => p.suggestion?.kind === 'add-reps');
          if (sug) d = step(d, () => A.acceptProgression(d, envFor(userId, date, 7, 40), sug.exerciseId));
        }
      }
    } else if (!mobilityDone && i > 8) {
      d = step(d, () => A.startMobility(d, envFor(userId, date, 19)));
      const id = `mob-${date}`;
      const s = d.sessions.find((x) => x.id === id);
      if (s) {
        const e = envFor(userId, date, 19, 2);
        for (const we of s.workout.exercises) {
          if (we.block !== 'main') d = step(d, () => A.markDone(d, e, id, we.id));
          else for (let j = 0; j < we.sets; j++) d = step(d, () => A.logSet(d, e, id, we.id, we.reps ? { repsDone: we.reps![1], rating: 1 } : { secondsDone: we.seconds, rating: 1 }));
        }
        d = step(d, () => A.finishWorkout(d, envFor(userId, date, 19, 17), id));
        mobilityDone = true;
      }
    }

    // Water through the day (not every day perfect).
    const glasses = 6 + ((i * 7) % 4);
    for (let g = 0; g < glasses; g++) d = step(d, () => A.addWater(d, envFor(userId, date, Math.min(21, 8 + Math.floor(g * 1.7)), 15), g % 3 === 2 ? 150 : 250, g === 0 ? 'tea-coffee' : 'water'));

    // Meals: what was actually eaten.
    if (i % 5 !== 3) {
      d = step(d, () => A.setMealStatus(d, envFor(userId, date, 9), date, 'breakfast', 'as-planned'));
      d = step(d, () => A.setMealStatus(d, envFor(userId, date, 14), date, 'lunch', i % 4 === 1 ? 'partly' : 'as-planned'));
      d = step(d, () => A.setMealStatus(d, envFor(userId, date, 21), date, 'dinner', 'as-planned'));
      if (i % 3 === 0) d = step(d, () => A.setMealStatus(d, envFor(userId, date, 17), date, 'snack', 'as-planned'));
    } else {
      d = step(d, () => A.addFood(d, envFor(userId, date, 21), { date, slot: 'dinner', customName: 'Chicken biryani at a wedding (1 plate)' }));
    }

    // Sleep most mornings; performance tests + weight weekly.
    const weekly = i % 7 === 1;
    const wave = [0, -0.3, 0.2, -0.5, -0.2, 0.1, -0.6, -0.4][i % 8];
    d = step(d, () =>
      A.addProgress(d, envFor(userId, date, 7), {
        date,
        measurements: weekly || i % 3 === 0 ? { weightKg: Math.round((70.4 + wave - i * 0.02) * 10) / 10 } : {},
        performance: weekly ? { pushupMaxReps: 4 + Math.floor(i / 4), plankSeconds: 25 + i * 2, squats60s: 24 + Math.floor(i / 2) } : {},
        sleepHours: i % 6 === 4 ? undefined : [7, 6.5, 7.5, 8, 6, 7][i % 6],
      }),
    );
    if (i % 2 === 0) d = step(d, () => A.toggleChecklist(d, envFor(userId, date, 21, 30), 'protein'));
    if (i % 3 === 0) d = step(d, () => A.toggleChecklist(d, envFor(userId, date, 21, 30), 'steps'));

    // Battles: accept the first demo invitation on day 3; start a second battle near the end.
    if (i === 3) {
      const inv = d.battles.find((b) => b.status === 'invited');
      if (inv) d = step(d, () => A.acceptInvite(d, envFor(userId, date, 12), inv.id));
    }
    if (i === DEMO_DAYS - 4) d = step(d, () => A.createBattle(d, envFor(userId, date, 12), 'demo-tanvir', 14));

    d = runSync(d, envFor(userId, date, 22)).data;
  }

  // A short coach exchange so the chat isn't empty.
  d = step(d, () => A.sendCoach(d, envFor(userId, today, 6, 50), 'How can I improve my push-ups?'));
  d = runSync(d, envFor(userId, today, 6, 55)).data;

  // Older notifications read; keep the latest few unread.
  d = { ...d, notifications: d.notifications.map((n, idx) => ({ ...n, read: idx >= 3 })) };

  return d;
}
