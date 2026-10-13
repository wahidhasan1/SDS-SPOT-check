import type {
  Milestone,
  SessionTemplateId,
  TimelineMonths,
  TrainingPattern,
  TrainingPhase,
  TrainingPlan,
  UserProfile,
  Weekday,
} from '../domain/types';
import { WEEK_ORDER, diffDays } from './dates';
import { ageGroup, requiresLowIntensity } from './safety';

export const PATTERN_INFO: Record<TrainingPattern, { name: string; summary: string; bestFor: string; rotation: SessionTemplateId[] }> = {
  'full-body': {
    name: 'Full-body training',
    summary: 'Every session trains the whole body with a few key movements. Simple, efficient and ideal for learning technique.',
    bestFor: 'Beginners, busy schedules, 2–4 days per week',
    rotation: ['full-a', 'full-b'],
  },
  'upper-lower': {
    name: 'Upper / lower split',
    summary: 'Alternate upper-body and lower-body days so each area recovers while you train the other.',
    bestFor: 'Intermediate trainees with 4+ days per week',
    rotation: ['upper', 'lower'],
  },
  'push-pull-legs': {
    name: 'Push / pull / legs (bodyweight)',
    summary: 'A bodybuilding-inspired rotation: pushing muscles, pulling & posterior chain, then legs.',
    bestFor: 'Experienced trainees with 5–6 days per week',
    rotation: ['push', 'pull', 'legs'],
  },
  'strength-conditioning': {
    name: 'Strength & conditioning',
    summary: 'Harder bodyweight variations, lower reps and longer rest to build strength, plus short conditioning.',
    bestFor: 'Strength goals with 3–4 days per week',
    rotation: ['strength-a', 'strength-b'],
  },
  'athletic-conditioning': {
    name: 'Athletic conditioning',
    summary: 'Circuit-style sessions mixing strength and cardio intervals for an athletic, conditioned body.',
    bestFor: 'Lean/athletic, endurance and fat-loss goals',
    rotation: ['athletic-a', 'athletic-b'],
  },
  'mobility-general': {
    name: 'Mobility & general fitness',
    summary: 'Low-intensity strength, mobility and core-stability sessions. Gentle on joints and recovery.',
    bestFor: 'Mobility goals, returning to exercise, or when low intensity is advised',
    rotation: ['mobility-a', 'mobility-b'],
  },
};

export interface PatternRecommendation {
  pattern: TrainingPattern;
  reasons: string[];
}

type PlanInputs = Pick<
  UserProfile,
  'experience' | 'trainingDays' | 'primaryGoal' | 'bodyGoal' | 'readiness' | 'limitations' | 'age' | 'dailyMinutes'
>;

export function recommendPattern(p: PlanInputs): PatternRecommendation {
  const days = p.trainingDays.length;
  const reasons: string[] = [];
  if (requiresLowIntensity(p)) {
    return {
      pattern: 'mobility-general',
      reasons: ['Your readiness answers suggest checking with a health professional first, so we start with low-intensity sessions.'],
    };
  }
  if (p.primaryGoal === 'mobility') {
    return { pattern: 'mobility-general', reasons: ['Your main goal is mobility and flexibility.'] };
  }
  if (p.experience === 'beginner' || ageGroup(p.age) === 'teen') {
    reasons.push('Full-body sessions let you practise each movement pattern more often — the fastest way to learn good technique.');
    reasons.push('Traditional bodybuilding splits are not necessary at the beginner stage; they add complexity without clear benefit.');
    if (days >= 5) reasons.push('With 5+ days available, extra days become light mobility sessions to protect recovery.');
    return { pattern: 'full-body', reasons };
  }
  if (p.primaryGoal === 'strength' || p.bodyGoal === 'strength-fitness') {
    reasons.push('Strength goals respond best to harder variations, lower reps and full recovery between sessions.');
    return { pattern: 'strength-conditioning', reasons };
  }
  if (['endurance', 'lean-athletic', 'recomp', 'overall-fitness'].includes(p.primaryGoal) || p.bodyGoal === 'lean-athletic') {
    if (days >= 3) {
      reasons.push('Circuit-style conditioning matches lean, athletic and endurance goals while keeping sessions time-efficient.');
      return { pattern: 'athletic-conditioning', reasons };
    }
    reasons.push('With fewer than 3 days, full-body sessions give the best overall return.');
    return { pattern: 'full-body', reasons };
  }
  if (days >= 5 && p.experience === 'advanced') {
    reasons.push('With 5+ days and advanced experience, a push/pull/legs rotation spreads volume while each area recovers.');
    return { pattern: 'push-pull-legs', reasons };
  }
  if (days >= 4) {
    reasons.push('With 4+ days, an upper/lower split allows more volume per area while each half of the body recovers.');
    return { pattern: 'upper-lower', reasons };
  }
  reasons.push('With 2–3 days per week, full-body sessions train each muscle group often enough to progress.');
  return { pattern: 'full-body', reasons };
}

