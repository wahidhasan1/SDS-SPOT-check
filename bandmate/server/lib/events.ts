import { db } from '../db/index.ts'
import { dayKey, now } from './util.ts'

export function audit(actorId: string | null, action: string, target: string | null, details: Record<string, unknown> = {}) {
  db().run('INSERT INTO audit_log (actor_id, action, target, details, created_at) VALUES (?, ?, ?, ?, ?)', actorId, action, target, JSON.stringify(details), now())
}

type Notifier = (userId: string, n: { kind: string; title: string; body?: string; link?: string }) => void
const listeners: Notifier[] = []
/** Real-time and push delivery hook in here (server/realtime/hub.ts, server/services/push.ts). */
export const onNotify = (fn: Notifier) => listeners.push(fn)

export function notify(userId: string, n: { kind: string; title: string; body?: string; link?: string }) {
  db().run('INSERT INTO notifications (user_id, kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?)', userId, n.kind, n.title, n.body ?? null, n.link ?? null, now())
  for (const l of listeners) {
    try {
      l(userId, n)
    } catch {
      /* delivery is best-effort; the notification is stored either way */
    }
  }
}

/** Marks today as an active learning day (drives the streak). Only meaningful activities call this. */
export function recordActivity(userId: string) {
  const off = db().one<{ o: number }>('SELECT timezone_offset AS o FROM profiles WHERE user_id = ?', userId)?.o ?? 0
  db().run(
    `INSERT INTO activity_days (user_id, day, activities) VALUES (?, ?, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET activities = activities + 1`,
    userId,
    dayKey(off),
  )
}

export function streak(userId: string) {
  const off = db().one<{ o: number }>('SELECT timezone_offset AS o FROM profiles WHERE user_id = ?', userId)?.o ?? 0
  const days = new Set(db().all<{ day: string }>('SELECT day FROM activity_days WHERE user_id = ? ORDER BY day DESC LIMIT 400', userId).map((r) => r.day))
  let n = 0
  let at = Date.now()
  // Today not done yet keeps yesterday's streak alive.
  if (!days.has(dayKey(off, at))) at -= 86400_000
  while (days.has(dayKey(off, at))) {
    n++
    at -= 86400_000
  }
  return { current: n, practicedToday: days.has(dayKey(off)) }
}
