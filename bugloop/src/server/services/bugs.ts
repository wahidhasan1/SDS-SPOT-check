// Bugs: create, edit, list, search, detail and similarity.

import type { BugDetail, BugLinkView, BugListResponse } from "../../core/api";
import type {
  AiMeta,
  Bug,
  BugListItem,
  BugRef,
  DuplicateCheck,
  Frequency,
  PublicSettings,
  RegressionRun,
  SimilarBug,
  StatusConfig,
  StatusKey,
} from "../../core/types";
import { FREQUENCIES, STATUS_KEYS } from "../../core/types";
import {
  canAlsoSee,
  canAssign,
  canBeAssignee,
  canComment,
  canReassignRegression,
  editableFields,
  priorityChangeRule,
  REPORT_FIELDS,
  severityChangeRule,
  type Actor,
  type ReportField,
} from "../../core/permissions";
import { ENGINEERING_STATUSES, OPEN_STATUSES, hoursBetween, isOpen, isOverdue, waitingOn } from "../../core/statuses";
import { ACTION_PRIORITY, actionHints, availableActions, type WorkflowContext } from "../../core/workflow";
import { SimilarityIndex, type SimilarityInput } from "../../core/similarity";
import type { BugViewKey, SortKey } from "../../core/views";
import type { AppContext } from "../context";
import { nowIso } from "../context";
import type { UserRow } from "../db/schema";
import type { Where } from "../db/store";
import { insertAttachments, toAttachment, withStoredFiles, type IncomingFile } from "./attachments";
import { addWatchers, notify, recordEvent } from "./events";
import {
  formatBugKey,
  getSettings,
  levelLabel,
  priorities,
  requireActiveLevel,
  severities,
  statusConfigs,
  statusEnabledFn,
} from "./lookups";
import { badRequest, cleanText, forbidden, newId, notFound, requireText, uniq } from "./util";

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export function resolveBug(ctx: AppContext, ref: string): Bug {
  const trimmed = ref.trim();
  let bug = ctx.store.get("bugs", trimmed);
  if (!bug) {
    const m = /^(?:[a-z]+-)?#?0*(\d+)$/i.exec(trimmed);
    if (m) bug = ctx.store.findOne("bugs", { number: Number(m[1]) });
  }
  if (!bug) bug = ctx.store.findOne("bugs", { key: trimmed.toUpperCase() });
  if (!bug) throw notFound(`Bug ${ref} was not found.`);
  return bug;
}

export function bugRef(b: Bug): BugRef {
  return {
    id: b.id,
    key: b.key,
    title: b.title,
    status: b.status,
    project_id: b.project_id,
    module_id: b.module_id,
    archived: !!b.archived_at,
  };
}

export function pendingRun(ctx: AppContext, bugId: string): RegressionRun | undefined {
  return ctx.store.findOne("regression_runs", { bug_id: bugId, result: "pending" }, [{ column: "round", dir: "desc" }]);
}

export function lastRun(ctx: AppContext, bugId: string): RegressionRun | undefined {
  return ctx.store.findOne("regression_runs", { bug_id: bugId }, [{ column: "round", dir: "desc" }]);
}

export function actorOf(user: UserRow): Actor {
  return { id: user.id, role: user.role, active: user.active };
}

export function workflowContext(ctx: AppContext, user: UserRow, bug: Bug, settings = getSettings(ctx)): WorkflowContext {
  const run = pendingRun(ctx, bug.id);
  return {
    actor: actorOf(user),
    bug,
    regression: run ? { assignee_id: run.assignee_id, started_at: run.started_at } : null,
    lastRegressionAssigneeId: lastRun(ctx, bug.id)?.assignee_id ?? null,
    autoCloseOnVerify: settings.auto_close_on_verify,
    isStatusEnabled: statusEnabledFn(ctx),
  };
}

// ---------------------------------------------------------------------------
// List items
// ---------------------------------------------------------------------------

export interface ListEnv {
  now: string;
  statuses: StatusConfig[];
  settings: PublicSettings;
  pendingAssignee: Map<string, string | null>;
}

