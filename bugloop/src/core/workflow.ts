// The workflow engine: which lifecycle actions exist, who may perform them, from which
// statuses, what input they require, and where they lead. Pure functions only; the
// service layer applies the side effects inside a transaction.

import type { Bug, DisputeContext, Role, StatusKey } from "./types";
import { REJECTION_CATEGORIES, REJECTION_CATEGORY_LABELS, ROOT_CAUSES, ROOT_CAUSE_LABELS } from "./types";

export const ACTION_KEYS = [
  "start_work",
  "start_review",
  "confirm",
  "request_info",
  "provide_info",
  "mark_fixed",
  "ready_for_regression",
  "start_regression",
  "pass_regression",
  "fail_regression",
  "mark_not_a_bug",
  "mark_duplicate",
  "defer",
  "resume",
  "dispute",
  "accept_decision",
  "uphold_decision",
  "reopen",
  "close",
  "force_close",
  "archive",
  "restore",
] as const;
export type ActionKey = (typeof ACTION_KEYS)[number];

export type FieldKind = "textarea" | "text" | "bug" | "user" | "select" | "date" | "checkbox" | "environment" | "files";

export interface ActionField {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  /** For user pickers: eligible roles. */
  roles?: Role[];
  defaultValue?: string | boolean;
}

export type ActionTone = "primary" | "neutral" | "positive" | "warning" | "danger";

export interface ActionDef {
  key: ActionKey;
  label: string;
  /** Sentence used for toasts and timeline fallbacks. */
  done: string;
  description: string;
  tone: ActionTone;
  submitLabel: string;
  fields: ActionField[];
}

const evidenceField: ActionField = {
  name: "files",
  label: "Evidence",
  kind: "files",
  help: "Screenshots, recordings or logs.",
};

