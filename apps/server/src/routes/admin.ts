import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CEFR_LEVELS, CONVERSATION_TOPICS } from '@app/shared';
import { config } from '../config';
import { one, q, tx } from '../db/pool';
import { requireAdmin } from '../lib/auth';
import { badRequest, notFound } from '../lib/errors';
import { parse } from '../lib/validate';
import { allConnectedUserIds } from '../realtime/hub';
import { endCall } from '../realtime/calls';
import { aiGenerateVocabulary } from '../services/ai';
import { DEFAULT_PLAN_LIMITS } from '../services/entitlements';
import { notify } from '../services/notifications';

async function audit(req: FastifyRequest, action: string, targetType: string | null, targetId: string | null, details: object = {}) {
  await q('INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5)', [
    req.userId, action, targetType, targetId, details,
  ]);
}

const nullableInt = z.number().int().min(0).nullable();
const planLimitsSchema = z.object({
  callsPerDay: nullableInt, maxCallMinutes: z.number().int().min(1).max(240), premiumTopics: z.boolean(), ieltsSpeakingMode: z.boolean(),
  matchingPreferences: z.boolean(), priorityMatching: z.boolean(), aiWritingFeedbackPerDay: nullableInt, aiReadingScansPerDay: nullableInt,
  wordLookupsPerDay: nullableInt, translationsPerDay: nullableInt, mockTestsPerMonth: nullableInt, speakingAnalysesPerDay: nullableInt,
  rankedBattlesPerDay: nullableInt, advancedReports: z.boolean(),
});

const vocabSchema = z.object({
  word: z.string().trim().min(1).max(60),
  ipa: z.string().max(80).nullable().optional(),
  partOfSpeech: z.string().min(1).max(30),
  meaning: z.string().min(1).max(600),
  examples: z.array(z.string().max(300)).max(6).default([]),
  synonyms: z.array(z.string().max(60)).max(12).default([]),
  antonyms: z.array(z.string().max(60)).max(12).default([]),
  cefr: z.enum(CEFR_LEVELS),
  tags: z.array(z.string().max(30)).max(8).default([]),
  usageNote: z.string().max(400).nullable().optional(),
  status: z.enum(['published', 'draft']).default('published'),
});

