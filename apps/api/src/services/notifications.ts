import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db, schema } from '../db';
import { sendEmail } from './email';

type Kind = 'achievement' | 'feedback' | 'safety' | 'billing' | 'streak' | string;

/**
 * Create an in-app notification and, if the user opted in (and SMTP is configured), email it.
 * Achievements are in-app only.
 */
export async function notify(userId: string, n: { type: Kind; title: string; body: string; link?: string }) {
  await db.insert(schema.notifications).values({ userId, type: n.type, title: n.title, body: n.body, link: n.link ?? null });
  if (n.type === 'achievement' || !config.smtpUrl) return;
  const [row] = await db
    .select({ email: schema.users.email, s: schema.userSettings })
    .from(schema.users)
    .innerJoin(schema.userSettings, eq(schema.userSettings.userId, schema.users.id))
    .where(eq(schema.users.id, userId));
  if (!row || !row.s.notifyEmail) return;
  if (n.type === 'feedback' && !row.s.notifyFeedback) return;
  if (n.type === 'streak' && !row.s.notifyStreak) return;
  const link = n.link ? `\n\nOpen FluentPath: ${config.appUrl}${n.link}` : '';
  await sendEmail(row.email, n.title, `${n.body}${link}\n\nYou can change notification settings at ${config.appUrl}/settings`);
}
