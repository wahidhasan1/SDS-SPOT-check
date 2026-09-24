# Bugloop

A bug-reporting and QA management platform built around one loop:

```
Discover → Report → Review → Investigate → Fix / Reject → Regression → Verify → Close
```

Bugloop makes the hand-offs between QA and engineering explicit: every bug says who it is waiting
on, questions and decisions have a place to be answered, fixes go back to QA for regression, and
every step is recorded with who did it and when. An AI assistant helps analysts turn a rough
description and screenshots into a structured report without inventing facts, and flags possible
duplicates before a report is filed.

It runs two ways from the same code:

* **Server** — Node + SQLite, for a team. Real accounts, roles enforced on the server.
* **Single-file demo** — the whole app, API included, in one HTML file with sample data. No
  install; switch between the QA, engineering, lead, PM and admin views.

## Quick start

Requires Node.js 22.13 or later (it uses the built-in `node:sqlite`).

```bash
cd bugloop
npm install
npm run build
npm start              # http://localhost:3000
```

The first start seeds a sample workspace (3 projects, 17 people, ~130 bugs with realistic
histories). On the sign-in page, click any person to sign in as them, or use their email and the
password `demo1234` (for example `wahid.hasan@bugloop.test`).

For development, `npm run dev` runs the API with reload on :3000 and the Vite dev server on :5173.

### The demo file

```bash
npm run build:demo     # dist/demo/index.html — open it straight from disk
```

It starts signed in as Wahid Hasan (QA analyst). Use the person menu at the bottom of the sidebar
to switch roles. Changes are saved in the browser; *Reset demo data* in the same menu starts over.
`dist/demo/bugloop.html` is the same page without `<html>`/`<head>`/`<body>`, for hosts that wrap
pages in their own skeleton, such as a claude.ai artifact, where the assistant then uses Claude
through the viewer's own account.

### Using Claude

Without configuration the assistant is a rule-based offline helper: it restructures the analyst's
own words and asks for everything else, but cannot read screenshots. To use Claude:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

`BUGLOOP_AI_MODEL` (default `claude-opus-5`) and `BUGLOOP_AI_EFFORT` (default `medium`) tune it.
Drafts, screenshot observations, activity summaries, regression suggestions and release-risk
summaries are always labelled with their source and never applied without a click.

### For real use

Start without sample data and create the first administrator in the browser:

```bash
BUGLOOP_SEED=none BUGLOOP_DATA_DIR=/var/lib/bugloop npm start
```

Password-less demo sign-in is only offered for a database seeded with sample data. See
[configuration](docs/architecture.md#configuration) for every setting.

## A tour

Signed in as **Wahid Hasan** (QA analyst):

1. **Report bug → Try the example** fills in the brief's example ("When I change the role and
   save it, it looks saved, but when I open the member again the old role is there"). Choose
   *SDS Manager › Members* and click **Draft report**. Every field shows where it came from:
   *Provided by QA analyst*, *Observed in screenshot*, *AI-generated wording* or *AI-inferred,
   please confirm*. The assistant asks for what's missing instead of guessing.
2. The **Possible duplicates** rail already suggests **BUG-000087 · Member role changes are not
   saved**. Submitting opens the duplicate dialog: view it, add your evidence to it, or submit
   anyway. The choice is recorded for triage.
3. **Needs my action** lists what is waiting on Wahid: questions from engineers (BUG-000108),
   regressions to run (BUG-000104 is on its second round) and decisions to review (BUG-000112
   was marked Not a Bug, BUG-000119 a duplicate of BUG-000102).
4. **BUG-000124** shows a complete history from report to automatic close after verification.

Then switch person:

* **Rafiq Chowdhury** (engineer, owner of Members) has **BUG-000125** waiting for triage: start
  work, ask a question, mark it Not a Bug or a duplicate, defer it, or mark it fixed. Engineers
  can't close fixed bugs; QA verifies them.
* **Nusrat Jahan** (QA lead) settles disputes (*Bugs → Disputed*) and picks up regressions whose
  reporter has left.
* **Hanne Lie** (PM) and **Mahmud Karim** (admin) see team analytics, the release-readiness
  summary, projects, users, workflow settings and the audit log.

## Tests

```bash
npm test               # Vitest: workflow rules, permissions, both stores, HTTP API, seed, assistant
npm run typecheck
npm run build:demo && npm run e2e                  # the full QA ↔ engineering loop in the demo
BASE=http://localhost:3000 npm run e2e             # the same against a running server
```

The end-to-end run reports a bug with the assistant, has the engineer ask a question, answers it,
fixes it, fails the regression, fixes it again, verifies it, checks the notifications on both
sides, and checks every main page for errors and for sideways scrolling on a phone.

## Documentation

* [Product design](docs/product-design.md): requirements, decisions, edge cases, information architecture
* [Lifecycle](docs/lifecycle.md): statuses, transitions, required inputs, who is waiting on whom
* [Roles and permissions](docs/permissions.md)
* [Data model](docs/data-model.md)
* [AI assistant](docs/ai.md): drafting, provenance, guardrails, duplicate detection, providers
* [Architecture](docs/architecture.md): runtimes, code layout, configuration, security

## Project layout

```
src/core     domain rules shared by server, demo and UI (workflow, permissions, similarity)
src/server   Hono API, services, SQLite and in-memory stores, AI providers, sample data
src/web      React app
src/demo     in-browser boot for the single-file demo
tests        Vitest suites
e2e          Playwright end-to-end run
docs         product and system design
```
