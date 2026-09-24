// Turns event records into human sentences. Shared by the UI timeline, the audit log and the
// AI summary digest so every surface tells the same story.

import type { EventRecord, StatusKey } from "./types";

export interface TimelineLookup {
  user(id: string | null | undefined): string;
  status(key: StatusKey): string;
  bugKey(id: string | null | undefined): string | null;
  severity(key: string): string;
  priority(key: string): string;
  environment(id: string | null | undefined): string | null;
  module(id: string | null | undefined): string | null;
}

export type TimelineTone = "neutral" | "positive" | "warning" | "danger" | "info";

export interface TimelineEntry {
  /** Sentence without the actor, e.g. "marked this Fixed". */
  text: string;
  /** Longer free text: a reason, question, resolution. */
  detail: string | null;
  tone: TimelineTone;
  /** True when the system (not a person) did it. */
  system: boolean;
  /** Events that the UI can fold into a neighbouring entry. */
  quiet: boolean;
}

const s = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

const FIELD_LABELS: Record<string, string> = {
  title: "title",
  description: "description",
  steps: "steps",
  expected_result: "expected result",
  actual_result: "actual result",
  project_id: "project",
  module_id: "module",
  feature_id: "feature",
  affected_module_ids: "also-affected modules",
  environment_id: "environment",
  browser: "browser",
  device: "device",
  os: "operating system",
  app_version: "app version",
  page_url: "page URL",
  frequency: "frequency",
  tags: "tags",
  notes: "notes",
};

