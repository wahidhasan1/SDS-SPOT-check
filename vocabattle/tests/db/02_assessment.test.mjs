import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { asUser, correctIndex, createUser, expectError, onboard, pool, rpc, runAssessment, sql } from './helpers.mjs';

describe('adaptive proficiency assessment', () => {
  after(() => pool.end());

  it('requires a completed profile first', async () => {
    const u = await createUser('early');
    await expectError(rpc(u, 'start_assessment'), /Complete your profile/);
  });

  it('serves questions without answers and adapts difficulty', async () => {
    const u = await createUser('adaptive');
    await onboard(u, 'adaptive_u');
    const first = await rpc(u, 'start_assessment');
    assert.equal(first.finished, false);
    assert.equal(first.index, 0);
    assert.equal(first.total, 15);
    assert.equal(first.question.correct_index, undefined);
    assert.equal(first.question.difficulty, 3);
    // Resuming returns the same question (no re-rolling for an easier one).
    const again = await rpc(u, 'start_assessment');
    assert.equal(again.question.id, first.question.id);
    // A correct answer raises the next question's difficulty.
    const next = await rpc(u, 'submit_assessment_answer', {
      p_assessment_id: first.assessment_id, p_question_id: first.question.id, p_selected: await correctIndex(first.question.id),
    });
    assert.equal(next.index, 1);
    assert.equal(next.question.difficulty, 4);
    // A duplicate/stale submission for the old question changes nothing.
    const dup = await rpc(u, 'submit_assessment_answer', {
      p_assessment_id: first.assessment_id, p_question_id: first.question.id, p_selected: 0,
    });
    assert.equal(dup.index, 1);
    assert.equal(dup.question.id, next.question.id);
  });

  it('places a strong learner high and a weak learner low', async () => {
    const strong = await createUser('strong');
    await onboard(strong, 'strong_u');
    const rs = await runAssessment(strong, () => true);
    assert.ok(['C1', 'C2'].includes(rs.level), `strong learner got ${rs.level}`);
    assert.equal(rs.score, 100);
    assert.match(rs.disclaimer, /not an official IELTS score/);

    const weak = await createUser('weak');
    await onboard(weak, 'weak_u');
    const rw = await runAssessment(weak, () => false);
    assert.equal(rw.level, 'A1');
    assert.ok(rw.weaknesses.length >= 1);
    assert.ok(rw.recommendations.length >= 2);

    const mid = await createUser('mid');
    await onboard(mid, 'mid_u');
    // Knows everything up to B1, nothing above.
    const rm = await runAssessment(mid, (q) => q.difficulty <= 3);
    assert.ok(['B1', 'B2'].includes(rm.level), `mid learner got ${rm.level}`);

    const [p] = await asUser(strong, 'select proficiency_level, proficiency_status from public.user_progress');
    assert.equal(p.proficiency_status, 'provisional');
    assert.equal(p.proficiency_level, rs.level);
    const [prof] = await asUser(strong, 'select onboarding_step from public.profiles');
    assert.equal(prof.onboarding_step, 'done');
    const hist = await asUser(strong, 'select * from public.proficiency_history');
    assert.equal(hist.length, 1);
    assert.equal(hist[0].source, 'initial_assessment');
    const ach = await asUser(strong, `select achievement_code from public.user_achievements`);
    assert.ok(ach.some((a) => a.achievement_code === 'level_unlocked'));
  });

  it('never repeats a word within one assessment', async () => {
    const u = await createUser('norepeat');
    await onboard(u, 'norepeat_u');
    await runAssessment(u, (_, i) => i % 2 === 0);
    const rows = await sql(`select entry_id from public.assessment_responses where user_id = $1 and entry_id is not null`, [u]);
    assert.equal(new Set(rows.map((r) => r.entry_id)).size, rows.length);
  });

  it('enforces the retake cooldown and limits level jumps on retakes', async () => {
    const u = await createUser('retake');
    await onboard(u, 'retake_u');
    const r1 = await runAssessment(u, () => false);
    assert.equal(r1.level, 'A1');
    await expectError(rpc(u, 'start_assessment'), /retake the assessment after/);
    const status = await rpc(u, 'get_assessment_status');
    assert.equal(status.can_start, false);
    // Simulate the cooldown passing.
    await sql(`update public.assessments set completed_at = now() - interval '8 days' where user_id = $1`, [u]);
    const r2 = await runAssessment(u, () => true);
    assert.equal(r2.kind, 'retake');
    assert.ok(['C1', 'C2'].includes(r2.estimated_level));
    assert.equal(r2.level, 'A2', 'a retake moves at most one level');
  });
});
