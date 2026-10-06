# Dopamine Kitchen

**Feed the craving. Skip the delivery.**

Dopamine Kitchen is a craving-reduction **simulation** for Bangladeshi consumers. Users browse realistic food and fashion catalogs, add to cart, apply vouchers, check out with a *demo* payment flow, then track a simulated rider until the order is "delivered". The full dopamine loop happens, but no money is spent and nothing arrives.

> ⚠️ **Everything is simulated.** No real payments, orders or deliveries. All restaurants, brands, riders and users are fictional. The demo payment gateway accepts only published test credentials and rejects anything that looks like a real wallet or card.

## Run it

```bash
cd dopamine-kitchen
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/ (HashRouter + relative base, so it can be hosted anywhere)
```

## Demo credentials

| What | Value |
|---|---|
| Login OTP | `123456` (or pick a demo user on the login screen) |
| bKash / Nagad wallet | `01700000000` / `01800000000` → success · `01700000001` → insufficient balance |
| Wallet OTP / PIN | `123456` / `12345` |
| Cards | `4242 4242 4242 4242`, `5555 5555 5555 4444` → success · `4000 0000 0000 0002` → declined · `4000 0000 0000 9995` → insufficient funds (any future expiry, any CVC, 3-D Secure OTP `123456`) |
| Vouchers | `WELCOME50`, `FIRSTORDER` (first order only), `FOOD20`, `SHOP100`, `FREEDEL`, `STYLE15`, `CAFE100`, `MIDNIGHT30`, `EID25` (expired) |

The default signed-in account is **Ayesha Rahman** (admin). The **Demo Control Panel** is at `#/admin`.

## Simulation

* Food orders target **~30 minutes**; shopping targets **within 1 day** (express: 6 hours).
* Stages: Order Confirmed → Preparing/Packing → Picked Up → On the Way → Delivered → *"Simulation Complete — No real product was delivered."*
* Progress is derived from the clock (nothing is written every second) and continues while the tab is closed. On the tracking screen (or in Settings) you can switch between **Real-time, 10× and 60×** speed, or **skip to the next stage**. Admins can set any status or ETA.
* Optional craving check-ins before ordering and after "delivery" show whether the urge eased.

## Architecture

* **React 19 + TypeScript + Vite**, **Tailwind CSS v4** design tokens (`src/index.css`), **Zustand** store persisted to `localStorage`, **lucide-react** icons.
* `src/data/` holds the typed data model (`types.ts`) and seed data: 14 restaurants, 158 dishes, 10 brands, 61 products, 9 vouchers, 5 users, 8 addresses and 18 orders covering every status. The modules are plain JSON-shaped arrays, so they can be swapped for authorised partner data or an API later.
* `src/store/store.ts` holds all app state and actions (cart, vouchers, orders, the simulation ticker, favourites, notifications and admin CRUD).
* `src/lib/` contains pricing (delivery fee/ETA from area distance, voucher rules), the order simulation, search, deterministic review generation and formatting (BDT, +880 phone numbers).
* `src/i18n/` has English strings plus a Bangla (beta) dictionary; missing keys fall back to English.
* **Photos are bundled with the app** (`public/img`, about 300 compressed WebP files, ~7 MB, lazy-loaded), so they load quickly and work on any host, including ones that block third-party images. Sources and licences are in [`public/img/CREDITS.md`](public/img/CREDITS.md). The food photos come from a community placeholder dataset whose original sources are unclear, so replace them with licensed photography before any public launch. If a photo is missing, `<Img>` renders a generated illustration.

## Requirements coverage

| # | Brief section | Where it lives |
|---|---|---|
| 1 | Landing page | `#/` — logo, location, search, Food / Fashion / Shoes / Shopping / Offers tiles, "What are you craving?", offers, popular nearby, trending dishes, shop categories, recommended products, popular stores, recently viewed |
| 2 | Location system | Header location picker: simulated GPS, area search (Dhaka live, other cities "coming soon"), saved Home / Office / Other addresses, default address; Account → Saved addresses |
| 3 | Restaurants & menus | `#/food`, `#/restaurant/:id` — cover, logo, rating, reviews, cuisine, ETA, fee, minimum order, offer, distance, open/closed; menu with photos, customisation modal, quantity steppers |
| 4–5 | Shopping & product pages | `#/shop`, `#/store/:id`, `#/product/:id` — gallery (≥2 images each, colour swatches switch photo), sizes, colours, stock, discount, vouchers, delivery estimate, reviews, Add to cart / Buy now |
| 6 | Cart | `#/cart` — separate food / shopping carts, quantities, remove + undo, save for later, vouchers, full bill, ETA |
| 7 | Checkout | `#/checkout` — address → delivery method → payment → review, with the Demo Payment gateway (test credentials only) |
| 8–9 | Confirmation & tracking | `#/orders/:id` — order number, items, total, address, ETA, auto-progressing status, simulated map and rider, timeline, speed controls, "Simulation Complete — No real product was delivered." |
| 10 | Vouchers & offers | `#/offers` + cart voucher box: amount, minimum order, expiry, scope, first-order rule, apply |
| 11 | Account | `#/account` — profile, phone, addresses, orders, favourites, vouchers, payment methods, notifications, help, settings, logout |
| 12 | Order history | `#/orders` — active / delivered / cancelled tabs, search, reorder, view details |
| 13 | Favourites | `#/favorites` — restaurants, food, products, stores |
| 14–15 | Search & filters | Header search suggestions + recent searches; `#/search` tabs, filters, sorting, no-result state; food filters (rating, time, price, cuisine, offers) and shop filters (category, brand, size, colour, price, rating, express delivery) |
| 16 | Notifications | `#/notifications` — order stages, voucher drops, promotions |
| 17 | Support | `#/help` (FAQ by topic, contact options) and `#/help/chat` (simulated assistant and agent, simulated refunds) |
| 18–19 | UI/UX & branding | Design tokens in `src/index.css`; logo, favicon, components in `src/components`; skeletons, empty, error, toast and confirmation states |
| 20 | Admin | `#/admin` — restaurants, food items, products, prices, vouchers, demo orders, status / ETA, users, settings |
| 21 | Seed data | Checked by `scripts/requirements.mjs` |
| 22 | Simulation rule | Demo banner on every page, "Test order" labels, Demo Payment gateway that rejects real-looking credentials |

## Walkthrough scripts

With a preview server running (`npm run build && npx vite preview --port 4173`):

```bash
node scripts/requirements.mjs  # data requirements: ≥10 restaurants, ≥100 dishes, ≥30 products, ≥2 photos each, statuses…
node scripts/routes.mjs      # every route at mobile + desktop: console errors, overflow, empty pages
node scripts/e2e.mjs         # browse → search → filter → cart → vouchers → checkout → demo payment → tracking → delivered → history → shopping → admin → signup
node scripts/e2e-extra.mjs   # location, addresses, favourites, save-for-later, Bangla, admin CRUD, guards, 404
VP=desktop node scripts/e2e.mjs
```

The scripts use Playwright. Set `CHROME=/path/to/chrome` if Chromium isn't at `/opt/pw-browsers/chromium`.
