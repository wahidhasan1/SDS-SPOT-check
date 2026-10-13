# Development progress log

_Last updated: 2026-10-13_

## Status by area

Legend: ✅ implemented and verified by automated tests · 🟡 implemented, needs external setup or device verification · ⬜ not started

| Area | Status | Notes |
|---|---|---|
| Monorepo, shared package, design system (light/dark) | ✅ | |
| Auth: register/login/refresh rotation/logout/reset/change password/delete account/export | ✅ | Reset emails need `RESEND_API_KEY` in production 🟡 |
| Onboarding, profile, goals, privacy, notification prefs, anonymous identity | ✅ | |
| Adaptive placement test (CEFR) with history | ✅ | 60-item original bank incl. listening audio |
| **Real voice calling** (matching, signalling, WebRTC, mute, end, history) | ✅ web↔web, ✅ mobile codebase↔web (web build) | 🟡 native Android/iOS calls need device testing; 🟡 TURN server for strict networks |
| IELTS Speaking partner mode (roles, Part 1–3 script, synced steps, timers) | ✅ (UI + relay) | |
| Reporting, blocking, auto-moderation, admin moderation | ✅ | |
| Free/premium call limits (calls/day, minutes, topics, preferences) | ✅ | Limits editable in Admin › Plans |
| IELTS Reading (5 sets, 14 question types) & Listening (4 sections, 40 Qs, Piper TTS audio) | ✅ | Original content |
| Writing (14 prompts, charts/process/maps, autosave, draft history, measurable checks) | ✅ | 🟡 AI criteria feedback + bands need `ANTHROPIC_API_KEY` |
| Speaking solo practice (timers, consent, transcription, statistics) | ✅ | 🟡 AI feedback needs key; 🟡 server STT optional |
| Mock tests (Academic & GT, strict timing, section flow, results) | ✅ | Writing/Speaking bands need AI key |
| Vocabulary (157 words, daily words, SRS, quizzes), grammar (12 lessons, 72 exercises) | ✅ | |
| Battles (8 types, solo + ranked real-time, Elo, leaderboard, report/block) | ✅ | Battle queue is per server instance |
| AI reading (camera/upload, crop/rotate, OCR, tap-a-word, corrections, save, translate) | ✅ OCR + dictionary | 🟡 AI meanings/translation need keys |
| Dashboard, progress, study plan, recommendations | ✅ | |
| Notifications (in-app, reminder job, Expo push registration) | ✅ in-app | 🟡 push needs EAS project id |
| Subscriptions: Stripe (web), RevenueCat (mobile), entitlements, admin grants | ✅ server verification tested | 🟡 real billing not activated (needs accounts/products) |
| Admin console (stats, reports, users, plans, content JSON editors, topics, AI review queue, media, audit) | ✅ | |
| Web app (desktop + responsive) | ✅ | |
| Android & iOS app (Expo) | ✅ bundles build, typecheck | 🟡 native builds not produced here (no Android SDK/Xcode in this environment) |
| Docker/compose, coturn config, env examples, EAS config | ✅ written | 🟡 images not built in this environment |

## Log

- **Foundation** — inspected repo (only an unrelated single-file tool, kept untouched); chose Node/Fastify + Postgres
  backend (portable to any Postgres host), React/Vite web, Expo mobile, shared TS package.
- **Calling first** — built matching/signalling/lifecycle and the shared WebRTC `CallSession`; verified real two-way audio
  between two accounts in Chromium before building learning features.
- **Content** — wrote original vocabulary, grammar, placement items, IELTS passages/sections/prompts; synthesised
  listening audio offline with Piper neural TTS.
- **Services** — Claude structured-output feedback (optional), WordNet dictionary with context-based sense selection,
  Tesseract OCR, STT and translation providers, deterministic writing/speaking analysis.
- **Web app** — all features; screenshot review at desktop and phone widths; route-level code splitting.
- **Bugs found by testing and fixed** — CORS default blocked browser PUT/PATCH/DELETE (autosave/profile); `£50` marked
  wrong in listening; "others" flagged as misspelt; WordNet best sense clamped by display limit; OCR paragraph splitting;
  empty JSON bodies rejected; admin upload extension taken from client filename.
- **Mobile app** — all core screens; native WebRTC, speech recognition, camera, audio, push, RevenueCat; Metro bundles for
  Android/iOS/web; mobile-codebase ↔ web call verified with audio.

## Outstanding / next steps

1. Run the native calling matrix on real Android and iOS devices (dev builds) with a TURN server; tune audio routing
   (speaker vs earpiece) with `react-native-incall-manager` if needed.
2. Configure `ANTHROPIC_API_KEY` and review AI feedback quality against a set of graded sample essays/transcripts.
3. Create Stripe/RevenueCat products and run sandbox purchase, renewal, cancellation and restore tests.
4. Expand content (more reading/listening sets, vocabulary) through the admin console and AI review queue.
5. Pronunciation assessment is intentionally not offered; adding it requires a provider with phoneme-level scoring.
6. Move the battle queue to Postgres (like call matching) before running multiple realtime instances.
