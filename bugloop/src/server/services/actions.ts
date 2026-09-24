// Lifecycle actions: the workflow engine decides whether an action is allowed; this module
// applies its effects (status, credit fields, regression rounds, links, events,
// notifications) in one transaction.

import type { Bug, CommentKind, DisputeContext, RejectionCategory, StatusKey } from "../../core/types";
import { REJECTION_CATEGORIES, ROOT_CAUSES } from "../../core/types";
import { ACTION_DEFS, checkAction, targetStatus, type ActionKey } from "../../core/workflow";
import { canBeAssignee } from "../../core/permissions";
import type { AppContext } from "../context";
import { nowIso, atOneMoment } from "../context";
import type { UserRow } from "../db/schema";
import { insertAttachments, withStoredFiles, type IncomingFile, type StoredFile } from "./attachments";
import { pendingRun, resolveBug, workflowContext } from "./bugs";
import { addWatchers, notify, recordEvent } from "./events";
import { getSettings, statusEnabledFn, statusLabel } from "./lookups";
import { createRegressionRun } from "./regression";
import { badRequest, cleanText, forbidden, newId, sortableId } from "./util";

export type ActionInput = Record<string, unknown>;

const TRIAGE_ROLES = new Set(["engineer", "project_manager", "qa_lead", "admin"]);

function str(input: ActionInput, key: string, max = 20000): string | null {
  return cleanText(input[key], max);
}

function bool(input: ActionInput, key: string, fallback: boolean): boolean {
  const v = input[key];
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  return v === "true" || v === "1" || v === "on";
}

function validateInput(key: ActionKey, input: ActionInput, files: IncomingFile[]): void {
  const def = ACTION_DEFS[key];
  for (const field of def.fields) {
    if (field.required && field.kind !== "files" && field.kind !== "checkbox" && !cleanText(input[field.name])) {
      throw badRequest(`${field.label} is required.`);
    }
  }
  if (files.length && !def.fields.some((f) => f.kind === "files")) throw badRequest("This action doesn't take attachments.");
}

function addComment(ctx: AppContext, bugId: string, authorId: string, kind: CommentKind, body: string) {
  const now = nowIso(ctx);
  return ctx.store.insert("comments", {
    id: sortableId("cmt", now),
    bug_id: bugId,
    author_id: authorId,
    kind,
    body,
    mentions: [],
    created_at: now,
    edited_at: null,
  });
}

/** Follow duplicate links to the original bug, rejecting cycles. */
export function rootOriginal(ctx: AppContext, start: Bug, forBugId: string): Bug {
  let current = start;
  const seen = new Set<string>();
  while (current.status === "duplicate" && current.duplicate_of_id) {
    if (seen.has(current.id)) throw badRequest("These bugs are linked in a loop.");
    seen.add(current.id);
    const next = ctx.store.get("bugs", current.duplicate_of_id);
    if (!next) break;
    current = next;
  }
  if (current.id === forBugId) throw badRequest("A bug can't be a duplicate of itself (directly or through other duplicates).");
  return current;
}

function projectLeads(ctx: AppContext, bug: Bug): string[] {
  const project = ctx.store.get("projects", bug.project_id);
  const ids = project?.qa_lead_id ? [project.qa_lead_id] : ctx.store.find("users", { where: { role: "qa_lead", active: true } }).map((u) => u.id);
  return ids;
}

