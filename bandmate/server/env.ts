import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_APP_NAME } from '../shared/config.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const str = (k: string, d = '') => process.env[k]?.trim() || d
const num = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d)

/** All configuration comes from environment variables. Nothing secret is hard-coded or sent to the client. */
export const env = {
  root,
  appName: str('APP_NAME', DEFAULT_APP_NAME),
  nodeEnv: str('NODE_ENV', 'development'),
  isProd: str('NODE_ENV') === 'production',
  port: num('PORT', 8787),
  host: str('HOST', '0.0.0.0'),
  /** Public URL of the web app, used in emails and payment redirects. */
  publicUrl: str('PUBLIC_URL', 'http://localhost:5173'),
  dbPath: str('DB_PATH', path.join(root, 'data', 'app.db')),
  modelsDir: str('MODELS_DIR', path.join(root, 'models')),
  cookieSecure: str('COOKIE_SECURE', str('NODE_ENV') === 'production' ? 'true' : 'false') === 'true',

  // ---- Voice calls (WebRTC). STUN is public; TURN must be your own server (e.g. coturn) for users behind strict NATs.
  stunUrls: str('STUN_URLS', 'stun:stun.l.google.com:19302').split(',').filter(Boolean),
  turnUrls: str('TURN_URLS').split(',').filter(Boolean),
  /** coturn `static-auth-secret`: the server mints short-lived TURN credentials from it (TURN REST API). */
  turnSecret: str('TURN_SECRET'),

  // ---- Optional providers. Each feature reports "not configured" when its key is missing.
  anthropicKey: str('ANTHROPIC_API_KEY'),
  anthropicModel: str('ANTHROPIC_MODEL', 'claude-opus-5-5'),
  languageToolUrl: str('LANGUAGETOOL_URL', 'http://127.0.0.1:8081'),
  smtpUrl: str('SMTP_URL'),
  mailFrom: str('MAIL_FROM', `${DEFAULT_APP_NAME} <no-reply@example.com>`),
  vapidPublic: str('VAPID_PUBLIC_KEY'),
  vapidPrivate: str('VAPID_PRIVATE_KEY'),
  vapidSubject: str('VAPID_SUBJECT', 'mailto:admin@example.com'),
  stripeSecret: str('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: str('STRIPE_WEBHOOK_SECRET'),
  stripePremiumPrice: str('STRIPE_PREMIUM_PRICE_ID'),
  revenueCatWebhookAuth: str('REVENUECAT_WEBHOOK_AUTH'),
  /** Dev/test only: enables a fake payment provider so entitlement flows can be exercised. Refused in production. */
  testPayments: str('TEST_PAYMENTS') === 'true' && str('NODE_ENV') !== 'production',
  /** Email addresses that become admins when they sign up (bootstrap for the first admin). */
  adminEmails: str('ADMIN_EMAILS').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean),
}
