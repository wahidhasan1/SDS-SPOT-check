import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { and, desc, eq, gte, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CEFR_LEVELS, chartSchema, listeningContentSchema, readingContentSchema } from '@fluentpath/shared';
import { API_ROOT } from '../../config';
import { db, schema } from '../../db';
import { badRequest, notFound } from '../../lib/errors';
import { parse, uuidParam } from '../../lib/validate';
import { requireAdmin } from '../../plugins/auth';
import { setSubscription } from '../../services/billing';
import { readMultipart, sniffType } from '../../services/media';
import { notify } from '../../services/notifications';
import { audit, registerCrud } from './crud';

const status = z.enum(['draft', 'published', 'archived']);
const slug = z.string().trim().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens');
const n = sql<number>`count(*)::int`;

function zodProblems(schemaObj: z.ZodType, value: unknown): string[] {
  const r = schemaObj.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.') || 'content'}: ${i.message}`);
}

export async function adminRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------------- overview
  app.get('/api/admin/overview', async (req) => {
    requireAdmin(req);
    const day = new Date(Date.now() - 86400_000);
    const week = new Date(Date.now() - 7 * 86400_000);
    const [[users], [newWeek], [active], [premium], [openReports], [callsDay], [lessons], [sets], [words], [writingPending]] = await Promise.all([
      db.select({ c: n }).from(schema.users),
      db.select({ c: n }).from(schema.users).where(gte(schema.users.createdAt, week)),
      db.select({ c: sql<number>`count(distinct user_id)::int` }).from(schema.activityLog).where(gte(schema.activityLog.createdAt, day)),
      db.select({ c: n }).from(schema.subscriptions).where(eq(schema.subscriptions.plan, 'premium')),
      db.select({ c: n }).from(schema.reports).where(inArray(schema.reports.status, ['open', 'reviewing'])),
      db.select({ c: n }).from(schema.callSessions).where(and(gte(schema.callSessions.matchedAt, day), eq(schema.callSessions.status, 'ended'))),
      db.select({ c: n }).from(schema.lessons),
      db.select({ c: n }).from(schema.ieltsSets),
      db.select({ c: n }).from(schema.words),
      db.select({ c: n }).from(schema.writingSubmissions).where(eq(schema.writingSubmissions.status, 'evaluating')),
    ]);
    return { users: users.c, newThisWeek: newWeek.c, activeToday: active.c, premium: premium.c, openReports: openReports.c, callsToday: callsDay.c, content: { lessons: lessons.c, ieltsSets: sets.c, words: words.c }, writingEvaluating: writingPending.c };
  });

  // ---------------------------------------------------------------- users
  app.get('/api/admin/users', async (req) => {
    requireAdmin(req);
    const q = parse(z.object({ q: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), role: z.enum(['user', 'admin']).optional(), status: z.enum(['active', 'suspended', 'deactivated']).optional() }), req.query);
    const where = and(
      q.q ? or(ilike(schema.users.email, `%${q.q}%`), ilike(schema.profiles.displayName, `%${q.q}%`)) : undefined,
      q.role ? eq(schema.users.role, q.role) : undefined,
      q.status ? eq(schema.users.status, q.status) : undefined,
    );
    const rows = await db
      .select({ id: schema.users.id, email: schema.users.email, role: schema.users.role, status: schema.users.status, createdAt: schema.users.createdAt, lastLoginAt: schema.users.lastLoginAt, displayName: schema.profiles.displayName, cefrLevel: schema.profiles.cefrLevel, plan: schema.subscriptions.plan, provider: schema.subscriptions.provider })
      .from(schema.users)
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .leftJoin(schema.subscriptions, eq(schema.subscriptions.userId, schema.users.id))
      .where(where)
      .orderBy(desc(schema.users.createdAt))
      .limit(51)
      .offset((q.page - 1) * 50);
    const [{ total }] = await db.select({ total: n }).from(schema.users).leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id)).where(where);
    return { items: rows.slice(0, 50), total, hasMore: rows.length > 50 };
  });

  app.get('/api/admin/users/:id', async (req) => {
    requireAdmin(req);
    const { id } = parse(uuidParam, req.params);
    const [user] = await db.select({ id: schema.users.id, email: schema.users.email, role: schema.users.role, status: schema.users.status, createdAt: schema.users.createdAt, lastLoginAt: schema.users.lastLoginAt, googleLinked: sql<boolean>`${schema.users.googleSub} is not null` }).from(schema.users).where(eq(schema.users.id, id));
    if (!user) throw notFound('User not found.');
    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, id));
    const [subscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, id));
    const reportsAgainst = await db.select().from(schema.reports).where(eq(schema.reports.reportedUserId, id)).orderBy(desc(schema.reports.createdAt)).limit(20);
    const [stats] = await db.select({ activities: n, xp: sql<number>`coalesce(sum(xp),0)::int` }).from(schema.activityLog).where(eq(schema.activityLog.userId, id));
    const [calls] = await db.select({ c: n }).from(schema.callSessions).where(or(eq(schema.callSessions.userA, id), eq(schema.callSessions.userB, id)));
    return { user, profile, subscription, reportsAgainst, stats: { ...stats, calls: calls.c } };
  });

  app.patch('/api/admin/users/:id', async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ role: z.enum(['user', 'admin']).optional(), status: z.enum(['active', 'suspended', 'deactivated']).optional() }), req.body);
    if (id === admin.id && (body.role === 'user' || (body.status && body.status !== 'active'))) throw badRequest('You cannot remove your own administrator access or suspend yourself.');
    const res = await db.update(schema.users).set(body).where(eq(schema.users.id, id)).returning({ id: schema.users.id });
    if (!res.length) throw notFound('User not found.');
    if (body.status && body.status !== 'active') await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
    await audit(admin.id, 'update:user', id, body);
    return { ok: true };
  });

  app.patch('/api/admin/users/:id/subscription', async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ plan: z.enum(['free', 'premium']), days: z.number().int().min(1).max(3650).optional() }), req.body);
    const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, id));
    if (sub?.provider === 'stripe' && sub.plan === 'premium') throw badRequest('This user pays through Stripe. Manage the subscription in the Stripe dashboard.');
    await setSubscription(id, body.plan === 'premium' ? { plan: 'premium', status: 'active', provider: 'admin', currentPeriodEnd: body.days ? new Date(Date.now() + body.days * 86400_000) : null } : { plan: 'free', status: 'active', provider: 'none', currentPeriodEnd: null });
    await audit(admin.id, 'update:subscription', id, body);
    return { ok: true };
  });

  // ---------------------------------------------------------------- moderation
  app.get('/api/admin/reports', async (req) => {
    requireAdmin(req);
    const q = parse(z.object({ status: z.enum(['open', 'reviewing', 'actioned', 'dismissed', 'all']).default('open') }), req.query);
    const reporter = schema.profiles;
    const rows = await db
      .select({
        id: schema.reports.id,
        reason: schema.reports.reason,
        details: schema.reports.details,
        status: schema.reports.status,
        adminNote: schema.reports.adminNote,
        createdAt: schema.reports.createdAt,
        resolvedAt: schema.reports.resolvedAt,
        reportedAlias: schema.reports.reportedAlias,
        reportedUserId: schema.reports.reportedUserId,
        reporterId: schema.reports.reporterId,
        reporterName: reporter.displayName,
        callSessionId: schema.reports.callSessionId,
        battleId: schema.reports.battleId,
        reportedEmail: schema.users.email,
        reportedStatus: schema.users.status,
        priorReports: sql<number>`(select count(*)::int from reports r2 where r2.reported_user_id = ${schema.reports.reportedUserId})`,
      })
      .from(schema.reports)
      .innerJoin(schema.users, eq(schema.users.id, schema.reports.reportedUserId))
      .leftJoin(reporter, eq(reporter.userId, schema.reports.reporterId))
      .where(q.status === 'all' ? undefined : eq(schema.reports.status, q.status))
      .orderBy(desc(schema.reports.createdAt))
      .limit(200);
    return { items: rows };
  });

  app.patch('/api/admin/reports/:id', async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ status: z.enum(['open', 'reviewing', 'actioned', 'dismissed']), adminNote: z.string().trim().max(2000).optional(), suspendUser: z.boolean().default(false) }), req.body);
    const [r] = await db.select().from(schema.reports).where(eq(schema.reports.id, id));
    if (!r) throw notFound('Report not found.');
    const resolved = body.status === 'actioned' || body.status === 'dismissed';
    await db.update(schema.reports).set({ status: body.status, adminNote: body.adminNote ?? r.adminNote, resolvedBy: resolved ? admin.id : null, resolvedAt: resolved ? new Date() : null }).where(eq(schema.reports.id, id));
    if (body.suspendUser) {
      if (r.reportedUserId === admin.id) throw badRequest('You cannot suspend yourself.');
      await db.update(schema.users).set({ status: 'suspended' }).where(eq(schema.users.id, r.reportedUserId));
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, r.reportedUserId));
    }
    if (resolved && r.status !== body.status) {
      await notify(r.reporterId, { type: 'safety', title: 'Update on your report', body: body.status === 'actioned' ? `Thank you — we reviewed your report about ${r.reportedAlias} and took action.` : `We reviewed your report about ${r.reportedAlias}. We did not find a rule violation this time, but you can always block anyone you do not want to talk to.` });
    }
    await audit(admin.id, 'update:report', id, body);
    return { ok: true };
  });

  // ---------------------------------------------------------------- lists for admins
  app.get('/api/admin/subscriptions', async (req) => {
    requireAdmin(req);
    const rows = await db
      .select({ userId: schema.subscriptions.userId, plan: schema.subscriptions.plan, status: schema.subscriptions.status, provider: schema.subscriptions.provider, currentPeriodEnd: schema.subscriptions.currentPeriodEnd, cancelAtPeriodEnd: schema.subscriptions.cancelAtPeriodEnd, updatedAt: schema.subscriptions.updatedAt, email: schema.users.email })
      .from(schema.subscriptions)
      .innerJoin(schema.users, eq(schema.users.id, schema.subscriptions.userId))
      .where(ne(schema.subscriptions.plan, 'free'))
      .orderBy(desc(schema.subscriptions.updatedAt));
    return { items: rows };
  });

  app.get('/api/admin/email-outbox', async (req) => {
    requireAdmin(req);
    return { items: await db.select().from(schema.emailOutbox).orderBy(desc(schema.emailOutbox.createdAt)).limit(100) };
  });

  app.get('/api/admin/audit-log', async (req) => {
    requireAdmin(req);
    const rows = await db
      .select({ id: schema.auditLog.id, action: schema.auditLog.action, target: schema.auditLog.target, details: schema.auditLog.details, createdAt: schema.auditLog.createdAt, actor: schema.users.email })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorId))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(200);
    return { items: rows };
  });

  // ---------------------------------------------------------------- audio upload for listening content
  app.post('/api/admin/audio', async (req, reply) => {
    const admin = requireAdmin(req);
    const { file } = await readMultipart(req, 25 * 1024 * 1024);
    if (!file) throw badRequest('Choose an audio file.');
    const type = sniffType(file.buffer);
    if (!type || !type.startsWith('audio/')) throw badRequest('Unsupported audio file. Upload MP3, M4A, OGG, WAV or WebM.');
    const ext = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'webm', 'audio/3gpp': '3gp' }[type] ?? 'bin';
    const name = `${randomUUID()}.${ext}`;
    const dir = path.join(API_ROOT, 'media/listening/uploads');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), file.buffer);
    await db.insert(schema.mediaFiles).values({ ownerId: admin.id, kind: 'listening_audio', path: `media/listening/uploads/${name}`, originalName: file.filename, mime: type, sizeBytes: file.buffer.length, isPublic: true });
    await audit(admin.id, 'upload:audio', name, { originalName: file.filename });
    reply.code(201);
    return { url: `/media/listening/uploads/${name}` };
  });

  app.get('/api/admin/audio', async (req) => {
    requireAdmin(req);
    const rows = await db.select().from(schema.mediaFiles).where(eq(schema.mediaFiles.kind, 'listening_audio')).orderBy(desc(schema.mediaFiles.createdAt));
    const generated = fs.readdirSync(path.join(API_ROOT, 'media/listening')).filter((f) => f.endsWith('.mp3')).map((f) => ({ url: `/media/listening/${f}`, name: f, generated: true }));
    return { uploaded: rows.map((r) => ({ url: `/${r.path}`, name: r.originalName, sizeBytes: r.sizeBytes, createdAt: r.createdAt })), generated };
  });

  // ---------------------------------------------------------------- content CRUD

  registerCrud(app, {
    path: 'lessons',
    table: schema.lessons,
    idColumn: schema.lessons.id,
    searchColumns: [schema.lessons.title, schema.lessons.slug],
    orderBy: schema.lessons.sortOrder,
    filters: { track: schema.lessons.track, pathLevel: schema.lessons.pathLevel },
    listOmit: ['body', 'examples'],
    input: z.object({
      slug,
      title: z.string().trim().min(3).max(120),
      track: z.enum(['grammar', 'general']),
      pathLevel: z.enum(['beginner', 'intermediate', 'advanced']),
      cefrLevel: z.enum(CEFR_LEVELS),
      categorySlug: z.string().max(60).nullable().optional(),
      summary: z.string().trim().min(10).max(500),
      body: z.string().max(20000),
      examples: z.array(z.object({ text: z.string().min(1).max(500), note: z.string().max(500).optional(), correct: z.boolean().optional() })).max(30).default([]),
      sortOrder: z.number().int().default(0),
      status: status.default('draft'),
    }),
    validatePublish: async (row) => {
      const problems: string[] = [];
      if (String(row.body ?? '').length < 200) problems.push('The lesson explanation must be at least 200 characters.');
      if (row.id) {
        const ex = await db.select().from(schema.exercises).where(and(eq(schema.exercises.lessonId, row.id as string), eq(schema.exercises.status, 'published')));
        if (ex.length < 3) problems.push('A published lesson needs at least 3 published practice questions.');
      } else problems.push('Save the lesson as a draft and add practice questions before publishing.');
      return problems;
    },
  });

  registerCrud(app, {
    path: 'exercises',
    table: schema.exercises,
    idColumn: schema.exercises.id,
    searchColumns: [schema.exercises.prompt],
    orderBy: schema.exercises.sortOrder,
    filters: { lessonId: schema.exercises.lessonId, purpose: schema.exercises.purpose },
    input: z
      .object({
        lessonId: z.string().uuid().nullable().optional(),
        purpose: z.enum(['lesson', 'placement']).default('lesson'),
        type: z.enum(['mcq', 'fill']),
        skill: z.enum(['grammar', 'vocabulary', 'reading']).nullable().optional(),
        cefrLevel: z.enum(CEFR_LEVELS).nullable().optional(),
        prompt: z.string().trim().min(3).max(1000),
        passage: z.string().max(3000).nullable().optional(),
        options: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
        answers: z.array(z.string().trim().min(1).max(300)).min(1, 'At least one accepted answer is required'),
        explanation: z.string().trim().min(5, 'Add an explanation for learners').max(2000),
        sortOrder: z.number().int().default(0),
        status: status.default('published'),
      })
      .refine((e) => e.type !== 'mcq' || (e.options.length >= 2 && e.answers.every((a) => e.options.includes(a))), { message: 'Multiple-choice questions need at least 2 options and the answer must be one of them.' }),
  });

  registerCrud(app, {
    path: 'words',
    table: schema.words,
    idColumn: schema.words.id,
    searchColumns: [schema.words.word, schema.words.definition],
    orderBy: schema.words.word,
    filters: { cefrLevel: schema.words.cefrLevel, categorySlug: schema.words.categorySlug },
    input: z.object({
      word: z.string().trim().min(1).max(60),
      partOfSpeech: z.string().trim().min(1).max(30),
      phonetic: z.string().max(80).nullable().optional(),
      definition: z.string().trim().min(5).max(500),
      example: z.string().trim().min(5).max(500),
      synonyms: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
      antonyms: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
      cefrLevel: z.enum(CEFR_LEVELS),
      categorySlug: z.string().max(60).nullable().optional(),
      audioUrl: z.string().max(300).nullable().optional(),
      status: status.default('published'),
    }),
    validatePublish: (row) => (String(row.example ?? '').toLowerCase().includes(String(row.word ?? '').toLowerCase().split(' ')[0]) ? [] : ['The example sentence should contain the word.']),
  });

  registerCrud(app, {
    path: 'ielts-sets',
    table: schema.ieltsSets,
    idColumn: schema.ieltsSets.id,
    searchColumns: [schema.ieltsSets.title, schema.ieltsSets.slug],
    orderBy: schema.ieltsSets.createdAt,
    orderDesc: true,
    filters: { module: schema.ieltsSets.module, variant: schema.ieltsSets.variant },
    listOmit: ['content'],
    input: z.object({
      slug,
      module: z.enum(['reading', 'listening']),
      variant: z.enum(['academic', 'general', 'both']),
      title: z.string().trim().min(3).max(200),
      description: z.string().max(500).default(''),
      difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
      timeLimitSec: z.number().int().min(60).max(7200),
      content: z.unknown(),
      isPremium: z.boolean().default(false),
      mockOnly: z.boolean().default(false),
      status: status.default('draft'),
    }),
    prepare: (d) => {
      const content = d.content as { groups?: { questions?: unknown[] }[] } | undefined;
      const questionCount = Array.isArray(content?.groups) ? content!.groups.reduce((a, g) => a + (Array.isArray(g.questions) ? g.questions.length : 0), 0) : 0;
      return { ...d, questionCount };
    },
    validatePublish: (row) => {
      const problems = zodProblems(row.module === 'listening' ? listeningContentSchema : readingContentSchema, row.content);
      if (row.module === 'listening' && !problems.length) {
        for (const s of (row.content as { sections: { audioUrl: string }[] }).sections) {
          const local = s.audioUrl.startsWith('/media/') ? path.join(API_ROOT, s.audioUrl) : null;
          if (local && !fs.existsSync(local)) problems.push(`Audio file not found: ${s.audioUrl}`);
        }
      }
      return problems;
    },
  });

  registerCrud(app, {
    path: 'writing-tasks',
    table: schema.writingTasks,
    idColumn: schema.writingTasks.id,
    searchColumns: [schema.writingTasks.title, schema.writingTasks.prompt],
    orderBy: schema.writingTasks.createdAt,
    orderDesc: true,
    filters: { variant: schema.writingTasks.variant },
    input: z.object({
      slug,
      variant: z.enum(['academic', 'general']),
      taskNumber: z.number().int().min(1).max(2),
      taskType: z.enum(['bar', 'line', 'pie', 'table', 'process', 'map', 'letter', 'essay']),
      title: z.string().trim().min(3).max(200),
      prompt: z.string().trim().min(20).max(3000),
      instructions: z.string().trim().min(10).max(1000),
      visual: z.unknown().nullable().optional(),
      minWords: z.number().int().min(50).max(500),
      timeMinutes: z.number().int().min(5).max(90),
      modelOutline: z.string().max(3000).default(''),
      isPremium: z.boolean().default(false),
      mockOnly: z.boolean().default(false),
      status: status.default('draft'),
    }),
    validatePublish: (row) => {
      const problems: string[] = [];
      const needsVisual = ['bar', 'line', 'pie', 'table', 'process', 'map'].includes(String(row.taskType));
      if (needsVisual) {
        if (!row.visual) problems.push('Academic Task 1 charts need visual data.');
        else problems.push(...zodProblems(chartSchema, row.visual));
      }
      return problems;
    },
  });

  registerCrud(app, {
    path: 'speaking-prompts',
    table: schema.speakingPrompts,
    idColumn: schema.speakingPrompts.id,
    searchColumns: [schema.speakingPrompts.topic, schema.speakingPrompts.slug],
    orderBy: schema.speakingPrompts.part,
    filters: { part: schema.speakingPrompts.part },
    input: z.object({
      slug,
      part: z.number().int().min(1).max(3),
      topic: z.string().trim().min(2).max(120),
      questions: z.array(z.string().trim().min(3).max(300)).min(1).max(10),
      cueCard: z.string().max(300).nullable().optional(),
      prepSeconds: z.number().int().min(0).max(300).default(0),
      speakSeconds: z.number().int().min(15).max(300),
      status: status.default('draft'),
    }),
    validatePublish: (row) => (row.part === 2 && !row.cueCard ? ['Part 2 prompts need a cue card.'] : []),
  });

  registerCrud(app, {
    path: 'mock-tests',
    table: schema.mockTests,
    idColumn: schema.mockTests.id,
    searchColumns: [schema.mockTests.title],
    orderBy: schema.mockTests.createdAt,
    input: z.object({
      slug,
      variant: z.enum(['academic', 'general']),
      title: z.string().trim().min(3).max(200),
      description: z.string().trim().min(10).max(2000),
      sections: z.array(z.object({ module: z.enum(['listening', 'reading', 'writing', 'speaking']), refs: z.array(z.string().min(1)).min(1), timeLimitSec: z.number().int().min(60).max(7200) })).min(1).max(4),
      isPremium: z.boolean().default(false),
      status: status.default('draft'),
    }),
    validatePublish: async (row) => {
      const problems: string[] = [];
      for (const s of row.sections as { module: string; refs: string[] }[]) {
        for (const ref of s.refs) {
          const table = s.module === 'writing' ? schema.writingTasks : s.module === 'speaking' ? schema.speakingPrompts : schema.ieltsSets;
          const [found] = await db.select({ status: table.status }).from(table).where(eq(table.slug, ref));
          if (!found) problems.push(`${s.module} section: "${ref}" does not exist.`);
          else if (found.status !== 'published') problems.push(`${s.module} section: "${ref}" is not published.`);
        }
      }
      return problems;
    },
  });

  registerCrud(app, {
    path: 'categories',
    table: schema.categories,
    idColumn: schema.categories.id,
    searchColumns: [schema.categories.name, schema.categories.slug],
    orderBy: schema.categories.sortOrder,
    filters: { kind: schema.categories.kind },
    input: z.object({ kind: z.enum(['vocabulary', 'grammar', 'speaking']), slug, name: z.string().trim().min(2).max(80), description: z.string().max(300).default(''), sortOrder: z.number().int().default(0) }),
  });

}
