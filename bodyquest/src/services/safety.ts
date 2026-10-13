import type { Exercise, Limitation, ReadinessScreen, Symptom, UserProfile } from '../domain/types';

/**
 * Safety rules shared by the planner, workout player, nutrition, hydration and coach.
 * BODYQUEST is a general fitness tool — these rules are conservative defaults and do
 * not replace advice from a qualified health professional.
 */

export const LIMITATION_INFO: Record<Limitation, { label: string; description: string; excludeTags: string[]; excludeHighImpact: boolean }> = {
  knee: { label: 'Knee discomfort', description: 'Avoids jumping and deep loaded knee bending; limits depth.', excludeTags: [], excludeHighImpact: true },
  'lower-back': { label: 'Lower-back discomfort', description: 'Avoids loaded spinal extension and long-lever core work.', excludeTags: [], excludeHighImpact: false },
  shoulder: { label: 'Shoulder discomfort', description: 'Avoids overhead pressing and dips.', excludeTags: [], excludeHighImpact: false },
  wrist: { label: 'Wrist discomfort', description: 'Avoids weight-bearing on extended wrists where possible.', excludeTags: [], excludeHighImpact: false },
  neck: { label: 'Neck discomfort', description: 'Avoids head-loaded and neck-flexed positions.', excludeTags: [], excludeHighImpact: false },
  ankle: { label: 'Ankle discomfort', description: 'Avoids jumping and single-leg calf loading.', excludeTags: [], excludeHighImpact: true },
  'no-high-impact': { label: 'Prefer no jumping', description: 'Removes all jumping and high-impact movements.', excludeTags: ['power'], excludeHighImpact: true },
  balance: { label: 'Balance concerns', description: 'Avoids unsupported single-leg exercises.', excludeTags: ['balance'], excludeHighImpact: true },
  'no-floor-work': { label: 'Cannot get down to the floor', description: 'Uses only standing / wall / chair exercises.', excludeTags: ['floor'], excludeHighImpact: false },
  pregnancy: {
    label: 'Pregnant or recently gave birth',
    description: 'Avoids lying flat on the back or front, jumping and intense core work. Please follow your midwife’s or doctor’s advice.',
    excludeTags: ['supine', 'prone', 'power', 'floor'],
    excludeHighImpact: true,
  },
  'recent-surgery': {
    label: 'Recent surgery or injury',
    description: 'Low-intensity plan only until a health professional clears you for more.',
    excludeTags: ['power'],
    excludeHighImpact: true,
  },
};

export type AgeGroup = 'too-young' | 'teen' | 'adult' | 'older';

export function ageGroup(age: number): AgeGroup {
  if (age < 13) return 'too-young';
  if (age < 18) return 'teen';
  if (age >= 65) return 'older';
  return 'adult';
}

export function needsMedicalClearance(r: ReadinessScreen): boolean {
  return r.heartConditionOrSupervised || r.chestPainOnActivity || r.dizzinessOrFainting || r.otherMedicalReason;
}

/** True when the plan must stay low-intensity (clearance needed, recent surgery, pregnancy). */
export function requiresLowIntensity(profile: Pick<UserProfile, 'readiness' | 'limitations'>): boolean {
  return needsMedicalClearance(profile.readiness) || profile.limitations.includes('recent-surgery');
}

/** Hard ceiling on exercise difficulty for this user regardless of phase/progression. */
export function difficultyCeiling(profile: Pick<UserProfile, 'age' | 'experience' | 'readiness' | 'limitations'>): number {
  if (requiresLowIntensity(profile)) return 2;
  const group = ageGroup(profile.age);
  const base = profile.experience === 'beginner' ? 3 : profile.experience === 'intermediate' ? 4 : 5;
  if (group === 'teen' || group === 'older') return Math.min(base, 3);
  if (profile.limitations.includes('pregnancy')) return Math.min(base, 3);
  return base;
}

export interface AllowResult {
  allowed: boolean;
  reasons: string[];
}

export function checkExercise(ex: Exercise, profile: Pick<UserProfile, 'age' | 'experience' | 'readiness' | 'limitations'>): AllowResult {
  const reasons: string[] = [];
  for (const lim of profile.limitations) {
    const info = LIMITATION_INFO[lim];
    if (ex.contraindications.includes(lim)) reasons.push(`Not recommended with: ${info.label.toLowerCase()}.`);
    if (info.excludeHighImpact && ex.impact === 'high') reasons.push(`High-impact movement excluded (${info.label.toLowerCase()}).`);
    const tag = info.excludeTags.find((t) => ex.tags.includes(t));
    if (tag) reasons.push(`Excluded for ${info.label.toLowerCase()} (${tag} position).`);
  }
  const ceiling = difficultyCeiling(profile);
  if (ex.difficulty > ceiling) reasons.push(`Above your current safe difficulty ceiling (${ceiling}/5).`);
  if (requiresLowIntensity(profile) && ex.impact === 'high') reasons.push('Low-intensity plan: no high-impact movements.');
  const group = ageGroup(profile.age);
  if ((group === 'teen' || group === 'older') && ex.tags.includes('power') && profile.experience !== 'advanced') {
    reasons.push('Explosive movements are not included for your age group at this experience level.');
  }
  if (group === 'older' && ex.tags.includes('balance') && profile.experience === 'beginner') {
    reasons.push('Unsupported balance work is introduced later for beginners aged 65+.');
  }
  return { allowed: reasons.length === 0, reasons: Array.from(new Set(reasons)) };
}

