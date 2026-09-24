import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Plus, X } from "lucide-react";
import { STATUS_KEYS } from "../../core/types";
import { BUG_VIEWS, SORT_OPTIONS, type BugViewKey } from "../../core/views";
import { useWorkspace } from "../app/context";
import { useBugs, useCounts } from "../api/hooks";
import { BugTable } from "../components/BugTable";
import { MultiSelect, ProjectSelect } from "../components/filters";
import { Loading, cx, useDebounced } from "../components/ui";

const VIEW_GROUPS: { label: string; views: BugViewKey[] }[] = [
  { label: "Mine", views: ["mine", "assigned", "my_regression"] },
  { label: "Queues", views: ["waiting_engineering", "waiting_qa", "overdue", "unassigned", "potential_duplicates", "disputed", "reopened"] },
  { label: "Everything", views: ["open", "deferred", "resolved", "all", "archived"] },
];

const PAGE_SIZE = 50;

export function BugsPage() {
  const { ws, lookup } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const counts = useCounts().data;
  const view = (BUG_VIEWS.some((v) => v.key === params.get("view")) ? params.get("view") : "open") as BugViewKey;
  const viewDef = BUG_VIEWS.find((v) => v.key === view)!;
  const canSeeArchived = ws.me.role === "qa_lead" || ws.me.role === "admin";

  const get = (k: string) => params.get(k) ?? "";
  const getList = (k: string) => (params.get(k) ? params.get(k)!.split(",").filter(Boolean) : []);
  const update = (patch: Record<string, string | string[] | null>, keepPage = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      const val = Array.isArray(v) ? v.join(",") : v;
      if (val) next.set(k, val);
      else next.delete(k);
    }
    if (!keepPage) next.delete("page");
    setParams(next, { replace: true });
  };

  const [q, setQ] = useState(get("q"));
  const debouncedQ = useDebounced(q, 250);
  useEffect(() => {
    if (debouncedQ !== get("q")) update({ q: debouncedQ || null });
  }, [debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setQ(params.get("q") ?? ""), [params.get("q")]); // eslint-disable-line react-hooks/exhaustive-deps

  const project = get("project");
  const page = Number(get("page") || 1);
  const query = {
    view,
    q: get("q") || undefined,
    project: project || undefined,
    module: get("module") || undefined,
    status: getList("status"),
    severity: getList("severity"),
    priority: getList("priority"),
    reporter: get("reporter") || undefined,
    assignee: get("assignee") || undefined,
    tag: get("tag") || undefined,
    sort: get("sort") || (view === "overdue" ? "waiting" : "updated"),
    dir: get("dir") || undefined,
    page,
    page_size: PAGE_SIZE,
  };
  const res = useBugs(query);
  const data = res.data;

  const modules = project ? lookup.modulesOf(project) : ws.modules.filter((m) => !m.archived);
  const people = useMemo(() => [...ws.users].sort((a, b) => a.name.localeCompare(b.name)), [ws.users]);
  const filtered = ["q", "project", "module", "status", "severity", "priority", "reporter", "assignee", "tag"].some((k) => params.get(k));

  const viewCount = (v: BugViewKey): number | undefined => {
    if (!counts) return undefined;
    if (v === "my_regression") return counts.my_regression || undefined;
    if (v === "assigned") return counts.assigned || undefined;
    if (v === "mine") return counts.mine_open || undefined;
    return undefined;
  };

  const from = data ? (data.page - 1) * data.page_size + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.page_size) : 0;

  return (
    <div className="bugs-page">
      <div className="page-head">
        <div>
          <h1>{viewDef.label}</h1>
          <p className="sub">{viewDef.description}</p>
        </div>
        {ws.capabilities.report && (
          <Link to="/bugs/new" className="btn btn-primary">
            <Plus /> Report bug
          </Link>
        )}
      </div>

      <div className="bugs-layout">
        <nav className="views-nav" aria-label="Saved views">
          {VIEW_GROUPS.map((g) => (
            <div key={g.label} className="stack-sm" style={{ gap: 1 }}>
              <div className="eyebrow" style={{ padding: "0 10px 4px" }}>{g.label}</div>
              {g.views
                .filter((v) => v !== "archived" || canSeeArchived)
                .filter((v) => v !== "my_regression" || ws.capabilities.qa)
                .map((v) => {
                  const def = BUG_VIEWS.find((x) => x.key === v)!;
                  const n = viewCount(v);
                  return (
                    <button key={v} className={cx("view-link", v === view && "on")} onClick={() => update({ view: v })} title={def.description}>
                      <span className="truncate">{def.label}</span>
                      {n ? <span className="count">{n}</span> : null}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="stack" style={{ minWidth: 0 }}>
          <select className="select views-select" value={view} onChange={(e) => update({ view: e.target.value })} aria-label="View">
            {VIEW_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.views
                  .filter((v) => v !== "archived" || canSeeArchived)
                  .map((v) => (
                    <option key={v} value={v}>
                      {BUG_VIEWS.find((x) => x.key === v)!.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>

          <div className="filter-bar">
            <div className="search-input" style={{ flex: "1 1 220px", maxWidth: 340 }}>
              <input className="input input-sm" placeholder="Filter by text, ID or person" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter bugs" />
            </div>
            <ProjectSelect value={project} onChange={(v) => update({ project: v || null, module: null })} />
            <select className="select select-sm" value={get("module")} onChange={(e) => update({ module: e.target.value || null })} aria-label="Module">
              <option value="">All modules</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {project ? m.name : `${lookup.project(m.project_id)?.name ?? ""} › ${m.name}`}
                </option>
              ))}
            </select>
            <MultiSelect
              label="Status"
              value={getList("status")}
              onChange={(v) => update({ status: v })}
              options={STATUS_KEYS.filter((k) => lookup.status(k).enabled).map((k) => ({ value: k, label: lookup.status(k).label }))}
            />
            <MultiSelect label="Severity" value={getList("severity")} onChange={(v) => update({ severity: v })} options={ws.severities.map((s) => ({ value: s.key, label: s.label }))} width={200} />
            <MultiSelect label="Priority" value={getList("priority")} onChange={(v) => update({ priority: v })} options={ws.priorities.map((s) => ({ value: s.key, label: s.label }))} width={200} />
            <select className="select select-sm" value={get("reporter")} onChange={(e) => update({ reporter: e.target.value || null })} aria-label="Reporter">
              <option value="">Any reporter</option>
              {people.filter((u) => u.role === "qa_analyst" || u.role === "qa_lead").map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.active ? "" : " (left)"}
                </option>
              ))}
            </select>
            <select className="select select-sm" value={get("assignee")} onChange={(e) => update({ assignee: e.target.value || null })} aria-label="Assignee">
              <option value="">Any assignee</option>
              {people.filter((u) => u.role === "engineer" || u.role === "qa_lead").map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.active ? "" : " (left)"}
                </option>
              ))}
            </select>
            {filtered && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setQ(""); update({ q: null, project: null, module: null, status: null, severity: null, priority: null, reporter: null, assignee: null, tag: null }); }}>
                <X /> Clear filters
              </button>
            )}
          </div>

          <section className="panel">
            <div className="panel-head">
              <div className="row small secondary">
                {data ? (
                  <span>
                    {data.total === 0 ? "No bugs" : `${from}–${to} of ${data.total} bug${data.total === 1 ? "" : "s"}`}
                    {get("tag") && (
                      <span className="chip" style={{ marginLeft: 8 }}>
                        #{get("tag")}
                        <button onClick={() => update({ tag: null })} aria-label="Remove tag filter">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                  </span>
                ) : (
                  <span>Loading…</span>
                )}
                {res.isFetching && data && <span className="spinner" />}
              </div>
              <div className="row">
                <label className="small muted" htmlFor="sort">
                  Sort
                </label>
                <select id="sort" className="select select-sm" value={query.sort} onChange={(e) => update({ sort: e.target.value })}>
                  {SORT_OPTIONS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button className="icon-btn" onClick={() => update({ dir: get("dir") === "asc" ? "desc" : "asc" })} aria-label={get("dir") === "asc" ? "Ascending; switch to descending" : "Descending; switch to ascending"} title="Reverse order">
                  {get("dir") === "asc" ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
                </button>
              </div>
            </div>
            <div className="panel-body flush">
              {!data ? (
                <Loading />
              ) : (
                <BugTable
                  items={data.items}
                  empty={filtered ? "No bugs match these filters" : "Nothing in this view"}
                  emptyHint={filtered ? "Try removing a filter." : view === "mine" ? "Bugs you report or co-report appear here." : undefined}
                />
              )}
            </div>
            {data && data.total > data.page_size && (
              <div className="pager">
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, true)}>
                  Previous
                </button>
                <span className="small muted">
                  Page {page} of {Math.ceil(data.total / data.page_size)}
                </span>
                <button className="btn btn-sm" disabled={to >= data.total} onClick={() => update({ page: String(page + 1) }, true)}>
                  Next
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