export async function performAction(
  ctx: AppContext,
  user: UserRow,
  bugOrRef: Bug | string,
  key: ActionKey,
  input: ActionInput = {},
  files: IncomingFile[] = [],
): Promise<Bug> {
  ctx = atOneMoment(ctx);
  const bug = typeof bugOrRef === "string" ? resolveBug(ctx, bugOrRef) : bugOrRef;
  if (!(key in ACTION_DEFS)) throw badRequest(`Unknown action ${key}.`);
  const settings = getSettings(ctx);
  const wctx = workflowContext(ctx, user, bug, settings);
  const check = checkAction(key, wctx);
  if (!check.ok) throw forbidden(check.reason);
  validateInput(key, input, files);
  const isEnabled = statusEnabledFn(ctx);

  // Validate references before touching storage.
  let duplicateTarget: Bug | null = null;
  let duplicateRequested: Bug | null = null;
  if (key === "mark_duplicate") {
    duplicateRequested = resolveBug(ctx, String(input.duplicate_of));
    if (duplicateRequested.archived_at) throw badRequest(`${duplicateRequested.key} is archived.`);
    duplicateTarget = rootOriginal(ctx, duplicateRequested, bug.id);
  }
  let requestedFrom: UserRow | undefined;
  if (key === "request_info") {
    const id = str(input, "requested_from_id") ?? bug.reporter_id;
    requestedFrom = ctx.store.get("users", id);
    if (!requestedFrom || !requestedFrom.active) throw badRequest("Choose an active person to ask.");
  }
  const environmentId = str(input, "environment_id");
  if (environmentId && !ctx.store.get("environments", environmentId)) throw badRequest("Unknown environment.");
  const rootCause = str(input, "root_cause");
  if (rootCause && !(ROOT_CAUSES as readonly string[]).includes(rootCause)) throw badRequest("Unknown root cause.");
  const category = str(input, "category");
  if (category && !(REJECTION_CATEGORIES as readonly string[]).includes(category)) throw badRequest("Unknown category.");

  return withStoredFiles(ctx, files, (stored: StoredFile[]) => {
    const now = nowIso(ctx);
    let current = ctx.store.get("bugs", bug.id)!;
    const apply = (patch: Partial<Bug>) => {
      current = ctx.store.update("bugs", bug.id, { ...patch, updated_at: now, last_activity_at: now });
    };
    const transition = (to: StatusKey, patch: Partial<Bug> = {}, data: Record<string, unknown> = {}, actorId: string | null = user.id) => {
      const from = current.status;
      apply({ ...patch, status: to, status_changed_at: now });
      recordEvent(ctx, { bugId: bug.id, actorId, type: "bug.status_changed", data: { from, to, action: actorId ? key : "automatic", ...data } });
    };
    const firstResponse: Partial<Bug> =
      !current.first_response_at && user.id !== bug.reporter_id && TRIAGE_ROLES.has(user.role) ? { first_response_at: now } : {};
    const to = targetStatus(key, current, isEnabled);
    const label = (s: StatusKey) => statusLabel(ctx, s);

    switch (key) {
      case "start_review": {
        transition("under_review", { ...firstResponse, reviewed_by_id: current.reviewed_by_id ?? user.id, reviewed_at: current.reviewed_at ?? now });
        notify(ctx, [bug.reporter_id], {
          type: "review_started",
          category: "progress",
          bugId: bug.id,
          actorId: user.id,
          title: `${user.name} started reviewing ${bug.key}.`,
        });
        break;
      }
      case "confirm": {
        const patch: Partial<Bug> = {
          ...firstResponse,
          confirmed_by_id: user.id,
          confirmed_at: now,
          reviewed_by_id: current.reviewed_by_id ?? user.id,
          reviewed_at: current.reviewed_at ?? now,
        };
        if (to && to !== current.status) transition(to, patch);
        else apply(patch);
        recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.confirmed", data: {} });
        notify(ctx, [bug.reporter_id], {
          type: "confirmed",
          category: "progress",
          bugId: bug.id,
          actorId: user.id,
          title: `${bug.key} was confirmed as a bug by ${user.name}.`,
        });
        break;
      }
      case "start_work": {
        const wasDisputed = current.disputed;
        const wasReopened = current.status === "regression_failed";
        const assign = !current.assignee_id && canBeAssignee(user.role) ? user.id : current.assignee_id;
        transition(
          "in_progress",
          {
            ...firstResponse,
            assignee_id: assign,
            confirmed_by_id: current.confirmed_by_id ?? user.id,
            confirmed_at: current.confirmed_at ?? now,
            reviewed_by_id: current.reviewed_by_id ?? user.id,
            reviewed_at: current.reviewed_at ?? now,
            disputed: false,
            dispute_context: null,
            resolution_reason: wasDisputed ? null : current.resolution_reason,
            rejection_category: wasDisputed ? null : current.rejection_category,
          },
          wasDisputed ? { dispute_outcome: "overturned" } : {},
        );
        if (assign && assign !== bug.assignee_id) {
          recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.assigned", data: { from: bug.assignee_id, to: assign } });
        }
        if (wasDisputed) {
          recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.dispute_resolved", data: { outcome: "overturned" } });
          notify(ctx, [bug.reporter_id], {
            type: "dispute_overturned",
            category: "decision",
            bugId: bug.id,
            actorId: user.id,
            title: `${bug.key} was accepted as a bug after your dispute.`,
          });
        } else if (!wasReopened) {
          notify(ctx, [bug.reporter_id], {
            type: "work_started",
            category: "progress",
            bugId: bug.id,
            actorId: user.id,
            title: `${user.name} started working on ${bug.key}.`,
          });
        }
        break;
      }
      case "request_info": {
        const question = str(input, "question")!;
        const comment = addComment(ctx, bug.id, user.id, "question", question);
        transition(
          "need_info",
          {
            ...firstResponse,
            info_return_status: current.status,
            info_requested_from_id: requestedFrom!.id,
            info_requested_by_id: user.id,
          },
          { question, requested_from_id: requestedFrom!.id, comment_id: comment.id },
        );
        addWatchers(ctx, bug.id, [requestedFrom!.id]);
        notify(ctx, [requestedFrom!.id], {
          type: "info_requested",
          category: "action",
          bugId: bug.id,
          actorId: user.id,
          title: `${user.name} requested more information for ${bug.key}.`,
          body: question,
        });
        break;
      }
      case "provide_info": {
        const answer = str(input, "answer")!;
        const comment = addComment(ctx, bug.id, user.id, "answer", answer);
        const atts = insertAttachments(ctx, stored, { bugId: bug.id, uploaderId: user.id, context: "info", commentId: comment.id });
        const askedBy = current.info_requested_by_id;
        transition(
          to!,
          { info_return_status: null, info_requested_from_id: null, info_requested_by_id: null },
          { comment_id: comment.id, attachment_ids: atts.map((a) => a.id) },
        );
        notify(ctx, [askedBy, current.assignee_id], {
          type: atts.length ? "evidence_added" : "info_provided",
          category: "action",
          bugId: bug.id,
          actorId: user.id,
          title: atts.length
            ? `${user.name} provided the requested information and evidence for ${bug.key}.`
            : `${user.name} provided the requested information for ${bug.key}.`,
          body: answer,
        });
        break;
      }
      case "mark_not_a_bug": {
        const reason = str(input, "reason")!;
        transition(
          "not_a_bug",
          {
            ...firstResponse,
            resolution_reason: reason,
            rejection_category: (category as RejectionCategory | null) ?? null,
            decision_by_id: user.id,
            decision_at: now,
            decision_acknowledged_at: null,
            info_return_status: null,
            info_requested_from_id: null,
            info_requested_by_id: null,
          },
          { reason, category },
        );
        notify(ctx, [bug.reporter_id], {
          type: "not_a_bug",
          category: "decision",
          bugId: bug.id,
          actorId: user.id,
          title: `${bug.key} was marked Not a Bug.`,
          body: reason,
        });
        break;
      }
      case "mark_duplicate": {
        const root = duplicateTarget!;
        const note = str(input, "note");
        const redirectedFrom = duplicateRequested && duplicateRequested.id !== root.id ? duplicateRequested.key : null;
        transition(
          "duplicate",
          {
            ...firstResponse,
            duplicate_of_id: root.id,
            resolution_reason: note,
            decision_by_id: user.id,
            decision_at: now,
            decision_acknowledged_at: null,
            info_return_status: null,
            info_requested_from_id: null,
            info_requested_by_id: null,
          },
          { duplicate_of_id: root.id, duplicate_of_key: root.key, redirected_from_key: redirectedFrom, note },
        );
        linkDuplicate(ctx, current, root, user.id);
        notify(ctx, [bug.reporter_id], {
          type: "duplicate",
          category: "decision",
          bugId: bug.id,
          actorId: user.id,
          title: `${bug.key} was marked Duplicate of ${root.key}.`,
          body: note ?? root.title,
        });
        notify(ctx, [root.assignee_id], {
          type: "duplicate_linked",
          category: "progress",
          bugId: root.id,
          actorId: user.id,
          title: `${bug.key} was linked as a duplicate of ${root.key}.`,
          body: bug.title,
        });
        break;
      }
      case "defer": {
        const reason = str(input, "reason")!;
        const target = str(input, "target", 200);
        const revisit = str(input, "revisit_on", 40);
        transition(
          "deferred",
          {
            ...firstResponse,
            resolution_reason: reason,
            deferred_target: target,
            deferred_until: revisit,
            decision_by_id: user.id,
            decision_at: now,
            decision_acknowledged_at: null,
            info_return_status: null,
            info_requested_from_id: null,
            info_requested_by_id: null,
          },
          { reason, target, revisit_on: revisit },
        );
        notify(ctx, [bug.reporter_id], {
          type: "deferred",
          category: "decision",
          bugId: bug.id,
          actorId: user.id,
          title: `${bug.key} was deferred${target ? ` to ${target}` : ""}.`,
          body: reason,
        });
        break;
      }
      case "resume": {
        const note = str(input, "note");
        transition(to!, { deferred_target: null, deferred_until: null, resolution_reason: null }, { note });
        if (note) addComment(ctx, bug.id, user.id, "comment", note);
        notify(ctx, [bug.reporter_id, current.assignee_id], {
          type: "resumed",
          category: "progress",
          bugId: bug.id,
          actorId: user.id,
          title: `${bug.key} was taken off hold.`,
          body: note,
        });
        break;
      }
      case "mark_fixed": {
        const resolution = str(input, "resolution")!;
        const fixVersion = str(input, "fix_version", 100);
        const availableNow = bool(input, "available_now", true);
        transition(
          "fixed",
          {
            ...firstResponse,
            fixed_by_id: user.id,
            fixed_at: now,
            fix_version: fixVersion,
            resolution_summary: resolution,
            root_cause: rootCause,
            assignee_id: current.assignee_id ?? (canBeAssignee(user.role) ? user.id : null),
            confirmed_by_id: current.confirmed_by_id ?? user.id,
            confirmed_at: current.confirmed_at ?? now,
            verified_by_id: null,
            verified_at: null,
          },
          { resolution, fix_version: fixVersion, root_cause: rootCause, available_now: availableNow, collaborators: current.collaborator_ids },
        );
        if (availableNow) {
          transition("regression_required", {}, { reason: "Fix is available for testing" }, null);
          createRegressionRun(ctx, current, { requestedById: user.id, environmentId, build: fixVersion });
        } else {
          notify(ctx, [bug.reporter_id], {
            type: "fixed",
            category: "progress",
            bugId: bug.id,
            actorId: user.id,
            title: `${bug.key} was fixed. Regression starts when the fix is deployed for testing.`,
            body: resolution,
          });
        }
        break;
      }
      case "ready_for_regression": {
        const build = str(input, "build", 100);
        transition("regression_required", build ? { fix_version: build } : {}, { build, environment_id: environmentId });
        createRegressionRun(ctx, current, { requestedById: user.id, environmentId, build: build ?? current.fix_version });
        break;
      }
      case "start_regression": {
        const run = pendingRun(ctx, bug.id)!;
        ctx.store.update("regression_runs", run.id, { started_at: now, assignee_id: run.assignee_id ?? user.id });
        recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "regression.started", entityType: "regression_run", entityId: run.id, data: { round: run.round } });
        apply({});
        notify(ctx, [current.fixed_by_id, current.assignee_id], {
          type: "regression_started",
          category: "progress",
          bugId: bug.id,
          actorId: user.id,
          title: `${user.name} started regression testing of ${bug.key}.`,
        });
        break;
      }
      case "pass_regression": {
        const run = pendingRun(ctx, bug.id)!;
        const notes = str(input, "notes");
        const build = str(input, "build", 100);
        ctx.store.update("regression_runs", run.id, {
          result: "passed",
          started_at: run.started_at ?? now,
          completed_at: now,
          completed_by_id: user.id,
          environment_id: environmentId ?? run.environment_id,
          build: build ?? run.build,
          notes,
        });
        const atts = insertAttachments(ctx, stored, { bugId: bug.id, uploaderId: user.id, context: "regression", runId: run.id });
        recordEvent(ctx, {
          bugId: bug.id,
          actorId: user.id,
          type: "regression.passed",
          entityType: "regression_run",
          entityId: run.id,
          data: { round: run.round, notes, build: build ?? run.build, environment_id: environmentId ?? run.environment_id, attachment_ids: atts.map((a) => a.id) },
        });
        transition("verified", { verified_by_id: user.id, verified_at: now });
        notify(ctx, [current.fixed_by_id, current.assignee_id], {
          type: "fix_verified",
          category: "progress",
          bugId: bug.id,
          actorId: user.id,
          title: `${user.name} verified the fix for ${bug.key}.`,
          body: notes,
        });
        if (settings.auto_close_on_verify) {
          transition("closed", { closed_by_id: null, closed_at: now, close_reason: null }, { reason: "Closed automatically after verification" }, null);
          recordEvent(ctx, { bugId: bug.id, actorId: null, type: "bug.closed", data: { automatic: true } });
        }
        const dups = ctx.store.find("bugs", { where: { duplicate_of_id: bug.id } });
        for (const d of dups) {
          notify(ctx, [d.reporter_id], {
            type: "original_verified",
            category: "progress",
            bugId: d.id,
            actorId: user.id,
            title: `${bug.key} (the original of your ${d.key}) was verified${settings.auto_close_on_verify ? " and closed" : ""}.`,
            body: "Check that your scenario is fixed too. Reopen the original if it still happens.",
          });
        }
        break;
      }
      case "fail_regression": {
        const run = pendingRun(ctx, bug.id)!;
        const details = str(input, "details")!;
        const build = str(input, "build", 100);
        const comment = addComment(ctx, bug.id, user.id, "regression", details);
        ctx.store.update("regression_runs", run.id, {
          result: "failed",
          started_at: run.started_at ?? now,
          completed_at: now,
          completed_by_id: user.id,
          environment_id: environmentId ?? run.environment_id,
          build: build ?? run.build,
          notes: details,
        });
        const atts = insertAttachments(ctx, stored, { bugId: bug.id, uploaderId: user.id, context: "regression", runId: run.id, commentId: comment.id });
        recordEvent(ctx, {
          bugId: bug.id,
          actorId: user.id,
          type: "regression.failed",
          entityType: "regression_run",
          entityId: run.id,
          data: { round: run.round, details, build: build ?? run.build, environment_id: environmentId ?? run.environment_id, comment_id: comment.id, attachment_ids: atts.map((a) => a.id) },
        });
        const reopenCount = current.reopen_count + 1;
        transition("regression_failed", { reopen_count: reopenCount, verified_by_id: null, verified_at: null }, { reason: details });
        notify(ctx, [current.assignee_id, current.fixed_by_id], {
          type: "regression_failed",
          category: "action",
          bugId: bug.id,
          actorId: user.id,
          title: `QA reopened ${bug.key} after failed regression.`,
          body: details,
        });
        escalateReopens(ctx, current, reopenCount, user.id, settings.escalate_after_reopens);
        break;
      }
      case "reopen": {
        const reason = str(input, "reason")!;
        const comment = addComment(ctx, bug.id, user.id, "regression", reason);
        const atts = insertAttachments(ctx, stored, { bugId: bug.id, uploaderId: user.id, context: "regression", commentId: comment.id });
        const reopenCount = current.reopen_count + 1;
        transition(
          "regression_failed",
          { reopen_count: reopenCount, closed_at: null, closed_by_id: null, close_reason: null, verified_by_id: null, verified_at: null },
          { reason, comment_id: comment.id, attachment_ids: atts.map((a) => a.id) },
        );
        recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.reopened", data: { reason } });
        notify(ctx, [current.assignee_id, current.fixed_by_id], {
          type: "reopened",
          category: "action",
          bugId: bug.id,
          actorId: user.id,
          title: `${user.name} reopened ${bug.key}.`,
          body: reason,
        });
        escalateReopens(ctx, current, reopenCount, user.id, settings.escalate_after_reopens);
        break;
      }
      case "dispute": {
        const reason = str(input, "reason")!;
        const from = current.status as "not_a_bug" | "duplicate";
        const context: DisputeContext = {
          from,
          reason,
          disputed_by_id: user.id,
          disputed_at: now,
          decided_by_id: current.decision_by_id,
          resolution_reason: current.resolution_reason,
          rejection_category: current.rejection_category,
          duplicate_of_id: current.duplicate_of_id,
        };
        if (from === "duplicate" && current.duplicate_of_id) unlinkDuplicate(ctx, current, current.duplicate_of_id);
        const comment = addComment(ctx, bug.id, user.id, "dispute", reason);
        transition(to!, { disputed: true, dispute_context: context, duplicate_of_id: null, decision_acknowledged_at: null }, { reason, comment_id: comment.id });
        recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.disputed", data: { from, reason } });
        notify(ctx, [context.decided_by_id, ...projectLeads(ctx, current)], {
          type: "disputed",
          category: "action",
          bugId: bug.id,
          actorId: user.id,
          title: `${user.name} disputed the ${label(from)} decision on ${bug.key}.`,
          body: reason,
        });
        break;
      }
      case "uphold_decision": {
        const note = str(input, "note")!;
        const context = current.dispute_context!;
        let original: Bug | null = null;
        if (context.from === "duplicate" && context.duplicate_of_id) {
          const target = ctx.store.get("bugs", context.duplicate_of_id);
          if (target) original = rootOriginal(ctx, target, bug.id);
        }
        const comment = addComment(ctx, bug.id, user.id, "decision", note);
        transition(
          context.from,
          {
            disputed: false,
            dispute_context: null,
            dispute_locked: true,
            resolution_reason: context.resolution_reason,
            rejection_category: context.rejection_category,
            duplicate_of_id: original?.id ?? null,
            decision_at: now,
            decision_acknowledged_at: null,
          },
          { note, comment_id: comment.id, upheld: true, duplicate_of_id: original?.id ?? null, duplicate_of_key: original?.key ?? null },
        );
        if (original) linkDuplicate(ctx, current, original, user.id);
        recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.decision_upheld", data: { from: context.from, note } });
        notify(ctx, [bug.reporter_id], {
          type: "decision_upheld",
          category: "decision",
          bugId: bug.id,
          actorId: user.id,
          title: `${user.name} upheld the ${label(context.from)} decision on ${bug.key}.`,
          body: note,
        });
        notify(ctx, [context.decided_by_id], {
          type: "decision_upheld",
          category: "progress",
          bugId: bug.id,
          actorId: user.id,
          title: `Your ${label(context.from)} decision on ${bug.key} was upheld.`,
        });
        break;
      }
      case "accept_decision": {
        apply({ decision_acknowledged_at: now });
        recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.decision_accepted", data: { status: current.status } });
        notify(ctx, [current.decision_by_id], {
          type: "decision_accepted",
          category: "progress",
          bugId: bug.id,
          actorId: user.id,
          title: `${user.name} accepted your ${label(current.status)} decision on ${bug.key}.`,
        });
        break;
      }
      case "close": {
        transition("closed", { closed_by_id: user.id, closed_at: now, close_reason: null });
        recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.closed", data: {} });
        break;
      }
      case "force_close": {
        const reason = str(input, "reason")!;
        const run = pendingRun(ctx, bug.id);
        if (run) ctx.store.update("regression_runs", run.id, { result: "cancelled", completed_at: now, completed_by_id: user.id, notes: reason });
        transition("closed", { closed_by_id: user.id, closed_at: now, close_reason: reason }, { reason, override: true });
        recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.closed", data: { override: true, reason } });
        notify(ctx, [bug.reporter_id, current.assignee_id], {
          type: "force_closed",
          category: "decision",
          bugId: bug.id,
          actorId: user.id,
          title: `${bug.key} was closed without verification.`,
          body: reason,
        });
        break;
      }
      case "archive": {
        const reason = str(input, "reason")!;
        const run = pendingRun(ctx, bug.id);
        if (run) ctx.store.update("regression_runs", run.id, { result: "cancelled", completed_at: now, completed_by_id: user.id, notes: "Bug archived" });
        apply({ archived_at: now, archived_by_id: user.id, archive_reason: reason });
        recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.archived", data: { reason } });
        notify(ctx, [bug.reporter_id, current.assignee_id], {
          type: "archived",
          category: "progress",
          bugId: bug.id,
          actorId: user.id,
          title: `${bug.key} was archived.`,
          body: reason,
        });
        break;
      }
      case "restore": {
        apply({ archived_at: null, archived_by_id: null, archive_reason: null });
        recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.restored", data: {} });
        if (current.status === "regression_required" && !pendingRun(ctx, bug.id)) {
          createRegressionRun(ctx, current, { requestedById: user.id });
        }
        break;
      }
    }

    addWatchers(ctx, bug.id, [user.id]);
    return ctx.store.get("bugs", bug.id)!;
  });
}

