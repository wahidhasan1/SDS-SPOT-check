import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool, schema } from '../src/db';
import { call, getApp, registerUser } from './helpers';

afterAll(async () => {
  await (await getApp()).close();
  await pool.end();
});

async function makeAdmin() {
  const u = await registerUser({ displayName: 'Admin' });
  await db.update(schema.users).set({ role: 'admin' }).where(eq(schema.users.id, u.id));
  return u;
}

describe('administration', () => {
  it('blocks normal users from every admin endpoint (server-side RBAC)', async () => {
    const u = await registerUser();
    for (const url of ['/api/admin/overview', '/api/admin/users', '/api/admin/reports', '/api/admin/lessons', '/api/admin/words', '/api/admin/ielts-sets', '/api/admin/audit-log']) {
      expect((await call(u, 'GET', url)).status).toBe(403);
    }
    expect((await call(u, 'POST', '/api/admin/words', { word: 'x' })).status).toBe(403);
    expect((await call(null, 'GET', '/api/admin/overview')).status).toBe(401);
  });

  it('lets admins manage content with validation before publishing', async () => {
    const admin = await makeAdmin();
    const ov = await call(admin, 'GET', '/api/admin/overview');
    expect(ov.status).toBe(200);
    expect(ov.json.content.lessons).toBeGreaterThan(20);

    // A lesson cannot be published without enough explanation and questions.
    const bad = await call(admin, 'POST', '/api/admin/lessons', { slug: 'test-lesson', title: 'Test lesson', track: 'grammar', pathLevel: 'beginner', cefrLevel: 'A1', summary: 'A short summary here.', body: 'Too short', status: 'published' });
    expect(bad.status).toBe(400);
    const draft = await call(admin, 'POST', '/api/admin/lessons', { slug: 'test-lesson', title: 'Test lesson', track: 'grammar', pathLevel: 'beginner', cefrLevel: 'A1', summary: 'A short summary here.', body: 'x'.repeat(250), status: 'draft' });
    expect(draft.status).toBe(201);
    const id = draft.json.item.id;
    expect((await call(admin, 'PATCH', `/api/admin/lessons/${id}`, { status: 'published' })).status).toBe(400);
    const wrongMcq = await call(admin, 'POST', '/api/admin/exercises', { lessonId: id, type: 'mcq', prompt: 'Pick one', options: ['a', 'b'], answers: ['c'], explanation: 'Because.' });
    expect(wrongMcq.status).toBe(400);
    for (let i = 0; i < 3; i++) {
      expect((await call(admin, 'POST', '/api/admin/exercises', { lessonId: id, type: 'mcq', prompt: `Question ${i}`, options: ['a', 'b'], answers: ['a'], explanation: 'Because a.' })).status).toBe(201);
    }
    expect((await call(admin, 'PATCH', `/api/admin/lessons/${id}`, { status: 'published' })).status).toBe(200);
    const learner = await registerUser();
    const lesson = await call(learner, 'GET', '/api/lessons/test-lesson');
    expect(lesson.json.exercises).toHaveLength(3);

    // IELTS content is validated against the schema before publishing.
    const set = await call(admin, 'POST', '/api/admin/ielts-sets', { slug: 'admin-reading', module: 'reading', variant: 'academic', title: 'Admin reading', timeLimitSec: 600, content: { passages: [], groups: [] }, status: 'published' });
    expect(set.status).toBe(400);
    expect(set.json.error.details.length).toBeGreaterThan(0);
    const okSet = await call(admin, 'POST', '/api/admin/ielts-sets', {
      slug: 'admin-reading', module: 'reading', variant: 'academic', title: 'Admin reading', timeLimitSec: 600, status: 'published',
      content: { passages: [{ id: 'p1', title: 'P', paragraphs: [{ text: 'Cats sleep a lot.' }] }], groups: [{ id: 'g1', type: 'tfng', instructions: 'TFNG', options: [{ key: 'TRUE', text: 'TRUE' }, { key: 'FALSE', text: 'FALSE' }, { key: 'NOT GIVEN', text: 'NOT GIVEN' }], questions: [{ n: 1, prompt: 'Cats sleep a lot.', answer: ['TRUE'], explanation: 'Stated.' }] }] },
    });
    expect(okSet.status).toBe(201);
    expect(okSet.json.item.questionCount).toBe(1);
    const audit = await call(admin, 'GET', '/api/admin/audit-log');
    expect(audit.json.items.some((a: { action: string }) => a.action === 'create:lessons')).toBe(true);
  });

  it('moderates reports, suspends users and notifies the reporter', async () => {
    const admin = await makeAdmin();
    const reporter = await registerUser();
    const offender = await registerUser();
    const [callRow] = await db.insert(schema.callSessions).values({ userA: reporter.id, userB: offender.id, aliasA: 'Calm Fox 1', aliasB: 'Rude Owl 2', mode: 'general', topic: 'any', status: 'ended' }).returning();
    expect((await call(reporter, 'POST', `/api/calls/${callRow.id}/report`, { reason: 'harassment', details: 'was rude' })).status).toBe(201);
    const list = await call(admin, 'GET', '/api/admin/reports');
    const r = list.json.items.find((x: { callSessionId: string }) => x.callSessionId === callRow.id);
    expect(r.reportedAlias).toBe('Rude Owl 2');
    expect((await call(admin, 'PATCH', `/api/admin/reports/${r.id}`, { status: 'actioned', adminNote: 'Suspended', suspendUser: true })).status).toBe(200);
    expect((await call(offender, 'GET', '/api/auth/me')).status).toBe(401);
    const login = await call(null, 'POST', '/api/auth/login', { email: offender.email, password: 'Passw0rd!' });
    expect(login.status).toBe(403);
    const notes = await call(reporter, 'GET', '/api/notifications');
    expect(notes.json.notifications.some((n: { title: string }) => n.title === 'Update on your report')).toBe(true);
  });

  it('prevents admins from removing their own admin role', async () => {
    const admin = await makeAdmin();
    expect((await call(admin, 'PATCH', `/api/admin/users/${admin.id}`, { role: 'user' })).status).toBe(400);
  });
});