/** Validates that every question in an IELTS set has an answer key entry and vice versa. */
function validateSet(content: any, answerKey: any) {
  if (!content || !Array.isArray(content.groups)) throw badRequest('content.groups must be an array.');
  const ids = new Set<string>();
  for (const g of content.groups) {
    if (!g.type || !Array.isArray(g.questions)) throw badRequest(`Group ${g.id ?? '?'} needs a type and questions.`);
    for (const qq of g.questions) {
      if (!qq.id) throw badRequest('Every question needs an id.');
      if (ids.has(qq.id)) throw badRequest(`Duplicate question id ${qq.id}.`);
      ids.add(qq.id);
      if (!answerKey?.[qq.id]?.accepted?.length) throw badRequest(`Question ${qq.id} has no accepted answers.`);
    }
  }
  for (const k of Object.keys(answerKey ?? {})) if (!ids.has(k)) throw badRequest(`Answer key ${k} does not match any question.`);
  return ids.size;
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);

  app.get('/admin/stats', async () => {
    const s = await one<any>(`SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM users WHERE created_at > now() - interval '7 days') AS new_users_7d,
      (SELECT count(*)::int FROM call_sessions WHERE created_at > now() - interval '1 day') AS calls_24h,
      (SELECT count(*)::int FROM call_sessions WHERE connected_at IS NOT NULL AND created_at > now() - interval '7 days') AS connected_calls_7d,
      (SELECT count(*)::int FROM call_sessions WHERE connected_at IS NULL AND status='failed' AND created_at > now() - interval '7 days') AS failed_calls_7d,
      (SELECT COALESCE(round(avg(duration_sec)),0)::int FROM call_sessions WHERE connected_at IS NOT NULL AND created_at > now() - interval '7 days') AS avg_call_sec_7d,
      (SELECT count(*)::int FROM call_sessions WHERE status IN ('matched','connected')) AS active_calls,
      (SELECT count(*)::int FROM match_queue) AS queued,
      (SELECT count(*)::int FROM user_reports WHERE status='open') AS open_reports,
      (SELECT count(*)::int FROM subscriptions WHERE status IN ('active','trialing') AND plan_id='premium') AS premium_subscribers,
      (SELECT count(*)::int FROM practice_attempts WHERE started_at > now() - interval '7 days') AS practice_attempts_7d,
      (SELECT count(*)::int FROM writing_submissions WHERE submitted_at > now() - interval '7 days') AS writing_7d,
      (SELECT count(*)::int FROM battle_sessions WHERE created_at > now() - interval '7 days') AS battles_7d,
      (SELECT count(DISTINCT user_id)::int FROM activity_log WHERE created_at > now() - interval '7 days') AS active_learners_7d`);
    return { ...s, online_now_this_instance: allConnectedUserIds().length };
  });

  // ----- Moderation -----
  app.get('/admin/reports', async (req) => {
    const { status } = parse(z.object({ status: z.enum(['open', 'actioned', 'dismissed']).default('open') }), req.query);
    return q(
      `SELECT r.*, ru.email AS reporter_email, tu.email AS reported_email, tu.anon_name AS reported_anon, tu.suspended_until,
         (SELECT count(*)::int FROM user_reports x WHERE x.reported_id=r.reported_id) AS reports_against_total
       FROM user_reports r LEFT JOIN users ru ON ru.id=r.reporter_id LEFT JOIN users tu ON tu.id=r.reported_id
       WHERE r.status=$1 ORDER BY r.created_at DESC LIMIT 200`,
      [status],
    );
  });

  app.post('/admin/reports/:id/resolve', async (req) => {
    const { id } = req.params as { id: string };
    const input = parse(
      z.object({ status: z.enum(['actioned', 'dismissed']), note: z.string().max(1000).optional(), action: z.enum(['none', 'warn', 'suspend_24h', 'suspend_7d', 'ban']).default('none') }),
      req.body,
    );
    const r = await one<any>('SELECT * FROM user_reports WHERE id=$1', [id]);
    if (!r) throw notFound('Report not found.');
    await q('UPDATE user_reports SET status=$2, resolution_note=$3, resolved_by=$4, resolved_at=now() WHERE id=$1', [id, input.status, input.note ?? null, req.userId]);
    if (r.reported_id && input.action !== 'none') await applyAction(req, r.reported_id, input.action, input.note);
    await audit(req, 'resolve_report', 'report', id, input);
    return { ok: true };
  });

  async function applyAction(req: FastifyRequest, userId: string, action: string, reason?: string) {
    if (action === 'warn') {
      await notify({ userId, kind: 'moderation', title: 'Community guidelines warning', body: reason || 'A report about your behaviour was upheld. Please follow the community guidelines.', push: true });
    } else {
      const hours = action === 'suspend_24h' ? 24 : action === 'suspend_7d' ? 168 : 24 * 365 * 100;
      await q(`UPDATE users SET suspended_until=now() + make_interval(hours => $2), suspension_reason=$3 WHERE id=$1`, [userId, hours, reason ?? action]);
      const active = await one<{ call_id: string }>('SELECT call_id FROM user_active_calls WHERE user_id=$1', [userId]);
      if (active) await endCall(active.call_id, 'moderation', null);
      await q('DELETE FROM match_queue WHERE user_id=$1', [userId]);
    }
    await audit(req, `user_${action}`, 'user', userId, { reason });
  }

  app.get('/admin/users', async (req) => {
    const { q: search } = parse(z.object({ q: z.string().max(100).default('') }), req.query);
    return q(
      `SELECT u.id, u.email, u.display_name, u.anon_name, u.role, u.created_at, u.suspended_until, p.cefr_level, p.battle_rating,
         (SELECT count(*)::int FROM user_reports r WHERE r.reported_id=u.id) AS reports_against,
         (SELECT plan_id FROM subscriptions s WHERE s.user_id=u.id AND s.status IN ('active','trialing') ORDER BY updated_at DESC LIMIT 1) AS plan
       FROM users u JOIN user_profiles p ON p.user_id=u.id
       WHERE $1 = '' OR lower(u.email) LIKE '%' || lower($1) || '%' OR lower(u.anon_name) LIKE '%' || lower($1) || '%' OR u.id::text = $1
       ORDER BY u.created_at DESC LIMIT 100`,
      [search],
    );
  });

  app.post('/admin/users/:id/action', async (req) => {
    const { id } = req.params as { id: string };
    const input = parse(
      z.object({
        action: z.enum(['warn', 'suspend_24h', 'suspend_7d', 'ban', 'unsuspend', 'make_admin', 'remove_admin', 'grant_premium', 'revoke_premium']),
        reason: z.string().max(500).optional(),
        days: z.number().int().min(1).max(3650).optional(),
      }),
      req.body,
    );
    const u = await one('SELECT id FROM users WHERE id=$1', [id]);
    if (!u) throw notFound('User not found.');
    switch (input.action) {
      case 'unsuspend':
        await q('UPDATE users SET suspended_until=NULL, suspension_reason=NULL WHERE id=$1', [id]);
        break;
      case 'make_admin':
      case 'remove_admin':
        if (id === req.userId) throw badRequest('You cannot change your own role.');
        await q('UPDATE users SET role=$2 WHERE id=$1', [id, input.action === 'make_admin' ? 'admin' : 'user']);
        break;
      case 'grant_premium':
        await q(
          `INSERT INTO subscriptions (user_id, plan_id, provider, provider_ref, status, current_period_end) VALUES ($1,'premium','admin_grant',$2,'active', now() + make_interval(days => $3))`,
          [id, `grant-${randomUUID()}`, input.days ?? 30],
        );
        break;
      case 'revoke_premium':
        await q(`UPDATE subscriptions SET status='canceled', updated_at=now() WHERE user_id=$1 AND provider='admin_grant' AND status='active'`, [id]);
        break;
      default:
        return applyAction(req, id, input.action, input.reason).then(() => ({ ok: true }));
    }
    await audit(req, input.action, 'user', id, input);
    return { ok: true };
  });

  // ----- Plans & limits -----
  app.get('/admin/plans', async () => q('SELECT * FROM plans ORDER BY id'));
  app.put('/admin/plans/:id', async (req) => {
    const { id } = req.params as { id: string };
    if (id !== 'free' && id !== 'premium') throw notFound('Unknown plan.');
    const input = parse(z.object({ limits: planLimitsSchema, name: z.string().min(1).max(40).optional(), priceDisplay: z.string().max(60).optional() }), req.body);
    await q('UPDATE plans SET limits=$2, name=COALESCE($3,name), price_display=COALESCE($4,price_display), updated_at=now() WHERE id=$1', [
      id, input.limits, input.name ?? null, input.priceDisplay ?? null,
    ]);
    await audit(req, 'update_plan', 'plan', id, input);
    return one('SELECT * FROM plans WHERE id=$1', [id]);
  });
  app.post('/admin/plans/:id/reset', async (req) => {
    const { id } = req.params as { id: 'free' | 'premium' };
    if (!DEFAULT_PLAN_LIMITS[id]) throw notFound('Unknown plan.');
    await q('UPDATE plans SET limits=$2 WHERE id=$1', [id, DEFAULT_PLAN_LIMITS[id]]);
    await audit(req, 'reset_plan', 'plan', id);
    return { ok: true };
  });

  // ----- Conversation topics (prompts override) -----
  app.get('/admin/topics', async () => {
    const row = await one<any>(`SELECT value FROM app_config WHERE key='topic_prompts'`);
    const overrides = row?.value ?? {};
    return CONVERSATION_TOPICS.filter((t) => t.mode !== 'ielts_speaking').map((t) => ({ id: t.id, label: t.label, prompts: overrides[t.id] ?? t.prompts, overridden: !!overrides[t.id] }));
  });
  app.put('/admin/topics/:id', async (req) => {
    const { id } = req.params as { id: string };
    if (!CONVERSATION_TOPICS.some((t) => t.id === id)) throw notFound('Unknown topic.');
    const { prompts } = parse(z.object({ prompts: z.array(z.string().trim().min(3).max(300)).min(1).max(30) }), req.body);
    await q(
      `INSERT INTO app_config (key, value) VALUES ('topic_prompts', jsonb_build_object($1::text, $2::jsonb))
       ON CONFLICT (key) DO UPDATE SET value = app_config.value || jsonb_build_object($1::text, $2::jsonb), updated_at=now()`,
      [id, JSON.stringify(prompts)],
    );
    await audit(req, 'update_topic_prompts', 'topic', id, { count: prompts.length });
    return { ok: true };
  });

  // ----- Vocabulary -----
  app.get('/admin/vocabulary', async (req) => {
    const { q: s, offset } = parse(z.object({ q: z.string().max(60).default(''), offset: z.coerce.number().int().min(0).default(0) }), req.query);
    return q(`SELECT * FROM vocabulary WHERE $1='' OR lower(word) LIKE lower($1)||'%' ORDER BY word LIMIT 50 OFFSET $2`, [s, offset]);
  });
  app.post('/admin/vocabulary', async (req) => {
    const v = parse(vocabSchema, req.body);
    const row = await one(
      `INSERT INTO vocabulary (word, ipa, part_of_speech, meaning, examples, synonyms, antonyms, cefr, tags, usage_note, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [v.word, v.ipa ?? null, v.partOfSpeech, v.meaning, v.examples, v.synonyms, v.antonyms, v.cefr, v.tags, v.usageNote ?? null, v.status],
    ).catch((e) => {
      if (e.code === '23505') throw badRequest('This word with this part of speech already exists.');
      throw e;
    });
    await audit(req, 'create_vocabulary', 'vocabulary', (row as any).id, { word: v.word });
    return row;
  });
  app.put('/admin/vocabulary/:id', async (req) => {
    const { id } = req.params as { id: string };
    const v = parse(vocabSchema, req.body);
    const row = await one(
      `UPDATE vocabulary SET word=$2, ipa=$3, part_of_speech=$4, meaning=$5, examples=$6, synonyms=$7, antonyms=$8, cefr=$9, tags=$10, usage_note=$11, status=$12
       WHERE id=$1 RETURNING *`,
      [id, v.word, v.ipa ?? null, v.partOfSpeech, v.meaning, v.examples, v.synonyms, v.antonyms, v.cefr, v.tags, v.usageNote ?? null, v.status],
    );
    if (!row) throw notFound('Word not found.');
    await audit(req, 'update_vocabulary', 'vocabulary', id, { word: v.word });
    return row;
  });
  app.delete('/admin/vocabulary/:id', async (req) => {
    const { id } = req.params as { id: string };
    await q('DELETE FROM vocabulary WHERE id=$1', [id]);
    await audit(req, 'delete_vocabulary', 'vocabulary', id);
    return { ok: true };
  });

  // ----- Grammar -----
  app.get('/admin/grammar', async () =>
    q(`SELECT l.*, (SELECT json_agg(e ORDER BY e.order_index) FROM grammar_exercises e WHERE e.lesson_id=l.id) AS exercises FROM grammar_lessons l ORDER BY l.order_index`),
  );
  app.put('/admin/grammar/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const input = parse(
      z.object({
        title: z.string().min(3).max(120), cefr: z.enum(CEFR_LEVELS), topic: z.string().min(2).max(60), summary: z.string().min(3).max(300),
        body: z.string().min(10).max(20000), status: z.enum(['published', 'draft']).default('published'),
        exercises: z.array(z.object({ kind: z.enum(['mcq', 'gap']), prompt: z.string().min(3).max(500), options: z.array(z.string().max(200)).max(6).nullable().optional(), answers: z.array(z.string().max(200)).min(1).max(6), explanation: z.string().min(3).max(800) })).min(1).max(30),
      }),
      req.body,
    );
    for (const e of input.exercises) {
      if (e.kind === 'mcq' && (!e.options || !e.options.includes(e.answers[0]))) throw badRequest(`MCQ "${e.prompt.slice(0, 40)}" must include its correct answer in the options.`);
    }
    await tx(async (c) => {
      const l = await one<any>(
        `INSERT INTO grammar_lessons (slug, title, cefr, topic, summary, body, status) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, cefr=EXCLUDED.cefr, topic=EXCLUDED.topic, summary=EXCLUDED.summary, body=EXCLUDED.body, status=EXCLUDED.status RETURNING id`,
        [slug, input.title, input.cefr, input.topic, input.summary, input.body, input.status],
        c,
      );
      await c.query('DELETE FROM grammar_exercises WHERE lesson_id=$1', [l!.id]);
      let i = 0;
      for (const e of input.exercises) {
        await c.query('INSERT INTO grammar_exercises (lesson_id, kind, prompt, options, answers, explanation, order_index) VALUES ($1,$2,$3,$4,$5,$6,$7)', [
          l!.id, e.kind, e.prompt, e.options ? JSON.stringify(e.options) : null, e.answers, e.explanation, i++,
        ]);
      }
    });
    await audit(req, 'upsert_grammar', 'grammar_lesson', slug, { exercises: input.exercises.length });
    return { ok: true };
  });

  // ----- IELTS content -----
  app.get('/admin/ielts/sets', async () => q('SELECT id, slug, skill, test_type, title, question_count, is_premium, status FROM ielts_sets ORDER BY skill, slug'));
  app.get('/admin/ielts/sets/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const s = await one('SELECT * FROM ielts_sets WHERE slug=$1', [slug]);
    if (!s) throw notFound('Set not found.');
    return s;
  });
  app.put('/admin/ielts/sets/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const input = parse(
      z.object({
        skill: z.enum(['reading', 'listening']), testType: z.enum(['academic', 'general', 'both']), title: z.string().min(3).max(200),
        description: z.string().max(400).nullable().optional(), difficulty: z.string().max(40).nullable().optional(),
        timeLimitSec: z.number().int().min(60).max(7200), content: z.any(), answerKey: z.any(), isPremium: z.boolean().default(false),
        status: z.enum(['published', 'draft']).default('published'),
      }),
      req.body,
    );
    const count = validateSet(input.content, input.answerKey);
    if (input.skill === 'listening' && !input.content.audio) throw badRequest('Listening sets need content.audio (upload audio via the media endpoint).');
    await q(
      `INSERT INTO ielts_sets (slug, skill, test_type, title, description, difficulty, time_limit_sec, content, answer_key, question_count, is_premium, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (slug) DO UPDATE SET skill=EXCLUDED.skill, test_type=EXCLUDED.test_type, title=EXCLUDED.title, description=EXCLUDED.description,
         difficulty=EXCLUDED.difficulty, time_limit_sec=EXCLUDED.time_limit_sec, content=EXCLUDED.content, answer_key=EXCLUDED.answer_key,
         question_count=EXCLUDED.question_count, is_premium=EXCLUDED.is_premium, status=EXCLUDED.status`,
      [slug, input.skill, input.testType, input.title, input.description ?? null, input.difficulty ?? null, input.timeLimitSec, input.content, input.answerKey, count, input.isPremium, input.status],
    );
    await audit(req, 'upsert_ielts_set', 'ielts_set', slug, { questions: count });
    return { ok: true, questionCount: count };
  });

  app.get('/admin/writing-prompts', async () => q('SELECT * FROM writing_prompts ORDER BY task, slug'));
  app.put('/admin/writing-prompts/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const p = parse(
      z.object({
        testType: z.enum(['academic', 'general', 'both']), task: z.union([z.literal(1), z.literal(2)]), kind: z.string().min(2).max(40),
        title: z.string().min(3).max(200), prompt: z.string().min(10).max(3000), instructions: z.string().min(5).max(1000), visual: z.any().optional(),
        minWords: z.number().int().min(50).max(500), timeLimitSec: z.number().int().min(300).max(7200), isPremium: z.boolean().default(false),
        status: z.enum(['published', 'draft']).default('published'),
      }),
      req.body,
    );
    await q(
      `INSERT INTO writing_prompts (slug, test_type, task, kind, title, prompt, instructions, visual, min_words, time_limit_sec, is_premium, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (slug) DO UPDATE SET test_type=EXCLUDED.test_type, task=EXCLUDED.task, kind=EXCLUDED.kind, title=EXCLUDED.title, prompt=EXCLUDED.prompt,
         instructions=EXCLUDED.instructions, visual=EXCLUDED.visual, min_words=EXCLUDED.min_words, time_limit_sec=EXCLUDED.time_limit_sec,
         is_premium=EXCLUDED.is_premium, status=EXCLUDED.status`,
      [slug, p.testType, p.task, p.kind, p.title, p.prompt, p.instructions, p.visual ?? null, p.minWords, p.timeLimitSec, p.isPremium, p.status],
    );
    await audit(req, 'upsert_writing_prompt', 'writing_prompt', slug);
    return { ok: true };
  });

  app.get('/admin/speaking-prompts', async () => q('SELECT * FROM speaking_prompts ORDER BY part, slug'));
  app.put('/admin/speaking-prompts/:slug', async (req) => {
    const { slug } = req.params as { slug: string };
    const p = parse(
      z.object({
        part: z.union([z.literal(1), z.literal(2), z.literal(3)]), topic: z.string().min(2).max(80), text: z.string().min(3).max(500),
        bullets: z.array(z.string().max(200)).max(6).default([]), questions: z.array(z.string().max(300)).max(10).default([]),
        groupKey: z.string().max(40).nullable().optional(), status: z.enum(['published', 'draft']).default('published'),
      }),
      req.body,
    );
    await q(
      `INSERT INTO speaking_prompts (slug, part, topic, text, bullets, questions, group_key, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (slug) DO UPDATE SET part=EXCLUDED.part, topic=EXCLUDED.topic, text=EXCLUDED.text, bullets=EXCLUDED.bullets, questions=EXCLUDED.questions,
         group_key=EXCLUDED.group_key, status=EXCLUDED.status`,
      [slug, p.part, p.topic, p.text, p.bullets, p.questions, p.groupKey ?? null, p.status],
    );
    await audit(req, 'upsert_speaking_prompt', 'speaking_prompt', slug);
    return { ok: true };
  });

  // ----- Media (audio resources) -----
  app.get('/admin/media', async () => {
    const out: { path: string; size: number }[] = [];
    for (const dir of ['listening', 'assessment', 'uploads']) {
      try {
        for (const f of await readdir(join(config.mediaDir, dir))) {
          const st = await stat(join(config.mediaDir, dir, f));
          out.push({ path: `/media/${dir}/${f}`, size: st.size });
        }
      } catch {
        /* folder may not exist */
      }
    }
    return out;
  });
  app.post('/admin/media', async (req) => {
    const file = await (req as any).file();
    if (!file) throw badRequest('Choose an audio file.');
    if (!['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm'].includes(file.mimetype)) {
      throw badRequest('Upload an MP3, M4A, AAC, OGG, WAV or WEBM audio file.');
    }
    const ext = (file.filename.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    const name = `${randomUUID()}.${ext}`;
    await mkdir(join(config.mediaDir, 'uploads'), { recursive: true });
    await writeFile(join(config.mediaDir, 'uploads', name), await file.toBuffer());
    await audit(req, 'upload_media', 'media', name, { original: file.filename });
    return { path: `/media/uploads/${name}` };
  });

  // ----- AI-generated content review queue -----
  app.get('/admin/review-queue', async () => q(`SELECT * FROM content_review_queue WHERE status='pending' ORDER BY created_at DESC LIMIT 200`));
  app.post('/admin/review-queue/generate', async (req) => {
    const input = parse(z.object({ topic: z.string().min(2).max(80), level: z.enum(CEFR_LEVELS), count: z.number().int().min(1).max(15).default(8) }), req.body);
    const r = await aiGenerateVocabulary(input.topic, input.level, input.count);
    for (const item of r.items) {
      await q(`INSERT INTO content_review_queue (kind, payload, source, created_by) VALUES ('vocabulary',$1,'ai',$2)`, [{ ...item, topic: input.topic }, req.userId]);
    }
    await audit(req, 'generate_vocabulary', 'review_queue', null, input);
    return { created: r.items.length };
  });
  app.post('/admin/review-queue/:id/:decision', async (req) => {
    const { id, decision } = req.params as { id: string; decision: string };
    if (decision !== 'approve' && decision !== 'reject') throw badRequest('Decision must be approve or reject.');
    const item = await one<any>(`SELECT * FROM content_review_queue WHERE id=$1 AND status='pending'`, [id]);
    if (!item) throw notFound('Item not found or already reviewed.');
    if (decision === 'approve' && item.kind === 'vocabulary') {
      const p = item.payload;
      await q(
        `INSERT INTO vocabulary (word, part_of_speech, meaning, examples, synonyms, antonyms, cefr, tags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (lower(word), part_of_speech) DO NOTHING`,
        [p.word, p.partOfSpeech, p.meaning, p.examples ?? [], p.synonyms ?? [], p.antonyms ?? [], p.cefr, ['reviewed', String(p.topic ?? '').toLowerCase()].filter(Boolean)],
      );
    }
    await q('UPDATE content_review_queue SET status=$2, reviewed_by=$3, reviewed_at=now() WHERE id=$1', [id, decision === 'approve' ? 'approved' : 'rejected', req.userId]);
    await audit(req, `review_${decision}`, 'review_queue', id);
    return { ok: true };
  });

  app.get('/admin/audit', async () =>
    q(`SELECT a.*, u.email AS admin_email FROM admin_audit_log a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.created_at DESC LIMIT 200`),
  );
}