export function listEnv(ctx: AppContext): ListEnv {
  const pendingAssignee = new Map<string, string | null>();
  for (const run of ctx.store.find("regression_runs", { where: { result: "pending" } })) {
    pendingAssignee.set(run.bug_id, run.assignee_id);
  }
  return { now: nowIso(ctx), statuses: statusConfigs(ctx), settings: getSettings(ctx), pendingAssignee };
}

export function toListItem(bug: Bug, env: ListEnv): BugListItem {
  const regressionAssignee = env.pendingAssignee.get(bug.id) ?? null;
  return {
    id: bug.id,
    key: bug.key,
    number: bug.number,
    title: bug.title,
    status: bug.status,
    severity: bug.severity,
    priority: bug.priority,
    project_id: bug.project_id,
    module_id: bug.module_id,
    feature_id: bug.feature_id,
    affected_module_ids: bug.affected_module_ids,
    environment_id: bug.environment_id,
    reporter_id: bug.reporter_id,
    assignee_id: bug.assignee_id,
    tags: bug.tags,
    reopen_count: bug.reopen_count,
    disputed: bug.disputed,
    potential_duplicate_ids: bug.potential_duplicate_ids,
    duplicate_of_id: bug.duplicate_of_id,
    ai_assisted: bug.ai_assisted,
    created_at: bug.created_at,
    updated_at: bug.updated_at,
    status_changed_at: bug.status_changed_at,
    last_activity_at: bug.last_activity_at,
    closed_at: bug.closed_at,
    archived_at: bug.archived_at,
    decision_acknowledged_at: bug.decision_acknowledged_at,
    waiting_on: waitingOn(bug, { regressionAssigneeId: regressionAssignee, autoCloseOnVerify: env.settings.auto_close_on_verify }),
    overdue: isOverdue(bug, env.statuses, env.now),
    hours_in_status: Math.max(0, Math.round(hoursBetween(bug.status_changed_at, env.now))),
    regression_assignee_id: regressionAssignee,
  };
}

// ---------------------------------------------------------------------------
// Listing and search
// ---------------------------------------------------------------------------

