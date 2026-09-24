// Dashboard and analytics. Computed from bugs, regression rounds and the event log.

import type {
  ContributionsResponse,
  DashboardResponse,
  EngineeringPerson,
  EngineeringResponse,
  ModuleHealth,
  ModulesResponse,
  PersonStats,
} from "../../core/api";
import type { Bug, EventRecord, StatusKey } from "../../core/types";
import { QA_ROLES, STATUS_KEYS } from "../../core/types";
import { OPEN_STATUSES, STATUS_DEFS, hoursBetween, isOverdue } from "../../core/statuses";
import { canViewTeamAnalytics } from "../../core/permissions";
import { concepts, conceptLabel } from "../../core/text";
import type { AppContext } from "../context";
import { nowIso } from "../context";
import type { UserRow } from "../db/schema";
import type { Where } from "../db/store";
import { actorOf, listEnv, toListItem } from "./bugs";
import { severities, statusConfigs } from "./lookups";

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return Math.round((s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2) * 10) / 10;
}

function ratio(n: number, d: number): number | null {
  return d ? Math.round((n / d) * 1000) / 1000 : null;
}

/** Monday 00:00 UTC of the week containing the date. */
export function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function weeksBack(nowIsoStr: string, count: number): string[] {
  const start = new Date(`${weekStart(nowIsoStr)}T00:00:00.000Z`);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(new Date(start.getTime() - i * 7 * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

function scopedBugs(ctx: AppContext, projectId: string | null): Bug[] {
  const where: Where<Bug> = { archived_at: null };
  if (projectId) where.project_id = projectId;
  return ctx.store.find("bugs", { where });
}

function statusEvents(ctx: AppContext, since: string | null): EventRecord[] {
  return ctx.store.find("events", {
    where: since ? { type: "bug.status_changed", created_at: { gte: since } } : { type: "bug.status_changed" },
    orderBy: [{ column: "created_at" }, { column: "id" }],
  });
}

function resolvedAt(b: Bug): string | null {
  if (b.status === "closed" || b.status === "verified") return b.closed_at ?? b.verified_at;
  if (b.status === "not_a_bug" || b.status === "duplicate") return b.decision_at;
  return null;
}

export function dashboard(ctx: AppContext, user: UserRow, opts: { projectId: string | null; days: number }): DashboardResponse {
  const now = nowIso(ctx);
  const days = Math.min(Math.max(opts.days, 7), 365);
  const since = new Date(Date.parse(now) - days * 86_400_000).toISOString();
  const bugs = scopedBugs(ctx, opts.projectId);
  const ids = new Set(bugs.map((b) => b.id));
  const statuses = statusConfigs(ctx);
  const env = listEnv(ctx);

  const status_counts = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0])) as Record<StatusKey, number>;
  const overdue_counts: Partial<Record<StatusKey, number>> = {};
  for (const b of bugs) {
    status_counts[b.status]++;
    if (isOverdue(b, statuses, now)) overdue_counts[b.status] = (overdue_counts[b.status] ?? 0) + 1;
  }
  const open = bugs.filter((b) => OPEN_STATUSES.includes(b.status));

  const weeks = weeksBack(now, Math.min(Math.max(Math.ceil(days / 7), 4), 26));
  const weekly = weeks.map((w) => ({ week: w, reported: 0, resolved: 0 }));
  const weekIndex = new Map(weeks.map((w, i) => [w, i]));
  for (const b of bugs) {
    const ri = weekIndex.get(weekStart(b.created_at));
    if (ri !== undefined) weekly[ri].reported++;
    const r = resolvedAt(b);
    const ci = r ? weekIndex.get(weekStart(r)) : undefined;
    if (ci !== undefined) weekly[ci].resolved++;
  }

  const sevRank = new Map(severities(ctx).map((s) => [s.key, s.rank]));
  const moduleMap = new Map<string, { open: number; reopened: number; high_severity: number }>();
  for (const b of open) {
    const m = moduleMap.get(b.module_id) ?? { open: 0, reopened: 0, high_severity: 0 };
    m.open++;
    if (b.reopen_count > 0) m.reopened++;
    if ((sevRank.get(b.severity) ?? 9) <= 2) m.high_severity++;
    moduleMap.set(b.module_id, m);
  }
  const by_module = [...moduleMap.entries()].map(([module_id, v]) => ({ module_id, ...v })).sort((a, b) => b.open - a.open);

  const sevCounts = new Map<string, number>();
  for (const b of open) sevCounts.set(b.severity, (sevCounts.get(b.severity) ?? 0) + 1);
  const by_severity = severities(ctx).map((s) => ({ severity: s.key, open: sevCounts.get(s.key) ?? 0 }));

  // Time spent in each status, from status changes that started inside the period.
  const events = statusEvents(ctx, null).filter((e) => e.bug_id && ids.has(e.bug_id));
  const byBug = new Map<string, EventRecord[]>();
  for (const e of events) {
    const list = byBug.get(e.bug_id!) ?? [];
    list.push(e);
    byBug.set(e.bug_id!, list);
  }
  const spent = new Map<StatusKey, number[]>();
  for (const b of bugs) {
    const list = byBug.get(b.id) ?? [];
    const segments: { status: StatusKey; start: string; end: string }[] = [];
    let status: StatusKey = "new";
    let start = b.created_at;
    for (const e of list) {
      const to = (e.data as { to?: StatusKey }).to;
      if (!to) continue;
      segments.push({ status, start, end: e.created_at });
      status = to;
      start = e.created_at;
    }
    if (STATUS_DEFS[status].open) segments.push({ status, start, end: now });
    for (const s of segments) {
      if (s.start < since || !STATUS_DEFS[s.status].active) continue;
      const h = hoursBetween(s.start, s.end);
      if (h < 0.05) continue; // automatic hops (fixed → regression) are not waiting time
      const arr = spent.get(s.status) ?? [];
      arr.push(h);
      spent.set(s.status, arr);
    }
  }
  const time_in_status = [...spent.entries()]
    .map(([status, hours]) => ({ status, avg_hours: Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10, count: hours.length }))
    .sort((a, b) => STATUS_DEFS[a.status].defaults.sort_order - STATUS_DEFS[b.status].defaults.sort_order);

  const oldest_waiting = open
    .filter((b) => STATUS_DEFS[b.status].active)
    .map((b) => toListItem(b, env))
    .sort((a, b) => b.hours_in_status - a.hours_in_status)
    .slice(0, 6);

  const inPeriod = (iso: string | null) => !!iso && iso >= since;
  const firstResponse = bugs.filter((b) => inPeriod(b.created_at) && b.first_response_at).map((b) => hoursBetween(b.created_at, b.first_response_at!));
  const fixTimes = bugs.filter((b) => inPeriod(b.fixed_at)).map((b) => hoursBetween(b.created_at, b.fixed_at!));
  const closeTimes = bugs.filter((b) => b.status === "closed" && inPeriod(b.closed_at)).map((b) => hoursBetween(b.created_at, b.closed_at!));

  const fixedInPeriod = new Set(events.filter((e) => (e.data as { to?: string }).to === "fixed" && e.created_at >= since).map((e) => e.bug_id!));
  const reopenedOfFixed = bugs.filter((b) => fixedInPeriod.has(b.id) && b.reopen_count > 0).length;
  const reportedInPeriod = bugs.filter((b) => inPeriod(b.created_at));
  const triaged = reportedInPeriod.filter((b) => b.status !== "new");
  const notABug = triaged.filter((b) => b.status === "not_a_bug").length;
  const runs = ctx.store
    .find("regression_runs", { where: { completed_at: { gte: since }, result: { in: ["passed", "failed"] } } })
    .filter((r) => ids.has(r.bug_id));

  const result: DashboardResponse = {
    generated_at: now,
    scope: { project_id: opts.projectId, days },
    status_counts,
    overdue_counts,
    open_total: open.length,
    weekly,
    by_module,
    by_severity,
    time_in_status,
    oldest_waiting,
    metrics: {
      median_hours_to_first_response: median(firstResponse),
      median_hours_to_fix: median(fixTimes),
      median_hours_to_close: median(closeTimes),
      reopen_rate: ratio(reopenedOfFixed, fixedInPeriod.size),
      valid_report_rate: triaged.length ? ratio(triaged.length - notABug, triaged.length) : null,
      regression_pass_rate: ratio(runs.filter((r) => r.result === "passed").length, runs.length),
      reported_in_period: reportedInPeriod.length,
      closed_in_period: bugs.filter((b) => inPeriod(resolvedAt(b))).length,
    },
  };

  const countBy = (list: Bug[]) => {
    const m = new Map<StatusKey, number>();
    for (const b of list) m.set(b.status, (m.get(b.status) ?? 0) + 1);
    return [...m.entries()].map(([status, count]) => ({ status, count }));
  };
  result.my_reports = countBy(bugs.filter((b) => b.reporter_id === user.id));
  result.my_assigned = countBy(open.filter((b) => b.assignee_id === user.id || b.collaborator_ids.includes(user.id)));
  return result;
}

