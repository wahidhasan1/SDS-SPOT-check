import { expect, test } from '@playwright/test';
import { audioStats, registerUser, signedInPage } from './helpers';

/**
 * The Expo app's web build (react-native-web) exercises the mobile codebase — screens,
 * CallProvider, shared CallSession — in Chromium. Native WebRTC on Android/iOS devices
 * must still be verified on real hardware (see docs/TEST_PLAN.md).
 */
const MOBILE = process.env.MOBILE_WEB_URL ?? 'http://localhost:8081';

test('mobile app (web build) user calls a web app user with two-way audio', async ({ browser }) => {
  const m = await registerUser('Mia');
  const w = await registerUser('Wes');
  const M = await signedInPage(browser, m, { viewport: { width: 390, height: 844 } });
  const W = await signedInPage(browser, w);
  await M.page.goto(MOBILE + '/');
  await expect(M.page.getByText(`Hi, ${m.user.displayName}`)).toBeVisible({ timeout: 20_000 });
  await M.page.getByText('Speaking', { exact: true }).last().click();
  await M.page.getByTestId('start-call').click();
  await expect(M.page.getByText('Finding a speaking partner…')).toBeVisible();
  await W.page.goto('/speaking');
  await W.page.getByTestId('start-call').click();
  await expect(W.page.getByTestId('call-state')).toHaveText('Connected', { timeout: 30_000 });
  await expect(M.page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(M.page.getByText(w.user.anonName)).toBeVisible();
  await W.page.waitForTimeout(3000);
  const ws = await audioStats(W.page);
  expect(ws!.bytesReceived).toBeGreaterThan(1000);
  expect(ws!.audioLevel ?? 0).toBeGreaterThan(0.01);
  // Mobile user mutes: web user sees it and receives silence.
  await M.page.getByRole('button', { name: 'Mute' }).click();
  await expect(W.page.getByText('Partner muted')).toBeVisible();
  // Web user hangs up; the mobile app shows the summary.
  await W.page.getByTestId('end-call').click();
  await expect(M.page.getByText('Your partner ended the call.')).toBeVisible({ timeout: 10_000 });
  await M.ctx.close();
  await W.ctx.close();
});

test('mobile app (web build): vocabulary saved on mobile appears on the web app', async ({ browser }) => {
  const u = await registerUser('Sam');
  const M = await signedInPage(browser, u, { viewport: { width: 390, height: 844 } });
  await M.page.goto(MOBILE + '/vocabulary');
  await M.page.getByText('My words').click();
  await M.page.getByPlaceholder('Add a word').fill('serendipity');
  await M.page.getByText('Add', { exact: true }).click();
  await expect(M.page.getByText('serendipity')).toBeVisible();
  const W = await signedInPage(browser, u);
  await W.page.goto('/vocabulary');
  await W.page.getByRole('button', { name: 'My words' }).click();
  await expect(W.page.getByText('serendipity')).toBeVisible();
  await M.ctx.close();
  await W.ctx.close();
});
