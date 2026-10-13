import type { Browser, BrowserContext, Page } from '@playwright/test';

export const API = process.env.API_URL ?? 'http://localhost:4000';

export async function registerUser(name: string, extra: Record<string, unknown> = {}) {
  const email = `${name.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;
  const res = await fetch(API + '/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Passw0rd!x', displayName: name, birthYear: 1994, acceptTerms: true, ...extra }),
  });
  if (!res.ok) throw new Error('register failed ' + (await res.text()));
  const data = await res.json();
  await fetch(API + '/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + data.accessToken },
    body: JSON.stringify({ onboardingCompleted: true }),
  });
  return { ...data, email, password: 'Passw0rd!x' };
}

/** Opens a fresh, isolated browser context already signed in as the given user. */
export async function signedInPage(browser: Browser, user: { accessToken: string; refreshToken: string }, opts: Parameters<Browser['newContext']>[0] = {}) {
  const ctx: BrowserContext = await browser.newContext({ permissions: ['microphone'], ...opts });
  await ctx.addInitScript((t) => localStorage.setItem('fp.tokens', JSON.stringify(t)), {
    accessToken: user.accessToken,
    refreshToken: user.refreshToken,
  });
  const page: Page = await ctx.newPage();
  return { ctx, page };
}

export async function audioStats(page: Page) {
  return page.evaluate(async () => {
    const s = (window as any).__activeCall;
    return s ? await s.getAudioStats() : null;
  });
}

export async function apiCall(token: string, method: string, path: string, body?: unknown, platform = 'web') {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, 'x-client-platform': platform },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

/** Test-only: promote a user to admin directly in the database (the API has no self-promotion path by design). */
export async function makeAdmin(email: string) {
  const { execFileSync } = await import('node:child_process');
  const db = process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/fluentpath';
  execFileSync('psql', [db, '-c', `UPDATE users SET role='admin' WHERE email='${email.replace(/'/g, "''")}'`]);
}
