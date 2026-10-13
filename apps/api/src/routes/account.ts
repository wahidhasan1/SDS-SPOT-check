import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db';
import { badRequest } from '../lib/errors';
import { verifyPassword } from '../lib/password';
import { parse } from '../lib/validate';
import { clearSessionCookie, requireUser } from '../plugins/auth';
import { cancelStripeSubscriptionNow } from '../services/billing';
import { deleteFile } from '../services/media';

async function confirmIdentity(userId: string, password: string | undefined) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (user.passwordHash && !(await verifyPassword(password ?? '', user.passwordHash))) throw badRequest('Your password is incorrect.');
  return user;
}

export async function accountRoutes(app: FastifyInstance) {
  /** Temporarily deactivate: hidden from matching, signed out everywhere; signing in again reactivates. */
  app.post('/api/account/deactivate', async (req, reply) => {
    const u = requireUser(req);
    const body = parse(z.object({ password: z.string().optional() }), req.body);
    await confirmIdentity(u.id, body.password);
    await db.update(schema.users).set({ status: 'deactivated', deactivatedAt: new Date() }).where(eq(schema.users.id, u.id));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, u.id));
    clearSessionCookie(reply);
    return { ok: true };
  });

  /** Permanently delete the account and all personal data (cascades through every table). */
  app.delete('/api/account', async (req, reply) => {
    const u = requireUser(req);
    const body = parse(z.object({ password: z.string().optional(), confirm: z.literal('DELETE', { message: 'Type DELETE to confirm.' }) }), req.body);
    await confirmIdentity(u.id, body.password);
    if (u.role === 'admin') {
      const admins = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, 'admin'));
      if (admins.length <= 1) throw badRequest('You are the only administrator. Promote another administrator before deleting your account.');
    }
    await cancelStripeSubscriptionNow(u.id).catch(() => {});
    const files = await db.select({ id: schema.mediaFiles.id }).from(schema.mediaFiles).where(eq(schema.mediaFiles.ownerId, u.id));
    for (const f of files) await deleteFile(f.id);
    await db.delete(schema.users).where(eq(schema.users.id, u.id));
    clearSessionCookie(reply);
    return { ok: true };
  });

  /** Download a copy of your own data (JSON). */
  app.get('/api/account/export', async (req, reply) => {
    const u = requireUser(req);
    const id = u.id;
    const [user] = await db.select({ id: schema.users.id, email: schema.users.email, createdAt: schema.users.createdAt, role: schema.users.role }).from(schema.users).where(eq(schema.users.id, id));
    const pick = <T>(p: Promise<T>) => p;
    const data = {
      exportedAt: new Date().toISOString(),
      user,
      profile: (await pick(db.select().from(schema.profiles).where(eq(schema.profiles.userId, id))))[0],
      settings: (await pick(db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, id))))[0],
      subscription: (await pick(db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, id))))[0],
      assessments: await db.select().from(schema.assessments).where(eq(schema.assessments.userId, id)),
      lessonProgress: await db.select().from(schema.lessonProgress).where(eq(schema.lessonProgress.userId, id)),
      attempts: await db.select().from(schema.attempts).where(eq(schema.attempts.userId, id)),
      vocabulary: await db.select().from(schema.userWords).where(eq(schema.userWords.userId, id)),
      writing: await db.select().from(schema.writingSubmissions).where(eq(schema.writingSubmissions.userId, id)),
      speaking: await db.select().from(schema.speakingAttempts).where(eq(schema.speakingAttempts.userId, id)),
      mockTests: await db.select().from(schema.mockAttempts).where(eq(schema.mockAttempts.userId, id)),
      readerDocuments: await db.select().from(schema.ocrDocuments).where(eq(schema.ocrDocuments.userId, id)),
      activity: await db.select().from(schema.activityLog).where(eq(schema.activityLog.userId, id)),
      achievements: await db.select().from(schema.achievements).where(eq(schema.achievements.userId, id)),
      notifications: await db.select().from(schema.notifications).where(eq(schema.notifications.userId, id)),
      blocks: await db.select({ alias: schema.blocks.alias, createdAt: schema.blocks.createdAt }).from(schema.blocks).where(eq(schema.blocks.blockerId, id)),
      reportsMade: await db.select({ reportedAlias: schema.reports.reportedAlias, reason: schema.reports.reason, details: schema.reports.details, status: schema.reports.status, createdAt: schema.reports.createdAt }).from(schema.reports).where(eq(schema.reports.reporterId, id)),
    };
    reply.header('content-disposition', 'attachment; filename="fluentpath-data.json"');
    return data;
  });
}
