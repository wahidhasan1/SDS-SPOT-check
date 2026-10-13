import type { FastifyInstance } from 'fastify';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { isAnswerCorrect } from '@fluentpath/shared';
import { db, schema } from '../db';
import { notFound } from '../lib/errors';
import { parse, slugParam } from '../lib/validate';
import { requireUser } from '../plugins/auth';
import { logActivity } from '../services/activity';

export const PASS_RATIO = 0.7;

export async function lessonRoutes(app: FastifyInstance) {
  app.get('/api/lessons', async (req) => {
    const u = requireUser(req);
    const q = parse(z.object({ track: z.enum(['grammar', 'general']).optional() }), req.query);
    const rows = await db
      .select({
        id: schema.lessons.id,
        slug: schema.lessons.slug,
        title: schema.lessons.title,
        track: schema.lessons.track,
        pathLevel: schema.lessons.pathLevel,
        cefrLevel: schema.lessons.cefrLevel,
        categorySlug: schema.lessons.categorySlug,
        summary: schema.lessons.summary,
        exerciseCount: sql<number>`(select count(*)::int from exercises e where e.lesson_id = ${schema.lessons.id} and e.status = 'published')`,
        status: schema.lessonProgress.status,
        bestScore: schema.lessonProgress.bestScore,
        maxScore: schema.lessonProgress.maxScore,
      })
      .from(schema.lessons)
      .leftJoin(schema.lessonProgress, and(eq(schema.lessonProgress.lessonId, schema.lessons.id), eq(schema.lessonProgress.userId, u.id)))
      .where(and(eq(schema.lessons.status, 'published'), q.track ? eq(schema.lessons.track, q.track) : undefined))
      .orderBy(asc(schema.lessons.sortOrder));
    return { lessons: rows };
  });

  app.get('/api/lessons/:slug', async (req) => {
    const u = requireUser(req);
    const { slug } = parse(slugParam, req.params);
    const [lesson] = await db.select().from(schema.lessons).where(and(eq(schema.lessons.slug, slug), eq(schema.lessons.status, 'published')));
    if (!lesson) throw notFound('Lesson not found.');
    const exercises = await db
      .select({ id: schema.exercises.id, type: schema.exercises.type, prompt: schema.exercises.prompt, options: schema.exercises.options })
      .from(schema.exercises)
      .where(and(eq(schema.exercises.lessonId, lesson.id), eq(schema.exercises.status, 'published')))
      .orderBy(asc(schema.exercises.sortOrder));
    const [progress] = await db
      .select()
      .from(schema.lessonProgress)
      .where(and(eq(schema.lessonProgress.lessonId, lesson.id), eq(schema.lessonProgress.userId, u.id)));
    // Neighbouring lessons in the same track, for "next lesson" navigation.
    const siblings = await db
      .select({ slug: schema.lessons.slug, title: schema.lessons.title })
      .from(schema.lessons)
      .where(and(eq(schema.lessons.track, lesson.track), eq(schema.lessons.status, 'published')))
      .orderBy(asc(schema.lessons.sortOrder));
    const idx = siblings.findIndex((s) => s.slug === slug);
    if (!progress) {
      await db.insert(schema.lessonProgress).values({ userId: u.id, lessonId: lesson.id, status: 'started' }).onConflictDoNothing();
    }
    return {
      lesson,
      exercises,
      progress: progress ?? { status: 'started', bestScore: 0, maxScore: 0, attemptsCount: 0 },
      next: siblings[idx + 1] ?? null,
      prev: siblings[idx - 1] ?? null,
    };
  });

  app.post('/api/lessons/:slug/submit', async (req) => {
    const u = requireUser(req);
    const { slug } = parse(slugParam, req.params);
    const body = parse(z.object({ answers: z.record(z.string().uuid(), z.string().max(300)), durationSec: z.number().int().min(0).max(36000).optional() }), req.body);
    const [lesson] = await db.select().from(schema.lessons).where(and(eq(schema.lessons.slug, slug), eq(schema.lessons.status, 'published')));
    if (!lesson) throw notFound('Lesson not found.');
    const exercises = await db
      .select()
      .from(schema.exercises)
      .where(and(eq(schema.exercises.lessonId, lesson.id), eq(schema.exercises.status, 'published')))
      .orderBy(asc(schema.exercises.sortOrder));
    const results = exercises.map((e) => {
      const given = body.answers[e.id] ?? null;
      return { id: e.id, given, correct: isAnswerCorrect(given, e.answers), correctAnswer: e.answers[0], explanation: e.explanation };
    });
    const score = results.filter((r) => r.correct).length;
    const max = results.length;
    const passed = max > 0 && score / max >= PASS_RATIO;

    const [prev] = await db.select().from(schema.lessonProgress).where(and(eq(schema.lessonProgress.lessonId, lesson.id), eq(schema.lessonProgress.userId, u.id)));
    const completed = passed || prev?.status === 'completed';
    await db
      .insert(schema.lessonProgress)
      .values({ userId: u.id, lessonId: lesson.id, status: completed ? 'completed' : 'started', bestScore: score, maxScore: max, attemptsCount: 1, completedAt: passed ? new Date() : null })
      .onConflictDoUpdate({
        target: [schema.lessonProgress.userId, schema.lessonProgress.lessonId],
        set: {
          status: completed ? 'completed' : 'started',
          bestScore: sql`greatest(${schema.lessonProgress.bestScore}, ${score})`,
          maxScore: max,
          attemptsCount: sql`${schema.lessonProgress.attemptsCount} + 1`,
          completedAt: prev?.completedAt ?? (passed ? new Date() : null),
          updatedAt: new Date(),
        },
      });
    await db.insert(schema.attempts).values({
      userId: u.id,
      kind: 'lesson',
      refId: lesson.id,
      title: lesson.title,
      status: 'completed',
      answers: body.answers,
      results,
      score,
      maxScore: max,
      durationSec: body.durationSec ?? null,
      completedAt: new Date(),
    });
    const { newAchievements } = await logActivity(u.id, {
      type: 'lesson',
      title: `${passed ? 'Completed' : 'Practised'} lesson: ${lesson.title} (${score}/${max})`,
      refId: lesson.id,
      xp: 10 + score * 2,
      minutes: body.durationSec ? body.durationSec / 60 : 5,
    });
    return { score, maxScore: max, passed, passRatio: PASS_RATIO, results, newAchievements };
  });
}
