import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { asUser, correctIndex, createUser, expectError, onboard, pool, rpc, runAssessment, sql } from './helpers.mjs';

describe('quizzes, saved vocabulary, spaced repetition and dashboard', () => {
  let u; let other;

  before(async () => {
    u = await createUser('learner');
    await onboard(u, 'learner_u');
    await runAssessment(u, (q) => q.difficulty <= 3);
    other = await createUser('other');
    await onboard(other, 'other_u');
  });
  after(() => pool.end());

  it('runs a quiz end-to-end with server-side checking and XP', async () => {
    const quiz = await rpc(u, 'start_quiz', { p_kind: 'practice', p_count: 10 });
    assert.equal(quiz.total, 10);
    assert.equal(quiz.questions.length, 10);
    for (const q of quiz.questions) assert.equal(q.correct_index, undefined);
    // One question per word.
    const ids = quiz.questions.map((q) => q.id);
    const entries = await sql('select entry_id from public.questions where id = any($1) and entry_id is not null', [ids]);
    assert.equal(new Set(entries.map((e) => e.entry_id)).size, entries.length);

    let correct = 0;
    for (let i = 0; i < quiz.questions.length; i++) {
      const ci = await correctIndex(quiz.questions[i].id);
      const pick = i < 7 ? ci : (ci + 1) % quiz.questions[i].options.length;
      const res = await rpc(u, 'answer_quiz_question', { p_attempt_id: quiz.attempt_id, p_index: i, p_selected: pick });
      assert.equal(res.is_correct, i < 7);
      assert.equal(res.correct_index, ci);
      if (res.is_correct) correct++;
    }
    // Retrying an answered question cannot change the result.
    const retry = await rpc(u, 'answer_quiz_question', { p_attempt_id: quiz.attempt_id, p_index: 9, p_selected: await correctIndex(quiz.questions[9].id) });
    assert.equal(retry.is_correct, false);

    const done = await rpc(u, 'finish_quiz', { p_attempt_id: quiz.attempt_id });
    assert.equal(done.correct, 7);
    assert.equal(done.xp, 7 * 10 + 10);
    assert.equal(done.missed.length, 3);
    assert.ok(done.streak >= 1);
    // Finishing twice never awards twice.
    const again = await rpc(u, 'finish_quiz', { p_attempt_id: quiz.attempt_id });
    assert.equal(again.xp, done.xp);
    const [da] = await asUser(u, 'select quizzes, xp from public.daily_activity');
    assert.equal(da.quizzes, 1);
  });

  it('gives much less XP for re-answering recently mastered questions', async () => {
    const quiz = await rpc(u, 'start_quiz', { p_kind: 'practice', p_count: 3 });
    for (let i = 0; i < 3; i++) {
      await rpc(u, 'answer_quiz_question', { p_attempt_id: quiz.attempt_id, p_index: i, p_selected: await correctIndex(quiz.questions[i].id) });
    }
    const first = await rpc(u, 'finish_quiz', { p_attempt_id: quiz.attempt_id });
    // Force the same questions into a new attempt to simulate repetition.
    const [att] = await sql(`insert into public.quiz_attempts (user_id, kind, question_ids, total)
                             select user_id, kind, question_ids, total from public.quiz_attempts where id = $1 returning id`, [quiz.attempt_id]);
    for (let i = 0; i < 3; i++) {
      await rpc(u, 'answer_quiz_question', { p_attempt_id: att.id, p_index: i, p_selected: await correctIndex(quiz.questions[i].id) });
    }
    const second = await rpc(u, 'finish_quiz', { p_attempt_id: att.id });
    assert.equal(first.xp, 3 * 10 + 10);
    assert.equal(second.xp, 3 * 2 + 10);
  });

  it('prevents another user from answering or reading my quiz', async () => {
    const quiz = await rpc(u, 'start_quiz', { p_kind: 'practice', p_count: 3 });
    await expectError(rpc(other, 'answer_quiz_question', { p_attempt_id: quiz.attempt_id, p_index: 0, p_selected: 0 }), /Quiz not found/);
    const rows = await asUser(other, 'select * from public.quiz_attempts where id = $1', [quiz.attempt_id]);
    assert.equal(rows.length, 0);
  });

  it('filters quizzes by topic and by question type', async () => {
    const t = await rpc(u, 'start_quiz', { p_kind: 'topic', p_topic_id: 'phrasal_verbs', p_count: 10 });
    assert.ok(t.questions.every((q) => q.topic_id === 'phrasal_verbs'));
    const s = await rpc(u, 'start_quiz', { p_kind: 'practice', p_types: ['synonym'], p_count: 5 });
    assert.ok(s.questions.every((q) => q.type === 'synonym'));
    const g = await rpc(u, 'start_quiz', { p_kind: 'practice', p_types: ['grammar'], p_count: 5 });
    assert.ok(g.questions.every((q) => q.type === 'grammar' && q.skill === 'grammar'));
  });

  it('saves words idempotently and keeps collections private', async () => {
    const [entry] = await asUser(u, `select id from public.vocabulary_entries where word = 'meticulous'`);
    const saved = await rpc(u, 'save_word', { p_entry_id: entry.id });
    const dup = await rpc(u, 'save_word', { p_entry_id: entry.id });
    assert.equal(saved.id, dup.id);
    const custom = await rpc(u, 'save_custom_word', { p_word: 'serendipity', p_definition: 'a happy accident', p_source: 'manual' });
    assert.equal(custom.word, 'serendipity');
    const mine = await asUser(u, 'select word from public.user_vocabulary order by word');
    assert.deepEqual(mine.map((r) => r.word), ['meticulous', 'serendipity']);
    const theirs = await asUser(other, 'select * from public.user_vocabulary');
    assert.equal(theirs.length, 0);
    // Clients cannot write SRS state directly.
    await expectError(asUser(u, `update public.user_vocabulary set status = 'mastered'`), /permission denied/);
    // Delete is allowed for own rows.
    await asUser(u, 'delete from public.user_vocabulary where id = $1', [custom.id]);
  });

  it('enforces the plan collection limit from central config', async () => {
    await sql(`update public.app_config set value = jsonb_set(value, '{free,vocab_collection_max}', '1') where key = 'plans'`);
    const [e] = await asUser(u, `select id from public.vocabulary_entries where word = 'abundant'`);
    await expectError(rpc(u, 'save_word', { p_entry_id: e.id }), /collection is full/);
    await sql(`update public.app_config set value = jsonb_set(value, '{free,vocab_collection_max}', '300') where key = 'plans'`);
  });

  it('schedules reviews with spaced repetition', async () => {
    const queue = await rpc(u, 'get_review_queue', { p_limit: 10 });
    assert.equal(queue.length, 1);
    const id = queue[0].id;
    const r1 = await rpc(u, 'review_word', { p_id: id, p_grade: 'good' });
    assert.equal(r1.word.repetitions, 1);
    assert.equal(r1.word.interval_days, 1);
    assert.equal(r1.word.status, 'reviewing');
    assert.ok(r1.xp > 0);
    // A double tap within seconds is ignored.
    const dbl = await rpc(u, 'review_word', { p_id: id, p_grade: 'easy' });
    assert.equal(dbl.xp, 0);
    assert.equal(dbl.word.repetitions, 1);
    await sql(`update public.user_vocabulary set last_reviewed_at = now() - interval '2 days', due_at = now() where id = $1`, [id]);
    const r2 = await rpc(u, 'review_word', { p_id: id, p_grade: 'good' });
    assert.equal(r2.word.interval_days, 6);
    await sql(`update public.user_vocabulary set last_reviewed_at = now() - interval '7 days', due_at = now() where id = $1`, [id]);
    const r3 = await rpc(u, 'review_word', { p_id: id, p_grade: 'again' });
    assert.equal(r3.word.repetitions, 0);
    assert.equal(r3.word.lapses, 1);
    assert.equal((await rpc(u, 'get_review_queue', {})).length, 0, 'lapsed card is due again in 10 minutes, not now');
    await expectError(rpc(other, 'review_word', { p_id: id, p_grade: 'good' }), /Word not found/);
  });

  it('builds a personalised dashboard', async () => {
    const d = await rpc(u, 'get_dashboard');
    assert.equal(d.profile.username, 'learner_u');
    assert.equal(d.proficiency.status, 'provisional');
    assert.ok(['B1', 'B2'].includes(d.proficiency.level));
    assert.ok(d.xp > 0);
    assert.equal(d.streak.current, 1);
    assert.equal(d.streak.active_today, true);
    assert.ok(d.today.xp > 0);
    assert.ok(d.recent_quizzes.length >= 2);
    assert.equal(d.vocabulary.saved, 1);
    assert.ok(Array.isArray(d.recommendations) && d.recommendations.length > 0);
    assert.equal(d.plan, 'free');
    const topics = await rpc(u, 'get_vocab_topics');
    assert.equal(topics.length, 12);
    assert.ok(topics.every((t) => t.word_count > 0));
    const ach = await rpc(u, 'get_my_achievements');
    assert.ok(ach.find((a) => a.code === 'level_unlocked').earned_at);
    assert.equal(ach.find((a) => a.code === 'first_victory').earned_at, null);
  });

  it('recommends practice for a weak area', async () => {
    const w = await createUser('weakspot');
    await onboard(w, 'weakspot_u');
    await runAssessment(w, (q) => q.type !== 'antonym');
    const quiz = await rpc(w, 'start_quiz', { p_kind: 'practice', p_types: ['antonym'], p_count: 6 });
    for (let i = 0; i < quiz.total; i++) {
      const ci = await correctIndex(quiz.questions[i].id);
      await rpc(w, 'answer_quiz_question', { p_attempt_id: quiz.attempt_id, p_index: i, p_selected: (ci + 1) % 4 });
    }
    await rpc(w, 'finish_quiz', { p_attempt_id: quiz.attempt_id });
    const d = await rpc(w, 'get_dashboard');
    assert.ok(d.recommendations.some((r) => r.kind === 'quiz' && JSON.stringify(r.types ?? []).includes('antonym')),
      JSON.stringify(d.recommendations));
  });

  it('streaks continue on consecutive days and reset after a gap', async () => {
    const s = await createUser('streaky');
    await onboard(s, 'streaky_u');
    await runAssessment(s, () => true);
    await sql(`update public.user_progress set current_streak = 6, longest_streak = 6, last_active_date = (now() at time zone 'Asia/Dhaka')::date - 1 where user_id = $1`, [s]);
    const quiz = await rpc(s, 'start_quiz', { p_count: 3 });
    await rpc(s, 'answer_quiz_question', { p_attempt_id: quiz.attempt_id, p_index: 0, p_selected: 0 });
    await rpc(s, 'finish_quiz', { p_attempt_id: quiz.attempt_id });
    const [p] = await asUser(s, 'select current_streak, longest_streak from public.user_progress');
    assert.equal(p.current_streak, 7);
    const ach = await asUser(s, `select 1 from public.user_achievements where achievement_code = 'seven_day_streak'`);
    assert.equal(ach.length, 1);
    await sql(`update public.user_progress set last_active_date = (now() at time zone 'Asia/Dhaka')::date - 3 where user_id = $1`, [s]);
    const d = await rpc(s, 'get_dashboard');
    assert.equal(d.streak.current, 0);
    assert.equal(d.streak.longest, 7);
  });
});
