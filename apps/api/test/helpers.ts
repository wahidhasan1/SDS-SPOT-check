import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app';

let app: FastifyInstance | null = null;

export async function getApp() {
  app ??= await buildApp({ logger: false });
  await app.ready();
  return app;
}

export interface TestUser { id: string; email: string; cookie: string; token?: string }

export async function registerUser(opts: { displayName?: string; mobile?: boolean } = {}): Promise<TestUser> {
  const a = await getApp();
  const email = `user-${randomUUID().slice(0, 8)}@example.com`;
  const res = await a.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'Passw0rd!', displayName: opts.displayName ?? 'Test User', client: opts.mobile ? 'mobile' : 'web' },
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  const cookie = (res.headers['set-cookie'] as string | undefined)?.split(';')[0] ?? '';
  const body = res.json();
  return { id: body.me.id, email, cookie, token: body.token };
}

export async function call(user: TestUser | null, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: unknown) {
  const a = await getApp();
  const headers: Record<string, string> = {};
  if (user?.token) headers.authorization = `Bearer ${user.token}`;
  else if (user) headers.cookie = user.cookie;
  const res = await a.inject({ method, url, payload: payload as never, headers });
  let json: any = null;
  try {
    json = res.json();
  } catch {
    json = null;
  }
  return { status: res.statusCode, json, res };
}

export async function onboard(user: TestUser, extra: Record<string, unknown> = {}) {
  return call(user, 'PUT', '/api/profile/onboarding', {
    goals: ['ielts'],
    preferredActivities: ['speaking', 'vocabulary'],
    confidence: 3,
    ieltsModule: 'academic',
    ...extra,
  });
}
