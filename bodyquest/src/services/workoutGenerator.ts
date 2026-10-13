import { EXERCISES, EXERCISE_MAP } from '../data/exercises';
import type {
  DateKey,
  Exercise,
  ExerciseCategory,
  ExerciseProgression,
  Experience,
  SessionTemplateId,
  TrainingPlan,
  UserProfile,
  Workout,
  WorkoutExercise,
} from '../domain/types';
import { hashString, weekdayOf } from './dates';
import { isDeloadWeek, phaseFor, weekNumber } from './plan';
import { ageGroup, difficultyCeiling, isAllowed } from './safety';

/**
 * Rules-based workout generator. Workouts are a deterministic function of
 * (profile, plan, date, accepted progressions) — no LLM involved — so every
 * prescription stays inside the validated exercise library and safety rules.
 */

interface Slot {
  cats: ExerciseCategory[];
  /** Lower = more important; slots are added in priority order until the time budget is used. */
  priority: number;
  /** Prefer exercises training these muscles. */
  prefer?: string[];
}

interface TemplateDef {
  title: string;
  objective: string;
  intensity: Workout['intensity'];
  focus: 'full' | 'upper' | 'lower' | 'mobility';
  slots: Slot[];
  circuit?: boolean;
}

const S = (cats: ExerciseCategory | ExerciseCategory[], priority: number, prefer?: string[]): Slot => ({
  cats: Array.isArray(cats) ? cats : [cats],
  priority,
  prefer,
});

export const TEMPLATES: Record<SessionTemplateId, TemplateDef> = {
  'full-a': {
    title: 'Full Body A',
    objective: 'Train every major movement pattern with controlled, high-quality reps.',
    intensity: 'hard',
    focus: 'full',
    slots: [S('squat', 1), S('push', 1), S('hinge', 2), S('pull', 2), S('core', 3), S('calf', 5), S('conditioning', 6)],
  },
  'full-b': {
    title: 'Full Body B',
    objective: 'Single-leg strength, pushing and posterior-chain work with core stability.',
    intensity: 'hard',
    focus: 'full',
    slots: [S('lunge', 1), S('push', 1), S('pull', 2), S('hinge', 2), S('core', 3), S('squat', 5), S('conditioning', 6)],
  },
  upper: {
    title: 'Upper Body',
    objective: 'Chest, shoulders, arms and upper back with balanced push and pull work.',
    intensity: 'hard',
    focus: 'upper',
    slots: [S('push', 1), S('pull', 1), S('push', 2, ['triceps', 'shoulders']), S('pull', 2), S('core', 3), S('core', 5, ['obliques'])],
  },
  lower: {
    title: 'Lower Body',
    objective: 'Legs and glutes: squat, hinge and single-leg strength, plus calves and core.',
    intensity: 'hard',
    focus: 'lower',
    slots: [S('squat', 1), S('hinge', 1), S('lunge', 2), S('calf', 3), S('core', 3), S('hinge', 5, ['glutes'])],
  },
  push: {
    title: 'Push Day',
    objective: 'Chest, shoulders and triceps with progressive push-up variations.',
    intensity: 'hard',
    focus: 'upper',
    slots: [S('push', 1), S('push', 1, ['shoulders']), S('push', 2, ['triceps']), S('core', 3), S('conditioning', 5)],
  },
  pull: {
    title: 'Pull & Posterior Day',
    objective: 'Upper back, rear shoulders and the posterior chain for posture and balance.',
    intensity: 'hard',
    focus: 'upper',
    slots: [S('pull', 1), S('pull', 1), S('hinge', 2), S('core', 3), S('pull', 4)],
  },
  legs: {
    title: 'Leg Day',
    objective: 'Quads, glutes, hamstrings and calves with squat, lunge and hinge patterns.',
    intensity: 'hard',
    focus: 'lower',
    slots: [S('squat', 1), S('lunge', 1), S('hinge', 2), S('calf', 3), S('core', 4)],
  },
  'strength-a': {
    title: 'Strength A',
    objective: 'Harder variations, fewer reps, full rest — quality strength work.',
    intensity: 'hard',
    focus: 'full',
    slots: [S('squat', 1), S('push', 1), S('hinge', 2), S('pull', 2), S('core', 3), S('conditioning', 6)],
  },
  'strength-b': {
    title: 'Strength B',
    objective: 'Single-leg and pressing strength with posterior-chain support.',
    intensity: 'hard',
    focus: 'full',
    slots: [S('lunge', 1), S('push', 1, ['shoulders', 'triceps']), S('pull', 2), S('hinge', 2), S('core', 3), S('conditioning', 6)],
  },
  'athletic-a': {
    title: 'Athletic Circuit A',
    objective: 'Strength and cardio intervals for conditioning and an athletic body.',
    intensity: 'hard',
    focus: 'full',
    circuit: true,
    slots: [S('conditioning', 1), S('squat', 1), S('push', 1), S('core', 2), S('lunge', 3), S('conditioning', 3), S('pull', 4)],
  },
  'athletic-b': {
    title: 'Athletic Circuit B',
    objective: 'Single-leg power, posterior chain and conditioning intervals.',
    intensity: 'hard',
    focus: 'full',
    circuit: true,
    slots: [S('conditioning', 1), S('lunge', 1), S('pull', 1), S('core', 2), S('hinge', 3), S('conditioning', 3), S('push', 4)],
  },
  'mobility-a': {
    title: 'Mobility & Core Stability',
    objective: 'Gentle strength, joint mobility and core stability. Recovery-friendly.',
    intensity: 'light',
    focus: 'mobility',
    slots: [S('mobility', 1), S('core', 1), S('hinge', 2), S('mobility', 2), S('core', 3), S('squat', 4), S('stretch', 5)],
  },
  'mobility-b': {
    title: 'Active Recovery & Mobility',
    objective: 'Move well and recover: mobility drills, light stability work and stretching.',
    intensity: 'light',
    focus: 'mobility',
    slots: [S('mobility', 1), S('pull', 2), S('core', 2), S('mobility', 3), S('stretch', 4)],
  },
  technique: {
    title: 'Technique Practice',
    objective: 'Practise the key movements at an easy level with plenty of rest — quality over effort.',
    intensity: 'moderate',
    focus: 'full',
    slots: [S('squat', 1), S('push', 1), S('hinge', 2), S('core', 2)],
  },
  'comeback-mobility': {
    title: 'Comeback Mobility Session',
    objective: 'A short, low-intensity session to get moving again after a missed workout.',
    intensity: 'light',
    focus: 'mobility',
    slots: [S('mobility', 1), S('core', 1), S('mobility', 2), S('stretch', 3)],
  },
  'comeback-technique': {
    title: 'Comeback Technique Session',
    objective: 'Light technique practice of your main movements to rebuild momentum.',
    intensity: 'moderate',
    focus: 'full',
    slots: [S('squat', 1), S('push', 1), S('core', 2)],
  },
};