export const ACTION_DEFS: Record<ActionKey, ActionDef> = {
  start_work: {
    key: "start_work",
    label: "Start work",
    done: "Work started",
    description: "Accept the report as a valid bug and start investigating or fixing it.",
    tone: "primary",
    submitLabel: "Start work",
    fields: [],
  },
  start_review: {
    key: "start_review",
    label: "Start review",
    done: "Review started",
    description: "Let the reporter know the report is being reviewed.",
    tone: "neutral",
    submitLabel: "Start review",
    fields: [],
  },
  confirm: {
    key: "confirm",
    label: "Confirm bug",
    done: "Confirmed as a valid bug",
    description: "Confirm this is a valid bug without starting work on it yet.",
    tone: "neutral",
    submitLabel: "Confirm bug",
    fields: [],
  },
  request_info: {
    key: "request_info",
    label: "Request information",
    done: "Information requested",
    description: "Ask QA a question. The bug waits on them until they answer.",
    tone: "neutral",
    submitLabel: "Send question",
    fields: [
      {
        name: "question",
        label: "What do you need to know?",
        kind: "textarea",
        required: true,
        placeholder: "Which member did you edit, and does it happen for every role?",
      },
      {
        name: "requested_from_id",
        label: "Ask",
        kind: "user",
        roles: ["qa_analyst", "qa_lead"],
        help: "Defaults to the reporter.",
      },
    ],
  },
  provide_info: {
    key: "provide_info",
    label: "Provide information",
    done: "Information provided",
    description: "Answer engineering's question. The bug goes back to engineering.",
    tone: "primary",
    submitLabel: "Send answer",
    fields: [
      { name: "answer", label: "Your answer", kind: "textarea", required: true },
      evidenceField,
    ],
  },
  mark_fixed: {
    key: "mark_fixed",
    label: "Mark fixed",
    done: "Marked Fixed",
    description: "Record the fix. QA is asked to run regression once the fix is testable.",
    tone: "positive",
    submitLabel: "Mark fixed",
    fields: [
      {
        name: "resolution",
        label: "What was changed?",
        kind: "textarea",
        required: true,
        placeholder: "Role changes are now written before the dialog closes; added a regression test.",
      },
      { name: "fix_version", label: "Build or version with the fix", kind: "text", placeholder: "2.14.1" },
      {
        name: "root_cause",
        label: "Root cause area",
        kind: "select",
        options: ROOT_CAUSES.map((v) => ({ value: v, label: ROOT_CAUSE_LABELS[v] })),
      },
      {
        name: "available_now",
        label: "The fix is available for testing now",
        kind: "checkbox",
        defaultValue: true,
        help: "Untick if it still has to be deployed. QA is asked to test when you click Ready for regression.",
      },
      { name: "environment_id", label: "Where QA can test it", kind: "environment" },
    ],
  },
  ready_for_regression: {
    key: "ready_for_regression",
    label: "Ready for regression",
    done: "Regression requested",
    description: "The fix is deployed. Ask QA to test it.",
    tone: "primary",
    submitLabel: "Request regression",
    fields: [
      { name: "build", label: "Build or version", kind: "text" },
      { name: "environment_id", label: "Environment", kind: "environment" },
    ],
  },
  start_regression: {
    key: "start_regression",
    label: "Start regression",
    done: "Regression started",
    description: "Let engineering know you are testing the fix.",
    tone: "neutral",
    submitLabel: "Start regression",
    fields: [],
  },
  pass_regression: {
    key: "pass_regression",
    label: "Pass regression",
    done: "Fix verified",
    description: "The fix works. The bug is verified and closed.",
    tone: "positive",
    submitLabel: "Verify fix",
    fields: [
      { name: "environment_id", label: "Tested in", kind: "environment" },
      { name: "build", label: "Build tested", kind: "text" },
      { name: "notes", label: "Notes", kind: "textarea", placeholder: "Checked with Admin and Viewer roles." },
      evidenceField,
    ],
  },
  fail_regression: {
    key: "fail_regression",
    label: "Fail regression",
    done: "Regression failed. Bug reopened.",
    description: "The problem still exists. The bug goes back to engineering.",
    tone: "danger",
    submitLabel: "Fail and reopen",
    fields: [
      {
        name: "details",
        label: "What still fails?",
        kind: "textarea",
        required: true,
        placeholder: "Role is kept for Admin → Editor, but Editor → Viewer still reverts.",
      },
      { name: "environment_id", label: "Tested in", kind: "environment" },
      { name: "build", label: "Build tested", kind: "text" },
      evidenceField,
    ],
  },
  mark_not_a_bug: {
    key: "mark_not_a_bug",
    label: "Not a bug",
    done: "Marked Not a Bug",
    description: "The behaviour is expected or not a defect. The reporter sees your reason and can dispute it.",
    tone: "warning",
    submitLabel: "Mark not a bug",
    fields: [
      {
        name: "category",
        label: "Category",
        kind: "select",
        options: REJECTION_CATEGORIES.map((v) => ({ value: v, label: REJECTION_CATEGORY_LABELS[v] })),
      },
      {
        name: "reason",
        label: "Explanation for the reporter",
        kind: "textarea",
        required: true,
        placeholder: "Archived sites are hidden from the picker by design. See the Sites help article.",
      },
    ],
  },
  mark_duplicate: {
    key: "mark_duplicate",
    label: "Duplicate",
    done: "Marked Duplicate",
    description: "Link to the original bug. The reporter keeps credit as a co-reporter.",
    tone: "warning",
    submitLabel: "Mark duplicate",
    fields: [
      { name: "duplicate_of", label: "Original bug", kind: "bug", required: true, placeholder: "BUG-000087" },
      { name: "note", label: "Note", kind: "textarea" },
    ],
  },
  defer: {
    key: "defer",
    label: "Defer",
    done: "Deferred",
    description: "Valid, but not now. The reporter sees the reason.",
    tone: "neutral",
    submitLabel: "Defer",
    fields: [
      { name: "reason", label: "Reason", kind: "textarea", required: true },
      { name: "target", label: "Target release or milestone", kind: "text", placeholder: "Q1 release" },
      { name: "revisit_on", label: "Revisit on", kind: "date" },
    ],
  },
  resume: {
    key: "resume",
    label: "Resume",
    done: "Resumed",
    description: "Bring the bug back for review.",
    tone: "neutral",
    submitLabel: "Resume",
    fields: [{ name: "note", label: "Note", kind: "textarea" }],
  },
  dispute: {
    key: "dispute",
    label: "Dispute decision",
    done: "Decision disputed",
    description: "Explain why you disagree. The engineer and QA lead review it.",
    tone: "warning",
    submitLabel: "Send dispute",
    fields: [{ name: "reason", label: "Why do you disagree?", kind: "textarea", required: true }],
  },
  accept_decision: {
    key: "accept_decision",
    label: "Accept decision",
    done: "Decision accepted",
    description: "You have read the decision and agree with it.",
    tone: "neutral",
    submitLabel: "Accept",
    fields: [],
  },
  uphold_decision: {
    key: "uphold_decision",
    label: "Uphold decision",
    done: "Decision upheld",
    description: "Keep the original decision. It cannot be disputed again.",
    tone: "warning",
    submitLabel: "Uphold decision",
    fields: [{ name: "note", label: "Note for the reporter", kind: "textarea", required: true }],
  },
  reopen: {
    key: "reopen",
    label: "Reopen",
    done: "Reopened",
    description: "The problem is back. The bug returns to engineering.",
    tone: "danger",
    submitLabel: "Reopen",
    fields: [{ name: "reason", label: "What happened?", kind: "textarea", required: true }, evidenceField],
  },
  close: {
    key: "close",
    label: "Close",
    done: "Closed",
    description: "Close the verified bug.",
    tone: "neutral",
    submitLabel: "Close",
    fields: [],
  },
  force_close: {
    key: "force_close",
    label: "Close without verification",
    done: "Closed without verification",
    description: "Override: close the bug without QA verification. Logged as an override.",
    tone: "danger",
    submitLabel: "Close bug",
    fields: [{ name: "reason", label: "Reason", kind: "textarea", required: true }],
  },
  archive: {
    key: "archive",
    label: "Archive",
    done: "Archived",
    description: "Hide the bug. It can be restored by a QA lead or admin, and its ID is never reused.",
    tone: "danger",
    submitLabel: "Archive",
    fields: [{ name: "reason", label: "Reason", kind: "textarea", required: true }],
  },
  restore: {
    key: "restore",
    label: "Restore",
    done: "Restored",
    description: "Make the archived bug visible again.",
    tone: "neutral",
    submitLabel: "Restore",
    fields: [],
  },
};

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export interface WorkflowActor {
  id: string;
  role: Role;
  active: boolean;
}

