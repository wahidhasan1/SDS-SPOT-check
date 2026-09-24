import type { Bug, Party, StatusConfig, StatusKey, WaitingOn } from "./types";
import { STATUS_KEYS } from "./types";

export type Phase = "triage" | "engineering" | "waiting_qa" | "parked" | "resolved" | "done";

export interface StatusDef {
  key: StatusKey;
  phase: Phase;
  /** Who normally has the ball in this status. */
  party: Party;
  /** Not yet resolved (includes parked). */
  open: boolean;
  /** Someone is expected to act on it now. */
  active: boolean;
  /** Can be switched off in the workspace configuration. */
  optional: boolean;
  defaults: Omit<StatusConfig, "key" | "enabled">;
}

export const STATUS_DEFS: Record<StatusKey, StatusDef> = {
  new: {
    key: "new",
    phase: "triage",
    party: "engineering",
    open: true,
    active: true,
    optional: false,
    defaults: {
      label: "New",
      description: "Reported and waiting for engineering to triage it.",
      color: "sky",
      sort_order: 1,
      attention_hours: 24,
    },
  },
  under_review: {
    key: "under_review",
    phase: "triage",
    party: "engineering",
    open: true,
    active: true,
    optional: true,
    defaults: {
      label: "Under Review",
      description: "An engineer is reviewing the report.",
      color: "indigo",
      sort_order: 2,
      attention_hours: 48,
    },
  },
  in_progress: {
    key: "in_progress",
    phase: "engineering",
    party: "engineering",
    open: true,
    active: true,
    optional: false,
    defaults: {
      label: "In Progress",
      description: "An engineer is investigating or fixing it.",
      color: "blue",
      sort_order: 3,
      attention_hours: 120,
    },
  },
  need_info: {
    key: "need_info",
    phase: "waiting_qa",
    party: "qa",
    open: true,
    active: true,
    optional: false,
    defaults: {
      label: "Need More Information",
      description: "Engineering asked QA for more details.",
      color: "amber",
      sort_order: 4,
      attention_hours: 48,
    },
  },
  not_a_bug: {
    key: "not_a_bug",
    phase: "resolved",
    party: "nobody",
    open: false,
    active: false,
    optional: false,
    defaults: {
      label: "Not a Bug",
      description: "Engineering found the behaviour expected or not a defect. The reason is recorded.",
      color: "slate",
      sort_order: 10,
      attention_hours: null,
    },
  },
  duplicate: {
    key: "duplicate",
    phase: "resolved",
    party: "nobody",
    open: false,
    active: false,
    optional: false,
    defaults: {
      label: "Duplicate",
      description: "The same problem is tracked in another bug.",
      color: "purple",
      sort_order: 11,
      attention_hours: null,
    },
  },
  deferred: {
    key: "deferred",
    phase: "parked",
    party: "nobody",
    open: true,
    active: false,
    optional: true,
    defaults: {
      label: "Deferred",
      description: "Valid, but postponed. The reason is recorded.",
      color: "stone",
      sort_order: 9,
      attention_hours: null,
    },
  },
  fixed: {
    key: "fixed",
    phase: "engineering",
    party: "engineering",
    open: true,
    active: true,
    optional: false,
    defaults: {
      label: "Fixed",
      description: "Fix is done and waiting to be available for regression testing.",
      color: "teal",
      sort_order: 5,
      attention_hours: 48,
    },
  },
  regression_required: {
    key: "regression_required",
    phase: "waiting_qa",
    party: "qa",
    open: true,
    active: true,
    optional: false,
    defaults: {
      label: "Regression Required",
      description: "QA needs to re-test the fix.",
      color: "orange",
      sort_order: 6,
      attention_hours: 48,
    },
  },
  regression_failed: {
    key: "regression_failed",
    phase: "engineering",
    party: "engineering",
    open: true,
    active: true,
    optional: false,
    defaults: {
      label: "Reopened",
      description: "Regression failed: QA re-tested and the problem still exists.",
      color: "red",
      sort_order: 7,
      attention_hours: 24,
    },
  },
  verified: {
    key: "verified",
    phase: "done",
    party: "lead",
    open: false,
    active: false,
    optional: false,
    defaults: {
      label: "Verified",
      description: "QA confirmed the fix works.",
      color: "emerald",
      sort_order: 8,
      attention_hours: null,
    },
  },
  closed: {
    key: "closed",
    phase: "done",
    party: "nobody",
    open: false,
    active: false,
    optional: false,
    defaults: {
      label: "Closed",
      description: "Lifecycle complete.",
      color: "green",
      sort_order: 12,
      attention_hours: null,
    },
  },
};

