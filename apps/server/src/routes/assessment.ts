import type { FastifyInstance } from 'fastify';
import { assessmentAnswerSchema, CEFR_LEVELS, thetaToCefr, updateTheta } from '@app/shared';
import { one, q, tx } from '../db/pool';
import { requireAuth } from '../lib/auth';
import { badRequest, conflict, notFound } from '../lib/errors';
import { parse } from '../lib/validate';
import { recordActivity } from '../services/activity';

// Sequence of skills for a 20-item adaptive placement test.
const PLAN = ['vocabulary', 'grammar', 'vocabulary', 'grammar', 'reading', 'listening', 'vocabulary', 'grammar', 'reading', 'listening',
  'vocabulary', 'grammar', 'reading', 'listening', 'vocabulary', 'grammar', 'reading', 'listening', 'vocabulary', 'grammar'] as const;

function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function pickItem(assessmentId: string, skill: string, theta: number) {
  const items = await q<any>(
    `SELECT * FROM assessment_items i WHERE active AND skill=$1
       AND NOT EXISTS (SELECT 1 FROM assessment_responses r WHERE r.assessment_id=$2 AND r.item_id=i.id)
     ORDER BY abs(difficulty - $3), random() LIMIT 3`,
    [skill, assessmentId, theta],
  );
  // Pick randomly among the closest few so retakes differ.
  return items.length ? items[Math.floor(Math.random() * Math.min(2, items.length))] : null;
}

function publicItem(item: any, index: number) {
  return {
    id: item.id,
    skill: item.skill,
    prompt: item.prompt,
    passage: item.passage,
    audioUrl: item.audio_url,
    options: shuffle(item.options as string[]),
    index,
    total: PLAN.length,
  };
}

