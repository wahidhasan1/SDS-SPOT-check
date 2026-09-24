// Regression rounds: who owns them, how they are requested and reassigned.

import type { RegressionQueueItem } from "../../core/api";
import type { Bug, RegressionRun } from "../../core/types";
import { canOwnRegression, canReassignRegression } from "../../core/permissions";
import type { AppContext } from "../context";
import { nowIso } from "../context";
import type { UserRow } from "../db/schema";
import { listEnv, pendingRun, toListItem, actorOf } from "./bugs";
import { addWatchers, notify, recordEvent } from "./events";
import { badRequest, forbidden, newId } from "./util";

function isProjectMember(ctx: AppContext, projectId: string, userId: string): boolean {
  const rows = ctx.store.find("project_members", { where: { project_id: projectId, user_id: userId } });
  // Membership is optional: people without a membership row count as members.
  if (!rows.length) return true;
  return rows.some((r) => !r.left_at);
}

/**
 * The reporter owns regression while they are an active QA member of the project.
 * Otherwise the project's QA lead, then any QA lead. Never the person who fixed it.
 */
export function regressionOwnerFor(ctx: AppContext, bug: Bug): string | null {
  const fixer = bug.fixed_by_id;
  const eligible = (u: UserRow | undefined): u is UserRow => !!u && u.active && canOwnRegression(u.role) && u.id !== fixer;

  const reporter = ctx.store.get("users", bug.reporter_id);
  if (eligible(reporter) && isProjectMember(ctx, bug.project_id, reporter.id)) return reporter.id;

  const project = ctx.store.get("projects", bug.project_id);
  const lead = project?.qa_lead_id ? ctx.store.get("users", project.qa_lead_id) : undefined;
  if (eligible(lead)) return lead.id;

  const anyLead = ctx.store
    .find("users", { where: { role: "qa_lead", active: true }, orderBy: [{ column: "name" }] })
    .find((u) => u.id !== fixer);
  return anyLead?.id ?? null;
}

function qaLeadsFor(ctx: AppContext, bug: Bug): string[] {
  const project = ctx.store.get("projects", bug.project_id);
  if (project?.qa_lead_id) return [project.qa_lead_id];
  return ctx.store.find("users", { where: { role: "qa_lead", active: true } }).map((u) => u.id);
}

/** Create the next regression round. Call inside a transaction; the bug must already be regression_required. */
export function createRegressionRun(
  ctx: AppContext,
  bug: Bug,
  opts: { requestedById: string | null; environmentId?: string | null; build?: string | null },
): RegressionRun {
  const owner = regressionOwnerFor(ctx, bug);
  const round = bug.regression_round + 1;
  const run = ctx.store.insert("regression_runs", {
    id: newId("run"),
    bug_id: bug.id,
    round,
    assignee_id: owner,
    requested_by_id: opts.requestedById,
    requested_at: nowIso(ctx),
    environment_id: opts.environmentId ?? null,
    build: opts.build ?? bug.fix_version ?? null,
    started_at: null,
    completed_at: null,
    completed_by_id: null,
    result: "pending",
    notes: null,
  });
  ctx.store.update("bugs", bug.id, { regression_round: round });
  recordEvent(ctx, {
    bugId: bug.id,
    actorId: opts.requestedById,
    type: "regression.requested",
    entityType: "regression_run",
    entityId: run.id,
    data: { round, assignee_id: owner, build: run.build, environment_id: run.environment_id },
  });
  addWatchers(ctx, bug.id, [owner]);
  if (owner) {
    notify(ctx, [owner], {
      type: "regression_required",
      category: "action",
      bugId: bug.id,
      actorId: bug.fixed_by_id,
      title: `${bug.key} has been marked Fixed. Regression testing required.`,
      body: bug.resolution_summary,
    });
    if (owner !== bug.reporter_id) {
      notify(ctx, [bug.reporter_id], {
        type: "fixed",
        category: "progress",
        bugId: bug.id,
        actorId: bug.fixed_by_id,
        title: `${bug.key} was fixed. Regression testing is assigned to ${ctx.store.get("users", owner)?.name ?? "QA"}.`,
      });
    }
  } else {
    notify(ctx, qaLeadsFor(ctx, bug), {
      type: "regression_unassigned",
      category: "action",
      bugId: bug.id,
      actorId: null,
      title: `Regression for ${bug.key} needs a QA owner.`,
    });
  }
  return run;
}

export function reassignRegression(ctx: AppContext, user: UserRow, bug: Bug, assigneeId: string): Bug {
  if (!canReassignRegression(actorOf(user))) throw forbidden("Only a QA lead or admin can reassign regression.");
  if (bug.archived_at) throw badRequest("This bug is archived.");
  const run = pendingRun(ctx, bug.id);
  if (!run || bug.status !== "regression_required") throw badRequest("There is no regression waiting on this bug.");
  const target = ctx.store.get("users", assigneeId);
  if (!target || !target.active || !canOwnRegression(target.role)) throw badRequest("Choose an active QA analyst or QA lead.");
  if (target.id === bug.fixed_by_id) throw badRequest("The person who fixed the bug can't verify it.");
  if (target.id === run.assignee_id) return bug;
  return ctx.store.transaction(() => {
    const now = nowIso(ctx);
    ctx.store.update("regression_runs", run.id, { assignee_id: target.id, started_at: null });
    recordEvent(ctx, {
      bugId: bug.id,
      actorId: user.id,
      type: "regression.reassigned",
      entityType: "regression_run",
      entityId: run.id,
      data: { round: run.round, from: run.assignee_id, to: target.id },
    });
    addWatchers(ctx, bug.id, [target.id]);
    notify(ctx, [target.id], {
      type: "regression_required",
      category: "action",
      bugId: bug.id,
      actorId: user.id,
      title: `Regression testing required for ${bug.key}.`,
      body: `${user.name} assigned the regression to you.`,
    });
    notify(ctx, [run.assignee_id], {
      type: "regression_reassigned",
      category: "progress",
      bugId: bug.id,
      actorId: user.id,
      title: `Regression for ${bug.key} was reassigned to ${target.name}.`,
    });
    return ctx.store.update("bugs", bug.id, { updated_at: now, last_activity_at: now });
  });
}

export function regressionQueue(ctx: AppContext, user: UserRow, scope: "mine" | "all"): RegressionQueueItem[] {
  const env = listEnv(ctx);
  const runs = ctx.store.find("regression_runs", {
    where: scope === "mine" ? { result: "pending", assignee_id: user.id } : { result: "pending" },
    orderBy: [{ column: "requested_at" }],
  });
  const out: RegressionQueueItem[] = [];
  for (const run of runs) {
    const bug = ctx.store.get("bugs", run.bug_id);
    if (!bug || bug.archived_at || bug.status !== "regression_required") continue;
    out.push({
      run,
      bug: toListItem(bug, env),
      fixed_by_id: bug.fixed_by_id,
      fix_version: bug.fix_version,
      resolution_summary: bug.resolution_summary,
    });
  }
  return out;
}