export interface BugQuery {
  view?: BugViewKey;
  q?: string;
  project_id?: string;
  module_id?: string;
  feature_id?: string;
  status?: StatusKey[];
  severity?: string[];
  priority?: string[];
  reporter_id?: string;
  assignee_id?: string;
  tag?: string;
  from?: string;
  to?: string;
  sort?: SortKey;
  dir?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

const VIEW_STATUSES: Partial<Record<BugViewKey, StatusKey[]>> = {
  open: OPEN_STATUSES.filter((s) => s !== "deferred"),
  assigned: OPEN_STATUSES.filter((s) => s !== "deferred"),
  my_regression: ["regression_required"],
  waiting_engineering: ENGINEERING_STATUSES,
  waiting_qa: ["need_info", "regression_required"],
  potential_duplicates: ["new", "under_review"],
  unassigned: ["new", "under_review"],
  deferred: ["deferred"],
  resolved: ["closed", "verified", "not_a_bug", "duplicate"],
  overdue: OPEN_STATUSES,
};

function textSearchWhere(ctx: AppContext, q: string): Where<Bug> | null {
  const term = q.trim();
  if (!term) return null;
  const num = /^(?:[a-z]+-)?#?0*(\d+)$/i.exec(term);
  const or: Where<Bug>[] = [
    { title: { like: term } },
    { key: { like: term } },
    { description: { like: term } },
    { actual_result: { like: term } },
    { tags: { contains: term.toLowerCase() } },
  ];
  if (num) or.push({ number: Number(num[1]) });
  const users = ctx.store.find("users", { where: { name: { like: term } } }).map((u) => u.id);
  if (users.length) {
    or.push({ reporter_id: { in: users } });
    or.push({ assignee_id: { in: users } });
  }
  const modules = ctx.store.find("modules", { where: { name: { like: term } } }).map((m) => m.id);
  if (modules.length) or.push({ module_id: { in: modules } });
  return { $or: or };
}

export function listBugs(ctx: AppContext, user: UserRow, query: BugQuery): BugListResponse {
  const env = listEnv(ctx);
  const view: BugViewKey = query.view ?? "open";
  const where: Where<Bug> = {};
  const and: Where<Bug>[] = [];

  if (view === "archived") {
    if (!(user.role === "qa_lead" || user.role === "admin")) throw forbidden("Only QA leads and admins can see archived bugs.");
    where.archived_at = { isNull: false };
  } else {
    where.archived_at = null;
  }
  if (query.project_id) where.project_id = query.project_id;
  if (query.module_id) and.push({ $or: [{ module_id: query.module_id }, { affected_module_ids: { contains: query.module_id } }] });
  if (query.feature_id) where.feature_id = query.feature_id;

  const viewStatuses = VIEW_STATUSES[view];
  const requested = query.status?.filter((s) => (STATUS_KEYS as readonly string[]).includes(s));
  const statuses = requested?.length ? (viewStatuses ? requested.filter((s) => viewStatuses.includes(s)) : requested) : viewStatuses;
  if (statuses) where.status = { in: statuses };

  if (query.severity?.length) where.severity = { in: query.severity };
  if (query.priority?.length) where.priority = { in: query.priority };
  if (query.reporter_id) where.reporter_id = query.reporter_id;
  if (query.assignee_id) where.assignee_id = query.assignee_id === "none" ? null : query.assignee_id;
  if (query.tag) and.push({ tags: { contains: query.tag.toLowerCase() } });
  if (query.from || query.to) {
    where.created_at = { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: `${query.to.slice(0, 10)}T23:59:59.999Z` } : {}) };
  }
  if (view === "unassigned") where.assignee_id = null;
  if (view === "disputed") where.disputed = true;
  if (query.q) {
    const text = textSearchWhere(ctx, query.q);
    if (text) and.push(text);
  }
  if (and.length) where.$and = and;

  let bugs = ctx.store.find("bugs", { where });

  // View filters that need related data.
  if (view === "mine") {
    const co = new Set(ctx.store.find("co_reporters", { where: { user_id: user.id } }).map((c) => c.bug_id));
    bugs = bugs.filter((b) => b.reporter_id === user.id || co.has(b.id));
  } else if (view === "assigned") {
    bugs = bugs.filter((b) => b.assignee_id === user.id || b.collaborator_ids.includes(user.id));
  } else if (view === "my_regression") {
    bugs = bugs.filter((b) => env.pendingAssignee.get(b.id) === user.id);
  } else if (view === "potential_duplicates") {
    bugs = bugs.filter((b) => b.potential_duplicate_ids.length > 0);
  } else if (view === "reopened") {
    const since = new Date(Date.parse(env.now) - 30 * 86_400_000).toISOString();
    const reopened = new Set(
      ctx.store
        .find("events", { where: { type: { in: ["regression.failed", "bug.reopened"] }, created_at: { gte: since } } })
        .map((e) => e.bug_id),
    );
    bugs = bugs.filter((b) => reopened.has(b.id) && isOpen(b.status));
  }

  let items = bugs.map((b) => toListItem(b, env));
  if (view === "overdue") items = items.filter((i) => i.overdue);

  sortItems(ctx, items, query.sort ?? "updated", query.dir);

  const pageSize = Math.min(Math.max(query.page_size ?? 50, 1), 200);
  const page = Math.max(query.page ?? 1, 1);
  const total = items.length;
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, page_size: pageSize };
}

