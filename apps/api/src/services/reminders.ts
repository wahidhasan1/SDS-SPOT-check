import { and, eq, gte, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { addDays, localDay } from '../lib/time';
import { notify } from './notifications';

function localHour(tz: string) {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date()));
  } catch {
    return new Date().getUTCHours();
  }
}

/**
 * Evening streak reminder: for users who studied yesterday but not yet today (in their own time zone),
 * after 18:00 local time, at most once per day.
 */
export async function runStreakReminders() {
  const since = new Date(Date.now() - 3 * 86400_000);
  const candidates = await db
    .selectDistinct({ userId: schema.activityLog.userId, tz: schema.profiles.timezone })
    .from(schema.activityLog)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.activityLog.userId))
    .innerJoin(schema.userSettings, eq(schema.userSettings.userId, schema.activityLog.userId))
    .innerJoin(schema.users, eq(schema.users.id, schema.activityLog.userId))
    .where(and(gte(schema.activityLog.createdAt, since), eq(schema.userSettings.notifyStreak, true), eq(schema.users.status, 'active')));
  let sent = 0;
  for (const c of candidates) {
    if (localHour(c.tz) < 18) continue;
    const today = localDay(c.tz);
    const yesterday = addDays(today, -1);
    const days = await db
      .selectDistinct({ day: schema.activityLog.day })
      .from(schema.activityLog)
      .where(and(eq(schema.activityLog.userId, c.userId), sql`${schema.activityLog.day} in (${today}, ${yesterday})`));
    const set = new Set(days.map((d) => d.day));
    if (set.has(today) || !set.has(yesterday)) continue;
    const [already] = await db
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, c.userId), eq(schema.notifications.type, 'streak'), gte(schema.notifications.createdAt, new Date(Date.now() - 20 * 3600_000))));
    if (already) continue;
    await notify(c.userId, { type: 'streak', title: 'Keep your streak going!', body: 'You have not studied today yet. A 5-minute flashcard review is enough to keep your streak.', link: '/vocabulary/review' });
    sent++;
  }
  return sent;
}

export function startReminderJob() {
  const t = setInterval(() => void runStreakReminders().catch(() => {}), 30 * 60_000);
  t.unref();
  return t;
}