export type WorkflowBug = Pick<
  Bug,
  | "status"
  | "reporter_id"
  | "assignee_id"
  | "fixed_by_id"
  | "info_requested_from_id"
  | "info_return_status"
  | "disputed"
  | "dispute_locked"
  | "dispute_context"
  | "archived_at"
  | "decision_acknowledged_at"
  | "confirmed_at"
>;

export interface WorkflowContext {
  actor: WorkflowActor;
  bug: WorkflowBug;
  /** The pending regression round, if any. */
  regression: { assignee_id: string | null; started_at: string | null } | null;
  /** The most recent regression round (any result). */
  lastRegressionAssigneeId?: string | null;
  autoCloseOnVerify: boolean;
  isStatusEnabled: (key: StatusKey) => boolean;
}

export type Check = { ok: true } | { ok: false; reason: string };

const allow: Check = { ok: true };
const deny = (reason: string): Check => ({ ok: false, reason });

const FROM: Partial<Record<ActionKey, StatusKey[]>> = {
  start_work: ["new", "under_review", "regression_failed"],
  start_review: ["new"],
  confirm: ["new", "under_review"],
  request_info: ["new", "under_review", "in_progress", "regression_failed"],
  provide_info: ["need_info"],
  mark_fixed: ["under_review", "in_progress", "regression_failed"],
  ready_for_regression: ["fixed"],
  start_regression: ["regression_required"],
  pass_regression: ["regression_required"],
  fail_regression: ["regression_required"],
  mark_not_a_bug: ["new", "under_review", "in_progress", "need_info", "regression_failed"],
  mark_duplicate: ["new", "under_review", "in_progress", "need_info"],
  defer: ["new", "under_review", "in_progress", "need_info", "regression_failed"],
  resume: ["deferred"],
  dispute: ["not_a_bug", "duplicate"],
  accept_decision: ["not_a_bug", "duplicate", "deferred"],
  uphold_decision: ["under_review", "new"],
  reopen: ["verified", "closed"],
  close: ["verified"],
  force_close: ["new", "under_review", "in_progress", "need_info", "deferred", "fixed", "regression_required", "regression_failed"],
};

