import { expect, test } from '@playwright/test';
import { signUpInContext } from './helpers';

test('two learners play a live vocabulary battle with server-side scoring', async ({ browser }) => {
  const c1 = await browser.newContext();
  const c2 = await browser.newContext();
  await signUpInContext(c1, 'Battler One');
  await signUpInContext(c2, 'Battler Two');
  const p1 = await c1.newPage();
  const p2 = await c2.newPage();
  for (const p of [p1, p2]) await p.goto('/battles');
  await p1.getByRole('button', { name: 'Find an opponent' }).click();
  await expect(p1.getByText('Waiting for an opponent…')).toBeVisible();
  await p2.getByRole('button', { name: 'Find an opponent' }).click();
  await expect(p1.getByText('Get ready!')).toBeVisible();
  await expect(p1.getByText('Question 1 of 10')).toBeVisible({ timeout: 10_000 });
  // Both players answer every question (first option) as quickly as the UI allows.
  for (let i = 1; i <= 10; i++) {
    for (const p of [p1, p2]) {
      await expect(p.getByText(`Question ${i} of 10`)).toBeVisible({ timeout: 10_000 });
      await p.locator('.grid button').first().click();
    }
  }
  await expect(p1.getByText(/You won!|It’s a draw!|You lost this time/)).toBeVisible({ timeout: 20_000 });
  await expect(p2.getByText(/You won!|It’s a draw!|You lost this time/)).toBeVisible({ timeout: 20_000 });
  const h1 = await (await c1.request.get('/api/battles/history')).json();
  const h2 = await (await c2.request.get('/api/battles/history')).json();
  expect(h1.battles[0].myScore).toBe(h2.battles[0].opponentScore);
  expect(['win', 'loss', 'draw']).toContain(h1.battles[0].outcome);
  if (h1.battles[0].outcome === 'win') expect(h2.battles[0].outcome).toBe('loss');
});
