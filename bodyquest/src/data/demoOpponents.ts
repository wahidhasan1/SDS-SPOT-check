import type { DemoOpponent } from '../domain/types';

/**
 * DEMO OPPONENTS — these are fictional sample users for development and demonstration.
 * Their activity is simulated deterministically on this device. BODYQUEST does not have a
 * live multiplayer community until a real backend with authentication is connected.
 */
export const DEMO_OPPONENTS: DemoOpponent[] = [
  { id: 'demo-rafi', username: 'Rafi_Rises', avatar: { emoji: '🦁', color: '#f59e0b' }, goal: 'build-muscle', experience: 'beginner', trainingDaysPerWeek: 3, dailyMinutes: 30, ageBand: 'adult', reliability: 0.78, lastActiveDaysAgo: 0, bio: 'Desk job, home workouts before office.', isDemo: true },
  { id: 'demo-nadia', username: 'NadiaMoves', avatar: { emoji: '🦊', color: '#ef4444' }, goal: 'lean-athletic', experience: 'intermediate', trainingDaysPerWeek: 4, dailyMinutes: 30, ageBand: 'adult', reliability: 0.82, lastActiveDaysAgo: 1, bio: 'Training around university classes.', isDemo: true },
  { id: 'demo-tanvir', username: 'Tanvir.Strong', avatar: { emoji: '🐻', color: '#8b5cf6' }, goal: 'strength', experience: 'intermediate', trainingDaysPerWeek: 3, dailyMinutes: 45, ageBand: 'adult', reliability: 0.7, lastActiveDaysAgo: 0, bio: 'Chasing my first 30 push-ups.', isDemo: true },
  { id: 'demo-mei', username: 'MeiFlow', avatar: { emoji: '🐼', color: '#10b981' }, goal: 'mobility', experience: 'beginner', trainingDaysPerWeek: 3, dailyMinutes: 20, ageBand: 'adult', reliability: 0.85, lastActiveDaysAgo: 2, bio: 'Mobility first, then strength.', isDemo: true },
  { id: 'demo-sam', username: 'SamTheSteady', avatar: { emoji: '🐢', color: '#0ea5e9' }, goal: 'overall-fitness', experience: 'beginner', trainingDaysPerWeek: 3, dailyMinutes: 20, ageBand: 'adult', reliability: 0.75, lastActiveDaysAgo: 0, bio: 'Slow and steady wins.', isDemo: true },
  { id: 'demo-ayesha', username: 'Ayesha_Fit', avatar: { emoji: '🦋', color: '#ec4899' }, goal: 'recomp', experience: 'intermediate', trainingDaysPerWeek: 4, dailyMinutes: 45, ageBand: 'adult', reliability: 0.8, lastActiveDaysAgo: 1, bio: 'Working mum, 45 minutes when the kids sleep.', isDemo: true },
  { id: 'demo-omar', username: 'OmarOnTrack', avatar: { emoji: '🐺', color: '#64748b' }, goal: 'build-muscle', experience: 'advanced', trainingDaysPerWeek: 5, dailyMinutes: 45, ageBand: 'adult', reliability: 0.86, lastActiveDaysAgo: 0, bio: 'Calisthenics enthusiast.', isDemo: true },
  { id: 'demo-lina', username: 'LinaLifts', avatar: { emoji: '🦄', color: '#a855f7' }, goal: 'balanced', experience: 'intermediate', trainingDaysPerWeek: 4, dailyMinutes: 30, ageBand: 'adult', reliability: 0.77, lastActiveDaysAgo: 3, bio: 'Balance in training and life.', isDemo: true },
  { id: 'demo-karim', username: 'KarimKeepsGoing', avatar: { emoji: '🐯', color: '#f97316' }, goal: 'endurance', experience: 'advanced', trainingDaysPerWeek: 5, dailyMinutes: 60, ageBand: 'masters', reliability: 0.83, lastActiveDaysAgo: 0, bio: '52 and fitter than ever.', isDemo: true },
  { id: 'demo-joy', username: 'JoyJumps', avatar: { emoji: '🐰', color: '#22c55e' }, goal: 'overall-fitness', experience: 'beginner', trainingDaysPerWeek: 3, dailyMinutes: 20, ageBand: 'teen', reliability: 0.72, lastActiveDaysAgo: 1, bio: 'School sports + home training.', isDemo: true },
  { id: 'demo-arif', username: 'ArifAthlete', avatar: { emoji: '🦅', color: '#06b6d4' }, goal: 'lean-athletic', experience: 'beginner', trainingDaysPerWeek: 3, dailyMinutes: 30, ageBand: 'teen', reliability: 0.79, lastActiveDaysAgo: 0, bio: 'Football fitness in the off-season.', isDemo: true },
  { id: 'demo-grace', username: 'GraceGrows', avatar: { emoji: '🌻', color: '#eab308' }, goal: 'strength', experience: 'beginner', trainingDaysPerWeek: 2, dailyMinutes: 30, ageBand: 'masters', reliability: 0.88, lastActiveDaysAgo: 1, bio: 'Started at 61. Never too late.', isDemo: true },
];

export const OPPONENT_MAP: Record<string, DemoOpponent> = Object.fromEntries(DEMO_OPPONENTS.map((o) => [o.id, o]));