const ROLES_FOR: Partial<Record<ActionKey, Role[]>> = {
  start_work: ["engineer", "admin"],
  start_review: ["engineer", "project_manager", "admin"],
  confirm: ["engineer", "admin"],
  request_info: ["engineer", "qa_lead", "project_manager", "admin"],
  mark_fixed: ["engineer", "admin"],
  ready_for_regression: ["engineer", "admin"],
  mark_not_a_bug: ["engineer", "qa_lead", "admin"],
  mark_duplicate: ["engineer", "qa_lead", "project_manager", "admin"],
  defer: ["engineer", "project_manager", "admin"],
  resume: ["engineer", "project_manager", "qa_lead", "admin"],
  uphold_decision: ["qa_lead", "project_manager", "admin"],
  reopen: ["qa_analyst", "qa_lead", "admin"],
  force_close: ["qa_lead", "admin"],
  restore: ["qa_lead", "admin"],
};

const ROLE_DENIAL: Partial<Record<ActionKey, string>> = {
  start_work: "Only engineers can start work on a bug.",
  confirm: "Only engineers can confirm a bug.",
  mark_fixed: "Only engineers can mark a bug fixed.",
  ready_for_regression: "Only engineers can request regression.",
  mark_not_a_bug: "Only engineers or a QA lead can mark a report Not a Bug.",
  reopen: "Only QA can reopen a closed bug.",
  force_close: "Only a QA lead or admin can close a bug without verification.",
  uphold_decision: "Only a QA lead or project manager can uphold a disputed decision.",
};

function hasRole(actor: WorkflowActor, roles: Role[]): boolean {
  return roles.includes(actor.role);
}

function isLead(actor: WorkflowActor): boolean {
  return actor.role === "qa_lead" || actor.role === "admin";
}

export function checkAction(key: ActionKey, ctx: WorkflowContext): Check {
  const { actor, bug } = ctx;
  if (!actor.active) return deny("Your account is deactivated.");

  if (key === "restore") {
    if (!bug.archived_at) return deny("This bug is not archived.");
    return hasRole(actor, ROLES_FOR.restore!) ? allow : deny("Only a QA lead or admin can restore an archived bug.");
  }
  if (bug.archived_at) return deny("This bug is archived. Restore it first.");

  if (key === "archive") {
    if (isLead(actor)) return allow;
    if (actor.id === bug.reporter_id && bug.status === "new" && !bug.assignee_id) return allow;
    return deny("Only a QA lead or admin can archive this bug.");
  }

  const from = FROM[key];
  if (from && !from.includes(bug.status)) return deny("This action is not available in the bug's current status.");

  const roles = ROLES_FOR[key];
  if (roles && !hasRole(actor, roles)) return deny(ROLE_DENIAL[key] ?? "Your role cannot perform this action.");

  switch (key) {
    case "start_review":
      return ctx.isStatusEnabled("under_review") ? allow : deny("The Under Review status is turned off.");
    case "confirm":
      return bug.confirmed_at ? deny("This bug is already confirmed.") : allow;
    case "defer":
      return ctx.isStatusEnabled("deferred") ? allow : deny("The Deferred status is turned off.");
    case "mark_not_a_bug":
    case "mark_duplicate":
      return bug.disputed
        ? deny("The reporter disputed the earlier decision. A QA lead or project manager settles it with Uphold decision.")
        : allow;
    case "provide_info": {
      const asked = bug.info_requested_from_id;
      if (actor.id === asked || actor.id === bug.reporter_id || isLead(actor)) return allow;
      return deny("Only the person who was asked, the reporter or a QA lead can answer.");
    }
    case "start_regression":
    case "pass_regression":
    case "fail_regression": {
      const run = ctx.regression;
      const owner = run?.assignee_id ?? null;
      if (!(actor.id === owner || isLead(actor))) {
        return deny("Only the QA analyst assigned to this regression or a QA lead can do this.");
      }
      if (bug.fixed_by_id && actor.id === bug.fixed_by_id) {
        return deny("You marked this bug fixed, so someone else must verify it.");
      }
      if (key === "start_regression" && run?.started_at) return deny("Regression is already in progress.");
      return allow;
    }
    case "dispute":
      if (bug.dispute_locked) return deny("This decision was upheld and can no longer be disputed.");
      return actor.id === bug.reporter_id || isLead(actor)
        ? allow
        : deny("Only the reporter or a QA lead can dispute a decision.");
    case "accept_decision":
      if (actor.id !== bug.reporter_id) return deny("Only the reporter can accept a decision.");
      return bug.decision_acknowledged_at ? deny("You already accepted this decision.") : allow;
    case "uphold_decision":
      return bug.disputed && bug.dispute_context ? allow : deny("There is no disputed decision to uphold.");
    case "close": {
      if (ctx.autoCloseOnVerify) return deny("Verified bugs close automatically.");
      const owner = ctx.lastRegressionAssigneeId ?? null;
      return isLead(actor) || actor.id === owner ? allow : deny("Only the regression tester or a QA lead can close.");
    }
    default:
      return allow;
  }
}

