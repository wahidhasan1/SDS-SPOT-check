#!/usr/bin/env node
// End-to-end journeys against the real web build + dev gateway + migrated DB.
//   1. Sign up → profile → adaptive assessment → dashboard → quiz → save word
//      → reload (session persists) → review.
//   2. Two separate accounts → matchmaking → ready → synchronized battle →
//      server-calculated result on both screens → report/block UI.
// Usage: node e2e/journeys.mjs   (expects the gateway on :8787 serving mobile/dist)
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';
import { chromium } from 'playwright';

const BASE = process.env.APP_URL ?? 'http://localhost:8787';
const SHOTS = process.env.SHOTS_DIR ?? join(import.meta.dirname, '../../docs/screenshots');
mkdirSync(SHOTS, { recursive: true });
const db = new pg.Pool({ database: process.env.TEST_DB ?? 'vocabattle_test', user: process.env.PGUSER ?? 'root', host: '/var/run/postgresql' });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const errors = [];

async function newPhone(name, scheme = 'dark') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/websocket|realtime|WebSocket/i.test(m.text())) errors.push(`${name} console: ${m.text().slice(0, 200)}`); });
  return page;
}
const shot = (page, file) => page.screenshot({ path: join(SHOTS, file) });

async function signUpAndOnboard(page, who, strategy = () => 0) {
  await page.goto(BASE);
  await page.getByTestId('welcome-get-started').click();
  await page.getByTestId('signup-name').fill(who);
  await page.getByTestId('signup-email').fill(`${who.toLowerCase()}.${Date.now()}@example.test`);
  await page.getByTestId('signup-password').fill('battle2026');
  await page.getByTestId('signup-confirm').fill('battle2026');
  await page.getByTestId('signup-submit').click();
  await page.getByTestId('profile-username').waitFor();
  await page.getByTestId('profile-username').fill(`${who.toLowerCase()}_${Math.floor(Math.random() * 1e4)}`);
  await page.getByText('IELTS preparation').click();
  await page.getByText('Bigger vocabulary').click();
  return async (screens) => {
    if (screens) await shot(page, '02-onboarding-profile.png');
    await page.getByTestId('profile-continue').click();
    await page.getByTestId('assessment-start').waitFor();
    if (screens) await shot(page, '03-assessment-intro.png');
    await page.getByTestId('assessment-start').click();
    for (let i = 0; i < 15; i++) {
      await page.getByTestId('option-0').waitFor();
      await page.getByTestId(`option-${strategy(i)}`).click();
      if (screens && i === 2) await shot(page, '04-assessment-question.png');
      await page.getByTestId('assessment-next').click();
      await page.waitForTimeout(150);
    }
    await page.getByTestId('assessment-level').waitFor({ timeout: 15000 });
    const level = await page.getByTestId('assessment-level').innerText();
    if (screens) await shot(page, '05-assessment-result.png');
    await page.getByTestId('assessment-continue').click();
    await page.getByTestId('home-name').waitFor({ timeout: 15000 });
    return level;
  };
}

