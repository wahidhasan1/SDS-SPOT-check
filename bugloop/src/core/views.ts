// Saved views on the bug list. Filtering logic lives on the server; this is the catalogue.

export const BUG_VIEWS = [
  { key: "open", label: "All open", description: "Everything not yet resolved, except deferred bugs." },
  { key: "mine", label: "My bugs", description: "Bugs you reported or are credited as co-reporter on." },
  { key: "assigned", label: "Assigned to me", description: "Open bugs you own or collaborate on." },
  { key: "my_regression", label: "Needs my regression", description: "Fixes waiting for you to re-test." },
  { key: "waiting_engineering", label: "Waiting for engineering", description: "New, in review, in progress, reopened or fixed but not yet testable." },
  { key: "waiting_qa", label: "Waiting for QA", description: "Information requests and regressions." },
  { key: "reopened", label: "Recently reopened", description: "Reopened in the last 30 days." },
  { key: "potential_duplicates", label: "Potential duplicates", description: "New reports that closely match an existing bug." },
  { key: "unassigned", label: "Unassigned", description: "New or in-review bugs without an owner." },
  { key: "overdue", label: "Needs attention", description: "Waiting longer than the status's attention threshold." },
  { key: "disputed", label: "Disputed", description: "Decisions the reporter disagreed with." },
  { key: "deferred", label: "Deferred", description: "Valid but postponed." },
  { key: "resolved", label: "Resolved", description: "Closed, verified, not a bug or duplicate." },
  { key: "all", label: "All bugs", description: "Every bug that is not archived." },
  { key: "archived", label: "Archived", description: "Hidden bugs. Visible to QA leads and admins." },
] as const;

export type BugViewKey = (typeof BUG_VIEWS)[number]["key"];

export const SORT_OPTIONS = [
  { key: "updated", label: "Last activity" },
  { key: "created", label: "Newest" },
  { key: "severity", label: "Severity" },
  { key: "priority", label: "Priority" },
  { key: "waiting", label: "Waiting longest" },
  { key: "key", label: "Bug ID" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["key"];
