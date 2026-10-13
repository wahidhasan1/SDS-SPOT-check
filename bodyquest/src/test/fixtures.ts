import type { UserProfile, Weekday } from '../domain/types';

export function makeProfile(over: Partial<UserProfile> = {}): UserProfile {
  return {
    userId: 'u1',
    displayName: 'Test User',
    age: 28,
    heightCm: 172,
    weightKg: 70,
    unitSystem: 'metric',
    sex: 'unspecified',
    region: 'BD',
    experience: 'beginner',
    activityLevel: 'light',
    sleepHours: 7,
    dailyMinutes: 30,
    trainingDays: [1, 3, 5] as Weekday[],
    limitations: [],
    limitationNotes: '',
    readiness: { heartConditionOrSupervised: false, chestPainOnActivity: false, dizzinessOrFainting: false, otherMedicalReason: false },
    diet: 'omnivore',
    allergies: [],
    primaryGoal: 'build-muscle',
    secondaryGoal: null,
    bodyGoal: 'balanced-muscular',
    trainingPattern: 'full-body',
    timelineMonths: 3,
    avatar: { emoji: '💪', color: '#c8f031' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}
