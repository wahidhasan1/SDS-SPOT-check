import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool, schema } from '../src/db';
import { call, getApp, registerUser } from './helpers';

afterAll(async () => {
  await (await getApp()).close();
  await pool.end();
});

describe('authentication', () => {
  it('registers, returns the session user and stores a hashed password', async () => {
    const u = await registerUser({ displayName: 'Alice' });
    const me = await call(u, 'GET', '/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.json.me.profile.displayName).toBe('Alice');
    expect(me.json.me.plan).toBe('free');
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    expect(row.passwordHash).toMatch(/^scrypt\$/);
    expect(row.passwordHash).not.toContain('Passw0rd!');
  });

  it('rejects weak passwords, invalid emails and duplicate accounts', async () => {
    const weak = await call(null, 'POST', '/api/auth/register', { email: 'weak@example.com', password: 'short', displayName: 'Weak' });
    expect(weak.status).toBe(400);
    const badEmail = await call(null, 'POST', '/api/auth/register', { email: 'not-an-email', password: 'Passw0rd!', displayName: 'Bad' });
    expect(badEmail.status).toBe(400);
    const u = await registerUser();
    const dup = await call(null, 'POST', '/api/auth/register', { email: u.email.toUpperCase(), password: 'Passw0rd!', displayName: 'Dup' });
    expect(dup.status).toBe(409);
  });

  it('logs in with correct credentials only and logs out', async () => {
    const u = await registerUser();
    const bad = await call(null, 'POST', '/api/auth/login', { email: u.email, password: 'wrongpass1' });
    expect(bad.status).toBe(401);
    const ok = await call(null, 'POST', '/api/auth/login', { email: u.email, password: 'Passw0rd!' });
    expect(ok.status).toBe(200);
    const cookie = (ok.res.headers['set-cookie'] as string).split(';')[0];
    const session = { ...u, cookie };
    expect((await call(session, 'GET', '/api/auth/me')).status).toBe(200);
    expect((await call(session, 'POST', '/api/auth/logout')).status).toBe(200);
    expect((await call(session, 'GET', '/api/auth/me')).status).toBe(401);
  });

  it('issues bearer tokens for mobile clients', async () => {
    const u = await registerUser({ mobile: true });
    expect(u.token).toBeTruthy();
    const me = await call(u, 'GET', '/api/auth/me');
    expect(me.status).toBe(200);
  });

  it('protects private endpoints', async () => {
    for (const url of ['/api/dashboard', '/api/vocab/my', '/api/lessons', '/api/progress']) {
      expect((await call(null, 'GET', url)).status).toBe(401);
    }
  });

  it('blocks cross-site state-changing requests that use the session cookie', async () => {
    const u = await registerUser();
    const a = await getApp();
    const res = await a.inject({ method: 'PATCH', url: '/api/profile', headers: { cookie: u.cookie, origin: 'https://evil.example' }, payload: { bio: 'hacked' } });
    expect(res.statusCode).toBe(403);
  });

  it('resets a password with a single-use token and signs out other sessions', async () => {
    const u = await registerUser();
    const r = await call(null, 'POST', '/api/auth/forgot-password', { email: u.email });
    expect(r.status).toBe(200);
    // Same response for unknown emails (no account enumeration).
    const unknown = await call(null, 'POST', '/api/auth/forgot-password', { email: 'nobody@example.com' });
    expect(unknown.json.message).toBe(r.json.message);
    const [mail] = await db.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, u.email));
    expect(mail.status).toBe('logged');
    const token = mail.body.match(/token=([\w-]+)/)![1];
    const reset = await call(null, 'POST', '/api/auth/reset-password', { token, password: 'NewPassw0rd' });
    expect(reset.status).toBe(200);
    expect((await call(u, 'GET', '/api/auth/me')).status).toBe(401);
    const again = await call(null, 'POST', '/api/auth/reset-password', { token, password: 'Another1pass' });
    expect(again.status).toBe(400);
    const login = await call(null, 'POST', '/api/auth/login', { email: u.email, password: 'NewPassw0rd' });
    expect(login.status).toBe(200);
  });

  it('reports Google sign-in as not configured when credentials are missing', async () => {
    const p = await call(null, 'GET', '/api/auth/providers');
    expect(p.json.google).toBe(false);
    const s = await call(null, 'GET', '/api/auth/google/start');
    expect(s.status).toBe(503);
  });
});
