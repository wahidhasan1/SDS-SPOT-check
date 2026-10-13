import { chromium, expect, test, type Browser, type Page } from '@playwright/test';
import path from 'node:path';
import { signUpInContext } from './helpers';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const fixture = (f: string) => path.join(__dirname, 'fixtures', f);

/** Launch an isolated browser whose fake microphone plays a pure tone. */
async function browserWithTone(file: string) {
  return chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${fixture(file)}`, '--autoplay-policy=no-user-gesture-required'],
  });
}

/** Dominant frequency (Hz) and RMS level of the audio received from the partner. */
async function analyseRemote(page: Page) {
  return page.evaluate(async () => {
    const el = document.querySelector('audio[data-remote-audio]') as HTMLAudioElement;
    const stream = el.srcObject as MediaStream;
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 8192;
    src.connect(an);
    const freq = new Float32Array(an.frequencyBinCount);
    const time = new Float32Array(an.fftSize);
    let best = { hz: 0, db: -Infinity };
    let rms = 0;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 150));
      an.getFloatFrequencyData(freq);
      an.getFloatTimeDomainData(time);
      rms = Math.max(rms, Math.sqrt(time.reduce((a, v) => a + v * v, 0) / time.length));
      freq.forEach((db, bin) => {
        if (db > best.db) best = { hz: (bin * ctx.sampleRate) / an.fftSize, db };
      });
    }
    await ctx.close();
    return { hz: Math.round(best.hz), rms, tracks: stream.getAudioTracks().length };
  });
}

test.describe('anonymous voice calls between two real accounts', () => {
  let b1: Browser;
  let b2: Browser;
  test.afterAll(async () => {
    await b1?.close();
    await b2?.close();
  });

  test('two users find each other, hear each other, mute/unmute, survive a reload and end the call', async () => {
    b1 = await browserWithTone('tone-440.wav');
    b2 = await browserWithTone('tone-1000.wav');
    const c1 = await b1.newContext({ baseURL: BASE, permissions: ['microphone'] });
    const c2 = await b2.newContext({ baseURL: BASE, permissions: ['microphone'] });
    await signUpInContext(c1, 'Caller One');
    await signUpInContext(c2, 'Caller Two');
    const p1 = await c1.newPage();
    const p2 = await c2.newPage();

    for (const p of [p1, p2]) {
      await p.goto('/speak');
      await expect(p.getByText('Connected', { exact: true })).toBeVisible();
      await p.getByLabel('Topic').selectOption('travel');
    }
    await p1.getByRole('button', { name: 'Find a partner' }).click();
    await expect(p1.getByText('Looking for a partner…')).toBeVisible();
    await p2.getByRole('button', { name: 'Find a partner' }).click();

    // Both see an anonymous match and accept it.
    await expect(p1.getByText('Partner found')).toBeVisible();
    await expect(p2.getByText('Partner found')).toBeVisible();
    const alias1 = await p2.locator('h2.text-2xl').innerText(); // what user 2 sees for user 1
    expect(alias1).not.toContain('Caller');
    await p1.getByRole('button', { name: /^Accept/ }).click();
    await p2.getByRole('button', { name: /^Accept/ }).click();

    // Audio connects and the call timer runs.
    await expect(p1.getByRole('button', { name: 'End call' })).toBeVisible({ timeout: 30_000 });
    await expect(p1.locator('p.font-mono')).toBeVisible({ timeout: 30_000 });
    await expect(p2.locator('p.font-mono')).toBeVisible({ timeout: 30_000 });
    await p1.waitForTimeout(1500);

    // Each side receives the OTHER side's microphone tone.
    const heardBy1 = await analyseRemote(p1);
    const heardBy2 = await analyseRemote(p2);
    console.log('user 1 hears', heardBy1, '| user 2 hears', heardBy2);
    expect(heardBy1.tracks).toBe(1);
    expect(Math.abs(heardBy1.hz - 1000)).toBeLessThan(30);
    expect(Math.abs(heardBy2.hz - 440)).toBeLessThan(30);
    expect(heardBy1.rms).toBeGreaterThan(0.005);

    // Mute: partner is told, and the audio actually stops.
    await p1.getByRole('button', { name: 'Mute' }).click();
    await expect(p2.getByText('Partner muted')).toBeVisible();
    await p2.waitForTimeout(800);
    const muted = await analyseRemote(p2);
    console.log('user 2 hears while user 1 is muted', muted);
    expect(muted.rms).toBeLessThan(0.005);
    await p1.getByRole('button', { name: 'Unmute' }).click();
    await expect(p2.getByText('Partner muted')).toBeHidden();
    await p2.waitForTimeout(2000);
    const unmuted = await analyseRemote(p2);
    console.log('user 2 hears after unmute', unmuted);
    expect(Math.abs(unmuted.hz - 440)).toBeLessThan(30);
    expect(unmuted.rms).toBeGreaterThan(muted.rms * 5);

    // Reload: user 2 drops, user 1 sees "reconnecting", user 2 rejoins and audio flows again.
    await p2.reload();
    await expect(p2.locator('p.font-mono')).toBeVisible({ timeout: 30_000 });
    await p2.waitForTimeout(1500);
    const afterRejoin = await analyseRemote(p2);
    console.log('user 2 hears after rejoining', afterRejoin);
    expect(Math.abs(afterRejoin.hz - 440)).toBeLessThan(30);

    // End the call: both see the summary; history shows aliases only.
    await p1.getByRole('button', { name: 'End call' }).click();
    await expect(p1.getByText('Call ended')).toBeVisible();
    await expect(p2.getByText('Call ended')).toBeVisible();
    const hist = await (await c2.request.get('/api/calls/history')).json();
    expect(hist.calls[0].status).toBe('ended');
    expect(hist.calls[0].durationSec).toBeGreaterThan(0);
    expect(hist.calls[0].partnerAlias).toBe(alias1);
    expect(JSON.stringify(hist)).not.toContain('Caller One');
  });

  test('a partner who disconnects and does not return ends the call after the grace period', async () => {
    const bA = await browserWithTone('tone-440.wav');
    const bB = await browserWithTone('tone-1000.wav');
    try {
      const cA = await bA.newContext({ baseURL: BASE, permissions: ['microphone'] });
      const cB = await bB.newContext({ baseURL: BASE, permissions: ['microphone'] });
      await signUpInContext(cA, 'Drop A');
      await signUpInContext(cB, 'Drop B');
      const pA = await cA.newPage();
      const pB = await cB.newPage();
      for (const p of [pA, pB]) {
        await p.goto('/speak');
        await expect(p.getByText('Connected', { exact: true })).toBeVisible();
        await p.locator('button', { hasText: 'Friendly debate' }).click();
      }
      await pA.getByRole('button', { name: 'Find a partner' }).click();
      await pB.getByRole('button', { name: 'Find a partner' }).click();
      await pA.getByRole('button', { name: /^Accept/ }).click();
      await pB.getByRole('button', { name: /^Accept/ }).click();
      await expect(pA.locator('p.font-mono')).toBeVisible({ timeout: 30_000 });
      await cB.close(); // partner's browser goes away
      await expect(pA.getByText('Partner reconnecting…')).toBeVisible({ timeout: 10_000 });
      await expect(pA.getByText('Call ended')).toBeVisible({ timeout: 40_000 });
      await expect(pA.getByText('Your partner lost their connection')).toBeVisible();
    } finally {
      await bA.close();
      await bB.close();
    }
  });
});
