# Bugloop product design

Bugloop is a bug-reporting and QA management platform built around one loop:

```
Discover → Report → Review → Investigate → Fix / Reject → Regression test → Verify → Close
```

General project tools (Jira, ClickUp, Slack, spreadsheets) can hold a bug, but they do not
model who is waiting on whom, who owns verification, or who deserves credit. Bugloop does.
Every feature below was checked against one question:

> Does this reduce the communication gap between the person who found the problem and the
> person responsible for investigating or fixing it?

Related documents: [lifecycle](lifecycle.md) · [roles and permissions](permissions.md) ·
[data model](data-model.md) · [AI assistant](ai.md) · [architecture](architecture.md).

---

## 1. Requirements analysis

### The questions the product must answer at any moment

| Who | Question | Where Bugloop answers it |
|---|---|---|
| QA | What happened to the bug I reported? | *My bugs*; every bug shows status **and who it is waiting on**; timeline |
| QA | Does the engineer need something from me? | *Needs my action* (information requests, regression tasks, decisions to review); notifications |
| QA | Has the issue been fixed? Do I need to regress it? | *Regression* queue; "Regression testing required for BUG-…" notification |
| QA | Was my report marked Not a Bug or Duplicate? | Decision notification with the engineer's reason; accept or dispute in one click |
| Engineer | What do I need to work on? | *Needs my action* and *Assigned to me*, ordered by priority and waiting time |
| Engineer | What exactly is the problem? What evidence exists? | Structured report (steps / expected / actual), attachments, AI provenance labels |
| Engineer | Does this bug already exist? | Similar-bug panel on every bug; the reporter's duplicate-check decision is recorded |
| Engineer | Is QA waiting for me? | "Waiting on" indicator; *Waiting for engineering* view; attention thresholds |
| Lead / manager | How many bugs are open, where are the bottlenecks? | Dashboard lifecycle board, time-in-status chart, overdue list |
| Lead / manager | How many bugs are reopened? Which modules recur? | Reopen rate, module hotspots, recurring modules |
| Lead / manager | How long does resolution take? | Median time to first response, fix and close |
| Organization | Is there a reliable, traceable lifecycle for every issue? | Append-only event log, no hard deletes, explicit ownership fields |

### Scope of the prototype

Built now, core workflow first:

1. Structured reporting with progressive disclosure, screenshots and video.
2. AI bug-report assistant with screenshot analysis and explicit provenance.
3. Duplicate detection before submission, plus similarity flags after submission.
4. The full lifecycle with required reasons, automatic regression hand-off and QA-owned verification.
5. Ownership and credit fields, co-reporter credit for duplicates, and a complete timeline.
6. In-app notifications, *Needs my action*, and saved views.
7. Dashboard, contribution analytics, engineering flow and module health.
8. Projects → modules → features, and an admin area for users, teams, workflow labels,
   severity and priority levels, environments, settings and the audit log.
9. Realistic seed data, including the end-to-end example from the brief.

Deliberately left out of the prototype (documented as next steps): SSO, email and Slack
delivery, custom workflow states, per-project permissions, releases/milestones, and
integrations with source control or CI.

---

## 2. Missing product decisions and the assumptions made

The brief leaves some decisions open. Each assumption below is easy to change later; the ones
that change behaviour are configurable.