export function contributions(ctx: AppContext, user: UserRow, opts: { projectId: string | null; weeks: number }): ContributionsResponse {
  const now = nowIso(ctx);
  const team = canViewTeamAnalytics(actorOf(user));
  const weeks = weeksBack(now, Math.min(Math.max(opts.weeks, 4), 52));
  const since = `${weeks[0]}T00:00:00.000Z`;
  const bugs = scopedBugs(ctx, opts.projectId);
  const inWindow = bugs.filter((b) => b.created_at >= since);
  const users = ctx.store.find("users", { orderBy: [{ column: "name" }] });
  const reporters = new Set(inWindow.map((b) => b.reporter_id));
  const people = users.filter((u) => (team ? QA_ROLES.includes(u.role) || reporters.has(u.id) : u.id === user.id));

  const weekIndex = new Map(weeks.map((w, i) => [w, i]));
  const runs = ctx.store.find("regression_runs", { where: { completed_at: { gte: since } } });
  const ids = new Set(bugs.map((b) => b.id));
  const coReports = ctx.store.find("co_reporters").filter((c) => ids.has(c.bug_id) && c.created_at >= since);

  const series = people.map((p) => {
    const counts = weeks.map(() => 0);
    for (const b of inWindow) {
      if (b.reporter_id !== p.id) continue;
      const i = weekIndex.get(weekStart(b.created_at));
      if (i !== undefined) counts[i]++;
    }
    return { user_id: p.id, counts };
  });

  const stats: PersonStats[] = people.map((p) => {
    const mine = inWindow.filter((b) => b.reporter_id === p.id);
    const closed = mine.filter((b) => b.status === "closed" && b.closed_at);
    const resolutionHours = closed.map((b) => hoursBetween(b.created_at, b.closed_at!));
    const myRuns = runs.filter((r) => r.completed_by_id === p.id && ids.has(r.bug_id));
    return {
      user_id: p.id,
      reported: mine.length,
      fixed: mine.filter((b) => !!b.fixed_at).length,
      open: mine.filter((b) => OPEN_STATUSES.includes(b.status)).length,
      not_a_bug: mine.filter((b) => b.status === "not_a_bug").length,
      duplicate: mine.filter((b) => b.status === "duplicate").length,
      reopened: mine.filter((b) => b.reopen_count > 0).length,
      verified: myRuns.filter((r) => r.result === "passed").length,
      avg_hours_to_resolution: resolutionHours.length
        ? Math.round((resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length) * 10) / 10
        : null,
      co_reported: coReports.filter((c) => c.user_id === p.id).length,
      regressions_run: myRuns.filter((r) => r.result === "passed" || r.result === "failed").length,
    };
  });

  return { weeks, series, people: stats, scope: team ? "team" : "self" };
}

