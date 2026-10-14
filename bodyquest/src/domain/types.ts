/**
 * BODYQUEST domain model.
 *
 * These types mirror the relational entities a production backend would store
 * (User, UserProfile, TrainingPlan, TrainingPhase, Workout, WorkoutExercise,
 * Exercise, WorkoutSession, WorkoutSet, DailyChecklist, MealPlan, Meal, FoodLog,
 * HydrationLog, Streak, Achievement, UserAchievement, Battle, BattleParticipant,
 * BattleEvent, ProgressEntry, Notification, RecoveryToken).
 *
 * Dates that represent a calendar day use the `DateKey` format "YYYY-MM-DD" in the
 * user's local time zone. Instants use ISO-8601 strings.
 */

export type ID = string;
export type DateKey = string; // YYYY-MM-DD
export type ISODateTime = string;
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

// ---------------------------------------------------------------------------
// Users & profile
// ---------------------------------------------------------------------------

export interface User {
  id: ID;
  email: string;
  displayName: string;
  /** PBKDF2 hash (demo auth only — see store/auth.ts). Guests have none. */
  passwordHash?: string;
  salt?: string;
  isGuest: boolean;
  /** Demo account with generated sample history. */
  isDemo?: boolean;
  createdAt: ISODateTime;
}

export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very-active';
export type SexForCalc = 'female' | 'male' | 'unspecified';
export type Region = 'BD' | 'IN' | 'PK' | 'GB' | 'US' | 'MENA' | 'EAST_ASIA' | 'OTHER';
export type UnitSystem = 'metric' | 'imperial';

export type Limitation =
  | 'knee'
  | 'lower-back'
  | 'shoulder'
  | 'wrist'
  | 'neck'
  | 'ankle'
  | 'no-high-impact'
  | 'balance'
  | 'no-floor-work'
  | 'pregnancy'
  | 'recent-surgery';

export type DietPreference =
  | 'omnivore'
  | 'halal'
  | 'vegetarian'
  | 'eggetarian'
  | 'pescatarian'
  | 'vegan';

export type Allergen =
  | 'dairy'
  | 'egg'
  | 'fish'
  | 'shellfish'
  | 'peanut'
  | 'tree-nut'
  | 'gluten'
  | 'soy'
  | 'sesame';

export type PrimaryGoal =
  | 'build-muscle'
  | 'lean-athletic'
  | 'overall-fitness'
  | 'strength'
  | 'endurance'
  | 'mobility'
  | 'recomp' // reduce body fat while maintaining muscle
  | 'balanced';

export type BodyGoalId =
  | 'lean-athletic'
  | 'muscular-athletic'
  | 'balanced-muscular'
  | 'broad-shoulders'
  | 'strong-lower'
  | 'strength-fitness'
  | 'beginner-general';

export type TrainingPattern =
  | 'full-body'
  | 'upper-lower'
  | 'push-pull-legs'
  | 'strength-conditioning'
  | 'athletic-conditioning'
  | 'mobility-general';

export type TimelineMonths = 3 | 6 | 12 | 24;

/** PAR-Q+-inspired readiness screen. Any "true" triggers a medical-clearance notice. */
export interface ReadinessScreen {
  heartConditionOrSupervised: boolean;
  chestPainOnActivity: boolean;
  dizzinessOrFainting: boolean;
  otherMedicalReason: boolean;
}

