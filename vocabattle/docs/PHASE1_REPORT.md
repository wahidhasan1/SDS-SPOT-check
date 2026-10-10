# Phase 1 Report — Functional MVP

Date: 2026-10-10 · Scope: architecture, MVP, project structure, schema,
authentication, onboarding + adaptive assessment, navigation + dashboard,
vocabulary quiz, anonymous battles, testing, documentation.

## Features completed (working end-to-end on real persistent data)

**Authentication & onboarding**
- Email/password sign-up, sign-in, sign-out, session persistence across restarts.
- Email-verification screen with resend; forgot-password and reset-password (recovery deep link).
- Social sign-in (Google/Apple) code path via Supabase OAuth + PKCE — hidden until providers are configured.
- Account deletion (permanent; cascades all private data, opponents keep anonymised history).
- Onboarding: display name, unique username (live availability check), interface language, learning goals, IELTS target band/date, daily XP target. Proficiency is **not** asked.

**Assessment & proficiency**
- 15-question adaptive vocabulary assessment (meaning, synonym, antonym, fill-in-the-blank, contextual meaning), resumable, server-scored.
- Result: provisional A1–C2 level, score, strong areas, areas to improve, recommendations, explicit “not an official IELTS/CEFR result” disclaimer.
- Retake rules: 7-day cooldown, ±1 level per retake, unseen-question preference. Level history recorded. Users cannot edit their level (enforced by grants).

**Home dashboard** — greeting/avatar, level, daily-goal ring, streak, XP, words learned, due reviews, battle rating/stats, continue-learning shortcut, five action cards, personalised recommendations (due reviews, weakest skill/topic, goal, battle), recent quiz scores, IELTS card, notification badge, rejoin-battle banner.

**Learning**
- 12 vocabulary topics (incl. IELTS academic, phrasal verbs, idioms), 162 original entries with IPA, part of speech, definition, example, synonyms, antonyms, level, usage/IELTS notes; device text-to-speech pronunciation (British/American/Australian).
- Quizzes: daily, topic, synonyms & antonyms, words in context, sentence completion, grammar practice (49 grammar items), 20-question mixed practice test; server-checked answers with explanations; “save word” in-flow; results with missed-question review; anti-farming XP.
- Saved vocabulary with filters and SM-2 spaced-repetition review.
- Achievements (11 live, 2 reserved for later phases), in-app notification inbox, local daily reminder (native).

**Anonymous battles**
- Modes live: Vocabulary Duel, Synonym & Antonym, Sentence Challenge, Grammar Battle (IELTS Challenge reserved for Phase 3).
- Lobby, mode selection, practice-before-battle, matchmaking with widening window, ready check, synchronized countdown/timers, live scoreboard and opponent presence, reveal phase with explanations, results with rating change/XP/question review/save-word, history, recent opponents, daily/weekly/monthly/global leaderboards with opt-out.
- Server-authoritative scoring and timing, duplicate-proof answers, disconnection forfeits, void-without-penalty on double disconnect or server overrun, ready-timeout cancellation, forfeit, Elo ratings, anti-farming (unrated repeats), fast-answer flags, rate limiting, report + block (no private messaging).
- Premium-only opponent gender preference (optional, private, never revealed, availability-dependent).