export function engineering(ctx: AppContext, user: UserRow, opts: { projectId: string | null; days: number }): EngineeringResponse {
  const now = nowIso(ctx);
  const since = new Date(Date.parse(now) - Math.min(Math.max(opts.days, 7), 365) * 86_400_000).toISOString();
  const team = canViewTeamAnalytics(actorOf(user));
  const bugs = scopedBugs(ctx, opts.projectId);
  const ids = new Set(bugs.map((b) => b.id));
  const engineers = ctx.store
    .find("users", { where: { role: "engineer" }, orderBy: [{ column: "name" }] })
    .filter((u) => team || u.id === user.id);
  const events = statusEvents(ctx, since).filter((e) => e.bug_id && ids.has(e.bug_id));
  const failed = ctx.store.find("events", { where: { type: "regression.failed", created_at: { gte: since } } }).filter((e) => ids.has(e.bug_id ?? ""));
  const bugById = new Map(bugs.map((b) => [b.id, b]));

  const people: EngineeringPerson[] = engineers.map((u) => {
    const assigned = bugs.filter((b) => OPEN_STATUSES.includes(b.status) && (b.assignee_id === u.id || b.collaborator_ids.includes(u.id)));
    const fixes = events.filter((e) => e.actor_id === u.id && (e.data as { to?: string }).to === "fixed");
    const fixHours = bugs
      .filter((b) => b.fixed_by_id === u.id && b.fixed_at && b.fixed_at >= since)
      .map((b) => hoursBetween(b.confirmed_at ?? b.created_at, b.fixed_at!));
    const responseHours = bugs
      .filter((b) => b.assignee_id === u.id && b.first_response_at && b.created_at >= since)
      .map((b) => hoursBetween(b.created_at, b.first_response_at!));
    return {
      user_id: u.id,
      assigned_open: assigned.filter((b) => b.status !== "deferred").length,
      in_progress: assigned.filter((b) => b.status === "in_progress").length,
      waiting_on_qa: assigned.filter((b) => b.status === "need_info" || b.status === "regression_required").length,
      fixed_in_period: fixes.length,
      reopened_after_fix: failed.filter((e) => bugById.get(e.bug_id!)?.fixed_by_id === u.id).length,
      median_hours_to_fix: median(fixHours),
      median_hours_to_first_response: median(responseHours),
    };
  });

  const runs = ctx.store
    .find("regression_runs", { where: { completed_at: { gte: since }, result: { in: ["passed", "failed"] } } })
    .filter((r) => ids.has(r.bug_id));
  return {
    people,
    unassigned_open: bugs.filter((b) => !b.assignee_id && ["new", "under_review"].includes(b.status)).length,
    regression_pass_rate: ratio(runs.filter((r) => r.result === "passed").length, runs.length),
    scope: team ? "team" : "self",
  };
}

