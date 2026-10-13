import { EXERCISES, EXERCISE_MAP } from '../data/exercises';
import type { DateKey, Exercise, StreakSummary, TrainingPlan, UserProfile, Workout } from '../domain/types';
import { formatDate } from './dates';
import { energyGuidance, SUPPLEMENT_NOTE } from './nutrition';
import { phaseFor, weekNumber } from './plan';
import { detectRedFlags, triageSymptoms } from './safety';
import { getAlternatives } from './substitution';

/**
 * RULE-BASED DEMO COACH — no AI service is connected.
 * Answers come from the user's saved plan, the exercise library and the safety rules,
 * so they can never prescribe anything outside the validated system. Nothing is sent
 * off the device.
 *
 * Production: an LLM could rephrase these answers or handle open questions, but must be
 * constrained to the same tools (exercise library, plan, substitution and safety
 * services), and sensitive data should only be sent with explicit consent.
 */

export interface CoachContext {
  profile: UserProfile | null;
  plan: TrainingPlan | null;
  today: DateKey;
  todayWorkout: Workout | null;
  nextWorkout: { date: DateKey; workout: Workout } | null;
  streak: StreakSummary | null;
  overdue: DateKey[];
  useProfile: boolean;
}

export interface CoachReply {
  text: string;
  links?: Array<{ label: string; to: string }>;
  urgent?: boolean;
}

const ALIASES: Array<[RegExp, string]> = [
  [/push[\s-]?ups?/, 'pushup'],
  [/knee push/, 'knee-pushup'],
  [/wall push/, 'wall-pushup'],
  [/incline push/, 'incline-pushup'],
  [/pike/, 'pike-pushup'],
  [/dips?\b/, 'chair-dip'],
  [/squats?\b/, 'bodyweight-squat'],
  [/wall sit/, 'wall-sit'],
  [/lunges?/, 'reverse-lunge'],
  [/split squat/, 'split-squat'],
  [/step[\s-]?ups?/, 'step-up'],
  [/bridges?/, 'glute-bridge'],
  [/hip thrust/, 'hip-thrust'],
  [/hinge|deadlift|rdl/, 'hip-hinge'],
  [/calf/, 'calf-raise'],
  [/side plank/, 'side-plank'],
  [/planks?\b/, 'forearm-plank'],
  [/dead ?bugs?/, 'dead-bug'],
  [/bird ?dogs?/, 'bird-dog'],
  [/mountain climbers?/, 'mountain-climber'],
  [/jumping jacks?/, 'jumping-jacks'],
  [/march/, 'march-in-place'],
  [/burpees?/, 'burpee'],
  [/superman/, 'superman'],
  [/y-?t-?w/, 'prone-ytw'],
  [/hollow/, 'hollow-hold'],
  [/cat[\s-]?cow/, 'cat-cow'],
];

export function findExerciseInText(text: string): Exercise | null {
  const t = text.toLowerCase();
  const byName = [...EXERCISES].sort((a, b) => b.name.length - a.name.length).find((e) => t.includes(e.name.toLowerCase()));
  if (byName) return byName;
  for (const [re, id] of ALIASES) if (re.test(t)) return EXERCISE_MAP[id] ?? null;
  return null;
}

const has = (t: string, re: RegExp) => re.test(t);

function describeWorkout(w: Workout): string {
  const main = w.exercises.filter((e) => e.block === 'main').map((e) => EXERCISE_MAP[e.exerciseId]?.name).filter(Boolean);
  return `**${w.title}** (~${w.estimatedMinutes} min, ${w.intensity}). Main work: ${main.join(', ')}. It starts with a warm-up and ends with a cooldown.`;
}

