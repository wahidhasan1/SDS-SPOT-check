import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  asUser, correctIndex, createUser, expectError, onboard, pool, rpc, runAssessment, sleep, sql, useFastBattleConfig,
} from './helpers.mjs';

let n = 0;
async function player(name) {
  n += 1;
  const id = await createUser(`${name}${n}`);
  await onboard(id, `${name}${n}`);
  await runAssessment(id, (q) => q.difficulty <= 3);
  return id;
}

describe('concurrency, administration and account deletion', () => {
  before(() => useFastBattleConfig());
  after(() => pool.end());

  it('pairs many simultaneous players without double-booking anyone', async () => {
    const players = await Promise.all(Array.from({ length: 10 }, (_, i) => player(`crowd${i}`)));
    const battleOf = new Map();
    for (let round = 0; round < 15 && battleOf.size < players.length; round++) {
      const results = await Promise.all(players.filter((p) => !battleOf.has(p))
        .map((p) => rpc(p, 'join_matchmaking', { p_mode: 'vocab_duel' }).then((r) => [p, r])));
      for (const [p, r] of results) if (r.status !== 'waiting') battleOf.set(p, r.battle_id);
      await sleep(50);
    }
    // Everyone ends up in exactly one battle with exactly one opponent.
    const rows = await sql(`select bp.user_id, bp.battle_id from public.battle_participants bp
                             join public.battles b on b.id = bp.battle_id
                            where bp.user_id = any($1) and b.status = 'pending'`, [players]);
    assert.equal(rows.length, players.length);
    assert.equal(new Set(rows.map((r) => r.user_id)).size, players.length);
    const perBattle = new Map();
    for (const r of rows) perBattle.set(r.battle_id, (perBattle.get(r.battle_id) ?? 0) + 1);
    assert.ok([...perBattle.values()].every((c) => c === 2));
    for (const p of players) assert.equal(battleOf.get(p), rows.find((r) => r.user_id === p).battle_id);
    await Promise.all(players.map((p) => rpc(p, 'forfeit_battle', { p_battle_id: battleOf.get(p) })));
  });

  it('handles both players answering at the same instant', async () => {
    const a = await player('sim');
    const b = await player('simb');
    await rpc(a, 'join_matchmaking', { p_mode: 'vocab_duel' });
    const { battle_id: id } = await rpc(b, 'join_matchmaking', { p_mode: 'vocab_duel' });
    await Promise.all([rpc(a, 'set_battle_ready', { p_battle_id: id }), rpc(b, 'set_battle_ready', { p_battle_id: id })]);
    let s;
    do { await sleep(60); s = await rpc(a, 'get_battle_state', { p_battle_id: id }); } while (!s.question);
    const ci = await correctIndex(s.question.id);
    const [ra, rb] = await Promise.all([
      rpc(a, 'submit_battle_answer', { p_battle_id: id, p_index: 0, p_selected: ci }),
      rpc(b, 'submit_battle_answer', { p_battle_id: id, p_index: 0, p_selected: ci }),
    ]);
    assert.equal(ra.submission.accepted, true);
    assert.equal(rb.submission.accepted, true);
    const after = await rpc(a, 'get_battle_state', { p_battle_id: id });
    assert.equal(after.reveal.idx, 0, 'question closes as soon as both have answered');
    assert.ok(after.me.score > 0 && after.opponent.score > 0);
    // Spamming the same answer concurrently records it once.
    const spam = await Promise.all(Array.from({ length: 5 }, () => rpc(a, 'submit_battle_answer', { p_battle_id: id, p_index: 0, p_selected: ci })));
    assert.ok(spam.every((r) => !r.submission.accepted));
    const [{ c }] = await sql('select count(*)::int c from public.battle_answers where battle_id = $1 and idx = 0', [id]);
    assert.equal(c, 2);
    await rpc(a, 'forfeit_battle', { p_battle_id: id });
  });

  it('rate-limits matchmaking requests', async () => {
    const a = await player('spammy');
    await sql(`update public.app_config set value = '{"matchmaking": {"max": 3, "window_seconds": 60}}'::jsonb || (value - 'matchmaking') where key = 'rate_limits'`);
    for (let i = 0; i < 3; i++) await rpc(a, 'join_matchmaking', { p_mode: 'vocab_duel' });
    await expectError(rpc(a, 'join_matchmaking', { p_mode: 'vocab_duel' }), /Too many requests/);
    await sql(`update public.app_config set value = '{"matchmaking": {"max": 90, "window_seconds": 60}}'::jsonb || (value - 'matchmaking') where key = 'rate_limits'`);
    await sql('delete from public.rate_limits where user_id = $1', [a]);
    await rpc(a, 'cancel_matchmaking');
  });

  it('restricts admin RPCs to granted roles and audits every change', async () => {
    const admin = await createUser('admin');
    const mod = await createUser('mod');
    const user = await player('plain');
    await sql(`insert into public.user_roles (user_id, role) values ($1, 'admin'), ($2, 'moderator')`, [admin, mod]);

    await expectError(rpc(user, 'admin_get_overview'), /Insufficient privileges/);
    await expectError(rpc(user, 'admin_set_config', { p_key: 'plans', p_value: {} }), /Insufficient privileges/);
    await expectError(rpc(mod, 'admin_set_config', { p_key: 'plans', p_value: {} }), /Insufficient privileges/);

    const overview = await rpc(mod, 'admin_get_overview');
    assert.ok(overview.users_total > 0);
    assert.ok(overview.battles_today > 0);
    const reports = await rpc(mod, 'admin_list_reports', { p_status: null });
    assert.ok(Array.isArray(reports));
    const issues = await rpc(mod, 'admin_list_battle_issues', {});
    assert.ok(Array.isArray(issues.flags));

    await expectError(rpc(admin, 'admin_set_config', { p_key: 'plans', p_value: JSON.stringify([]) }), /wrong shape/);
    const [plans] = await sql(`select value from public.app_config where key = 'plans'`);
    plans.value.free.battles_per_day = 12;
    await rpc(admin, 'admin_set_config', { p_key: 'plans', p_value: plans.value });
    const lobby = await rpc(user, 'get_battle_lobby');
    assert.equal(lobby.battles_limit, 12, 'quota change applies without app changes');

    await expectError(rpc(mod, 'admin_suspend_user', { p_user_id: user, p_until: null, p_reason: 'x' }), /reason is required/);
    await rpc(mod, 'admin_suspend_user', { p_user_id: user, p_until: null, p_reason: 'Repeated cheating reports' });
    await expectError(rpc(user, 'join_matchmaking', { p_mode: 'vocab_duel' }), /suspended/);
    await rpc(mod, 'admin_unsuspend_user', { p_user_id: user, p_reason: 'Appeal accepted' });

    const log = await rpc(admin, 'admin_get_audit_log', {});
    const actions = log.map((l) => l.action);
    assert.ok(actions.includes('config.set'));
    assert.ok(actions.includes('user.suspend'));
    assert.ok(actions.includes('user.unsuspend'));
    assert.equal(JSON.stringify(log).includes('@example.test'), false, 'no emails in admin output');
    await expectError(rpc(mod, 'admin_get_audit_log', {}), /Insufficient privileges/);
    assert.deepEqual(await rpc(admin, 'get_my_roles'), ['admin']);
  });

  it('lets content editors manage the question bank (audited)', async () => {
    const editor = await createUser('editor');
    await sql(`insert into public.user_roles (user_id, role) values ($1, 'content_editor')`, [editor]);
    const qid = await rpc(editor, 'admin_upsert_question', { p_question: {
      type: 'grammar', skill: 'grammar', prompt: 'Choose the correct option.', sentence: 'He ____ here yesterday.',
      options: ['was', 'is', 'be', 'were'], correct_index: 0, explanation: 'Past simple of be.', difficulty: 2,
      grammar_topic: 'past simple', use_in_assessment: false,
    } });
    assert.ok(qid);
    const [row] = await sql('select correct_index from public.questions where id = $1', [qid]);
    assert.equal(row.correct_index, 0);
    const [audit] = await sql(`select action from public.admin_audit_logs where target_id = $1`, [qid]);
    assert.equal(audit.action, 'content.question.upsert');
  });

  it('deletes an account with all private data while keeping opponents\' history', async () => {
    const a = await player('leaver');
    const b = await player('stayer');
    await rpc(a, 'join_matchmaking', { p_mode: 'vocab_duel' });
    const { battle_id: id } = await rpc(b, 'join_matchmaking', { p_mode: 'vocab_duel' });
    await rpc(a, 'set_battle_ready', { p_battle_id: id });
    await rpc(b, 'set_battle_ready', { p_battle_id: id });
    await rpc(a, 'forfeit_battle', { p_battle_id: id });
    const [entry] = await asUser(a, `select id from public.vocabulary_entries limit 1`);
    await rpc(a, 'save_word', { p_entry_id: entry.id });

    await rpc(a, 'delete_my_account');
    const left = await sql(`select
        (select count(*) from auth.users where id = $1)::int as users,
        (select count(*) from public.profiles where id = $1)::int as profiles,
        (select count(*) from public.user_vocabulary where user_id = $1)::int as vocab,
        (select count(*) from public.assessments where user_id = $1)::int as assessments,
        (select count(*) from public.battle_results where user_id = $1)::int as results`, [a]);
    assert.deepEqual(left[0], { users: 0, profiles: 0, vocab: 0, assessments: 0, results: 0 });
    const hist = await rpc(b, 'get_battle_history', {});
    assert.equal(hist.length, 1);
    assert.equal(hist[0].result, 'win');
    assert.ok(hist[0].opponent_alias);
  });
});
