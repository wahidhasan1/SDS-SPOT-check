// Formatting helpers (BDT, dates, phone). en-IN grouping matches Bangladeshi lakh notation.
const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export const taka = (n: number) => `৳${nf.format(Math.round(n))}`

export const discounted = (price: number, pct: number) => Math.round((price * (100 - pct)) / 100 / 5) * 5

export const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const fmtDateTime = (t: number) =>
  new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })

export const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

export function timeAgo(t: number) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`
  return fmtDate(t)
}

export function fmtDuration(min: number) {
  if (min < 60) return `${Math.max(1, Math.round(min))} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h} hr ${m} min` : `${h} hr`
}

/** Normalise a Bangladeshi mobile number to +8801XXXXXXXXX, or null if invalid. */
export function normalizeBdPhone(input: string): string | null {
  const d = input.replace(/[^\d]/g, '')
  let local = d
  if (local.startsWith('880')) local = local.slice(3)
  if (local.startsWith('0')) local = local.slice(1)
  if (!/^1[3-9]\d{8}$/.test(local)) return null
  return `+880${local}`
}

export const prettyPhone = (p: string) => {
  const m = /^\+880(\d{4})(\d{6})$/.exec(p)
  return m ? `+880 ${m[1]}-${m[2]}` : p
}

export const maskPhone = (p: string) => {
  const m = /^\+880(\d{2})\d{5}(\d{3})$/.exec(p)
  return m ? `+880 ${m[1]}••-•••${m[2]}` : p
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`

export function hashStr(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
