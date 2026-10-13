import { expect, test } from '@playwright/test';
import { API, apiCall, makeAdmin, registerUser, signedInPage } from './helpers';

test('new learner registers in the UI, completes onboarding and the adaptive placement test', async ({ page }) => {
  const email = `ui-${Date.now()}@e2e.test`;
  await page.goto('/welcome');
  await page.getByRole('link', { name: 'Create free account' }).click();
  await page.getByLabel('Your name').fill('Uma');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('short');
  await page.getByLabel('Birth year').fill('1996');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toContainText('at least 8 characters');
  await page.getByLabel('Password').fill('Passw0rd!x');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Welcome to')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'IELTS Academic' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: '7', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue to placement test' }).click();
  await page.getByTestId('start-assessment').click();
  for (let i = 0; i < 20; i++) {
    await expect(page.getByTestId('assessment-prompt')).toBeVisible();
    await page.getByRole('radio').first().click();
    await page.getByTestId('assessment-next').click();
    if (i < 19) await expect(page.getByText(`Question ${i + 2} of 20`)).toBeVisible();
  }
  const level = await page.getByTestId('assessment-level').textContent();
  expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(level);
  await page.getByRole('button', { name: 'Go to my dashboard' }).click();
  await expect(page.getByText(`CEFR ${level}`).first()).toBeVisible();

  // Sign out and back in: session persistence and invalid credentials.
  await page.goto('/profile');
  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/welcome/);
  await page.goto('/ielts');
  await expect(page).toHaveURL(/welcome/); // protected route
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('wrong-password1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect email or password');
  await page.getByLabel('Password').fill('Passw0rd!x');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(`CEFR ${level}`).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(`CEFR ${level}`).first()).toBeVisible();
});

test('IELTS reading: answers autosave, survive reload, and are scored with explanations', async ({ browser }) => {
  const u = await registerUser('Rita');
  const { ctx, page } = await signedInPage(browser, u);
  await page.goto('/ielts/reading');
  await page.getByTestId('practice-academic-reading-urban-bees').click();
  await page.getByRole('radio', { name: 'TRUE' }).first().click(); // q1
  await page.getByLabel('Question 6', { exact: true }).fill('hollow stems');
  await page.getByLabel('Question 7', { exact: true }).fill('wrong answer');
  await expect(page.getByTestId('save-state')).toHaveText('✓ Saved', { timeout: 10_000 });
  await page.reload();
  await expect(page.getByLabel('Question 6', { exact: true })).toHaveValue('hollow stems');
  await page.getByRole('radio', { name: /A\s+Urban honey has won national awards/ }).click(); // q10
  await page.getByTestId('submit-test').click();
  await page.getByTestId('confirm-submit').click();
  await expect(page.getByTestId('score')).toContainText('Score 3/13');
  await expect(page.getByText('Paragraph D: “The density of hives appears to be the critical factor.”')).toBeVisible();
  await expect(page.getByLabel('Question 6', { exact: true })).toBeDisabled();
  await ctx.close();
});

test('IELTS listening: real audio plays and transcript appears only after submission', async ({ browser }) => {
  const u = await registerUser('Leo');
  const { ctx, page } = await signedInPage(browser, u);
  await page.goto('/ielts/listening');
  await page.getByTestId('practice-listening-s1-course-booking').click();
  await expect(page.getByText('Transcript')).toHaveCount(0);
  await page.getByTestId('audio-play').click();
  await page.waitForTimeout(2500);
  const t = await page.getByTestId('listening-audio').evaluate((a: HTMLAudioElement) => ({ time: a.currentTime, duration: a.duration, paused: a.paused }));
  expect(t.duration).toBeGreaterThan(90);
  expect(t.time).toBeGreaterThan(1);
  expect(t.paused).toBe(false);
  await page.getByLabel('Question 1', { exact: true }).fill('cookery');
  await page.getByLabel('Question 6', { exact: true }).fill('£50');
  await page.getByTestId('submit-test').click();
  await page.getByTestId('confirm-submit').click();
  await expect(page.getByTestId('score')).toContainText('Score 2/10');
  await expect(page.getByRole('heading', { name: 'Transcript' })).toBeVisible();
  await ctx.close();
});

