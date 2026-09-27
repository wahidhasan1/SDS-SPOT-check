// My insights: the signed-in person's own work. Nobody sees anyone else's numbers here.

import { useState } from "react";
import { Link } from "react-router";
import { useWorkspace } from "../app/context";
import { useContributions, useEngineering } from "../api/hooks";
import { ChartOrTable, LineChart, SERIES, StatTile } from "../components/charts";
import { ProjectSelect } from "../components/filters";
import { Loading, Segmented } from "../components/ui";
import { duration, percent } from "../lib/format";

function weekLabel(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function AnalyticsPage() {
  const { ws } = useWorkspace();
  const [project, setProject] = useState("");
  const [weeks, setWeeks] = useState<"12" | "26" | "52">("12");
  const engineer = ws.me.role === "engineer";
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>My insights</h1>
          <p className="sub">Your own work, for you. Other people's numbers are not shown here.</p>
        </div>
        <div className="row-wrap">
          <ProjectSelect value={project} onChange={setProject} allLabel="All products" />
          <Segmented
            label="Period"
            value={weeks}
            onChange={setWeeks}
            options={[
              { value: "12", label: "12 weeks" },
              { value: "26", label: "6 months" },
              { value: "52", label: "1 year" },
            ]}
          />
        </div>
      </div>
      {engineer ? <EngineerInsights project={project} weeks={Number(weeks)} /> : <ReporterInsights project={project} weeks={Number(weeks)} />}
    </div>
  );
}

function ReporterInsights({ project, weeks }: { project: string; weeks: number }) {
  const { ws } = useWorkspace();
  const q = useContributions({ project: project || undefined, weeks });
  const data = q.data;
  if (!data) return <Loading />;
  const me = data.people.find((p) => p.user_id === ws.me.id);
  const counts = data.series.find((s) => s.user_id === ws.me.id)?.counts ?? data.weeks.map(() => 0);
  if (!me) return <p className="muted small">No reports in this period.</p>;
  const valid = me.reported - me.not_a_bug;
  const scope = project ? `&project=${project}` : "";
  return (
    <div className="stack-lg">
      <div className="stat-grid">
        <StatTile label="Bugs you reported" value={me.reported} note={`Last ${weeks} weeks`} />
        <StatTile label="Led to a fix" value={me.fixed} note={me.reported ? `${percent(me.fixed / me.reported)} of your reports` : "—"} />
        <StatTile label="Valid reports" value={me.reported ? percent(valid / me.reported) : "—"} note={`${me.not_a_bug} marked Not a Bug`} />
        <StatTile label="Average to close" value={duration(me.avg_hours_to_resolution)} note="From your report to closed" />
      </div>
      <div className="stat-grid">
        <StatTile label="Still open" value={me.open} note={<Link to={`/my-bugs?state=open${scope}`}>See them</Link>} />
        <StatTile label="Reopened after a fix" value={me.reopened} note="Fixes you sent back" />
        <StatTile label="Regressions you ran" value={me.regressions_run} note={`${me.verified} passed and verified`} />
        <StatTile label="Seen by you too" value={me.co_reported} note="Evidence added to someone else's report" />
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Bugs you reported per week</h2>
        </div>
        <div className="panel-body">
          <ChartOrTable
            label="bugs you reported per week"
            chart={
              <LineChart
                ariaLabel={`Bugs you reported per week over ${data.weeks.length} weeks`}
                x={data.weeks}
                xFormat={weekLabel}
                tooltipTitle={(i) => `Week of ${weekLabel(data.weeks[i])}`}
                series={[{ id: "me", label: "You", color: SERIES[0], values: counts }]}
                directLabels={false}
                height={240}
                empty="You haven't reported anything in this period."
              />
            }
            table={
              <table className="table compact">
                <thead>
                  <tr>
                    <th>Week of</th>
                    <th className="num">Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weeks.map((w, i) => (
                    <tr key={w}>
                      <td>{weekLabel(w)}</td>
                      <td className="num">{counts[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          />
        </div>
      </section>
    </div>
  );
}

function EngineerInsights({ project, weeks }: { project: string; weeks: number }) {
  const { ws } = useWorkspace();
  const q = useEngineering({ project: project || undefined, days: weeks * 7 });
  const data = q.data;
  if (!data) return <Loading />;
  const me = data.people.find((p) => p.user_id === ws.me.id);
  if (!me) return <p className="muted small">Nothing assigned to you in this period.</p>;
  const scope = project ? `&project=${project}` : "";
  return (
    <div className="stack-lg">
      <div className="stat-grid">
        <StatTile label="Open and assigned to you" value={me.assigned_open} note={<Link to={`/assigned?state=open${scope}`}>See them</Link>} />
        <StatTile label="In progress" value={me.in_progress} note={`${me.waiting_on_qa} waiting on QA`} />
        <StatTile label="Fixed" value={me.fixed_in_period} note={`Last ${weeks} weeks`} />
        <StatTile label="Failed regression" value={me.reopened_after_fix} note="Your fixes QA reopened" tone={me.reopened_after_fix > 2 ? "warning" : undefined} />
      </div>
      <div className="stat-grid">
        <StatTile label="Your first response" value={duration(me.avg_hours_to_first_response)} note="Average from report to your first action" />
        <StatTile label="Your time to fix" value={duration(me.avg_hours_to_fix)} note="Average from confirmation to fixed" />
      </div>
    </div>
  );
}
