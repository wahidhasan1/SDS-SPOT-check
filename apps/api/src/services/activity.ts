import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { localDay } from '../lib/time';
import { checkAchievements } from './achievements';

export async function userTimezone(userId: string): Promise<string> {
  const [p] = await db.select({ tz: schema.profiles.timezone }).from(schema.profiles).where(eq(schema.profiles.userId, userId));
  return p?.tz ?? 'UTC';
}

/**
 * Record a learning activity. Drives the streak, daily activity chart, recent activity list and achievements.
 * xp is a simple implemented rule per activity type (documented in the dashboard help text).
 */
export async function logActivity(
  userId: string,
  a: { type: string; title: string; refId?: string | null; xp: number; minutes: number },
) {
  const tz = await userTimezone(userId);
  const day = localDay(tz);
  await db.insert(schema.activityLog).values({
    userId,
    type: a.type,
    title: a.title.slice(0, 200),
    refId: a.refId ?? null,
    xp: Math.max(0, Math.round(a.xp)),
    minutes: Math.max(0, Math.round(a.minutes * 10) / 10),
    day,
  });
  const fresh = await checkAchievements(userId, day);
  return { day, newAchievements: fresh };
}
