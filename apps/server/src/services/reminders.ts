import { q } from '../db/pool';
import { notify } from './notifications';

/**
 * Sends at most one study reminder and one vocabulary-review reminder per user per day,
 * at the user's chosen local hour, only if they have not practised yet today.
 */
export async function runReminderJob() {
  const due = await q<any>(
    `SELECT p.user_id, p.notif_daily_reminder, p.notif_vocab_review, p.streak_days, p.last_active_date,
            (now() AT TIME ZONE p.timezone)::date::text AS local_date,
            (SELECT count(*)::int FROM saved_words w WHERE w.user_id=p.user_id AND w.due_at <= now()) AS due_words
     FROM user_profiles p
     WHERE EXTRACT(HOUR FROM now() AT TIME ZONE p.timezone) = p.notif_reminder_hour
       AND (p.notif_daily_reminder OR p.notif_vocab_review)`,
  );
  for (const u of due) {
    const practisedToday = u.last_active_date === u.local_date;
    if (u.notif_daily_reminder && !practisedToday) {
      await notify({
        userId: u.user_id,
        kind: 'daily_reminder',
        title: u.streak_days > 0 ? `Keep your ${u.streak_days}-day streak going` : 'Time for a little English practice',
        body: 'A 10-minute session today keeps your progress moving.',
        dedupeKey: `daily:${u.local_date}`,
        push: true,
      });
    }
    if (u.notif_vocab_review && u.due_words > 0) {
      await notify({
        userId: u.user_id,
        kind: 'vocab_review',
        title: `${u.due_words} word${u.due_words === 1 ? '' : 's'} ready to review`,
        body: 'Reviewing at the right time helps words stick.',
        dedupeKey: `vocab:${u.local_date}`,
        push: true,
      });
    }
  }
}