export function describeEvent(e: EventRecord, L: TimelineLookup): TimelineEntry {
  const d = e.data as Record<string, unknown>;
  const system = !e.actor_id;
  const entry = (text: string, tone: TimelineTone = "neutral", detail: string | null = null, quiet = false): TimelineEntry => ({
    text,
    detail,
    tone,
    system,
    quiet,
  });

  switch (e.type) {
    case "bug.created":
      return entry("reported this bug", "info");
    case "bug.status_changed": {
      const to = d.to as StatusKey;
      const from = d.from as StatusKey;
      const action = s(d.action);
      switch (action) {
        case "start_review":
          return entry("started reviewing the report");
        case "confirm":
          return entry(`confirmed it as a valid bug`, "info", null, true);
        case "start_work":
          if (s(d.dispute_outcome as string) === "overturned") return entry("accepted it as a bug after the dispute", "positive");
          return entry(from === "regression_failed" ? "resumed work after the failed regression" : "started work on it", "info");
        case "request_info":
          return entry(`requested more information from ${L.user(d.requested_from_id as string)}`, "warning", s(d.question));
        case "provide_info":
          return entry("provided the requested information", "info");
        case "mark_not_a_bug":
          return entry("marked it Not a Bug", "warning", s(d.reason));
        case "mark_duplicate":
          return entry(
            `marked it Duplicate of ${s(d.duplicate_of_key) ?? L.bugKey(d.duplicate_of_id as string) ?? "another bug"}${
              s(d.redirected_from_key) ? ` (redirected from ${d.redirected_from_key}, itself a duplicate)` : ""
            }`,
            "warning",
            s(d.note),
          );
        case "defer":
          return entry(`deferred it${s(d.target) ? ` to ${d.target}` : ""}${s(d.revisit_on) ? `, revisit on ${d.revisit_on}` : ""}`, "neutral", s(d.reason));
        case "resume":
          return entry("resumed it", "info", s(d.note));
        case "mark_fixed":
          return entry(`marked it Fixed${s(d.fix_version) ? ` in ${d.fix_version}` : ""}`, "positive", s(d.resolution));
        case "ready_for_regression":
          return entry(`made the fix available for regression${s(d.build) ? ` (${d.build})` : ""}`, "positive");
        case "pass_regression":
          return entry("verified the fix", "positive");
        case "fail_regression":
          return entry("failed the regression and reopened it", "danger", s(d.reason));
        case "reopen":
          return entry("reopened it", "danger", s(d.reason));
        case "dispute":
          return entry(`disputed the ${L.status(from)} decision`, "warning", s(d.reason));
        case "uphold_decision":
          return entry(`upheld the ${L.status(to)} decision`, "warning", s(d.note));
        case "close":
          return entry("closed it", "positive");
        case "force_close":
          return entry("closed it without verification", "danger", s(d.reason));
        case "automatic":
        default:
          if (to === "regression_required") return entry("Regression testing requested", "warning", null, false);
          if (to === "closed") return entry("Bug closed", "positive", s(d.reason));
          return entry(`moved it from ${L.status(from)} to ${L.status(to)}`);
      }
    }
    case "bug.confirmed":
      return entry("confirmed it as a valid bug", "info");
    case "bug.assigned": {
      const to = d.to as string | null;
      if (d.automatic) return entry(`Assigned to ${L.user(to)}`, "neutral", s(d.reason));
      if (!to) return entry(`unassigned ${L.user(d.from as string)}`);
      return entry(d.from ? `reassigned it from ${L.user(d.from as string)} to ${L.user(to)}` : `assigned it to ${L.user(to)}`);
    }
    case "bug.collaborators_changed": {
      const added = (d.added as string[] | undefined) ?? [];
      const removed = (d.removed as string[] | undefined) ?? [];
      const parts = [
        added.length ? `added ${added.map((id) => L.user(id)).join(", ")} as collaborator${added.length > 1 ? "s" : ""}` : "",
        removed.length ? `removed ${removed.map((id) => L.user(id)).join(", ")}` : "",
      ].filter(Boolean);
      return entry(parts.join(" and ") || "updated collaborators");
    }
    case "bug.updated": {
      const changes = (d.changes as Record<string, { from: unknown; to: unknown }>) ?? {};
      const names = Object.keys(changes).map((k) => FIELD_LABELS[k] ?? k.replace(/_/g, " "));
      const moduleChange = changes.module_id;
      if (moduleChange && names.length === 1) {
        return entry(`moved it from ${L.module(moduleChange.from as string) ?? "?"} to ${L.module(moduleChange.to as string) ?? "?"}`);
      }
      return entry(`edited the ${names.join(", ")}`);
    }
    case "bug.severity_changed":
      return entry(`changed severity from ${L.severity(d.from as string)} to ${L.severity(d.to as string)}`, "warning", s(d.reason));
    case "bug.priority_changed":
      return entry(`changed priority from ${L.priority(d.from as string)} to ${L.priority(d.to as string)}`, "neutral", s(d.reason));
    case "comment.added":
      return entry("commented", "neutral", null, true);
    case "regression.requested":
      return entry(
        d.assignee_id
          ? `Regression round ${d.round} assigned to ${L.user(d.assignee_id as string)}${s(d.build) ? ` for build ${d.build}` : ""}`
          : `Regression round ${d.round} is waiting for a QA owner`,
        "warning",
        null,
        true,
      );
    case "regression.started":
      return entry(`started regression testing (round ${d.round})`, "info");
    case "regression.passed":
      return entry(
        `passed regression round ${d.round}${s(d.build) ? ` on ${d.build}` : ""}${L.environment(d.environment_id as string) ? ` in ${L.environment(d.environment_id as string)}` : ""}`,
        "positive",
        s(d.notes),
        true,
      );
    case "regression.failed":
      return entry(`failed regression round ${d.round}${s(d.build) ? ` on ${d.build}` : ""}`, "danger", null, true);
    case "regression.reassigned":
      return entry(`reassigned regression round ${d.round} to ${L.user(d.to as string)}`);
    case "bug.info_requested":
    case "bug.info_provided":
      return entry("updated the information request", "neutral", null, true);
    case "bug.co_reporter_added":
      if (d.via_bug_id) {
        return entry(`${L.user(d.user_id as string)} gets co-reporter credit (reported ${s(d.via_bug_key) ?? L.bugKey(d.via_bug_id as string) ?? "a duplicate"})`, "info");
      }
      return entry("is also seeing this problem", "info", s(d.note));
    case "bug.duplicate_received":
      return entry(`${s(d.duplicate_key) ?? L.bugKey(d.duplicate_id as string) ?? "Another bug"} was marked as a duplicate of this bug`, "info", s(d.title));
    case "bug.duplicate_unlinked":
      return entry(`${s(d.duplicate_key) ?? "A duplicate"} was unlinked after its reporter disputed the decision`, "warning");
    case "bug.potential_duplicate": {
      const matches = (d.matches as { key: string }[] | undefined) ?? [];
      return entry(`Possible duplicate of ${matches.map((m) => m.key).join(", ")} detected. Triage decides.`, "warning");
    }
    case "bug.link_added":
      return entry(`linked ${s(d.target_key) ?? "a related bug"}`);
    case "bug.link_removed":
      return entry(`removed the link to ${s(d.target_key) ?? "a related bug"}`);
    case "bug.disputed":
      return entry("disputed the decision", "warning", s(d.reason), true);
    case "bug.dispute_resolved":
      return entry("resolved the dispute", "info", null, true);
    case "bug.decision_upheld":
      return entry("upheld the decision", "warning", s(d.note), true);
    case "bug.decision_accepted":
      return entry(`accepted the ${L.status(d.status as StatusKey)} decision`, "neutral");
    case "bug.reopened":
      return entry("reopened it", "danger", s(d.reason), true);
    case "bug.closed":
      return entry(d.override ? "closed it without verification" : "closed it", d.override ? "danger" : "positive", s(d.reason), true);
    case "bug.archived":
      return entry("archived this bug", "danger", s(d.reason));
    case "bug.restored":
      return entry("restored this bug", "info");
    default:
      return entry(e.type.replace(/[._]/g, " "), "neutral");
  }
}