test('IELTS writing: draft autosaves across devices, then submits for honest feedback', async ({ browser }) => {
  const u = await registerUser('Wendy');
  const { ctx, page } = await signedInPage(browser, u);
  await page.goto('/ielts/writing/acad-t2-traffic');
  const text = 'Traffic congestion is a serious problem in many cities. There are several causes.\n\nFirstly, the number of private cars has increased. Moreover, public transport is often unreliable.\n\nHowever, governments could invest in buses and trains. For example, cheaper tickets would encourage people to leave their cars at home.\n\nIn conclusion, I believe better public transport is the most effective solution.';
  await page.getByTestId('writing-editor').fill(text);
  await expect(page.getByTestId('writing-save-state')).toHaveText('✓ Draft saved', { timeout: 10_000 });
  // Same account on "another device" sees the draft.
  const other = await apiCall(u.accessToken, 'GET', '/ielts/writing/prompts/acad-t2-traffic', undefined, 'android');
  expect(other.json.draft.text).toBe(text);
  await page.getByTestId('submit-writing').click();
  await page.getByTestId('confirm-writing').click();
  await expect(page).toHaveURL(/writing\/result/);
  await expect(page.getByText('Measurable checks')).toBeVisible();
  await expect(page.getByText('Under the minimum length')).toBeVisible();
  // Without an AI key configured, no band score may be shown.
  const cfg = await (await fetch(API + '/config')).json();
  if (!cfg.integrations.ai) {
    await expect(page.getByText('No band score is estimated')).toBeVisible();
    await expect(page.getByTestId('ai-feedback')).toHaveCount(0);
  }
  await ctx.close();
});

test('vocabulary saved on the web is reviewable from mobile, and progress syncs', async ({ browser }) => {
  const u = await registerUser('Vic');
  const { ctx, page } = await signedInPage(browser, u);
  await page.goto('/vocabulary');
  await page.getByRole('button', { name: 'Browse' }).click();
  await page.getByPlaceholder('Search words or meanings').fill('mitigate');
  await page.getByTestId('save-mitigate').click();
  await expect(page.getByTestId('save-mitigate')).toHaveText('✓ Saved');
  const mobileView = await apiCall(u.accessToken, 'GET', '/vocabulary/saved', undefined, 'ios');
  expect(mobileView.json.map((w: any) => w.word)).toContain('mitigate');
  const review = await apiCall(u.accessToken, 'GET', '/vocabulary/review', undefined, 'android');
  await apiCall(u.accessToken, 'POST', `/vocabulary/saved/${review.json[0].id}/review`, { quality: 5 }, 'android');
  await page.goto('/vocabulary/review');
  await expect(page.getByText('Nothing due right now')).toBeVisible();
  await ctx.close();
});

