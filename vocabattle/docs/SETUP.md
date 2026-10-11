# Vocabattle — Setup

## Prerequisites

* Node.js 20+ (developed on Node 22) and npm
* A Supabase project (free tier is fine) **or** the Supabase CLI + Docker for a local stack
* For devices: Expo Go is **not** enough once native modules change — use a development build (`npx expo run:ios|android` or `eas build --profile development`). For a quick look, `npm run web` works in a browser.

## 1. Backend (Supabase)

```bash
cd vocabattle
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies supabase/migrations/0001…0007
```

Local alternative: `npx supabase start` (Docker) then `npx supabase db reset`.

The content migration (`0006_content.sql`) is generated from `content/` and
is idempotent. After editing content run `node scripts/generate-content.mjs`
and push again.

### Dashboard settings

| Setting | Where | Value |
|---|---|---|
| Site URL / redirect URLs | Auth → URL Configuration | `vocabattle://**`, your web origin, and `exp://**` for development |
| Email confirmations | Auth → Providers → Email | On for production (the app has a verify-email screen); off is fine for local testing |
| SMTP | Auth → SMTP | Your provider — Supabase's built-in mailer is heavily rate-limited |
| Realtime | Database → Publications | `supabase_realtime` must include `battles`, `matchmaking_queue`, `notifications` (the migration adds them) |
| pg_cron | Database → Extensions | Enable, then re-run: `select cron.schedule('vocabattle-maintenance', '* * * * *', 'select private.run_maintenance()');` |
| Google / Apple sign-in (optional) | Auth → Providers | Configure client IDs/secrets there, then set `EXPO_PUBLIC_OAUTH_PROVIDERS` |

### Granting an admin or moderator

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com';
```
Roles: `admin` (everything, including config and roles), `moderator` (reports, suspensions, battle issues), `content_editor` (vocabulary/questions).

### Changing quotas, timings or XP rules

All of these live in `public.app_config` (`plans`, `battle`, `battle_modes`,
`assessment`, `xp`, `rate_limits`). Change them with the audited RPC
`select public.admin_set_config('plans', '<json>')` as an admin, or in SQL.
No app release is needed — the app reads limits from the server.

## 2. Mobile app

```bash
cd vocabattle/mobile
npm install
cp .env.example .env     # fill in the values below
npm start                # then press i / a / w, or scan with a dev build
```

### Environment variables (`mobile/.env`)

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | **yes** | Project URL, e.g. `https://abcd.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **yes** | Public anon key (Settings → API). Safe to ship; RLS protects data |
| `EXPO_PUBLIC_OAUTH_PROVIDERS` | no | `google,apple` — shows social sign-in buttons |
| `EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_PRIVACY_URL` | no | Links on the subscription screen (buttons are disabled until set) |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | no | Contact address on the help screen |

Without the two required values the app shows a **“Backend not configured”**
screen instead of running — nothing is mocked.

**Never** put these in the app: service-role key, JWT secret, AI/OCR provider
keys, RevenueCat secret API key, webhook secrets. They belong in Supabase Edge
Function secrets (`npx supabase secrets set …`) from Phase 2 on.

### Checks

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint (incl. React Compiler rules)
npm run build:web      # production web bundle (sanity check)
```

## 3. Tests

Requires a local PostgreSQL 15+ superuser connection (`PGUSER`, `PGHOST`;
defaults: current user via `/var/run/postgresql`).

```bash
cd vocabattle/tests
npm install
npm test                         # recreate DB `vocabattle_test`, apply shim + migrations, run 46 integration tests
./e2e/run.sh                     # fresh DB → web build → dev gateway → Playwright journeys (+ screenshots in docs/screenshots)
```

* `tests/db/supabase_shim.sql` emulates only what Supabase provides (`auth`
  schema, `auth.uid()`, the `anon/authenticated/service_role` roles and their
  default grants) so RLS and grants are tested realistically.
* `tests/dev-gateway.mjs` is a **dev-only** stand-in for Supabase Auth and
  PostgREST used by the E2E run. It executes every request as role
  `authenticated` with the caller's JWT claims. Realtime is not emulated (the
  app falls back to polling). Never deploy it.
* E2E uses Chromium at `/opt/pw-browsers/chromium` by default; override with
  `CHROMIUM_PATH`.

## 4. Services that need accounts / keys

| Service | Phase | Needed for | Status in this build |
|---|---|---|---|
| Supabase project | 1 | Everything | **Required** |
| SMTP provider | 1 | Verification and password-reset emails at scale | Configure in Supabase |
| Google / Apple OAuth | 1 (optional) | Social sign-in | Code path ready; provider config needed |
| Expo / EAS account | 1 | Device builds, store submission, push credentials | Needed for native builds |
| OCR provider (e.g. Google Cloud Vision, Azure Read) | 2 | Book-page text with word boxes | Not configured |
| LLM provider (any, via `ai-gateway`) | 2–3 | Contextual meanings, translation, writing feedback | Not configured |
| RevenueCat + App Store Connect + Google Play Console | 4 | Subscriptions | Not configured — purchase buttons disabled |
| Expo push (APNs/FCM credentials) | 4 | Server-sent push | Local daily reminders work without it |
| Error monitoring (e.g. Sentry) | 5 | Crash reporting | Not configured |