export function isAllowed(ex: Exercise, profile: Pick<UserProfile, 'age' | 'experience' | 'readiness' | 'limitations'>): boolean {
  return checkExercise(ex, profile).allowed;
}

export function cautionsFor(ex: Exercise, profile: Pick<UserProfile, 'limitations'>): string[] {
  return profile.limitations.map((l) => ex.cautions[l]).filter((c): c is string => Boolean(c));
}

// ---------------------------------------------------------------------------
// Symptom triage
// ---------------------------------------------------------------------------

export type TriageLevel = 'emergency' | 'stop' | 'modify' | 'ok';

export interface TriageResult {
  level: TriageLevel;
  title: string;
  message: string;
  actions: string[];
}

const EMERGENCY: Symptom[] = ['chest-pain', 'faint-dizzy', 'breathless-severe', 'palpitations'];
const STOP: Symptom[] = ['sharp-pain', 'joint-pain'];
const MODIFY: Symptom[] = ['excessive-soreness', 'fatigue', 'too-difficult'];

export const SYMPTOM_LABEL: Record<Symptom, string> = {
  'normal-soreness': 'Normal muscle soreness',
  'excessive-soreness': 'Unusually heavy soreness',
  fatigue: 'Very tired / poorly recovered',
  'too-difficult': 'Workout felt too difficult',
  'joint-pain': 'Pain in a joint',
  'sharp-pain': 'Sharp or sudden pain',
  'chest-pain': 'Chest pain, pressure or tightness',
  'faint-dizzy': 'Feeling faint, dizzy or light-headed',
  'breathless-severe': 'Severe breathlessness that does not settle',
  palpitations: 'Racing or irregular heartbeat',
};

export function triageSymptoms(symptoms: Symptom[]): TriageResult {
  if (symptoms.some((s) => EMERGENCY.includes(s))) {
    return {
      level: 'emergency',
      title: 'Stop exercising now',
      message:
        'Chest pain, fainting, severe breathlessness or an irregular heartbeat can be signs of a medical emergency. Stop immediately, sit or lie down, and seek medical help. If symptoms are severe or do not settle quickly, call your local emergency number (999 in Bangladesh and the UK, 911 in the US, 112 in the EU).',
      actions: ['Stop the workout', 'Seek medical help', 'Do not resume training until a health professional says it is safe'],
    };
  }
  if (symptoms.some((s) => STOP.includes(s))) {
    return {
      level: 'stop',
      title: 'Stop the painful exercise',
      message:
        'Sharp pain or joint pain is a signal to stop that movement — never push through it. Rest the area. If pain is severe, persists for more than a few days, or comes with swelling, numbness or weakness, see a doctor or physiotherapist.',
      actions: ['Stop the exercise causing pain', 'Switch to a pain-free alternative or end the session', 'Get it checked if it persists'],
    };
  }
  if (symptoms.some((s) => MODIFY.includes(s))) {
    return {
      level: 'modify',
      title: 'Let’s make the next sessions easier',
      message:
        'Heavy soreness, fatigue or a workout that felt too hard means your body needs more recovery. BODYQUEST will suggest easier variations and fewer sets, and you can swap your next session for a mobility day. Prioritise sleep, food and fluids.',
      actions: ['Take an extra rest or mobility day', 'Accept easier variations next session', 'Review sleep and nutrition'],
    };
  }
  return {
    level: 'ok',
    title: 'Normal response to training',
    message: 'Mild muscle soreness 1–2 days after training is normal, especially when starting out. Gentle movement, sleep and good nutrition help it settle.',
    actions: ['Continue your plan', 'Warm up thoroughly next time'],
  };
}

// ---------------------------------------------------------------------------
// Free-text red flags (coach)
// ---------------------------------------------------------------------------

const RED_FLAG_PATTERNS: Array<{ re: RegExp; symptom: Symptom }> = [
  { re: /chest\s*(pain|tight|pressure|hurt)|pain in (my )?chest|heart attack/i, symptom: 'chest-pain' },
  { re: /faint|pass(ed)? out|black(ed)? out|dizz|light[- ]?headed|collapse/i, symptom: 'faint-dizzy' },
  { re: /can'?t breathe|cannot breathe|struggling to breathe|short(ness)? of breath/i, symptom: 'breathless-severe' },
  { re: /palpitation|heart (is )?(racing|pounding|skipping)|irregular heart/i, symptom: 'palpitations' },
  { re: /sharp pain|stabbing|sudden pain|popped|pop in|tore|torn|numb|tingling|pins and needles/i, symptom: 'sharp-pain' },
  { re: /(knee|back|shoulder|wrist|ankle|elbow|hip|neck|joint)s? (pain|hurts?|aches?)|pain in (my )?(knee|back|shoulder|wrist|ankle|elbow|hip|neck)/i, symptom: 'joint-pain' },
];

export function detectRedFlags(text: string): Symptom[] {
  return Array.from(new Set(RED_FLAG_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.symptom)));
}
