import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '../config';
import { db, schema } from '../db';
import { badRequest, HttpError, notFound } from '../lib/errors';
import { parse, uuidParam } from '../lib/validate';
import { requireUser } from '../plugins/auth';
import { speakingChallenges } from '../seed/content/speaking';
import { logActivity, userTimezone } from '../services/activity';
import { aiConfigured, evaluateSpeaking } from '../services/ai';
import { consume, refund } from '../services/entitlements';
import { deleteFile, readMultipart, storeFile } from '../services/media';
import { notify } from '../services/notifications';
import { speakingMetrics } from '../services/textstats';

let levelWordCache: Set<string> | null = null;
async function levelWords() {
  if (!levelWordCache) {
    const rows = await db.select({ w: schema.words.word }).from(schema.words).where(inArray(schema.words.cefrLevel, ['B2', 'C1', 'C2']));
    levelWordCache = new Set(rows.map((r) => r.w.toLowerCase()).filter((w) => !w.includes(' ')));
  }
  return levelWordCache;
}

export const CHALLENGE_RULES =
  'Score out of 100: up to 50 points for reaching the word goal (proportional), 10 points for each target word you use (max 30), and up to 20 points for vocabulary variety (unique words ÷ total words, from 0.3 = 0 points to 0.6+ = 20 points).';

