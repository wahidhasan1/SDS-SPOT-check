// Improvement suggestions. A QA analyst suggests; the project manager approves (and picks an
// engineer) or closes it; the engineer builds it and marks it done. Everyone involved is told.

import type { ImprovementActionItem, ImprovementDetail, ImprovementListResponse, PolishResult } from "../../core/api";
import type { Improvement, ImprovementStatus } from "../../core/types";
import { IMPROVEMENT_STATUSES } from "../../core/types";
import { workspaceCapabilities } from "../../core/permissions";
import type { AppContext } from "../context";
import { nowIso } from "../context";
import type { UserRow } from "../db/schema";
import { OfflineProvider } from "../ai/heuristic";
import { AiProviderError } from "../ai/provider";
import { actorOf } from "./bugs";
import { notify, recordEvent } from "./events";
import { badRequest, cleanText, conflict, forbidden, newId, notFound, requireText } from "./util";

const offline = new OfflineProvider();

const isManager = (u: UserRow) => u.role === "project_manager" || u.role === "admin";

export function improvementKey(n: number): string {
  return `IMP-${String(n).padStart(6, "0")}`;
}

export function resolveImprovement(ctx: AppContext, ref: string): Improvement {
  const r = ref.trim().toUpperCase();
  const m = /^(?:IMP-)?0*(\d+)$/.exec(r);
  const found = m ? ctx.store.findOne("improvements", { number: Number(m[1]) }) : ctx.store.get("improvements", ref);
  if (!found) throw notFound("Improvement not found.");
  return found;
}

/** The people who review suggestions for a project: its manager, or every manager if it has none. */
function reviewers(ctx: AppContext, projectId: string): string[] {
  const project = ctx.store.get("projects", projectId);
  if (project?.pm_id) return [project.pm_id];
  return ctx.store.find("users", { where: { active: true, role: "project_manager" } }).map((u) => u.id);
}

// ---------------------------------------------------------------------------
// The assistant: rough English in, one clear paragraph out
// ---------------------------------------------------------------------------

export async function polishImprovement(ctx: AppContext, user: UserRow, input: { project_id?: string; module_id?: string | null; text?: string; offline?: boolean }): Promise<PolishResult> {
  const text = requireText(input.text, "Your suggestion", 8000);
  const project = input.project_id ? ctx.store.get("projects", input.project_id) : null;
  if (!project) throw badRequest("Choose a project.");
  const modules = ctx.store.find("modules", { where: { project_id: project.id, archived: false }, orderBy: [{ column: "sort_order" }] });
  const chosen = input.module_id ? modules.find((m) => m.id === input.module_id) ?? null : null;
  const req = {
    text,
    project: project.name,
    overview: project.overview ?? project.description,
    module: chosen?.name ?? null,
    modules: modules.map((m) => ({ name: m.name, description: m.description })),
  };
  const provider = input.offline ? offline : ctx.ai;
  const started = Date.now();
  const log = (status: "ok" | "error", model: string | null, error: string | null, providerId: string) =>
    ctx.store.insert("ai_requests", {
      id: newId("air"),
      user_id: user.id,
      feature: "polish_improvement",
      provider: providerId,
      model,
      status,
      duration_ms: Date.now() - started,
      input_tokens: null,
      output_tokens: null,
      error,
      created_at: nowIso(ctx),
    });
  let note: string | null = null;
  let result;
  let used = provider;
  try {
    result = await provider.polishImprovement(req);
    log("ok", result.meta.model, null, provider.id);
  } catch (err) {
    const message = err instanceof AiProviderError ? err.message : "The assistant couldn't answer.";
    log("error", null, message.slice(0, 500), provider.id);
    used = offline;
    result = await offline.polishImprovement(req);
    note = `${message} Your text was tidied offline instead (spelling and punctuation only).`;
  }
  const out = result.output;
  if (!out.body.trim()) throw badRequest("The assistant returned an empty text. Try again or submit it as written.");
  const moduleId = chosen?.id ?? (out.module ? modules.find((m) => m.name === out.module)?.id ?? null : null);
  return { title: out.title || text.slice(0, 80), body: out.body, module_id: moduleId, provider: used.id, model: result.meta.model, note };
}

// ---------------------------------------------------------------------------
// Create, read, list
// ---------------------------------------------------------------------------

export interface ImprovementInput {
  project_id?: string;
  module_id?: string | null;
  title?: string;
  body?: string;
  original_text?: string;
  polished_by?: string | null;
}

