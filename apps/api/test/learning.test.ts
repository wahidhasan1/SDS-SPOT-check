import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool, schema } from '../src/db';
import { placementLevel } from '../src/routes/profile';
import { call, getApp, onboard, registerUser } from './helpers';

afterAll(async () => {
  await (await getApp()).close();
  await pool.end();
});

describe('onboarding and placement', () => {
  it('requires onboarding fields and stores them', async () => {
    const u = await registerUser();
    const bad = await call(u, 'PUT', '/api/profile/onboarding', { goals: [], preferredActivities: [], confidence: 3 });
    expect(bad.status).toBe(400);
    const ok = await onboard(u, { nativeLanguage: 'Spanish' });
    expect(ok.status).toBe(200);
    expect(ok.json.me.profile.onboardingCompleted).toBe(true);
    expect(ok.json.me.profile.nativeLanguage).toBe('Spanish');
  });

  it('computes the CEFR level from the answers, not arbitrarily', async () => {
    expect(placementLevel({ A1: { correct: 5, total: 5 }, A2: { correct: 4, total: 5 }, B1: { correct: 2, total: 5 } })).toBe('A2');
    expect(placementLevel({ A1: { correct: 1, total: 5 } })).toBe('A1');

    const u = await registerUser();
    await onboard(u);
    const start = await call(u, 'POST', '/api/assessment/start');
    expect(start.status).toBe(200);
    expect(start.json.questions).toHaveLength(30);
    expect(start.json.questions[0].answers).toBeUndefined();
    // Answer A1–B1 correctly using the stored answer key, the rest wrong.
    const ids: string[] = start.json.questions.map((q: { id: string }) => q.id);
    const rows = await db.select().from(schema.exercises).where(eq(schema.exercises.purpose, 'placement'));
    const answers: Record<string, string> = {};
    for (const id of ids) {
      const q = rows.find((r) => r.id === id)!;
      answers[id] = ['A1', 'A2', 'B1'].includes(q.cefrLevel!) ? q.answers[0] : '__wrong__';
    }
    const res = await call(u, 'POST', `/api/assessment/${start.json.assessmentId}/submit`, { answers });
    expect(res.status).toBe(200);
    expect(res.json.level).toBe('B1');
    expect(res.json.score).toBe(15);
    const me = await call(u, 'GET', '/api/auth/me');
    expect(me.json.me.profile.cefrLevel).toBe('B1');
    const again = await call(u, 'POST', `/api/assessment/${start.json.assessmentId}/submit`, { answers });
    expect(again.status).toBe(400);
  });
});

describe('grammar lessons', () => {
  it('scores answers server-side and updates progress', async () => {
    const u = await registerUser();
    await onboard(u);
    const list = await call(u, 'GET', '/api/lessons?track=grammar');
    expect(list.json.lessons.length).toBeGreaterThan(15);
    const lesson = await call(u, 'GET', '/api/lessons/present-simple');
    expect(lesson.status).toBe(200);
    const exercises = lesson.json.exercises as { id: string }[];
    expect((exercises[0] as Record<string, unknown>).answers).toBeUndefined();
    const key = await db.select().from(schema.exercises).where(eq(schema.exercises.lessonId, lesson.json.lesson.id));
    const answers = Object.fromEntries(key.map((e, i) => [e.id, i === 0 ? 'wrong answer' : e.answers[0].toUpperCase()]));
    const res = await call(u, 'POST', '/api/lessons/present-simple/submit', { answers });
    expect(res.json.score).toBe(key.length - 1);
    expect(res.json.passed).toBe(true);
    expect(res.json.results.find((r: { correct: boolean }) => !r.correct).explanation).toBeTruthy();
    const after = await call(u, 'GET', '/api/lessons?track=grammar');
    const item = after.json.lessons.find((l: { slug: string }) => l.slug === 'present-simple');
    expect(item.status).toBe('completed');
    expect(item.bestScore).toBe(key.length - 1);
  });
});

