# Vocabattle — Architecture

## 1. Overview

```
┌──────────────────────────────┐        HTTPS (anon key + user JWT)        ┌──────────────────────────────────────────┐
│  Mobile app (Expo SDK 57)    │ ────────────────────────────────────────▶ │  Supabase                                 │
│  React Native + TypeScript   │   Auth  /auth/v1   (sign-up, sessions)     │  ├─ Auth (GoTrue)                         │
│  expo-router, React Query    │   Data  /rest/v1/rpc/*  (50 RPCs)         │  ├─ PostgREST → PostgreSQL 15+            │
│                              │   Realtime  (battle + queue row changes)  │  │    • RLS on every table                 │
│  • no secrets, no scoring    │ ◀──────────────────────────────────────── │  │    • SECURITY DEFINER RPCs (all logic)  │
│  • renders server state      │                                            │  ├─ Realtime (postgres_changes)          │
└──────────────────────────────┘                                            │  └─ pg_cron → private.run_maintenance()   │
                                                                            └───────────────┬──────────────────────────┘
                                                Phase 2+ (designed, not built)              │ service role only
                                                ┌───────────────────────────────────────────▼──────────────────┐
                                                │ Edge Functions: ai-gateway (OCR, contextual meaning,          │
                                                │ translation), billing-webhook (RevenueCat), push-dispatch     │
                                                └──────────────────────────────────────────────────────────────┘
```

**Principle:** the database is the single source of truth and the only place
where anything competitive or progress-related is decided. The client sends
*choices* (an option index, a preference) and renders what the server returns.

### Why this stack

| Need | Choice | Reason |
|---|---|---|
| iOS + Android from one codebase | Expo SDK 57, React Native 0.86, TypeScript, expo-router | Requested stack; file-based routing; OTA updates via EAS; web build used for E2E tests |
| Auth, data, realtime | Supabase (Postgres + RLS + Auth + Realtime) | Requested; RLS lets the mobile app talk to the DB directly without a bespoke API server |
| Server-authoritative game logic | PL/pgSQL `SECURITY DEFINER` functions | Atomic with the data (row locks, unique constraints), no extra service to run, testable on plain Postgres |
| Real-time battles | Lazy state machine + Realtime notifications + 1 s polling | No long-running game server needed for 1-v-1 quiz battles; polling doubles as the presence heartbeat; Realtime makes updates instant when available |
| Server state on the client | TanStack Query | Caching, retries, loading/error states, refetch on focus |

A dedicated WebSocket game server would only be warranted for sub-second
mechanics or very high concurrency; the design keeps that door open because
all rules live behind RPCs that a future service could call.

## 2. Repository layout

```
vocabattle/
├── mobile/                  Expo app
│   └── src/
│       ├── app/             routes (expo-router) — see "Screens" below
│       ├── components/      ui/ (design system), learning/ (question card, TTS), auth/
│       ├── hooks/           use-battle (live battle sync), use-now (server-corrected clock)
│       ├── lib/             api.ts (typed RPC wrappers), supabase.ts, types.ts, errors.ts, …
│       ├── providers/       auth, theme (light/dark/system), react-query
│       └── constants/       design tokens (colours, spacing, type scale)
├── supabase/
│   ├── migrations/          0001 core · 0002 learning · 0003 battles · 0004 admin ·
│   │                        0005 privileges · 0006 content (generated) · 0007 maintenance
│   └── config.toml          Supabase CLI local config
├── content/                 original vocabulary, context & grammar questions (source of 0006)
├── scripts/                 generate-content.mjs (question-bank generator + validator)
├── tests/
│   ├── db/                  46 integration tests (node:test) against real Postgres
│   ├── e2e/                 Playwright journeys driving the real web build
│   └── dev-gateway.mjs      DEV-ONLY stand-in for Supabase Auth/PostgREST used by E2E
└── docs/                    this file, SETUP.md, PHASE1_REPORT.md, screenshots/
```

## 3. Data model (35 tables)