export function coachReply(input: string, ctx: CoachContext): CoachReply {
  const text = input.trim();
  const t = text.toLowerCase();
  if (!text) return { text: 'Ask me anything about your training, exercises, food or recovery.' };

  // 1. Safety first — always.
  const flags = detectRedFlags(text);
  if (flags.length) {
    const tri = triageSymptoms(flags);
    return {
      urgent: tri.level === 'emergency' || tri.level === 'stop',
      text: `${tri.title}. ${tri.message}`,
      links: [{ label: 'Safety information', to: '/safety' }],
    };
  }

  const p = ctx.useProfile ? ctx.profile : null;
  const ex = findExerciseInText(text);

  // 2. Replacement / substitution
  if (has(t, /replace|substitut|swap|alternative|instead of|can'?t do|cannot do/) && ex) {
    const alts = p ? getAlternatives(ex.id, p) : ex.easier.concat(ex.harder).map((id) => ({ exercise: EXERCISE_MAP[id], relation: 'similar' as const }));
    if (!alts.length) return { text: `I couldn’t find an approved alternative for ${ex.name} that fits your safety settings. You can skip it with a reason in the workout player.` };
    const list = alts.slice(0, 4).map((a) => `• ${a.exercise.name} (${a.relation})`).join('\n');
    return {
      text: `Approved alternatives for **${ex.name}**${p ? ' that fit your limitations' : ''}:\n${list}\n\nIn the workout player, tap “Replace” on the exercise card to swap it.`,
      links: alts.slice(0, 3).map((a) => ({ label: a.exercise.name, to: `/app/exercises/${a.exercise.id}` })),
    };
  }

  // 3. Push-up improvement
  if (has(t, /improve|get better|more|progress/) && has(t, /push[\s-]?ups?/)) {
    return {
      text:
        'Push-ups improve with a simple ladder: wall push-ups → incline push-ups (sturdy chair or table) → knee push-ups → full push-ups → close-grip / decline. ' +
        'Work at the level where you can do your target reps with good form, rate each set honestly, and BODYQUEST will suggest +2 reps or the next variation once you hit the top of the range twice in a row. ' +
        'Slow 3-second lowering, a strong plank (try forearm planks), and 2–3 rest days between hard push sessions all help.',
      links: [
        { label: 'Push-Up guide', to: '/app/exercises/pushup' },
        { label: 'Incline Push-Up', to: '/app/exercises/incline-pushup' },
      ],
    };
  }

  // 4. How to perform an exercise
  if (ex && has(t, /how|perform|do (a|an|the)|technique|form|what is|explain|teach/)) {
    const steps = ex.instructions.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    return {
      text: `**${ex.name}** — start: ${ex.instructions.startingPosition}\n${steps}\n\nBreathing: ${ex.instructions.breathing}\nEasier option: ${ex.instructions.beginnerModification}`,
      links: [{ label: `Open ${ex.name} guide`, to: `/app/exercises/${ex.id}` }],
    };
  }

  // 5. Missed workout
  if (has(t, /missed|skipped|didn'?t (train|work ?out|do)|forgot|couldn'?t train/)) {
    const over = ctx.overdue.length
      ? `You have ${ctx.overdue.length} session(s) to resolve (${ctx.overdue.map((d) => formatDate(d)).join(', ')}).`
      : 'You have no unresolved sessions right now.';
    return {
      text:
        `${over} Options, depending on your schedule and recovery: resume your normal schedule; move the session to a nearby rest day (only if it doesn’t stack hard sessions); do a short approved comeback session (mobility or technique); use a recovery token; or mark the day as unwell — illness never counts as failure. ` +
        'You never need to do two hard workouts in one day to catch up.',
      links: [{ label: 'Resolve missed sessions', to: '/app/streaks' }],
    };
  }

  // 6. What to train today
  if (has(t, /today|train now|what should i (train|do)|workout for/)) {
    if (!ctx.plan) return { text: 'Complete onboarding to generate your plan, then I can tell you what to train each day.', links: [{ label: 'Start onboarding', to: '/onboarding' }] };
    if (ctx.todayWorkout) {
      return { text: `Today is ${describeWorkout(ctx.todayWorkout)}`, links: [{ label: 'Open today’s workout', to: '/app/workout' }] };
    }
    const next = ctx.nextWorkout ? ` Your next session is ${ctx.nextWorkout.workout.title} on ${formatDate(ctx.nextWorkout.date)}.` : '';
    return {
      text: `Today is a scheduled rest day — recovery is when your body adapts. Gentle walking or an optional mobility session is fine, but not required.${next}`,
      links: [{ label: 'Optional mobility session', to: '/app/workout?mode=mobility' }],
    };
  }

  // 7. Struggling
  if (has(t, /struggl|too hard|can'?t finish|cannot finish|exhausted|difficult|tired/)) {
    return {
      text:
        'That’s useful feedback, not failure. Common causes: poor sleep, not enough food, too little recovery, or variations that are a step too hard. ' +
        'Try this: rate sets honestly (BODYQUEST suggests easier variations after “too hard” ratings), use the easier alternative on each exercise card, rest the full interval, and report fatigue after the session. ' +
        'If you feel unwell, take a rest day — your streak is protected when you mark a day as unwell.',
      links: [{ label: 'Today’s workout', to: '/app/workout' }],
    };
  }

  // 8. Food
  if (has(t, /eat|food|meal|protein|diet|calorie|nutrition|hungry|post[\s-]?workout|after (training|workout)/)) {
    if (has(t, /supplement|powder|creatine|whey/)) return { text: SUPPLEMENT_NOTE };
    const local = p?.region === 'BD' ? 'rice with dal and an egg or a piece of fish, roti with chicken curry, chira with doi and banana, or a glass of milk with a banana' : 'eggs on toast, yogurt with fruit, a rice-and-beans bowl, or a glass of milk with a banana';
    let extra = '';
    if (p) {
      const g = energyGuidance(p);
      extra = g.mode === 'targets' && g.proteinRange ? ` For your profile, about ${g.proteinRange[0]}–${g.proteinRange[1]} g of protein per day spread over meals is a reasonable range.` : ` ${g.reason ?? ''}`;
    }
    return {
      text: `After training, a normal balanced meal within a few hours is enough — no special timing tricks needed. Good options: ${local}.${extra} Supplements are optional.`,
      links: [{ label: 'Food planner', to: '/app/food' }],
    };
  }

  // 9. Next month / progression
  if (has(t, /next month|next phase|change|progress|plan (change|next)|month/)) {
    if (!ctx.plan) return { text: 'Generate your plan first to see your phases.', links: [{ label: 'Start onboarding', to: '/onboarding' }] };
    const week = Math.max(1, weekNumber(ctx.plan, ctx.today));
    const cur = phaseFor(ctx.plan, week);
    const next = ctx.plan.phases.find((x) => x.startWeek > cur.endWeek);
    return {
      text:
        `You’re in week ${week}, phase “${cur.name}”: ${cur.focus} ` +
        (next ? `Next is “${next.name}” from week ${next.startWeek}: ${next.focus} ` : 'This is your final phase — a great time to review and set new goals. ') +
        'Difficulty only increases when your logged performance and recovery support it, and you always confirm progressions yourself.',
      links: [{ label: 'View schedule & phases', to: '/app/schedule' }],
    };
  }

  // 10. Hydration
  if (has(t, /water|hydrat|drink|thirst/)) {
    return {
      text: 'Drink regularly through the day, start workouts normally hydrated, sip during exercise as needed, and rehydrate after heavy sweating. Don’t force large amounts quickly. If a doctor has set a fluid limit, follow it — you can enter it in the Hydration settings.',
      links: [{ label: 'Hydration tracker', to: '/app/hydration' }],
    };
  }

  // 11. Soreness
  if (has(t, /sore|doms|ache|stiff/)) {
    return {
      text: 'Mild muscle soreness 1–2 days after training is normal, especially early on. Gentle movement, sleep, food and fluids help. Train other areas or do a mobility session if needed. Joint pain, sharp pain or soreness that worsens over several days is different — stop that exercise and report it in the workout summary.',
    };
  }

  // 12. Supplements
  if (has(t, /supplement|powder|creatine|whey|pre[\s-]?workout/)) return { text: SUPPLEMENT_NOTE };

  // 13. Fat loss / body shape expectations
  if (has(t, /lose (weight|fat)|belly|burn fat|six ?pack|abs\b|get ripped|bulk/)) {
    return {
      text:
        'Changes in body shape come from consistent training, sensible eating and sleep over months — not from specific exercises (you can’t “spot reduce” fat). BODYQUEST never prescribes crash diets or extreme bulking. Track performance and consistency alongside any measurements, and expect gradual change. Results vary between people and are not guaranteed.',
    };
  }

  // 14. Sleep
  if (has(t, /sleep|rest day|recover/)) {
    return { text: 'Recovery is part of training. Most adults do best with 7–9 hours of sleep (teenagers 8–10). Rest days are scheduled on purpose and never break your streak.' };
  }

  // 15. Exercise mentioned without a clear intent
  if (ex) {
    return { text: `${ex.name}: ${ex.instructions.startingPosition} Want the full steps, or an alternative?`, links: [{ label: `Open ${ex.name}`, to: `/app/exercises/${ex.id}` }] };
  }

  return {
    text:
      'I’m a rule-based demo coach, so I understand questions like:\n• What should I train today?\n• How do I do a reverse lunge?\n• Can I replace push-ups?\n• I missed yesterday’s workout — what now?\n• What should I eat after training?\n• How can I improve my push-ups?\n• How will my training change next month?',
  };
}

export const COACH_SUGGESTIONS = [
  'What should I train today?',
  'How do I perform a glute bridge?',
  'Can I replace push-ups?',
  'Why am I struggling with this workout?',
  'What should I eat after training?',
  'How can I improve my push-ups?',
  'I missed yesterday’s workout. What should I do?',
  'How should my training change next month?',
];
