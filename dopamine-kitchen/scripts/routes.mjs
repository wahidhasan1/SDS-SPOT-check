// Visits every route at mobile + desktop sizes; reports console errors, page errors and horizontal overflow.
// Usage: npm run build && npx vite preview --port 4173 & node scripts/routes.mjs [outDir]
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/'
const OUT = process.argv[2] ?? '.walkthrough'
fs.mkdirSync(OUT, { recursive: true })
const ROUTES = [
  '/', '/food', '/food?cat=kacchi', '/restaurant/r-kacchi-corner', '/restaurant/r-urban-burger?item=r-urban-burger-0', '/restaurant/r-old-dhaka',
  '/shop', '/shop?cat=shoes', '/product/p-016', '/product/p-013', '/store/b-urban-tiger', '/search', '/search?q=kacchi', '/search?q=zzzz',
  '/offers', '/cart', '/orders', '/orders/DK-10440', '/orders/DK-10439', '/orders/DK-10434', '/favorites', '/account', '/account/profile',
  '/account/addresses', '/account/payments', '/account/settings', '/notifications', '/help', '/help/chat', '/login', '/admin', '/admin/orders',
  '/admin/restaurants', '/admin/menu', '/admin/products', '/admin/vouchers', '/admin/users', '/admin/settings', '/nope',
]
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' })
const problems = []
for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1366, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror on ${page.url()}: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return
    const t = m.text()
    if (/ERR_TUNNEL|ERR_CONNECTION|ERR_NAME|Failed to load resource|net::/.test(t)) return // external images/fonts blocked in sandbox
    problems.push(`[${name}] console.${m.type()} on ${page.url()}: ${t.slice(0, 300)}`)
  })
  for (const r of ROUTES) {
    await page.goto(BASE + '#' + r, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1100)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    if (overflow > 1) problems.push(`[${name}] horizontal overflow ${overflow}px on ${r}`)
    const empty = await page.evaluate(() => (document.querySelector('main')?.innerText ?? document.body.innerText).trim().length)
    if (empty < 20) problems.push(`[${name}] near-empty page on ${r}`)
    const file = `${OUT}/${name}-${r.replace(/[^\w]+/g, '_') || 'home'}.png`
    await page.screenshot({ path: file, fullPage: false })
  }
  await ctx.close()
}
await browser.close()
console.log(problems.length ? problems.join('\n') : 'No problems found')
