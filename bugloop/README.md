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

The first start seeds a sample workspace: three products (EHS, HUB ONE and SDS ONE), 19 people and
about 130 bugs with realistic histories, most of them in HUB ONE's CRM. On the sign-in page, click any
person to sign in as them, or use their email and the password `demo1234` (for example
`wahid.hasan@bugloop.test`).

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

1. The **Dashboard** shows where every open bug is, a pie of pending, closed and not-a-bug reports, a
   weekly line per product (a line heading down means that product is getting ready to launch), and
   average engineer response, fix and close times with reopen and valid-report rates.
2. **Report bug** asks for very little: the product, one or two sentences and a screenshot. Click
   **Try the example**, then **Prepare report**. Using HUB ONE's **product map**, the assistant works
   out the page (*CRM › Edit contact, /crm/contacts/:id/edit*), the element (*Owner dropdown*), the
   steps, the expected result (from the page's rules), severity and priority, each with its reasons.
3. **Check & submit** lists every value with where it came from. Values from the assistant wait for a
   **Verify** tick; **Edit** fixes anything wrong, including the problem area, which you can draw on
   the screenshot. The duplicate check suggests **BUG-000087 · Contact owner changes are not saved**.
4. **Needs my action** lists what is waiting on Wahid. Opening an item shows the task first (for
   BUG-000108 the answer box is already open), then the report; people, details, history, linked and
   similar bugs are folded away underneath.
5. **Bugs** is one list with filters; **My bugs** shows only Wahid's own reports; **My insights**
   shows only his own numbers. Notifications live in the bell at the top right.
6. **Projects → HUB ONE** describes what the software does and its modules. The assistant reads this
   together with the product map.

7. **New report → Suggest an improvement** takes a suggestion in any English. **Polish my English**
   turns it into a clear paragraph (Claude rewrites it; the offline helper fixes spelling, capitals
   and punctuation) that you can edit before sending. It goes to the project's manager, who
   approves it and picks an engineer, or closes it with a reason. Approved suggestions appear under
   **Improvements to build** in the engineer's Needs my action, and the reporter is told at each
   step. **Improvements** lists them all.

Then switch person: **Jonas Strand** (PM for HUB ONE) has **IMP-000006** to approve or close;
**Rafiq Chowdhury** (engineer, owner of CRM) has **BUG-000125** waiting for
triage; **Nusrat Jahan** (QA lead) settles disputes; **Mahmud Karim** (admin) manages people, projects
and workflow.

## The product map

Each project has an **About this software** section (website, platforms and a plain-words overview of
what it does) and a map of its screens: path, what the page is for, the elements on it, the
rules it must follow ("Saving keeps every changed field…") and how important it is. QA leads,
project managers and admins edit it under **Projects → project → Product map**, one page at a
time or by importing JSON (*Import map → Start from the template*, then **Preview** before
**Import**; existing pages are updated by name, nothing is deleted). The assistant uses it so a
one-line report comes back placed on the right screen, with an expected result taken from the
rules and a priority weighted by the screen's importance. The template is also served at
`GET /api/product-map/template`.

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
