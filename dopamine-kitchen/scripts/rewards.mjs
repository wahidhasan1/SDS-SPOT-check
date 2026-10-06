// Forces every Lucky Wheel outcome (via the demo control panel) and verifies, for each one:
// the reward shown, the voucher in My vouchers, the exact discount at checkout, and single-use marking.
// Usage: preview server on :4173, then `node scripts/rewards.mjs`
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/'
const SEGMENTS = [
  { id: 'p5', type: 'percent', value: 5, max: 50, scope: 'all', headline: /^5% OFF$/ },
  { id: 'p10', type: 'percent', value: 10, max: 80, scope: 'all', headline: /^10% OFF$/ },
  { id: 'free', type: 'free', scope: 'all', headline: /^Free delivery$/ },
  { id: 'p15', type: 'percent', value: 15, max: 120, scope: 'food', headline: /^15% OFF food$/ },
  { id: 'p20', type: 'percent', value: 20, max: 150, scope: 'all', headline: /^20% OFF$/ },
  { id: 'mystery', type: 'flat', scope: 'all', headline: /^৳(100|150|200) OFF$/ },
  { id: 'p25', type: 'percent', value: 25, max: 300, scope: 'shop', headline: /^25% OFF fashion$/ },
  { id: 'p30', type: 'percent', value: 30, max: 200, scope: 'food', headline: /^30% OFF food$/ },
]
const num = (t) => Number(t.replace(/[^\d]/g, ''))

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' })
let failures = 0
for (const [i, seg] of SEGMENTS.entries()) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const go = async (r) => { await page.goto(BASE + '#' + r); await page.waitForTimeout(500) }
  const see = (t, timeout = 6000) => page.getByText(t).first().waitFor({ timeout })
  try {
    await go('/')
    await page.evaluate(() => localStorage.clear())
    await go('/admin/settings')
    await page.getByLabel('Next welcome spin result').selectOption(seg.id)
    await go('/login?mode=signup')
    await page.locator('#su-name').fill(`Tester ${i}`)
    await page.locator('#su-phone').fill(`0199900010${i}`)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.locator('#otp').fill('123456')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.getByRole('button', { name: 'Spin the wheel' }).click()
    await see('You won', 8000)
    const headline = (await page.locator('[role="dialog"] p.text-4xl').innerText()).trim()
    if (!seg.headline.test(headline)) throw new Error(`headline "${headline}"`)
    const code = (await page.locator('[role="dialog"] .font-mono').first().innerText()).trim()
    await page.getByRole('button', { name: 'Continue exploring' }).click()

    const kind = seg.scope === 'shop' ? 'shop' : 'food'
    if (kind === 'food') {
      await go('/restaurant/r-kacchi-corner')
      await page.getByRole('button', { name: 'Add Kacchi Family Pack (4 persons)', exact: true }).first().click()
    } else {
      await go('/product/p-032')
      await page.getByRole('button', { name: '42', exact: true }).click()
      await page.getByRole('button', { name: 'Add to cart', exact: true }).click()
    }
    await go(`/checkout?kind=${kind}`)
    await page.getByRole('button', { name: /Pay ৳/ }).last().click()
    await page.getByPlaceholder('House 24, Flat 5B').fill('House 1')
    await page.getByPlaceholder('Road 11').fill('Road 1')
    await page.getByRole('button', { name: 'Save address' }).click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: /See all|Change/ }).last().click()
    await page.locator('[role="dialog"] div.rounded-xl').filter({ hasText: code }).first().getByRole('button', { name: 'Apply', exact: true }).click()
    await see(/You save ৳/)
    const aside = page.locator('aside')
    const subtotal = num(await aside.getByText('Subtotal').locator('xpath=following-sibling::*[1]').innerText())
    const feeText = await aside.getByText(/^Delivery/).locator('xpath=following-sibling::*[1]').innerText()
    const fee = feeText === 'Free' ? 0 : num(feeText)
    const saved = num(await page.getByText(/You save ৳/).first().innerText())
    const expected = seg.type === 'percent' ? Math.min(Math.round((subtotal * seg.value) / 100), seg.max) : seg.type === 'free' ? fee : num(headline)
    if (saved !== expected) throw new Error(`discount ${saved}, expected ${expected} (subtotal ${subtotal}, fee ${fee})`)
    await page.getByRole('radio', { name: /Cash on delivery/ }).click()
    await page.getByRole('button', { name: /Place order · ৳/ }).last().click()
    await see('Order confirmed!', 10000)
    const orderId = (await page.locator('h1').first().innerText()).replace('Order #', '').trim()
    await go('/account/vouchers')
    await page.getByRole('tab', { name: /Used/ }).click()
    await see(`Used on ${orderId}`)
    if (errors.length) throw new Error(errors.join('; '))
    console.log(`✓ ${seg.id.padEnd(8)} ${headline.padEnd(16)} ${code.padEnd(15)} saved ৳${saved} on ৳${subtotal} (${kind}), marked used on ${orderId}`)
  } catch (e) {
    failures++
    console.log(`✗ ${seg.id}: ${e.message.split('\n')[0]}`)
    await page.screenshot({ path: `/tmp/rewards-fail-${seg.id}.png` }).catch(() => undefined)
  }
  await page.close()
}
await browser.close()
if (failures) process.exit(1)
console.log('\nAll wheel outcomes verified.')
