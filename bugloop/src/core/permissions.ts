// Role capabilities outside the lifecycle actions (editing, assignment, admin areas).

import type { Bug, Role, StatusKey, WorkspaceCapabilities } from "./types";
import { QA_ROLES } from "./types";
import { isOpen } from "./statuses";

export interface Actor {
  id: string;
  role: Role;
  active: boolean;
}

export const REPORT_FIELDS = [
  "title",
  "description",
  "steps",
  "expected_result",
  "actual_result",
  "project_id",
  "module_id",
  "feature_id",
  "page_id",
  "location",
  "affected_module_ids",
  "environment_id",
  "browser",
  "device",
  "os",
  "app_version",
  "page_url",
  "frequency",
  "tags",
  "notes",
] as const;
export type ReportField = (typeof REPORT_FIELDS)[number];

const ENGINEER_FIELDS: ReportField[] = [
  "module_id",
  "feature_id",
  "page_id",
  "location",
  "affected_module_ids",
  "environment_id",
  "browser",
  "device",
  "os",
  "app_version",
  "tags",
];

/** Statuses after which the report text is frozen for its reporter. */
const REPORT_LOCKED: StatusKey[] = ["fixed", "regression_required", "verified", "closed", "not_a_bug", "duplicate"];

/** Statuses where changing severity/priority needs a reason from everyone. */
const RESOLVED_FOR_CHANGES: StatusKey[] = ["fixed", "regression_required", "verified", "closed", "not_a_bug", "duplicate"];

export function isQa(actor: Pick<Actor, "role">): boolean {
  return QA_ROLES.includes(actor.role);
}

export function isLeadOrAdmin(actor: Pick<Actor, "role">): boolean {
  return actor.role === "qa_lead" || actor.role === "admin";
}

type BugForPerm = Pick<Bug, "status" | "reporter_id" | "archived_at" | "assignee_id">;

export function editableFields(actor: Actor, bug: BugForPerm): ReportField[] {
  if (!actor.active || bug.archived_at) return [];
  if (isLeadOrAdmin(actor)) return [...REPORT_FIELDS];
  if (actor.id === bug.reporter_id && !REPORT_LOCKED.includes(bug.status)) {
    // The project cannot move once triage has started.
    return bug.status === "new" ? [...REPORT_FIELDS] : REPORT_FIELDS.filter((f) => f !== "project_id");
  }
  if (actor.role === "engineer") return ENGINEER_FIELDS;
  return [];
}

export interface FieldChangeRule {
  allowed: boolean;
  reasonRequired: boolean;
}

export function severityChangeRule(actor: Actor, bug: BugForPerm): FieldChangeRule {
  if (!actor.active || bug.archived_at) return { allowed: false, reasonRequired: false };
  const afterResolution = RESOLVED_FOR_CHANGES.includes(bug.status);
  if (isLeadOrAdmin(actor)) return { allowed: true, reasonRequired: afterResolution };
  if (actor.role === "project_manager") return { allowed: true, reasonRequired: true };
  if (actor.role === "engineer") return { allowed: !afterResolution, reasonRequired: true };
  if (actor.id === bug.reporter_id && bug.status === "new") return { allowed: true, reasonRequired: false };
  return { allowed: false, reasonRequired: false };
}

export function priorityChangeRule(actor: Actor, bug: BugForPerm): FieldChangeRule {
  if (!actor.active || bug.archived_at) return { allowed: false, reasonRequired: false };
  const afterResolution = RESOLVED_FOR_CHANGES.includes(bug.status);
  if (isLeadOrAdmin(actor) || actor.role === "project_manager") return { allowed: true, reasonRequired: afterResolution };
  if (actor.role === "engineer") return { allowed: !afterResolution, reasonRequired: false };
  if (actor.id === bug.reporter_id && bug.status === "new") return { allowed: true, reasonRequired: false };
  return { allowed: false, reasonRequired: false };
}

export function canAssign(actor: Actor): boolean {
  return actor.active && ["engineer", "qa_lead", "project_manager", "admin"].includes(actor.role);
}

export function canReassignRegression(actor: Actor): boolean {
  return actor.active && isLeadOrAdmin(actor);
}

export function canComment(actor: Actor, bug: BugForPerm): boolean {
  return actor.active && !bug.archived_at;
}

export function canAlsoSee(actor: Actor, bug: BugForPerm, alreadyCoReporter: boolean): boolean {
  return (
    actor.active &&
    !bug.archived_at &&
    (isQa(actor) || actor.role === "admin") &&
    isOpen(bug.status) &&
    actor.id !== bug.reporter_id &&
    !alreadyCoReporter
  );
}

export function canViewPersonAnalytics(actor: Actor, personId: string): boolean {
  return actor.id === personId || canViewTeamAnalytics(actor);
}

export function canViewTeamAnalytics(actor: Actor): boolean {
  return ["qa_lead", "project_manager", "admin"].includes(actor.role);
}

export function workspaceCapabilities(actor: Actor): WorkspaceCapabilities {
  const active = actor.active;
  return {
    report: active,
    view_team_analytics: active && canViewTeamAnalytics(actor),
    manage_projects: active && (actor.role === "project_manager" || actor.role === "admin"),
    manage_product_map: active && ["qa_lead", "project_manager", "admin"].includes(actor.role),
    manage_users: active && actor.role === "admin",
    manage_config: active && actor.role === "admin",
    view_audit: active && ["qa_lead", "project_manager", "admin"].includes(actor.role),
    assign: canAssign(actor),
    qa: active && (isQa(actor) || actor.role === "admin"),
    engineering: active && (actor.role === "engineer" || actor.role === "admin"),
  };
}

/** Roles eligible to own a regression round. */
export function canOwnRegression(role: Role): boolean {
  return QA_ROLES.includes(role);
}

/** Roles eligible to be assigned engineering work. */
export function canBeAssignee(role: Role): boolean {
  return role === "engineer" || role === "admin";
}
