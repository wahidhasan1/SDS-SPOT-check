export interface Me {
  id: string;
  email: string;
  role: 'user' | 'admin';
  hasPassword: boolean;
  plan: 'free' | 'premium';
  subscription: { plan: string; status: string; provider: string; currentPeriodEnd: string | null } | null;
  limits: Record<string, number | null>;
  usage: Record<string, number>;
  profile: {
    displayName: string;
    cefrLevel: string | null;
    onboardingCompleted: boolean;
    ieltsModule: 'academic' | 'general' | null;
    ieltsTargetBand: number | null;
    goals: string[];
    preferredActivities: string[];
    nativeLanguage: string | null;
    preferredLanguage: string | null;
    timezone: string;
    bio: string;
  };
  settings: { theme: string; dailyGoalMinutes: number; allowCalls: boolean; showLevelInCalls: boolean; notifyEmail: boolean; notifyStreak: boolean; notifyFeedback: boolean };
}
