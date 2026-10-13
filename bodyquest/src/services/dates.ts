import type { DateKey, Weekday } from '../domain/types';

/** Local-time calendar helpers. All functions are pure and timezone-safe for DateKeys. */

export function toDateKey(d: Date): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0); // noon avoids DST edge cases
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function diffDays(a: DateKey, b: DateKey): number {
  // a - b in whole days
  const ms = fromDateKey(a).getTime() - fromDateKey(b).getTime();
  return Math.round(ms / 86_400_000);
}

export function weekdayOf(key: DateKey): Weekday {
  return fromDateKey(key).getDay() as Weekday;
}

/** Monday-based start of the week containing `key`. */
export function startOfWeek(key: DateKey): DateKey {
  const wd = weekdayOf(key);
  const offset = (wd + 6) % 7; // Monday → 0
  return addDays(key, -offset);
}

export function rangeDays(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = [];
  const n = diffDays(end, start);
  for (let i = 0; i <= n; i++) out.push(addDays(start, i));
  return out;
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return toDateKey(fromDateKey(key)) === key;
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
/** Display order for week pickers (Monday first). */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function formatDate(key: DateKey, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  return fromDateKey(key).toLocaleDateString(undefined, opts);
}

export function monthKey(key: DateKey): string {
  return key.slice(0, 7);
}

/** Simple string hash → 32-bit int (stable, used for deterministic rotation). */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic PRNG in [0,1) from a seed string (mulberry32). */
export function seededRandom(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
