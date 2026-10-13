# Setup & configuration

## 1. Services at a glance

| Capability | Needed for | Provider used | Configure with | Status without it |
|---|---|---|---|---|
| PostgreSQL 16 | everything | any Postgres (self-hosted, RDS, Supabase Postgres, Neon…) | `DATABASE_URL` | required |
| JWT signing secret | auth | — | `JWT_SECRET` (≥32 chars) | required in production |
| STUN | calls | Google public STUN by default | `STUN_URLS` | works on most home networks |
| **TURN relay** | reliable calls on mobile/corporate networks | coturn (`deploy/coturn`) or a managed TURN | `TURN_URLS`, `TURN_SECRET` | ~10–20% of real-world calls may fail to connect behind strict NATs |
| OCR | Read with AI | Tesseract (self-hosted) | `tesseract-ocr` package / `TESSERACT_PATH` | required for photo scanning |
| Offline dictionary | word meanings | WordNet 3.1 (`wordnet-db`, bundled) | — | built in |
| AI feedback | writing/speaking band estimates, contextual meanings, AI-generated content review | Anthropic Claude | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | metrics-only feedback, dictionary meanings, no bands |
| Translation | Read with AI | Claude, or LibreTranslate | `ANTHROPIC_API_KEY` or `LIBRETRANSLATE_URL` | translation button explains it's unavailable |
| Server speech-to-text | speaking practice in browsers without Web Speech | any OpenAI-compatible `/audio/transcriptions` (OpenAI, Groq, self-hosted faster-whisper) | `STT_API_URL`, `STT_API_KEY`, `STT_MODEL` | Chrome/Edge/Safari use built-in recognition; others type their answer |
| Email | password reset | Resend | `RESEND_API_KEY`, `EMAIL_FROM` | dev: link printed to server log; production: reset returns "not configured" |
| Web payments | Premium on the web | Stripe Checkout + Billing Portal | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PREMIUM_PRICE_ID` | upgrade button explains it's not enabled |
| App-store payments | Premium on iOS/Android | RevenueCat (App Store + Google Play) | server: `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_API_KEY`; app: `EXPO_PUBLIC_REVENUECAT_IOS_KEY/ANDROID_KEY` | purchase screen explains it's not configured |
| Push notifications | reminders on phones | Expo Push Service | EAS project id in `app.json` (`extra.eas.projectId`), optional `EXPO_ACCESS_TOKEN` | in-app notifications still work |

No integration is simulated: when a key is missing the UI says so and the server returns `503 not_configured`.

## 2. Local development

```bash
# Database
createuser -P app            # password: app
createdb -O app fluentpath
createdb -O app fluentpath_test   # for server integration tests

npm install
npm run db:migrate
npm run db:seed              # idempotent; safe to re-run after content changes
npm run dev:server           # http://localhost:4000  (GET /config shows which integrations are active)
npm run dev:web              # http://localhost:5173
```

Optional, regenerate listening audio after editing scripts (offline neural TTS):

```bash
pip install piper-tts
# download Piper voices (e.g. en-gb-alan-low, en-gb-southern_english_female-low, en-us-amy-low, en-us-lessac-medium) into ./voices
npx tsx apps/server/scripts/export-audio-spec.ts audio-spec.json
python3 apps/server/scripts/generate-audio.py audio-spec.json apps/server/media ./voices --force
```

## 3. Voice calling in production

1. Serve the web app and API over **HTTPS/WSS** — browsers only allow microphone access in secure contexts.
2. Deploy a TURN server: `docker compose --profile turn up turn` with `deploy/coturn/turnserver.conf`
   (set `static-auth-secret` = `TURN_SECRET`, `realm`, TLS certs, open UDP 3478/5349 and 49160–49200).
3. Set `TURN_URLS` and `TURN_SECRET` on the API. Each matched user receives credentials valid for `TURN_TTL_SEC` (default 1 h).
4. Multiple API instances: realtime messages are relayed between instances through Postgres `LISTEN/NOTIFY`
   (enabled by default). Battle matchmaking queues are per instance — use sticky sessions or a single realtime instance for battles.

Calls are peer-to-peer WebRTC (no media server, no recording). For group rooms or server-side recording in the future,
the signalling layer can be swapped for an SFU such as LiveKit without changing matching.

## 4. Billing

**Stripe (web):** create a recurring Price for Premium → `STRIPE_PREMIUM_PRICE_ID`; add a webhook endpoint
`https://API/billing/stripe/webhook` for `customer.subscription.*` and `invoice.payment_failed` → `STRIPE_WEBHOOK_SECRET`;
enable the Customer Portal.

**RevenueCat (iOS/Android):** create products in App Store Connect / Google Play, an entitlement named `premium`,
and an offering. Webhook URL `https://API/billing/revenuecat/webhook` with an Authorization header value → `REVENUECAT_WEBHOOK_AUTH`.
Secret API key (v1) → `REVENUECAT_API_KEY` (used by "Restore purchases"). Public SDK keys go in the mobile `.env`.
The app identifies users to RevenueCat with their account id, so entitlements are shared with the web.

Premium is only granted from server-verified events (signed Stripe webhooks, authenticated RevenueCat webhooks/API, or an admin grant).
Plan limits live in the `plans` table and are editable in **Admin › Plans**.

## 5. Mobile apps

The app uses native modules (WebRTC, speech recognition), so it needs a **development build**, not Expo Go.

```bash
cd apps/mobile
cp .env.example .env            # EXPO_PUBLIC_API_URL must be reachable from the device (use your LAN IP or HTTPS URL)
npm install
npx expo run:android            # local build (Android Studio/SDK required)
npx expo run:ios                # local build (macOS + Xcode required)
# or cloud builds:
npm i -g eas-cli && eas init && eas build --profile development --platform all
```

`eas init` writes the EAS project id needed for push notifications. Store submission: `eas build --profile production` then `eas submit`.

## 6. Deployment

`docker compose up --build` runs Postgres, the API (with Tesseract) and the web app (nginx). Put both behind HTTPS
(e.g. Caddy, nginx, a cloud load balancer) and set `PUBLIC_WEB_URL`, `CORS_ORIGINS`, `VITE_API_URL`.
The API runs pending migrations on start; run `npm run seed -w apps/server` once to load content.

Uploaded admin audio is stored in `apps/server/media/uploads` (a volume in compose). Photos for OCR are never stored.
