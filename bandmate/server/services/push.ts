import webpush from 'web-push'
import { db } from '../db/index.ts'
import { env } from '../env.ts'
import { notify, onNotify, streak } from '../lib/events.ts'
import { dayKey, now } from '../lib/util.ts'

export const pushReady = () => !!(env.vapidPublic && env.vapidPrivate)

if (pushReady()) webpush.setVapidDetails(env.vapidSubject, env.vapidPublic, env.vapidPrivate)

/** Sends a Web Push message to every browser the user enabled. Expired endpoints are removed. */
export async function pushTo(userId: string, n: { title: string; body?: string; link?: string; kind: string }) {
  if (!pushReady()) return 0
  const enabled = db().one<{ push_enabled: number }>('SELECT push_enabled FROM profiles WHERE user_id = ?', userId)?.push_enabled
  if (!enabled) return 0
  const subs = db().all<{ endpoint: string; keys: string }>('SELECT endpoint, keys FROM push_subscriptions WHERE user_id = ?', userId)
  let sent = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: JSON.parse(s.keys) as { p256dh: string; auth: string } }, JSON.stringify({ title: n.title, body: n.body ?? '', url: n.link ?? '/', tag: n.kind }), { TTL: 3600 })
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) db().run('DELETE FROM push_subscriptions WHERE endpoint = ?', s.endpoint)
      }
    }),
  )
  return sent
}

// Kinds that are worth a push (in-app notifications are stored for everything).
const PUSH_KINDS = new Set(['reminder', 'billing', 'moderation', 'battle'])
onNotify((userId, n) => {
  if (PUSH_KINDS.has(n.kind)) void pushTo(userId, n)
})

/**
 * Daily practice reminders at the hour each learner chose (in their own time zone),
 * only if they haven't practised yet today. At most one per day.
 */
export function sendDueReminders(at = now()) {
  const rows = db().all<{ user_id: string; reminder_hour: number; timezone_offset: number; last_reminder_day: string | null }>(
    "SELECT p.user_id, p.reminder_hour, p.timezone_offset, p.last_reminder_day FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.reminders_enabled = 1 AND p.reminder_hour IS NOT NULL AND u.status = 'active'",
  )
  let n = 0
  for (const r of rows) {
    const local = new Date(at + r.timezone_offset * 60_000)
    const today = dayKey(r.timezone_offset, at)
    if (local.getUTCHours() !== r.reminder_hour || r.last_reminder_day === today) continue
    db().run('UPDATE profiles SET last_reminder_day = ? WHERE user_id = ?', today, r.user_id)
    const s = streak(r.user_id)
    if (s.practicedToday) continue
    notify(r.user_id, {
      kind: 'reminder',
      title: s.current > 0 ? `Keep your ${s.current}-day streak going` : 'Time for a little English practice',
      body: 'A 5-minute vocabulary review or one speaking question is enough for today.',
      link: '/',
    })
    n++
  }
  return n
}

let timer: NodeJS.Timeout | null = null
export function startReminderScheduler() {
  if (timer) return
  timer = setInterval(() => {
    try {
      sendDueReminders()
    } catch (e) {
      console.error('reminder scheduler', e)
    }
  }, 5 * 60_000)
  timer.unref()
}
