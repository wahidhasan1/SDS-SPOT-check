import { chromium } from '@playwright/test';
import { registerUser } from '../helpers.ts';
const OUT = process.env.OUT_DIR ?? 'test-results/screenshots';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });
const u = await registerUser('Shot');
await fetch('http://localhost:4000/me', { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + u.accessToken }, body: JSON.stringify({ testType: 'academic', targetBand: 7 }) });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const pages = ['/', '/speaking', '/ielts', '/ielts/reading', '/ielts/listening', '/ielts/writing', '/ielts/writing/acad-t1-bar-internet', '/ielts/writing/acad-t1-line-museums', '/ielts/speaking', '/ielts/mock', '/vocabulary', '/grammar', '/grammar/passive-voice', '/battles', '/read', '/profile', '/progress', '/subscription', '/notifications', '/assessment'];
for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]] as const) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript((t) => localStorage.setItem('fp.tokens', JSON.stringify(t)), { accessToken: u.accessToken, refreshToken: u.refreshToken });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`${page.url()} ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${page.url()} console: ${m.text()}`));
  for (const p of (label === 'desktop' ? pages : ['/', '/ielts/reading', '/speaking', '/vocabulary', '/battles'])) {
    await page.goto('http://localhost:5173' + p);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${label}${p.replace(/\//g, '_') || '_home'}.png`, fullPage: label === 'desktop' ? false : true });
  }
  console.log(label, 'errors:', errors.length ? errors : 'none');
  await ctx.close();
}
await browser.close();
