import type {
  AppNotification,
  AppSettings,
  Battle,
  CoachMessage,
  DateKey,
  DayOverride,
  ExerciseProgression,
  FoodLogEntry,
  HydrationEntry,
  HydrationSettings,
  MealPlanDay,
  ProgressEntry,
  ProgressPhotoMeta,
  RecoveryToken,
  TrainingPlan,
  UserAchievement,
  UserProfile,
  WorkoutSession,
  XpEvent,
} from '../domain/types';
import type { StorageAdapter } from './storage';

/**
 * Per-user data, split into independently persisted slices (one storage key each),
 * mirroring the tables a production database would hold.
 */
export interface UserData {
  profile: UserProfile | null;
  plan: TrainingPlan | null;
  sessions: WorkoutSession[];
  progressions: Record<string, ExerciseProgression>;
  overrides: Record<DateKey, DayOverride>;
  tokens: RecoveryToken[];
  xp: XpEvent[];
  achievements: UserAchievement[];
  mealDays: Record<DateKey, MealPlanDay>;
  foodLog: FoodLogEntry[];
  hydration: HydrationEntry[];
  hydrationSettings: HydrationSettings;
  progress: ProgressEntry[];
  photos: ProgressPhotoMeta[];
  battles: Battle[];
  notifications: AppNotification[];
  settings: AppSettings;
  coach: CoachMessage[];
  /** Daily checklist ticks for habit items: date → item ids. */
  checklist: Record<DateKey, string[]>;
  /** Ids of onboarding draft data (wizard can be resumed after refresh). */
  draft: Partial<UserProfile> | null;
}

export type SliceKey = keyof UserData;

export const SLICES: SliceKey[] = [
  'profile',
  'plan',
  'sessions',
  'progressions',
  'overrides',
  'tokens',
  'xp',
  'achievements',
  'mealDays',
  'foodLog',
  'hydration',
  'hydrationSettings',
  'progress',
  'photos',
  'battles',
  'notifications',
  'settings',
  'coach',
  'checklist',
  'draft',
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  reducedMotion: false,
  trackBodyWeight: true,
  hideMeasurements: false,
  showOnLeaderboard: true,
  allowBattleInvites: true,
  coachUsesProfile: true,
  devDayOffset: 0,
};

export const DEFAULT_HYDRATION: HydrationSettings = {
  customTargetMl: null,
  medicalLimitMl: null,
  hotClimate: false,
  remindersEnabled: false,
  reminderIntervalMin: 90,
};

export function emptyUserData(): UserData {
  return {
    profile: null,
    plan: null,
    sessions: [],
    progressions: {},
    overrides: {},
    tokens: [],
    xp: [],
    achievements: [],
    mealDays: {},
    foodLog: [],
    hydration: [],
    hydrationSettings: { ...DEFAULT_HYDRATION },
    progress: [],
    photos: [],
    battles: [],
    notifications: [],
    settings: { ...DEFAULT_SETTINGS },
    coach: [],
    checklist: {},
    draft: null,
  };
}

export function loadUserData(store: StorageAdapter, userId: string): UserData {
  const d = emptyUserData();
  const out: Record<string, unknown> = { ...d };
  for (const k of SLICES) {
    const v = store.get(`u:${userId}:${k}`);
    if (v !== undefined) out[k] = v;
  }
  const data = out as unknown as UserData;
  // Forward-compatible merges for objects that may gain fields.
  data.settings = { ...DEFAULT_SETTINGS, ...data.settings };
  data.hydrationSettings = { ...DEFAULT_HYDRATION, ...data.hydrationSettings };
  return data;
}

/** Persist only slices whose reference changed. */
export function saveUserData(store: StorageAdapter, userId: string, prev: UserData | null, next: UserData): void {
  for (const k of SLICES) {
    if (!prev || prev[k] !== next[k]) {
      if (next[k] === null) store.remove(`u:${userId}:${k}`);
      else store.set(`u:${userId}:${k}`, next[k]);
    }
  }
}
