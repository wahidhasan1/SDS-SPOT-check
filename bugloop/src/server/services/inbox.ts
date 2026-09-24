// "Needs my action" and notifications. Action items are derived from current bug state, so
// they disappear as soon as the underlying work is done.

import type { ActionItem, ActionItemKind, ActionItemsResponse, NotificationsResponse, ViewCounts } from "../../core/api";
import type { Bug } from "../../core/types";
import { OPEN_STATUSES } from "../../core/statuses";
import type { AppContext } from "../context";
import type { UserRow } from "../db/schema";
import { listEnv, toListItem } from "./bugs";
import { getSettings, statusLabel } from "./lookups";

const ORDER: ActionItemKind[] = [
  "answer_question",
  "run_regression",
  "reopened",
  "info_received",
  "dispute",
  "assign_regression",
  "review_decision",
  "make_testable",
  "triage",
  "work",
  "reassign",
  "revisit",
  "close_verified",
];

export function actionItems(ctx: AppContext, user: UserRow): ActionItemsResponse {
  const env = listEnv(ctx);
  const settings = getSettings(ctx);
  const items: ActionItem[] = [];
  const seen = new Set<string>();
  const add = (kind: ActionItemKind, bug: Bug, label: string, detail: string, since: string) => {
    const k = `${kind}:${bug.id}`;
    if (seen.has(k)) return;
    seen.add(k);
    items.push({ kind, label, detail, since, bug: toListItem(bug, env) });
  };
  const live = (where: Parameters<typeof ctx.store.find<"bugs">>[1] = {}) =>
    ctx.store.find("bugs", { ...where, where: { archived_at: null, ...(where.where ?? {}) } });
  const isLead = user.role === "qa_lead" || user.role === "admin";
  const isManager = user.role === "project_manager" || user.role === "admin";
  const recent = new Date(Date.parse(env.now) - 60 * 86_400_000).toISOString();

  // Questions waiting for me.
  for (const bug of live({ where: { status: "need_info" } })) {
    const askedMe = bug.info_requested_from_id ? bug.info_requested_from_id === user.id : bug.reporter_id === user.id;
    if (!askedMe) continue;
    const question = ctx.store.findOne("comments", { bug_id: bug.id, kind: "question" }, [{ column: "created_at", dir: "desc" }]);
    add("answer_question", bug, "Answer engineering's question", question?.body ?? "More information requested.", bug.status_changed_at);
  }

  // Regression rounds.
  for (const run of ctx.store.find("regression_runs", { where: { result: "pending" } })) {
    const bug = ctx.store.get("bugs", run.bug_id);
    if (!bug || bug.archived_at || bug.status !== "regression_required") continue;
    if (run.assignee_id === user.id) {
      add(
        "run_regression",
        bug,
        run.round > 1 ? `Run regression (round ${run.round})` : "Run regression",
        bug.resolution_summary ?? "The fix is ready for testing.",
        run.requested_at,
      );
    } else if (!run.assignee_id && isLead) {
      add("assign_regression", bug, "Regression needs an owner", "Nobody in QA is assigned to test this fix.", run.requested_at);
    }
  }

  // Decisions on my reports.
  for (const bug of live({ where: { reporter_id: user.id, status: { in: ["not_a_bug", "duplicate", "deferred"] }, decision_acknowledged_at: null } })) {
    if (!bug.decision_at || bug.decision_at < recent) continue;
    add("review_decision", bug, `Review decision: ${statusLabel(ctx, bug.status)}`, bug.resolution_reason ?? "", bug.decision_at);
  }

  // Engineering work.
  const mine = live({ where: { status: { in: OPEN_STATUSES } } }).filter(
    (b) => b.assignee_id === user.id || b.collaborator_ids.includes(user.id),
  );
  for (const bug of mine) {
    if (bug.status === "regression_failed") {
      add("reopened", bug, "Reopened after failed regression", `Reopened ${bug.reopen_count}×. QA says it still fails.`, bug.status_changed_at);
      continue;
    }
    if (bug.status === "fixed") {
      add("make_testable", bug, "Make the fix testable", "Click Ready for regression once the fix is deployed.", bug.status_changed_at);
      continue;
    }
    if (bug.status === "new" || bug.status === "under_review" || bug.status === "in_progress") {
      const last = ctx.store.findOne("events", { bug_id: bug.id, type: "bug.status_changed" }, [{ column: "created_at", dir: "desc" }, { column: "id", dir: "desc" }]);
      if (last && (last.data as { action?: string }).action === "provide_info") {
        add("info_received", bug, "QA answered your question", "The reporter provided the information you asked for.", last.created_at);
      } else if (bug.status !== "under_review" || !bug.disputed) {
        add("work", bug, bug.status === "new" ? "New bug assigned to you" : `${statusLabel(ctx, bug.status)}`, bug.title, bug.status_changed_at);
      }
    }
  }
  // Fixed bugs I fixed that are waiting to be made testable, even if someone else owns them now.
  for (const bug of live({ where: { status: "fixed", fixed_by_id: user.id } })) {
    add("make_testable", bug, "Make the fix testable", "Click Ready for regression once the fix is deployed.", bug.status_changed_at);
  }

  // Triage: unassigned new bugs in modules I own.
  if (user.role === "engineer" || user.role === "admin") {
    const owned = new Set(ctx.store.find("modules", { where: { owner_id: user.id } }).map((m) => m.id));
    for (const bug of live({ where: { status: "new", assignee_id: null } })) {
      if (owned.has(bug.module_id)) add("triage", bug, "Needs triage", "New in a module you own.", bug.created_at);
    }
  }

  // Disputes.
  for (const bug of live({ where: { disputed: true } })) {
    const ctxd = bug.dispute_context;
    const project = ctx.store.get("projects", bug.project_id);
    const leadsIt = isLead && (user.role === "admin" || !project?.qa_lead_id || project.qa_lead_id === user.id);
    const managesIt = user.role === "project_manager" && project?.pm_id === user.id;
    if (ctxd?.decided_by_id === user.id) {
      add("dispute", bug, "Your decision was disputed", ctxd.reason, ctxd.disputed_at);
    } else if (leadsIt || managesIt) {
      add("dispute", bug, "Settle a disputed decision", ctxd?.reason ?? "", ctxd?.disputed_at ?? bug.status_changed_at);
    }
  }

  // Owners who left.
  if (isLead || isManager) {
    const inactive = new Set(ctx.store.find("users", { where: { active: false } }).map((u) => u.id));
    if (inactive.size) {
      for (const bug of live({ where: { status: { in: OPEN_STATUSES } } })) {
        if (bug.assignee_id && inactive.has(bug.assignee_id)) {
          add("reassign", bug, "Owner is no longer active", "Reassign this bug to an active engineer.", bug.status_changed_at);
        }
      }
    }
  }

  // Deferred bugs due for a revisit.
  if (isManager) {
    const today = env.now.slice(0, 10);
    for (const bug of live({ where: { status: "deferred" } })) {
      if (bug.deferred_until && bug.deferred_until <= today) {
        add("revisit", bug, "Revisit deferred bug", bug.resolution_reason ?? "", bug.deferred_until);
      }
    }
  }

  // Verified bugs waiting for a manual close.
  if (!settings.auto_close_on_verify) {
    for (const bug of live({ where: { status: "verified" } })) {
      const run = ctx.store.findOne("regression_runs", { bug_id: bug.id }, [{ column: "round", dir: "desc" }]);
      if (isLead || run?.assignee_id === user.id) add("close_verified", bug, "Close verified bug", "QA verified the fix.", bug.status_changed_at);
    }
  }

  items.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || (a.since < b.since ? -1 : a.since > b.since ? 1 : 0));
  const counts: Record<string, number> = {};
  for (const i of items) counts[i.kind] = (counts[i.kind] ?? 0) + 1;
  return { items, counts };
}