| # | Open question | Decision |
|---|---|---|
| 1 | Is **Fixed** a resting state or just a moment? | Both. When marking Fixed the engineer says whether the fix is **already available for testing**. If yes (the default), the bug moves straight to *Regression Required*. If not (for example, waiting for a deploy to staging), it rests in *Fixed* until an engineer clicks **Ready for regression**. This prevents QA from failing a regression against a build that does not contain the fix, a common real-world false reopen. |
| 2 | Is **Verified** a resting state? | By default Verified moves to Closed automatically, and both steps appear in the timeline, as in the brief's example. A workspace setting turns off auto-close for teams where a lead closes verified bugs at release time. |
| 3 | Can an engineer close a bug? | No. Engineers can *reject* a report (Not a Bug, Duplicate) with a mandatory reason, but a fixed bug is only verified by QA. Only a QA lead or admin can **force close** without verification, with a reason, and that is logged as an override. |
| 4 | Who performs regression? | The original reporter, if they are still an active QA user. Otherwise the project's QA lead, who can reassign it to any QA analyst. Credit for the discovery never moves. |
| 5 | What if QA disagrees with *Not a Bug* or *Duplicate*? | The reporter can **dispute** with a reason. The bug returns to *Under Review* flagged as disputed, and the deciding engineer and the QA lead are notified. A QA lead or PM can **uphold** the decision (final; it cannot be disputed again), or an engineer can accept the bug, which overturns it. |
| 6 | Do rejections need acknowledgement? | Not to change status. The reporter gets a *Review decision* item (accept or dispute) so every decision is seen, closing the loop without blocking anyone. |
| 7 | Can QA assign engineers? | No. Assignment belongs to engineering, leads and PMs. Each module can have a **default owner**, and new bugs in that module are assigned automatically. |
| 8 | Severity versus priority? | Severity is impact (QA's assessment). Priority is urgency (engineering/PM decision). The reporter sets both at submission (priority as a suggestion). An engineer or PM who changes severity must give a reason and the reporter is notified, so QA's assessment is never silently downgraded. |
| 9 | Are statuses configurable? | Labels, colours, descriptions, attention thresholds and the optional *Under Review* / *Deferred* statuses are configurable. Transitions are enforced by the workflow engine. Custom work stages are a documented next step. |
| 10 | Bug IDs? | Global sequence with a configurable prefix: `BUG-000124`. IDs are never reused, even for archived bugs. |
| 11 | Deleting bugs? | No hard delete. **Archive** (with reason) hides a bug, and only leads and admins can restore it. A reporter can archive their own report only while it is *New* and unassigned (a mistaken submission). |
| 12 | Who sees per-person analytics? | Everyone sees team-level analytics. Per-person contribution details are visible to QA leads, PMs and admins, and each person always sees their own. No ranks, no leaderboards, people sorted alphabetically. |
| 13 | Do engineers or PMs report bugs? | Yes, anyone can report. If the reporter is not in a QA role, regression goes to the project's QA lead, because verification belongs to QA. |
| 14 | Separation of duties? | A user can never verify a fix they marked Fixed themselves, even if they hold a QA role. |
| 15 | Does AI make decisions? | Never. AI drafts wording, reads screenshots, suggests severity and similar bugs, and summarizes. Every AI output is labelled, editable, and applied only by a person. |

---

## 3. Edge cases and how they are handled

| Edge case | Behaviour |
|---|---|
| Two people report the same bug at the same time | Neither sees the other at submission. After every submission Bugloop re-scores open bugs; a strong match flags the newer report as a **potential duplicate** (visible to triage, in the *Potential duplicates* view). Triage decides; both reporters keep credit. |
| Engineer marks Not a Bug, QA disagrees | Dispute flow (decision 5). The whole exchange stays in the timeline. |
| Engineer marks Fixed, QA fails regression | *Regression Failed (Reopened)*. QA must describe what still fails and can attach evidence. The bug returns to the engineer who fixed it, and the reopen counter increases. |
| A bug is reopened multiple times | Every round is a numbered regression run with its own result, tester, build and notes. From the second reopen the QA lead and PM are notified; the reopen count is visible on the bug and in analytics. |
| An engineer changes teams | Their assignments stay (history never changes). Open bugs whose assignee is inactive appear to leads as *needs reassignment*. |
| A reporter leaves the project or is deactivated | Regression falls back to the project QA lead (decision 4). "Reported by" never changes. |
| A duplicate is linked to another duplicate | Linking resolves to the **root** original (A → B → C links A to C) and says so. Cycles and self-links are rejected. |
| A bug is deleted accidentally | Archive only. Leads restore it, and both actions are audited. |
| Severity changed after the bug is fixed | Allowed for leads, PMs and admins with a mandatory reason. The old and new values are in the timeline and the reporter is notified. |
| Multiple engineers work on the same issue | One owner (assignee) plus collaborators. Fix credit records who marked it Fixed and the collaborators at that time. |
| A bug has multiple attachments | Any number of screenshots, videos, logs or PDFs, each tagged with context (initial report, information response, regression evidence, comment) and uploader. |
| The same issue appears in multiple modules | One primary module plus *also affects* modules. Filters and module analytics include both. |
| Information requested from someone other than the reporter | The request names who it is for; that person gets the action item. |
| Canonical bug of a duplicate is fixed | Reporters of the duplicates are told when the original is verified, so they can check their own scenario. |
| Regression requested while the reporter is away | A QA lead reassigns the regression task; the original reporter keeps discovery credit. |

---

## 4. Information architecture

```
Sidebar                          Top bar
─────────────────────            ───────────────────────────────────────────
[ + Report bug ]                 Search bugs (ID, title, person…)  /     🔔
Dashboard
Needs my action        (count)
Bugs
My bugs
Regression             (count)   ← QA roles
Notifications          (count)
Analytics
Projects
─ Admin ─                        ← by role
Users & teams
Workflow & fields
Audit log
Workspace settings
─────────────────────
AI assistant status
(user ▾) profile · theme · switch person (demo) · sign out
```

* **Report bug** is the single most important action for QA, so it is a button, not a nav item.
* **Needs my action** is computed from bug state for the signed-in person, so it cannot go stale.
* **Bugs** carries saved views: *My bugs, Assigned to me, Needs my regression, Waiting for
  engineering, Waiting for QA, Needs attention, Unassigned, Potential duplicates, Disputed,
  Recently reopened, All open, Deferred, Resolved, All bugs* and (leads and admins) *Archived*.
  Filters: text or ID, project, module, status, severity, priority, reporter, assignee and tag;
  the API also takes a date range. Sort by activity, age, severity, priority, waiting time or ID.
* **Bug detail** is a single page: header (ID, title, status, severity, priority, *waiting on*),
  lifecycle track, report body, evidence, activity timeline and composer; the right rail holds
  the available actions, people (reported by, assigned to, reviewed, fixed, verified), details,
  links and regression rounds.

### Page designs in brief

**Report bug.** A two-column form. *Where did it happen?* (project, module, feature) comes
first, then *Describe what happened*, which takes free text and screenshots and drafts the
report. Below it are the essentials: title, environment, severity, priority suggestion, steps,
expected, actual, description and evidence. *More details* holds browser, device, OS, build,
frequency, tags, page URL, also-affects modules and notes; it opens automatically when the
assistant fills something there. Every drafted field shows its provenance; AI-inferred fields
stay highlighted until the analyst confirms or edits them, and the submit bar lists any that are
still unconfirmed. The right rail shows **Possible duplicates** (live) and a **report
checklist**. The draft is kept in the browser until it is submitted or discarded. Submitting
with high or medium matches opens the duplicate dialog: *View existing bug*, *Add my evidence to
it instead* (keeps credit as co-reporter), or *It's a different problem. Submit* (recorded for
triage).