const BASE_TARGET: Record<Experience, number> = { beginner: 2, intermediate: 3, advanced: 4 };

export interface GenerateOptions {
  progressions?: Record<string, ExerciseProgression>;
  /** Override session minutes (e.g. comeback sessions). */
  minutes?: number;
  /** Whether the user has earned the phase's volume increase (from analytics). */
  volumeReady?: boolean;
}

function slotTargetDifficulty(profile: UserProfile, template: TemplateDef, tid: SessionTemplateId): number {
  let t = BASE_TARGET[profile.experience];
  if (template.intensity === 'light') t = Math.min(t, 2);
  if (tid === 'technique' || tid.startsWith('comeback')) t = Math.max(1, t - 1);
  if (profile.primaryGoal === 'strength' || profile.bodyGoal === 'strength-fitness') t += tid.startsWith('strength') ? 1 : 0;
  return Math.min(t, difficultyCeiling(profile));
}

function emphasisBonus(ex: Exercise, profile: UserProfile, slot: Slot): number {
  let b = 0;
  if (slot.prefer && ex.muscles.some((m) => slot.prefer!.includes(m))) b += 4;
  switch (profile.bodyGoal) {
    case 'broad-shoulders':
      if (ex.muscles.includes('shoulders') || ex.muscles.includes('upper-back')) b += 3;
      break;
    case 'strong-lower':
      if (ex.muscles.includes('glutes') || ex.muscles.includes('quads')) b += 3;
      break;
    case 'lean-athletic':
    case 'muscular-athletic':
      if (ex.category === 'conditioning' && ex.impact === 'low') b += 1;
      break;
    case 'beginner-general':
      if (ex.tags.includes('technique')) b += 3;
      break;
  }
  if (profile.experience === 'beginner' && ex.tags.includes('technique')) b += 2;
  return b;
}

