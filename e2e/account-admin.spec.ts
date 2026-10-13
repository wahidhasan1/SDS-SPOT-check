import { expect, test } from '@playwright/test';
import { promoteAdmin, signUp } from './helpers';

test('profile, settings, premium development mode and data export', async ({ page }) => {
  await signUp(page.request, { name: 'Settings User' });
  await page.goto('/profile');
  await page.getByLabel('Display name').fill('Renamed User');
  await page.getByLabel('Module').selectOption('general');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile saved')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Display name')).toHaveValue('Renamed User');

  await page.goto('/settings');
  await page.getByRole('switch', { name: 'Allow voice calls' }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Allow voice calls' })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: /Dark/ }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  const exp = await page.request.get('/api/account/export');
  expect((await exp.json()).profile.displayName).toBe('Renamed User');

  await page.goto('/premium');
  await expect(page.getByText('Payments are not configured on this server')).toBeVisible();
  await page.getByRole('button', { name: 'Activate Premium (development mode)' }).click();
  await expect(page.getByText('Development mode — no payment was taken')).toBeVisible();
  await page.getByRole('button', { name: 'Return to Free' }).click();
  await expect(page.getByRole('button', { name: 'Activate Premium (development mode)' })).toBeVisible();
});

test('admin area is protected and lets admins edit and validate content', async ({ browser }) => {
  const userCtx = await browser.newContext();
  await signUp(userCtx.request, { name: 'Normal User' });
  const up = await userCtx.newPage();
  await up.goto('/admin');
  await expect(up).toHaveURL(/\/dashboard$/);
  expect((await up.request.get('/api/admin/overview')).status()).toBe(403);
  await expect(up.getByRole('link', { name: 'Admin' })).toHaveCount(0);

  const adminCtx = await browser.newContext();
  const { email } = await signUp(adminCtx.request, { name: 'Site Admin' });
  promoteAdmin(email);
  const ap = await adminCtx.newPage();
  await ap.goto('/admin');
  await expect(ap.getByText('Users', { exact: true }).first()).toBeVisible();
  await expect(ap.getByText('Lessons', { exact: true }).first()).toBeVisible();

  // Create a vocabulary word that fails publish validation, then fix it.
  await ap.goto('/admin/words');
  await ap.getByRole('button', { name: 'New' }).click();
  const word = `zestful${Date.now() % 100000}`;
  await ap.getByLabel('Word *').fill(word);
  await ap.getByLabel('Definition *').fill('Full of energy and enthusiasm.');
  await ap.getByLabel(/Example sentence/).fill('She approached the task with great energy.');
  await ap.getByRole('button', { name: 'Save' }).click();
  await expect(ap.getByText('Please fix the following')).toBeVisible();
  await ap.getByLabel(/Example sentence/).fill(`She gave a ${word} performance.`);
  await ap.getByRole('button', { name: 'Save' }).click();
  await expect(ap.getByText('Saved', { exact: true })).toBeVisible();
  await ap.getByLabel('Search').fill(word);
  await ap.getByRole('button', { name: 'Search' }).click();
  await expect(ap.getByRole('cell', { name: word })).toBeVisible();

  // The learner can now find it.
  const r = await up.request.get(`/api/vocab/words?q=${word}`);
  expect((await r.json()).words[0].word).toBe(word);

  // Moderation and audit pages load.
  await ap.goto('/admin/reports');
  await expect(ap.getByRole('tab', { name: 'Open' })).toBeVisible();
  await ap.goto('/admin/audit');
  await expect(ap.getByText('create:words').first()).toBeVisible();
});
