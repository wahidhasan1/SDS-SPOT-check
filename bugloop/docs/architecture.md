# Architecture

## Overview

```
┌──────────────────────────── Browser ────────────────────────────┐
│ React app (src/web)                                             │
│  pages · components · TanStack Query cache                      │
│        │ api client (fetch or in-page transport)                │
└────────┼────────────────────────────────────────────────────────┘
         │ HTTP /api/*                  (demo: in-page, no network)
┌────────▼────────────────────────────────────────────────────────┐
│ Hono app (src/server/app.ts) — same code in Node and browser    │
│  auth · validation (Zod) · routes                               │
│        │                                                        │
│ Services (src/server/services)                                  │
│  bugs · workflow · comments · notifications · admin · analytics │
│  action items · similarity · ai (guardrails, usage log)         │
│        │                         │                              │
│ Core domain (src/core)           AI providers (src/server/ai)   │
│  workflow engine · permissions   Anthropic SDK · artifact       │
│  statuses · similarity · text    `sample` · offline assistant   │
│        │                                                        │
│ Store interface (src/server/db)                                 │
│  SQLite (node:sqlite)  |  in-memory (+ IndexedDB snapshot)      │
│ File store: disk       |  memory (+ IndexedDB)                  │
└─────────────────────────────────────────────────────────────────┘
```

The same API application runs in two places:

* **Server mode.** A Node process serves the API and the built web app. Data lives in SQLite
  (`data/bugloop.db`) and uploads in `data/uploads/`. Multiple people use it at the same time,
  and roles are enforced on the server. This is the mode to deploy for a team.
* **Demo mode.** The whole application, API included, is bundled into one HTML file. The API
  runs inside the page against an in-memory store seeded with demo data, saved to IndexedDB when
  the browser allows it. There is no server, so it opens straight from a claude.ai artifact or
  from disk. A user switcher lets one person play QA, engineer and lead in turn.

Because routing, validation, permissions and workflow rules are shared code, the demo behaves
exactly like the server.

## Technology

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | One set of domain types from database to UI |
| API | Hono | Web-standard `Request`/`Response`, so it runs on Node and in the browser unchanged |
| Database | SQLite via `node:sqlite` | Zero-install, transactional, file-based; no native build step |
| Browser store | In-memory tables with the same schema | Keeps the demo self-contained without WASM |
| Validation | Zod | Request validation and AI output validation |
| UI | React 19, React Router 7, TanStack Query 5, lucide icons | Mainstream and easy for engineers to extend |
| Styling | Hand-written CSS with design tokens (light and dark) | Small, fast, no build-time CSS framework |
| Charts | Small SVG chart components | Themeable, accessible, no heavy chart dependency |
| AI | `@anthropic-ai/sdk` (server), artifact `sample` capability (demo), offline assistant | See [AI assistant](ai.md) |
| Tests | Vitest (domain, stores, services, HTTP), Playwright (end-to-end) | |

## Code layout

```
bugloop/
├── docs/                    product and system design (this folder)
├── src/
│   ├── core/                framework-free domain logic, shared by server, demo and UI
│   │   ├── statuses.ts      status catalogue, phases, "waiting on"
│   │   ├── workflow.ts      action definitions, guards, required inputs, transitions
│   │   ├── permissions.ts   role capabilities
│   │   ├── similarity.ts    duplicate detection engine
│   │   └── types.ts         shared entity and API types
│   ├── server/
│   │   ├── app.ts           Hono app factory (routes)
│   │   ├── context.ts       dependency container (store, files, ai, clock, config)
│   │   ├── db/              schema, SQLite store, memory store
│   │   ├── services/        business logic per area
│   │   ├── ai/              providers, prompts, guardrails
│   │   ├── seed/            demo data scenarios
│   │   └── node.ts          Node entry point (HTTP server, static files)
│   ├── web/                 React application
│   └── demo/                in-browser boot for the single-file demo
├── tests/                   Vitest suites
├── e2e/                     Playwright checks
└── scripts/                 build helpers
```

## Request flow: an action on a bug

1. The UI posts `POST /api/bugs/BUG-000124/actions/mark_fixed` with the inputs.
2. The auth middleware resolves the session to a user.
3. The workflow engine checks role, context (assignee, reporter, separation of duties), the
   current status, and the required inputs.
4. Inside one transaction the service updates the bug, writes events, creates the regression
   round, updates watchers and queues notifications.
5. The response returns the updated bug with the actions now available to the caller.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `BUGLOOP_DATA_DIR` | `./data` | SQLite file and uploads |
| `BUGLOOP_SEED` | `demo` | Seed demo data when the database is empty (`demo` or `none`) |
| `BUGLOOP_DEMO_LOGIN` | `true` | Show one-click demo accounts on the sign-in page |
| `ANTHROPIC_API_KEY` | — | Enables Claude for drafting, screenshots, summaries |
| `BUGLOOP_AI_MODEL` | `claude-opus-5` | Model used by the Anthropic provider |
| `BUGLOOP_AI_EFFORT` | `medium` | Effort level; drafting is interactive, so latency matters |
| `BUGLOOP_MAX_UPLOAD_MB` | `50` | Attachment size limit |

## Security notes

* Passwords are hashed with PBKDF2-SHA256 (Web Crypto, 210k iterations). Session tokens are
  random and only their SHA-256 hash is stored.
* Every mutation is authorised on the server; the UI's view of permissions is advisory.
* Uploaded files are served with `X-Content-Type-Options: nosniff` and a sandboxing
  `Content-Security-Policy`, and non-media files are served as downloads.
* API keys stay on the server. The demo never asks for one.
* Demo login is for evaluation. Disable it (`BUGLOOP_DEMO_LOGIN=false`) and change the seeded
  passwords before real use, or start with `BUGLOOP_SEED=none` and create an admin.
