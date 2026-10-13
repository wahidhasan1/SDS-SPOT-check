# Taking BODYQUEST to production

The local build keeps a strict boundary between UI, business logic (`src/services`, pure and tested), and persistence (`src/store`). Moving to production mainly means replacing the persistence/auth layer and moving trust-sensitive logic to a server. The services can run unchanged on a Node backend.

## 1. Backend & database

* API service (e.g. Node/TypeScript with Fastify or NestJS) that reuses `src/services/*` and `src/data/*`.
* Relational database (PostgreSQL recommended). The suggested schema is in [`schema.sql`](schema.sql). Each `UserData` slice in `src/store/userData.ts` maps to one or more tables.
* Replace `LocalStorageAdapter` with an API client that implements the same repository operations. `actions.ts` becomes a set of API endpoints that run the same pure functions server-side.
* Migrations, backups, and encryption at rest for health-related columns (readiness answers, limitations, measurements).

## 2. Authentication & authorisation

* Replace `store/auth.ts` (demo PBKDF2 in the browser) with a real identity provider (OIDC/OAuth, or server-side Argon2id with HTTP-only, Secure, SameSite cookies), email verification, password reset, rate limiting and lockout.
* **Every private row is scoped by `user_id` and checked on the server.** Never trust a client-supplied user id. Row-level security in Postgres is a good belt-and-braces measure.
* Age gating: verify the 13+ requirement and apply under-18 safeguards server-side (no calorie targets, teen-only matchmaking).

## 3. Server-side scoring (anti-cheat)

* XP awards, achievements, streaks, recovery tokens and **battle scores must be computed on the server** from stored sessions, sets and logs, using `xp.ts`, `schedule.ts` and `battle.ts`. Clients only submit raw activity (sets logged, timestamps), never points.
* Keep the idempotency keys (`workout:<date>` and so on) as unique constraints in `xp_events`.
* Add plausibility checks on submitted sets (time between sets, rep ranges) and rate limits.

## 4. Live battles & community

* Replace `DEMO_OPPONENTS` with real users who opt in. Matchmaking runs `findMatches` server-side on opted-in profiles (goal, experience, schedule, time, recent activity, age band). Never match on height, weight or appearance.
* Invitation/acceptance becomes a real flow with notifications. Opponent activity is derived from their real (server-scored) logs.
* Before launch: reporting, blocking, moderation, and display names only (no body data) in any shared view.

## 5. Notifications & reminders

* Web Push (VAPID) or a mobile push service plus a scheduler, for hydration reminders, battle events and missed-session prompts. Today, reminders only work while a tab is open.

## 6. Food data

* Replace the sample `src/data/foods.ts` with a licensed or verified source, such as the USDA FoodData Central API, or a national table like the *Food Composition Table for Bangladesh*. Store the source and version per value, and keep `null` for unknowns.
* Ideally, have a registered dietitian review the meal templates and the guidance copy.

## 7. Optional AI coach

* Keep the rule-based coach as the safety layer. An LLM may rephrase answers or handle open questions only through tools that call the existing services (exercise library, substitution, plan, safety triage). It must never generate workouts, diets or medical advice outside those rules.
* Require explicit consent before sending any profile or health data, minimise what you send, keep API keys server-side, and log prompts and responses for safety review.

## 8. Progress photos

* Private object storage (per-user prefixes, server-enforced access), encryption at rest, short-lived signed URLs, EXIF stripping, and hard deletion on account removal. Photos are never shared and never used for assessments.

## 9. Compliance & operations

* Privacy policy and terms; data export and deletion endpoints (already designed into the UI). Consider GDPR and local data-protection law for health data.
* Error monitoring, accessibility audits (WCAG 2.2 AA), and load testing for battle and leaderboard queries.
