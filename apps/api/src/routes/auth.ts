import type { FastifyInstance } from 'fastify';
import { and, desc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '../config';
import { db, schema } from '../db';
import { badRequest, conflict, HttpError, notConfigured, unauthorized } from '../lib/errors';
import { hashPassword, passwordProblems, verifyPassword } from '../lib/password';
import { hashToken, newToken } from '../lib/tokens';
import { parse, uuidParam } from '../lib/validate';
import { clearSessionCookie, createSession, requireUser, setSessionCookie, SESSION_COOKIE } from '../plugins/auth';
import { sendEmail } from '../services/email';
import { createUserAccount, getMe } from '../services/users';

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const clientKind = z.enum(['web', 'mobile']).default('web');

const registerSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters').max(40),
  client: clientKind,
  timezone: z.string().max(64).optional(),
});

const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required'), client: clientKind });

const RATE = { config: { rateLimit: { max: config.rateLimitEnabled ? 10 : 100_000, timeWindow: '1 minute' } } };

export async function authRoutes(app: FastifyInstance) {
  app.get('/api/auth/providers', async () => ({
    password: true,
    google: Boolean(config.googleClientId && config.googleClientSecret),
  }));

  app.post('/api/auth/register', RATE, async (req, reply) => {
    const body = parse(registerSchema, req.body);
    const problem = passwordProblems(body.password);
    if (problem) throw badRequest(problem);
    const existing = await db.select({ id: schema.users.id }).from(schema.users).where(sql`lower(${schema.users.email}) = ${body.email}`);
    if (existing.length) throw conflict('An account with this email already exists. Try signing in instead.');
    const user = await createUserAccount({
      email: body.email,
      passwordHash: await hashPassword(body.password),
      displayName: body.displayName,
      timezone: body.timezone,
    });
    const session = await createSession(user.id, body.client, req.headers['user-agent']);
    if (body.client === 'web') setSessionCookie(reply, session.token, session.expiresAt);
    reply.code(201);
    return { me: await getMe(user.id), token: body.client === 'mobile' ? session.token : undefined };
  });

  app.post('/api/auth/login', RATE, async (req, reply) => {
    const body = parse(loginSchema, req.body);
    const [user] = await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${body.email}`);
    const ok = user ? await verifyPassword(body.password, user.passwordHash) : await verifyPassword(body.password, DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'invalid_credentials', 'Incorrect email or password.');
    if (user.status === 'suspended') throw new HttpError(403, 'suspended', 'This account has been suspended. Contact support if you think this is a mistake.');
    if (user.status === 'deactivated') {
      // Signing in again reactivates a self-deactivated account.
      await db.update(schema.users).set({ status: 'active', deactivatedAt: null }).where(eq(schema.users.id, user.id));
    }
    const session = await createSession(user.id, body.client, req.headers['user-agent']);
    if (body.client === 'web') setSessionCookie(reply, session.token, session.expiresAt);
    return { me: await getMe(user.id), token: body.client === 'mobile' ? session.token : undefined };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.auth) await db.delete(schema.sessions).where(eq(schema.sessions.id, req.auth.sessionId));
    clearSessionCookie(reply);
    return { ok: true };
  });

  /** Like /me but returns { me: null } for guests instead of 401. */
  app.get('/api/auth/session', async (req) => ({ me: req.auth ? await getMe(req.auth.id) : null }));

  app.get('/api/auth/me', async (req) => {
    const u = requireUser(req);
    return { me: await getMe(u.id) };
  });

  app.post('/api/auth/forgot-password', RATE, async (req) => {
    const body = parse(z.object({ email }), req.body);
    const [user] = await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${body.email}`);
    if (user && user.status !== 'suspended') {
      const token = newToken();
      await db.insert(schema.authTokens).values({
        userId: user.id,
        purpose: 'password_reset',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      });
      const link = `${config.appUrl}/reset-password?token=${token}`;
      await sendEmail(
        user.email,
        'Reset your FluentPath password',
        `Hello,\n\nSomeone (hopefully you) asked to reset the password for your FluentPath account.\n\nOpen this link within 1 hour to choose a new password:\n${link}\n\nIf you did not ask for this, you can ignore this email.\n`,
      );
    }
    // Same response whether or not the account exists, to avoid revealing registered emails.
    return { ok: true, message: 'If an account exists for that email, a reset link has been sent.' };
  });

  app.post('/api/auth/reset-password', RATE, async (req, reply) => {
    const body = parse(z.object({ token: z.string().min(10), password: z.string() }), req.body);
    const problem = passwordProblems(body.password);
    if (problem) throw badRequest(problem);
    const [row] = await db
      .select()
      .from(schema.authTokens)
      .where(
        and(
          eq(schema.authTokens.tokenHash, hashToken(body.token)),
          eq(schema.authTokens.purpose, 'password_reset'),
          isNull(schema.authTokens.usedAt),
          gt(schema.authTokens.expiresAt, new Date()),
        ),
      );
    if (!row) throw badRequest('This reset link is invalid or has expired. Please request a new one.');
    await db.update(schema.authTokens).set({ usedAt: new Date() }).where(eq(schema.authTokens.id, row.id));
    await db.update(schema.users).set({ passwordHash: await hashPassword(body.password) }).where(eq(schema.users.id, row.userId));
    // Sign out everywhere after a reset.
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, row.userId));
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.post('/api/auth/change-password', RATE, async (req) => {
    const u = requireUser(req);
    const body = parse(z.object({ currentPassword: z.string().optional(), newPassword: z.string() }), req.body);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    if (user.passwordHash && !(await verifyPassword(body.currentPassword ?? '', user.passwordHash)))
      throw badRequest('Your current password is incorrect.');
    const problem = passwordProblems(body.newPassword);
    if (problem) throw badRequest(problem);
    await db.update(schema.users).set({ passwordHash: await hashPassword(body.newPassword) }).where(eq(schema.users.id, u.id));
    // Keep this session, sign out other devices.
    await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, u.id), ne(schema.sessions.id, u.sessionId)));
    return { ok: true };
  });

  app.get('/api/auth/sessions', async (req) => {
    const u = requireUser(req);
    const rows = await db
      .select({
        id: schema.sessions.id,
        client: schema.sessions.client,
        userAgent: schema.sessions.userAgent,
        createdAt: schema.sessions.createdAt,
        lastUsedAt: schema.sessions.lastUsedAt,
      })
      .from(schema.sessions)
      .where(and(eq(schema.sessions.userId, u.id), gt(schema.sessions.expiresAt, new Date())))
      .orderBy(desc(schema.sessions.lastUsedAt));
    return { sessions: rows.map((r) => ({ ...r, current: r.id === u.sessionId })) };
  });

  app.delete('/api/auth/sessions/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    await db.delete(schema.sessions).where(and(eq(schema.sessions.id, id), eq(schema.sessions.userId, u.id)));
    return { ok: true };
  });

  // ---------------------------------------------------------------- Google OAuth (optional)

  app.get('/api/auth/google/start', async (req, reply) => {
    if (!config.googleClientId || !config.googleClientSecret)
      throw notConfigured('Google sign-in is not configured on this server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
    const q = parse(z.object({ client: clientKind }), req.query);
    const state = newToken(16);
    reply.setCookie('fp_oauth', `${state}.${q.client}`, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/api/auth/google', maxAge: 600 });
    const params = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: `${config.apiUrl}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });

  app.get('/api/auth/google/callback', async (req, reply) => {
    const q = parse(z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() }), req.query);
    const [state, client] = (req.cookies.fp_oauth ?? '').split('.');
    reply.clearCookie('fp_oauth', { path: '/api/auth/google' });
    const fail = (msg: string) => reply.redirect(`${config.appUrl}/login?error=${encodeURIComponent(msg)}`);
    if (q.error) return fail('Google sign-in was cancelled.');
    if (!q.code || !q.state || !state || q.state !== state) return fail('Google sign-in failed (invalid state). Please try again.');
    let profile: { sub: string; email: string; email_verified?: boolean; name?: string };
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: q.code,
          client_id: config.googleClientId,
          client_secret: config.googleClientSecret,
          redirect_uri: `${config.apiUrl}/api/auth/google/callback`,
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) throw new Error(`token exchange ${tokenRes.status}`);
      const tok = (await tokenRes.json()) as { access_token: string };
      const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${tok.access_token}` } });
      if (!infoRes.ok) throw new Error(`userinfo ${infoRes.status}`);
      profile = (await infoRes.json()) as typeof profile;
    } catch (err) {
      req.log.warn({ err }, 'google oauth failed');
      return fail('Could not complete Google sign-in. Please try again.');
    }
    if (!profile.email || profile.email_verified === false) return fail('Your Google account email is not verified.');
    let [user] = await db.select().from(schema.users).where(eq(schema.users.googleSub, profile.sub));
    if (!user) {
      [user] = await db.select().from(schema.users).where(sql`lower(${schema.users.email}) = ${profile.email.toLowerCase()}`);
      if (user) await db.update(schema.users).set({ googleSub: profile.sub, emailVerified: true }).where(eq(schema.users.id, user.id));
    }
    if (!user) {
      const created = await createUserAccount({ email: profile.email.toLowerCase(), passwordHash: null, displayName: (profile.name ?? 'Learner').slice(0, 40), googleSub: profile.sub });
      [user] = await db.select().from(schema.users).where(eq(schema.users.id, created.id));
    }
    if (user.status === 'suspended') return fail('This account has been suspended.');
    if (client === 'mobile') {
      const code = newToken(24);
      await db.insert(schema.authTokens).values({ userId: user.id, purpose: 'oauth_mobile_code', tokenHash: hashToken(code), expiresAt: new Date(Date.now() + 2 * 60_000) });
      return reply.redirect(`fluentpath://auth?code=${code}`);
    }
    const session = await createSession(user.id, 'web', req.headers['user-agent']);
    setSessionCookie(reply, session.token, session.expiresAt);
    return reply.redirect(`${config.appUrl}/dashboard`);
  });

  app.post('/api/auth/mobile/exchange', RATE, async (req) => {
    const body = parse(z.object({ code: z.string().min(10) }), req.body);
    const [row] = await db
      .select()
      .from(schema.authTokens)
      .where(
        and(
          eq(schema.authTokens.tokenHash, hashToken(body.code)),
          eq(schema.authTokens.purpose, 'oauth_mobile_code'),
          isNull(schema.authTokens.usedAt),
          gt(schema.authTokens.expiresAt, new Date()),
        ),
      );
    if (!row) throw unauthorized('Sign-in code is invalid or expired.');
    await db.update(schema.authTokens).set({ usedAt: new Date() }).where(eq(schema.authTokens.id, row.id));
    const session = await createSession(row.userId, 'mobile', req.headers['user-agent']);
    return { me: await getMe(row.userId), token: session.token };
  });
}

// Used to keep login timing similar for unknown emails.
const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

export { SESSION_COOKIE };
