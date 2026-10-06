// Checks the brief's measurable data requirements against the live seeded app state.
// Usage: preview server on :4173, then `node scripts/requirements.mjs`
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/'
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
await page.goto(BASE)
await page.evaluate(() => localStorage.clear())
await page.goto(BASE + '#/restaurant/r-kacchi-corner') // any change triggers the (batched) save
await page.waitForTimeout(1500)
const r = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('dopamine-kitchen-v1') ?? 'null')?.state
  return s && {
    db: s.db, recent: s.recentlyViewed.length,
  }
})
if (!r) throw new Error('No persisted state found')
const { db } = r
const checks = []
const check = (label, ok, detail = '') => checks.push([ok, label, detail])
const statuses = new Set(db.orders.map((o) => o.status))
check('≥10 restaurants', db.restaurants.length >= 10, db.restaurants.length)
check('≥100 food items', db.menu.length >= 100, db.menu.length)
check('≥30 shopping products', db.products.length >= 30, db.products.length)
check('every product has ≥2 images', db.products.every((p) => p.images.length >= 2), db.products.filter((p) => p.images.length < 2).map((p) => p.name).join(', '))
check('every product has sizes and colours', db.products.every((p) => p.sizes.length && p.colors.length))
check('multiple size/colour options exist', db.products.filter((p) => p.sizes.length > 1 && p.colors.length > 1).length >= 20)
check('every dish has an image', db.menu.every((m) => m.image))
check('restaurants: open and closed', db.restaurants.some((x) => x.isOpen) && db.restaurants.some((x) => !x.isOpen))
check('vouchers WELCOME50/FOOD20/SHOP100/FIRSTORDER', ['WELCOME50', 'FOOD20', 'SHOP100', 'FIRSTORDER'].every((c) => db.vouchers.some((v) => v.code === c)))
check('≥3 demo users', db.users.length >= 3, db.users.length)
check('multiple addresses (Home + Office)', db.addresses.length >= 3 && db.addresses.some((a) => a.label === 'Home') && db.addresses.some((a) => a.label === 'Office'), db.addresses.length)
check('+880 phone numbers', [...db.users, ...db.addresses].every((x) => /^\+8801\d{9}$/.test(x.phone)))
check('orders cover active, delivered and cancelled', ['delivered', 'cancelled'].every((s) => statuses.has(s)) && [...statuses].some((s) => s !== 'delivered' && s !== 'cancelled'), [...statuses].join(', '))
check('all orders marked as test orders', db.orders.every((o) => o.isTest))
check('recently viewed is seeded', r.recent > 0, r.recent)
await browser.close()
for (const [ok, label, detail] of checks) console.log(`${ok ? '✓' : '✗'} ${label}${detail !== '' ? ` (${detail})` : ''}`)
if (checks.some(([ok]) => !ok)) process.exit(1)
