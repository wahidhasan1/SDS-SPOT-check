import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import {
  asUser, correctIndex, createUser, expectError, onboard, pool, rpc, runAssessment, sleep, sql, useFastBattleConfig,
} from './helpers.mjs';

let n = 0;
async function player(name, strategy = (q) => q.difficulty <= 3) {
  n += 1;
  const id = await createUser(`${name}${n}`);
  await onboard(id, `${name}${n}`.slice(0, 20));
  await runAssessment(id, strategy);
  return id;
}

async function match(a, b, mode = 'vocab_duel') {
  const ra = await rpc(a, 'join_matchmaking', { p_mode: mode });
  assert.equal(ra.status, 'waiting');
  const rb = await rpc(b, 'join_matchmaking', { p_mode: mode });
  assert.equal(rb.status, 'matched', JSON.stringify(rb));
  const ra2 = await rpc(a, 'join_matchmaking', { p_mode: mode });
  assert.equal(ra2.status, 'in_battle');
  assert.equal(ra2.battle_id, rb.battle_id);
  return rb.battle_id;
}

// Plays until completion. decide(player, question) -> 'correct' | 'wrong' | 'skip'.
async function play(battleId, players, decide) {
  const answered = new Set();
  for (let guard = 0; guard < 400; guard++) {
    for (const p of players) {
      const s = await rpc(p, 'get_battle_state', { p_battle_id: battleId });
      if (['completed', 'void', 'cancelled'].includes(s.battle.status)) return s;
      const q = s.question;
      if (q && !q.answered && !answered.has(`${p}:${q.idx}`)) {
        const choice = decide(p, q);
        if (choice !== 'skip') {
          const ci = await correctIndex(q.id);
          const pick = choice === 'correct' ? ci : (ci + 1) % q.options.length;
          const r = await rpc(p, 'submit_battle_answer', { p_battle_id: battleId, p_index: q.idx, p_selected: pick });
          assert.equal(r.submission.accepted, true, JSON.stringify(r.submission));
        }
        answered.add(`${p}:${q.idx}`);
      }
    }
    await sleep(100);
  }
  throw new Error('battle did not finish');
}