function escalateReopens(ctx: AppContext, bug: Bug, count: number, actorId: string, threshold: number): void {
  if (count < threshold) return;
  const project = ctx.store.get("projects", bug.project_id);
  notify(ctx, [...projectLeads(ctx, bug), project?.pm_id], {
    type: "reopen_escalation",
    category: "progress",
    bugId: bug.id,
    actorId,
    title: `${bug.key} has been reopened ${count} times.`,
    body: bug.title,
  });
}

/** Link a duplicate to its original and carry credit and watchers over. */
export function linkDuplicate(ctx: AppContext, dup: Bug, original: Bug, actorId: string): void {
  const now = nowIso(ctx);
  if (!ctx.store.findOne("bug_links", { bug_id: dup.id, target_bug_id: original.id, kind: "duplicate_of" })) {
    ctx.store.insert("bug_links", { id: newId("lnk"), bug_id: dup.id, target_bug_id: original.id, kind: "duplicate_of", created_by_id: actorId, created_at: now });
  }
  const credit = [
    { user_id: dup.reporter_id, note: null as string | null },
    ...ctx.store.find("co_reporters", { where: { bug_id: dup.id } }).map((c) => ({ user_id: c.user_id, note: c.note })),
  ];
  for (const c of credit) {
    if (c.user_id === original.reporter_id) continue;
    if (ctx.store.findOne("co_reporters", { bug_id: original.id, user_id: c.user_id })) continue;
    ctx.store.insert("co_reporters", { id: newId("crp"), bug_id: original.id, user_id: c.user_id, via_bug_id: dup.id, note: c.note, created_at: now });
    recordEvent(ctx, {
      bugId: original.id,
      actorId,
      type: "bug.co_reporter_added",
      data: { user_id: c.user_id, via_bug_id: dup.id, via_bug_key: dup.key },
    });
  }
  recordEvent(ctx, {
    bugId: original.id,
    actorId,
    type: "bug.duplicate_received",
    data: { duplicate_id: dup.id, duplicate_key: dup.key, title: dup.title },
  });
  addWatchers(ctx, original.id, ctx.store.find("watchers", { where: { bug_id: dup.id } }).map((w) => w.user_id));
  ctx.store.update("bugs", original.id, { last_activity_at: now });
}

function unlinkDuplicate(ctx: AppContext, dup: Bug, originalId: string): void {
  for (const l of ctx.store.find("bug_links", { where: { bug_id: dup.id, target_bug_id: originalId, kind: "duplicate_of" } })) {
    ctx.store.remove("bug_links", l.id);
  }
  for (const c of ctx.store.find("co_reporters", { where: { bug_id: originalId, via_bug_id: dup.id } })) {
    ctx.store.remove("co_reporters", c.id);
  }
  recordEvent(ctx, { bugId: originalId, actorId: null, type: "bug.duplicate_unlinked", data: { duplicate_id: dup.id, duplicate_key: dup.key } });
}

