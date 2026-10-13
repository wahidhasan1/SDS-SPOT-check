import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../db/index.ts'
import { env } from '../env.ts'
import { SESSION_COOKIE, createResetToken, createSession, destroySession, hashPassword, newUserId, setSessionCookie, verifyPassword } from '../lib/auth.ts'
import { newAnonIdentity } from '../lib/identity.ts'
import { HttpError, conflict, now, sha256 } from '../lib/util.ts'
import { sendMail } from '../services/mail.ts'
import { audit } from '../lib/events.ts'

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(200)
const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Use letters and at least one number')

const signupSchema = z.object({
  email,
  password,
  displayName: z.string().trim().min(2, 'Enter your name (at least 2 letters)').max(40),
  birthYear: z.number().int().min(1920).max(new Date().getFullYear() - 13, 'You must be at least 13 to use this app'),
  acceptTerms: z.literal(true, { message: 'Please accept the terms and community guidelines' }),
})

const strictAuth = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/signup', strictAuth, async (req, reply) => {
    const body = signupSchema.parse(req.body)
    if (db().one('SELECT 1 FROM users WHERE email = ?', body.email)) throw conflict('An account with this email already exists. Try logging in instead.', 'email_taken')
    const id = newUserId()
    const hash = await hashPassword(body.password)
    const anon = newAnonIdentity()
    const role = env.adminEmails.includes(body.email) ? 'admin' : 'user'
    try {
      db().tx(() => {
        db().run('INSERT INTO users (id, email, password_hash, role, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)', id, body.email, hash, role, now(), now())
        db().run(
          'INSERT INTO profiles (user_id, display_name, anon_name, avatar_color, avatar_icon, birth_year) VALUES (?, ?, ?, ?, ?, ?)',
          id,
          body.displayName,
          anon.anonName,
          anon.avatarColor,
          anon.avatarIcon,
          body.birthYear,
        )
        db().run('INSERT INTO ratings (user_id, updated_at) VALUES (?, ?)', id, now())
      })
    } catch (e) {
      // Two simultaneous sign-ups with the same email: the UNIQUE constraint decides.
      if (String((e as Error).message).includes('UNIQUE')) throw conflict('An account with this email already exists. Try logging in instead.', 'email_taken')
      throw e
    }
    if (role === 'admin') audit(id, 'admin.bootstrap', id, { email: body.email })
    setSessionCookie(reply, createSession(id))
    return { ok: true }
  })

  app.post('/login', strictAuth, async (req, reply) => {
    const body = z.object({ email, password: z.string().min(1).max(200) }).parse(req.body)
    const user = db().one<{ id: string; password_hash: string; status: string }>('SELECT id, password_hash, status FROM users WHERE email = ?', body.email)
    // Same message for unknown email and wrong password, so accounts can't be enumerated.
    const ok = user ? await verifyPassword(body.password, user.password_hash) : (await hashPassword('timing-equaliser'), false)
    if (!user || !ok) throw new HttpError(401, 'bad_credentials', 'Email or password is incorrect.')
    if (user.status === 'banned') throw new HttpError(403, 'banned', 'This account has been closed for breaking the community guidelines.')
    setSessionCookie(reply, createSession(user.id))
    db().run('UPDATE users SET last_seen_at = ? WHERE id = ?', now(), user.id)
    return { ok: true }
  })

  app.post('/logout', async (req, reply) => {
    destroySession(req.cookies[SESSION_COOKIE])
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { ok: true }
  })

  app.post('/forgot', strictAuth, async (req) => {
    const body = z.object({ email }).parse(req.body)
    const user = db().one<{ id: string }>('SELECT id FROM users WHERE email = ?', body.email)
    if (user) {
      const token = createResetToken(user.id)
      const link = `${env.publicUrl}/reset-password?token=${token}`
      const sent = await sendMail(body.email, `Reset your ${env.appName} password`, `Use this link within 1 hour to choose a new password:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`)
      if (!sent && !env.isProd) console.log(`[dev] Password reset link for ${body.email}: ${link}`)
    }
    // Always the same answer, whether or not the account exists.
    return { ok: true, emailConfigured: !!env.smtpUrl }
  })

  app.post('/reset', strictAuth, async (req, reply) => {
    const body = z.object({ token: z.string().min(20).max(200), password }).parse(req.body)
    const row = db().one<{ user_id: string; expires_at: number; used_at: number | null }>('SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?', sha256(body.token))
    if (!row || row.used_at || row.expires_at < now()) throw new HttpError(400, 'bad_token', 'This reset link is invalid or has expired. Request a new one.')
    const hash = await hashPassword(body.password)
    db().tx(() => {
      db().run('UPDATE password_resets SET used_at = ? WHERE token_hash = ?', now(), sha256(body.token))
      db().run('UPDATE users SET password_hash = ? WHERE id = ?', hash, row.user_id)
      db().run('DELETE FROM sessions WHERE user_id = ?', row.user_id) // sign out everywhere
    })
    setSessionCookie(reply, createSession(row.user_id))
    return { ok: true }
  })
}
