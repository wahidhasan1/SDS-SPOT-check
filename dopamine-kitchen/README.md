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
* Progress continues while the tab is closed. On the tracking screen (or in Settings) you can switch between **Real-time, 10× and 60×** speed, or **skip to the next stage**. Admins can set any status or ETA.
* Optional craving check-ins before ordering and after "delivery" show whether the urge eased.

## Architecture

* **React 19 + TypeScript + Vite**, **Tailwind CSS v4** design tokens (`src/index.css`), **Zustand** store persisted to `localStorage`, **lucide-react** icons.
* `src/data/` holds the typed data model (`types.ts`) and seed data: 14 restaurants, 158 dishes, 10 brands, 47 products, 9 vouchers, 5 users, 8 addresses and 18 orders covering every status. The modules are plain JSON-shaped arrays, so they can be swapped for authorised partner data or an API later.
* `src/store/store.ts` holds all app state and actions (cart, vouchers, orders, the simulation ticker, favourites, notifications and admin CRUD).
* `src/lib/` contains pricing (delivery fee/ETA from area distance, voucher rules), the order simulation, search, deterministic review generation and formatting (BDT, +880 phone numbers).
* `src/i18n/` has English strings plus a Bangla (beta) dictionary; missing keys fall back to English.
* Images are illustrative Unsplash photos. If a photo can't load, `<Img>` renders a generated illustration, so the app stays usable offline or on restricted networks.

## Walkthrough scripts

With a preview server running (`npm run build && npx vite preview --port 4173`):

```bash
node scripts/routes.mjs      # every route at mobile + desktop: console errors, overflow, empty pages
node scripts/e2e.mjs         # browse → search → filter → cart → vouchers → checkout → demo payment → tracking → delivered → history → shopping → admin → signup
node scripts/e2e-extra.mjs   # location, addresses, favourites, save-for-later, Bangla, admin CRUD, guards, 404
VP=desktop node scripts/e2e.mjs
```

The scripts use Playwright. Set `CHROME=/path/to/chrome` if Chromium isn't at `/opt/pw-browsers/chromium`.