export function availableActions(ctx: WorkflowContext): ActionKey[] {
  return ACTION_KEYS.filter((k) => checkAction(k, ctx).ok);
}

/** Explanations for important actions a user might expect but cannot take. */
export function actionHints(ctx: WorkflowContext): string[] {
  const hints: string[] = [];
  const { actor, bug } = ctx;
  if (bug.status === "regression_required" && bug.fixed_by_id === actor.id && (actor.role === "qa_lead" || actor.role === "admin")) {
    hints.push("You marked this bug fixed, so someone else must verify it.");
  }
  if (bug.status === "regression_required" && actor.role === "engineer") {
    hints.push("QA verifies fixes. You will be notified when regression passes or fails.");
  }
  if ((bug.status === "not_a_bug" || bug.status === "duplicate") && bug.dispute_locked && actor.id === bug.reporter_id) {
    hints.push("A QA lead upheld this decision, so it can no longer be disputed.");
  }
  return hints;
}

/** Status the bug moves to (before automatic follow-ups). null = no status change. */
export function targetStatus(key: ActionKey, bug: WorkflowBug, isStatusEnabled: (k: StatusKey) => boolean): StatusKey | null {
  switch (key) {
    case "start_work":
      return "in_progress";
    case "start_review":
      return "under_review";
    case "confirm":
      return isStatusEnabled("under_review") ? "under_review" : bug.status;
    case "request_info":
      return "need_info";
    case "provide_info":
      return bug.info_return_status ?? (isStatusEnabled("under_review") ? "under_review" : "new");
    case "mark_fixed":
      return "fixed";
    case "ready_for_regression":
      return "regression_required";
    case "pass_regression":
      return "verified";
    case "fail_regression":
    case "reopen":
      return "regression_failed";
    case "mark_not_a_bug":
      return "not_a_bug";
    case "mark_duplicate":
      return "duplicate";
    case "defer":
      return "deferred";
    case "resume":
      return isStatusEnabled("under_review") ? "under_review" : "new";
    case "dispute":
      return isStatusEnabled("under_review") ? "under_review" : "new";
    case "uphold_decision":
      return (bug.dispute_context as DisputeContext | null)?.from ?? null;
    case "close":
    case "force_close":
      return "closed";
    default:
      return null;
  }
}

/** Order in which actions are presented; the first allowed one is the primary action. */
export const ACTION_PRIORITY: ActionKey[] = [
  "provide_info",
  "pass_regression",
  "fail_regression",
  "start_regression",
  "start_work",
  "mark_fixed",
  "ready_for_regression",
  "accept_decision",
  "dispute",
  "uphold_decision",
  "start_review",
  "confirm",
  "request_info",
  "mark_duplicate",
  "mark_not_a_bug",
  "defer",
  "resume",
  "reopen",
  "close",
  "force_close",
  "archive",
  "restore",
];