describe('billing and account', () => {
  it('uses a clearly labelled development mode when payments are not configured, with server-side entitlements', async () => {
    const u = await registerUser();
    const b = await call(u, 'GET', '/api/billing');
    expect(b.json.paymentsConfigured).toBe(false);
    expect(b.json.devMode).toBe(true);
    expect((await call(u, 'POST', '/api/billing/checkout')).status).toBe(503);
    const sets = await call(u, 'GET', '/api/ielts/sets?module=reading&variant=academic');
    const premium = sets.json.sets.find((s: { isPremium: boolean }) => s.isPremium);
    expect((await call(u, 'POST', `/api/ielts/sets/${premium.id}/start`)).status).toBe(429);
    expect((await call(u, 'POST', '/api/billing/dev/activate')).status).toBe(200);
    const me = await call(u, 'GET', '/api/auth/me');
    expect(me.json.me.plan).toBe('premium');
    expect(me.json.me.subscription.provider).toBe('development');
    expect((await call(u, 'POST', `/api/ielts/sets/${premium.id}/start`)).status).toBe(200);
    expect((await call(u, 'POST', '/api/billing/dev/cancel')).status).toBe(200);
    expect((await call(u, 'GET', '/api/auth/me')).json.me.plan).toBe('free');
  });

  it('exports and permanently deletes an account after password confirmation', async () => {
    const u = await registerUser();
    await call(u, 'POST', '/api/vocab/my', { word: 'goodbye', definition: 'farewell', source: 'manual' });
    const exp = await call(u, 'GET', '/api/account/export');
    expect(exp.json.user.email).toBe(u.email);
    expect(exp.json.vocabulary).toHaveLength(1);
    expect(JSON.stringify(exp.json)).not.toContain('scrypt$');
    expect((await call(u, 'DELETE', '/api/account', { password: 'wrongpass1', confirm: 'DELETE' })).status).toBe(400);
    expect((await call(u, 'DELETE', '/api/account', { password: 'Passw0rd!', confirm: 'nope' })).status).toBe(400);
    expect((await call(u, 'DELETE', '/api/account', { password: 'Passw0rd!', confirm: 'DELETE' })).status).toBe(200);
    const rows = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    expect(rows).toHaveLength(0);
    expect((await call(null, 'POST', '/api/auth/login', { email: u.email, password: 'Passw0rd!' })).status).toBe(401);
  });

  it('deactivates and reactivates on next sign-in', async () => {
    const u = await registerUser();
    expect((await call(u, 'POST', '/api/account/deactivate', { password: 'Passw0rd!' })).status).toBe(200);
    expect((await call(u, 'GET', '/api/auth/me')).status).toBe(401);
    const login = await call(null, 'POST', '/api/auth/login', { email: u.email, password: 'Passw0rd!' });
    expect(login.status).toBe(200);
  });
});