**Profile & settings** — profile with read-only level and competitive stats, achievements, learning stats; edit profile (avatar, name, username, language, goals, target, IELTS band); appearance (system/light/dark); audio accent; notification preferences; privacy (leaderboard, battle identity, streak/badge visibility, gender, opponent preference, blocked users); account security; subscription plans (server-configured limits) and management (server-verified status and today's usage); help & FAQ.

**Administration (foundation)** — role-based RPCs with audit log: overview, reports, suspensions, battle issues, config changes, role grants, vocabulary/question upserts; minimal in-app moderation screen shown only to role holders.

## Features still pending

| Phase | Item |
|---|---|
| 2 | Camera/gallery capture, crop/rotate, OCR with word positions, interactive reader, contextual word popup, sentence/paragraph/page translation (incl. Bengali), simplify, read aloud of pages, reading history — **the Read tab currently offers manual word saving only, with clear Phase 2 labels** |
| 3 | Grammar lessons with explanations; reading, listening, writing, speaking practice; IELTS dashboard data, practice tests and results; multi-skill level confirmation; AI writing/speaking feedback |
| 4 | Store billing (RevenueCat), restore purchases, billing webhook; server push; admin web app; usage analytics UI |
| 5 | Error monitoring, analytics, load testing, accessibility audit, store assets, backups/runbooks |
| — | Interface translation (UI strings are English; the language preference is stored and will drive translations) |

## Database changes (migrations)

| File | Contents |
|---|---|
| `0001_core.sql` | `private` schema, `app_config` (plans/quotas, assessment, battle, modes, XP, rate limits), `profiles`, `user_progress`, `proficiency_history`, `daily_activity`, `learning_activities`, `user_skill_stats`, `user_roles`, `admin_audit_logs`, `subscriptions`, `usage_counters`, `rate_limits`, `notifications`, `push_tokens`; helpers (quota, rate limit, plan, time zone); sign-up trigger; profile/account RPCs |
| `0002_learning.sql` | Topics, vocabulary, question bank, word/skill stats, achievements, XP/streak engine, adaptive assessment, quizzes, saved vocabulary + SRS, recommendations, dashboard |
| `0003_battles.sql` | Ratings, queue, battles, participants, questions, answers, results ledger, integrity flags, blocks, reports; matchmaking, state machine, scoring, Elo, history, leaderboards, public profile, report/block; Realtime publication |
| `0004_admin.sql` | Audited admin/moderation/content RPCs |
| `0005_privileges.sql` | Explicit table/column/function grants (replaces Supabase defaults) |
| `0006_content.sql` | Generated original content: 12 topics, 162 entries, 643 questions |
| `0007_maintenance.sql` | `private.run_maintenance()` sweep, scheduled with pg_cron when available |

## Services requiring configuration

Required: a Supabase project (URL + anon key in `mobile/.env`), SMTP for
production email. Optional now: Google/Apple OAuth. Later phases: OCR and LLM
providers (Edge Function secrets), RevenueCat/App Store/Play, push
credentials, error monitoring. Details and every variable: `docs/SETUP.md`.

## Tests performed

| Suite | Result |
|---|---|
| Database integration (`tests/db`, 46 tests, real PostgreSQL 16 + Supabase auth/role shim) | **46 / 46 pass** — RLS isolation, column-level edit protection, hidden answers, anon denial, private helpers unreachable; adaptive placement (strong→C1/C2, weak→A1, mixed→B1/B2), no repeated words, retake cooldown and ±1 cap; quiz scoring/idempotency/repeat-XP, topic/type filters, collection limit from config, SM-2 scheduling, dashboard, weak-area recommendation, streak continue/reset; full duel with Elo and rewards granted once, duplicate/late answer rejection with server timing, draw, disconnect forfeit, double-disconnect void with quota refund, ready timeout, forfeit/reconnect, block + report, level-first matching that widens, stale queue, premium-only gender preference, daily quota, anti-farming, leaderboards with opt-out; 10-player concurrent matchmaking without double-booking, simultaneous answers, rate limiting, admin RBAC + audit log, content-editor upserts, account deletion; maintenance sweep |
| End-to-end (`tests/e2e`, Playwright + Chromium, real web build, 390×844) | **Pass** — sign-up → profile → 15-question assessment → dashboard → 10-question quiz with feedback → save words → reload (session and progress persist) → review; two separate accounts → lobby → matchmaking → ready → 3 synchronized questions → both screens show the same server result (Victory +20 / Defeat −20), 6 answers recorded, history/leaderboard/read screens render; **0 client errors** |
| Static checks | `tsc --noEmit` clean; `expo lint` (incl. React Compiler rules) clean; `expo export --platform web` succeeds |

Screenshots from the E2E run: `docs/screenshots/`.

Not yet tested: physical iOS/Android devices (no simulators in this
environment — the web build exercises the same React code), real Supabase
Realtime delivery (E2E used polling), real email delivery and OAuth.

## Known issues / limitations

- Realtime is an accelerator only; under load the 1 s polling (also the presence heartbeat) costs roughly one RPC per player per second during a battle. Fine for MVP scale; a dedicated realtime service or Broadcast-based heartbeat is the next step if concurrency grows.
- Matchmaking is driven by players' polling (no background matcher); the window widens only while players keep polling (the app does this automatically).
- Leaderboards show usernames; a rating seen during an anonymous battle could in principle be correlated with a leaderboard entry. Opting out of leaderboards removes this.
- Interface strings are English only; the chosen language is stored for Phase 2 translations.
- Pronunciation uses device TTS; `audio_url` is supported in the schema but no recorded audio is bundled.
- `subscription` purchase/restore buttons are intentionally disabled until store billing is configured; premium can only be granted by a server-side subscription row.
- The template's Expo `LICENSE` file was removed; choose a license for the project.

## How to run

See `docs/SETUP.md`. Short version:

```bash
cd vocabattle && npx supabase link --project-ref <ref> && npx supabase db push
cd mobile && npm install && cp .env.example .env   # add URL + anon key
npm start
# tests (needs local Postgres): cd ../tests && npm install && npm test && ./e2e/run.sh
```
