# BODYQUEST

**Build Your Body. Beat Your Limits.** A gamified home-fitness and body-transformation web app: personalised equipment-free training plans, visual exercise manuals, affordable food planning, hydration, streaks that respect rest, progress tracking and fair fitness battles.

This is a **local development build**: a complete React + TypeScript single-page app with persistent browser storage and a demo authentication layer. No backend, database, AI or push service is connected. Everything that would need one is clearly labelled in the UI and listed below.

---

## Run it

Requires Node 18+ (tested on Node 22).

```bash
cd bodyquest
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build (http://localhost:4173) |
| `npm test` | Unit and integration tests (Vitest), 104 tests |
| `npm run build:demo` | Single-file demo build in `dist-demo/` |
| `npm run test:e2e` | Playwright end-to-end tests on desktop and mobile viewports (builds and serves automatically) |
| `npm run typecheck` | TypeScript only |

The production build is a static SPA. Any static host works if it rewrites unknown paths to `index.html` (client-side routing).

### Demo

* **Live demo account:** on the landing page (or sign-in page) tap **Try the live demo**. It creates a local account with ~3½ weeks of sample history built by replaying the app’s real actions: completed workouts, a missed session saved with a recovery token, a comeback session, meals, water, sleep, performance tests, a finished battle and a live one. Today’s workout is left for you to do. The account is labelled as a demo throughout.
* **Single-file demo build:** `npm run build:demo` produces `dist-demo/index.html`, one self-contained 600 kB file with in-memory routing. Open it straight from disk, or host it anywhere. It also writes `dist-demo/bodyquest.html`, the same page without the `<html>/<head>/<body>` wrapper, for hosts that supply their own skeleton.
* `npm run demo` builds and serves the normal production app at http://localhost:4173.

**Trying time-based features quickly:** *Settings → Developer tools → Advance 1 day / 7 days* shifts the app clock on this device. You can use it to see missed-session recovery, streaks, recovery tokens and battle results without waiting.

---

## What’s in the app

All 25 required pages exist and are linked from the sidebar (desktop) or the bottom bar plus the “More” sheet (mobile):

Landing · Sign up · Sign in · Onboarding wizard (Body profile → Goal → **Body-goal gallery** → **Training pattern** → Timeline → **Plan review**) · Dashboard · Today’s workout · Exercise library · Exercise detail · Food planner · Hydration · Daily checklist · Streak calendar · Fitness battles (dashboard / leaderboard / history) · Find an opponent · Battle details & results · Progress · Achievements · Notifications · Profile · Workout schedule · Settings · Privacy & safety · Coach.

### Feature status (be honest about what’s real)

| Area | Status |
| --- | --- |
| Onboarding, validation, metric/imperial units, readiness screen | ✅ Fully functional |
| Rules-based plan & workout generation (exercise DB + safety rules, phases, milestones, deload weeks, recovery-aware weekly schedule) | ✅ Fully functional, deterministic, no LLM |
| Workout player: sets/reps/time logging, ratings, rest & hold timers, pause/resume, skip with reason, approved replacements, symptom reporting with triage, completion rules, summary | ✅ Fully functional; survives refresh |
| Exercise library: 67 exercises with generated two/three-frame SVG illustrations | ✅ Fully functional. Illustrations are generated from a pose system, so there are no third-party images and no broken links |
| Opt-in progressive overload (suggestions from logged performance; never automatic) | ✅ Fully functional |
| Streaks, rest days, overdue window, reschedule, comeback sessions, recovery tokens, unwell days | ✅ Fully functional |
| XP, levels, daily/weekly missions, 15 achievements, anti-farming idempotent awards | ✅ Fully functional |
| Food planner, meal replacement, “what I actually ate” logging, allergy/diet filtering, energy & protein ranges | ✅ Functional with **sample food data** (approximate values, clearly labelled; unknown values are `null`, never invented) |
| Hydration targets, logging, edit/delete, overdrinking warnings, medical fluid limit | ✅ Fully functional |
| Hydration reminders | ⚠️ Only while the app is open in a browser tab (Notification API / in-app toast). Needs a push service for real reminders |
| Progress charts, PRs, weekly consistency, workout history | ✅ Fully functional |
| Progress photos | ✅ Stored only in this browser (IndexedDB), blurred by default, never shared |
| Fitness battles, matchmaking, invitations, scoring, leaderboard, results, history | ⚠️ Functional in **development mode with labelled demo opponents** (simulated deterministically). No live multiplayer. |
| Notifications | ✅ In-app only. No push/email |
| Coach | ⚠️ **Rule-based demo coach** grounded in the plan, exercise library and safety rules. No AI service is connected |
| Authentication | ⚠️ **Demo auth**: local accounts with PBKDF2-hashed passwords, plus guest mode. Not production security, no cross-device sync |
| Data export & account deletion | ✅ Functional (JSON export; delete removes all slices and photos) |

---

## Architecture

```
src/
  domain/types.ts        Typed entities (User, UserProfile, TrainingPlan, TrainingPhase, Workout,
                         WorkoutExercise, Exercise, WorkoutSession, WorkoutSet, MealPlanDay, Meal,
                         FoodLogEntry, HydrationEntry, Battle, BattleParticipant, ProgressEntry,
                         AppNotification, RecoveryToken, XpEvent, UserAchievement …)
  data/                  Static, centralised content: exercises, foods (sample), meals,
                         achievements/missions/challenges, body goals, demo opponents
  illustrations/         Pose library + forward-kinematics figure renderer (SVG)
  services/              Pure business logic (no React, no storage), all unit-tested:
    plan.ts                pattern recommendation, phases, milestones, recovery-aware week
    workoutGenerator.ts    rules-based session builder (slots, difficulty targets, time budget)
    safety.ts              limitations, contraindications, age rules, symptom triage, red flags
    substitution.ts        approved alternatives
    session.ts             workout state machine + completion rules
    progression.ts         opt-in progressive overload suggestions
    schedule.ts            day status, streaks, completion window, rescheduling, tokens
    xp.ts                  idempotent XP ledger, levels
    battle.ts              matchmaking, capped scoring, demo simulation
    nutrition.ts           energy/protein ranges, meal filtering, approximate totals
    hydration.ts           targets, validation, overdrinking warnings
    analytics.ts           series, moving averages, PRs, consistency
    coach.ts               rule-based coach
  store/                 Persistence & state
    storage.ts             StorageAdapter (localStorage / in-memory); swap for an API client
    auth.ts                demo auth (PBKDF2)
    userData.ts            per-user data split into independently persisted slices
    actions.ts             every state transition as a pure (data, env, …args) → data function
    sync.ts                idempotent derived-state sync (missions, achievements, tokens, battles)
    selectors.ts, hooks.ts derived values for the UI
    AppStore.tsx           React provider: run(action) → sync → persist → toasts
  components/            Design system (ui.tsx), layout, charts, exercise detail, visuals
  pages/                 One file per page/feature
  styles/                CSS design tokens with light/dark themes
