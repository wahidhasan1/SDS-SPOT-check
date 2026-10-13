import type { UserProfile } from '@app/shared';
import { one, pool, type Queryable } from '../db/pool';
import { notFound } from '../lib/errors';

export async function loadProfile(userId: string, db: Queryable = pool): Promise<UserProfile> {
  const r = await one<any>(
    `SELECT u.id, u.email, u.display_name, u.anon_name, u.avatar, u.role, u.birth_year, u.created_at, p.*
     FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id=$1`,
    [userId],
    db,
  );
  if (!r) throw notFound('Account not found.');
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    anonName: r.anon_name,
    avatar: r.avatar,
    role: r.role,
    cefrLevel: r.cefr_level,
    levelAssessedAt: r.level_assessed_at ? new Date(r.level_assessed_at).toISOString() : null,
    goals: r.goals,
    testType: r.test_type,
    targetBand: r.target_band,
    interests: r.interests,
    nativeLanguage: r.native_language,
    translationLanguage: r.translation_language,
    onboardingCompleted: r.onboarding_completed,
    privacy: { showLevelToPartners: r.show_level_to_partners, showOnLeaderboard: r.show_on_leaderboard },
    notificationPrefs: {
      dailyReminder: r.notif_daily_reminder,
      reminderHour: r.notif_reminder_hour,
      vocabReview: r.notif_vocab_review,
      battleInvites: r.notif_battle_invites,
      streaks: r.notif_streaks,
    },
    timezone: r.timezone,
    birthYear: r.birth_year,
    streakDays: r.streak_days,
    battleRating: r.battle_rating,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export function ageFromBirthYear(birthYear: number | null): number | null {
  if (!birthYear) return null;
  return new Date().getUTCFullYear() - birthYear;
}
