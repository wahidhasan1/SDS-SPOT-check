# FluentPath setup and configuration

Settings are read from environment variables, or from a `.env` file in the repository root or in `apps/api/`. `.env.example` lists them all. Never put any of these values in the web or mobile code: they are used only by the API server.

## Core

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://fluent:fluent_dev_pw@localhost:5432/fluent` | PostgreSQL 14+. Migrations run when the server starts and when you run `npm run db:migrate`. |
| `APP_URL` | `http://localhost:5173` | Public URL of the web app, used in email links and OAuth redirects. |
| `API_URL` | `http://localhost:4000` | Public URL of the API, used for the OAuth callback. |
| `CORS_ORIGINS` | — | Extra browser origins allowed to call the API. Requests that use cookies are also checked against `Origin` to block CSRF. |
| `COOKIE_SECURE` | `true` in production | Session cookies are httpOnly and SameSite=Lax. |
| `ADMIN_EMAILS` | — | Comma-separated list. These accounts become administrators when they register. You can also run `npm run admin:promote -- email`. |
| `UPLOAD_DIR` | `apps/api/uploads` | Recordings and scanned pages. These are private: only the owner and administrators can read them. |
| `RATE_LIMIT` | `true` | Global limit plus stricter limits on login, register and password reset. |

## Content

`npm run db:seed` adds the built-in content and is safe to run again; `npm run db:seed -- --update` overwrites the seeded items. The content is: 25 grammar lessons (166 exercises), 30 placement questions, 220 vocabulary words with audio, 12 IELTS reading and listening sets, 20 writing tasks, 17 speaking prompts and 3 mock tests. All of it was written for this project. Administrators can add and edit content at `/admin`, and content is validated before it can be published.

The listening recordings and word pronunciations are pre-generated MP3 files in `apps/api/media` (made with espeak-ng + MBROLA voices). To regenerate them, run `npm run audio:generate -w apps/api`. This needs `espeak-ng`, the `mbrola` voices `us1 us2 us3 en1`, and `ffmpeg`.

## Offline features (no configuration needed)

- **OCR**: tesseract.js with the English model runs on the server. Images are cleaned up with sharp first.
- **Dictionary**: WordNet 3.1 runs on the server. A lemmatiser turns words like "running" into "run", and a simplified Lesk algorithm picks the meaning that best fits the sentence.
- **Speech-to-text**: the browser's Web Speech API on the web, and the device's speech recogniser (`expo-speech-recognition`) on mobile. If neither is available, the learner can type the transcript. Pronunciation is never scored.

## Optional integrations

### AI feedback (Anthropic)
`ANTHROPIC_API_KEY` (required to turn it on), `ANTHROPIC_MODEL` (default `claude-opus-5-5`).
This turns on AI evaluation of writing and speaking (estimated band per criterion, corrections and tips) and AI word explanations in the reader. Without the key, those screens say AI feedback is not configured, and writing and speaking still get automatic text statistics.

### Email (SMTP)
`SMTP_URL`, for example `smtps://user:pass@smtp.example.com:465`, and `MAIL_FROM`.
Used for password reset, feedback-ready notices and streak reminders (each can be turned off in user settings). Without SMTP, emails are stored in the outbox (Admin → Email outbox) and printed to the server log. In development, that is how you get a password reset link.

### Google sign-in
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. In Google Cloud Console, create an OAuth client of type "Web application" with the redirect URI `${API_URL}/api/auth/google/callback`. The mobile app uses the same flow: the API sends it back to the app at `fluentpath://auth?code=…`, and the app exchanges that one-time code for a session.

### Payments (Stripe)
`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` (a recurring price), `STRIPE_WEBHOOK_SECRET`.
Add a webhook endpoint at `${API_URL}/api/billing/webhook` for these events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.payment_failed`. The API checks the signature of every event. Premium status is decided only on the server.

Without Stripe, the Premium page offers a **development mode** switch that is clearly labelled and grants Premium without payment. It is off when `NODE_ENV=production` or when Stripe is configured, and you can force it off with `ALLOW_DEV_SUBSCRIPTIONS=false`.

The mobile app does not sell subscriptions, so it complies with App Store and Play Store billing rules. It shows the plan linked to the account.

### Voice calls (WebRTC)
Calls are peer-to-peer audio. The API only handles matchmaking and signalling, over WebSocket at `/ws`.

- `STUN_URLS`: the default is Google's public STUN servers. That is enough for most home networks.
- Users on strict corporate or mobile-carrier networks need a **TURN relay**. Run coturn (`docker compose --profile turn up -d coturn` starts a basic one) and set `TURN_URLS=turn:your-host:3478` and `TURN_SECRET=<static-auth-secret>`. The API then gives each user credentials that expire after six hours. Alternatively, set `TURN_USERNAME` / `TURN_PASSWORD` for static credentials. Credentials are only sent to authenticated users.

If a connection can't be established within 25 seconds, the call ends with a message explaining why.

## Mobile app (Android / iOS)

```bash
cd apps/mobile
npm install
npm run typecheck
```

Set the API URL that the app should use:
- `EXPO_PUBLIC_API_URL=http://192.168.x.x:4000` for a phone on the same Wi-Fi as your computer. The Android emulator defaults to `http://10.0.2.2:4000`, the iOS simulator to `http://localhost:4000`.
- For production builds, set it in the profiles in `eas.json`. It must be HTTPS. Cleartext HTTP is allowed only for local testing.

The app uses native modules (`react-native-webrtc`, `expo-speech-recognition`), so it needs a **development build**. It does not run in Expo Go.

```bash
# Local native builds (Android Studio + SDK / macOS + Xcode required)
npx expo run:android
npx expo run:ios

# Cloud builds with EAS (needs a free Expo account: npx eas login)
npx eas build --profile development --platform android   # dev client
npx eas build --profile preview --platform android       # installable APK
npx eas build --profile production --platform all        # store builds
```

Before you submit to the stores: set your own bundle identifier and package name (`com.fluentpath.app` in `app.config.ts`), add app icons and a splash screen, and use an HTTPS `EXPO_PUBLIC_API_URL`. Check the permission descriptions (microphone, camera, photos, speech recognition) and the privacy details: audio recordings and photos are uploaded to your server.
