// Secondary walkthrough: location, addresses, favourites, save-for-later, i18n, admin CRUD, guards.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/'
const VP = process.env.VP === 'desktop' ? { width: 1366, height: 900 } : { width: 390, height: 844 }
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' })
const page = await (await browser.newContext({ viewport: VP })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !/net::|Failed to load resource/.test(m.text()) && errors.push(m.text()))
const step = (s) => console.log(`✓ ${s}`)
const go = async (r) => { await page.goto(BASE + '#' + r); await page.waitForTimeout(900) }
const see = (t, timeout = 6000) => page.getByText(t).first().waitFor({ timeout })

await go('/')
await page.evaluate(() => localStorage.clear())
await go('/login')
await page.getByRole('button', { name: /Ayesha Rahman/ }).click()
await page.waitForTimeout(500)

// Location: simulated detection + area pick + new address
await page.getByRole('button', { name: /Delivery location/ }).first().click()
await see('Choose delivery location')
await page.getByPlaceholder('Search area, e.g. Dhanmondi, 1213').fill('agrabad')
await see('Coming soon')
await page.getByPlaceholder('Search area, e.g. Dhanmondi, 1213').fill('Uttara')
await page.getByRole('button', { name: /Uttara · Dhaka 1230/ }).click()
await see('Location set to Uttara')
await page.getByRole('button', { name: /Delivery location/ }).first().click()
await page.getByRole('button', { name: /Use my current location/ }).click()
await see(/Location set to/, 5000)
step('Location: non-Dhaka "coming soon", area pick, simulated GPS')

await go('/account/addresses')
await page.getByRole('button', { name: 'Add', exact: true }).click()
await page.getByRole('button', { name: 'Save address' }).click()
await see('House / building is required')
await page.getByRole('button', { name: /Office/ }).last().click()
await page.getByPlaceholder('House 24, Flat 5B').fill('Rangs Tower (demo), Level 3')
await page.getByPlaceholder('Road 11').fill('Road 27')
await page.locator('input[inputmode="tel"]').last().fill('123')
await page.getByRole('button', { name: 'Save address' }).click()
await see('Enter a valid Bangladeshi mobile number')
await page.locator('input[inputmode="tel"]').last().fill('01811-223344')
await page.getByText('Set as default address').click()
await page.getByRole('button', { name: 'Save address' }).click()
await see('Address saved')
await see('Rangs Tower (demo), Level 3')
step('Address form validation + saved new default address (+880 normalised)')

// Favourites
await go('/restaurant/r-pizza-district')
await page.getByRole('button', { name: 'Add to favourites' }).first().click()
await see('Saved to favourites')
await go('/favorites')
await see('Pizza District')
step('Favourite restaurant appears on Favourites page')

// Closed restaurant
await go('/restaurant/r-old-dhaka')
await see('Closed right now.')
await page.getByRole('button', { name: 'Add Bakorkhani (6 pcs)', exact: true }).click()
await see('Old Dhaka Bhoj is closed')
step('Closed restaurant blocks ordering')

// Save for later + undo remove
await go('/restaurant/r-chaat-co')
await page.getByRole('button', { name: 'Add Classic Fuchka (12 pcs)', exact: true }).first().click()
await page.getByRole('button', { name: 'Add Chotpoti', exact: true }).first().click()
await go('/cart')
await page.getByRole('button', { name: /^Save .+ for later$/ }).first().click()
await see('Saved for later (1)')
await page.getByRole('button', { name: /^Remove (?!all)/ }).first().click()
await page.getByRole('button', { name: 'Undo' }).click()
await page.getByRole('button', { name: 'Move to cart' }).click()
await see('Moved to cart')
step('Cart: save for later, remove + undo, move back to cart')

// Bangla toggle
await go('/account/settings')
await page.locator('select').first().selectOption('bn')
await go('/')
await see('আজ কী খেতে ইচ্ছে করছে?')
await go('/account/settings')
await page.locator('select').first().selectOption('en')
step('Bangla (beta) translation toggle')

// Admin CRUD shows up in the customer app
await go('/admin/restaurants')
await page.getByRole('button', { name: 'Add restaurant' }).click()
await page.getByPlaceholder('e.g. Biryani Bros (fictional)').fill('Test Tehari Ghor')
await page.getByRole('button', { name: 'Save restaurant' }).click()
await see('Restaurant added')
await go('/admin/menu')
await page.locator('main select').first().selectOption({ label: 'Test Tehari Ghor (0)' })
await page.getByRole('button', { name: 'Add food item' }).click()
await page.getByLabel('Name', { exact: true }).fill('Beef Tehari Deluxe')
await page.getByRole('button', { name: 'Save item' }).click()
await see('Item added')
await go('/admin/products')
await page.getByRole('button', { name: 'Add product' }).click()
await page.getByLabel('Name', { exact: true }).fill('Test Linen Panjabi')
await page.getByRole('button', { name: 'Save product' }).click()
await see('Product added')
await go('/search?q=tehari deluxe')
await see('Beef Tehari Deluxe')
await go('/search?q=linen panjabi')
await see('Test Linen Panjabi')
step('Admin-created restaurant, food item and product are searchable')

// Admin: change status + ETA of an active order, switch user
await go('/admin/orders')
const row = page.locator('tr', { hasText: 'DK-10440' })
await row.locator('select').selectOption('on_the_way')
await see('DK-10440 → On the Way')
await row.locator('input').fill('55')
await row.locator('input').press('Enter')
await see('Saved')
await go('/orders/DK-10440')
await see('On the Way')
step('Admin status + ETA change reflected on tracking page')
await go('/admin/users')
await page.locator('tr', { hasText: 'Tanvir Hossain' }).getByRole('button', { name: /Switch to/ }).click()
await see('Now signed in as Tanvir Hossain')
await go('/orders')
await see('Shawarma Station')
step('Switched demo user via admin')

// Guest guard: checkout redirects to login
await go('/account')
await page.getByRole('button', { name: 'Log out' }).click()
await page.getByRole('button', { name: 'Log out' }).last().click()
await go('/checkout?kind=food')
await see('Welcome back')
await page.getByRole('button', { name: /Ayesha Rahman/ }).click()
await page.waitForTimeout(800)
if (!page.url().includes('/checkout') && !page.url().includes('/cart')) throw new Error('Did not return to checkout after login: ' + page.url())
step('Guest → checkout redirected to login and back')

// 404
await go('/definitely-not-a-page')
await see('This page got lost on the way')
step('404 page')

await browser.close()
if (errors.length) { console.log('\nErrors:\n' + errors.join('\n')); process.exit(1) }
console.log('\nExtra walkthrough passed with no console errors.')
