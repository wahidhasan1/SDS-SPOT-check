import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Info } from "lucide-react";
import type { PersonStats } from "../../core/api";
import { QA_ROLES } from "../../core/types";
import { useWorkspace } from "../app/context";
import { useContributions, useEngineering, useModuleHealth } from "../api/hooks";
import { Avatar, Person } from "../components/badges";
import { ChartOrTable, Legend, LineChart, SERIES, Sparkline, StatTile } from "../components/charts";
import { ProjectSelect } from "../components/filters";
import { Loading, Segmented, Tabs, cx } from "../components/ui";
import { duration, percent } from "../lib/format";

type Tab = "qa" | "engineering" | "modules";

const OTHERS_COLOR = "var(--text-3)";

function weekLabel(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function AnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (["qa", "engineering", "modules"].includes(params.get("tab") ?? "") ? params.get("tab") : "qa") as Tab;
  const [project, setProject] = useState("");
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p className="sub">Contribution, flow and quality, to make work visible. Not a leaderboard.</p>
        </div>
        <ProjectSelect value={project} onChange={setProject} />
      </div>
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        tabs={[
          { value: "qa", label: "QA contributions" },
          { value: "engineering", label: "Engineering flow" },
          { value: "modules", label: "Modules" },
        ]}
      />
      {tab === "qa" && <Contributions project={project} />}
      {tab === "engineering" && <Engineering project={project} />}
      {tab === "modules" && <Modules project={project} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QA contributions
// ---------------------------------------------------------------------------

function Contributions({ project }: { project: string }) {
  const { ws, lookup } = useWorkspace();
  const [weeks, setWeeks] = useState<"12" | "26" | "52">("12");
  const q = useContributions({ project: project || undefined, weeks: Number(weeks) });
  // The selected person drives both the highlighted line and the detail card. People outside the
  // charted slots highlight the "Others" line.
  const [person, setPerson] = useState<string | null>(null);
  const [focus, setFocusId] = useState<string | null>(null);
  const data = q.data;

  // Colour follows the person, not their position in this result: QA people get fixed slots in a
  // stable order, so changing the period or project never repaints anyone. Occasional reporters
  // outside QA, and anyone beyond the seventh QA person, fold into a single grey "Others" line.
  const { colorOf, charted } = useMemo(() => {
    const order = ws.users.filter((u) => QA_ROLES.includes(u.role)).sort((a, b) => a.name.localeCompare(b.name)).map((u) => u.id);
    const slots = new Map(order.slice(0, SERIES.length - 1).map((id, i) => [id, SERIES[i]]));
    return { colorOf: (id: string) => slots.get(id) ?? OTHERS_COLOR, charted: (id: string) => slots.has(id) };
  }, [ws.users]);

  if (!data) return <Loading />;
  const self = data.scope === "self";
  const own = data.series.filter((s) => charted(s.user_id) || self);
  const rest = data.series.filter((s) => !charted(s.user_id) && !self && s.counts.some((c) => c > 0));
  const series = [
    ...own
      .filter((s) => self || s.counts.some((c) => c > 0) || data.people.find((p) => p.user_id === s.user_id)?.regressions_run)
      .map((s) => ({ id: s.user_id, label: lookup.userName(s.user_id), color: self ? SERIES[0] : colorOf(s.user_id), values: s.counts })),
    ...(rest.length
      ? [{ id: "others", label: `Others (${rest.length})`, color: OTHERS_COLOR, values: data.weeks.map((_, i) => rest.reduce((a, s) => a + s.counts[i], 0)) }]
      : []),
  ];
  const setFocus = (id: string | null) => {
    setFocusId(id);
    setPerson(id && id !== "others" ? id : null);
  };
  const pick = (uid: string | null) => {
    setPerson(uid);
    setFocusId(uid ? (charted(uid) || self ? uid : "others") : null);
  };
  const selected = person ? data.people.find((p) => p.user_id === person) ?? null : self ? data.people[0] ?? null : null;
  const totals = data.people.reduce((a, p) => ({ reported: a.reported + p.reported, fixed: a.fixed + p.fixed, verified: a.verified + p.verified, runs: a.runs + p.regressions_run }), { reported: 0, fixed: 0, verified: 0, runs: 0 });

  return (
    <div className="stack-lg">
      <div className="callout info">
        <Info />
        <div>
          These numbers give credit and show where QA effort goes. They are not a ranking: a single critical find can matter more than twenty cosmetic ones, and some areas simply surface more bugs.
          {self && " You're seeing your own numbers; QA leads, project managers and admins see the team view."}
        </div>
      </div>

      <div className="stat-grid">
        <StatTile label={self ? "Bugs you reported" : "Bugs reported"} value={totals.reported} note={`Last ${weeks} weeks`} />
        <StatTile label="Of those, fixed" value={totals.fixed} note={totals.reported ? `${Math.round((totals.fixed / totals.reported) * 100)}% of reports led to a fix` : "—"} />
        <StatTile label="Regressions run" value={totals.runs} note={`${totals.verified} passed and verified`} />
        <StatTile label="People contributing" value={data.people.filter((p) => p.reported || p.regressions_run).length} note={self ? "Just you in this view" : "Reported or re-tested at least once"} />
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Bugs reported per week</h2>
          <Segmented
            label="Period"
            value={weeks}
            onChange={(v) => setWeeks(v)}
            options={[
              { value: "12", label: "12 weeks" },
              { value: "26", label: "6 months" },
              { value: "52", label: "1 year" },
            ]}
          />
        </div>
        <div className="panel-body stack">
          {series.length > 1 && <Legend items={series.map((s) => ({ id: s.id, label: s.label, color: s.color }))} focus={focus} onFocus={setFocus} />}
          <ChartOrTable
            label="bugs reported per week"
            chart={
              series.length ? (
                <LineChart
                  ariaLabel={`Bugs reported per week by ${series.length} people over ${data.weeks.length} weeks`}
                  x={data.weeks}
                  xFormat={weekLabel}
                  tooltipTitle={(i) => `Week of ${weekLabel(data.weeks[i])}`}
                  series={series}
                  focus={focus}
                  onFocus={setFocus}
                  height={260}
                />
              ) : (
                <p className="muted small">No reports in this period.</p>
              )
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
          {!self && <p className="tiny muted">Click a name to follow one person's line and see their details below.</p>}
        </div>
      </section>

      {selected && <PersonDetail stats={selected} weeks={weeks} color={colorOf(selected.user_id)} values={data.series.find((s) => s.user_id === selected.user_id)?.counts ?? []} onClose={self ? undefined : () => pick(null)} />}

      {!self && (
        <section className="panel">
          <div className="panel-head">
            <h2>Outcomes of each person's reports</h2>
            <span className="hint">Sorted by name · last {weeks} weeks</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="table dense">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Trend</th>
                    <th className="num">Reported</th>
                    <th className="num">Fixed</th>
                    <th className="num">Open</th>
                    <th className="num" title="Marked Not a Bug">Not a bug</th>
                    <th className="num">Duplicate</th>
                    <th className="num" title="Reports whose fix failed regression at least once">Reopened</th>
                    <th className="num" title="Evidence added to someone else's report">Co-reported</th>
                    <th className="num" title="Regression rounds this person completed">Re-tests</th>
                    <th className="num" title="Average time from report to closed">Avg to close</th>
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((p) => (
                    <tr key={p.user_id} className={cx("clickable", person === p.user_id && "selected")} onClick={() => pick(person === p.user_id ? null : p.user_id)}>
                      <td>
                        <span className="row" style={{ gap: 8 }}>
                          <span className="swatch line" style={{ background: colorOf(p.user_id), opacity: charted(p.user_id) ? 1 : 0.6 }} />
                          <Person userId={p.user_id} sub={lookup.user(p.user_id)?.title ?? undefined} />
                        </span>
                      </td>
                      <td>
                        <Sparkline values={data.series.find((s) => s.user_id === p.user_id)?.counts ?? []} color={colorOf(p.user_id)} />
                      </td>
                      <td className="num">{p.reported}</td>
                      <td className="num">{p.fixed}</td>
                      <td className="num">{p.open}</td>
                      <td className="num">{p.not_a_bug}</td>
                      <td className="num">{p.duplicate}</td>
                      <td className="num">{p.reopened}</td>
                      <td className="num">{p.co_reported}</td>
                      <td className="num">{p.regressions_run}</td>
                      <td className="num nowrap">{duration(p.avg_hours_to_resolution)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function PersonDetail({ stats, weeks, color, values, onClose }: { stats: PersonStats; weeks: string; color: string; values: number[]; onClose?: () => void }) {
  const { lookup } = useWorkspace();
  const u = lookup.user(stats.user_id);
  const valid = stats.reported - stats.not_a_bug;
  return (
    <section className="panel">
      <div className="panel-head">
        <div className="row" style={{ gap: 10 }}>
          <Avatar userId={stats.user_id} size="lg" />
          <div>
            <h2>{u?.name}</h2>
            <div className="tiny muted">
              {u?.title}
              {u && !u.active ? " · no longer active" : ""}
            </div>
          </div>
        </div>
        <div className="row">
          <Sparkline values={values} color={color} width={120} height={28} />
          {onClose && (
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Show everyone
            </button>
          )}
        </div>
      </div>
      <div className="panel-body stack">
        <div className="stat-grid six">
          <StatTile label="Reported" value={stats.reported} note={`Last ${weeks} weeks`} />
          <StatTile label="Led to a fix" value={stats.fixed} note={stats.reported ? percent(stats.fixed / stats.reported) + " of reports" : "—"} />
          <StatTile label="Valid reports" value={stats.reported ? percent(valid / stats.reported) : "—"} note={`${stats.not_a_bug} not a bug · ${stats.duplicate} duplicate`} />
          <StatTile label="Regressions" value={stats.regressions_run} note={`${stats.verified} verified`} />
          <StatTile label="Co-reported" value={stats.co_reported} note="Evidence added to someone else's bug" />
          <StatTile label="Average to close" value={duration(stats.avg_hours_to_resolution)} note="For their closed reports" />
        </div>
        <div className="row-wrap">
          <Link className="btn btn-sm" to={`/bugs?view=all&reporter=${stats.user_id}`}>
            See their reports
          </Link>
          {stats.open > 0 && (
            <Link className="btn btn-sm btn-ghost" to={`/bugs?view=open&reporter=${stats.user_id}`}>
              {stats.open} still open
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Engineering flow
// ---------------------------------------------------------------------------

function Engineering({ project }: { project: string }) {
  const [days, setDays] = useState<"30" | "90" | "180">("90");
  const q = useEngineering({ project: project || undefined, days: Number(days) });
  const data = q.data;
  if (!data) return <Loading />;
  const t = data.people.reduce((a, p) => ({ open: a.open + p.assigned_open, fixed: a.fixed + p.fixed_in_period, reopened: a.reopened + p.reopened_after_fix, qa: a.qa + p.waiting_on_qa }), { open: 0, fixed: 0, reopened: 0, qa: 0 });
  return (
    <div className="stack-lg">
      <div className="row-between">
        <p className="small secondary">Workload and flow per engineer. Use it to balance work and spot where bugs get stuck, not to rank people.</p>
        <Segmented
          label="Period"
          value={days}
          onChange={setDays}
          options={[
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
            { value: "180", label: "6 months" },
          ]}
        />
      </div>
      <div className="stat-grid">
        <StatTile label="Open and assigned" value={t.open} note={`${data.unassigned_open} more waiting for an owner`} tone={data.unassigned_open > 5 ? "warning" : undefined} />
        <StatTile label="Fixed" value={t.fixed} note={`Last ${days} days`} />
        <StatTile label="Failed regression" value={t.reopened} note="Fixes QA reopened" />
        <StatTile label="Regression pass rate" value={percent(data.regression_pass_rate)} note={`${t.qa} bugs waiting on QA`} />
      </div>
      <section className="panel">
        <div className="panel-body flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Engineer</th>
                  <th className="num">Open</th>
                  <th className="num">In progress</th>
                  <th className="num">Waiting on QA</th>
                  <th className="num">Fixed</th>
                  <th className="num">Reopened after fix</th>
                  <th className="num">First response</th>
                  <th className="num">Time to fix</th>
                </tr>
              </thead>
              <tbody>
                {data.people.map((p) => (
                  <tr key={p.user_id}>
                    <td>
                      <Link to={`/bugs?view=open&assignee=${p.user_id}`} className="plain">
                        <Person userId={p.user_id} />
                      </Link>
                    </td>
                    <td className="num">{p.assigned_open}</td>
                    <td className="num">{p.in_progress}</td>
                    <td className="num">{p.waiting_on_qa}</td>
                    <td className="num">{p.fixed_in_period}</td>
                    <td className="num">{p.reopened_after_fix}</td>
                    <td className="num nowrap">{duration(p.median_hours_to_first_response)}</td>
                    <td className="num nowrap">{duration(p.median_hours_to_fix)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <p className="tiny muted">Times are medians. Time to fix runs from confirmation (or the report, if never confirmed) to marked fixed.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

function Modules({ project }: { project: string }) {
  const { lookup } = useWorkspace();
  const q = useModuleHealth({ project: project || undefined });
  const data = q.data;
  if (!data) return <Loading />;
  const rows = data.modules.filter((m) => m.total > 0 || !lookup.module(m.module_id)?.archived);
  return (
    <div className="stack-lg">
      <p className="small secondary">Which areas produce the most bugs, which fixes don't hold, and what keeps coming back.</p>
      <section className="panel">
        <div className="panel-body flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Owner</th>
                  <th className="num">Open</th>
                  <th className="num">All time</th>
                  <th className="num">Reopen rate</th>
                  <th className="num">Not a bug</th>
                  <th className="num">Time to close</th>
                  <th>Recurring themes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const mod = lookup.module(m.module_id);
                  return (
                    <tr key={m.module_id}>
                      <td>
                        <Link to={`/bugs?view=all&module=${m.module_id}`} className="plain">
                          <div style={{ fontWeight: 500 }}>{mod?.name}</div>
                          <div className="tiny muted">{lookup.project(m.project_id)?.name}</div>
                        </Link>
                      </td>
                      <td>{mod?.owner_id ? <Person userId={mod.owner_id} /> : <span className="small muted">No owner</span>}</td>
                      <td className="num">{m.open}</td>
                      <td className="num">{m.total}</td>
                      <td className={cx("num", m.reopen_rate !== null && m.reopen_rate >= 0.3 && "danger-text")}>{percent(m.reopen_rate)}</td>
                      <td className="num">{m.not_a_bug}</td>
                      <td className="num nowrap">{duration(m.median_hours_to_close)}</td>
                      <td>
                        <div className="row-wrap" style={{ gap: 4 }}>
                          {m.recurring_concepts.length ? m.recurring_concepts.map((c) => <span key={c.concept} className="chip">{c.concept} · {c.count}</span>) : <span className="small muted">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <p className="tiny muted">Reopen rate is the share of bugs that reached a fix and later failed regression. Recurring themes come from bug titles and results, for example “save / persist” or “export”.</p>
    </div>
  );
}
