// Screenshots of the calling flow for visual review.
import { createUser, launch, startServer } from './harness.ts'
const OUT = process.argv[2] ?? '.e2e/shots'
const server = await startServer()
const bA = await launch(); const bB = await launch()
try {
  const A = await createUser(bA, server, { name: 'Alice', viewport: { width: 390, height: 844 } })
  const B = await createUser(bB, server, { name: 'Bob' })
  await A.page.goto('/speak'); await A.page.waitForTimeout(800); await A.page.screenshot({ path: `${OUT}/c1-hub.png` })
  await A.page.goto('/speak/call'); await A.page.waitForTimeout(800); await A.page.screenshot({ path: `${OUT}/c2-setup.png`, fullPage: true })
  await A.page.getByText('I’ll follow the').click(); await A.page.getByRole('button', { name: 'Start call' }).click()
  await A.page.getByText('Finding your speaking partner…').waitFor(); await A.page.waitForTimeout(1500); await A.page.screenshot({ path: `${OUT}/c3-matching.png` })
  await B.page.goto('/speak/call'); await B.page.getByText('I’ll follow the').click(); await B.page.getByRole('button', { name: 'Start call' }).click()
  await A.page.getByText('Connected', { exact: true }).waitFor({ timeout: 30000 }); await A.page.waitForTimeout(2500); await A.page.screenshot({ path: `${OUT}/c4-call.png` })
  await A.page.getByRole('button', { name: 'Mute microphone' }).click(); await A.page.waitForTimeout(400); await A.page.screenshot({ path: `${OUT}/c5-muted.png` })
  await A.page.getByRole('button', { name: 'Report or block' }).click(); await A.page.waitForTimeout(400); await A.page.screenshot({ path: `${OUT}/c6-report.png` })
  await A.page.keyboard.press('Escape')
  await A.page.getByRole('button', { name: 'End call' }).click(); await A.page.getByTestId('end-reason').waitFor(); await A.page.waitForTimeout(500); await A.page.screenshot({ path: `${OUT}/c7-summary.png`, fullPage: true })
  await A.page.evaluate(() => document.documentElement.dataset.theme = 'dark'); await A.page.screenshot({ path: `${OUT}/c8-summary-dark.png` })
} finally { await bA.close(); await bB.close(); await server.stop() }