function sortItems(ctx: AppContext, items: BugListItem[], sort: SortKey, dir?: "asc" | "desc"): void {
  const sevRank = new Map(severities(ctx).map((l) => [l.key, l.rank]));
  const priRank = new Map(priorities(ctx).map((l) => [l.key, l.rank]));
  const byActivity = (a: BugListItem, b: BugListItem) => (a.last_activity_at < b.last_activity_at ? 1 : a.last_activity_at > b.last_activity_at ? -1 : 0);
  let cmp: (a: BugListItem, b: BugListItem) => number;
  switch (sort) {
    case "created":
      cmp = (a, b) => b.number - a.number;
      break;
    case "severity":
      cmp = (a, b) => (sevRank.get(a.severity) ?? 99) - (sevRank.get(b.severity) ?? 99) || byActivity(a, b);
      break;
    case "priority":
      cmp = (a, b) => (priRank.get(a.priority) ?? 99) - (priRank.get(b.priority) ?? 99) || byActivity(a, b);
      break;
    case "waiting":
      cmp = (a, b) => b.hours_in_status - a.hours_in_status;
      break;
    case "key":
      cmp = (a, b) => b.number - a.number;
      break;
    default:
      cmp = byActivity;
  }
  items.sort(cmp);
  if (dir === "asc" && (sort === "updated" || sort === "created" || sort === "key" || sort === "waiting")) items.reverse();
  if (dir === "desc" && (sort === "severity" || sort === "priority")) items.reverse();
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export function getBugDetail(ctx: AppContext, user: UserRow, bug: Bug): BugDetail {
  const settings = getSettings(ctx);
  const env = listEnv(ctx);
  const item = toListItem(bug, env);
  const wctx = workflowContext(ctx, user, bug, settings);
  const actions = availableActions(wctx).sort((a, b) => ACTION_PRIORITY.indexOf(a) - ACTION_PRIORITY.indexOf(b));
  const actor = actorOf(user);

  const coReporters = ctx.store.find("co_reporters", { where: { bug_id: bug.id }, orderBy: [{ column: "created_at" }] });
  const watchers = ctx.store.find("watchers", { where: { bug_id: bug.id } }).map((w) => w.user_id);

  const outgoing = ctx.store.find("bug_links", { where: { bug_id: bug.id } });
  const incoming = ctx.store.find("bug_links", { where: { target_bug_id: bug.id } });
  const links: BugLinkView[] = [];
  for (const l of outgoing) {
    const t = ctx.store.get("bugs", l.target_bug_id);
    if (t) links.push({ id: l.id, kind: l.kind, direction: "outgoing", bug: bugRef(t) });
  }
  for (const l of incoming) {
    const t = ctx.store.get("bugs", l.bug_id);
    if (t && l.kind === "related") links.push({ id: l.id, kind: l.kind, direction: "incoming", bug: bugRef(t) });
  }

  const events = ctx.store.find("events", { where: { bug_id: bug.id }, orderBy: [{ column: "created_at" }, { column: "id" }] });
  const refIds = new Set<string>();
  for (const e of events) {
    for (const [k, v] of Object.entries(e.data)) {
      if (typeof v === "string" && (k.endsWith("bug_id") || k === "duplicate_of_id" || k === "duplicate_id")) refIds.add(v);
    }
  }
  if (bug.dispute_context?.duplicate_of_id) refIds.add(bug.dispute_context.duplicate_of_id);
  refIds.delete(bug.id);
  const referenced = [...refIds].map((id) => ctx.store.get("bugs", id)).filter((b): b is Bug => !!b).map(bugRef);

  const duplicateOf = bug.duplicate_of_id ? ctx.store.get("bugs", bug.duplicate_of_id) : undefined;

  return {
    bug,
    waiting_on: item.waiting_on,
    overdue: item.overdue,
    hours_in_status: item.hours_in_status,
    actions,
    hints: actionHints(wctx),
    permissions: {
      editable_fields: editableFields(actor, bug),
      severity: severityChangeRule(actor, bug),
      priority: priorityChangeRule(actor, bug),
      can_assign: canAssign(actor) && !bug.archived_at,
      can_reassign_regression: canReassignRegression(actor) && bug.status === "regression_required" && !bug.archived_at,
      can_comment: canComment(actor, bug),
      can_also_see: canAlsoSee(actor, bug, coReporters.some((c) => c.user_id === user.id)),
      can_link: canComment(actor, bug),
    },
    comments: ctx.store.find("comments", { where: { bug_id: bug.id }, orderBy: [{ column: "created_at" }, { column: "id" }] }),
    attachments: ctx.store
      .find("attachments", { where: { bug_id: bug.id }, orderBy: [{ column: "created_at" }, { column: "id" }] })
      .map(toAttachment),
    events,
    regression_runs: ctx.store.find("regression_runs", { where: { bug_id: bug.id }, orderBy: [{ column: "round" }] }),
    links,
    duplicate_of: duplicateOf ? bugRef(duplicateOf) : null,
    duplicates: ctx.store.find("bugs", { where: { duplicate_of_id: bug.id }, orderBy: [{ column: "number" }] }).map(bugRef),
    potential_duplicates: bug.potential_duplicate_ids
      .map((id) => ctx.store.get("bugs", id))
      .filter((b): b is Bug => !!b)
      .map(bugRef),
    co_reporters: coReporters,
    watchers,
    is_watching: watchers.includes(user.id),
    referenced_bugs: referenced,
  };
}

// ---------------------------------------------------------------------------
// Similarity
// ---------------------------------------------------------------------------

function toSimilarityInput(b: Bug): SimilarityInput & { id: string } {
  return {
    id: b.id,
    title: b.title,
    description: b.description,
    actual_result: b.actual_result,
    expected_result: b.expected_result,
    steps: b.steps,
    module_id: b.module_id,
    feature_id: b.feature_id,
    affected_module_ids: b.affected_module_ids,
  };
}

export interface SimilarQuery extends SimilarityInput {
  project_id?: string | null;
}

export function findSimilar(
  ctx: AppContext,
  query: SimilarQuery,
  opts: { excludeIds?: string[]; limit?: number; openOnly?: boolean } = {},
): SimilarBug[] {
  const where: Where<Bug> = { archived_at: null };
  if (query.project_id) where.project_id = query.project_id;
  if (opts.openOnly) where.status = { in: OPEN_STATUSES };
  const bugs = ctx.store.find("bugs", { where });
  const byId = new Map(bugs.map((b) => [b.id, b]));
  const index = new SimilarityIndex(bugs.map(toSimilarityInput));
  const matches = index.query(query, { limit: (opts.limit ?? 5) * 3, excludeIds: opts.excludeIds });

  const out: SimilarBug[] = [];
  const seen = new Set<string>(opts.excludeIds ?? []);
  for (const m of matches) {
    let target = byId.get(m.id);
    // Point duplicates at the bug they duplicate.
    let hops = 0;
    while (target?.status === "duplicate" && target.duplicate_of_id && hops++ < 10) {
      target = byId.get(target.duplicate_of_id) ?? ctx.store.get("bugs", target.duplicate_of_id);
    }
    if (!target || seen.has(target.id) || target.archived_at) continue;
    seen.add(target.id);
    out.push({
      bug: { ...bugRef(target), severity: target.severity, reporter_id: target.reporter_id, created_at: target.created_at, closed_at: target.closed_at },
      score: m.score,
      level: m.level,
      shared_terms: m.sharedTerms,
      same_module: m.sameModule,
      same_feature: m.sameFeature,
      closed: !isOpen(target.status),
    });
    if (out.length >= (opts.limit ?? 5)) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreateBugInput {
  project_id: string;
  module_id: string;
  feature_id?: string | null;
  affected_module_ids?: string[];
  title: string;
  description?: string | null;
  steps: string[];
  expected_result: string;
  actual_result: string;
  environment_id?: string | null;
  browser?: string | null;
  device?: string | null;
  os?: string | null;
  app_version?: string | null;
  page_url?: string | null;
  frequency?: Frequency;
  severity: string;
  priority?: string | null;
  tags?: string[];
  notes?: string | null;
  ai_meta?: AiMeta | null;
  duplicate_check?: DuplicateCheck | null;
}

function cleanSteps(steps: unknown): string[] {
  if (!Array.isArray(steps)) return [];
  return steps
    .map((s) => cleanText(s, 1000))
    .filter((s): s is string => !!s)
    .map((s) => s.replace(/^\s*\d+[.)]\s*/, ""))
    .slice(0, 40);
}

function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return uniq(
    tags
      .map((t) => String(t).trim().toLowerCase().replace(/\s+/g, "-"))
      .filter((t) => /^[\p{L}\p{N}][\p{L}\p{N}\-_.]{0,39}$/u.test(t)),
  ).slice(0, 12);
}

function validateLocation(ctx: AppContext, projectId: string, moduleId: string, featureId: string | null | undefined, affected: string[] = []) {
  const project = ctx.store.get("projects", projectId);
  if (!project || project.archived) throw badRequest("Choose an active project.");
  const mod = ctx.store.get("modules", moduleId);
  if (!mod || mod.project_id !== project.id || mod.archived) throw badRequest("Choose a module from the selected project.");
  if (featureId) {
    const f = ctx.store.get("features", featureId);
    if (!f || f.module_id !== mod.id || f.archived) throw badRequest("Choose a feature from the selected module.");
  }
  const affectedIds = uniq(affected.filter((id) => id && id !== mod.id));
  for (const id of affectedIds) {
    const m = ctx.store.get("modules", id);
    if (!m || m.project_id !== project.id) throw badRequest("Also-affected modules must belong to the same project.");
  }
  return { project, mod, affectedIds };
}

function validateEnvironment(ctx: AppContext, id: string | null | undefined): string | null {
  if (!id) return null;
  const env = ctx.store.get("environments", id);
  if (!env) throw badRequest("Unknown environment.");
  return env.id;
}

function validateFrequency(f: unknown): Frequency {
  if (f === undefined || f === null || f === "") return "unknown";
  if (!(FREQUENCIES as readonly string[]).includes(String(f))) throw badRequest("Unknown frequency.");
  return f as Frequency;
}

export async function createBug(ctx: AppContext, user: UserRow, input: CreateBugInput, files: IncomingFile[] = []): Promise<Bug> {
  if (!user.active) throw forbidden();
  const { project, mod, affectedIds } = validateLocation(ctx, input.project_id, input.module_id, input.feature_id, input.affected_module_ids);
  const title = requireText(input.title, "Title", 200);
  const steps = cleanSteps(input.steps);
  if (!steps.length) throw badRequest("Add at least one step to reproduce.");
  const expected = requireText(input.expected_result, "Expected result");
  const actual = requireText(input.actual_result, "Actual result");
  const severity = requireActiveLevel(severities(ctx), input.severity, "severity");
  const priority = requireActiveLevel(priorities(ctx), input.priority || "medium", "priority");
  const environmentId = validateEnvironment(ctx, input.environment_id);
  const frequency = validateFrequency(input.frequency);
  const settings = getSettings(ctx);

  const owner = mod.owner_id ? ctx.store.get("users", mod.owner_id) : undefined;
  const assigneeId = owner && owner.active && canBeAssignee(owner.role) && owner.id !== user.id ? owner.id : null;

  // Close matches among open bugs are flagged for triage (never auto-resolved).
  const similar = findSimilar(
    ctx,
    { project_id: project.id, title, description: input.description, actual_result: actual, steps, module_id: mod.id, feature_id: input.feature_id },
    { openOnly: true, limit: 3 },
  ).filter((s) => s.level === "high" && !s.closed);

  return withStoredFiles(ctx, files, (stored) => {
    const now = nowIso(ctx);
    const number = ctx.store.nextSequence("bug_number", 1);
    const bug: Bug = {
      id: newId("bug"),
      number,
      key: formatBugKey(settings.bug_prefix, number),
      project_id: project.id,
      module_id: mod.id,
      feature_id: input.feature_id || null,
      affected_module_ids: affectedIds,
      title,
      description: cleanText(input.description) ?? "",
      steps,
      expected_result: expected,
      actual_result: actual,
      environment_id: environmentId,
      browser: cleanText(input.browser, 200),
      device: cleanText(input.device, 200),
      os: cleanText(input.os, 200),
      app_version: cleanText(input.app_version, 100),
      page_url: cleanText(input.page_url, 1000),
      frequency,
      severity,
      priority,
      tags: cleanTags(input.tags),
      notes: cleanText(input.notes),
      status: "new",
      status_changed_at: now,
      info_return_status: null,
      info_requested_from_id: null,
      info_requested_by_id: null,
      reporter_id: user.id,
      assignee_id: assigneeId,
      collaborator_ids: [],
      reviewed_by_id: null,
      reviewed_at: null,
      confirmed_by_id: null,
      confirmed_at: null,
      first_response_at: null,
      fixed_by_id: null,
      fixed_at: null,
      fix_version: null,
      resolution_summary: null,
      root_cause: null,
      resolution_reason: null,
      rejection_category: null,
      duplicate_of_id: null,
      deferred_until: null,
      deferred_target: null,
      decision_by_id: null,
      decision_at: null,
      decision_acknowledged_at: null,
      disputed: false,
      dispute_context: null,
      dispute_locked: false,
      verified_by_id: null,
      verified_at: null,
      closed_by_id: null,
      closed_at: null,
      close_reason: null,
      reopen_count: 0,
      regression_round: 0,
      ai_assisted: !!input.ai_meta,
      ai_meta: input.ai_meta ?? null,
      duplicate_check: input.duplicate_check ?? null,
      potential_duplicate_ids: similar.map((s) => s.bug.id),
      archived_at: null,
      archived_by_id: null,
      archive_reason: null,
      created_at: now,
      updated_at: now,
      last_activity_at: now,
    };
    ctx.store.insert("bugs", bug);
    const attachments = insertAttachments(ctx, stored, { bugId: bug.id, uploaderId: user.id, context: "report" });

    recordEvent(ctx, {
      bugId: bug.id,
      actorId: user.id,
      type: "bug.created",
      data: {
        title,
        severity,
        priority,
        ai_assisted: bug.ai_assisted,
        attachment_ids: attachments.map((a) => a.id),
        duplicate_check: bug.duplicate_check?.decision ?? null,
      },
    });
    if (similar.length) {
      recordEvent(ctx, {
        bugId: bug.id,
        actorId: null,
        type: "bug.potential_duplicate",
        data: { matches: similar.map((s) => ({ bug_id: s.bug.id, key: s.bug.key, score: s.score })) },
      });
    }
    addWatchers(ctx, bug.id, [user.id, assigneeId]);
    if (assigneeId) {
      recordEvent(ctx, { bugId: bug.id, actorId: null, type: "bug.assigned", data: { from: null, to: assigneeId, automatic: true, reason: `Default owner of ${mod.name}` } });
      notify(ctx, [assigneeId], {
        type: "bug_assigned",
        category: "action",
        bugId: bug.id,
        actorId: user.id,
        title: `New bug ${bug.key} has been assigned to you.`,
        body: bug.title,
      });
    }
    return bug;
  });
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

export interface UpdateBugInput {
  fields?: Partial<Record<ReportField, unknown>>;
  severity?: string;
  priority?: string;
  reason?: string | null;
}

const TEXT_FIELDS: ReportField[] = ["title", "description", "steps", "expected_result", "actual_result"];

export function updateBug(ctx: AppContext, user: UserRow, bug: Bug, input: UpdateBugInput): Bug {
  const actor = actorOf(user);
  const allowed = new Set(editableFields(actor, bug));
  const patch: Partial<Bug> = {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const fields = input.fields ?? {};

  for (const [key, raw] of Object.entries(fields) as [ReportField, unknown][]) {
    if (!(REPORT_FIELDS as readonly string[]).includes(key)) throw badRequest(`Unknown field ${key}.`);
    if (!allowed.has(key)) throw forbidden(`You can't change ${key.replace(/_/g, " ")} on this bug.`);
    let value: unknown;
    switch (key) {
      case "title":
        value = requireText(raw, "Title", 200);
        break;
      case "expected_result":
      case "actual_result":
        value = requireText(raw, key === "expected_result" ? "Expected result" : "Actual result");
        break;
      case "description":
        value = cleanText(raw) ?? "";
        break;
      case "steps":
        value = cleanSteps(raw);
        if (!(value as string[]).length) throw badRequest("Add at least one step to reproduce.");
        break;
      case "tags":
        value = cleanTags(raw);
        break;
      case "frequency":
        value = validateFrequency(raw);
        break;
      case "environment_id":
        value = validateEnvironment(ctx, raw as string | null);
        break;
      case "project_id":
      case "module_id":
      case "feature_id":
      case "affected_module_ids":
        value = raw === "" ? null : raw;
        break;
      default:
        value = cleanText(raw, key === "notes" ? 20000 : 1000);
    }
    if (JSON.stringify(value) !== JSON.stringify((bug as unknown as Record<string, unknown>)[key])) {
      (patch as Record<string, unknown>)[key] = value;
      changes[key] = { from: (bug as unknown as Record<string, unknown>)[key], to: value };
    }
  }

  if ("project_id" in patch || "module_id" in patch || "feature_id" in patch || "affected_module_ids" in patch) {
    const projectId = (patch.project_id as string | undefined) ?? bug.project_id;
    const moduleId = (patch.module_id as string | undefined) ?? bug.module_id;
    if (projectId !== bug.project_id && !("module_id" in patch)) throw badRequest("Choose a module in the new project.");
    const featureId = "feature_id" in patch ? (patch.feature_id as string | null) : moduleId === bug.module_id ? bug.feature_id : null;
    const affected = "affected_module_ids" in patch ? ((patch.affected_module_ids as string[] | null) ?? []) : bug.affected_module_ids;
    const v = validateLocation(ctx, projectId, moduleId, featureId, affected);
    patch.feature_id = featureId;
    patch.affected_module_ids = v.affectedIds;
  }

  const reason = cleanText(input.reason, 2000);
  const sev = severities(ctx);
  const pri = priorities(ctx);
  let severityChange: { from: string; to: string } | null = null;
  let priorityChange: { from: string; to: string } | null = null;
  if (input.severity && input.severity !== bug.severity) {
    const rule = severityChangeRule(actor, bug);
    if (!rule.allowed) throw forbidden("You can't change the severity of this bug.");
    if (rule.reasonRequired && !reason) throw badRequest("Give a reason for changing the severity.");
    patch.severity = requireActiveLevel(sev, input.severity, "severity");
    severityChange = { from: bug.severity, to: patch.severity };
  }
  if (input.priority && input.priority !== bug.priority) {
    const rule = priorityChangeRule(actor, bug);
    if (!rule.allowed) throw forbidden("You can't change the priority of this bug.");
    if (rule.reasonRequired && !reason) throw badRequest("Give a reason for changing the priority.");
    patch.priority = requireActiveLevel(pri, input.priority, "priority");
    priorityChange = { from: bug.priority, to: patch.priority };
  }

  if (!Object.keys(patch).length) return bug;

  return ctx.store.transaction(() => {
    const now = nowIso(ctx);
    if (bug.ai_meta && Object.keys(changes).length) {
      const drafted = new Set(bug.ai_meta.drafted_fields);
      const edited = uniq([...bug.ai_meta.edited_fields, ...Object.keys(changes).filter((k) => drafted.has(k))]);
      patch.ai_meta = { ...bug.ai_meta, edited_fields: edited };
    }
    const updated = ctx.store.update("bugs", bug.id, { ...patch, updated_at: now, last_activity_at: now });
    if (Object.keys(changes).length) {
      recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.updated", data: { changes } });
      const textChanged = Object.keys(changes).some((k) => TEXT_FIELDS.includes(k as ReportField));
      if (textChanged && bug.status !== "new") {
        notify(ctx, [bug.assignee_id], {
          type: "report_updated",
          category: "progress",
          bugId: bug.id,
          actorId: user.id,
          title: `${user.name} updated the report for ${bug.key}.`,
          body: `Changed: ${Object.keys(changes).map((k) => k.replace(/_/g, " ")).join(", ")}`,
        });
      }
    }
    if (severityChange) {
      recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.severity_changed", data: { ...severityChange, reason } });
      if (user.id !== bug.reporter_id) {
        notify(ctx, [bug.reporter_id], {
          type: "severity_changed",
          category: "decision",
          bugId: bug.id,
          actorId: user.id,
          title: `Severity of ${bug.key} changed from ${levelLabel(sev, severityChange.from)} to ${levelLabel(sev, severityChange.to)}.`,
          body: reason,
        });
      }
    }
    if (priorityChange) {
      recordEvent(ctx, { bugId: bug.id, actorId: user.id, type: "bug.priority_changed", data: { ...priorityChange, reason } });
      notify(ctx, [bug.assignee_id], {
        type: "priority_changed",
        category: "progress",
        bugId: bug.id,
        actorId: user.id,
        title: `Priority of ${bug.key} changed to ${levelLabel(pri, priorityChange.to)}.`,
        body: reason,
      });
    }
    return updated;
  });
}