async function finish(c: any, a: any, userId: string) {
  const resp = await q<any>(
    `SELECT r.correct, i.skill, i.difficulty FROM assessment_responses r JOIN assessment_items i ON i.id=r.item_id WHERE r.assessment_id=$1`,
    [a.id],
    c,
  );
  const skills: Record<string, { correct: number; total: number; theta: number; level: string }> = {};
  const skillTheta = a.skill_theta ?? {};
  for (const r of resp) {
    const s = (skills[r.skill] ??= { correct: 0, total: 0, theta: 0, level: '' });
    s.total++;
    if (r.correct) s.correct++;
  }
  for (const [k, s] of Object.entries(skills)) {
    s.theta = Number(skillTheta[k] ?? a.theta);
    s.level = thetaToCefr(s.theta);
  }
  const level = thetaToCefr(Number(a.theta));
  await c.query(`UPDATE assessments SET status='completed', completed_at=now(), result_level=$2, skill_results=$3, current_item_id=NULL WHERE id=$1`, [a.id, level, skills]);
  await c.query(`UPDATE user_profiles SET cefr_level=$2, level_assessed_at=now() WHERE user_id=$1`, [userId, level]);
  await c.query(
    `INSERT INTO proficiency_history (user_id, level, theta, skill_levels, source, assessment_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, level, a.theta, Object.fromEntries(Object.entries(skills).map(([k, s]) => [k, s.level])), a.kind, a.id],
  );
  return { level, theta: Number(a.theta), skills, answered: resp.length, correct: resp.filter((r) => r.correct).length };
}

export async function assessmentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.post('/assessment/start', async (req) => {
    const prior = await one('SELECT 1 FROM assessments WHERE user_id=$1 AND status=$2', [req.userId, 'completed']);
    const kind = prior ? 'reassessment' : 'placement';
    await q(`UPDATE assessments SET status='abandoned' WHERE user_id=$1 AND status='in_progress'`, [req.userId]);
    const a = await one<any>(`INSERT INTO assessments (user_id, kind) VALUES ($1,$2) RETURNING *`, [req.userId, kind]);
    const item = await pickItem(a.id, PLAN[0], 3.0);
    if (!item) throw notFound('The assessment item bank is empty. An administrator needs to add content.');
    await q('UPDATE assessments SET current_item_id=$2 WHERE id=$1', [a.id, item.id]);
    return { assessmentId: a.id, kind, item: publicItem(item, 0) };
  });

  app.get('/assessment/current', async (req) => {
    const a = await one<any>(`SELECT * FROM assessments WHERE user_id=$1 AND status='in_progress' ORDER BY started_at DESC LIMIT 1`, [req.userId]);
    if (!a || !a.current_item_id) return { assessment: null };
    const item = await one<any>('SELECT * FROM assessment_items WHERE id=$1', [a.current_item_id]);
    return { assessment: { assessmentId: a.id, kind: a.kind, item: publicItem(item, a.answered) } };
  });

  app.post('/assessment/:id/answer', async (req) => {
    const { id } = req.params as { id: string };
    const { itemId, answer } = parse(assessmentAnswerSchema, req.body);
    return tx(async (c) => {
      const a = await one<any>(`SELECT * FROM assessments WHERE id=$1 AND user_id=$2 FOR UPDATE`, [id, req.userId], c);
      if (!a) throw notFound('Assessment not found.');
      if (a.status !== 'in_progress') throw conflict('This assessment is already finished.');
      if (a.current_item_id !== itemId) throw badRequest('This question has already been answered.');
      const item = await one<any>('SELECT * FROM assessment_items WHERE id=$1', [itemId], c);
      const correct = answer === item.answer;
      const theta = updateTheta(Number(a.theta), Number(item.difficulty), correct, a.answered);
      const skillTheta = { ...(a.skill_theta ?? {}) };
      const prevSkill = Number(skillTheta[item.skill] ?? a.theta);
      skillTheta[item.skill] = Math.round(updateTheta(prevSkill, Number(item.difficulty), correct, 1) * 100) / 100;
      await c.query(
        `INSERT INTO assessment_responses (assessment_id, item_id, answer, correct, theta_after) VALUES ($1,$2,$3,$4,$5)`,
        [id, itemId, answer, correct, theta],
      );
      const answered = a.answered + 1;
      await c.query('UPDATE assessments SET theta=$2, answered=$3, skill_theta=$4 WHERE id=$1', [id, theta, answered, skillTheta]);
      if (answered >= PLAN.length) {
        const result = await finish(c, { ...a, theta, answered, skill_theta: skillTheta }, req.userId);
        await recordActivity(req.userId, 'assessment', id, { level: result.level }, c);
        return { done: true, result };
      }
      const next = (await pickItem(id, PLAN[answered], theta)) ?? (await pickItem(id, 'vocabulary', theta)) ?? (await pickItem(id, 'grammar', theta));
      if (!next) {
        const result = await finish(c, { ...a, theta, answered, skill_theta: skillTheta }, req.userId);
        return { done: true, result };
      }
      await c.query('UPDATE assessments SET current_item_id=$2 WHERE id=$1', [id, next.id]);
      return { done: false, item: publicItem(next, answered) };
    });
  });

  app.get('/assessment/:id/result', async (req) => {
    const { id } = req.params as { id: string };
    const a = await one<any>(`SELECT * FROM assessments WHERE id=$1 AND user_id=$2`, [id, req.userId]);
    if (!a || a.status !== 'completed') throw notFound('Result not available.');
    const review = await q<any>(
      `SELECT i.skill, i.cefr, i.prompt, r.answer, i.answer AS correct_answer, r.correct, i.explanation
       FROM assessment_responses r JOIN assessment_items i ON i.id=r.item_id WHERE r.assessment_id=$1 ORDER BY r.answered_at`,
      [id],
    );
    return { level: a.result_level, theta: a.theta, skills: a.skill_results, completedAt: a.completed_at, review };
  });

  app.get('/assessment/history', async (req) =>
    q(`SELECT level, theta, skill_levels, source, created_at FROM proficiency_history WHERE user_id=$1 ORDER BY created_at DESC`, [req.userId]),
  );

  app.get('/assessment/levels', async () => CEFR_LEVELS);
}
