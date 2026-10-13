import type { BodyGoalId, PrimaryGoal } from '../domain/types';

export interface BodyGoalInfo {
  id: BodyGoalId;
  name: string;
  description: string;
  emphasis: string;
  /** Silhouette proportions for the illustration (purely stylistic). */
  shape: { shoulders: number; waist: number; hips: number; arm: number; leg: number; highlight: Array<'shoulders' | 'arms' | 'chest' | 'core' | 'legs' | 'whole'> };
}

export const BODY_GOALS: BodyGoalInfo[] = [
  {
    id: 'lean-athletic',
    name: 'Lean athletic physique',
    description: 'Light, agile and conditioned — built for movement and endurance.',
    emphasis: 'More conditioning intervals, full-body strength, core stability.',
    shape: { shoulders: 46, waist: 29, hips: 31, arm: 9, leg: 13, highlight: ['core', 'legs'] },
  },
  {
    id: 'muscular-athletic',
    name: 'Muscular athletic physique',
    description: 'Visible muscle with athletic capability — strong and quick.',
    emphasis: 'Strength-focused sessions with some extra volume and short conditioning finishers.',
    shape: { shoulders: 56, waist: 32, hips: 33, arm: 12, leg: 15, highlight: ['chest', 'arms', 'legs'] },
  },
  {
    id: 'balanced-muscular',
    name: 'Balanced muscular physique',
    description: 'Even development from head to toe; no weak links.',
    emphasis: 'Equal push, pull, squat and hinge volume.',
    shape: { shoulders: 52, waist: 33, hips: 35, arm: 11, leg: 15, highlight: ['whole'] },
  },
  {
    id: 'broad-shoulders',
    name: 'Broad-shouldered upper body',
    description: 'Upper-body emphasis: shoulders, chest and upper back.',
    emphasis: 'Extra push and upper-back work (pike push-ups, Y-T-W raises) while keeping legs trained.',
    shape: { shoulders: 62, waist: 32, hips: 33, arm: 12, leg: 13.5, highlight: ['shoulders', 'chest'] },
  },
  {
    id: 'strong-lower',
    name: 'Strong lower body',
    description: 'Powerful legs and glutes for strength, stability and sport.',
    emphasis: 'Extra squat, lunge and hinge work with calf and core support.',
    shape: { shoulders: 47, waist: 32, hips: 39, arm: 10, leg: 19, highlight: ['legs'] },
  },
  {
    id: 'strength-fitness',
    name: 'Overall strength & fitness',
    description: 'Capable and resilient — performance over appearance.',
    emphasis: 'Harder variations, lower reps and fuller rest; performance tests every month.',
    shape: { shoulders: 55, waist: 37, hips: 38, arm: 13, leg: 17, highlight: ['whole'] },
  },
  {
    id: 'beginner-general',
    name: 'Beginner general fitness',
    description: 'Feel better, move better and build a habit you can keep.',
    emphasis: 'Technique practice, manageable sessions, mobility and consistency.',
    shape: { shoulders: 45, waist: 35, hips: 36, arm: 9.5, leg: 13.5, highlight: ['core'] },
  },
];

export const BODY_GOAL_MAP = Object.fromEntries(BODY_GOALS.map((g) => [g.id, g])) as Record<BodyGoalId, BodyGoalInfo>;

export const PRIMARY_GOALS: Array<{ id: PrimaryGoal; name: string; description: string }> = [
  { id: 'build-muscle', name: 'Build muscle', description: 'Add muscle with progressive bodyweight training.' },
  { id: 'lean-athletic', name: 'Lean & athletic', description: 'Conditioning plus strength for an athletic build.' },
  { id: 'overall-fitness', name: 'Improve overall fitness', description: 'Feel fitter, stronger and more energetic.' },
  { id: 'strength', name: 'Improve strength', description: 'Harder variations and quality reps.' },
  { id: 'endurance', name: 'Muscular endurance', description: 'Last longer — more reps, longer holds.' },
  { id: 'mobility', name: 'Mobility & flexibility', description: 'Move freely with less stiffness.' },
  { id: 'recomp', name: 'Reduce fat, keep muscle', description: 'Gradual fat loss while maintaining strength.' },
  { id: 'balanced', name: 'Balanced physique', description: 'Even development across the whole body.' },
];

export const GOAL_NAME = Object.fromEntries(PRIMARY_GOALS.map((g) => [g.id, g.name])) as Record<PrimaryGoal, string>;

export function suggestedBodyGoal(goal: PrimaryGoal, experience: string): BodyGoalId {
  if (experience === 'beginner' && (goal === 'overall-fitness' || goal === 'mobility')) return 'beginner-general';
  switch (goal) {
    case 'build-muscle':
      return 'muscular-athletic';
    case 'lean-athletic':
    case 'endurance':
    case 'recomp':
      return 'lean-athletic';
    case 'strength':
      return 'strength-fitness';
    case 'balanced':
      return 'balanced-muscular';
    default:
      return 'beginner-general';
  }
}
