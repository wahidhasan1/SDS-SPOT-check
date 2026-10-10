/**
 * Public runtime configuration. Only *public* values belong here: the
 * Supabase URL and anon key are designed to ship in apps (Row Level Security
 * protects the data). Service-role keys and AI/OCR provider secrets must
 * never be added to the mobile app — they live in backend functions.
 */
export const env = {
  supabaseUrl: String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''),
  supabaseAnonKey: String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''),
  /** Optional, comma-separated: 'google,apple'. Providers must be enabled in Supabase Auth first. */
  oauthProviders: String(process.env.EXPO_PUBLIC_OAUTH_PROVIDERS ?? '')
    .split(',')
    .map((p: string) => p.trim())
    .filter((p: string): p is 'google' | 'apple' => p === 'google' || p === 'apple'),
  /** Optional URLs shown on the subscription and help screens. */
  termsUrl: String(process.env.EXPO_PUBLIC_TERMS_URL ?? ''),
  privacyUrl: String(process.env.EXPO_PUBLIC_PRIVACY_URL ?? ''),
  supportEmail: String(process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? ''),
};

export const isBackendConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
