import { one, q, pool, type Queryable } from '../db/pool';

/**
 * Records a meaningful learning activity and maintains the daily streak in the
 * user's own timezone. Only real completions (submitted tests, finished calls,
 * reviews) are recorded — not page views.
 */
export async function recordActivity(
  userId: string,
  kind: string,
  refId: string | null = null,
  meta: Record<string, unknown> = {},
  db: Queryable = pool,
): Promise<void> {
  await q('INSERT INTO activity_log (user_id, kind, ref_id, meta) VALUES ($1,$2,$3,$4)', [userId, kind, refId, meta], db);
  const p = await one<{ timezone: string; last_active_date: string | null; streak_days: number }>(
    'SELECT timezone, last_active_date, streak_days FROM user_profiles WHERE user_id=$1',
    [userId],
    db,
  );
  if (!p) return;
  const today = await one<{ d: string }>(`SELECT (now() AT TIME ZONE $1)::date::text AS d`, [safeTz(p.timezone)], db);
  const todayStr = today!.d;
  if (p.last_active_date === todayStr) return;
  const yesterday = new Date(Date.parse(todayStr + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10);
  const streak = p.last_active_date === yesterday ? p.streak_days + 1 : 1;
  await q('UPDATE user_profiles SET last_active_date=$2, streak_days=$3 WHERE user_id=$1', [userId, todayStr, streak], db);
}

export function safeTz(tz: string | null | undefined): string {
  try {
    if (tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    }
  } catch {
    /* invalid tz */
  }
  return 'UTC';
}