export function createImprovement(ctx: AppContext, user: UserRow, input: ImprovementInput): Improvement {
  if (!workspaceCapabilities(actorOf(user)).report) throw forbidden("Your role can't send suggestions.");
  const project = input.project_id ? ctx.store.get("projects", input.project_id) : null;
  if (!project || project.archived) throw badRequest("Choose a project.");
  const mod = input.module_id ? ctx.store.get("modules", input.module_id) : null;
  if (input.module_id && (!mod || mod.project_id !== project.id)) throw badRequest("That module isn't part of this project.");
  const body = requireText(input.body, "Your suggestion", 8000);
  const original = cleanText(input.original_text, 8000) ?? body;
  const title = cleanText(input.title, 120) ?? body.split(/(?<=[.!?])\s/)[0].slice(0, 80);
  const polished = input.polished_by && ["anthropic", "artifact", "offline"].includes(input.polished_by) ? input.polished_by : null;
  return ctx.store.transaction(() => {
    const now = nowIso(ctx);
    const number = ctx.store.nextSequence("improvement_number", 1);
    const imp = ctx.store.insert("improvements", {
      id: newId("imp"),
      number,
      key: improvementKey(number),
      project_id: project.id,
      module_id: mod?.id ?? null,
      reporter_id: user.id,
      title,
      body,
      original_text: original,
      polished_by: polished,
      status: "proposed",
      assignee_id: null,
      decided_by_id: null,
      decided_at: null,
      decision_note: null,
      done_by_id: null,
      done_at: null,
      done_note: null,
      created_at: now,
      updated_at: now,
    });
    recordEvent(ctx, { actorId: user.id, type: "improvement.created", entityType: "improvement", entityId: imp.id, data: { key: imp.key, title } });
    notify(ctx, reviewers(ctx, project.id), {
      type: "improvement.created",
      category: "action",
      bugId: null,
      improvementId: imp.id,
      actorId: user.id,
      title: `${user.name} suggested an improvement: ${imp.key}.`,
      body: title,
    });
    return imp;
  });
}

export function listImprovements(ctx: AppContext, user: UserRow, q: { status?: string; project_id?: string; mine?: boolean; q?: string }): ImprovementListResponse {
  let items = ctx.store.find("improvements", { orderBy: [{ column: "updated_at", dir: "desc" }, { column: "number", dir: "desc" }] });
  const statuses = (q.status ?? "").split(",").filter((s): s is ImprovementStatus => (IMPROVEMENT_STATUSES as readonly string[]).includes(s));
  if (statuses.length) items = items.filter((i) => statuses.includes(i.status));
  if (q.project_id) items = items.filter((i) => i.project_id === q.project_id);
  if (q.mine) items = items.filter((i) => i.reporter_id === user.id || i.assignee_id === user.id);
  if (q.q) {
    const t = q.q.toLowerCase();
    items = items.filter((i) => `${i.key} ${i.title} ${i.body}`.toLowerCase().includes(t));
  }
  return { items, total: items.length };
}

function waitingOn(ctx: AppContext, imp: Improvement): string {
  const name = (id: string | null) => (id ? ctx.store.get("users", id)?.name ?? "someone" : "someone");
  switch (imp.status) {
    case "proposed":
      return `Project manager (${reviewers(ctx, imp.project_id).map((id) => name(id)).join(", ") || "none assigned"})`;
    case "approved":
    case "in_progress":
      return `Engineering (${name(imp.assignee_id)})`;
    default:
      return "Nobody";
  }
}

function permissions(user: UserRow, imp: Improvement) {
  const mine = imp.assignee_id === user.id || user.role === "admin";
  return {
    approve: imp.status === "proposed" && isManager(user),
    decline: imp.status === "proposed" && isManager(user),
    start: imp.status === "approved" && mine,
    done: (imp.status === "approved" || imp.status === "in_progress") && mine,
  };
}

export function getImprovement(ctx: AppContext, user: UserRow, imp: Improvement): ImprovementDetail {
  const events = ctx.store.find("events", { where: { entity_type: "improvement", entity_id: imp.id }, orderBy: [{ column: "created_at" }, { column: "id" }] });
  return { improvement: imp, events, can: permissions(user, imp), waiting_on: waitingOn(ctx, imp) };
}

// ---------------------------------------------------------------------------
// The flow
// ---------------------------------------------------------------------------

function change(ctx: AppContext, user: UserRow, imp: Improvement, patch: Partial<Improvement>, type: string, data: Record<string, unknown>): Improvement {
  const updated = ctx.store.update("improvements", imp.id, { ...patch, updated_at: nowIso(ctx) });
  recordEvent(ctx, { actorId: user.id, type, entityType: "improvement", entityId: imp.id, data: { key: imp.key, from: imp.status, to: updated.status, ...data } });
  return updated;
}