export function scoreChallenge(transcript: string, minWords: number, targetWords: string[], wordCount: number, diversity: number) {
  const words = transcript.toLowerCase().match(/[a-z]+(?:['’-][a-z]+)*/g) ?? [];
  const used = targetWords.filter((t) => {
    const stem = t.toLowerCase().replace(/(e|y)$/, '');
    return words.some((w) => w === t.toLowerCase() || (w.startsWith(stem) && w.length - stem.length <= 4));
  });
  const goal = Math.round(Math.min(wordCount / minWords, 1) * 50);
  const targets = used.length * 10;
  const variety = Math.round(Math.max(0, Math.min(1, (diversity - 0.3) / 0.3)) * 20);
  return { score: Math.min(100, goal + targets + variety), breakdown: { goal, targets, variety }, targetWordsUsed: used };
}

const fieldsSchema = z.object({
  mode: z.enum(['ielts', 'challenge', 'mock']),
  promptId: z.string().uuid().optional(),
  mockAttemptId: z.string().uuid().optional(),
  challengeIndex: z.coerce.number().int().min(0).max(1000).optional(),
  question: z.string().trim().min(1).max(1000),
  transcript: z.string().max(10000).default(''),
  transcriptSource: z.enum(['browser', 'device', 'manual', 'none']).default('none'),
  durationSec: z.coerce.number().min(0).max(1800),
});

export async function speakingRoutes(app: FastifyInstance) {
  app.get('/api/speaking/prompts', async (req) => {
    requireUser(req);
    const q = parse(z.object({ part: z.coerce.number().int().min(1).max(3).optional() }), req.query);
    const rows = await db
      .select()
      .from(schema.speakingPrompts)
      .where(and(eq(schema.speakingPrompts.status, 'published'), q.part ? eq(schema.speakingPrompts.part, q.part) : undefined))
      .orderBy(asc(schema.speakingPrompts.part), asc(schema.speakingPrompts.createdAt));
    return { prompts: rows, aiConfigured: aiConfigured() };
  });

  app.get('/api/speaking/prompts/:id', async (req) => {
    requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const [p] = await db.select().from(schema.speakingPrompts).where(and(eq(schema.speakingPrompts.id, id), eq(schema.speakingPrompts.status, 'published')));
    if (!p) throw notFound('Speaking prompt not found.');
    return { prompt: p, aiConfigured: aiConfigured() };
  });

  app.get('/api/speaking/challenge', async (req) => {
    requireUser(req);
    const q = parse(z.object({ exclude: z.coerce.number().int().optional() }), req.query);
    let i = Math.floor(Math.random() * speakingChallenges.length);
    if (q.exclude === i) i = (i + 1) % speakingChallenges.length;
    return { index: i, ...speakingChallenges[i], rules: CHALLENGE_RULES };
  });

  app.post('/api/speaking/attempts', { config: { rateLimit: { max: config.rateLimitEnabled ? 30 : 100_000, timeWindow: '1 minute' } } }, async (req, reply) => {
    const u = requireUser(req);
    const { fields, file } = await readMultipart(req, 10 * 1024 * 1024);
    const f = parse(fieldsSchema, fields);
    if (!file && f.mode !== 'challenge') throw badRequest('Please record an answer before submitting.');
    let prompt: typeof schema.speakingPrompts.$inferSelect | undefined;
    if (f.promptId) {
      [prompt] = await db.select().from(schema.speakingPrompts).where(eq(schema.speakingPrompts.id, f.promptId));
      if (!prompt) throw notFound('Speaking prompt not found.');
    }
    if (f.mockAttemptId) {
      const [m] = await db.select().from(schema.mockAttempts).where(and(eq(schema.mockAttempts.id, f.mockAttemptId), eq(schema.mockAttempts.userId, u.id)));
      if (!m || m.status !== 'in_progress') throw badRequest('Mock test is not in progress.');
    }
    const challenge = f.mode === 'challenge' ? speakingChallenges[f.challengeIndex ?? -1] : undefined;
    if (f.mode === 'challenge' && !challenge) throw badRequest('Unknown challenge.');
    if (f.mode === 'challenge' && !f.transcript.trim()) throw badRequest('No speech was recognised, so this challenge cannot be scored. Try again in a quieter place or type what you said.');

    const media = file ? await storeFile(u.id, 'speaking', file, 'audio/') : null;
    const metrics = speakingMetrics(f.transcript, f.durationSec, await levelWords());
    let score: number | null = null;
    let challengeResult: ReturnType<typeof scoreChallenge> | null = null;
    if (challenge) {
      challengeResult = scoreChallenge(f.transcript, challenge.minWords, challenge.targetWords, metrics.wordCount, metrics.lexicalDiversity);
      score = challengeResult.score;
    }
    const [attempt] = await db
      .insert(schema.speakingAttempts)
      .values({
        userId: u.id,
        promptId: prompt?.id ?? null,
        mockAttemptId: f.mockAttemptId ?? null,
        mode: f.mode === 'mock' ? 'ielts' : f.mode,
        title: challenge ? `Speaking challenge: ${challenge.prompt}` : prompt ? `Part ${prompt.part}: ${prompt.topic}` : 'Speaking practice',
        question: f.question,
        audioFileId: media?.id ?? null,
        durationSec: f.durationSec,
        transcript: f.transcript,
        transcriptSource: f.transcript ? f.transcriptSource : 'none',
        metrics: { ...metrics, challenge: challengeResult },
        score,
      })
      .returning();

    const r = await logActivity(u.id, {
      type: challenge ? 'speaking_challenge' : 'ielts_speaking',
      title: challenge ? `Speaking challenge scored ${score}/100` : `IELTS speaking: ${attempt.title}`,
      refId: attempt.id,
      xp: challenge ? 10 + Math.round((score ?? 0) / 5) : 20,
      minutes: Math.max(0.5, f.durationSec / 60),
    });

    // AI feedback (background) when configured, allowed and there is enough speech to evaluate.
    let aiStatus = 'not_configured';
    if (aiConfigured() && f.mode !== 'challenge') {
      if (metrics.wordCount < 15) aiStatus = 'too_short';
      else {
        const tz = await userTimezone(u.id);
        try {
          await consume(u.id, 'ai_speaking_feedback', tz);
          aiStatus = 'evaluating';
          void runSpeakingEvaluation(u.id, attempt.id, prompt?.part ?? null, tz);
        } catch (err) {
          if (err instanceof HttpError && err.code === 'limit_reached') aiStatus = 'limit_reached';
          else throw err;
        }
      }
    }
    await db.update(schema.speakingAttempts).set({ feedback: { aiStatus } }).where(eq(schema.speakingAttempts.id, attempt.id));
    reply.code(201);
    return { attempt: { ...attempt, feedback: { aiStatus } }, newAchievements: r.newAchievements, rules: challenge ? CHALLENGE_RULES : undefined };
  });

  app.get('/api/speaking/attempts', async (req) => {
    const u = requireUser(req);
    const q = parse(z.object({ mode: z.enum(['ielts', 'challenge']).optional() }), req.query);
    const rows = await db
      .select()
      .from(schema.speakingAttempts)
      .where(and(eq(schema.speakingAttempts.userId, u.id), q.mode ? eq(schema.speakingAttempts.mode, q.mode) : undefined))
      .orderBy(desc(schema.speakingAttempts.createdAt))
      .limit(100);
    return { attempts: rows };
  });

  app.get('/api/speaking/attempts/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const [a] = await db.select().from(schema.speakingAttempts).where(and(eq(schema.speakingAttempts.id, id), eq(schema.speakingAttempts.userId, u.id)));
    if (!a) throw notFound('Recording not found.');
    return { attempt: a };
  });

  app.delete('/api/speaking/attempts/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const [a] = await db.select().from(schema.speakingAttempts).where(and(eq(schema.speakingAttempts.id, id), eq(schema.speakingAttempts.userId, u.id)));
    if (!a) throw notFound('Recording not found.');
    await db.delete(schema.speakingAttempts).where(eq(schema.speakingAttempts.id, id));
    await deleteFile(a.audioFileId);
    return { ok: true };
  });
}

async function runSpeakingEvaluation(userId: string, attemptId: string, part: number | null, tz: string) {
  try {
    const [a] = await db.select().from(schema.speakingAttempts).where(eq(schema.speakingAttempts.id, attemptId));
    const m = a.metrics as { wordsPerMinute: number; fillerCount: number };
    const ai = await evaluateSpeaking({ part, question: a.question, transcript: a.transcript, durationSec: a.durationSec, wordsPerMinute: m.wordsPerMinute, fillerCount: m.fillerCount });
    await db.update(schema.speakingAttempts).set({ feedback: { aiStatus: 'done', ai }, score: Math.round(ai.overallBand * 10), feedbackError: null }).where(eq(schema.speakingAttempts.id, attemptId));
    await notify(userId, { type: 'feedback', title: 'Your speaking feedback is ready', body: `${a.title}: estimated band ${ai.overallBand} (unofficial).`, link: `/ielts/speaking/attempts/${attemptId}` });
  } catch (err) {
    await refund(userId, 'ai_speaking_feedback', tz);
    await db
      .update(schema.speakingAttempts)
      .set({ feedback: { aiStatus: 'failed' }, feedbackError: err instanceof HttpError ? err.message : 'Evaluation failed unexpectedly.' })
      .where(eq(schema.speakingAttempts.id, attemptId));
  }
}