| Area | Tables |
|---|---|
| Identity & config | `profiles` (user-editable presentation/preferences), `user_progress` (server-owned level, XP, streak), `app_config` (central quotas, timings, XP rules, modes), `user_roles`, `admin_audit_logs` |
| Proficiency | `assessments`, `assessment_responses`, `proficiency_history` |
| Content | `vocab_topics`, `vocabulary_entries`, `questions` (never client-readable), `achievements` |
| Learning | `quiz_attempts`, `quiz_responses`, `user_vocabulary` (SRS), `user_word_stats`, `user_skill_stats`, `daily_activity`, `learning_activities`, `user_achievements` |
| Battles | `matchmaking_queue`, `battles`, `battle_participants`, `battle_questions`, `battle_answers`, `battle_results`, `battle_ratings`, `battle_integrity_flags` |
| Safety | `blocked_users`, `user_reports`, `rate_limits` |
| Monetisation | `subscriptions` (written only by the billing webhook), `usage_counters` |
| Messaging | `notifications`, `push_tokens` |

Phase 2–3 tables (reading documents, OCR results, word lookups/cache,
translations, AI usage, reading/listening/writing/speaking exercises and
submissions, IELTS tests) are specified in §8 and will be added as new
migrations.

## 4. Security model

1. **RLS on every table.** User-owned rows are visible only to their owner
   (`user_id = auth.uid()`). Tables such as `questions`, `battle_answers`,
   `battle_participants`, `user_reports` have *no* client policy at all.
2. **Explicit grants** (`0005_privileges.sql`). Supabase's default “grant all”
   is revoked. Clients get `SELECT` on a short list; `UPDATE` only on
   presentation columns of `profiles` (column-level grant) and `read_at` of
   notifications; `DELETE` on their own saved words/notifications.
   Users therefore *cannot* change level, XP, streak, ratings, onboarding
   state, roles or subscriptions — verified by tests.
3. **All logic in `SECURITY DEFINER` RPCs** with `search_path = ''` and fully
   qualified names. Each RPC authenticates (`auth.uid()`), authorises
   (ownership / role), validates input and rate-limits where relevant.
   Internal helpers live in the unexposed `private` schema.
4. **Answers are never sent before they are needed.** Questions are served
   without `correct_index`; the correct answer is revealed only after the
   player locks in (quiz) or the question closes for both players (battle).
5. **Anonymity.** Battle state exposes only pseudonym, avatar, level and
   rating — never account ids. Reports/blocks reference the *battle*; the
   server resolves the opponent.
6. **Anonymous role** can call nothing.
7. **Admin** RPCs check `user_roles` server-side and write `admin_audit_logs`;
   they never return emails, passwords or tokens.
8. **Secrets**: only the public URL + anon key ship in the app. AI/OCR keys,
   the service-role key and billing secrets live in Edge Function secrets.

## 5. Proficiency assessment

* 15 questions, adaptive staircase: start at difficulty 3 (B1); correct →
  `ability += step`, wrong → `ability -= step`; step decays 1.2 → ×0.8 → min 0.35.
* Question choice: target difficulty, rotating type (meaning, fill-blank,
  synonym, context, antonym), **never the same word twice**, unseen questions
  preferred across attempts (anti-memorisation).
* Result: `level = round(ability)` → A1…C2; score = accuracy; strengths /
  weaknesses by question type relative to overall accuracy; recommendations.
* Always stored as **provisional** — vocabulary alone never confirms overall
  proficiency (confirmation needs the Phase 3 multi-skill assessments).
* Retakes: 7-day cooldown (configurable); a retake moves the level by at most
  one step; in-progress attempts resume instead of re-rolling for easier items.

## 6. Battles

### Matchmaking (`join_matchmaking`, polled every 2 s)
* Upserts the caller's queue row (`last_poll_at` = availability heartbeat).
* Finds an opponent with `FOR UPDATE SKIP LOCKED` (no double-booking — tested
  with 10 concurrent players): same mode, not blocked either way, fresh
  heartbeat, gender preference honoured both ways (premium only), level
  within ±1 (±2 after 15 s, any after 45 s) and rating within
  `150 + 15·seconds_waited`, nearest level/rating first.
