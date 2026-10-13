import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  randomAnonName,
  randomAvatar,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from '@app/shared';
import { config } from '../config';
import { one, q, tx } from '../db/pool';
import { requireAuth } from '../lib/auth';
import { hashPassword, randomToken, sha256, signAccessToken, verifyPassword } from '../lib/crypto';
import { HttpError, badRequest, conflict, unauthorized } from '../lib/errors';
import { parse } from '../lib/validate';
import { sendEmail } from '../services/email';
import { loadProfile } from '../services/users';

function platformOf(req: FastifyRequest) {
  const p = String(req.headers['x-client-platform'] ?? 'web');
  return ['web', 'android', 'ios'].includes(p) ? p : 'web';
}

async function issueSession(userId: string, role: string, req: FastifyRequest) {
  const refreshToken = randomToken(32);
  await q(
    `INSERT INTO auth_sessions (user_id, refresh_hash, platform, user_agent, expires_at)
     VALUES ($1,$2,$3,$4, now() + make_interval(days => $5))`,
    [userId, sha256(refreshToken), platformOf(req), String(req.headers['user-agent'] ?? '').slice(0, 200), config.refreshTokenTtlDays],
  );
  const accessToken = await signAccessToken(userId, role);
  return { accessToken, refreshToken, user: await loadProfile(userId) };
}

const AUTH_RATE = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', AUTH_RATE, async (req) => {
    const input = parse(registerSchema, req.body);
    const age = new Date().getUTCFullYear() - input.birthYear;
    if (age < config.minimumAge) {
      throw new HttpError(403, 'age_restricted', `You must be at least ${config.minimumAge} years old to create an account.`);
    }
    const existing = await one('SELECT 1 FROM users WHERE lower(email)=lower($1)', [input.email]);
    if (existing) throw conflict('An account with this email already exists. Try signing in instead.', 'email_taken');
    const hash = await hashPassword(input.password);
    const role = config.adminEmails.includes(input.email.toLowerCase()) ? 'admin' : 'user';
    const user = await tx(async (c) => {
      const u = await one<{ id: string }>(
        `INSERT INTO users (email, password_hash, display_name, anon_name, avatar, role, birth_year)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [input.email, hash, input.displayName, randomAnonName(), randomAvatar(), role, input.birthYear],
        c,
      );
      await c.query('INSERT INTO user_profiles (user_id) VALUES ($1)', [u!.id]);
      return u!;
    });
    return issueSession(user.id, role, req);
  });

  app.post('/auth/login', AUTH_RATE, async (req) => {
    const input = parse(loginSchema, req.body);
    const u = await one<any>('SELECT id, password_hash, role, failed_logins, locked_until FROM users WHERE lower(email)=lower($1)', [input.email]);
    const generic = unauthorized('Incorrect email or password.');
    if (!u) {
      await hashPassword(input.password); // equalise timing for unknown emails
      throw generic;
    }
    if (u.locked_until && new Date(u.locked_until) > new Date()) {
      throw new HttpError(429, 'account_locked', 'Too many failed attempts. Please wait 15 minutes or reset your password.');
    }
    if (!(await verifyPassword(input.password, u.password_hash))) {
      await q(
        `UPDATE users SET failed_logins = failed_logins + 1,
           locked_until = CASE WHEN failed_logins + 1 >= 8 THEN now() + interval '15 minutes' ELSE locked_until END
         WHERE id=$1`,
        [u.id],
      );
      throw generic;
    }
    await q('UPDATE users SET failed_logins=0, locked_until=NULL WHERE id=$1', [u.id]);
    return issueSession(u.id, u.role, req);
  });

  app.post('/auth/refresh', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const { refreshToken } = parse(refreshSchema, req.body);
    const hash = sha256(refreshToken);
    const result = await tx(async (c) => {
      const s = await one<any>(
        `SELECT s.*, u.role FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE refresh_hash=$1 FOR UPDATE OF s`,
        [hash],
        c,
      );
      if (!s) return null;
      if (s.revoked_at || s.rotated_at) {
        // Reuse of a rotated token suggests theft: revoke every session of this user.
        if (s.rotated_at) await c.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [s.user_id]);
        return null;
      }
      if (new Date(s.expires_at) < new Date()) return null;
      await c.query('UPDATE auth_sessions SET rotated_at=now() WHERE id=$1', [s.id]);
      return { userId: s.user_id as string, role: s.role as string };
    });
    if (!result) throw unauthorized('Your session has ended. Please sign in again.');
    return issueSession(result.userId, result.role, req);
  });

  app.post('/auth/logout', async (req) => {
    const { refreshToken } = parse(refreshSchema, req.body);
    await q('UPDATE auth_sessions SET revoked_at=now() WHERE refresh_hash=$1 AND revoked_at IS NULL', [sha256(refreshToken)]);
    return { ok: true };
  });

  app.post('/auth/forgot-password', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (req) => {
    const { email } = parse(forgotPasswordSchema, req.body);
    const u = await one<{ id: string }>('SELECT id FROM users WHERE lower(email)=lower($1)', [email]);
    if (u) {
      const token = randomToken(32);
      await q(`INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '1 hour')`, [u.id, sha256(token)]);
      const link = `${config.publicWebUrl}/reset-password?token=${encodeURIComponent(token)}`;
      await sendEmail(
        email,
        `Reset your ${config.appName} password`,
        `Someone asked to reset the password for your ${config.appName} account.\n\nOpen this link within one hour to choose a new password:\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
        `reset link: ${link}`,
      );
    }
    // Same response either way so emails cannot be enumerated.
    return { ok: true, message: 'If an account exists for that email, a reset link has been sent.' };
  });

  app.post('/auth/reset-password', AUTH_RATE, async (req) => {
    const { token, password } = parse(resetPasswordSchema, req.body);
    const hash = await hashPassword(password);
    const ok = await tx(async (c) => {
      const r = await one<any>(
        `SELECT id, user_id FROM password_resets WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`,
        [sha256(token)],
        c,
      );
      if (!r) return false;
      await c.query('UPDATE password_resets SET used_at=now() WHERE id=$1', [r.id]);
      await c.query('UPDATE users SET password_hash=$2, failed_logins=0, locked_until=NULL WHERE id=$1', [r.user_id, hash]);
      await c.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [r.user_id]);
      return true;
    });
    if (!ok) throw badRequest('This reset link is invalid or has expired. Request a new one.');
    return { ok: true };
  });

  app.post('/auth/change-password', { preHandler: requireAuth }, async (req) => {
    const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
    const u = await one<any>('SELECT password_hash FROM users WHERE id=$1', [req.userId]);
    if (!u || !(await verifyPassword(currentPassword, u.password_hash))) throw unauthorized('Your current password is incorrect.');
    await q('UPDATE users SET password_hash=$2 WHERE id=$1', [req.userId, await hashPassword(newPassword)]);
    return { ok: true };
  });

  /** Permanent account deletion. Moderation reports keep their record but lose the link to this account. */
  app.post('/auth/delete-account', { preHandler: requireAuth }, async (req) => {
    const { password } = parse(deleteAccountSchema, req.body);
    const u = await one<any>('SELECT password_hash FROM users WHERE id=$1', [req.userId]);
    if (!u || !(await verifyPassword(password, u.password_hash))) throw unauthorized('Password is incorrect.');
    const active = await one('SELECT call_id FROM user_active_calls WHERE user_id=$1', [req.userId]);
    if (active) throw conflict('End your active call before deleting your account.');
    await q('DELETE FROM users WHERE id=$1', [req.userId]);
    return { ok: true };
  });
}
