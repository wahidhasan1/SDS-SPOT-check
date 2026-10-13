import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { and, eq, gt } from 'drizzle-orm';
import { config } from '../config';
import { db, schema } from '../db';
import { forbidden, unauthorized } from '../lib/errors';
import { hashToken, newToken } from '../lib/tokens';

export const SESSION_COOKIE = 'fp_session';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  sessionId: string;
  via: 'cookie' | 'bearer';
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthUser | null;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function allowedOrigins(): Set<string> {
  return new Set([config.appUrl, config.apiUrl, ...config.corsOrigins].map((o) => o.replace(/\/$/, '')));
}

export async function resolveSessionToken(token: string): Promise<AuthUser | null> {
  const rows = await db
    .select({
      sessionId: schema.sessions.id,
      lastUsedAt: schema.sessions.lastUsedAt,
      id: schema.users.id,
      email: schema.users.email,
      role: schema.users.role,
      status: schema.users.status,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.status !== 'active') return null;
  if (Date.now() - row.lastUsedAt.getTime() > 5 * 60_000) {
    await db.update(schema.sessions).set({ lastUsedAt: new Date() }).where(eq(schema.sessions.id, row.sessionId));
  }
  return { id: row.id, email: row.email, role: row.role, sessionId: row.sessionId, via: 'bearer' };
}

export function tokenFromRequest(req: FastifyRequest): { token: string; via: 'cookie' | 'bearer' } | null {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return { token: h.slice(7).trim(), via: 'bearer' };
  const c = req.cookies?.[SESSION_COOKIE];
  if (c) return { token: c, via: 'cookie' };
  return null;
}

export const authPlugin = fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('auth', null);
  app.addHook('onRequest', async (req) => {
    req.auth = null;
    const t = tokenFromRequest(req);
    if (!t) return;
    // CSRF protection for cookie-authenticated, state-changing requests.
    if (t.via === 'cookie' && !SAFE_METHODS.has(req.method)) {
      const origin = (req.headers.origin as string | undefined) ?? refererOrigin(req.headers.referer);
      if (origin && !allowedOrigins().has(origin) && !isSameHost(origin, req)) throw forbidden('Request origin not allowed.');
    }
    const user = await resolveSessionToken(t.token);
    if (user) req.auth = { ...user, via: t.via };
  });
});

function refererOrigin(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  try {
    return new URL(ref).origin;
  } catch {
    return undefined;
  }
}

function isSameHost(origin: string, req: FastifyRequest): boolean {
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

export function requireAdmin(req: FastifyRequest): AuthUser {
  const u = requireUser(req);
  if (u.role !== 'admin') throw forbidden('Administrator access required.');
  return u;
}

export async function createSession(userId: string, client: 'web' | 'mobile', userAgent?: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + config.sessionDays * 86400_000);
  await db.insert(schema.sessions).values({ userId, tokenHash: hashToken(token), client, userAgent: userAgent?.slice(0, 300), expiresAt });
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, userId));
  return { token, expiresAt };
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}
