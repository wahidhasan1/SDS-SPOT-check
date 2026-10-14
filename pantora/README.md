# Pantora

**Speak Without Fear. Connect With the World.**

Pantora is a voice-first English speaking practice platform. Learners have low-pressure conversations (Free Talk), take timed 30-second Speaking Battles, get feedback from an AI Speaking Coach, and build a habit with daily goals, streaks, XP, levels, and achievements. Privacy and safety tools (anonymous profiles, end/skip/block/report, transcript retention controls) are built in.

This repository contains a complete, browser-runnable build that works **without any paid services**. External integrations (Claude for AI feedback, speech-to-text, live peer-to-peer calls) switch on through environment variables. Anything simulated is labeled as simulated in the UI.

---

## Quick start

Requirements: **Node.js 22.13 or newer** (Pantora uses the built-in `node:sqlite` module) and npm.

```bash
cd pantora
npm install
npm run dev
```

Open http://localhost:3000.

- **Start Speaking** creates a new anonymous profile through onboarding (it starts with an empty history).
- **Explore the demo account** signs in as *Alex*, a fictional account with three weeks of labeled sample history, a 6-day streak, and some achievements already unlocked.

The SQLite database is created and seeded automatically on first request at `pantora/.data/pantora.db`. No migrations or seeding commands are needed to get started.

Production build:

```bash
npm run build
npm start            # http://localhost:3000
```

> Node prints `ExperimentalWarning: SQLite is an experimental feature` on start. That's expected for `node:sqlite` on Node 22 and is harmless.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit tests (Vitest): analyzer, scoring, streaks, XP, achievements, matching, reward idempotency, seed consistency |
| `npm run test:e2e` | Builds, starts a server on port 3200 with its own database (`.data/e2e.db`), and runs the Playwright browser tests |
| `npm run db:migrate` | Apply schema migrations to the database |
| `npm run db:seed` | Seed demo data if the database is empty |
| `npm run db:reset` | **Delete all data** and restore the demo seed |

`npm run test:e2e` uses Playwright's bundled Chromium. If you already have a Chromium binary, point to it with `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e`. Otherwise run `npx playwright install chromium` once.

## Configuration

Copy `.env.example` to `.env.local`. Every variable is optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PANTORA_DEMO_MODE` | `true` | Enables the demo account and the demo admin entry |
| `PANTORA_ADMIN_TOKEN` | – | When set, `/admin` requires this token. **Set it before sharing Pantora with anyone.** |
| `PANTORA_DB_PATH` | `./.data/pantora.db` | SQLite database file |
| `ANTHROPIC_API_KEY` | – | Enables Claude-powered feedback and scoring |
| `PANTORA_AI_MODEL` | `claude-opus-5-5` | Claude model ID |
| `PANTORA_AI_EFFORT` | `low` | `low` / `medium` / `high` effort per analysis |
| `PANTORA_AI_TIMEOUT_MS` | `30000` | Per-request timeout |
| `PANTORA_STT_API_KEY` | – | Enables server speech-to-text for recordings |
| `PANTORA_STT_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible `/audio/transcriptions` endpoint |
| `PANTORA_STT_MODEL` | `whisper-1` | Transcription model |
| `PANTORA_LIVE_MATCHING` | `false` | Experimental live matching and WebRTC calls between users on this server |
| `PANTORA_ICE_SERVERS` | Google STUN | JSON array of `RTCIceServer` objects; add TURN for restrictive networks |

Secrets are read only on the server. The browser receives only derived status flags (e.g. "AI provider connected").

## What's in the app

| Route | Feature |
| --- | --- |
| `/` | Landing page: hero, product preview, how it works, Free Talk, Battles, Coach, progress, safety, FAQ |
| `/onboarding` | 7-step onboarding with validation, back/forward, draft restore, and a personalized welcome |
| `/dashboard` | Welcome, daily goal ring, key stats, quick actions, daily challenge, streak week view, recent activity, weekly trend, latest feedback |
| `/free-talk` | Setup → matching → partner preview → connecting → active call → summary |
| `/battles` | Today's challenge, practice battle setup, recent results, statistics, personal bests, rules → full battle flow |
| `/coach` | Prompt picker, typed or recorded answer, feedback (improved version, explanations, grammar, vocabulary, fluency when measured, exercise), mistake patterns |
| `/coach/saved` | My Learning: saved sentences with review, copy, and delete |
| `/topics` | 40 topics in 10 categories: search, category/difficulty filters, favorites, start Free Talk / challenge / exercise |
| `/history`, `/history/[id]` | Filter by type, status, and date; sort; pagination; session review with transcript corrections, feedback, battle scores, report/block |
| `/progress` | Totals, streaks, 14-day chart, 6-week calendar, skill averages, feedback history, how everything is calculated |
| `/achievements` | Levels, XP, 14 badges with progress |
| `/settings` | Profile, matching, notifications, privacy, accessibility, sign out, account deletion |
| `/safety` | Safety tools, blocked partners (unblock), your reports and their status, community guidelines |
| `/help` | FAQ, product feedback form, and a "what's real vs. simulated" table generated from the live configuration |
| `/admin` | Demo/admin area: overview, profiles, demo partners, sessions, battles, safety reports (status updates), AI feedback records, configuration, reset |
| `/guidelines`, `/privacy` | Public community guidelines and privacy overview |

