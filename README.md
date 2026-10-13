# FluentPath

FluentPath is a platform for learning English and preparing for IELTS. It has a web app, an Android/iOS app, and one shared API, database and account system. Accounts, progress and plans are the same on every device.

> The original **SDS Spot Check** single-file app (`index.html` at the repository root) is still here, unchanged. It has nothing to do with FluentPath.

## What's inside

| Path | What it is |
| --- | --- |
| `apps/api` | Fastify + PostgreSQL (Drizzle ORM) API, the WebSocket signalling server, the seed content and pre-generated audio |
| `apps/web` | React 19 + Vite + Tailwind web app, including the admin area |
| `apps/mobile` | Expo (React Native) app for Android and iOS |
| `packages/shared` | TypeScript shared by all three: CEFR levels, plan limits, IELTS schemas, scoring and realtime message types |
| `e2e` | Playwright browser tests, including a two-browser voice-call test |

Features: accounts (email/password, password reset, optional Google sign-in), onboarding and a placement test (gives an unofficial CEFR estimate), grammar lessons, vocabulary with spaced repetition, flashcards, quizzes and word audio, IELTS Reading and Listening (every question type, timed, with explanations), Writing (charts, letters, essays, drafts, word count, optional AI feedback), Speaking Parts 1–3 (recording, transcript, optional AI feedback), timed mock tests, anonymous voice calls between learners (WebRTC, matchmaking, mute, report/block), vocabulary and grammar battles, an OCR book reader with tap-to-define in context, a dashboard and progress tracking, notifications, privacy settings, account deletion and data export, Free and Premium plans enforced on the server, and an admin area with role-based access (content, users, reports, subscriptions, audit log).

All band and level estimates are labelled as practice estimates, not official IELTS or CEFR results.

## Run the web app locally

Requirements: Node.js 20+ and PostgreSQL 14+.

```bash
# 1. Database. Either use Docker:
docker compose up -d postgres
#    ...or create the user and databases in your own Postgres:
#    CREATE USER fluent WITH PASSWORD 'fluent_dev_pw';
#    CREATE DATABASE fluent OWNER fluent; CREATE DATABASE fluent_test OWNER fluent;

# 2. Install, then migrate and seed the content
npm install
cp .env.example .env          # optional: the defaults work for local development
npm run db:setup

# 3. Start the API (http://localhost:4000) and web app (http://localhost:5173)
npm run dev
```

To make yourself an administrator, add your email to `ADMIN_EMAILS` before you register, or run `npm run admin:promote -- you@example.com` after you register.

**Production:** run `npm run build` (builds the web app), then `NODE_ENV=production npm start`. The API serves the built web app and the API from one origin, so set `APP_URL` and `API_URL` to that same public HTTPS URL. Migrations run when the server starts. Put it behind HTTPS: secure cookies, microphone access and WebRTC all require it.

## Tests

```bash
npm test             # API integration tests (Vitest), against the fluent_test database
npm run test:e2e     # Playwright browser tests. Starts the dev servers if they are not running
npm run typecheck    # TypeScript for shared, api and web
cd apps/mobile && npm run typecheck
```

The API tests reset the `fluent_test` database. The tests for external services (AI, Stripe, SMTP) run against local stand-in servers, not the real services.

## Mobile app

See [docs/SETUP.md](docs/SETUP.md#mobile-app-android--ios). In short:

```bash
cd apps/mobile && npm install
EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:4000 npx expo run:android   # needs the Android SDK
npx eas build --profile preview --platform android                            # cloud build (APK)
```

Voice calls use `react-native-webrtc`, which is a native module, so the app needs a development build. It does not run in Expo Go.

## Configuration

Every external integration is optional. When one isn't configured, the related feature says so in the app and nothing pretends to work. See [docs/SETUP.md](docs/SETUP.md) for each environment variable: AI feedback (Anthropic), email (SMTP), Google sign-in, Stripe payments, and TURN for voice calls.
