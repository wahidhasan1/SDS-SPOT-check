# Architecture

## Overview

```
 Web (React/Vite) ─┐                         ┌─ PostgreSQL (all persistent state)
 Android (Expo)  ──┼── HTTPS REST + WSS ── API server (Fastify, Node 22) ──┼─ Tesseract OCR (local process)
 iOS (Expo)      ──┘        │                   │                         ├─ WordNet dictionary (local files)
                            │                   │                         └─ Optional: Claude, STT, LibreTranslate,
        WebRTC audio (peer-to-peer, STUN/TURN)  │                            Resend, Stripe, RevenueCat, Expo Push
 Caller A  ◀──────────────────────────────▶ Caller B
```

* **One backend, one account system.** Every client uses the same REST API and WebSocket endpoint, so progress, saved
  words, drafts, call history and subscriptions are shared across devices automatically. Clients never talk to the
  database directly; every query is scoped to the authenticated user on the server (the equivalent of row-level security).
* **Shared package** (`packages/shared`): DTO types, zod request schemas (validated on the server, reused in forms),
  the API client (refresh-token rotation), the realtime client (auto-reconnect), the WebRTC `CallSession` used unchanged
  by web and mobile, and pure learning rules (IELTS band tables, SM-2 spaced repetition, adaptive CAT maths, Elo, text metrics).

## Authentication

Short-lived JWT access tokens (15 min) + opaque refresh tokens stored hashed (30 days) with rotation; reuse of a rotated
token revokes all sessions (theft detection). Passwords use scrypt. Login lockout after repeated failures; per-IP rate
limits on auth routes. Admin checks read the role from the database on every request.

## Voice calling

1. **Matching queue** (`match_queue`, one row per user) — joining validates age (18+ for live calls), suspension,
   plan entitlements (daily calls, premium topics, preferences) and rate limits.
2. **Matcher** runs on join and every 2 s inside a transaction guarded by a Postgres advisory lock (safe across instances).
   Pairs need the same mode, compatible topics, no block in either direction, and similar CEFR level; the allowed level
   gap widens every 15 s of waiting. Recent partners are avoided unless both have waited.
3. **Atomic reservation** — the pair is written in one transaction: `call_sessions`, two `call_participants`
   (with anonymous name/avatar/level snapshots) and two `user_active_calls` rows (primary key = one active call per user).
4. **Signalling** over the WebSocket: the server relays SDP/ICE only between the two participants of an active call.
   Each user gets short-lived TURN credentials (coturn REST API format).
5. **Connected** is recorded only when *both* clients report a working ICE connection; only then does the call count
   against daily allowances.
6. **Ending** is idempotent (row lock + status check): hang-up, partner disconnect (20 s grace), connection failure,
   connect timeout (45 s), plan time limit (60 s warning), block, or moderation. Clients stop microphone tracks and close
   the peer connection; the server records duration and reason.
7. **Safety** — anonymous identities, blocks applied in matching on every platform, reports tied to real calls/battles,
   automatic 24 h pause after reports from three different users, admin moderation with audit log. Calls are never recorded.

## IELTS practice and scoring

* Practice sets store question content and answer keys separately; answer keys and listening transcripts never leave
  the server before submission.
* Objective scoring (`scoreSet`) handles choice, matching and gap-fill types, alternatives (`a|b`), optional words
  (`[the] permit`), case/punctuation/currency normalisation and word limits.
* Raw scores convert to bands with widely published 40-question tables (Listening, Academic Reading, GT Reading).
  Shorter sets are scaled to 40 and flagged as estimates. Overall band uses IELTS rounding (.25 → .5, .75 → next whole).
* Writing: measurable checks always (length, paragraphs, overview/position/conclusion, linking, sentence variety,
  repetition, register, spelling via WordNet); AI criteria-based feedback with unofficial band estimates only when configured.
* Speaking: transcript from the browser/device recogniser (or server STT), statistics always; AI feedback when configured.
  Pronunciation is never claimed because only transcripts are analysed.
* Mock tests: sections run in order with server-side deadlines; late saves are rejected and expired sections are
  auto-submitted; strict mode allows one listening playback. Writing band = (Task 1 + 2 × Task 2) / 3.

## Separate measures (never combined)

1. English level — adaptive placement (CEFR, history kept, retakeable).
2. IELTS practice estimates — per skill from recent scored attempts.
3. Vocabulary & grammar performance — SRS intervals, lesson scores.
4. Battle rating — Elo from ranked battles only.

## Data model (main tables)

`users`, `user_profiles`, `auth_sessions`, `password_resets` · `plans`, `subscriptions`, `billing_events`, `usage_counters` ·
`assessment_items`, `assessments`, `assessment_responses`, `proficiency_history` · `vocabulary`, `saved_words`, `word_reviews`,
`grammar_lessons`, `grammar_exercises`, `grammar_attempts`, `quiz_attempts` · `ielts_sets`, `practice_attempts`,
`writing_prompts`, `writing_submissions`, `writing_drafts`, `speaking_prompts`, `speaking_sessions`, `mock_tests`, `mock_attempts` ·
`match_queue`, `call_sessions`, `call_participants`, `user_active_calls`, `user_blocks`, `user_reports` ·
`battle_sessions`, `battle_participants`, `battle_answers` · `ai_reading_sessions`, `word_lookups` ·
`activity_log`, `notifications`, `push_tokens` · `content_review_queue`, `admin_audit_log`, `app_config`.

Migrations live in `apps/server/src/db/migrations`; content seeds in `apps/server/content` are idempotent upserts.
