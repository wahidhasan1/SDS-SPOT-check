import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../db';
import { emailConfigured } from '../services/email';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    await db.execute(sql`select 1`);
    return { ok: true, time: new Date().toISOString() };
  });

  /** Which optional integrations are configured. Lets the UI show honest "not configured" states. */
  app.get('/api/config', async () => ({
    integrations: {
      ai: Boolean(config.anthropicApiKey),
      email: emailConfigured(),
      googleAuth: Boolean(config.googleClientId && config.googleClientSecret),
      payments: Boolean(config.stripeSecretKey && config.stripePriceId),
      devSubscriptions: config.allowDevSubscriptions && !(config.stripeSecretKey && config.stripePriceId),
      turn: Boolean(config.turnUrls.length && (config.turnSecret || config.turnUsername)),
      ocr: true,
      dictionary: true,
    },
  }));
}
