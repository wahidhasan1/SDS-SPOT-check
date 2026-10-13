import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import '../src/routes/register';
import { seed } from '../src/db/seed';
import { pool, q } from '../src/db/pool';

let app: FastifyInstance | null = null;
let seeded = false;

export async function getApp() {
  if (!seeded) {
    await seed(false);
    seeded = true;
  }
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

let n = 0;
export async function newUser(opts: { birthYear?: number; name?: string } = {}) {
  const a = await getApp();
  const email = `t${Date.now()}-${n++}-${Math.floor(Math.random() * 1e6)}@test.dev`;
  const res = await a.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'Passw0rd!x', displayName: opts.name ?? 'Tester', birthYear: opts.birthYear ?? 1990, acceptTerms: true },
  });
  if (res.statusCode !== 200) throw new Error('register failed: ' + res.body);
  const body = res.json();
  return { ...body, email, auth: { authorization: `Bearer ${body.accessToken}` } };
}

export async function makeAdmin(userId: string) {
  await q(`UPDATE users SET role='admin' WHERE id=$1`, [userId]);
}

export async function closeAll() {
  if (app) await app.close();
  app = null;
  await pool.end();
}