// ---------------------------------------------------------------------------
// Phases & milestones
// ---------------------------------------------------------------------------

type PhaseDef = Omit<TrainingPhase, 'index'>;

const PHASES: Record<TimelineMonths, PhaseDef[]> = {
  3: [
    { name: 'Foundation', focus: 'Learn technique, build the habit, find your starting level.', startWeek: 1, endWeek: 4, difficultyAllowance: 0, setModifier: 0, deloadEvery: 0 },
    { name: 'Build', focus: 'Improve movement quality and earn your first progressions.', startWeek: 5, endWeek: 9, difficultyAllowance: 1, setModifier: 0, deloadEvery: 0 },
    { name: 'Consolidate & review', focus: 'Add a little volume, then review consistency, performance and recovery.', startWeek: 10, endWeek: 13, difficultyAllowance: 1, setModifier: 1, deloadEvery: 0 },
  ],
  6: [
    { name: 'Foundation', focus: 'Learn technique, build the habit, find your starting level.', startWeek: 1, endWeek: 4, difficultyAllowance: 0, setModifier: 0, deloadEvery: 0 },
    { name: 'Build', focus: 'Gradual progressions in reps and exercise variations.', startWeek: 5, endWeek: 10, difficultyAllowance: 1, setModifier: 0, deloadEvery: 6 },
    { name: 'Strength-endurance', focus: 'More total work: an extra set on key movements.', startWeek: 11, endWeek: 16, difficultyAllowance: 1, setModifier: 1, deloadEvery: 6 },
    { name: 'Progress', focus: 'Harder variations where performance supports it.', startWeek: 17, endWeek: 22, difficultyAllowance: 2, setModifier: 1, deloadEvery: 6 },
    { name: 'Consolidate & review', focus: 'Lock in gains, retest performance and plan the next block.', startWeek: 23, endWeek: 26, difficultyAllowance: 2, setModifier: 0, deloadEvery: 0 },
  ],
  12: [
    { name: 'Foundation', focus: 'Learn technique, build the habit, find your starting level.', startWeek: 1, endWeek: 4, difficultyAllowance: 0, setModifier: 0, deloadEvery: 0 },
    { name: 'Build I', focus: 'Rep progressions and first harder variations.', startWeek: 5, endWeek: 12, difficultyAllowance: 1, setModifier: 0, deloadEvery: 5 },
    { name: 'Build II', focus: 'Extra set on key movements; tempo work.', startWeek: 13, endWeek: 20, difficultyAllowance: 1, setModifier: 1, deloadEvery: 5 },
    { name: 'Strength focus', focus: 'Harder variations, fuller rest, quality reps.', startWeek: 21, endWeek: 28, difficultyAllowance: 2, setModifier: 0, deloadEvery: 5 },
    { name: 'Athletic conditioning', focus: 'Work capacity and conditioning while maintaining strength.', startWeek: 29, endWeek: 36, difficultyAllowance: 2, setModifier: 1, deloadEvery: 5 },
    { name: 'Progression peak', focus: 'Best-quality performance on your hardest variations.', startWeek: 37, endWeek: 44, difficultyAllowance: 2, setModifier: 1, deloadEvery: 5 },
    { name: 'Review & maintenance', focus: 'Retest, reflect, and set up a sustainable long-term routine.', startWeek: 45, endWeek: 52, difficultyAllowance: 2, setModifier: 0, deloadEvery: 4 },
  ],
  24: [
    { name: 'Foundation', focus: 'Learn technique, build the habit, find your starting level.', startWeek: 1, endWeek: 6, difficultyAllowance: 0, setModifier: 0, deloadEvery: 0 },
    { name: 'Build I', focus: 'Rep progressions and first harder variations.', startWeek: 7, endWeek: 16, difficultyAllowance: 1, setModifier: 0, deloadEvery: 5 },
    { name: 'Build II', focus: 'Extra set on key movements; tempo work.', startWeek: 17, endWeek: 26, difficultyAllowance: 1, setModifier: 1, deloadEvery: 5 },
    { name: 'Strength block', focus: 'Harder variations with full rest.', startWeek: 27, endWeek: 38, difficultyAllowance: 2, setModifier: 0, deloadEvery: 5 },
    { name: 'Athletic block', focus: 'Conditioning and work capacity.', startWeek: 39, endWeek: 50, difficultyAllowance: 2, setModifier: 1, deloadEvery: 5 },
    { name: 'Volume block', focus: 'Higher volume on key movements for muscle development.', startWeek: 51, endWeek: 64, difficultyAllowance: 2, setModifier: 1, deloadEvery: 5 },
    { name: 'Skill progressions', focus: 'Advanced variations where earned: single-leg and decline work.', startWeek: 65, endWeek: 78, difficultyAllowance: 3, setModifier: 0, deloadEvery: 5 },
    { name: 'Peak & consolidate', focus: 'Best-quality performance and retesting.', startWeek: 79, endWeek: 92, difficultyAllowance: 3, setModifier: 1, deloadEvery: 5 },
    { name: 'Long-term maintenance', focus: 'Sustainable routine, review and new goal setting.', startWeek: 93, endWeek: 104, difficultyAllowance: 3, setModifier: 0, deloadEvery: 4 },
  ],
};