describe('vocabulary', () => {
  it('saves words, prevents duplicates, schedules spaced repetition and runs quizzes', async () => {
    const u = await registerUser();
    await onboard(u);
    const daily = await call(u, 'GET', '/api/vocab/daily');
    expect(daily.json.words).toHaveLength(5);
    const daily2 = await call(u, 'GET', '/api/vocab/daily');
    expect(daily2.json.words.map((w: { id: string }) => w.id)).toEqual(daily.json.words.map((w: { id: string }) => w.id));
    for (const w of daily.json.words) expect((await call(u, 'POST', '/api/vocab/my', { wordId: w.id, source: 'daily' })).status).toBe(201);
    expect((await call(u, 'POST', '/api/vocab/my', { wordId: daily.json.words[0].id })).status).toBe(409);
    const custom = await call(u, 'POST', '/api/vocab/my', { word: 'serendipity', definition: 'a happy accident', source: 'manual' });
    expect(custom.status).toBe(201);

    const review = await call(u, 'GET', '/api/vocab/review');
    expect(review.json.totalDue).toBe(6);
    const card = review.json.cards[0];
    for (let i = 0; i < 4; i++) await call(u, 'POST', `/api/vocab/review/${card.id}`, { quality: 5 });
    const [row] = await db.select().from(schema.userWords).where(eq(schema.userWords.id, card.id));
    expect(row.repetitions).toBe(4);
    // Intervals 1 → 3 → 8 → 22 days: four perfect recalls with a 21+ day interval = mastered (documented rule).
    expect(row.intervalDays).toBeGreaterThanOrEqual(21);
    expect(row.status).toBe('mastered');
    expect(row.dueAt.getTime()).toBeGreaterThan(Date.now());
    const forgot = await call(u, 'POST', `/api/vocab/review/${card.id}`, { quality: 1 });
    expect(forgot.json.card.repetitions).toBe(0);
    expect(forgot.json.card.status).toBe('learning');

    const quiz = await call(u, 'POST', '/api/vocab/quiz/start', { source: 'my', size: 6 });
    expect(quiz.status).toBe(200);
    expect(quiz.json.questions[0].answer).toBeUndefined();
    const res = await call(u, 'POST', `/api/vocab/quiz/${quiz.json.attemptId}/submit`, { answers: { '0': quiz.json.questions[0].options[0] } });
    expect(res.status).toBe(200);
    expect(res.json.maxScore).toBe(6);
    expect(res.json.score).toBeLessThanOrEqual(1);
  });
});

describe('IELTS reading and listening', () => {
  it('hides answers and transcripts until submission, then scores with explanations and a band estimate', async () => {
    const u = await registerUser();
    await onboard(u);
    const sets = await call(u, 'GET', '/api/ielts/sets?module=listening');
    const set = sets.json.sets.find((s: { slug: string }) => s.slug === 'listening-course-booking');
    const start = await call(u, 'POST', `/api/ielts/sets/${set.id}/start`);
    const view = await call(u, 'GET', `/api/ielts/attempts/${start.json.attemptId}`);
    const json = JSON.stringify(view.json.content);
    expect(json).not.toContain('Hartley"]');
    expect(view.json.content.sections[0].transcript).toBeUndefined();
    expect(view.json.content.sections[0].audioUrl).toMatch(/\.mp3$/);
    const audio = await (await getApp()).inject({ method: 'GET', url: view.json.content.sections[0].audioUrl });
    expect(audio.statusCode).toBe(200);
    expect(Number(audio.headers['content-length'])).toBeGreaterThan(50_000);

    await call(u, 'PUT', `/api/ielts/attempts/${start.json.attemptId}/answers`, { answers: { '1': 'hartley', '2': '42' } });
    const res = await call(u, 'POST', `/api/ielts/attempts/${start.json.attemptId}/submit`, { answers: { '1': 'HARTLEY', '2': 'forty-two', '3': 'Wednesday', '4': '7', '5': '£120', '6': '15', '7': 'B', '8': 'A' } });
    expect(res.status).toBe(200);
    expect(res.json.score).toBe(7);
    expect(res.json.maxScore).toBe(8);
    expect(res.json.bandEstimate).toBeGreaterThan(6);
    const wrong = res.json.results.find((r: { n: number }) => r.n === 8);
    expect(wrong.correct).toBe(false);
    expect(wrong.correctAnswer).toContain('C');
    const after = await call(u, 'GET', `/api/ielts/attempts/${start.json.attemptId}`);
    expect(after.json.content.sections[0].transcript).toContain('Westbrook');
  });

  it('locks premium sets for free users on the server', async () => {
    const u = await registerUser();
    const sets = await call(u, 'GET', '/api/ielts/sets?module=reading&variant=academic');
    const premium = sets.json.sets.find((s: { isPremium: boolean }) => s.isPremium);
    expect(premium.locked).toBe(true);
    const start = await call(u, 'POST', `/api/ielts/sets/${premium.id}/start`);
    expect(start.status).toBe(429);
    expect(start.json.error.details.premiumRequired).toBe(true);
  });
});

describe('IELTS writing', () => {
  it('saves drafts, submits, computes statistics and reports AI as not configured', async () => {
    const u = await registerUser();
    const tasks = await call(u, 'GET', '/api/writing/tasks?variant=general');
    expect(tasks.json.aiConfigured).toBe(false);
    const task = tasks.json.tasks.find((t: { taskNumber: number; locked: boolean }) => t.taskNumber === 2 && !t.locked);
    const sub = await call(u, 'POST', '/api/writing/submissions', { taskId: task.id });
    expect(sub.status).toBe(201);
    const text = 'Nowadays many people shop online. However, this trend has consequences for local shops.\n\nFirstly, online shopping is convenient because people can buy goods at any time. Moreover, prices are often lower. In conclusion, I believe it is mostly positive, although towns should support local businesses.';
    const save = await call(u, 'PUT', `/api/writing/submissions/${sub.json.submission.id}`, { text });
    expect(save.json.wordCount).toBeGreaterThan(40);
    const again = await call(u, 'POST', '/api/writing/submissions', { taskId: task.id });
    expect(again.json.submission.id).toBe(sub.json.submission.id); // resumes the draft
    const res = await call(u, 'POST', `/api/writing/submissions/${sub.json.submission.id}/submit`, {});
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('not_configured');
    expect(res.json.stats.paragraphs).toBe(2);
    expect(res.json.stats.linkersUsed).toEqual(expect.arrayContaining(['however', 'moreover', 'in conclusion']));
    expect(res.json.stats.underLength).toBe(true);
    const view = await call(u, 'GET', `/api/writing/submissions/${sub.json.submission.id}`);
    expect(view.json.submission.status).toBe('submitted');
    expect(view.json.submission.bandEstimate).toBeNull();
    expect((await call(u, 'PUT', `/api/writing/submissions/${sub.json.submission.id}`, { text: 'edit' })).status).toBe(404);
  });
});