export const OPEN_STATUSES: StatusKey[] = STATUS_KEYS.filter((k) => STATUS_DEFS[k].open);
export const ACTIVE_STATUSES: StatusKey[] = STATUS_KEYS.filter((k) => STATUS_DEFS[k].active);
export const RESOLVED_STATUSES: StatusKey[] = STATUS_KEYS.filter((k) => !STATUS_DEFS[k].open);
export const ENGINEERING_STATUSES: StatusKey[] = ["new", "under_review", "in_progress", "regression_failed", "fixed"];
export const QA_WAITING_STATUSES: StatusKey[] = ["need_info", "regression_required"];
export const REJECTED_STATUSES: StatusKey[] = ["not_a_bug", "duplicate"];

export function defaultStatusConfig(): StatusConfig[] {
  return STATUS_KEYS.map((key) => ({ key, enabled: true, ...STATUS_DEFS[key].defaults }));
}

export function isOpen(status: StatusKey): boolean {
  return STATUS_DEFS[status].open;
}

/** Dashboard grouping: who is the bug waiting on? */
export const STATUS_GROUPS: { key: string; label: string; statuses: StatusKey[] }[] = [
  { key: "engineering", label: "Waiting on engineering", statuses: ["new", "under_review", "in_progress", "regression_failed", "fixed"] },
  { key: "qa", label: "Waiting on QA", statuses: ["need_info", "regression_required", "verified"] },
  { key: "parked", label: "Parked", statuses: ["deferred"] },
  { key: "resolved", label: "Resolved", statuses: ["closed", "not_a_bug", "duplicate"] },
];

export interface WaitingContext {
  regressionAssigneeId: string | null;
  autoCloseOnVerify: boolean;
}

/** Who needs to act next, in words. */
export function waitingOn(
  bug: Pick<Bug, "status" | "assignee_id" | "reporter_id" | "info_requested_from_id" | "disputed" | "archived_at">,
  ctx: WaitingContext,
): WaitingOn {
  if (bug.archived_at) return { party: "nobody", user_id: null, label: "Archived" };
  switch (bug.status) {
    case "new":
      return bug.assignee_id
        ? { party: "engineering", user_id: bug.assignee_id, label: "Engineering" }
        : { party: "engineering", user_id: null, label: "Triage" };
    case "under_review":
      if (bug.disputed) return { party: "lead", user_id: null, label: "Dispute review" };
      return { party: "engineering", user_id: bug.assignee_id, label: "Engineering" };
    case "in_progress":
    case "regression_failed":
      return { party: "engineering", user_id: bug.assignee_id, label: "Engineering" };
    case "fixed":
      return { party: "engineering", user_id: bug.assignee_id, label: "Engineering (make fix testable)" };
    case "need_info":
      return { party: "qa", user_id: bug.info_requested_from_id ?? bug.reporter_id, label: "QA (information)" };
    case "regression_required":
      return { party: "qa", user_id: ctx.regressionAssigneeId, label: "QA (regression)" };
    case "verified":
      return ctx.autoCloseOnVerify
        ? { party: "nobody", user_id: null, label: "Nobody" }
        : { party: "lead", user_id: null, label: "QA lead (close)" };
    case "deferred":
      return { party: "nobody", user_id: null, label: "Parked" };
    case "not_a_bug":
    case "duplicate":
    case "closed":
      return { party: "nobody", user_id: null, label: "Nobody" };
  }
}

export function hoursBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / 3_600_000;
}

export function isOverdue(
  bug: Pick<Bug, "status" | "status_changed_at" | "archived_at">,
  statuses: Pick<StatusConfig, "key" | "attention_hours">[],
  nowIso: string,
): boolean {
  if (bug.archived_at) return false;
  const cfg = statuses.find((s) => s.key === bug.status);
  if (!cfg || cfg.attention_hours == null) return false;
  return hoursBetween(bug.status_changed_at, nowIso) > cfg.attention_hours;
}
