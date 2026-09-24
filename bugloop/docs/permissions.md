# Roles and permissions

Permissions are role-based and checked on the server for every request
(`src/core/permissions.ts` for capabilities, `src/core/workflow.ts` for lifecycle actions).
The UI asks the server which actions are allowed instead of re-implementing the rules.

## Roles

| Role | Purpose |
|---|---|
| **QA Analyst** | Finds, reports and verifies bugs. Owns regression for their own reports. |
| **Engineer** | Triages, investigates, fixes or rejects reports. Cannot verify or close fixed bugs. |
| **QA Lead** | Everything a QA analyst can do, plus arbitration of disputes, regression reassignment, force close, archive/restore and team analytics. |
| **Project Manager** | Prioritises, defers and resumes work, assigns engineers, upholds disputed decisions, manages projects and modules, sees analytics. |
| **Administrator** | Full access, including users, roles, teams and workspace configuration. Still cannot verify a fix they made. |

## Capability matrix

✓ = allowed · ◐ = allowed with a condition (see note) · blank = not allowed

| Capability | QA Analyst | Engineer | QA Lead | PM | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Report a bug | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit report text and environment details | ◐ own, until Fixed | ◐ module, feature, tags, environment | ✓ | | ✓ |
| Comment, attach evidence, watch, link related bugs | ✓ | ✓ | ✓ | ✓ | ✓ |
| "I'm seeing this too" (co-reporter) | ✓ | | ✓ | | ✓ |
| Start review / confirm bug / start work | | ✓ | | ◐ start review only | ✓ |
| Request information | | ✓ | ✓ | ✓ | ✓ |
| Provide information | ◐ if asked or reporter | ◐ if asked | ✓ | ◐ if asked | ✓ |
| Mark Not a Bug | | ✓ | ✓ | | ✓ |
| Mark Duplicate | | ✓ | ✓ | ✓ | ✓ |
| Defer / resume | | ✓ | ◐ resume | ✓ | ✓ |
| Mark Fixed / ready for regression | | ✓ | | | ✓ |
| Start / pass / fail regression | ◐ regression owner | | ✓ | | ✓ |
| Reopen a verified or closed bug | ✓ | | ✓ | | ✓ |
| Dispute a decision | ◐ reporter | | ✓ | | ✓ |
| Accept a decision | ◐ reporter | | | | |
| Uphold a disputed decision | | | ✓ | ✓ | ✓ |
| Close a verified bug (auto-close off) | ◐ regression owner | | ✓ | | ✓ |
| Force close without verification | | | ✓ | | ✓ |
| Assign / reassign engineers, collaborators | | ✓ | ✓ | ✓ | ✓ |
| Reassign regression | | | ✓ | | ✓ |
| Change severity | ◐ own, before triage | ◐ with reason | ✓ | ◐ with reason | ✓ |
| Change priority | ◐ own, before triage | ✓ | ✓ | ✓ | ✓ |
| Archive a bug | ◐ own, while New and unassigned | | ✓ | | ✓ |
| Restore an archived bug | | | ✓ | | ✓ |
| Team analytics (all people) | ◐ self only | ◐ self only | ✓ | ✓ | ✓ |
| Manage projects, modules, features | | | | ✓ | ✓ |
| Manage users, roles, teams | | | | | ✓ |
| Manage workflow labels, severity, priority, environments, settings | | | | | ✓ |
| View audit log | | | ✓ | ✓ | ✓ |

## Rules that apply on top of roles

* **Separation of duties.** Whoever marked a bug Fixed cannot pass or fail its regression.
* **Changes after resolution** (severity or priority on Fixed / Verified / Closed / Not a Bug /
  Duplicate bugs) always require a reason.
* **Deactivated users** cannot sign in. Their names stay on every record they touched.
* **Archived bugs** are read-only until restored.
* **Admins** are also limited by the separation-of-duties rule.
