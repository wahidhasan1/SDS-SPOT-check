import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Plus, X } from "lucide-react";
import { STATUS_KEYS } from "../../core/types";
import { SORT_OPTIONS, type BugViewKey } from "../../core/views";
import { OPEN_STATUSES } from "../../core/statuses";
import { useWorkspace } from "../app/context";
import { useBugs } from "../api/hooks";
import { BugTable } from "../components/BugTable";
import { MultiSelect, ProjectSelect } from "../components/filters";
import { Loading, useDebounced } from "../components/ui";

/** For My bugs and Assigned to me, the state filter narrows by status on top of the scope. */
const STATE_STATUSES: Record<string, string[]> = {
  open: OPEN_STATUSES.filter((s) => s !== "deferred"),
  resolved: ["closed", "verified", "not_a_bug", "duplicate"],
  deferred: ["deferred"],
};

type Scope = "all" | "mine" | "assigned";

const STATES = [
  { value: "", label: "Any state" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "deferred", label: "Deferred" },
] as const;

const SCOPES: Record<Scope, { title: string; sub: string; empty: string }> = {
  all: { title: "Bugs", sub: "Every bug. Use the filters to narrow it down.", empty: "No bugs yet" },
  mine: { title: "My bugs", sub: "Bugs you reported.", empty: "You haven't reported any bugs yet" },
  assigned: { title: "Assigned to me", sub: "Bugs you own or collaborate on.", empty: "Nothing is assigned to you" },
};

const PAGE_SIZE = 50;

export function BugsPage({ scope = "all" }: { scope?: Scope }) {
  const { ws, lookup } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const text = SCOPES[scope];

  const get = (k: string) => params.get(k) ?? "";
  const getList = (k: string) => (params.get(k) ? params.get(k)!.split(",").filter(Boolean) : []);
  const update = (patch: Record<string, string | string[] | null>, keepPage = false) => {
    const next = new URLSearchParams(params);
    next.delete("view");
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

  // Older links used ?view=open|resolved|deferred; read them as the state filter.
  const legacy = get("view");
  const state = get("state") || (["open", "resolved", "deferred"].includes(legacy) ? legacy : "");
  const project = get("project");
  const page = Number(get("page") || 1);
  const query = {
    view: (scope === "all" ? state || "all" : scope) as BugViewKey,
    q: get("q") || undefined,
    project: project || undefined,
    module: get("module") || undefined,
    status: scope === "all" || !state ? getList("status") : getList("status").length ? getList("status") : STATE_STATUSES[state],
    severity: getList("severity"),
    priority: getList("priority"),
    reporter: get("reporter") || undefined,
    assignee: get("assignee") || undefined,
    tag: get("tag") || undefined,
    sort: get("sort") || "updated",
    dir: get("dir") || undefined,
    page,
    page_size: PAGE_SIZE,
  };
  const res = useBugs(query);
  const data = res.data;

  const modules = project ? lookup.modulesOf(project) : ws.modules.filter((m) => !m.archived);
  const people = useMemo(() => [...ws.users].sort((a, b) => a.name.localeCompare(b.name)), [ws.users]);
  const filtered = ["q", "project", "module", "state", "status", "severity", "priority", "reporter", "assignee", "tag"].some((k) => params.get(k));

  const from = data ? (data.page - 1) * data.page_size + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.page_size) : 0;

  return (
    <div className="bugs-page">
      <div className="page-head">
        <div>
          <h1>{text.title}</h1>
          <p className="sub">{text.sub}</p>
        </div>
        {ws.capabilities.report && (
          <Link to="/bugs/new" className="btn btn-primary">
            <Plus /> Report bug
          </Link>
        )}
      </div>

      <div className="stack" style={{ minWidth: 0 }}>
          <div className="filter-bar">
            <div className="search-input" style={{ flex: "1 1 220px", maxWidth: 340 }}>
              <input className="input input-sm" placeholder="Filter by text, ID or person" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter bugs" />
            </div>
            <select className="select select-sm" value={state} onChange={(e) => update({ state: e.target.value || null })} aria-label="State">
              {STATES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
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
            {scope !== "mine" && (
            <select className="select select-sm" value={get("reporter")} onChange={(e) => update({ reporter: e.target.value || null })} aria-label="Reporter">
              <option value="">Any reporter</option>
              {people.filter((u) => u.role === "qa_analyst" || u.role === "qa_lead").map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.active ? "" : " (left)"}
                </option>
              ))}
            </select>
            )}
            {scope !== "assigned" && (
            <select className="select select-sm" value={get("assignee")} onChange={(e) => update({ assignee: e.target.value || null })} aria-label="Assignee">
              <option value="">Any assignee</option>
              {people.filter((u) => u.role === "engineer" || u.role === "qa_lead").map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.active ? "" : " (left)"}
                </option>
              ))}
            </select>
            )}
            {filtered && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setQ(""); update({ q: null, project: null, module: null, state: null, status: null, severity: null, priority: null, reporter: null, assignee: null, tag: null }); }}>
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
                  empty={filtered ? "No bugs match these filters" : text.empty}
                  emptyHint={filtered ? "Try removing a filter." : undefined}
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
  );
}
