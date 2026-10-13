import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end acceptance tests. Run with `npm run test:e2e` (builds + serves the app).
 * A fake browser clock makes timing rules (minimum active workout time, demo battle
 * acceptance, day changes) deterministic.
 */

const TUESDAY = new Date('2026-10-13T08:00:00');

async function onboard(page: Page, opts: { name?: string; age?: string } = {}) {
  await page.getByLabel('Display name').fill(opts.name ?? 'Test Athlete');
  await page.getByLabel('Age').fill(opts.age ?? '28');
  await page.getByLabel('Height').fill('172');
  await page.getByLabel('Current weight').fill('70');
  await page.getByRole('radio', { name: /Beginner/ }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('radiogroup', { name: 'Primary goal' }).getByRole('radio', { name: /Build muscle/ }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: 'Choose This Goal' }).first().click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByText('Recommended for you: Full-body training')).toBeVisible();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('radio', { name: /12 months/ }).click();
  await expect(page.getByText('Month 12:')).toBeVisible();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: /Generate my plan/ }).click();
  await page.waitForURL('**/app');
}

async function advanceDays(page: Page, n: number) {
  await page.goto('/app/settings');
  for (let i = 0; i < n; i++) await page.getByRole('button', { name: 'Advance 1 day' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: TUESDAY });
});

