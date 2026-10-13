import crypto from 'node:crypto'

export const now = () => Date.now()
export const newId = (prefix = '') => prefix + crypto.randomBytes(12).toString('base64url')
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message)
  }
}

export const badRequest = (message: string, code = 'bad_request') => new HttpError(400, code, message)
export const notFound = (message = 'Not found') => new HttpError(404, 'not_found', message)
export const forbidden = (message = 'You do not have access to this.') => new HttpError(403, 'forbidden', message)
export const conflict = (message: string, code = 'conflict') => new HttpError(409, code, message)
export const limitReached = (message: string, extra?: Record<string, unknown>) => new HttpError(402, 'limit_reached', message, extra)
export const notConfigured = (feature: string, how: string) =>
  new HttpError(503, 'not_configured', `${feature} is not configured on this server yet.`, { how })

/** Local calendar day for a user, from their reported UTC offset (minutes, as returned by Date#getTimezoneOffset * -1). */
export const dayKey = (offsetMin = 0, at = Date.now()) => new Date(at + offsetMin * 60_000).toISOString().slice(0, 10)

export const weekKey = (offsetMin = 0, at = Date.now()) => {
  const d = new Date(at + offsetMin * 60_000)
  const day = (d.getUTCDay() + 6) % 7 // Monday = 0
  d.setUTCDate(d.getUTCDate() - day)
  return 'W' + d.toISOString().slice(0, 10)
}

export const shuffle = <T>(arr: T[], rand = Math.random) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Words in a piece of English text (letters, apostrophes and hyphens inside words). */
export const wordsOf = (text: string) => text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? []
