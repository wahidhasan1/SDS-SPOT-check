# pikk

**Pick anything. Pay nothing.**

pikk is a craving simulator for Bangladeshi consumers. Browse food and fashion, add to cart, apply a voucher, pay with a *demo* payment, and track your order to the door. The whole dopamine loop happens, but no money is spent and nothing arrives.

> **Everything is simulated.** No real payments, orders or deliveries. All restaurants, brands, riders and users are fictional. The demo gateway accepts only published test credentials and rejects anything that looks like a real wallet or card.

## Run it

```bash
cd dopamine-kitchen   # project folder (app is branded pikk)
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/ (HashRouter + relative base: host it anywhere)
```

## Demo credentials

| What | Value |
|---|---|
| Sign up / log in code | `123456` (or pick a demo account under **Log in**) |
| bKash / Nagad | Test wallet `01700000000` / `01800000000` → succeeds, `01700000001` → low balance. PIN `12345`. One-tap "Test" chips in the payment sheet |
| Cards | `4242 4242 4242 4242` → succeeds, `4000 0000 0000 0002` → declined (one-tap chips at checkout) |
| Public vouchers | `WELCOME50`, `FIRSTORDER` (first order only), `FOOD20`, `SHOP100`, `FREEDEL`, `STYLE15`, `CAFE100`, `MIDNIGHT30`, `EID25` (expired) |

A first visit starts logged out so you see the sign-up → Lucky Wheel flow. The demo admin account is **Ayesha Rahman**; the **Demo control panel** is at `#/admin` (it can also force the next wheel result).

## Brand

* **Name: pikk.** Short, says itself, and works for food *and* fashion: "Let's use pikk." "I'm craving something, I'll check pikk." Alternatives explored: Crave/Cravy (food-coded), Dopa (sounds medical), Grab (taken), Zoop (childish).
* **Logo:** a lowercase "p" (stem + ring) on a jade tile with a sun dot, readable at 16 px. The wordmark puts the same sun dot on the "i".
* **Colour:** Jade `#0A7F57` is the single primary (actions, navigation, success). Sun `#FFC233` is reserved for rewards and discounts, always with dark text for contrast. Neutrals carry a faint jade bias, and red is only used for errors, notification counts and the favourite heart. There's no pink/purple/baby blue and no multi-hue gradients, so the palette reads gender-neutral.
* **Type:** one family (Figtree), hierarchy by weight and size, tabular numbers for prices.

## UX review → what changed

| Problem in the previous version | Change |
|---|---|
| Name sounded clinical and food-only; purple→coral gradients felt dated | Rebrand to pikk with a calm jade/sun system |
| Black "DEMO" banner on every page | A small **Demo** chip opens "How pikk works"; simulation is stated where it matters (payment, tracking, completion) |
| Home page had 11 sections with no priority | Search → value proposition → Food / Fashion → categories → popular → recommended → deals → recently viewed |
| Orders were not in the bottom nav | Home · Food · Shop · **Orders** · Account; the cart moved to the header with a live count |
| Checkout: 4 steps, an "I understand" checkbox, a pre-order check-in, OTP + PIN screens | **One page**: address, delivery option, voucher (best one suggested), payment, one button. Wallet payment is number + PIN on one sheet |
| New users never saw onboarding (app started signed in) | First visit is logged out; sign up leads into the welcome **Lucky Wheel** |
| Paying with no address opened an empty list | Opens the add-address form directly |
| A won voucher that didn't fit the cart simply disappeared at checkout | Every owned voucher is listed, with the exact reason when it can't be used |
| Emoji everywhere, toasts that lingered and stacked | Icon-based empty states, shorter toasts, at most two on phones |

## Lucky Wheel & rewards

* **Flow:** Sign up → account created → welcome screen → spin → "You won" card (code, discount, cap, minimum order, scope, expiry) → voucher saved in **Account → My vouchers** and suggested at checkout.
* **Responsible by design:** one spin per account, optional ("Maybe later" keeps it waiting), every slice is a real reward, and the real odds are one tap away. No countdowns, no fake scarcity, 14-day validity, one use, no cash value.
* **Rewards:** 5%, 10%, 15% food, 20%, 25% fashion, 30% food (each capped), free delivery, and a mystery flat ৳100–200.
* **Built to extend:** `src/lib/rewards.ts` (segments, weighted pick, voucher factory) + `RewardEvent` history + `Voucher.ownerId/source/usedAt`. Daily spins, streaks, referrals and badges can be added as new `RewardSource`s without changing checkout.

## Architecture

* **React 19 + TypeScript + Vite**, **Tailwind CSS v4** tokens in `src/index.css`, **Zustand** store persisted to `localStorage` (writes are batched), **lucide-react** icons.
* `src/data/`: typed model and seed data. That's 14 restaurants, 159 dishes, 10 brands, 61 products (≥2 photos each), 9 public vouchers, 5 users, 8 addresses and 18 orders in every status. The JSON-shaped arrays can be swapped for authorised partner data.
* `src/lib/`: pricing and voucher rules, order simulation (progress derived from the clock; ~30 min food, ~1 day shopping; 1×/10×/60× speed), rewards, search, reviews, formatting (BDT, +880).
* `src/i18n/`: English plus Bangla (beta) dictionary.
* Photos are bundled as compressed WebP (`public/img`, ~7 MB, lazy-loaded). Sources and licences are in [`public/img/CREDITS.md`](public/img/CREDITS.md); replace the food photos with licensed photography before a public launch.

## Walkthrough scripts

With a preview server running (`npm run build && npx vite preview --port 4173`):

```bash
node scripts/e2e.mjs           # signup → wheel → search → filter → cart → voucher → checkout → payment failure + success → tracking → completion → history → fashion → admin
FORCE_SPIN=p30 node scripts/e2e.mjs   # same journey with a fixed wheel result
node scripts/rewards.mjs       # forces all 8 wheel outcomes; checks the exact discount and single-use marking for each
node scripts/e2e-extra.mjs     # location, addresses, favourites, save for later, Bangla, admin CRUD, guards, 404
node scripts/routes.mjs        # every route at phone + desktop size: errors, overflow, empty pages
node scripts/requirements.mjs  # seeded data requirements
VP=desktop node scripts/e2e.mjs
```

Scripts use Playwright. Set `CHROME=/path/to/chrome` if Chromium isn't at `/opt/pw-browsers/chromium`.
