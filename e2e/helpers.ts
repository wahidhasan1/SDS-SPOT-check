import { expect, type APIRequestContext, type BrowserContext } from '@playwright/test';

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Create an account through the real API and complete onboarding; cookies land in the given context. */
export async function signUp(req: APIRequestContext, opts: { name: string; email?: string; level?: string }) {
  const email = opts.email ?? uniqueEmail(opts.name.toLowerCase().replace(/\s+/g, '-'));
  const r = await req.post('/api/auth/register', { data: { email, password: 'Passw0rd1', displayName: opts.name, client: 'web' } });
  expect(r.status()).toBe(201);
  const o = await req.put('/api/profile/onboarding', { data: { goals: ['ielts', 'confidence'], preferredActivities: ['speaking'], confidence: 3, ieltsModule: 'academic' } });
  expect(o.status()).toBe(200);
  return { email, password: 'Passw0rd1' };
}

export async function signUpInContext(ctx: BrowserContext, name: string) {
  return signUp(ctx.request, { name });
}

/** Promote an existing account to administrator using the documented CLI script. */
export function promoteAdmin(email: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
  execFileSync('npm', ['run', '-s', 'admin:promote', '--', email], { cwd: `${__dirname}/..`, stdio: 'pipe' });
}
