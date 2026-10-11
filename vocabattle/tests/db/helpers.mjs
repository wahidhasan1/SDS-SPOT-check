// Test helpers: run SQL exactly as the Supabase Data API would for a signed-in
// user (role `authenticated` + JWT claims), or as a superuser for setup.
import pg from 'pg';

export const pool = new pg.Pool({
  database: process.env.TEST_DB ?? 'vocabattle_test',
  user: process.env.PGUSER ?? process.env.USER ?? 'root',
  host: process.env.PGHOST ?? '/var/run/postgresql',
  max: 12,
});

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function sql(text, params = []) {
  const r = await pool.query(text, params);
  return r.rows;
}

export async function asUser(uid, text, params = [], role = 'authenticated') {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`set local role ${role}`);
    if (uid) {
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role })]);
    }
    const r = await c.query(text, params);
    await c.query('commit');
    return r.rows;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// Calls public.<fn>(named args) as the user and returns the scalar result.
export async function rpc(uid, fn, args = {}, role = 'authenticated') {
  const keys = Object.keys(args);
  const call = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
  const rows = await asUser(uid, call, keys.map((k) => args[k]), role);
  return rows[0].r;
}

let counter = 0;
export async function createUser(name = 'user') {
  counter += 1;
  const email = `${name}.${Date.now()}.${counter}@example.test`;
  const [row] = await sql(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, { display_name: name }]);
  return row.id;
}

export async function onboard(uid, username) {
  return rpc(uid, 'complete_profile_setup', {
    p_display_name: username, p_username: username, p_interface_language: 'en',
    p_learning_goals: ['ielts'], p_daily_goal_xp: 50, p_ielts_target_band: 7.0, p_timezone: 'Asia/Dhaka',
  });
}

export async function correctIndex(questionId) {
  const [row] = await sql('select correct_index from public.questions where id = $1', [questionId]);
  return row.correct_index;
}

// Runs a full assessment; `strategy(question, index)` returns true to answer correctly.
export async function runAssessment(uid, strategy) {
  let state = await rpc(uid, 'start_assessment');
  let guard = 0;
  while (!state.finished) {
    const q = state.question;
    const correct = await correctIndex(q.id);
    const pick = strategy(q, state.index) ? correct : (correct + 1) % q.options.length;
    state = await rpc(uid, 'submit_assessment_answer', { p_assessment_id: state.assessment_id, p_question_id: q.id, p_selected: pick });
    if (++guard > 50) throw new Error('assessment did not finish');
  }
  return state.result;
}

// Fast battle timings for tests (restored values are irrelevant: DB is recreated).
export async function useFastBattleConfig(overrides = {}) {
  const cfg = {
    question_count: 3, question_time_ms: 1500, reveal_ms: 300, start_countdown_ms: 200,
    ready_timeout_ms: 1500, disconnect_timeout_ms: 2500, answer_grace_ms: 200, queue_stale_ms: 10000,
    ...overrides,
  };
  await sql(`update public.app_config set value = value || $1::jsonb where key = 'battle'`, [cfg]);
}

export async function expectError(promise, pattern) {
  try {
    await promise;
  } catch (e) {
    if (pattern && !pattern.test(e.message)) throw new Error(`Expected error ${pattern}, got: ${e.message}`);
    return e;
  }
  throw new Error(`Expected an error matching ${pattern}`);
}
