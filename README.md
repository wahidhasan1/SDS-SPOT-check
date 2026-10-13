# FluentPath — IELTS & English-learning platform

> Working name, configurable via `APP_NAME` (server), `VITE_APP_NAME` (web) and `EXPO_PUBLIC_APP_NAME` (mobile).

A cross-platform English-learning and IELTS preparation platform with **real, anonymous peer-to-peer voice calls**,
full IELTS Academic & General Training practice, adaptive placement testing, vocabulary & grammar, real-time battles,
and photo-based AI reading — on **the web, Android and iOS**, all sharing one backend and one account.

| App | Path | Stack |
|---|---|---|
| API + realtime server | `apps/server` | Node 22, Fastify, PostgreSQL, WebSockets |
| Web app | `apps/web` | React 19 + Vite, responsive (desktop sidebar / mobile bottom nav) |
| Android & iOS app | `apps/mobile` | Expo SDK 57, React Native, expo-router, react-native-webrtc |
| Shared code | `packages/shared` | Types, validation, API/realtime clients, WebRTC call logic, learning rules |
| End-to-end tests | `e2e` | Playwright (real Chromium, real WebRTC audio) |

The repository root also still contains `index.html`, the earlier standalone *SDS Spot Check* tool; it is unrelated to this platform and was left untouched.

## Quick start (development)

Requirements: Node 22+, PostgreSQL 16, `tesseract-ocr` (for photo OCR). Optional: Chromium for E2E tests.

```bash
npm install                                  # web, server, shared (npm workspaces)
createdb fluentpath                          # or use docker compose (see docs/SETUP.md)
npm run db:migrate && npm run db:seed        # schema + original learning content
npm run dev:server                           # API on http://localhost:4000
npm run dev:web                              # web app on http://localhost:5173

cd apps/mobile && npm install                # mobile app is a separate npm project
npx expo run:android   # or: npx expo run:ios   (needs a dev build: native WebRTC)
```

Make yourself an administrator: register, then `npm run seed -w apps/server -- --admin you@example.com`
(or list your email in `ADMIN_EMAILS` before registering).

## What works without any external accounts

Everything below runs on your own infrastructure with no third-party keys:

- Accounts, sessions, profiles, privacy and notification preferences, account deletion and data export
- **Live anonymous voice calls** (WebRTC, server matching/signalling), call history, reporting, blocking, auto-moderation
- Adaptive CEFR placement test, IELTS Reading & Listening (real audio) with server-side scoring, mock tests
- Writing drafts with autosave and measurable text checks; speaking practice with browser/device transcription and transcript statistics
- Vocabulary (spaced repetition, quizzes), grammar lessons, real-time battles with Elo ratings and leaderboards
- Photo OCR (Tesseract) with tap-a-word meanings from an offline dictionary (WordNet) matched to the sentence
- Admin console: moderation, users, plan limits, content editing, media upload, audit log

Features that need a provider key are implemented but **clearly labelled as unavailable until configured**
(AI band estimates and feedback, AI contextual meanings, translation, server speech-to-text, email, payments, TURN, push).
See **[docs/SETUP.md](docs/SETUP.md)**.

## Documentation

- [docs/SETUP.md](docs/SETUP.md) — environment variables, external services, deployment, mobile builds
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, data model, calling and scoring design
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md) — automated tests and manual test cases (incl. device calling matrix)
- [docs/PROGRESS.md](docs/PROGRESS.md) — what is done, verified, and outstanding

## Tests

```bash
npm test                      # shared unit tests + server integration tests (needs a fluentpath_test database)
npm run test:e2e              # Playwright: two-account calls with real audio, IELTS flows, battles, OCR, mocks
```

IELTS is a registered trademark of the IELTS partners. This is an independent practice platform; all band scores shown are unofficial estimates. All learning content in this repository is original.