export function approveImprovement(ctx: AppContext, user: UserRow, imp: Improvement, input: { assignee_id?: string | null; note?: string | null }): Improvement {
  if (!isManager(user)) throw forbidden("Only a project manager can approve suggestions.");
  if (imp.status !== "proposed") throw conflict("This suggestion has already been decided.");
  const mod = imp.module_id ? ctx.store.get("modules", imp.module_id) : null;
  const assigneeId = input.assignee_id || mod?.owner_id || null;
  const assignee = assigneeId ? ctx.store.get("users", assigneeId) : null;
  if (!assignee || !assignee.active || !(assignee.role === "engineer" || assignee.role === "admin")) throw badRequest("Choose the engineer who will build it.");
  const note = cleanText(input.note, 2000);
  return ctx.store.transaction(() => {
    const now = nowIso(ctx);
    const updated = change(ctx, user, imp, { status: "approved", assignee_id: assignee.id, decided_by_id: user.id, decided_at: now, decision_note: note }, "improvement.approved", {
      assignee_id: assignee.id,
      note,
    });
    notify(ctx, [assignee.id], {
      type: "improvement.approved",
      category: "action",
      bugId: null,
      improvementId: imp.id,
      actorId: user.id,
      title: `${user.name} approved ${imp.key} and assigned it to you.`,
      body: imp.title,
    });
    notify(ctx, [imp.reporter_id], {
      type: "improvement.approved",
      category: "decision",
      bugId: null,
      improvementId: imp.id,
      actorId: user.id,
      title: `Your suggestion ${imp.key} was approved.`,
      body: note ?? `${assignee.name} will build it.`,
    });
    return updated;
  });
}

export function declineImprovement(ctx: AppContext, user: UserRow, imp: Improvement, input: { reason?: string }): Improvement {
  if (!isManager(user)) throw forbidden("Only a project manager can close suggestions.");
  if (imp.status !== "proposed") throw conflict("This suggestion has already been decided.");
  const reason = requireText(input.reason, "A short reason", 2000);
  return ctx.store.transaction(() => {
    const updated = change(ctx, user, imp, { status: "declined", decided_by_id: user.id, decided_at: nowIso(ctx), decision_note: reason }, "improvement.declined", { reason });
    notify(ctx, [imp.reporter_id], {
      type: "improvement.declined",
      category: "decision",
      bugId: null,
      improvementId: imp.id,
      actorId: user.id,
      title: `Your suggestion ${imp.key} was closed by ${user.name}.`,
      body: reason,
    });
    return updated;
  });
}

export function startImprovement(ctx: AppContext, user: UserRow, imp: Improvement): Improvement {
  if (!permissions(user, imp).start) throw forbidden("Only the assigned engineer can start this.");
  return change(ctx, user, imp, { status: "in_progress" }, "improvement.started", {});
}

export function completeImprovement(ctx: AppContext, user: UserRow, imp: Improvement, input: { note?: string | null }): Improvement {
  if (!permissions(user, imp).done) throw forbidden("Only the assigned engineer can mark this done.");
  const note = cleanText(input.note, 2000);
  return ctx.store.transaction(() => {
    const updated = change(ctx, user, imp, { status: "done", done_by_id: user.id, done_at: nowIso(ctx), done_note: note }, "improvement.done", { note });
    notify(ctx, [imp.reporter_id, imp.decided_by_id], {
      type: "improvement.done",
      category: "progress",
      bugId: null,
      improvementId: imp.id,
      actorId: user.id,
      title: `${user.name} finished ${imp.key}.`,
      body: note ?? imp.title,
    });
    return updated;
  });
}

/** What is waiting on this person: suggestions to review (managers) and to build (engineers). */
export function improvementActions(ctx: AppContext, user: UserRow): ImprovementActionItem[] {
  const out: ImprovementActionItem[] = [];
  if (isManager(user)) {
    for (const imp of ctx.store.find("improvements", { where: { status: "proposed" }, orderBy: [{ column: "created_at" }] })) {
      const project = ctx.store.get("projects", imp.project_id);
      const mineToReview = user.role === "admin" ? !project?.pm_id : project?.pm_id ? project.pm_id === user.id : true;
      if (mineToReview) out.push({ kind: "review_improvement", label: "Approve or close", since: imp.created_at, improvement: imp });
    }
  }
  for (const imp of ctx.store.find("improvements", { where: { assignee_id: user.id, status: { in: ["approved", "in_progress"] } }, orderBy: [{ column: "decided_at" }] })) {
    out.push({ kind: "build_improvement", label: imp.status === "approved" ? "Build it" : "Finish it", since: imp.decided_at ?? imp.created_at, improvement: imp });
  }
  return out;
}