/** Choose an exercise for a slot. Never picks above the target difficulty. */
export function pickForSlot(
  slot: Slot,
  profile: UserProfile,
  target: number,
  used: Set<string>,
  seed: string,
  avoidHighImpact = false,
): Exercise | null {
  const pool = EXERCISES.filter(
    (e) => slot.cats.includes(e.category) && !used.has(e.id) && isAllowed(e, profile) && !(avoidHighImpact && e.impact === 'high'),
  );
  if (pool.length === 0) return null;
  const within = pool.filter((e) => e.difficulty <= target);
  const candidates = within.length ? within : [pool.reduce((a, b) => (a.difficulty <= b.difficulty ? a : b))];
  let best: Exercise | null = null;
  let bestScore = -Infinity;
  for (const e of candidates) {
    const jitter = (hashString(seed + e.id) % 100) / 50; // 0..2 deterministic variety
    const score = -Math.abs(target - e.difficulty) * 10 + emphasisBonus(e, profile, slot) + jitter;
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

interface DoseOut {
  sets: number;
  reps?: [number, number];
  seconds?: number;
  restSec: number;
  targetReps?: number;
}

export function doseFor(
  ex: Exercise,
  profile: UserProfile,
  opts: { setModifier: number; deload: boolean; circuit: boolean; light: boolean; repBonus: number },
): DoseOut {
  const base = ex.dosing[profile.experience];
  let sets = base.sets;
  let reps = base.reps ? ([...base.reps] as [number, number]) : undefined;
  let seconds = base.seconds;
  let rest = ex.restSec;
  const goal = profile.primaryGoal;

  if (ex.category !== 'warmup' && ex.category !== 'stretch' && ex.category !== 'mobility') {
    if (goal === 'strength') {
      if (reps) reps = [Math.max(3, reps[0] - 2), Math.max(5, reps[1] - 3)];
      rest += 30;
    } else if (goal === 'endurance' || goal === 'lean-athletic' || goal === 'recomp') {
      if (reps) reps = [Math.round(reps[0] * 1.2), Math.round(reps[1] * 1.2)];
      if (seconds) seconds += 10;
      rest = Math.max(20, rest - 15);
    }
    // Muscle-building goals get a little extra volume once technique is established.
    const muscleGoal = goal === 'build-muscle' || profile.bodyGoal === 'muscular-athletic' || profile.bodyGoal === 'balanced-muscular';
    if (muscleGoal && profile.experience === 'advanced' && ex.category !== 'conditioning' && ex.impact !== 'high') sets += 1;
    sets += opts.setModifier;
    if (opts.deload) sets -= 1;
    if (opts.circuit) rest = Math.min(rest, 40);
    if (opts.light) {
      sets = Math.min(sets, 2);
      rest = Math.max(rest, 45);
    }
  }
  const group = ageGroup(profile.age);
  if (group === 'teen' || group === 'older' || ex.impact === 'high') sets = Math.min(sets, 3);
  sets = Math.max(1, Math.min(sets, 5));
  let targetReps: number | undefined;
  if (reps) targetReps = Math.min(reps[1], reps[0] + opts.repBonus);
  if (seconds && opts.repBonus) seconds = seconds + Math.min(30, opts.repBonus);
  return { sets, reps, seconds, restSec: rest, targetReps };
}

/** Seconds an exercise takes including rest (used for time budgeting). */
export function estimateSeconds(we: Pick<WorkoutExercise, 'exerciseId' | 'sets' | 'reps' | 'seconds' | 'restSec'>): number {
  const ex = EXERCISE_MAP[we.exerciseId];
  const sides = ex?.unilateral ? 2 : 1;
  const work = we.seconds ? we.seconds * sides : ((we.reps ? (we.reps[0] + we.reps[1]) / 2 : 10) * (ex?.secondsPerRep ?? 3)) * sides;
  return we.sets * work + Math.max(0, we.sets - 1) * we.restSec + 20;
}

function warmupFor(profile: UserProfile, focus: TemplateDef['focus'], firstMain: Exercise | null, minutes: number): WorkoutExercise[] {
  const ids: string[] = ['march-in-place'];
  const upper = ['arm-circles', 'arm-swings', 'standing-ytw', 'wall-angel'];
  const lower = ['hip-circles', 'leg-swings', 'ankle-circles', 'hip-hinge'];
  const pickList =
    focus === 'upper' ? [...upper.slice(0, 3), 'hip-circles'] : focus === 'lower' ? [...lower, 'arm-circles'] : focus === 'mobility' ? ['cat-cow', 'hip-circles', 'arm-circles', 'ankle-circles'] : ['arm-circles', 'hip-circles', 'leg-swings', 'cat-cow'];
  const want = minutes <= 20 ? 3 : 4;
  for (const id of pickList) {
    if (ids.length >= want) break;
    const e = EXERCISE_MAP[id];
    if (e && isAllowed(e, profile) && !ids.includes(id)) ids.push(id);
  }
  const out: WorkoutExercise[] = ids.map((id, i) => {
    const e = EXERCISE_MAP[id];
    const isReps = e.measure === 'reps';
    return {
      id: `warmup-${i}`,
      exerciseId: id,
      baseExerciseId: id,
      block: 'warmup',
      sets: 1,
      reps: isReps ? ([6, 8] as [number, number]) : undefined,
      seconds: isReps ? undefined : id === 'march-in-place' ? (minutes >= 45 ? 120 : 90) : 40,
      restSec: 10,
    };
  });
  // Rehearsal: an easy set of an easier version of the first main exercise.
  if (firstMain && focus !== 'mobility') {
    const easier = firstMain.easier.map((id) => EXERCISE_MAP[id]).find((e) => e && isAllowed(e, profile)) ?? firstMain;
    out.push({
      id: `warmup-${out.length}`,
      exerciseId: easier.id,
      baseExerciseId: easier.id,
      block: 'warmup',
      sets: 1,
      reps: easier.measure === 'reps' ? [6, 8] : undefined,
      seconds: easier.measure === 'time' ? 20 : undefined,
      restSec: 20,
      note: 'Rehearsal set — easy effort, focus on technique.',
    });
  }
  return out;
}

function cooldownFor(profile: UserProfile, focus: TemplateDef['focus'], minutes: number): WorkoutExercise[] {
  const order: Record<TemplateDef['focus'], string[]> = {
    upper: ['chest-stretch', 'childs-pose', 'wall-angel', 'sphinx-stretch'],
    lower: ['hip-flexor-stretch', 'lying-hamstring-stretch', 'quad-stretch', 'figure-four-stretch', 'calf-stretch', 'standing-hamstring-stretch'],
    full: ['hip-flexor-stretch', 'chest-stretch', 'lying-hamstring-stretch', 'standing-hamstring-stretch', 'childs-pose', 'calf-stretch'],
    mobility: ['childs-pose', 'figure-four-stretch', 'standing-hamstring-stretch', 'quad-stretch'],
  };
  const want = minutes <= 20 ? 2 : 3;
  const ids: string[] = [];
  for (const id of order[focus]) {
    if (ids.length >= want) break;
    const e = EXERCISE_MAP[id];
    if (e && isAllowed(e, profile)) ids.push(id);
  }
  const list = ['march-in-place', ...ids, 'recovery-breathing'];
  return list.map((id, i) => ({
    id: `cooldown-${i}`,
    exerciseId: id,
    baseExerciseId: id,
    block: 'cooldown' as const,
    sets: 1,
    seconds: id === 'march-in-place' ? 60 : id === 'recovery-breathing' ? 60 : 30,
    restSec: 0,
    note: id === 'march-in-place' ? 'Easy pace — let your breathing settle.' : undefined,
  }));
}

function recoveryAdvice(profile: UserProfile, intensity: Workout['intensity']): string[] {
  const a = [
    `Aim for consistent sleep — you reported about ${profile.sleepHours} h; 7–9 h suits most adults${ageGroup(profile.age) === 'teen' ? ' (8–10 h for teenagers)' : ''}.`,
    'Eat a balanced meal with protein (eggs, fish, chicken, dal, beans, yogurt) within a few hours.',
    'Rehydrate according to thirst, especially if you sweated a lot.',
  ];
  if (intensity === 'hard') a.push('Mild soreness for 1–2 days is normal. Sharp or joint pain is not — report it and rest.');
  else a.push('Light sessions like this one support recovery between harder days.');
  return a;
}

export function generateWorkout(
  profile: UserProfile,
  plan: TrainingPlan,
  date: DateKey,
  templateOverride?: SessionTemplateId,
  opts: GenerateOptions = {},
): Workout | null {
  const tid = templateOverride ?? plan.weekTemplate[weekdayOf(date)];
  if (!tid) return null; // rest day
  const tpl = TEMPLATES[tid];
  const week = Math.max(1, weekNumber(plan, date));
  const phase = phaseFor(plan, week);
  const deload = isDeloadWeek(phase, week);
  const minutes = opts.minutes ?? (tid.startsWith('comeback') ? Math.min(20, profile.dailyMinutes) : profile.dailyMinutes);
  const light = tpl.intensity !== 'hard' || plan.lowIntensityOnly;
  const setModifier = light ? 0 : opts.volumeReady === false ? 0 : phase.setModifier;
  const target = slotTargetDifficulty(profile, tpl, tid);
  const progressions = opts.progressions ?? {};

  // Select main exercises in slot order, honouring the time budget by priority.
  // Rule: at most one high-impact (jumping) exercise per session.
  const used = new Set<string>();
  const chosen: Array<{ slotIndex: number; slot: Slot; ex: Exercise }> = [];
  tpl.slots.forEach((slot, i) => {
    const seed = `${tid}:${i}:${phase.index}`;
    const hasImpact = chosen.some((c) => c.ex.impact === 'high');
    const ex = pickForSlot(slot, profile, target, used, seed, hasImpact);
    if (ex) {
      used.add(ex.id);
      chosen.push({ slotIndex: i, slot, ex });
    }
  });

  const firstMain = chosen[0]?.ex ?? null;
  const warmup = warmupFor(profile, tpl.focus, firstMain, minutes);
  const cooldown = cooldownFor(profile, tpl.focus, minutes);
  const fixedSec = [...warmup, ...cooldown].reduce((s, w) => s + estimateSeconds(w), 0);
  const budget = Math.max(6 * 60, minutes * 60 - fixedSec);

  const mainCandidates: WorkoutExercise[] = chosen.map(({ ex }, idx) => {
    const prog = progressions[ex.id];
    const performed = prog && EXERCISE_MAP[prog.variationId] && isAllowed(EXERCISE_MAP[prog.variationId], profile) ? EXERCISE_MAP[prog.variationId] : ex;
    const d = doseFor(performed, profile, { setModifier, deload, circuit: Boolean(tpl.circuit), light, repBonus: prog?.repBonus ?? 0 });
    return {
      id: `main-${idx}`,
      exerciseId: performed.id,
      baseExerciseId: ex.id,
      block: 'main',
      sets: d.sets,
      reps: d.reps,
      targetReps: d.targetReps,
      seconds: d.seconds,
      restSec: d.restSec,
    };
  });

  // Add by priority while within budget; always keep at least 3 main exercises.
  const byPriority = mainCandidates
    .map((w, i) => ({ w, p: chosen[i].slot.priority, i }))
    .sort((a, b) => a.p - b.p || a.i - b.i);
  const kept = new Set<number>();
  let used_s = 0;
  for (const { w, i } of byPriority) {
    const s = estimateSeconds(w);
    if (kept.size < 3 || used_s + s <= budget) {
      kept.add(i);
      used_s += s;
    }
  }
  let main = mainCandidates.filter((_, i) => kept.has(i));
  // If the minimum set still overshoots, trim sets (never below 1 for light, 2 otherwise).
  let guard = 0;
  while (main.reduce((s, w) => s + estimateSeconds(w), 0) > budget * 1.15 && guard++ < 20) {
    const biggest = main.reduce((a, b) => (estimateSeconds(a) >= estimateSeconds(b) ? a : b));
    const floor = light ? 1 : 2;
    if (biggest.sets <= floor) break;
    main = main.map((w) => (w === biggest ? { ...w, sets: w.sets - 1 } : w));
  }
  if (profile.bodyGoal === 'beginner-general' || profile.experience === 'beginner') main = main.slice(0, Math.max(3, Math.min(main.length, 5)));

  const exercises = [...warmup, ...main, ...cooldown];
  const totalSec = exercises.reduce((s, w) => s + estimateSeconds(w), 0);
  const intensity = plan.lowIntensityOnly ? 'light' : tpl.intensity;
  return {
    id: tid.startsWith('comeback') ? `alt-${tid}-${date}` : `w-${date}`,
    date,
    templateId: tid,
    title: tpl.title,
    objective: tpl.objective + (deload ? ' This is a lighter deload week to let your body consolidate progress.' : ''),
    estimatedMinutes: Math.max(10, Math.round(totalSec / 60)),
    intensity,
    phaseName: phase.name,
    isDeloadWeek: deload,
    exercises,
    recoveryAdvice: recoveryAdvice(profile, intensity),
    xpAvailable: tid.startsWith('comeback') ? 40 : intensity === 'hard' ? 125 : 90,
  };
}

/** Templates offered as approved lighter alternatives / comeback sessions. */
export const COMEBACK_OPTIONS: Array<{ id: SessionTemplateId; label: string; description: string }> = [
  { id: 'comeback-mobility', label: 'Mobility session (~15 min)', description: 'Gentle mobility and core stability. Suitable even on a busy or tired day.' },
  { id: 'comeback-technique', label: 'Technique practice (~15–20 min)', description: 'Easy practice of your main movements at low effort.' },
];