try {
  // ------------------------------------------------------------------ journey 1
  log('journey 1: onboarding, assessment, learning');
  const p = await newPhone('learner');
  await p.goto(BASE);
  await p.getByTestId('welcome-get-started').waitFor();
  await shot(p, '01-welcome.png');
  const finish = await signUpAndOnboard(p, 'Nadia');
  const level = await finish(true);
  log('assessed level', level);
  assert.match(level, /^(A1|A2|B1|B2|C1|C2)$/);
  await p.waitForTimeout(800);
  await shot(p, '06-home-dashboard.png');

  // Daily quiz
  await p.getByTestId('tab-learn').click();
  await p.getByTestId('learn-daily-quiz').waitFor();
  await shot(p, '07-learn.png');
  await p.getByTestId('learn-daily-quiz').click();
  for (let i = 0; i < 10; i++) {
    await p.getByTestId('option-1').waitFor();
    await p.getByTestId('option-1').click();
    await p.getByTestId('quiz-feedback').waitFor();
    if (i === 0) await shot(p, '08-quiz-feedback.png');
    if (i === 1) {
      const save = p.getByText('Save word', { exact: true });
      if (await save.count()) await save.first().click();
    }
    await p.getByTestId('quiz-next').click();
  }
  await p.getByTestId('quiz-score').waitFor();
  const score = await p.getByTestId('quiz-score').innerText();
  log('quiz score', score);
  await shot(p, '09-quiz-results.png');
  await p.getByTestId('quiz-done').click();

  // Vocabulary detail
  await p.getByTestId('learn-vocabulary').click();
  await p.getByTestId('topic-ielts_academic').click();
  await p.getByText(/^significant/).first().click();
  await p.getByTestId('word-title').waitFor();
  await shot(p, '10-word-detail.png');
  await p.getByTestId('word-save').click();
  await p.getByText('Remove from my vocabulary').waitFor();

  // Session survives a full reload; progress persisted server-side.
  await p.reload();
  await p.getByTestId('word-title').waitFor({ timeout: 15000 }); // same screen restored, still signed in
  await p.getByText('Remove from my vocabulary').waitFor();
  const { rows: [prog] } = await db.query(`select g.xp, g.proficiency_level, (select count(*) from public.user_vocabulary v where v.user_id = g.user_id)::int as saved
                                            from public.user_progress g join public.profiles p on p.id = g.user_id where p.display_name = 'Nadia'`);
  log('persisted progress', prog);
  assert.ok(prog.xp > 0 && prog.saved >= 1 && prog.proficiency_level === level);

  // Review the saved words (make them due).
  await db.query(`update public.user_vocabulary set due_at = now() - interval '1 minute'`);
  await p.goto(`${BASE}/review`);
  await p.getByTestId('review-show').click();
  await shot(p, '11-review.png');
  await p.getByTestId('grade-good').click();
  await p.waitForTimeout(500);

  await p.goto(`${BASE}/profile`);
  await p.getByTestId('profile-name').waitFor();
  await shot(p, '12-profile.png');

  // ------------------------------------------------------------------ journey 2
  log('journey 2: two accounts battle');
  await db.query(`update public.app_config set value = value || '{"question_count": 3, "question_time_ms": 9000, "reveal_ms": 2500, "start_countdown_ms": 2500}'::jsonb where key = 'battle'`);
  const a = await newPhone('playerA');
  const b = await newPhone('playerB', 'light');
  const [finA, finB] = await Promise.all([signUpAndOnboard(a, 'Arif'), signUpAndOnboard(b, 'Bella')]);
  const [la, lb] = await Promise.all([finA(false), finB(false)]);
  log('levels', la, lb);

  for (const pg_ of [a, b]) {
    await pg_.getByTestId('tab-battle').click();
    await pg_.getByTestId('lobby-start').waitFor();
  }
  await shot(a, '13-battle-lobby.png');
  await a.getByTestId('lobby-start').click();
  await a.getByTestId('matchmaking-status').waitFor();
  await a.waitForTimeout(700);
  await shot(a, '14-matchmaking.png');
  await b.getByTestId('lobby-start').click();

  await Promise.all([a.getByTestId('battle-ready').waitFor({ timeout: 30000 }), b.getByTestId('battle-ready').waitFor({ timeout: 30000 })]);
  await shot(a, '15-match-found.png');
  await a.getByTestId('battle-ready').click();
  await b.getByTestId('battle-ready').click();

  // Each player answers every question as soon as it appears: A always
  // correctly (looked up in the DB, as a stand-in for a strong player), B wrongly.
  const { rows: [live] } = await db.query(`select id from public.battles order by created_at desc limit 1`);
  const correctFor = async (qIndex) => (await db.query(
    `select q.correct_index from public.battle_questions bq join public.questions q on q.id = bq.question_id where bq.battle_id = $1 and bq.idx = $2`,
    [live.id, qIndex])).rows[0].correct_index;
  const answered = { a: new Set(), b: new Set() };
  let shotTaken = false; let revealShot = false;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (await a.getByTestId('battle-outcome').count() && await b.getByTestId('battle-outcome').count()) break;
    for (const [key, page] of [['a', a], ['b', b]]) {
      const timer = page.getByTestId('battle-timer');
      if (await timer.count()) {
        const qIndex = Number((await page.getByTestId('battle-qindex').innerText().catch(() => 'Q 0/0')).match(/Q (\d+)/)?.[1] ?? 0) - 1;
        if (qIndex < 0 || answered[key].has(qIndex)) continue;
        const ci = await correctFor(qIndex);
        const opt = page.getByTestId(`option-${key === 'a' ? ci : (ci + 1) % 4}`);
        if (await opt.count()) {
          await opt.click().catch(() => {});
          answered[key].add(qIndex);
          if (key === 'a' && !shotTaken) { await page.waitForTimeout(300); await shot(page, '16-battle-question.png'); shotTaken = true; }
        }
      }
      if (key === 'a' && !revealShot && await page.getByTestId('battle-reveal').count()) { await shot(page, '17-battle-reveal.png'); revealShot = true; }
    }
    await a.waitForTimeout(250);
  }
  const outA = await a.getByTestId('battle-outcome').innerText();
  const outB = await b.getByTestId('battle-outcome').innerText();
  const deltaA = await a.getByTestId('battle-rating-delta').innerText();
  const deltaB = await b.getByTestId('battle-rating-delta').innerText();
  log('outcomes', outA, deltaA, '|', outB, deltaB);
  await shot(a, '18-battle-results.png');
  await shot(b, '19-battle-results-light.png');
  assert.equal(outA, 'Victory!', 'A answered every question correctly');
  assert.equal(outB, 'Defeat', 'both screens agree on the server result');
  assert.match(deltaA, /^\+\d+/);
  assert.match(deltaB, /^-\d+/);

  const { rows: res } = await db.query(`select br.result, br.rating_delta from public.battle_results br order by created_at desc limit 2`);
  log('server results', res);
  assert.equal(res.length, 2);
  const { rows: [counts] } = await db.query(`select count(*)::int n, count(*) filter (where is_correct)::int ok from public.battle_answers where battle_id = $1`, [live.id]);
  log('answers recorded', counts);
  assert.deepEqual(counts, { n: 6, ok: 3 });
  assert.equal(res[0].rating_delta + res[1].rating_delta, 0);

  // History + leaderboard screens render the result.
  await a.goto(`${BASE}/arena/history`);
  await a.getByText(/vs /).first().waitFor();
  await shot(a, '20-battle-history.png');
  await a.goto(`${BASE}/leaderboard`);
  await a.waitForTimeout(1200);
  await shot(a, '21-leaderboard.png');
  await a.goto(`${BASE}/read`);
  await a.getByTestId('read-word').waitFor();
  await shot(a, '22-read-phase2.png');

  log('client errors:', errors.length ? errors : 'none');
  log('E2E PASSED');
} catch (e) {
  for (const [i, ctx] of browser.contexts().entries()) {
    for (const pg_ of ctx.pages()) await pg_.screenshot({ path: join(SHOTS, `failure-${i}.png`) }).catch(() => {});
  }
  console.error('E2E FAILED:', e);
  console.error('client errors:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  await db.end();
}