export function buildPhases(months: TimelineMonths): TrainingPhase[] {
  return PHASES[months].map((p, index) => ({ ...p, index }));
}

export function buildMilestones(months: TimelineMonths, phases: TrainingPhase[]): Milestone[] {
  const out: Milestone[] = [];
  for (let m = 1; m <= months; m++) {
    const week = Math.round((m - 1) * 4.345) + 1;
    const phase = phases.find((p) => week >= p.startWeek && week <= p.endWeek) ?? phases[phases.length - 1];
    let title: string;
    let description: string;
    if (m === 1) {
      title = 'Learn the movements & build the habit';
      description = 'Focus on exercise technique, warming up properly and completing your planned sessions. Consistency beats intensity.';
    } else if (m === 2) {
      title = 'Improve movement quality';
      description = 'Smoother, more controlled reps. Accept progressions only when sessions feel manageable and recovery is good.';
    } else if (m % 3 === 0) {
      title = `Month ${m} review`;
      description = 'Review your consistency, exercise performance, sleep and recovery. Retest push-ups, plank and squats; optionally update measurements.';
    } else {
      title = `${phase.name}`;
      description = phase.focus;
    }
    out.push({ month: m, title, description });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Weekly schedule with recovery rules
// ---------------------------------------------------------------------------

const FOCUS: Record<SessionTemplateId, string[]> = {
  'full-a': ['upper', 'lower'],
  'full-b': ['upper', 'lower'],
  'strength-a': ['upper', 'lower'],
  'strength-b': ['upper', 'lower'],
  'athletic-a': ['upper', 'lower'],
  'athletic-b': ['upper', 'lower'],
  upper: ['upper'],
  lower: ['lower'],
  push: ['push'],
  pull: ['pull'],
  legs: ['lower'],
  'mobility-a': [],
  'mobility-b': [],
  technique: [],
  'comeback-mobility': [],
  'comeback-technique': [],
};

export function isHardTemplate(t: SessionTemplateId): boolean {
  return FOCUS[t].length > 0;
}

export function maxHardDays(p: Pick<UserProfile, 'experience' | 'age'>): number {
  const group = ageGroup(p.age);
  if (p.experience === 'beginner' || group === 'teen' || group === 'older') return 4;
  return p.experience === 'intermediate' ? 5 : 6;
}

/**
 * Assign a session template to each training weekday. Rules:
 *  1. Training days cycle through the pattern's rotation (Monday-first order).
 *  2. Days beyond the user's max hard days per week become mobility sessions.
 *  3. If the previous calendar day (including Sunday→Monday wrap) trained the same
 *     focus, the session becomes a lighter technique/mobility session instead.
 */
export function buildWeekTemplate(
  pattern: TrainingPattern,
  trainingDays: Weekday[],
  p: Pick<UserProfile, 'experience' | 'age'>,
): Partial<Record<Weekday, SessionTemplateId>> {
  const rotation = PATTERN_INFO[pattern].rotation;
  const ordered = WEEK_ORDER.filter((d) => trainingDays.includes(d));
  const result: Partial<Record<Weekday, SessionTemplateId>> = {};
  const cap = pattern === 'mobility-general' ? 7 : maxHardDays(p);
  let hard = 0;
  let r = 0;
  for (const d of ordered) {
    if (pattern === 'mobility-general') {
      result[d] = rotation[r++ % rotation.length];
      continue;
    }
    if (hard >= cap) {
      result[d] = 'mobility-a';
      continue;
    }
    result[d] = rotation[r++ % rotation.length];
    hard++;
  }
  // Recovery pass (two iterations to settle the week wrap).
  for (let pass = 0; pass < 2; pass++) {
    for (const d of ordered) {
      const t = result[d]!;
      if (!isHardTemplate(t)) continue;
      const prev = ((d + 6) % 7) as Weekday;
      const pt = result[prev];
      if (!pt || !isHardTemplate(pt)) continue;
      const overlap = FOCUS[t].some((f) => FOCUS[pt].includes(f));
      if (overlap) result[d] = p.experience === 'beginner' ? 'technique' : 'mobility-b';
    }
  }
  return result;
}

export function buildPlan(profile: UserProfile, startDate: string, nowIso: string, id: string): TrainingPlan {
  const rec = recommendPattern(profile);
  const lowIntensityOnly = requiresLowIntensity(profile);
  const pattern: TrainingPattern = lowIntensityOnly ? 'mobility-general' : profile.trainingPattern;
  const phases = buildPhases(profile.timelineMonths);
  const weekTemplate = buildWeekTemplate(pattern, profile.trainingDays, profile);
  const rationale = [...rec.reasons];
  if (pattern !== rec.pattern) rationale.push(`You chose ${PATTERN_INFO[pattern].name.toLowerCase()} instead of the recommended ${PATTERN_INFO[rec.pattern].name.toLowerCase()}; the engine still applies the same recovery rules.`);
  if (lowIntensityOnly) rationale.push('Low-intensity mode is on until you confirm medical clearance in Settings → Health & safety.');
  const converted = Object.values(weekTemplate).filter((t) => t === 'technique' || t === 'mobility-b' || (t === 'mobility-a' && pattern !== 'mobility-general')).length;
  if (converted > 0) rationale.push(`${converted} of your training days became lighter technique/mobility sessions so the same muscles are not trained hard on consecutive days.`);
  return {
    id,
    userId: profile.userId,
    pattern,
    recommendedPattern: rec.pattern,
    trainingDays: [...profile.trainingDays].sort(),
    startDate,
    timelineMonths: profile.timelineMonths,
    phases,
    milestones: buildMilestones(profile.timelineMonths, phases),
    rotation: PATTERN_INFO[pattern].rotation,
    weekTemplate,
    scheduleHistory: [{ from: startDate, weekTemplate }],
    rationale,
    lowIntensityOnly,
    createdAt: nowIso,
    version: 1,
  };
}

export function weekNumber(plan: Pick<TrainingPlan, 'startDate'>, date: string): number {
  return Math.floor(diffDays(date, plan.startDate) / 7) + 1;
}

export function phaseFor(plan: Pick<TrainingPlan, 'phases'>, week: number): TrainingPhase {
  const ph = plan.phases.find((p) => week >= p.startWeek && week <= p.endWeek);
  if (ph) return ph;
  return plan.phases[plan.phases.length - 1];
}

export function isDeloadWeek(phase: TrainingPhase, week: number): boolean {
  if (!phase.deloadEvery) return false;
  const inPhase = week - phase.startWeek + 1;
  return inPhase > 0 && inPhase % phase.deloadEvery === 0;
}