test('AI reading: a photographed page is OCR-ed and tapping a word explains it in context', async ({ browser }) => {
  const sharp = (await import('sharp')).default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420"><rect width="100%" height="100%" fill="#f6f1e6"/>
  <text x="50" y="110" font-family="DejaVu Serif" font-size="36" fill="#222">We sat on the bank of the river and</text>
  <text x="50" y="170" font-family="DejaVu Serif" font-size="36" fill="#222">watched the boats drift slowly past.</text></svg>`;
  const jpg = await sharp(Buffer.from(svg)).rotate(1.5, { background: '#f6f1e6' }).jpeg().toBuffer();
  const u = await registerUser('Rhea');
  const { ctx, page } = await signedInPage(browser, u);
  await page.goto('/read');
  await page.getByTestId('scan-file').setInputFiles({ name: 'page.jpg', mimeType: 'image/jpeg', buffer: jpg });
  await page.getByTestId('scan-confirm').click();
  await expect(page.getByTestId('reader-text')).toContainText('bank of the river', { timeout: 30_000 });
  await page.getByTestId('reader-text').getByText('bank', { exact: true }).click();
  await expect(page.getByTestId('lookup-headword')).toHaveText('bank');
  const cfg = await (await fetch(API + '/config')).json();
  if (!cfg.integrations.ai) await expect(page.getByTestId('lookup-meaning')).toContainText('sloping land');
  await page.getByTestId('lookup-save').click();
  await expect(page.getByTestId('lookup-save')).toHaveText('✓ Saved to vocabulary');
  const saved = await apiCall(u.accessToken, 'GET', '/vocabulary/saved');
  expect(saved.json[0]).toMatchObject({ word: 'bank', source: 'ai_reading' });
  await ctx.close();
});

test('real-time ranked battle between two users is scored server-side and updates ratings', async ({ browser }) => {
  test.setTimeout(150_000);
  const a = await registerUser('Bea');
  const b = await registerUser('Bob');
  const A = await signedInPage(browser, a);
  const B = await signedInPage(browser, b);
  await A.page.goto('/battles');
  await B.page.goto('/battles');
  await A.page.getByTestId('ranked-vocabulary').click();
  await expect(A.page.getByTestId('battle-status')).toBeVisible();
  await B.page.getByTestId('ranked-vocabulary').click();
  await expect(A.page.getByTestId('opponent-name')).toHaveText(b.user.anonName, { timeout: 15_000 });
  await expect(B.page.getByTestId('opponent-name')).toHaveText(a.user.anonName);
  for (let i = 0; i < 7; i++) {
    await expect(A.page.getByText(`Question ${i + 1} of 7`)).toBeVisible({ timeout: 20_000 });
    const qa = await A.page.getByTestId('battle-question').textContent();
    const qb = await B.page.getByTestId('battle-question').textContent();
    expect(qa).toBe(qb); // synchronised questions
    await A.page.locator('.option').first().click();
    await B.page.locator('.option').nth(1).click();
  }
  await expect(A.page.getByTestId('battle-end')).toBeVisible({ timeout: 20_000 });
  await expect(B.page.getByTestId('battle-end')).toBeVisible();
  const ha = await apiCall(a.accessToken, 'GET', '/battles/history');
  const hb = await apiCall(b.accessToken, 'GET', '/battles/history');
  expect(ha.json[0].ranked).toBe(true);
  expect(ha.json[0].rating_after - ha.json[0].rating_before).toBe(-(hb.json[0].rating_after - hb.json[0].rating_before));
  await A.ctx.close();
  await B.ctx.close();
});

test('mock test: strict reading section, monthly limit, admin premium grant lifts it', async ({ browser }) => {
  const u = await registerUser('Mo');
  const { ctx, page } = await signedInPage(browser, u);
  await page.goto('/ielts/mock');
  await page.getByTestId('mock-academic-mock-1').click();
  for (const s of ['listening', 'writing', 'speaking']) await page.getByRole('button', { name: new RegExp(s) }).click();
  await page.getByTestId('mock-begin').click();
  await expect(page.getByTestId('mock-timer')).toBeVisible();
  await page.getByRole('button', { name: 'Passage 1' }).click();
  await page.getByRole('radio', { name: 'TRUE' }).first().click();
  await page.waitForTimeout(2000);
  await page.getByTestId('mock-submit-section').click();
  await page.getByTestId('mock-confirm-submit').click();
  await expect(page.getByTestId('mock-results')).toBeVisible();
  await expect(page.getByText('1/40 correct')).toBeVisible();
  // Second mock within 30 days is blocked on the free plan…
  const second = await apiCall(u.accessToken, 'POST', '/ielts/mocks/general-mock-1/start', { skills: ['reading'] });
  expect(second.status).toBe(402);
  // …a client cannot grant itself premium…
  const fake = await apiCall(u.accessToken, 'PATCH', '/me', { plan: 'premium' });
  expect((await apiCall(u.accessToken, 'GET', '/me/entitlements')).json.plan).toBe('free');
  expect(fake.status).toBe(200);
  // …but a server-side admin grant does.
  const admin = await registerUser('Ada');
  await makeAdmin(admin.email);
  const relog = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: admin.email, password: admin.password }) })).json();
  expect((await apiCall(u.accessToken, 'GET', '/admin/stats')).status).toBe(403);
  const grant = await apiCall(relog.accessToken, 'POST', `/admin/users/${u.user.id}/action`, { action: 'grant_premium', days: 30 });
  expect(grant.status).toBe(200);
  expect((await apiCall(u.accessToken, 'GET', '/me/entitlements')).json.plan).toBe('premium');
  expect((await apiCall(u.accessToken, 'POST', '/ielts/mocks/general-mock-1/start', { skills: ['reading'] })).status).toBe(200);
  await ctx.close();
});