**Dashboard.** Personal queue first ("what needs me"), then the lifecycle board: every status
with its count, grouped by who is waiting (engineering / QA / parked / resolved) instead of
thirteen loose cards. Then reported-vs-resolved per week, open bugs by module, bottlenecks
(average time waiting in each status, oldest waiting bugs) and headline flow metrics (median
resolution time, reopen rate, valid-report rate).

**Analytics.** The dashboard is the team overview. Analytics adds *QA contributions* (bugs
reported per person per week; hover for the week, click a name or row to follow one person's
line and see their totals: reported, fixed, open, not a bug, duplicate, reopened, co-reported,
regressions run and verified, average time to close; every chart has a table view),
*Engineering flow* (workload per engineer, time to first response, time to fix, fixes reopened,
regression pass rate) and *Modules* (open and total bugs, reopen rate, Not a Bug count, time to
close, recurring themes). A note on the contributions tab states that the numbers exist for
transparency and workflow analysis, not ranking. QA analysts and engineers see their own
numbers; leads, PMs and admins see the team.

**Notifications.** In-app, grouped by day, each linking to the bug. Categories:
*action required* and *decisions* are always on; *progress* and *discussion* can be muted per
person.

### Notification catalogue

| Recipient | Event | Example |
|---|---|---|
| QA | Fixed / regression required | "BUG-000104 has been marked Fixed. Regression testing required." |
| QA | Information requested | "Imran Hossain requested more information for BUG-000108." |
| QA | Not a Bug / Duplicate / Deferred | "BUG-000112 was marked Not a Bug." (the reason is in the notification body) · "BUG-000119 was marked Duplicate of BUG-000102." |
| QA | Severity changed by someone else | "Severity of BUG-000131 changed from Critical to Major." (with the reason) |
| QA | Original of your duplicate verified | "BUG-000102 (original of your BUG-000119) was verified and closed." |
| Engineer | Assigned | "New bug BUG-000125 has been assigned to you." |
| Engineer | Regression failed | "QA reopened BUG-000104 after failed regression." |
| Engineer | Information provided / evidence added | "QA added additional evidence to BUG-000108." |
| Engineer | Fix verified | "Wahid Hasan verified the fix for BUG-000104." |
| Engineer, QA lead | Decision disputed | "Wahid Hasan disputed the Not a Bug decision on BUG-000112." |
| QA lead, PM | Repeated reopen | "BUG-000104 has been reopened 2 times." |
| Anyone | @mention, comment on a watched bug | "Maria Olsen commented on BUG-000087." |

---

## 5. Visual and interaction principles

* Workflow speed over decoration: dense but calm tables, one primary action per context,
  keyboard shortcuts (`/` search, `c` report bug).
* Colour is reserved for meaning. Status and severity carry the colour; the chrome is neutral ink
  on cool greys. Priority uses a bar glyph, not a colour, to avoid a rainbow.
* Monospace for identifiers and builds (`BUG-000124`, `2.14.0-rc.3`) so they scan and copy
  cleanly.
* Every status shows **who it is waiting on** in words, not just a colour.
* AI content is always labelled with its source and is never applied without a click.
* Light and dark themes, responsive down to phone width.