export function listNotifications(ctx: AppContext, user: UserRow, opts: { unreadOnly?: boolean; limit?: number } = {}): NotificationsResponse {
  const items = ctx.store.find("notifications", {
    where: opts.unreadOnly ? { user_id: user.id, read_at: null } : { user_id: user.id },
    orderBy: [{ column: "created_at", dir: "desc" }, { column: "id", dir: "desc" }],
    limit: Math.min(opts.limit ?? 100, 500),
  });
  return { items, unread: ctx.store.count("notifications", { user_id: user.id, read_at: null }) };
}

export function markNotificationsRead(ctx: AppContext, user: UserRow, ids: string[] | "all", read = true): number {
  const now = ctx.clock.now().toISOString();
  const rows =
    ids === "all"
      ? ctx.store.find("notifications", { where: { user_id: user.id, read_at: null } })
      : ctx.store.find("notifications", { where: { user_id: user.id, id: { in: ids } } });
  ctx.store.transaction(() => {
    for (const n of rows) ctx.store.update("notifications", n.id, { read_at: read ? now : null });
  });
  return rows.length;
}

export function viewCounts(ctx: AppContext, user: UserRow): ViewCounts {
  const items = actionItems(ctx, user);
  const assigned = ctx.store
    .find("bugs", { where: { archived_at: null, status: { in: OPEN_STATUSES.filter((s) => s !== "deferred") } } })
    .filter((b) => b.assignee_id === user.id || b.collaborator_ids.includes(user.id)).length;
  return {
    action_items: items.items.length,
    my_regression: items.counts.run_regression ?? 0,
    unread_notifications: ctx.store.count("notifications", { user_id: user.id, read_at: null }),
    assigned,
    mine_open: ctx.store.count("bugs", { reporter_id: user.id, archived_at: null, status: { in: OPEN_STATUSES } }),
  };
}