### Gamification rules

- **Practice time** = time in a completed conversation (at least 1 minute) plus the length of recorded battle and coach answers. Typed answers earn XP but not speaking minutes. Opening a page never changes progress.
- **Streak**: a calendar day (in the user's time zone) counts when it has at least **2 minutes** of practice. The current streak stays alive until the end of the next day.
- **XP**: conversation 30 + 2/min (capped), battle 35 (+15 personal best), coach 15 typed / 20 recorded, daily goal 25, streak day 5 × streak (max 50), each review 5.
- **Idempotency**: every reward has a unique source key and every session has an idempotency key, so refreshing or double-submitting never awards anything twice.
- **Levels**: First Words (0), Brave Speaker (250), Consistent Talker (750), Confident Communicator (1,750), Global Speaker (3,500). These are motivational levels, not language certifications.

### Battle scoring

A 100-point product rubric: fluency and continuity 25, grammar and sentence construction 25, vocabulary and expression 20, relevance and clarity 20, response development 10. Each dimension shows its score, a one-line explanation, what went well, and one or two improvements. Both answers are scored as text by the same method; a winner is declared only when both were scored the same way (otherwise "no result"), and scores within 2 points are a draw. Pronunciation is never scored, because no reliable pronunciation-analysis service is configured, and accent is never part of any score. The UI states that the rubric is not a validated language assessment.

## Real vs. simulated

### Fully implemented (real behavior)

- Onboarding, profiles, settings, and preferences, persisted in SQLite
- Session recording, practice minutes, daily goals, streaks, XP, levels, and achievements, with idempotent rewards
- In-app notifications: achievements, goals, streak milestones, and daily reminders (respecting notification settings)
- Topics library with search, filters, and persistent favorites
- History with filters, sorting, pagination, and session review
- Saved sentences (My Learning) with review, copy, and delete
- Microphone access, live level meter, mute, MediaRecorder recording, and playback
- Browser live captions (Web Speech API, where the browser supports it), used for real transcripts of what the user said
- Rule-based demo analyzer: transparent, deterministic grammar and vocabulary rules and rubric scoring
- Claude analysis provider (structured output, validation, timeout, error handling, labeled fallback)
- Report and block, with blocks excluded from matching; report status workflow in admin
- Transcript retention (keep / 30 days / don't keep) with automatic purge
- Account deletion; demo reset with typed confirmation
- Experimental live mode: same-server matchmaking (proficiency ranges both ways, block lists both ways) and peer-to-peer WebRTC audio
- Network offline/online detection during calls (the timer pauses while offline)

### Simulated in demo mode (and labeled in the UI)

- **Demo partners and opponents** are 8 fictional profiles. Matching uses the real matching rules, but nobody is on the other end.
- **Demo call content**: partner lines are scripted prompts shown as text (optionally read by the browser's voice). The "Connected (simulated)" status is labeled.
- **Battle opponent answers** are pre-written samples, so battle results are labeled "Simulated result".
- **Demo account history** (Alex) is preloaded sample data: sessions, sample transcripts, feedback, battles, and two fictional reports. Every sample item carries a "Sample" badge, and sample days are hatched or outlined in charts.
- **Demo analyzer**: without `ANTHROPIC_API_KEY`, feedback comes from pattern rules and is labeled "Demo analyzer (rule-based)". It never claims to be AI.

### Requires credentials or configuration

| Integration | How to enable | Notes |
| --- | --- | --- |
| AI feedback (Claude) | `ANTHROPIC_API_KEY` | Implemented with `@anthropic-ai/sdk` structured outputs and server-side refusal fallbacks. Failures fall back to the demo analyzer with a visible notice. The failure path was tested with an invalid key; a successful live analysis was not exercised in this environment. |
| Server speech-to-text | `PANTORA_STT_API_KEY` (+ base URL/model) | OpenAI-compatible endpoint. Users must press "Send recording for transcription"; audio isn't stored. |
| Live calls beyond one server or network | `PANTORA_LIVE_MATCHING=true` + a TURN server in `PANTORA_ICE_SERVERS` | Signaling uses HTTP polling against the shared SQLite database, which suits a single server. A global network needs a realtime presence/signaling service (e.g. a WebSocket service or a managed WebRTC provider such as LiveKit or Daily), TURN, and horizontal scaling. |
| Authentication | Not configured | Demo profiles are identified by an httpOnly cookie. To add real sign-in, replace `getCurrentUserId()` in `src/server/auth.ts` with your provider (Auth.js, Clerk, etc.) and map its subject to `users.auth_subject`. |
| Email/push reminders | Not configured | Reminders are in-app only. |
| Moderation | Not configured | Reports are stored and manageable in admin. There is no automated content moderation and no staffed review process. |
| Pronunciation assessment | Not available | Intentionally not simulated. |

## Architecture

- **Next.js 16 (App Router) + React 19 + TypeScript**, Tailwind CSS v4 design tokens (`src/app/globals.css`), lucide icons, Plus Jakarta Sans (self-hosted via Fontsource).
- **Server components** read data directly; **client components** handle interaction and call **route handlers** under `src/app/api/*`. All inputs are validated with Zod (`src/lib/schemas.ts`), and every query is scoped to the signed-in user.
- **Database**: SQLite through Node's built-in `node:sqlite` (no native build step). Ordered migrations live in `src/server/db/migrations.ts` and are applied automatically. Writes that span tables run in savepoint transactions.

```
src/
  app/                 routes: public pages, (app) group with the authenticated shell, admin, api/*
  components/ui        design-system primitives (Button, Card, Dialog, Toast, form controls, charts' building blocks)
  components/app       app shell (sidebar, top bar, mobile navigation)
  features/*           feature modules: free-talk, battles, coach, topics, history, progress, settings, safety, admin, audio
  lib/                 shared pure logic: types, labels, game rules, matching, schemas, demo analyzer
  content/             topics, demo partners, battle prompts, coach prompts, guidelines
  server/              config, auth, db (migrations, seed), services (gamification, users, practice), AI and STT providers, queries
tests/unit             Vitest
tests/e2e              Playwright
```

### Data model

`users`, `user_settings`, `topics`, `topic_favorites`, `demo_partners`, `sessions` (type, partner, topic, duration, practice time, local activity date, status, origin `seed|demo|live`, unique idempotency key), `transcripts` + `transcript_entries` (status, source, retention, expiry), `feedback` (analyzer, origin, analysis JSON, scores JSON, reviewed), `battles`, `saved_sentences`, `user_activity` (daily rollup), `xp_events` (unique source key), `achievements`, `user_achievements`, `notifications` (dedupe key), `blocks`, `safety_reports`, `product_feedback`, plus `live_queue`, `live_rooms`, `live_signals` for live mode. Foreign keys cascade on account deletion.

### Persistence notes

- Everything lives in the SQLite file and survives restarts. Delete `.data/` (or run `npm run db:reset`) to start over.
- The demo seed is generated relative to the time it runs (the demo streak ends "yesterday"). If you come back days later, the demo streak will have lapsed; use **Admin → Reset demo data** or `npm run db:reset` to regenerate it.
- Browser-only: the onboarding draft (`localStorage`) and in-progress recordings (memory, discarded on navigation).

## Accessibility

Semantic landmarks, a skip link, labeled controls, keyboard-operable dialogs (native `<dialog>`), visible focus rings, `aria-live` regions for timers and status, chart tables and text alternatives, reduced-motion support (OS setting plus an in-app toggle), a larger-text option, and touch targets of 48px or more for call controls.

## Testing

```bash
npm run lint && npm run typecheck && npm test
npm run test:e2e
```

End-to-end coverage: landing and public pages, auth redirect, onboarding (validation, back/forward persistence, completion), Free Talk (matching, skip, mute, scripted prompts, fake-clock 2-minute call → streak 7 and Seven-Day Streak achievement, incomplete short calls, report + block → excluded from matching), Speaking Battles (typed and recorded with a fake microphone; duplicate submission awards no extra XP), AI Coach (feedback, save to My Learning, review), Topics (search, filters, favorites persisting, start Free Talk), History (filters, sort, session review actions), Settings (persistence, validation, reduced motion applied), mobile navigation without horizontal overflow, live mode (two browsers matched and connected over WebRTC), and admin (report status, configuration without secrets, reset, authorization).

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Cannot find module 'node:sqlite'` / `No such built-in module` | Upgrade to Node.js 22.13 or newer. |
| `database is locked` | Make sure only one Pantora server uses the same `PANTORA_DB_PATH`. The e2e tests use their own `.data/e2e.db`. |
| Demo account says it was deleted | Open `/admin` → Reset demo data, or run `npm run db:reset`. |
| Microphone doesn't work | Browsers only allow microphone access on `https://` or `localhost`. Check the site's permission settings. |
| No captions / "Captions need an internet connection" | Live captions rely on the browser's speech service (Chrome, Edge). Firefox doesn't support it. You can still type what you said. |
| Feedback says "Demo analyzer" even with a key | The provider request failed (bad key, timeout, rate limit). The notice above the feedback says why; check the server log for `[pantora] AI analysis failed`. |
| Live calls connect on one network but not another | Add a TURN server to `PANTORA_ICE_SERVERS`. |
| Playwright can't find a browser | Run `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_PATH`. |
