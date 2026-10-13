import { expect, test } from '@playwright/test';
import { promoteAdmin, signUp } from './helpers';

const PUBLIC = ['/', '/pricing', '/privacy', '/login', '/register', '/forgot-password'];
const APP = ['/dashboard', '/progress', '/notifications', '/grammar', '/grammar/present-simple', '/vocabulary', '/vocabulary/my', '/vocabulary/review', '/vocabulary/quiz', '/reader', '/ielts', '/ielts/reading', '/ielts/listening', '/ielts/writing', '/ielts/speaking', '/ielts/mock', '/speak', '/battles', '/profile', '/settings', '/premium', '/admin', '/admin/users', '/admin/lessons', '/admin/ielts-sets', '/admin/reports'];

test.use({ viewport: { width: 375, height: 760 } });

test('every main page fits a 375px phone screen without horizontal scrolling or script errors', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
  const check = async (path: string) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).not.toBeEmpty();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
  };
  for (const p of PUBLIC) await check(p);
  const { email } = await signUp(page.request, { name: 'Phone User' });
  promoteAdmin(email);
  for (const p of APP) await check(p);
  // The timed reading test screen (passage + questions side by side on desktop).
  const sets = await (await page.request.get('/api/ielts/sets?module=reading&variant=academic')).json();
  const free = sets.sets.find((s: { locked: boolean }) => !s.locked);
  const started = await (await page.request.post(`/api/ielts/sets/${free.id}/start`, { data: {} })).json();
  await check(`/ielts/attempts/${started.attemptId}`);
  await page.screenshot({ path: 'test-results/phone-reading-test.png' });
  expect(errors).toEqual([]);
});