export interface UserProfile {
  userId: ID;
  displayName: string;
  age: number;
  heightCm: number;
  weightKg: number;
  unitSystem: UnitSystem;
  sex: SexForCalc;
  region: Region;
  experience: Experience;
  activityLevel: ActivityLevel;
  sleepHours: number;
  dailyMinutes: 15 | 20 | 30 | 45 | 60;
  trainingDays: Weekday[];
  limitations: Limitation[];
  limitationNotes: string;
  readiness: ReadinessScreen;
  diet: DietPreference;
  allergies: Allergen[];
  primaryGoal: PrimaryGoal;
  secondaryGoal: PrimaryGoal | null;
  bodyGoal: BodyGoalId;
  trainingPattern: TrainingPattern;
  timelineMonths: TimelineMonths;
  avatar: AvatarChoice;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AvatarChoice {
  emoji: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Exercise library
// ---------------------------------------------------------------------------

export type ExerciseCategory =
  | 'push'
  | 'pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'calf'
  | 'core'
  | 'conditioning'
  | 'mobility'
  | 'stretch'
  | 'warmup';

export type Equipment = 'none' | 'wall' | 'chair' | 'towel' | 'step';

export type Muscle =
  | 'chest'
  | 'shoulders'
  | 'triceps'
  | 'biceps'
  | 'upper-back'
  | 'lats'
  | 'lower-back'
  | 'core'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'hip-flexors'
  | 'full-body'
  | 'cardio';

export interface Dose {
  sets: number;
  /** Rep range for rep-based work. */
  reps?: [number, number];
  /** Seconds for timed work. */
  seconds?: number;
}

export interface ExerciseInstructions {
  startingPosition: string;
  steps: string[];
  alignment: string[];
  breathing: string;
  commonMistakes: string[];
  safetyNotes: string[];
  beginnerModification: string;
  progressionOption: string;
}

export interface Exercise {
  id: ID;
  name: string;
  category: ExerciseCategory;
  muscles: Muscle[];
  equipment: Equipment[];
  /** 1 (easiest) – 5 (hardest). */
  difficulty: 1 | 2 | 3 | 4 | 5;
  impact: 'low' | 'high';
  measure: 'reps' | 'time';
  unilateral: boolean;
  instructions: ExerciseInstructions;
  /** Dosing guidance by experience level. */
  dosing: Record<Experience, Dose>;
  restSec: number;
  /** Limitations for which this exercise is excluded by the planning engine. */
  contraindications: Limitation[];
  /** Limitations for which it is allowed but with an extra caution message. */
  cautions: Partial<Record<Limitation, string>>;
  easier: ID[];
  harder: ID[];
  /** Illustration frames; each refers to a pose id in illustrations/poses.ts. */
  frames: IllustrationFrame[];
  tags: string[];
  /** Estimated seconds per rep, used for time budgeting. */
  secondsPerRep: number;
}

export interface IllustrationFrame {
  pose: string;
  label: string;
  props?: Array<'wall' | 'chair' | 'mat' | 'step'>;
}

// ---------------------------------------------------------------------------
// Plans & workouts
// ---------------------------------------------------------------------------

export interface TrainingPhase {
  index: number;
  name: string;
  focus: string;
  startWeek: number; // 1-based, inclusive
  endWeek: number; // inclusive
  /** Max difficulty step above the user's base level allowed during this phase. */
  difficultyAllowance: number;
  /** Additional sets (can be negative) applied to main exercises. */
  setModifier: number;
  /** Every Nth week is a lighter "deload" week (0 = none). */
  deloadEvery: number;
}

export interface Milestone {
  month: number;
  title: string;
  description: string;
}

export interface TrainingPlan {
  id: ID;
  userId: ID;
  pattern: TrainingPattern;
  recommendedPattern: TrainingPattern;
  trainingDays: Weekday[];
  startDate: DateKey;
  timelineMonths: TimelineMonths;
  phases: TrainingPhase[];
  milestones: Milestone[];
  /** Ordered session templates; training days cycle through these. */
  rotation: SessionTemplateId[];
  /** Resolved template for each training weekday (after recovery checks). */
  weekTemplate: Partial<Record<Weekday, SessionTemplateId>>;
  /** Weekly templates over time, so past days keep the schedule that applied then. */
  scheduleHistory: Array<{ from: DateKey; weekTemplate: Partial<Record<Weekday, SessionTemplateId>> }>;
  /** Notes explaining why the engine made its choices. */
  rationale: string[];
  /** True when the readiness screen requires medical clearance → low-intensity only. */
  lowIntensityOnly: boolean;
  createdAt: ISODateTime;
  version: number;
}

export type SessionTemplateId =
  | 'full-a'
  | 'full-b'
  | 'upper'
  | 'lower'
  | 'push'
  | 'pull'
  | 'legs'
  | 'strength-a'
  | 'strength-b'
  | 'athletic-a'
  | 'athletic-b'
  | 'mobility-a'
  | 'mobility-b'
  | 'technique'
  | 'comeback-mobility'
  | 'comeback-technique';

export type WorkoutBlock = 'warmup' | 'main' | 'cooldown';

export interface WorkoutExercise {
  id: ID; // stable within a workout, e.g. "main-2"
  exerciseId: ID;
  /** The engine's slot exercise before any accepted progression/variation. */
  baseExerciseId: ID;
  block: WorkoutBlock;
  sets: number;
  reps?: [number, number];
  /** Personal target within the rep range (driven by accepted progressions). */
  targetReps?: number;
  seconds?: number;
  restSec: number;
  note?: string;
}

export interface Workout {
  id: ID; // "w-YYYY-MM-DD" or "alt-..." for comeback sessions
  date: DateKey;
  templateId: SessionTemplateId;
  title: string;
  objective: string;
  estimatedMinutes: number;
  intensity: 'hard' | 'moderate' | 'light';
  phaseName: string;
  isDeloadWeek: boolean;
  exercises: WorkoutExercise[];
  recoveryAdvice: string[];
  xpAvailable: number;
}

export type SetRating = 1 | 2 | 3 | 4 | 5; // 1 very easy … 5 too hard

export interface WorkoutSet {
  setIndex: number;
  repsDone?: number;
  secondsDone?: number;
  rating?: SetRating;
  completedAt: ISODateTime;
}

export type SkipReason = 'pain' | 'too-difficult' | 'no-space' | 'no-time' | 'other';

export interface ExerciseProgress {
  workoutExerciseId: ID;
  /** Exercise actually performed (differs from planned when replaced). */
  performedExerciseId: ID;
  replacedFrom?: ID;
  sets: WorkoutSet[];
  completed: boolean;
  skipped?: { reason: SkipReason; note?: string };
}

export type SessionStatus = 'not-started' | 'in-progress' | 'paused' | 'completed' | 'ended-early';

export interface WorkoutSession {
  id: ID;
  workoutId: ID;
  /** The planned date this session fulfils (may differ from the day it was done). */
  plannedDate: DateKey;
  performedDate: DateKey | null;
  kind: 'planned' | 'comeback' | 'mobility';
  status: SessionStatus;
  startedAt: ISODateTime | null;
  finishedAt: ISODateTime | null;
  /** Accumulated active milliseconds (excludes paused time). */
  activeMs: number;
  /** When the current running segment started (null while paused / not running). */
  segmentStartedAt: ISODateTime | null;
  progress: Record<ID, ExerciseProgress>;
  /** Snapshot of the workout so refreshes/replacements stay consistent. */
  workout: Workout;
  symptomReport?: SymptomReport;
  completionRatio: number;
  xpAwarded: number;
}

export type Symptom =
  | 'normal-soreness'
  | 'excessive-soreness'
  | 'fatigue'
  | 'too-difficult'
  | 'joint-pain'
  | 'sharp-pain'
  | 'chest-pain'
  | 'faint-dizzy'
  | 'breathless-severe'
  | 'palpitations';

export interface SymptomReport {
  symptoms: Symptom[];
  note: string;
  reportedAt: ISODateTime;
}

/** Per-exercise progression state maintained by the progression service. */
export interface ExerciseProgression {
  exerciseId: ID;
  /** Replacement chosen by the user/engine for this slot's base exercise. */
  variationId: ID;
  /** Extra reps on top of the dose's lower bound (0..range). */
  repBonus: number;
  /** Pending suggestion awaiting user acceptance. */
  suggestion?: ProgressionSuggestion;
  updatedAt: ISODateTime;
}

export interface ProgressionSuggestion {
  kind: 'add-reps' | 'harder-variation' | 'easier-variation' | 'hold';
  targetExerciseId?: ID;
  reason: string;
}

// ---------------------------------------------------------------------------
// Schedule, streaks & recovery
// ---------------------------------------------------------------------------

export type DayResolution =
  | 'rescheduled' // moved to another date
  | 'comeback' // approved lighter session completed
  | 'token' // recovery token used
  | 'unwell' // illness / medical rest (never counted as failure)
  | 'acknowledged-missed'; // user chose to resume normal schedule

export interface DayOverride {
  date: DateKey;
  resolution: DayResolution;
  /** For reschedules: the date the session was moved to. */
  movedTo?: DateKey;
  note?: string;
  createdAt: ISODateTime;
}

export type DayStatus =
  | 'completed'
  | 'rest'
  | 'scheduled' // today or future
  | 'overdue' // past, within completion window, unresolved
  | 'missed'
  | 'excused' // unwell / medical rest
  | 'protected' // recovery token
  | 'comeback' // approved alternative completed
  | 'rescheduled' // moved away (neutral)
  | 'before-plan';

export interface RecoveryToken {
  id: ID;
  earnedAt: ISODateTime;
  reason: string;
  usedOn?: DateKey;
}

export interface StreakSummary {
  current: number;
  longest: number;
  weeklyCompletionPct: number;
  weekScheduled: number;
  weekKept: number;
}

// ---------------------------------------------------------------------------
// Nutrition & hydration
// ---------------------------------------------------------------------------

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface NutritionPerServing {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Food {
  id: ID;
  name: string;
  localName?: string;
  serving: string; // human description e.g. "1 cup cooked (≈160 g)"
  grams: number | null;
  nutrition: NutritionPerServing | null; // null = unknown / too variable
  dietTags: DietPreference[]; // diets this food is compatible with
  allergens: Allergen[];
  regions: Region[] | 'all';
  cost: 'low' | 'medium' | 'high';
  category: 'grain' | 'protein' | 'dairy' | 'legume' | 'vegetable' | 'fruit' | 'fat' | 'mixed' | 'beverage';
}

export interface MealItem {
  foodId: ID;
  servings: number;
}

export interface Meal {
  id: ID;
  slot: MealSlot;
  name: string;
  regions: Region[] | 'all';
  items: MealItem[];
  preparation: string;
  affordableAlternatives: string[];
  tags: string[];
}

export interface MealPlanDay {
  date: DateKey;
  /** Chosen meal id per slot (absent → engine default). */
  selections: Partial<Record<MealSlot, ID>>;
  /** Checklist state per slot. */
  eaten: Partial<Record<MealSlot, 'as-planned' | 'partly' | 'different' | 'skipped'>>;
}

export interface FoodLogEntry {
  id: ID;
  date: DateKey;
  slot: MealSlot;
  /** Either a database food… */
  foodId?: ID;
  servings?: number;
  /** …or a free-text item with optional user-entered values. */
  customName?: string;
  customNutrition?: Partial<NutritionPerServing>;
  /** Set when the entry was created from the suggested meal via the checklist. */
  fromMealId?: ID;
  createdAt: ISODateTime;
}

export type BeverageType = 'water' | 'tea-coffee' | 'milk' | 'juice' | 'other';

export interface HydrationEntry {
  id: ID;
  date: DateKey;
  ml: number;
  beverage: BeverageType;
  at: ISODateTime;
}

export interface HydrationSettings {
  /** User override of daily drinks target in ml (null → engine estimate). */
  customTargetMl: number | null;
  /** Doctor-advised fluid restriction in ml. Overrides everything when set. */
  medicalLimitMl: number | null;
  hotClimate: boolean;
  remindersEnabled: boolean;
  reminderIntervalMin: number;
}

// ---------------------------------------------------------------------------
// Gamification
// ---------------------------------------------------------------------------

export interface XpEvent {
  /** Idempotency key — the same key can only ever be awarded once. */
  key: string;
  amount: number;
  reason: string;
  at: ISODateTime;
}

export interface Achievement {
  id: ID;
  name: string;
  description: string;
  icon: string;
  xp: number;
  category: 'consistency' | 'training' | 'habits' | 'battles' | 'recovery';
}

export interface UserAchievement {
  achievementId: ID;
  unlockedAt: ISODateTime;
}

export interface Mission {
  id: ID;
  scope: 'daily' | 'weekly';
  title: string;
  description: string;
  xp: number;
  target: number;
}

export interface MissionProgress {
  mission: Mission;
  progress: number;
  complete: boolean;
  claimed: boolean;
}

// ---------------------------------------------------------------------------
// Battles
// ---------------------------------------------------------------------------

export interface DemoOpponent {
  id: ID;
  username: string;
  avatar: AvatarChoice;
  goal: PrimaryGoal;
  experience: Experience;
  trainingDaysPerWeek: number;
  dailyMinutes: number;
  ageBand: 'teen' | 'adult' | 'masters';
  /** Probability (0..1) of keeping each scheduled session — drives the simulation. */
  reliability: number;
  lastActiveDaysAgo: number;
  bio: string;
  isDemo: true;
}

export type BattleStatus = 'invited' | 'pending-acceptance' | 'active' | 'completed' | 'declined' | 'cancelled';

export interface BattleParticipant {
  id: ID; // user id or demo opponent id
  username: string;
  avatar: AvatarChoice;
  isDemo: boolean;
}

export interface Battle {
  id: ID;
  status: BattleStatus;
  createdAt: ISODateTime;
  /** Who initiated: 'me' or the demo opponent id. */
  initiatedBy: 'me' | ID;
  opponentId: ID;
  sharedGoal: PrimaryGoal;
  durationDays: 7 | 14;
  startDate: DateKey | null;
  endDate: DateKey | null; // inclusive
  participants: BattleParticipant[];
  /** Final results snapshot once completed. */
  result?: BattleResult;
}

export interface BattleEvent {
  id: ID;
  battleId: ID;
  participantId: ID;
  date: DateKey;
  kind: 'session' | 'warmup' | 'challenge' | 'mobility';
  /** Idempotency key so the same activity is never counted twice. */
  key: string;
}

export interface BattleScoreBreakdown {
  participantId: ID;
  scheduledSessions: number;
  keptSessions: number;
  warmups: number;
  challenges: number;
  mobility: number;
  sessionPoints: number;
  warmupPoints: number;
  challengePoints: number;
  mobilityPoints: number;
  total: number;
  consistencyPct: number;
}

export interface BattleResult {
  scores: BattleScoreBreakdown[];
  outcome: 'win' | 'loss' | 'tie';
  decidedAt: ISODateTime;
}

export interface WeeklyChallenge {
  id: ID;
  title: string;
  description: string;
  /** How completion is verified. */
  check: 'warmups-3' | 'mobility-2' | 'all-planned' | 'hydration-4' | 'food-log-4' | 'technique-1';
}

// ---------------------------------------------------------------------------
// Progress, notifications, settings
// ---------------------------------------------------------------------------

export type MeasurementKey = 'weightKg' | 'waistCm' | 'chestCm' | 'hipsCm' | 'armCm' | 'thighCm';
export type PerformanceKey = 'pushupMaxReps' | 'plankSeconds' | 'squats60s' | 'wallSitSeconds';

export interface ProgressEntry {
  id: ID;
  date: DateKey;
  measurements: Partial<Record<MeasurementKey, number>>;
  performance: Partial<Record<PerformanceKey, number>>;
  sleepHours?: number;
  note?: string;
  createdAt: ISODateTime;
}

export interface ProgressPhotoMeta {
  id: ID;
  date: DateKey;
  note: string;
  createdAt: ISODateTime;
}

export type NotificationKind =
  | 'battle-invite'
  | 'battle-update'
  | 'battle-result'
  | 'opponent-workout'
  | 'achievement'
  | 'level-up'
  | 'missed-session'
  | 'reminder'
  | 'system';

export interface AppNotification {
  id: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  link?: string;
  createdAt: ISODateTime;
  read: boolean;
  /** Idempotency key to avoid duplicate notifications. */
  key: string;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  reducedMotion: boolean;
  trackBodyWeight: boolean;
  hideMeasurements: boolean;
  showOnLeaderboard: boolean;
  allowBattleInvites: boolean;
  coachUsesProfile: boolean;
  /** Development-only clock offset in days to simulate the passage of time. */
  devDayOffset: number;
}

export interface CoachMessage {
  id: ID;
  role: 'user' | 'coach';
  text: string;
  at: ISODateTime;
  links?: Array<{ label: string; to: string }>;
  urgent?: boolean;
}
