import crypto from 'node:crypto'
import { promisify } from 'node:util'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { db } from '../db/index.ts'
import { env } from '../env.ts'
import { HttpError, newId, now, sha256 } from './util.ts'

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export async function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(pw, salt, 64, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, N, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt') return false
  const expected = Buffer.from(hash, 'base64')
  const key = await scrypt(pw, Buffer.from(salt, 'base64'), expected.length, { N: +N, r: +r, p: +p, maxmem: SCRYPT.maxmem })
  return crypto.timingSafeEqual(key, expected)
}

export const SESSION_COOKIE = 'bm_session'
const SESSION_DAYS = 30

export function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString('base64url')
  db().run('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', sha256(token), userId, now(), now() + SESSION_DAYS * 86400_000)
  return token
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    maxAge: SESSION_DAYS * 86400,
  })
}

export function destroySession(token: string | undefined) {
  if (token) db().run('DELETE FROM sessions WHERE id_hash = ?', sha256(token))
}

export type AuthUser = { id: string; email: string; role: 'user' | 'admin'; status: 'active' | 'suspended' | 'banned' }

/** Resolves the session cookie to a user. Expired sessions are removed; active ones slide forward. */
export function userFromToken(token: string | undefined): AuthUser | null {
  if (!token) return null
  const row = db().one<AuthUser & { expires_at: number; id_hash: string }>(
    `SELECT u.id, u.email, u.role, u.status, s.expires_at, s.id_hash FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?`,
    sha256(token),
  )
  if (!row) return null
  if (row.expires_at < now()) {
    db().run('DELETE FROM sessions WHERE id_hash = ?', row.id_hash)
    return null
  }
  if (row.status === 'banned') return null
  if (row.expires_at - now() < (SESSION_DAYS - 1) * 86400_000) {
    db().run('UPDATE sessions SET expires_at = ? WHERE id_hash = ?', now() + SESSION_DAYS * 86400_000, row.id_hash)
    db().run('UPDATE users SET last_seen_at = ? WHERE id = ?', now(), row.id)
  }
  return { id: row.id, email: row.email, role: row.role, status: row.status }
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null
  }
}

export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.user) throw new HttpError(401, 'unauthenticated', 'Please log in to continue.')
  return req.user
}

/** Server-side role check. Hiding admin UI is not a security boundary; this is. */
export function requireAdmin(req: FastifyRequest): AuthUser {
  const u = requireUser(req)
  if (u.role !== 'admin') throw new HttpError(403, 'forbidden', 'Admins only.')
  return u
}

export function createResetToken(userId: string) {
  const token = crypto.randomBytes(32).toString('base64url')
  db().run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha256(token), userId, now() + 3600_000)
  return token
}

export const newUserId = () => newId('u_')
