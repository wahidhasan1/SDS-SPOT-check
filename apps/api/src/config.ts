import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const API_ROOT = path.resolve(here, '..');
export const REPO_ROOT = path.resolve(API_ROOT, '../..');

// Load .env from the API folder first, then the repository root (first value wins).
loadEnv({ path: path.join(API_ROOT, '.env'), quiet: true });
loadEnv({ path: path.join(REPO_ROOT, '.env'), quiet: true });

const env = process.env;
const bool = (v: string | undefined, d: boolean) => (v == null || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()));

const isProd = env.NODE_ENV === 'production';

export const config = {
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT ?? 4000),
  host: env.HOST ?? '0.0.0.0',
  databaseUrl: env.DATABASE_URL ?? 'postgresql://fluent:fluent_dev_pw@localhost:5432/fluent',
  /** Public URL of the web app (used in emails and OAuth redirects). */
  appUrl: (env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  /** Public URL of this API server (used for OAuth callback). */
  apiUrl: (env.API_URL ?? `http://localhost:${env.PORT ?? 4000}`).replace(/\/$/, ''),
  /** Extra allowed browser origins (comma separated). */
  corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  sessionDays: Number(env.SESSION_DAYS ?? 30),
  cookieSecure: bool(env.COOKIE_SECURE, isProd),
  uploadDir: path.resolve(API_ROOT, env.UPLOAD_DIR ?? 'uploads'),
  webDist: path.resolve(REPO_ROOT, 'apps/web/dist'),
  adminEmails: (env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),

  smtpUrl: env.SMTP_URL ?? '',
  mailFrom: env.MAIL_FROM ?? 'FluentPath <no-reply@fluentpath.local>',

  googleClientId: env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: env.GOOGLE_CLIENT_SECRET ?? '',

  anthropicApiKey: env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: env.ANTHROPIC_MODEL ?? 'claude-opus-5-5',
  /** Optional override, e.g. for a proxy or a local test double. */
  anthropicBaseUrl: env.FLUENTPATH_ANTHROPIC_BASE_URL ?? '',

  stripeSecretKey: env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ?? '',
  stripePriceId: env.STRIPE_PRICE_ID ?? '',
  /** Allows activating Premium without payment for testing. Never enable in production. */
  allowDevSubscriptions: bool(env.ALLOW_DEV_SUBSCRIPTIONS, !isProd),

  /** Comma separated STUN/TURN URLs. */
  stunUrls: (env.STUN_URLS ?? 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302').split(',').map((s) => s.trim()).filter(Boolean),
  turnUrls: (env.TURN_URLS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  /** coturn "use-auth-secret" shared secret for time-limited TURN credentials. */
  turnSecret: env.TURN_SECRET ?? '',
  turnUsername: env.TURN_USERNAME ?? '',
  turnPassword: env.TURN_PASSWORD ?? '',

  rateLimitEnabled: bool(env.RATE_LIMIT, true),
};

export type AppConfig = typeof config;