describe('mock tests', () => {
  it('runs sections in order with saved answers and produces results', async () => {
    const u = await registerUser();
    const list = await call(u, 'GET', '/api/mock-tests');
    const test = list.json.tests.find((t: { slug: string }) => t.slug === 'mock-general-1');
    const start = await call(u, 'POST', `/api/mock-tests/${test.id}/start`);
    expect(start.status).toBe(200);
    const id = start.json.attemptId;
    let view = await call(u, 'GET', `/api/mock-attempts/${id}`);
    expect(view.json.section.module).toBe('listening');
    await call(u, 'PUT', `/api/mock-attempts/${id}/answers`, { section: 0, answers: { '1': '18', '2': '850' } });
    await call(u, 'POST', `/api/mock-attempts/${id}/submit-section`, { section: 0 });
    view = await call(u, 'GET', `/api/mock-attempts/${id}`);
    expect(view.json.section.module).toBe('reading');
    await call(u, 'POST', `/api/mock-attempts/${id}/submit-section`, { section: 1, answers: { '1': 'FALSE' } });
    view = await call(u, 'GET', `/api/mock-attempts/${id}`);
    expect(view.json.section.module).toBe('writing');
    const slugs = view.json.section.tasks.map((t: { slug: string }) => t.slug);
    await call(u, 'POST', `/api/mock-attempts/${id}/submit-section`, { section: 2, answers: { [slugs[0]]: 'Dear neighbour, I am writing to let you know about a party next Saturday evening at my flat. It will finish by eleven.' } });
    await call(u, 'POST', `/api/mock-attempts/${id}/submit-section`, { section: 3 });
    view = await call(u, 'GET', `/api/mock-attempts/${id}`);
    expect(view.json.attempt.status).toBe('completed');
    const listening = view.json.results.sections[0];
    expect(listening.score).toBe(2);
    expect(view.json.results.bands.listening).not.toBeNull();
    expect(view.json.results.overall).toBeNull(); // writing/speaking need AI evaluation
    // Free plan: one mock test per day
    const second = await call(u, 'POST', `/api/mock-tests/${test.id}/start`);
    expect(second.status).toBe(429);
  });
});

describe('dashboard and data isolation', () => {
  it('shows real stats for active users and empty states for new users', async () => {
    const fresh = await registerUser();
    const d0 = await call(fresh, 'GET', '/api/dashboard');
    expect(d0.json.streak.current).toBe(0);
    expect(d0.json.totals.lessonsCompleted).toBe(0);
    expect(d0.json.recommendations[0].id).toBe('assessment');

    const u = await registerUser();
    await onboard(u);
    const lesson = await call(u, 'GET', '/api/lessons/articles');
    const key = await db.select().from(schema.exercises).where(eq(schema.exercises.lessonId, lesson.json.lesson.id));
    await call(u, 'POST', '/api/lessons/articles/submit', { answers: Object.fromEntries(key.map((e) => [e.id, e.answers[0]])) });
    const d = await call(u, 'GET', '/api/dashboard');
    expect(d.json.totals.lessonsCompleted).toBe(1);
    expect(d.json.streak.current).toBe(1);
    expect(d.json.today.xp).toBeGreaterThan(0);
    expect(d.json.recent[0].title).toContain('Articles');
    const ach = await call(u, 'GET', '/api/achievements');
    expect(ach.json.achievements.find((a: { code: string }) => a.code === 'first_lesson').earnedAt).toBeTruthy();
  });

  it('does not let one user read or modify another user’s records', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const saved = await call(a, 'POST', '/api/vocab/my', { word: 'private', definition: 'secret', source: 'manual' });
    expect((await call(b, 'DELETE', `/api/vocab/my/${saved.json.word.id}`)).status).toBe(404);
    expect((await call(b, 'PATCH', `/api/vocab/my/${saved.json.word.id}`, { definition: 'changed' })).status).toBe(404);
    const tasks = await call(a, 'GET', '/api/writing/tasks');
    const sub = await call(a, 'POST', '/api/writing/submissions', { taskId: tasks.json.tasks.find((t: { locked: boolean }) => !t.locked).id });
    expect((await call(b, 'GET', `/api/writing/submissions/${sub.json.submission.id}`)).status).toBe(404);
    expect((await call(b, 'PUT', `/api/writing/submissions/${sub.json.submission.id}`, { text: 'x' })).status).toBe(404);
    const myB = await call(b, 'GET', '/api/vocab/my');
    expect(myB.json.words).toHaveLength(0);
  });
});