e2e/                     Playwright acceptance tests
```

Key rules live in the services and are documented at the top of each file:

* **Completion:** a workout counts only with ≥70% of main sets logged (sets skipped for pain are excused) and at least 3–5 minutes of active, unpaused time. Opening the page never counts.
* **Streak:** consecutive planned sessions kept. Rest days are neutral, unwell days are excused, and missed sessions can be resolved within 2 days. Only one full workout per day.
* **XP:** every award has an idempotency key. Nothing rewards extra workouts, pain, less sleep, eating less or overdrinking.
* **Battles:** at most 100 points per week, proportional to each person’s *own* schedule. Extra training earns nothing, and an equal score is a tie.

### Adding an exercise
Add an entry to `src/data/exercises.ts` (instructions, dosing per level, contraindications, alternatives) and point its frames at poses in `src/illustrations/poses.ts`. You can add new poses there as joint angles. In dev, `/dev/poses` renders every pose for visual QA. The planner, library, substitution engine and coach pick the new exercise up automatically, and a unit test checks that every exercise has valid poses and references.

---

## Making it production-ready

See **[docs/PRODUCTION.md](docs/PRODUCTION.md)** for what’s needed (backend, relational schema, real auth, server-side authorisation and battle scoring, verified food database, push notifications, optional AI coach) and the suggested schema in `docs/schema.sql`.

## Safety

BODYQUEST is general fitness guidance, not medical advice. See the in-app *Privacy & Safety* page.
