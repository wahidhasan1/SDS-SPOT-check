// End-to-end walkthrough of the full first-time journey:
// signup → lucky wheel → voucher → search → filter → restaurant → cart → voucher → checkout → demo payment
// → confirmation → tracking → completion → order history → shopping → admin → log out / demo login.
// Usage: npm run build && npx vite preview --port 4173 & node scripts/e2e.mjs [shotsDir]
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/'
const OUT = process.argv[2] ?? '.walkthrough/e2e'
fs.mkdirSync(OUT, { recursive: true })
const VP = process.env.VP === 'desktop' ? { width: 1366, height: 900 } : { width: 390, height: 844 }

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' })
const page = await (await browser.newContext({ viewport: VP })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !/net::|Failed to load resource/.test(m.text()) && errors.push(m.text()))

let n = 0
const shot = (name) => page.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${name}.png` })
const step = (s) => console.log(`✓ ${s}`)
const go = async (r) => { await page.goto(BASE + '#' + r); await page.waitForTimeout(700) }
const see = async (t, timeout = 6000) => page.getByText(t).first().waitFor({ timeout })
const toastHas = async (t) => page.locator('[aria-live="polite"]').getByText(t).first().waitFor({ timeout: 5000 })

await go('/')
await page.evaluate(() => localStorage.clear())
if (process.env.FORCE_SPIN) {
  await go('/admin/settings')
  await page.getByLabel('Next welcome spin result').selectOption(process.env.FORCE_SPIN)
}
await go('/')
await see('What are you craving?')
await see('New here? Sign up and spin')
step('First visit: logged out, value proposition and sign-up reward visible')

// ---- Signup → welcome → lucky wheel
await page.getByRole('link', { name: /New here\? Sign up and spin/ }).click()
await see('Create your account')
await page.locator('#su-phone').fill('123')
await page.getByRole('button', { name: 'Continue' }).click()
await see('Enter your name')
await page.locator('#su-name').fill('Rahim Uddin')
await page.locator('#su-phone').fill('01999-888777')
await page.getByRole('button', { name: 'Continue' }).click()
await page.locator('#otp').fill('123456')
await page.getByRole('button', { name: 'Create account' }).click()
await see('Account created')
await see('Welcome to pikk, Rahim!')
step('Signup with validation → OTP → account created → welcome screen')
await page.getByRole('button', { name: /See the odds/ }).click()
await see('Mystery reward')
await shot('wheel')
await page.getByRole('button', { name: 'Spin the wheel' }).click()
await see('You won', 8000)
const code = (await page.locator('.font-mono').filter({ hasText: /-[A-Z0-9]{4}$/ }).first().innerText()).trim()
await see('Your voucher has been added to your account.')
await shot('reward')
step(`Lucky Wheel spun → won voucher ${code}`)
await page.getByRole('button', { name: 'Continue exploring' }).click()
await go('/account/vouchers')
await see(code)
await see('Welcome spin')
step('Voucher appears in Account → My vouchers')
await go('/welcome')
await see('You have already used your welcome spin')
step('Wheel cannot be spun twice')

// ---- Search + filter
await go('/search')
const search = page.locator('main input[aria-label="Search"]').first()
await search.fill('burger')
await see('See all results for “burger”')
await search.press('Enter')
await see('Results for “burger”')
await go('/search?q=qwertyzz')
await see('No results for “qwertyzz”')
step('Search suggestions, results and no-result state')
await go('/food')
const before = await page.getByText(/^\d+ restaurants?$/).first().innerText()
await page.getByRole('button', { name: 'Rating 4.5+' }).click()
const after = await page.getByText(/^\d+ restaurants?$/).first().innerText()
if (before === after) throw new Error('Filter did not change results')
step(`Food filter: ${before} → ${after}`)

// ---- Restaurant → cart
await go('/restaurant/r-urban-burger')
await page.getByRole('button', { name: /The Urban Smash/ }).first().click()
await page.getByLabel('Fries + Coke (250ml)').check()
await page.getByRole('button', { name: /Add to cart · ৳570/ }).click()
await toastHas('Added 1× The Urban Smash')
await page.getByRole('button', { name: 'Add Loaded Cheese Fries', exact: true }).first().click()
await toastHas('Added Loaded Cheese Fries')
step('Customised burger + fries added')
await go('/cart')
await page.getByPlaceholder('Enter code e.g. FOOD20').fill('SHOP100')
await page.getByRole('button', { name: 'Apply', exact: true }).click()
await see('only valid on shopping orders')
step('Invalid voucher explains why')
await page.getByRole('button', { name: /^Checkout · / }).click()

// ---- One-page checkout
await see('Deliver to')
await page.getByRole('button', { name: /Pay ৳/ }).last().click()
await see('Add a new address')
await page.getByPlaceholder('House 24, Flat 5B').fill('House 9, Flat 3A')
await page.getByPlaceholder('Road 11').fill('Road 2')
await page.getByRole('button', { name: 'Save address' }).click()
await see('Address saved')
step('Checkout asked for an address first; address added inline')
await page.getByRole('button', { name: /See all/ }).click()
await see('Vouchers for this order')
await see(code)
// Use the voucher won on the wheel if this cart qualifies; otherwise take the suggested best deal.
const wonRow = page.locator('[role="dialog"] div.rounded-xl').filter({ hasText: code }).first()
const wonApply = wonRow.getByRole('button', { name: 'Apply', exact: true })
const usedWon = (await wonApply.count()) > 0 && (await wonApply.isEnabled())
if (usedWon) {
  await wonApply.click()
} else {
  console.log(`  (${code} not eligible for this cart: ${await wonRow.locator('p').nth(1).innerText()})`)
  await page.keyboard.press('Escape')
  await page.locator('section').filter({ hasText: 'Voucher' }).getByRole('button', { name: 'Apply', exact: true }).click()
}
await see(/You save ৳/)
step(`${usedWon ? `Won voucher ${code}` : 'Best voucher'} applied and reflected in the total`)
await shot('checkout')
await page.getByRole('button', { name: /Pay ৳/ }).last().click()
await page.getByRole('button', { name: 'Test: low balance' }).click()
await page.locator('#gw-pin').fill('12345')
await page.getByRole('button', { name: /^Pay ৳/ }).last().click()
await see('Payment didn’t go through', 8000)
step('Simulated payment failure with clear recovery')
await page.getByRole('button', { name: 'Try again' }).click()
await page.getByRole('button', { name: 'Test: succeeds' }).click()
await page.locator('#gw-pin').fill('12345')
await page.getByRole('button', { name: /^Pay ৳/ }).last().click()
await see('Order confirmed!', 10000)
const orderId = (await page.locator('h1').first().innerText()).replace('Order #', '').trim()
step(`Demo bKash payment succeeded → ${orderId}`)
await shot('confirmed')

// ---- Tracking → completion
await page.getByRole('button', { name: '60×' }).click()
// At 60× a stage can also advance on its own, so skip until the order is delivered rather than a fixed count.
const skip = page.getByRole('button', { name: /Skip to next stage/ })
for (let i = 0; i < 6 && (await skip.count()); i++) {
  await skip.click().catch(() => undefined)
  await page.waitForTimeout(300)
}
await see('Simulation Complete')
await see('No money was charged')
await shot('complete')
step('Tracked through every stage → friendly completion state')
await go('/orders')
await page.getByRole('tab', { name: /Delivered/ }).click()
await see(orderId)
step('Order appears in history')
if (usedWon) {
  await go('/account/vouchers')
  await page.getByRole('tab', { name: /Used/ }).click()
  await see(`Used on ${orderId}`)
  step('Won voucher is now marked as used on that order')
}

// ---- Shopping flow with card failure then COD
await go('/shop?cat=shoes')
await page.getByRole('link', { name: /AirFlow Knit Runner/ }).first().click()
await page.getByRole('button', { name: 'Add to cart', exact: true }).click()
await see('Please select a size')
await page.getByRole('button', { name: '42', exact: true }).click()
await page.getByRole('button', { name: 'Add to cart', exact: true }).click()
await toastHas('Added to cart')
await go('/cart?tab=shop')
await page.getByRole('button', { name: /^Checkout · / }).click()
await page.getByRole('radio', { name: /Card/ }).click()
await page.getByRole('button', { name: 'Test: declined' }).click()
await page.getByRole('button', { name: /Pay ৳/ }).last().click()
await see('Payment didn’t go through', 8000)
await page.getByRole('button', { name: 'Change payment method' }).click()
await page.getByRole('radio', { name: /Cash on delivery/ }).click()
await page.getByRole('button', { name: /Place order · ৳/ }).last().click()
await see('Order confirmed!', 10000)
await see('Parcel delivery')
step('Fashion checkout: declined test card → switched to COD → parcel tracking')

// ---- Notifications, support, admin
await go('/notifications')
await see('Order Confirmed')
await go('/help/chat')
await page.getByRole('button', { name: 'Where is my order?' }).click()
await see('Estimated arrival', 8000)
step('Notifications and simulated support chat')
await go('/admin/vouchers')
await page.getByRole('button', { name: 'Create voucher' }).first().click()
await page.getByPlaceholder('CRAVE25').fill('E2ETEST')
await page.getByRole('button', { name: 'Create voucher' }).last().click()
await toastHas('Voucher E2ETEST created')
step('Admin: voucher created')

// ---- Log out → demo login
await go('/account')
await page.getByRole('button', { name: 'Log out' }).click()
await page.getByRole('button', { name: 'Log out' }).last().click()
await go('/login')
await page.getByRole('button', { name: /Ayesha Rahman/ }).click()
await see('What are you craving?')
step('Log out → demo account login')

await browser.close()
if (errors.length) {
  console.log('\nConsole/page errors:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nE2E walkthrough passed with no console errors.')
