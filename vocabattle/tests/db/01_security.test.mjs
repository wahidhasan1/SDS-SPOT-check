import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { asUser, createUser, expectError, onboard, pool, rpc, sql } from './helpers.mjs';

describe('account bootstrap, onboarding and data isolation', () => {
  let alice; let bob;

  before(async () => {
    alice = await createUser('alice');
    bob = await createUser('bob');
  });
  after(() => pool.end());

  it('creates a profile and server-owned progress row on sign-up', async () => {
    const [p] = await asUser(alice, 'select * from public.profiles');
    assert.equal(p.id, alice);
    assert.equal(p.display_name, 'alice');
    assert.equal(p.onboarding_step, 'profile');
    const [g] = await asUser(alice, 'select * from public.user_progress');
    assert.equal(g.proficiency_status, 'unassessed');
    assert.equal(g.proficiency_level, null);
  });

  it('validates the onboarding profile and unlocks the assessment', async () => {
    await expectError(rpc(alice, 'complete_profile_setup', {
      p_display_name: 'Alice', p_username: 'no spaces!', p_interface_language: 'en', p_learning_goals: [], p_daily_goal_xp: 50,
    }), /Username must be/);
    const res = await onboard(alice, 'alice_ok');
    assert.equal(res.onboarding_step, 'assessment');
    assert.equal(await rpc(bob, 'is_username_available', { p_username: 'ALICE_OK' }), false);
    await expectError(onboard(bob, 'Alice_OK'), /already taken/);
    await onboard(bob, 'bob_ok');
    const [p] = await asUser(alice, 'select timezone from public.profiles');
    assert.equal(p.timezone, 'Asia/Dhaka');
  });

  it('only shows a user their own private rows', async () => {
    const profiles = await asUser(alice, 'select id from public.profiles');
    assert.deepEqual(profiles.map((r) => r.id), [alice]);
    const progress = await asUser(alice, 'select user_id from public.user_progress');
    assert.deepEqual(progress.map((r) => r.user_id), [alice]);
    // Direct reads of another user's row by id return nothing.
    const other = await asUser(alice, 'select * from public.profiles where id = $1', [bob]);
    assert.equal(other.length, 0);
  });

  it('prevents users from editing their level, XP, streak or onboarding state', async () => {
    await expectError(asUser(alice, `update public.user_progress set proficiency_level = 'C2', xp = 99999`), /permission denied/);
    await expectError(asUser(alice, `update public.profiles set onboarding_step = 'done'`), /permission denied/);
    await expectError(asUser(alice, `update public.profiles set account_status = 'active'`), /permission denied/);
    await expectError(asUser(alice, `insert into public.user_roles (user_id, role) values ($1, 'admin')`, [alice]), /permission denied/);
    await expectError(asUser(alice, `insert into public.subscriptions (user_id, status, provider) values ($1, 'active', 'manual')`, [alice]), /permission denied/);
    await expectError(asUser(alice, `insert into public.battle_ratings (user_id, rating, peak_rating) values ($1, 3000, 3000)`, [alice]), /permission denied/);
  });

  it('allows editing presentation fields only on the own profile', async () => {
    await asUser(alice, `update public.profiles set display_name = 'Alice B', avatar = '🦉', show_identity_in_battles = true`);
    const [p] = await sql('select display_name, avatar from public.profiles where id = $1', [alice]);
    assert.equal(p.display_name, 'Alice B');
    assert.equal(p.avatar, '🦉');
    // An update aimed at another user silently matches zero rows under RLS.
    await asUser(alice, `update public.profiles set display_name = 'hacked' where id = $1`, [bob]);
    const [b] = await sql('select display_name from public.profiles where id = $1', [bob]);
    assert.equal(b.display_name, 'bob_ok');
  });

  it('hides correct answers: the question bank is not readable', async () => {
    await expectError(asUser(alice, 'select correct_index from public.questions limit 1'), /permission denied/);
    await expectError(asUser(alice, 'select * from public.battle_answers'), /permission denied/);
    await expectError(asUser(alice, 'select * from public.battle_participants'), /permission denied/);
    // Vocabulary itself is public learning content.
    const words = await asUser(alice, 'select count(*)::int as n from public.vocabulary_entries');
    assert.ok(words[0].n > 150);
  });

  it('denies every RPC to anonymous callers', async () => {
    await expectError(asUser(null, 'select public.get_dashboard()', [], 'anon'), /permission denied/);
    await expectError(asUser(null, 'select public.join_matchmaking()', [], 'anon'), /permission denied/);
  });

  it('does not expose internal helper functions', async () => {
    await expectError(asUser(alice, `select private.award_achievement($1, 'first_victory')`, [alice]), /permission denied/);
    await expectError(asUser(alice, `select private.record_activity($1, 'quiz', 100000)`, [alice]), /permission denied/);
  });
});
