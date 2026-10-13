import type { CefrLevel, Feature, PlanId } from '@fluentpath/shared';

export interface Profile {
  userId: string;
  displayName: string;
  bio: string;
  nativeLanguage: string | null;
  preferredLanguage: string | null;
  goals: string[];
  preferredActivities: string[];
  ieltsModule: 'academic' | 'general' | null;
  ieltsTargetBand: number | null;
  ieltsExamDate: string | null;
  confidence: number | null;
  cefrLevel: CefrLevel | null;
  cefrAssessedAt: string | null;
  onboardingCompleted: boolean;
  timezone: string;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  dailyGoalMinutes: number;
  notifyEmail: boolean;
  notifyStreak: boolean;
  notifyFeedback: boolean;
  notifyProduct: boolean;
  allowCalls: boolean;
  showLevelInCalls: boolean;
  profileVisibleOnLeaderboard: boolean;
}

export interface Me {
  id: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  hasPassword: boolean;
  googleLinked: boolean;
  profile: Profile;
  settings: Settings;
  plan: PlanId;
  subscription: { plan: PlanId; status: string; provider: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  limits: Record<Feature, number | null>;
  usage: Partial<Record<Feature, number>>;
}

export interface Integrations {
  ai: boolean;
  email: boolean;
  googleAuth: boolean;
  payments: boolean;
  devSubscriptions: boolean;
  turn: boolean;
  ocr: boolean;
  dictionary: boolean;
}