export function moduleHealth(ctx: AppContext, opts: { projectId: string | null }): ModulesResponse {
  const bugs = scopedBugs(ctx, opts.projectId);
  const modules = ctx.store.find("modules", { where: opts.projectId ? { project_id: opts.projectId } : {} });
  const out: ModuleHealth[] = modules.map((m) => {
    const list = bugs.filter((b) => b.module_id === m.id || b.affected_module_ids.includes(m.id));
    const reachedFix = list.filter((b) => b.fixed_at || b.reopen_count > 0);
    const closeHours = list.filter((b) => b.status === "closed" && b.closed_at).map((b) => hoursBetween(b.created_at, b.closed_at!));
    const conceptCounts = new Map<string, number>();
    for (const b of list) {
      if (b.status === "not_a_bug") continue;
      for (const c of concepts(`${b.title} ${b.actual_result}`)) conceptCounts.set(c, (conceptCounts.get(c) ?? 0) + 1);
    }
    return {
      module_id: m.id,
      project_id: m.project_id,
      open: list.filter((b) => OPEN_STATUSES.includes(b.status)).length,
      total: list.length,
      reopened: list.filter((b) => b.reopen_count > 0).length,
      reopen_rate: ratio(list.filter((b) => b.reopen_count > 0).length, reachedFix.length),
      not_a_bug: list.filter((b) => b.status === "not_a_bug").length,
      median_hours_to_close: median(closeHours),
      recurring_concepts: [...conceptCounts.entries()]
        .filter(([, n]) => n >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c, count]) => ({ concept: conceptLabel(c), count })),
    };
  });
  out.sort((a, b) => b.open - a.open || b.total - a.total);
  return { modules: out };
}

export function releaseFacts(ctx: AppContext, projectId: string) {
  const now = nowIso(ctx);
  const statuses = statusConfigs(ctx);
  const bugs = scopedBugs(ctx, projectId).filter((b) => OPEN_STATUSES.includes(b.status) && b.status !== "deferred");
  const sevRank = new Map(severities(ctx).map((s) => [s.key, s.rank]));
  return {
    bugs,
    facts: {
      open: bugs.length,
      critical_open: bugs.filter((b) => (sevRank.get(b.severity) ?? 9) <= 1).length,
      reopened_open: bugs.filter((b) => b.reopen_count > 0).length,
      overdue: bugs.filter((b) => isOverdue(b, statuses, now)).length,
      unassigned: bugs.filter((b) => !b.assignee_id).length,
    },
  };
}
