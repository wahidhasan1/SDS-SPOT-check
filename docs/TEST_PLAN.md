# Test plan

## Automated (run on every change)

| Suite | Command | What it covers |
|---|---|---|
| Shared unit tests | `npm test -w packages/shared` | Band conversion & IELTS rounding, answer normalisation/alternatives/word limits, SM-2, adaptive theta/CEFR, Elo, text metrics |
| Server integration | `npm test -w apps/server` (needs `fluentpath_test` DB) | Registration rules, login/lockout, refresh rotation & theft detection, password reset single-use, account deletion, cross-user authorization, answer-key secrecy, scoring, timed auto-submit, atomic quotas under concurrency, Stripe signature + idempotency, RevenueCat lifecycle, admin plan validation + audit, TURN credentials, matching rules, live WebSocket matching (single match, no second active call, idempotent end), under-18 restriction, call limits, premium topics, auto-moderation |
| E2E — calls | `npm run test:e2e -- e2e/call.spec.ts` | Two separate accounts in two browser contexts: matching, **two-way audio verified by RTP byte counts and received audio levels**, playing remote `<audio>`, mute → silence at partner, unmute, hang-up ends both, peer connection released, history stored; blocked users never re-matched; mic permission denial |
| E2E — learning | `npm run test:e2e -- e2e/learning.spec.ts` | UI registration + validation, onboarding, 20-question adaptive placement, logout/protected routes/invalid login/session persistence, reading autosave + reload + scoring + explanations, listening real audio playback + transcript after submit, writing autosave + cross-device draft + honest feedback, vocabulary sync web↔mobile API, OCR photo → tap word → contextual meaning → save, two-player ranked battle (synced questions, Elo zero-sum), strict mock section + monthly limit + client can't self-grant premium + admin grant |
| E2E — mobile codebase | `npm run test:e2e -- e2e/mobile-web.spec.ts` (serve `expo export -p web` on :8081) | Expo app code (react-native-web build) calling a web-app user with two-way audio, mute propagation, hang-up; vocabulary saved on mobile visible on web |
| Builds | `npm run typecheck`, `npx vite build`, `npx expo export -p android|ios|web` | Type safety for all packages; production bundles for web, Android and iOS |

E2E environment: API on :4000 (with `AUTH_RATE_LIMIT_PER_MIN=1000` because tests register many users from one IP), web on :5173.
Chromium runs with fake microphone devices; the tests assert real WebRTC media statistics, not UI state.

## Manual test cases (require real devices / credentials)

### Native calling matrix — must be run on hardware before release
For each pair below: both users tap Start Call → matched → both hear each other → mute/unmute on each side →
either side ends → both see the summary and history; repeat with one side on mobile data (TURN required).

| # | Caller | Callee | Status |
|---|---|---|---|
| 1 | Android | Android | Not yet run (no devices in build environment) |
| 2 | iOS | iOS | Not yet run |
| 3 | Web | Web | **Automated ✓** |
| 4 | Android | iOS | Not yet run |
| 5 | Android/iOS | Web | Mobile codebase ✓ via web build; native not yet run |
| 6 | Web | Android/iOS | Mobile codebase ✓ via web build; native not yet run |

Also verify on devices: microphone permission denied → clear message and Settings guidance; app backgrounded during a
call (audio continues; returning shows correct state); airplane-mode toggle mid-call → "reconnecting" then recovery or
clean end within ~20 s; Bluetooth headset routing; incoming phone call interruption.

### Integrations (once keys are configured)
- AI writing feedback returns criteria, band estimate labelled unofficial, quoted errors; quota decremented and refunded on provider error.
- AI contextual meaning for idioms/phrasal verbs; OCR-suspect flag on garbled words; translation into the profile language.
- Stripe: checkout → webhook → Premium on web *and* mobile; cancel at period end; failed payment notification; portal.
- RevenueCat: sandbox purchase, restore on a second device, expiry, billing issue.
- Push: daily reminder at the chosen local hour; vocabulary review reminder; no duplicates in one day.
- Password reset email delivered and link single-use.