test('full journey: sign up → onboarding → workout → habits → battle, with persistence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Build Your Body/ })).toBeVisible();
  await page.getByRole('link', { name: /Start your quest/ }).first().click();

  // Sign-up validation
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Enter a valid email address.').or(page.getByText('Email is required.'))).toBeVisible();
  await page.getByLabel('Your name').fill('Rahim');
  await page.getByLabel('Email').fill('rahim@example.com');
  await page.getByLabel('Password', { exact: true }).fill('quest2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding/profile');

  // Onboarding validation: missing + invalid values, unit switching
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByText('Age is required.')).toBeVisible();
  await page.getByLabel('Age').fill('9');
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.getByText(/BODYQUEST is for people aged 13 and over/)).toBeVisible();
  await page.getByLabel('Height').fill('172');
  await page.getByRole('button', { name: 'Imperial (ft, lb)' }).click();
  await expect(page.getByLabel('Height feet')).toHaveValue('5');
  await expect(page.getByLabel('Height inches')).toHaveValue('8');
  await page.getByRole('button', { name: 'Metric (cm, kg)' }).click();
  await onboard(page, { name: 'Rahim' });

  // Dashboard
  await expect(page.getByRole('heading', { name: /Good morning, Rahim/ })).toBeVisible();

  // Tuesday is a rest day for Mon/Wed/Fri → move to Wednesday.
  await advanceDays(page, 1);
  await page.goto('/app');
  await page.getByRole('button', { name: /Start Today’s Workout/ }).click();
  await page.waitForURL('**/app/workout');

  // Illustrations present
  await expect(page.locator('svg.figure-svg').first()).toBeVisible();

  // Warm-up items
  const warmups = page.getByRole('button', { name: 'Mark Complete', exact: true });
  // Log the first main set manually with a rating → rest timer starts
  await page.getByRole('button', { name: /Log set 1/ }).first().click();
  await expect(page.getByText('REST', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip rest' }).click();

  // Pause and resume
  await page.getByRole('button', { name: 'Pause Workout' }).click();
  await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  await page.reload(); // refresh mid-session
  await expect(page.getByText('PAUSED', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();

  // Replace a not-yet-started exercise with an approved alternative
  await page.getByRole('button', { name: 'Replace' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Use this' }).first().click();
  await expect(page.getByText(/Replaced .* with an approved alternative/)).toBeVisible();

  // Finishing too early does not count
  await page.getByRole('button', { name: 'Finish Workout' }).click();
  await expect(page.getByText('This won’t count as a completed workout yet')).toBeVisible();
  await page.getByRole('button', { name: 'Keep going' }).click();

  for (let i = 0; i < 20; i++) {
    const n = await warmups.count();
    if (n === 0) break;
    const b = warmups.first();
    if (await b.isDisabled()) break;
    await b.click();
  }
  await page.clock.fastForward('08:00');
  await page.getByRole('button', { name: 'Finish Workout' }).click();
  await page.getByRole('button', { name: /Finish & claim XP/ }).click();
  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();
  await expect(page.getByText(/^\+1\d\d$/)).toBeVisible();

  // Refresh keeps progress
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Workout complete' })).toBeVisible();

  // Food: log as planned
  await page.goto('/app/food');
  await page.getByRole('group', { name: 'Breakfast status' }).getByRole('button', { name: 'As planned' }).click();
  await expect(page.getByText('kcal (approximate)')).toBeVisible();

  // Water: quick add, invalid amount
  await page.goto('/app/hydration');
  await page.getByRole('button', { name: '500 ml' }).click();
  await page.getByLabel('Custom amount in millilitres').fill('-5');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(/Minimum entry is 10 ml/)).toBeVisible();
  await expect(page.getByText('500 ml water')).toBeVisible();

  // Streaks & progress & achievements
  await page.goto('/app/streaks');
  await expect(page.getByText('Current streak (sessions)')).toBeVisible();
  await page.goto('/app/progress');
  await page.getByRole('button', { name: 'Record progress' }).first().click();
  await page.getByLabel('Max push-ups (any variation, good form)').fill('9');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Max push-ups: 9')).toBeVisible();
  await page.goto('/app/achievements');
  await expect(page.getByLabel('First Workout: unlocked')).toBeVisible();

  // Battle: accept the demo invitation, view scores
  await page.goto('/app/battles');
  await page.getByRole('button', { name: 'Accept' }).first().click();
  await page.locator('a.card.clickable').first().click();
  await expect(page.getByText('Score breakdown')).toBeVisible();
  await expect(page.getByText('Demo').first()).toBeVisible();

  // Advance past the battle end → results
  await advanceDays(page, 8);
  await page.goto('/app/battles');
  await page.getByRole('tab', { name: /History/ }).click();
  await expect(page.getByRole('link', { name: 'Results' })).toBeVisible();

  // Settings & safety
  await page.goto('/safety');
  await expect(page.getByRole('heading', { name: 'Privacy & Safety' })).toBeVisible();

  // Sign out & back in: data persists
  await page.goto('/app/settings');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto('/signin');
  await page.getByLabel('Email').fill('rahim@example.com');
  await page.getByLabel('Password').fill('quest2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/app');
  await page.goto('/app/progress');
  await expect(page.getByText('Max push-ups: 9')).toBeVisible();

  expect(errors).toEqual([]);
});

test('missed session recovery with a comeback session (guest)', async ({ page }) => {
  await page.goto('/signin');
  await page.getByRole('button', { name: 'Continue as guest' }).click();
  await onboard(page);
  await advanceDays(page, 2); // Thursday: Wednesday missed
  await page.goto('/app/streaks');
  await expect(page.getByText(/Missed: Full Body/)).toBeVisible();
  await page.getByRole('link', { name: /Mobility session/ }).click();
  await page.getByRole('button', { name: 'Start Workout' }).click();
  for (let i = 0; i < 20; i++) {
    const b = page.getByRole('button', { name: 'Mark Complete', exact: true }).first();
    if (!(await b.count()) || (await b.isDisabled())) break;
    await b.click();
  }
  await page.clock.fastForward('05:00');
  await page.getByRole('button', { name: 'Finish Workout' }).click();
  await page.getByRole('button', { name: /Finish & claim XP/ }).click();
  await expect(page.getByText(/Comeback complete/)).toBeVisible();
  await page.goto('/app/streaks');
  await expect(page.getByText(/Missed: Full Body/)).toHaveCount(0);
});

test('mobile: navigation works and pages never scroll horizontally', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'mobile only');
  await page.goto('/signin');
  await page.getByRole('button', { name: 'Continue as guest' }).click();
  await onboard(page);
  for (const path of ['/app', '/app/workout', '/app/food', '/app/hydration', '/app/streaks', '/app/battles', '/app/progress', '/app/exercises/pushup', '/app/settings']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: /More/ }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Achievements' }).click();
  await expect(page.getByRole('heading', { name: 'Achievements' })).toBeVisible();
});
