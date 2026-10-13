// Home, profile, plan upgrade (development test provider), live battle between two browsers,
// Read with AI (real OCR of an uploaded photo), admin console and notifications — through the real UI.
//
// Usage: npx tsx scripts/e2e/platform.e2e.ts [screenshot-dir]   (needs `npx vite build`)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import type { Page } from 'playwright'
import { createUser, launch, startServer, step } from './harness.ts'

const OUT = process.argv[2]
const shot = async (page: Page, name: string, fullPage = false) => {
  if (!OUT) return
  fs.mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage })
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-plat-'))

// A "photo" of a printed paragraph for the OCR test.
const font = ['/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'].find((f) => fs.existsSync(f))
const photo = path.join(tmp, 'page.png')
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0xf4efe4:s=1600x500', '-frames:v', '1', '-vf', ['Many students borrow books from the library', 'because they cannot afford to buy them.', 'Reading every day helps them break the ice in class.'].map((l, i) => `drawtext=${font ? `fontfile=${font}:` : ''}text='${l}':fontcolor=0x222222:fontsize=48:x=60:y=${90 + i * 110}`).join(','), photo])

const server = await startServer({ env: { TEST_PAYMENTS: 'true' } })
const bA = await launch()
const bB = await launch()
let failed = false
try {
  const A = await createUser(bA, server, { name: 'Amira', viewport: { width: 1280, height: 860 } })
  const B = await createUser(bB, server, { name: 'Bao', viewport: { width: 390, height: 844 } })
  const pa = A.page
  const pb = B.page
  const confirm = (p: Page, name: string) => p.getByRole('dialog').getByRole('button', { name, exact: true }).click()

  // ---------------------------------------------------------------- home
  await pa.goto('/')
  await pa.getByRole('heading', { name: 'Find a speaking partner' }).waitFor()
  await pa.getByText('3 calls left today').waitFor()
  await shot(pa, 'p1-home', true)
  await pb.goto('/')
  await pb.getByRole('heading', { name: 'Find a speaking partner' }).waitFor()
  await shot(pb, 'p1-home-mobile', true)
  step('home shows real allowances and queue state')

  // ---------------------------------------------------------------- plan: free → test checkout → premium
  await pa.goto('/account/plan')
  await pa.getByText('Current plan').waitFor()
  await shot(pa, 'p2-plan-free', true)
  await pa.getByRole('button', { name: 'Upgrade to Premium' }).click()
  await pa.waitForURL(/test-checkout/)
  await pa.getByText('TEST MODE — no real payment.').waitFor()
  await shot(pa, 'p3-test-checkout')
  await pa.getByLabel('Test card number').fill('4242 4242 4242 4242')
  await pa.getByRole('button', { name: /Activate test Premium/ }).click()
  await pa.waitForURL(/\/account\/plan$/)
  await pa.getByText('Test subscription (development mode, no money moved)').waitFor()
  const me = await (await pa.request.get('/api/me')).json()
  if (me.plan.planId !== 'premium' || me.plan.limits.battlesPerDay !== -1) throw new Error('premium not applied on the server')
  await shot(pa, 'p4-plan-premium', true)
  await pa.getByRole('button', { name: 'Cancel test subscription' }).click()
  await confirm(pa, 'Cancel subscription')
  await pa.getByText(/ends \d/).waitFor()
  step('test-mode upgrade grants Premium on the server; cancel keeps access until period end')

  // ---------------------------------------------------------------- notifications
  await pa.goto('/notifications')
  await pa.getByText('Premium is active').waitFor()
  await shot(pa, 'p5-notifications')
  step('notification stored and shown')

  // ---------------------------------------------------------------- profile & privacy
  await pa.goto('/profile')
  await pa.getByText('In calls you appear as').waitFor()
  await shot(pa, 'p6-profile', true)
  await pa.goto('/profile/privacy')
  const lb = pa.getByRole('switch', { name: /leaderboard/ })
  await lb.waitFor({ state: 'attached' })
  await shot(pa, 'p7-privacy', true)
  step('profile and privacy pages render')

  // ---------------------------------------------------------------- live battle between two browsers
  await pa.goto('/battles')
  await pb.goto('/battles')
  await pa.getByRole('button', { name: 'Find an opponent' }).click()
  await pa.getByText('Finding an opponent…').waitFor()
  await shot(pa, 'p8-battle-queue')
  await pb.getByRole('button', { name: 'Find an opponent' }).click()
  await pa.getByText('Get ready!').or(pa.getByText(/Question 1 of/)).first().waitFor({ timeout: 10_000 })
  step('two learners matched into a live battle')
  let shotTaken = false
  for (let round = 0; round < 7; round++) {
    for (const p of [pa, pb]) {
      await p.getByText(`Question ${round + 1} of 7`).waitFor({ timeout: 25_000 })
      const opts = p.locator('button.min-h-12:not([disabled])')
      await opts.first().waitFor({ timeout: 20_000 })
      if (!shotTaken && p === pa) {
        await shot(pa, 'p9-battle-question')
        shotTaken = true
      }
      await opts.nth(round % 2).click()
    }
  }
  await pa.getByText(/You won!|You lost|It’s a draw/).waitFor({ timeout: 30_000 })
  await pb.getByText(/You won!|You lost|It’s a draw/).waitFor({ timeout: 30_000 })
  await shot(pa, 'p10-battle-result')
  const ra = await (await pa.request.get('/api/battles/status')).json()
  if (ra.rating.games !== 1) throw new Error('rating not updated')
  step(`7-question live battle finished on both devices; server rating now ${ra.rating.rating}`)

  // ---------------------------------------------------------------- read with AI
  await pa.goto('/read')
  await pa.locator('input[type=file][accept^="image/jpeg"]').setInputFiles(photo)
  await pa.getByRole('button', { name: 'Read text' }).click()
  await pa.waitForURL(/\/read\/rd_/, { timeout: 60_000 })
  await pa.getByText('Tap any word').waitFor()
  await pa.getByRole('button', { name: 'borrow', exact: true }).click()
  await pa.getByText('In this sentence').waitFor()
  await shot(pa, 'p11-read-word')
  await pa.keyboard.press('Escape')
  await pa.getByRole('button', { name: 'ice', exact: true }).click()
  await pa.getByRole('dialog').getByText(/break the ice/i).first().waitFor()
  await pa.getByRole('dialog').getByRole('button', { name: /^Save/ }).click()
  await pa.getByText(/Saved “break the ice”/).waitFor()
  await shot(pa, 'p12-read-idiom')
  step('photo → OCR text → tap word for contextual meaning → idiom detected → saved')

  // ---------------------------------------------------------------- admin
  const db = new DatabaseSync(server.dbPath)
  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(A.email)
  db.close()
  await pa.goto('/admin')
  await pa.getByText('Active learners per day').waitFor()
  await shot(pa, 'p13-admin', true)
  await pa.goto('/admin/plans')
  const calls = pa.locator('label', { hasText: 'Voice calls per day' }).first().locator('input')
  await calls.fill('4')
  await pa.getByRole('button', { name: 'Save Free' }).click()
  await pa.getByText('Plan saved').waitFor()
  const cs = await (await pb.request.get('/api/calls/status')).json()
  if (cs.callsLimit !== 4) throw new Error(`limit not applied: ${cs.callsLimit}`)
  await pa.goto('/admin/audit')
  await pa.getByText('plan.update').waitFor()
  await shot(pa, 'p14-admin-audit')
  const forbidden = await pb.request.get('/api/admin/overview')
  if (forbidden.status() !== 403) throw new Error('non-admin reached admin API')
  step('admin edits plan limits (enforced immediately, audited); non-admins get 403')

  for (const u of [A, B]) if (u.errors.length) throw new Error(`page errors: ${u.errors.join(' | ')}`)
  step('no page errors')
} catch (e) {
  failed = true
  console.error('✗', e)
  console.error(server.logs.slice(-30).join(''))
} finally {
  await bA.close()
  await bB.close()
  await server.stop()
  fs.rmSync(tmp, { recursive: true, force: true })
}
process.exit(failed ? 1 : 0)