describe('anonymous real-time battles', () => {
  before(() => useFastBattleConfig());
  beforeEach(() => sql('delete from public.matchmaking_queue'));

  it('requires a completed assessment before battling', async () => {
    const u = await createUser('fresh');
    await onboard(u, 'fresh_u');
    await expectError(rpc(u, 'join_matchmaking', { p_mode: 'vocab_duel' }), /assessment before battling/);
  });

  it('rejects disabled or unknown modes', async () => {
    const u = await player('modes');
    await expectError(rpc(u, 'join_matchmaking', { p_mode: 'ielts' }), /not available/);
    await expectError(rpc(u, 'join_matchmaking', { p_mode: 'nope' }), /not available/);
  });

  it('plays a full Vocabulary Duel with server-authoritative scoring and ratings', async () => {
    const a = await player('alpha');
    const b = await player('bravo');
    const id = await match(a, b);

    // Pending: both see each other's pseudonyms, not account identities.
    const pa = await rpc(a, 'get_battle_state', { p_battle_id: id });
    assert.equal(pa.battle.status, 'pending');
    assert.match(pa.opponent.alias, /^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
    assert.equal(pa.opponent.user_id, undefined);
    assert.equal(JSON.stringify(pa).includes(b), false, 'opponent account id never leaks');

    // Cannot answer before the battle starts.
    const early = await rpc(a, 'submit_battle_answer', { p_battle_id: id, p_index: 0, p_selected: 0 });
    assert.equal(early.submission.accepted, false);
    assert.equal(early.submission.reason, 'not_active');

    await rpc(a, 'set_battle_ready', { p_battle_id: id });
    const afterReady = await rpc(b, 'set_battle_ready', { p_battle_id: id });
    assert.equal(afterReady.battle.status, 'active');
    assert.equal(afterReady.question, null, 'question hidden during the start countdown');

    // A strangers' realtime row is invisible; a participant can read it.
    const visible = await asUser(a, 'select id, version from public.battles where id = $1', [id]);
    assert.equal(visible.length, 1);
    const outsider = await createUser('outsider');
    assert.equal((await asUser(outsider, 'select id from public.battles where id = $1', [id])).length, 0);
    await expectError(rpc(outsider, 'get_battle_state', { p_battle_id: id }), /Battle not found/);

    let dupChecked = false;
    const final = await play(id, [a, b], (p, q) => {
      if (!dupChecked && p === a) dupChecked = q.idx;
      return p === a ? 'correct' : 'wrong';
    });
    assert.equal(final.battle.status, 'completed');

    const sa = await rpc(a, 'get_battle_state', { p_battle_id: id });
    const sb = await rpc(b, 'get_battle_state', { p_battle_id: id });
    assert.equal(sa.result.my_result, 'win');
    assert.equal(sb.result.my_result, 'loss');
    assert.equal(sa.me.correct, 3);
    assert.equal(sb.me.correct, 0);
    assert.ok(sa.me.score >= 300 && sa.me.score <= 450, `score ${sa.me.score}`);
    assert.equal(sb.me.score, 0);
    assert.ok(sa.result.rating_delta > 0);
    assert.equal(sa.result.rating_delta, -sb.result.rating_delta, 'equal provisional K: zero-sum');
    assert.ok(sa.result.xp > 0);
    assert.equal(sa.result.questions.length, 3);
    assert.ok(sa.result.questions.every((q) => q.correct_answer && q.my_correct));

    // Duplicate answer after completion is rejected, nothing changes.
    const late = await rpc(a, 'submit_battle_answer', { p_battle_id: id, p_index: 2, p_selected: 0 });
    assert.equal(late.submission.accepted, false);

    // Rewards are granted exactly once no matter how often state is polled.
    for (let i = 0; i < 3; i++) await rpc(a, 'get_battle_state', { p_battle_id: id });
    const [ra] = await sql(`select * from public.battle_ratings where user_id = $1`, [a]);
    assert.equal(ra.games, 1);
    assert.equal(ra.wins, 1);
    assert.equal(ra.rating, 1000 + sa.result.rating_delta);
    const res = await sql('select * from public.battle_results where battle_id = $1', [id]);
    assert.equal(res.length, 2);
    const ach = await asUser(a, `select achievement_code from public.user_achievements`);
    assert.ok(ach.some((x) => x.achievement_code === 'first_victory'));
    assert.ok(ach.some((x) => x.achievement_code === 'sharp_shooter'));

    const hist = await rpc(a, 'get_battle_history', {});
    assert.equal(hist.length, 1);
    assert.equal(hist[0].result, 'win');
    assert.equal(hist[0].opponent_alias, sa.opponent.alias);
    const lobby = await rpc(a, 'get_battle_lobby');
    assert.equal(lobby.rating.games, 1);
    assert.equal(lobby.battles_remaining_today, 9);
    assert.equal(lobby.recent_opponents.length, 1);
  });

  it('rejects duplicate and late answers and measures time on the server', async () => {
    const a = await player('dup');
    const b = await player('dupb');
    const id = await match(a, b);
    await rpc(a, 'set_battle_ready', { p_battle_id: id });
    await rpc(b, 'set_battle_ready', { p_battle_id: id });
    let s;
    do { await sleep(80); s = await rpc(a, 'get_battle_state', { p_battle_id: id }); } while (!s.question);
    const ci = await correctIndex(s.question.id);
    const first = await rpc(a, 'submit_battle_answer', { p_battle_id: id, p_index: 0, p_selected: ci });
    assert.equal(first.submission.accepted, true);
    assert.equal(first.question.answered, true);
    assert.equal(first.reveal, null, 'correct answer is not revealed while the opponent can still answer');
    const second = await rpc(a, 'submit_battle_answer', { p_battle_id: id, p_index: 0, p_selected: (ci + 1) % 4 });
    assert.equal(second.submission.accepted, false);
    assert.ok(['duplicate', 'stale_question'].includes(second.submission.reason));
    const bView = await rpc(b, 'get_battle_state', { p_battle_id: id });
    assert.equal(bView.question.opponent_answered, true);
    assert.equal(bView.opponent.score, 0, 'scores only update when the question closes');
    // b waits past the deadline (+grace) and then tries to answer.
    await sleep(1900);
    const tooLate = await rpc(b, 'submit_battle_answer', { p_battle_id: id, p_index: 0, p_selected: 0 });
    assert.equal(tooLate.submission.accepted, false);
    assert.equal(tooLate.reveal.idx, 0);
    assert.equal(tooLate.reveal.correct_index, ci);
    assert.equal(tooLate.reveal.opponent_correct, true);
    const [ans] = await sql('select response_ms, points from public.battle_answers where battle_id = $1 and idx = 0', [id]);
    assert.ok(ans.response_ms >= 0 && ans.response_ms < 1500);
    assert.ok(ans.points >= 100 && ans.points <= 150);
    await rpc(a, 'forfeit_battle', { p_battle_id: id });
  });

  it('declares a draw on equal scores', async () => {
    const a = await player('drawa');
    const b = await player('drawb');
    const id = await match(a, b, 'syn_ant');
    await rpc(a, 'set_battle_ready', { p_battle_id: id });
    await rpc(b, 'set_battle_ready', { p_battle_id: id });
    const final = await play(id, [a, b], () => 'wrong');
    assert.equal(final.battle.status, 'completed');
    const sa = await rpc(a, 'get_battle_state', { p_battle_id: id });
    assert.equal(sa.result.my_result, 'draw');
    assert.equal(sa.result.rating_delta, 0);
  });

  it('awards the win to the connected player when the opponent disconnects', async () => {
    const a = await player('stay');
    const b = await player('leave');
    const id = await match(a, b, 'sentence');
    await rpc(a, 'set_battle_ready', { p_battle_id: id });
    await rpc(b, 'set_battle_ready', { p_battle_id: id });
    // b stops polling entirely; a keeps playing (and answering nothing).
    let s;
    for (let i = 0; i < 80; i++) {
      s = await rpc(a, 'get_battle_state', { p_battle_id: id });
      if (s.battle.status !== 'active') break;
      await sleep(100);
    }
    assert.equal(s.battle.status, 'completed');
    assert.equal(s.battle.end_reason, 'opponent_disconnected');
    assert.equal(s.result.my_result, 'win');
    const sb = await rpc(b, 'get_battle_state', { p_battle_id: id });
    assert.equal(sb.result.my_result, 'loss');
  });

  it('voids the match without penalties when both players lose connection', async () => {
    const a = await player('va');
    const b = await player('vb');
    const id = await match(a, b);
    await rpc(a, 'set_battle_ready', { p_battle_id: id });
    await rpc(b, 'set_battle_ready', { p_battle_id: id });
    const before = await rpc(a, 'get_battle_lobby');
    // Nobody polls for longer than the disconnect timeout (e.g. a server outage).
    await sleep(3000);
    const s = await rpc(a, 'get_battle_state', { p_battle_id: id });
    assert.equal(s.battle.status, 'void');
    assert.equal(s.battle.end_reason, 'both_disconnected');
    const afterLobby = await rpc(a, 'get_battle_lobby');
    assert.equal(afterLobby.rating.rating, before.rating.rating);
    assert.equal(afterLobby.rating.games, before.rating.games);
    assert.equal(afterLobby.battles_remaining_today, before.battles_remaining_today + 1, 'quota refunded');
  });

  it('cancels the match if a player never gets ready', async () => {
    const a = await player('ra');
    const b = await player('rb');
    const id = await match(a, b);
    await rpc(a, 'set_battle_ready', { p_battle_id: id });
    await sleep(1700);
    const s = await rpc(a, 'get_battle_state', { p_battle_id: id });
    assert.equal(s.battle.status, 'cancelled');
    assert.equal(s.battle.end_reason, 'ready_timeout');
    // a can queue again immediately.
    const again = await rpc(a, 'join_matchmaking', { p_mode: 'vocab_duel' });
    assert.equal(again.status, 'waiting');
    await rpc(a, 'cancel_matchmaking');
  });

  it('lets a player forfeit, and resumes an active battle after reconnecting', async () => {
    const a = await player('fa');
    const b = await player('fb');
    const id = await match(a, b);
    await rpc(a, 'set_battle_ready', { p_battle_id: id });
    await rpc(b, 'set_battle_ready', { p_battle_id: id });
    assert.equal(await rpc(b, 'get_active_battle'), id, 'app restart can find the live battle');
    const s = await rpc(b, 'forfeit_battle', { p_battle_id: id });
    assert.equal(s.result.my_result, 'loss');
    assert.equal(s.battle.end_reason, 'forfeit');
    assert.equal(await rpc(b, 'get_active_battle'), null);
  });

  it('never matches blocked players and supports reports', async () => {
    const a = await player('blk');
    const b = await player('blkb');
    const id = await match(a, b);
    await rpc(a, 'forfeit_battle', { p_battle_id: id });
    const blocked = await rpc(a, 'block_battle_opponent', { p_battle_id: id });
    assert.equal(blocked.blocked, true);
    const report = await rpc(a, 'report_battle_opponent', { p_battle_id: id, p_reason: 'offensive_name', p_details: 'rude alias' });
    assert.equal(report.status, 'open');
    const list = await rpc(a, 'get_blocked_users');
    assert.equal(list.length, 1);
    assert.equal(list[0].label, (await rpc(a, 'get_battle_state', { p_battle_id: id })).opponent.alias);
    assert.equal(JSON.stringify(list).includes(b), false);

    assert.equal((await rpc(a, 'join_matchmaking', { p_mode: 'vocab_duel' })).status, 'waiting');
    assert.equal((await rpc(b, 'join_matchmaking', { p_mode: 'vocab_duel' })).status, 'waiting', 'blocked pair is not matched');
    await rpc(a, 'cancel_matchmaking');
    await rpc(b, 'cancel_matchmaking');
    await rpc(a, 'unblock_user', { p_block_id: list[0].id });
    assert.equal((await rpc(a, 'get_blocked_users')).length, 0);
    // Reports are not readable by ordinary users.
    await expectError(asUser(a, 'select * from public.user_reports'), /permission denied/);
  });

  it('matches by level first and widens the window over time', async () => {
    const low = await player('low', () => false);       // A1
    const high = await player('high', () => true);      // C1/C2
    assert.equal((await rpc(low, 'join_matchmaking', { p_mode: 'vocab_duel' })).status, 'waiting');
    assert.equal((await rpc(high, 'join_matchmaking', { p_mode: 'vocab_duel' })).status, 'waiting', 'far apart: no instant match');
    // After a long wait the window widens enough to pair them.
    await sql(`update public.matchmaking_queue set enqueued_at = now() - interval '60 seconds'`);
    const r = await rpc(high, 'join_matchmaking', { p_mode: 'vocab_duel' });
    assert.equal(r.status, 'matched');
    await rpc(high, 'forfeit_battle', { p_battle_id: r.battle_id });
  });

  it('ignores players whose app stopped polling the queue', async () => {
    const a = await player('stale');
    const b = await player('staleb');
    await rpc(a, 'join_matchmaking', { p_mode: 'vocab_duel' });
    await sql(`update public.matchmaking_queue set last_poll_at = now() - interval '30 seconds' where user_id = $1`, [a]);
    assert.equal((await rpc(b, 'join_matchmaking', { p_mode: 'vocab_duel' })).status, 'waiting');
    await rpc(b, 'cancel_matchmaking');
  });

  it('applies the gender preference only for premium players', async () => {
    const f = await player('fem');
    const m = await player('male');
    const p = await player('prem');
    await sql(`update public.profiles set gender = 'female' where id = $1`, [f]);
    await sql(`update public.profiles set gender = 'male' where id = $1`, [m]);
    await sql(`update public.profiles set battle_gender_preference = 'female' where id = $1`, [p]);
    // Free plan: preference is stored but not applied.
    let r = await rpc(p, 'join_matchmaking', { p_mode: 'vocab_duel' });
    assert.equal(r.gender_preference, 'any');
    await rpc(p, 'cancel_matchmaking');
    // Premium (server-verified subscription row, as written by the billing webhook).
    await sql(`insert into public.subscriptions (user_id, status, provider, billing_period, current_period_end) values ($1, 'active', 'manual', 'monthly', now() + interval '30 days')`, [p]);
    await rpc(m, 'join_matchmaking', { p_mode: 'vocab_duel' });
    r = await rpc(p, 'join_matchmaking', { p_mode: 'vocab_duel' });
    assert.equal(r.status, 'waiting', 'male opponent is not eligible');
    assert.equal(r.gender_preference, 'female');
    await rpc(m, 'cancel_matchmaking');
    r = await rpc(f, 'join_matchmaking', { p_mode: 'vocab_duel' });
    assert.equal(r.status, 'matched');
    await rpc(f, 'forfeit_battle', { p_battle_id: r.battle_id });
    // The opponent's gender is never part of battle state.
    const s = await rpc(p, 'get_battle_state', { p_battle_id: r.battle_id });
    assert.equal(JSON.stringify(s).includes('female'), false);
    const ent = await rpc(p, 'get_my_entitlements');
    assert.equal(ent.plan, 'premium');
  });

  it('enforces the daily battle quota from central config', async () => {
    await sql(`update public.app_config set value = jsonb_set(value, '{free,battles_per_day}', '1') where key = 'plans'`);
    const a = await player('qa');
    const b = await player('qb');
    const id = await match(a, b);
    await rpc(a, 'set_battle_ready', { p_battle_id: id });
    await rpc(b, 'set_battle_ready', { p_battle_id: id });
    await rpc(a, 'forfeit_battle', { p_battle_id: id });
    await expectError(rpc(a, 'join_matchmaking', { p_mode: 'vocab_duel' }), /used all of today/);
    await sql(`update public.app_config set value = jsonb_set(value, '{free,battles_per_day}', '10') where key = 'plans'`);
  });

  it('stops rating repeated games between the same pair (anti-farming)', async () => {
    await sql(`update public.app_config set value = value || '{"rated_pair_limit_per_day": 1}'::jsonb where key = 'battle'`);
    const a = await player('farm');
    const b = await player('farmb');
    const id1 = await match(a, b);
    await rpc(a, 'set_battle_ready', { p_battle_id: id1 });
    await rpc(b, 'set_battle_ready', { p_battle_id: id1 });
    await play(id1, [a, b], (p) => (p === a ? 'correct' : 'wrong'));
    const id2 = await match(a, b);
    await rpc(a, 'set_battle_ready', { p_battle_id: id2 });
    await rpc(b, 'set_battle_ready', { p_battle_id: id2 });
    await play(id2, [a, b], (p) => (p === a ? 'correct' : 'wrong'));
    const s2 = await rpc(a, 'get_battle_state', { p_battle_id: id2 });
    assert.equal(s2.battle.rated, false);
    assert.equal(s2.result.my_result, 'win');
    assert.equal(s2.result.rating_delta, 0);
    const flags = await sql(`select kind from public.battle_integrity_flags where battle_id = $1`, [id2]);
    assert.ok(flags.some((f) => f.kind === 'pair_repeat'));
    await sql(`update public.app_config set value = value || '{"rated_pair_limit_per_day": 3}'::jsonb where key = 'battle'`);
  });

  it('serves leaderboards with privacy controls and public profiles', async () => {
    const lb = await rpc((await player('lb')), 'get_leaderboard', { p_period: 'weekly' });
    assert.equal(lb.metric, 'rating_gained');
    assert.ok(lb.entries.length > 0);
    assert.ok(lb.entries[0].value >= lb.entries[lb.entries.length - 1].value);
    const top = lb.entries[0];
    assert.equal(top.email, undefined);
    const global = await rpc((await player('lb2')), 'get_leaderboard', { p_period: 'global' });
    assert.equal(global.metric, 'rating');
    // Opting out removes the user from every board.
    const [topRow] = await sql(`select id from public.profiles where username = $1`, [top.username]);
    await asUser(topRow.id, 'update public.profiles set show_on_leaderboard = false');
    const lb2 = await rpc(topRow.id, 'get_leaderboard', { p_period: 'weekly' });
    assert.equal(lb2.entries.some((e) => e.username === top.username), false);
    assert.equal(lb2.me, null);
    assert.equal(lb2.participating, false);
    const pub = await rpc(topRow.id, 'get_public_profile', { p_username: top.username });
    assert.ok(pub.rating >= 1000);
    assert.equal(pub.email, undefined);
    assert.equal(pub.gender, undefined);
    await expectError(rpc(topRow.id, 'get_leaderboard', { p_period: 'yearly' }), /Unknown leaderboard period/);
  });
});

describe('maintenance sweep', () => {
  before(() => useFastBattleConfig());
  after(() => pool.end());

  it('voids battles abandoned by both players and clears stale queue rows', async () => {
    const a = await player('swa');
    const b = await player('swb');
    const id = await match(a, b);
    await rpc(a, 'set_battle_ready', { p_battle_id: id });
    await rpc(b, 'set_battle_ready', { p_battle_id: id });
    const c = await player('swc');
    await rpc(c, 'join_matchmaking', { p_mode: 'vocab_duel' });
    // Both players vanish; nobody calls the API again.
    await sql(`update public.battles set created_at = now() - interval '5 minutes' where id = $1`, [id]);
    await sql(`update public.battle_participants set last_seen_at = now() - interval '5 minutes' where battle_id = $1`, [id]);
    await sql(`update public.matchmaking_queue set last_poll_at = now() - interval '5 minutes' where user_id = $1`, [c]);
    const [{ r }] = await sql('select private.run_maintenance() as r');
    assert.ok(r.battles_checked >= 1);
    const [row] = await sql('select status, end_reason from public.battles where id = $1', [id]);
    assert.deepEqual(row, { status: 'void', end_reason: 'both_disconnected' });
    assert.equal((await sql('select 1 from public.matchmaking_queue where user_id = $1', [c])).length, 0);
    await expectError(asUser(a, 'select private.run_maintenance()'), /permission denied/);
  });
});
