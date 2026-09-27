import { useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router";
import { Bot, CircleAlert, ShieldAlert, Sparkles } from "lucide-react";
import type { DashboardResponse, ReleaseRiskResult } from "../../core/api";
import { STATUS_GROUPS } from "../../core/statuses";
import type { StatusKey } from "../../core/types";
import { useWorkspace } from "../app/context";
import { errorMessage, useDashboard, useMutate } from "../api/hooks";
import { ChartOrTable, Donut, Legend, LineChart, SERIES, StatTile } from "../components/charts";
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
  const scope = project ? `&project=${project}` : "";
  const statusLink = (s: StatusKey) => `/bugs?status=${s}${scope}`;

  return (
    <div className="stack-lg dashboard">
      <div className="page-head">
        <div>
          <h1>
            {greeting()}, {me.name.split(" ")[0]}
          </h1>
          <p className="sub">{d ? `${plural(d.open_total, "open bug")}${project ? ` in ${lookup.project(project)?.name}` : " across all products"} · updated ${relativeTime(d.generated_at)}` : "Loading the workspace…"}</p>
        </div>
        <div className="row-wrap">
          <ProjectSelect value={project} onChange={setProject} allLabel="All products" />
          <Segmented label="Period" value={days} onChange={setDays} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
        </div>
      </div>

      {!d ? (
        <Loading />
      ) : (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2>Where every bug is</h2>
              <span className="hint">Click a status to see its bugs</span>
            </div>
            <div className="panel-body">
              <div className="status-board">
                {STATUS_GROUPS.filter((g) => g.key !== "resolved").map((g) => {
                  const shown = g.statuses.filter((s) => lookup.status(s).enabled);
                  return (
                    <div key={g.key} className="status-group" style={{ "--n": shown.length } as CSSProperties}>
                      <div className="eyebrow">{g.label}</div>
                      <div className="status-tiles">
                        {shown.map((s) => {
                          const cfg = lookup.status(s);
                          return (
                            <Link key={s} to={statusLink(s)} className={cx("status-tile", `tone-${cfg.color}`, d.status_counts[s] === 0 && "zero")} title={cfg.description}>
                              <span className="tile-label">
                                <span className="dot" aria-hidden />
                                <span>{cfg.label}</span>
                              </span>
                              <span className="tile-count num">{d.status_counts[s]}</span>
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

          <div className="dash-grid thirds">
            <section className="panel">
              <div className="panel-head">
                <h2>Pending, closed or not a bug</h2>
              </div>
              <div className="panel-body">
                <Donut
                  ariaLabel={`${d.outcomes.pending} pending, ${d.outcomes.closed} closed, ${d.outcomes.not_a_bug} not a bug`}
                  centerLabel="bugs in total"
                  slices={[
                    { id: "pending", label: "Pending", value: d.outcomes.pending, color: "var(--warning)", note: "Still being fixed, tested or waiting", onClick: () => navigate(`/bugs?state=open${scope}`) },
                    { id: "closed", label: "Closed", value: d.outcomes.closed, color: "var(--positive)", note: "Fixed and verified", onClick: () => navigate(`/bugs?state=resolved${scope}`) },
                    { id: "nab", label: "Not a bug", value: d.outcomes.not_a_bug, color: "var(--chart-muted)", note: "Reports rejected after review", onClick: () => navigate(`/bugs?status=not_a_bug${scope}`) },
                  ]}
                />
              </div>
            </section>
            <ReportedByLine data={d.reported_by_line} />
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>Flow</h2>
              <span className="hint">Averages over the last {d.scope.days} days</span>
            </div>
            <div className="panel-body">
              <div className="stat-grid five">
                <StatTile label="Engineer response" value={duration(d.metrics.avg_hours_to_first_response)} note="From report to an engineer's first action" />
                <StatTile label="Time to fix" value={duration(d.metrics.avg_hours_to_fix)} note="From report to marked fixed" />
                <StatTile label="Time to close" value={duration(d.metrics.avg_hours_to_close)} note="From report to closed after verification" />
                <StatTile label="Reopened" value={percent(d.metrics.reopen_rate)} note="Fixes that failed regression at least once" tone={d.metrics.reopen_rate !== null && d.metrics.reopen_rate > 0.25 ? "danger" : undefined} />
                <StatTile label="Valid reports" value={percent(d.metrics.valid_report_rate)} note="Reviewed reports not marked Not a Bug" />
              </div>
            </div>
          </section>

          {lead && <ReleaseRisk project={project} />}
        </>
      )}
    </div>
  );
}

function ReportedByLine({ data }: { data: DashboardResponse["reported_by_line"] }) {
  const [focus, setFocus] = useState<string | null>(null);
  // Colour follows the product (or module) by its fixed position in the workspace, never by rank.
  const series = data.lines.map((l, i) => ({ id: l.id, label: l.name, color: i < SERIES.length ? SERIES[i] : "var(--text-3)", values: l.counts }));
  const what = data.kind === "project" ? "product" : "module";
  const totals = new Map(data.lines.map((l) => [l.id, l.counts.reduce((a, b) => a + b, 0)]));
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Bugs reported per week, by {what}</h2>
        <span className="hint">A line heading down means that {what} is getting ready to launch</span>
      </div>
      <div className="panel-body stack">
        {series.length > 1 && <Legend items={series.map((s) => ({ id: s.id, label: s.label, color: s.color, note: String(totals.get(s.id) ?? 0) }))} focus={focus} onFocus={setFocus} />}
        <ChartOrTable
          label={`bugs reported per week by ${what}`}
          chart={
            <LineChart
              ariaLabel={`Bugs reported per week for each ${what} over the last ${data.weeks.length} weeks`}
              x={data.weeks}
              xFormat={weekLabel}
              tooltipTitle={(i) => `Week of ${weekLabel(data.weeks[i])}`}
              series={series}
              focus={focus}
              onFocus={setFocus}
              height={250}
            />
          }
          table={
            <table className="table compact">
              <thead>
                <tr>
                  <th>Week of</th>
                  {series.map((s) => (
                    <th key={s.id} className="num">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.weeks.map((w, i) => (
                  <tr key={w}>
                    <td>{weekLabel(w)}</td>
                    {series.map((s) => (
                      <td key={s.id} className="num">
                        {s.values[i]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          }
        />
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
