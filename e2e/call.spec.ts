import { expect, test } from '@playwright/test';
import { audioStats, registerUser, signedInPage } from './helpers';

test('two real users are matched and exchange live audio in both directions', async ({ browser }) => {
  const alice = await registerUser('Alice');
  const bob = await registerUser('Bob');
  const A = await signedInPage(browser, alice);
  const B = await signedInPage(browser, bob);

  await A.page.goto('/speaking');
  await B.page.goto('/speaking');
  await A.page.getByTestId('start-call').click();
  await expect(A.page.getByTestId('match-status')).toContainText('Finding a speaking partner');
  await B.page.getByTestId('start-call').click();

  // Both land on the call screen and the server confirms a working media connection.
  await expect(A.page.getByTestId('call-state')).toHaveText('Connected', { timeout: 30_000 });
  await expect(B.page.getByTestId('call-state')).toHaveText('Connected', { timeout: 30_000 });
  await expect(A.page.getByTestId('partner-name')).toHaveText(bob.user.anonName);
  await expect(B.page.getByTestId('partner-name')).toHaveText(alice.user.anonName);

  // Audio flows both ways: bytes increase and the received signal has energy.
  await A.page.waitForTimeout(2500);
  const a1 = await audioStats(A.page);
  const b1 = await audioStats(B.page);
  expect(a1!.bytesReceived).toBeGreaterThan(1000);
  expect(b1!.bytesReceived).toBeGreaterThan(1000);
  await A.page.waitForTimeout(1500);
  const a2 = await audioStats(A.page);
  const b2 = await audioStats(B.page);
  expect(a2!.bytesReceived).toBeGreaterThan(a1!.bytesReceived);
  expect(b2!.bytesReceived).toBeGreaterThan(b1!.bytesReceived);
  expect(a2!.audioLevel ?? 0).toBeGreaterThan(0.01);
  expect(b2!.audioLevel ?? 0).toBeGreaterThan(0.01);

  // The remote stream is attached to a playing <audio> element.
  const playing = await B.page.evaluate(() => {
    const el = document.querySelector('[data-testid="remote-audio"]') as HTMLAudioElement;
    const s = el?.srcObject as MediaStream | null;
    return !!s && s.getAudioTracks().some((t) => t.readyState === 'live') && !el.paused;
  });
  expect(playing).toBe(true);

  // Mute: Alice's mic is silenced, Bob receives (near) silence and sees the indicator.
  await A.page.getByTestId('mute-btn').click();
  await expect(A.page.getByTestId('mute-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(B.page.getByText('Partner muted')).toBeVisible();
  await B.page.waitForTimeout(2500);
  const bMuted = await audioStats(B.page);
  expect(bMuted!.audioLevel ?? 0).toBeLessThan(0.005);
  // Unmute restores audio.
  await A.page.getByTestId('mute-btn').click();
  await B.page.waitForTimeout(2500);
  const bUnmuted = await audioStats(B.page);
  expect(bUnmuted!.audioLevel ?? 0).toBeGreaterThan(0.01);

  // Bob ends the call: both get the summary, microphones are released.
  await B.page.getByTestId('end-call').click();
  await expect(B.page.getByTestId('summary-title')).toBeVisible({ timeout: 10_000 });
  await expect(A.page.getByTestId('summary-title')).toBeVisible({ timeout: 10_000 });
  await expect(A.page.getByText('Your partner ended the call.')).toBeVisible();
  const micLive = await A.page.evaluate(() => {
    const s = (window as any).__activeCall;
    return s?.pc ?? null;
  });
  expect(micLive).toBeNull();

  // History is stored for both users.
  await A.page.goto('/speaking/history');
  await expect(A.page.getByText(bob.user.anonName)).toBeVisible();
  await A.ctx.close();
  await B.ctx.close();
});

test('blocked users are never matched again', async ({ browser }) => {
  const u1 = await registerUser('Carol');
  const u2 = await registerUser('Dave');
  const A = await signedInPage(browser, u1);
  const B = await signedInPage(browser, u2);
  await A.page.goto('/speaking');
  await B.page.goto('/speaking');
  await A.page.getByTestId('start-call').click();
  await B.page.getByTestId('start-call').click();
  await expect(A.page.getByTestId('call-state')).toHaveText('Connected', { timeout: 30_000 });
  // Carol blocks Dave mid-call: the call ends for both.
  await A.page.getByRole('button', { name: 'Report or block' }).click();
  await A.page.getByRole('button', { name: 'Block only' }).click();
  await expect(A.page.getByText('Thank you.')).toBeVisible();
  await expect(B.page.getByTestId('summary-title')).toBeVisible({ timeout: 10_000 });
  // Both search again: they must not be matched with each other.
  await A.page.goto('/speaking');
  await B.page.goto('/speaking');
  await A.page.getByTestId('start-call').click();
  await B.page.getByTestId('start-call').click();
  await A.page.waitForTimeout(6000);
  await expect(A.page.getByTestId('match-status')).toContainText('Finding a speaking partner');
  await expect(B.page.getByTestId('match-status')).toContainText('Finding a speaking partner');
  await A.page.getByTestId('cancel-match').click();
  await B.page.getByTestId('cancel-match').click();
  await A.ctx.close();
  await B.ctx.close();
});

test('microphone permission denial is handled without joining the queue', async ({ browser }) => {
  const u = await registerUser('Erin');
  const { ctx, page } = await signedInPage(browser, u, { permissions: [] });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Permission denied', 'NotAllowedError');
    };
  });
  await page.goto('/speaking');
  await page.getByTestId('start-call').click();
  await expect(page.getByText('Microphone access is blocked')).toBeVisible();
  await expect(page.getByTestId('start-call')).toBeVisible();
  await ctx.close();
});
