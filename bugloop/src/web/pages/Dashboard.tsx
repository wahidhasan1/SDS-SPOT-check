import { useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Bot, CircleAlert, Clock, Inbox, ShieldAlert, Sparkles } from "lucide-react";
import type { ActionItem, ReleaseRiskResult } from "../../core/api";
import { STATUS_GROUPS } from "../../core/statuses";
import type { StatusKey } from "../../core/types";
import { useWorkspace } from "../app/context";
import { errorMessage, useActionItems, useDashboard, useMutate } from "../api/hooks";
import { BugTable } from "../components/BugTable";
import { BarList, ChartOrTable, Legend, LineChart, StatTile } from "../components/charts";
import { ProjectSelect } from "../components/filters";
import { Loading, Segmented, cx } from "../components/ui";
import { duration, greeting, percent, plural, relativeTime, shortDate } from "../lib/format";

const PERIODS = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
] as const;

function weekLabel(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function DashboardPage() {
  const { ws, lookup } = useWorkspace();
  const navigate = useNavigate();
  const [project, setProject] = useState("");
  const [days, setDays] = useState<"30" | "90" | "180">("90");
  const dash = useDashboard({ project: project || undefined, days: Number(days) });
  const d = dash.data;
  const me = ws.me;
  const lead = ws.capabilities.view_team_analytics;

  const statusLink = (s: StatusKey) => `/bugs?view=all&status=${s}${project ? `&project=${project}` : ""}`;

  return (
    <div className="stack-lg dashboard">
      <div className="page-head">
        <div>
          <h1>
            {greeting()}, {me.name.split(" ")[0]}
          </h1>
          <p className="sub">{d ? `${plural(d.open_total, "open bug")}${project ? ` in ${lookup.project(project)?.name}` : " across all projects"} · updated ${relativeTime(d.generated_at)}` : "Loading the workspace…"}</p>
        </div>
        <div className="row-wrap">
          <ProjectSelect value={project} onChange={setProject} />
          <Segmented label="Period" value={days} onChange={setDays} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
        </div>
      </div>

      <MyQueue />

      {!d ? (
        <Loading />
      ) : (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2>Where every bug is</h2>
              <span className="hint">
                {plural(Object.values(d.status_counts).reduce((a, b) => a + b, 0), "bug")} in total
                {d.open_total > 0 &&
                  ` · ${d.by_severity
                    .filter((s) => s.open)
                    .map((s) => `${s.open} ${lookup.severity(s.severity)?.label.toLowerCase() ?? s.severity}`)
                    .join(" · ")} open`}
              </span>
            </div>
            <div className="panel-body">
              <div className="status-board">
                {STATUS_GROUPS.map((g) => {
                  const shown = g.statuses.filter((s) => lookup.status(s).enabled);
                  return (
                  <div key={g.key} className="status-group" style={{ "--n": shown.length } as CSSProperties}>
                    <div className="eyebrow">{g.label}</div>
                    <div className="status-tiles">
                      {shown
                        .map((s) => {
                          const cfg = lookup.status(s);
                          const overdue = d.overdue_counts[s] ?? 0;
                          return (
                            <Link key={s} to={statusLink(s)} className={cx("status-tile", `tone-${cfg.color}`)} title={cfg.description}>
                              <span className="tile-label">
                                <span className="dot" aria-hidden />
                                <span>{cfg.label}</span>
                              </span>
                              <span className="tile-count num">{d.status_counts[s]}</span>
                              {overdue > 0 ? (
                                <span className="tile-note danger-text" title="Waiting longer than the attention time for this status">
                                  <Clock size={12} /> {overdue} overdue
                                </span>
                              ) : (
                                <span className="tile-note">&nbsp;</span>
                              )}
                            </Link>
                          );
                        })}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="dash-grid">
            <section className="panel span-2">
              <div className="panel-head">
                <h2>Reported and resolved per week</h2>
                <Legend
                  items={[
                    { id: "reported", label: "Reported", color: "var(--series-1)", note: String(d.metrics.reported_in_period) },
                    { id: "resolved", label: "Resolved", color: "var(--series-2)", note: String(d.metrics.closed_in_period) },
                  ]}
                />
              </div>
              <div className="panel-body">
                <ChartOrTable
                  label="reported and resolved per week"
                  chart={
                    <LineChart
                      ariaLabel={`Bugs reported and resolved per week over the last ${d.weekly.length} weeks`}
                      x={d.weekly.map((w) => w.week)}
                      xFormat={weekLabel}
                      tooltipTitle={(i) => `Week of ${weekLabel(d.weekly[i].week)}`}
                      series={[
                        { id: "reported", label: "Reported", color: "var(--series-1)", values: d.weekly.map((w) => w.reported) },
                        { id: "resolved", label: "Resolved", color: "var(--series-2)", values: d.weekly.map((w) => w.resolved) },
                      ]}
                    />
                  }
                  table={
                    <table className="table compact">
                      <thead>
                        <tr>
                          <th>Week of</th>
                          <th className="num">Reported</th>
                          <th className="num">Resolved</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.weekly.map((w) => (
                          <tr key={w.week}>
                            <td>{weekLabel(w.week)}</td>
                            <td className="num">{w.reported}</td>
                            <td className="num">{w.resolved}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  }
                />
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Open bugs by module</h2>
                <span className="hint">Click a module to see its bugs</span>
              </div>
              <div className="panel-body">
                <BarList
                  empty="No open bugs."
                  items={d.by_module.slice(0, 8).map((m) => {
                    const mod = lookup.module(m.module_id);
                    return {
                      id: m.module_id,
                      label: project ? mod?.name ?? "?" : `${mod?.name ?? "?"}`,
                      value: m.open,
                      onClick: () => navigate(`/bugs?view=open&module=${m.module_id}`),
                      tooltip: (
                        <span className="stack-sm" style={{ gap: 2 }}>
                          <strong>
                            {lookup.project(mod?.project_id)?.name} › {mod?.name}
                          </strong>
                          <span>{m.open} open</span>
                          <span>{m.high_severity} critical or major</span>
                          <span>{m.reopened} reopened at least once</span>
                        </span>
                      ),
                    };
                  })}
                />
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Where bugs wait</h2>
                <span className="hint">Average time per stay, last {d.scope.days} days</span>
              </div>
              <div className="panel-body">
                <WaitBars rows={d.time_in_status} />
              </div>
            </section>

            <section className="panel span-4">
              <div className="panel-head">
                <h2>Flow</h2>
                <span className="hint">Last {d.scope.days} days · medians, so a few outliers don't skew them</span>
              </div>
              <div className="panel-body">
                <div className="stat-grid six">
                  <StatTile label="First response" value={duration(d.metrics.median_hours_to_first_response)} note="From report to an engineer's first action" />
                  <StatTile label="Time to fix" value={duration(d.metrics.median_hours_to_fix)} note="From report to marked fixed" />
                  <StatTile label="Time to close" value={duration(d.metrics.median_hours_to_close)} note="From report to closed after verification" />
                  <StatTile label="Regression pass rate" value={percent(d.metrics.regression_pass_rate)} note="Re-tests that passed first time" />
                  <StatTile label="Reopen rate" value={percent(d.metrics.reopen_rate)} note="Fixes that failed regression at least once" tone={d.metrics.reopen_rate !== null && d.metrics.reopen_rate > 0.25 ? "danger" : undefined} />
                  <StatTile label="Valid reports" value={percent(d.metrics.valid_report_rate)} note="Triaged reports not marked Not a Bug" />
                </div>
              </div>
            </section>
          </div>

          <div className="dash-grid">
            <section className="panel span-3">
              <div className="panel-head">
                <h2>Waiting longest</h2>
                <Link to="/bugs?view=overdue" className="small">
                  All bugs that need attention <ArrowRight size={13} style={{ verticalAlign: "-2px" }} />
                </Link>
              </div>
              <div className="panel-body flush">
                <BugTable items={d.oldest_waiting} columns={["title", "status", "waiting"]} empty="Nothing is waiting" />
              </div>
            </section>
            <PersonalPanel mine={d.my_reports ?? []} assigned={d.my_assigned ?? []} />
          </div>

          {lead && <ReleaseRisk project={project} />}
        </>
      )}
    </div>
  );
}

function WaitBars({ rows }: { rows: { status: StatusKey; avg_hours: number; count: number }[] }) {
  const { lookup } = useWorkspace();
  const max = Math.max(0, ...rows.map((r) => r.avg_hours));
  const worst = rows.find((r) => r.avg_hours === max);
  return (
    <div className="stack-sm">
      <BarList
        emphasisMode
        valueWidth={70}
        empty="No status changes in this period."
        items={rows.map((r) => ({
          id: r.status,
          label: lookup.status(r.status).label,
          value: r.avg_hours,
          display: duration(r.avg_hours),
          emphasis: r.status === worst?.status,
          tooltip: (
            <span>
              {lookup.status(r.status).label}: {duration(r.avg_hours)} on average over {r.count} stay{r.count === 1 ? "" : "s"}
            </span>
          ),
        }))}
      />
      {worst && (
        <p className="tiny muted">
          Bugs spend longest in <strong className="secondary">{lookup.status(worst.status).label}</strong>.
        </p>
      )}
    </div>
  );
}

const ITEM_TONE: Partial<Record<ActionItem["kind"], string>> = {
  answer_question: "warning",
  run_regression: "warning",
  review_decision: "warning",
  reopened: "danger",
  dispute: "danger",
};

function MyQueue() {
  const items = useActionItems();
  const list = items.data?.items ?? [];
  if (items.isLoading) return null;
  return (
    <section className={cx("queue-strip", list.length === 0 && "clear")}>
      <div className="queue-head">
        <Inbox size={18} />
        <div className="grow">
          <strong>{list.length ? `${list.length} thing${list.length === 1 ? "" : "s"} need${list.length === 1 ? "s" : ""} you` : "You're all caught up"}</strong>
          <div className="small muted">{list.length ? "Questions, regressions, decisions and fixes waiting on you, oldest first." : "Nothing is waiting on you right now."}</div>
        </div>
        {list.length > 0 && (
          <Link to="/action" className="btn btn-sm">
            Open queue <ArrowRight />
          </Link>
        )}
      </div>
      {list.length > 0 && (
        <div className="queue-items">
          {list.slice(0, 4).map((it) => (
            <Link key={`${it.kind}-${it.bug.id}`} to={`/bugs/${it.bug.key}`} className="queue-item">
              <span className={cx("chip", ITEM_TONE[it.kind] ?? "accent")}>{it.label}</span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="mono tiny muted">{it.bug.key}</span>
                <span className="queue-title">{it.bug.title}</span>
                <span className="tiny muted">{it.detail}</span>
              </span>
              <span className="tiny muted nowrap">{relativeTime(it.since)}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function PersonalPanel({ mine, assigned }: { mine: { status: StatusKey; count: number }[]; assigned: { status: StatusKey; count: number }[] }) {
  const { ws, lookup } = useWorkspace();
  const engineer = ws.me.role === "engineer";
  const rows = engineer ? assigned : mine;
  const total = rows.reduce((a, r) => a + r.count, 0);
  const sorted = [...rows].sort((a, b) => lookup.status(a.status).sort_order - lookup.status(b.status).sort_order);
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{engineer ? "Assigned to you" : "Your reports"}</h2>
        <Link to={engineer ? "/bugs?view=assigned" : "/bugs?view=mine"} className="small">
          View all
        </Link>
      </div>
      <div className="panel-body">
        {total === 0 ? (
          <p className="small muted">{engineer ? "No open bugs are assigned to you." : "You haven't reported any bugs in this scope yet."}</p>
        ) : (
          <div className="stack-sm">
            <div className="stat">
              <span className="value num">{total}</span>
              <span className="note">{engineer ? "open bugs you own or collaborate on" : "bugs you reported"}</span>
            </div>
            <div className="mini-status">
              {sorted.map((r) => (
                <Link key={r.status} to={`/bugs?view=${engineer ? "assigned" : "mine"}&status=${r.status}`} className="mini-status-row">
                  <span className={cx("dot-tone", `tone-${lookup.status(r.status).color}`)} />
                  <span className="grow">{lookup.status(r.status).label}</span>
                  <span className="num">{r.count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ReleaseRisk({ project }: { project: string }) {
  const { ws, lookup } = useWorkspace();
  const [result, setResult] = useState<ReleaseRiskResult | null>(null);
  const [pick, setPick] = useState(project || ws.projects.find((p) => !p.archived)?.id || "");
  const target = project || pick;
  const run = useMutate((api, args: { project_id: string; offline?: boolean }) => api.post<ReleaseRiskResult>("/ai/release-risk", args), { silentError: true });
  const err = run.error ? errorMessage(run.error) : null;
  const byKey = useMemo(() => new Map((result?.risks ?? []).map((r) => [r.bug_key, r])), [result]);
  return (
    <section className="panel ai-panel">
      <div className="panel-head">
        <h2 className="row" style={{ gap: 8 }}>
          <Sparkles size={16} className="ai-icon" /> Release readiness
        </h2>
        <div className="row-wrap">
          {!project && <ProjectSelect value={pick} onChange={setPick} allLabel="Choose a project" />}
          <button
            className="btn btn-sm btn-accent"
            disabled={!target || run.isPending}
            onClick={() =>
              run.mutate({ project_id: target }, { onSuccess: setResult })
            }
          >
            {run.isPending ? <span className="spinner" /> : <Bot />} Summarise risk
          </button>
        </div>
      </div>
      <div className="panel-body stack">
        {!result && !err && (
          <p className="small muted">
            The assistant reads the open bugs for {target ? lookup.project(target)?.name : "a project"} and summarises what could block a release. It recommends; people decide.
          </p>
        )}
        {err && (
          <div className="callout danger">
            <CircleAlert />
            <div className="grow">
              <div>{err}</div>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => run.mutate({ project_id: target, offline: true }, { onSuccess: setResult })}>
                Use the offline summary
              </button>
            </div>
          </div>
        )}
        {result && (
          <div className="stack">
            <div className="row-wrap small muted">
              <span className="chip">{result.facts.open} open</span>
              <span className={cx("chip", result.facts.critical_open > 0 && "danger")}>{result.facts.critical_open} critical</span>
              <span className={cx("chip", result.facts.reopened_open > 0 && "warning")}>{result.facts.reopened_open} reopened</span>
              <span className="chip">{result.facts.overdue} waiting too long</span>
              <span className="chip">{result.facts.unassigned} unassigned</span>
            </div>
            <p className="risk-headline">{result.headline}</p>
            {result.risks.length > 0 && (
              <ul className="risk-list">
                {[...byKey.values()].map((r) => (
                  <li key={r.bug_key}>
                    <ShieldAlert size={15} />
                    <span>
                      <Link to={`/bugs/${r.bug_key}`} className="mono">
                        {r.bug_key}
                      </Link>{" "}
                      {r.risk}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="callout info">
              <Sparkles />
              <div>
                <div className="title">Recommendation</div>
                <div>{result.recommendation}</div>
              </div>
            </div>
            <p className="tiny muted">
              {result.provider === "offline" ? "Offline summary built from the numbers above." : `Written by Claude${result.model ? ` (${result.model})` : ""} from the open bugs on ${shortDate(new Date().toISOString())}.`} The release decision stays with the team.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
