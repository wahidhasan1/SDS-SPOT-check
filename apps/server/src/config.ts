import { resolveAppName } from '@app/shared';

function num(v: string | undefined, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : d;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';

const jwtSecret = process.env.JWT_SECRET ?? (isProd ? '' : 'dev-only-insecure-jwt-secret-change-me-0123456789');
if (isProd && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production');
}

export const config = {
  appName: resolveAppName(process.env.APP_NAME),
  nodeEnv,
  isProd,
  isTest: nodeEnv === 'test',
  port: num(process.env.PORT, 4000),
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/fluentpath',
  jwtSecret,
  accessTokenTtlSec: num(process.env.ACCESS_TOKEN_TTL_SEC, 15 * 60),
  refreshTokenTtlDays: num(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  publicWebUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173',
  adminEmails: (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  authRateLimitPerMin: num(process.env.AUTH_RATE_LIMIT_PER_MIN, 10),
  minimumAge: num(process.env.MINIMUM_AGE, 13),
  callingMinimumAge: num(process.env.CALLING_MINIMUM_AGE, 18),

  // WebRTC
  stunUrls: (process.env.STUN_URLS ?? 'stun:stun.l.google.com:19302').split(',').map((s) => s.trim()).filter(Boolean),
  turnUrls: (process.env.TURN_URLS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  turnSecret: process.env.TURN_SECRET ?? '',
  turnTtlSec: num(process.env.TURN_TTL_SEC, 3600),

  // AI (Anthropic Claude). Optional: features degrade to deterministic analysis without it.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5',
  anthropicBaseUrl: process.env.ANTHROPIC_API_URL || undefined,

  // Speech-to-text (OpenAI-compatible /audio/transcriptions endpoint, e.g. OpenAI, Groq, self-hosted whisper server)
  sttApiUrl: process.env.STT_API_URL ?? '',
  sttApiKey: process.env.STT_API_KEY ?? '',
  sttModel: process.env.STT_MODEL ?? 'whisper-1',

  // Translation fallback (LibreTranslate-compatible) when AI is not configured
  libreTranslateUrl: process.env.LIBRETRANSLATE_URL ?? '',
  libreTranslateKey: process.env.LIBRETRANSLATE_API_KEY ?? '',

  // OCR
  tesseractPath: process.env.TESSERACT_PATH ?? 'tesseract',

  // Email (Resend). In development without a key, reset links are written to the server log.
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'no-reply@example.com',

  // Billing
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  stripePremiumPriceId: process.env.STRIPE_PREMIUM_PRICE_ID ?? '',
  revenueCatWebhookAuth: process.env.REVENUECAT_WEBHOOK_AUTH ?? '',
  revenueCatEntitlementId: process.env.REVENUECAT_ENTITLEMENT_ID ?? 'premium',
  revenueCatApiKey: process.env.REVENUECAT_API_KEY ?? '',

  // Push notifications (Expo push service). Access token optional unless enhanced security is enabled.
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN ?? '',

  mediaDir: process.env.MEDIA_DIR ?? new URL('../media', import.meta.url).pathname,
};

export type AppConfig = typeof config;