* Pairs repeated more than `rated_pair_limit_per_day` times are **unrated**
  (anti-farming) and flagged.

### State machine (`private.advance_battle`, run under the battle row lock by every battle RPC and by the maintenance sweep)

```
pending ──both ready──▶ active ──last question closes──▶ completed
   │ready timeout                │one player silent 30 s ─▶ completed (forfeit)
   ▼                             │both silent 30 s ───────▶ void (no penalty, quota refunded)
cancelled                        │over max duration ──────▶ void
                                 └forfeit ────────────────▶ completed
```

* Question *i* opens at `close(i-1) + reveal_ms` (first: `start + countdown`)
  and closes when both have answered or at `deadline + grace`.
* `submit_battle_answer`: accepted only for the open question inside its
  window; `PRIMARY KEY (battle_id, idx, seat)` makes duplicates impossible.
  Response time = `now() − opens_at` measured by the server. Points =
  100 + up to 50 speed bonus. Sub-350 ms answers are counted and flagged.
* Scores become visible only when a question closes (an early correct answer
  does not leak through the scoreboard).
* `end_battle` is the only place results, Elo (K = 40 provisional / 24),
  battle XP (daily-capped; result bonus requires a correct answer),
  achievements and the `battle_results` ledger are written — exactly once,
  guarded by the status transition under lock.
* Clients: `useBattle` polls `get_battle_state` every second (heartbeat),
  refreshes instantly on Realtime `battles.version` changes, estimates the
  server clock offset from `server_now` so countdowns match, and discards
  out-of-order responses. Reopening the app finds the live battle via
  `get_active_battle`.

## 7. Learning, XP and streaks

* Quizzes: one question per word, near the learner's level, unseen/missed
  first; each answer checked server-side and idempotent; XP granted once at
  finish. A question answered correctly in the last 7 days earns 2 XP instead
  of 10, so farming known items is not worthwhile.
* Spaced repetition: SM-2 variant (`review_word`), grades again/hard/good/easy,
  double-tap protection, mastered at ≥ 21-day interval.
* Streaks use the learner's own time zone; a day counts when a quiz, battle,
  review or assessment is completed. Daily caps on battle and review XP.
* Recommendations combine due reviews, weakest skills (`user_skill_stats` by
  question type and topic), the daily goal and battle activity.

## 8. Phase 2–5 design notes (not yet built)

**AI reading assistant (Phase 2).** Upload page image → Storage bucket
`reading-pages/{user_id}/…` (private, RLS) → Edge Function `ai-gateway`
calls an OCR provider that returns *word-level bounding boxes* → stored in
`ocr_results(words jsonb: [{text, bbox, line, paragraph}])`. The reader
renders the page image with tappable word boxes (layout mode) or a reflowed
paragraph list where every token keeps its OCR index (reflow mode), so a tap
maps to an exact word. Tapping sends only the sentence + one neighbouring
sentence to `ai-gateway`, which calls the configured LLM provider through a
provider interface with structured JSON output, validates it, caches by
`(lemma, sentence_hash, target_language)` in `word_lookups`, and debits
`ai_word_lookups_per_day` via `private.consume_quota`. Whole-page translation
is cached per document + language in `translations`. Users can delete
documents/images (cascade + storage delete).

**IELTS & four skills (Phase 3).** Exercise tables per skill, practice tests
with timed sections, writing/speaking submissions with AI feedback stored as
*practice estimates*; multi-skill results allow `proficiency_status =
'confirmed'`.

**Premium & admin (Phase 4).** RevenueCat → `billing-webhook` Edge Function
(signature-verified) upserts `subscriptions`; entitlements are already
enforced server-side via `private.user_plan` / `plan_limit` and all quotas
read `app_config.plans`. Separate admin web app on the existing admin RPCs.

**Production readiness (Phase 5).** Sentry (or similar) in the app and Edge
Functions, privacy-respecting analytics, load tests for matchmaking, backups
(Supabase PITR), accessibility audit, store assets.
