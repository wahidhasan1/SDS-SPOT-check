// Improvement suggestions: an easy form (the assistant polishes rough English), a single list,
// and a focused page where the project manager approves or closes and the engineer builds it.

import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Bug, Check, CheckCircle2, ChevronRight, CircleAlert, Hammer, Lightbulb, Pencil, Plus, RotateCcw, Scale, Send, Sparkles, XCircle } from "lucide-react";
import type { ImprovementDetail, PolishResult } from "../../core/api";
import { IMPROVEMENT_STATUS_LABELS, IMPROVEMENT_STATUSES, type ImprovementStatus } from "../../core/types";
import { useToast, useWorkspace } from "../app/context";
import { errorMessage, useImprovement, useImprovements, useMutate } from "../api/hooks";
import { Person } from "../components/badges";
import { ProjectSelect } from "../components/filters";
import { Empty, Field, Loading, cx, useDebounced } from "../components/ui";
import { dateTime, relativeTime } from "../lib/format";
import { ReportBugPage } from "./ReportBug";

const TONE: Record<ImprovementStatus, string> = {
  proposed: "tone-amber",
  approved: "tone-blue",
  in_progress: "tone-indigo",
  done: "tone-green",
  declined: "tone-slate",
};

export function ImprovementPill({ status, size }: { status: ImprovementStatus; size?: "sm" | "lg" }) {
  return (
    <span className={cx("pill", TONE[status], size)}>
      <span className="dot" aria-hidden />
      {IMPROVEMENT_STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// New report: a bug or an improvement
// ---------------------------------------------------------------------------

export function NewReportPage() {
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind") === "improvement" ? "improvement" : "bug";
  const pick = (k: "bug" | "improvement") => setParams(k === "bug" ? {} : { kind: k }, { replace: true });
  return (
    <div className="stack-lg">
      <div className="kind-switch" role="radiogroup" aria-label="What are you reporting?">
        <button role="radio" aria-checked={kind === "bug"} className={cx("kind-card", kind === "bug" && "on")} onClick={() => pick("bug")}>
          <span className="kind-icon bug"><Bug /></span>
          <span>
            <span className="kind-title">Report a bug</span>
            <span className="kind-sub">Something is broken or doesn't work as it should</span>
          </span>
        </button>
        <button role="radio" aria-checked={kind === "improvement"} className={cx("kind-card", kind === "improvement" && "on")} onClick={() => pick("improvement")}>
          <span className="kind-icon idea"><Lightbulb /></span>
          <span>
            <span className="kind-title">Suggest an improvement</span>
            <span className="kind-sub">Something works, but could be easier, clearer or nicer</span>
          </span>
        </button>
      </div>
      {kind === "bug" ? <ReportBugPage /> : <ImprovementForm />}
    </div>
  );
}

function ImprovementForm() {
  const { ws, lookup } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const active = ws.projects.filter((p) => !p.archived);
  const [projectId, setProjectId] = useState((active.find((p) => p.id === ws.recent_project_id) ?? active[0])?.id ?? "");
  const [moduleId, setModuleId] = useState("");
  const [text, setText] = useState("");
  const [polished, setPolished] = useState<PolishResult | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const project = lookup.project(projectId);
  const reviewer = project?.pm_id ? lookup.userName(project.pm_id) : "the project manager";

  const polish = useMutate(
    (api, offline: boolean) => api.post<PolishResult>("/ai/polish-improvement", { project_id: projectId, module_id: moduleId || null, text, offline }),
    { silentError: true },
  );
  const send = useMutate((api, args: { title: string; body: string; polished_by: string | null; module_id: string | null }) =>
    api.post<ImprovementDetail>("/improvements", { project_id: projectId, original_text: text, ...args }),
  );

  const runPolish = (offline = false) =>
    polish.mutate(offline, {
      onSuccess: (r) => {
        setPolished(r);
        setTitle(r.title);
        setBody(r.body);
        if (!moduleId && r.module_id) setModuleId(r.module_id);
      },
    });
  const submit = (asWritten: boolean) =>
    send.mutate(
      asWritten
        ? { title: "", body: text, polished_by: null, module_id: moduleId || null }
        : { title, body, polished_by: polished?.provider ?? null, module_id: moduleId || null },
      {
        onSuccess: (r) => {
          toast(`Sent to ${reviewer} for review`);
          navigate(`/improvements/${r.improvement.key}`);
        },
      },
    );

  const aiLabel = polished?.provider === "offline" ? "Formatted by the assistant" : "Drafted by the assistant";

  return (
    <div className="improve-grid">
      <section className="panel improve-form">
        <div className="panel-body stack-lg">
          <div className="grid-2">
            <Field label="Project" htmlFor="imp-project">
              <select id="imp-project" className="select" value={projectId} onChange={(e) => { setProjectId(e.target.value); setModuleId(""); }}>
                {active.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Module (optional)" htmlFor="imp-module">
              <select id="imp-module" className="select" value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
                <option value="">Let the assistant work it out</option>
                {lookup.modulesOf(projectId).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
          </div>

          {!polished ? (
            <>
              <Field label="Your idea" htmlFor="imp-text" help="Quick notes are enough: where it is, what could be better and how. The assistant turns them into a structured proposal for the project manager.">
                <textarea
                  id="imp-text"
                  className="textarea imp-text"
                  rows={7}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="For example: contact list, filters reset after opening a contact and going back, keep them"
                />
              </Field>
              {polish.error && (
                <div className="callout danger">
                  <CircleAlert />
                  <div>{errorMessage(polish.error)}</div>
                </div>
              )}
              <div className="row-between">
                <button className="link-btn small" disabled={!text.trim() || send.isPending} onClick={() => submit(true)}>
                  Send as written
                </button>
                <button className="btn btn-primary btn-lg" disabled={!text.trim() || !projectId || polish.isPending} onClick={() => runPolish(false)}>
                  {polish.isPending ? <span className="spinner" /> : <Sparkles />} Prepare proposal
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="polished-head">
                <span className="chip ai"><Sparkles /> {aiLabel}</span>
                <span className="small muted">Review the proposal and adjust anything before sending.</span>
              </div>
              {polished.note && (
                <div className="callout warning">
                  <CircleAlert />
                  <div className="small">{polished.note}</div>
                </div>
              )}
              <Field label="Title" htmlFor="imp-title">
                <input id="imp-title" className="input imp-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field label={`What ${reviewer} will read`} htmlFor="imp-body">
                <textarea id="imp-body" className="textarea imp-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
              <details className="fold">
                <summary>
                  <ChevronRight className="fold-chevron" size={15} aria-hidden />
                  <span className="fold-title">Your notes</span>
                  <span className="fold-meta">kept with the suggestion</span>
                </summary>
                <div className="fold-body">
                  <p className="original-text">{text}</p>
                </div>
              </details>
              <div className="row-between">
                <div className="row-wrap">
                  <button className="btn btn-ghost btn-sm" onClick={() => setPolished(null)}>
                    <Pencil /> Edit notes
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={polish.isPending} onClick={() => runPolish(false)}>
                    <RotateCcw /> Regenerate
                  </button>
                </div>
                <button className="btn btn-primary btn-lg" disabled={!body.trim() || send.isPending} onClick={() => submit(false)}>
                  {send.isPending ? <span className="spinner" /> : <Send />} Send to {reviewer}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
      <aside className="panel improve-how">
        <div className="panel-body stack">
          <h2>What happens next</h2>
          <ol className="how-steps">
            <li><span>1</span><div><strong>{reviewer}</strong> reads your suggestion and approves it or closes it with a reason.</div></li>
            <li><span>2</span><div>If approved, it goes to an engineer's list of improvements to build.</div></li>
            <li><span>3</span><div>You're told when it's approved, closed or done.</div></li>
          </ol>
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function ImprovementsPage() {
  const { ws, lookup } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? "";
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const [q, setQ] = useState(get("q"));
  const debounced = useDebounced(q, 250);
  const res = useImprovements({ status: get("status") || undefined, project: get("project") || undefined, mine: get("mine") || undefined, q: debounced || undefined });
  const items = res.data?.items ?? [];
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Improvements</h1>
          <p className="sub">Suggestions to make the products better. The project manager decides; engineering builds.</p>
        </div>
        {ws.capabilities.report && (
          <Link to="/bugs/new?kind=improvement" className="btn btn-primary">
            <Plus /> Suggest an improvement
          </Link>
        )}
      </div>
      <div className="filter-bar">
        <div className="search-input" style={{ flex: "1 1 220px", maxWidth: 320 }}>
          <input className="input input-sm" placeholder="Filter by text or ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter improvements" />
        </div>
        <select className="select select-sm" value={get("status")} onChange={(e) => set("status", e.target.value)} aria-label="State">
          <option value="">Any state</option>
          {IMPROVEMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{IMPROVEMENT_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <ProjectSelect value={get("project")} onChange={(v) => set("project", v)} />
        <label className="checkbox small">
          <input type="checkbox" checked={get("mine") === "1"} onChange={(e) => set("mine", e.target.checked ? "1" : "")} /> Only mine
        </label>
      </div>
      <section className="panel">
        <div className="panel-body flush">
          {!res.data ? (
            <Loading />
          ) : items.length === 0 ? (
            <Empty icon={<Lightbulb />} title="No suggestions here yet">
              Suggest an improvement from the New report button.
            </Empty>
          ) : (
            <div className="list">
              {items.map((i) => (
                <Link key={i.id} to={`/improvements/${i.key}`} className="list-row imp-row">
                  <span className="imp-bulb"><Lightbulb size={16} /></span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="row-wrap" style={{ gap: 8 }}>
                      <span className="mono tiny muted">{i.key}</span>
                      <ImprovementPill status={i.status} size="sm" />
                      <span className="tiny muted">
                        {lookup.project(i.project_id)?.name}
                        {i.module_id ? ` › ${lookup.module(i.module_id)?.name}` : ""}
                      </span>
                    </span>
                    <span className="imp-title">{i.title}</span>
                    <span className="small muted clamp-1">{i.body}</span>
                  </span>
                  <span className="imp-side">
                    <span className="tiny muted">by {lookup.userName(i.reporter_id)}</span>
                    {i.assignee_id && <span className="tiny muted">→ {lookup.userName(i.assignee_id)}</span>}
                    <span className="tiny muted">{relativeTime(i.updated_at)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail: the decision or the work first, then the suggestion
// ---------------------------------------------------------------------------

export function ImprovementDetailPage() {
  const { ref } = useParams();
  const q = useImprovement(ref);
  const navigate = useNavigate();
  if (q.isLoading) return <Loading label="Loading suggestion…" />;
  if (!q.data) {
    return (
      <section className="panel">
        <Empty icon={<CircleAlert />} title={errorMessage(q.error)}>
          <button className="btn btn-sm" onClick={() => navigate("/improvements")}>Back to improvements</button>
        </Empty>
      </section>
    );
  }
  return <ImprovementView detail={q.data} />;
}

function ImprovementView({ detail }: { detail: ImprovementDetail }) {
  const { lookup } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const i = detail.improvement;
  return (
    <div className="bug-page focus">
      <div className="bug-head">
        <div className="row-wrap bug-crumbs" style={{ gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => (location.key !== "default" ? navigate(-1) : navigate("/improvements"))}>
            <ArrowLeft /> Back
          </button>
          <span className="muted">/</span>
          <span className="bug-key">{i.key}</span>
          <span className="muted small">
            {lookup.project(i.project_id)?.name}
            {i.module_id ? ` › ${lookup.module(i.module_id)?.name}` : ""}
          </span>
        </div>
        <div className="bug-head-row">
          <h1 className="bug-title"><span className="title-kind"><Lightbulb /></span>{i.title}</h1>
        </div>
        <div className="row-wrap bug-badges">
          <ImprovementPill status={i.status} size="lg" />
          {detail.waiting_on !== "Nobody" && (
            <>
              <span className="sep" aria-hidden />
              <span className="small muted">Waiting on</span>
              <span className="small">{detail.waiting_on}</span>
            </>
          )}
        </div>
      </div>

      <div className="task-area">
        <ImprovementTask detail={detail} />
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>The suggestion</h2>
          {i.polished_by && (
            <span className="chip ai" title="The reporter checked the rewritten text before sending it">
              <Sparkles /> Prepared with the assistant, reviewed by the reporter
            </span>
          )}
        </div>
        <div className="panel-body stack">
          <p className="suggestion-text">{i.body}</p>
          <div className="row-wrap small muted">
            <Person userId={i.reporter_id} sub={`Suggested ${dateTime(i.created_at)}`} />
          </div>
        </div>
      </section>

      <section className="more" aria-label="More about this suggestion">
        <h2 className="more-title">More</h2>
        {i.polished_by && i.original_text !== i.body && (
          <SimpleFold title="Original notes">
            <p className="original-text">{i.original_text}</p>
          </SimpleFold>
        )}
        <SimpleFold title="History" meta={`${detail.events.length} event${detail.events.length === 1 ? "" : "s"}`}>
          <ol className="imp-history">
            {detail.events.map((e) => (
              <li key={e.id}>
                <span className="tiny muted nowrap">{dateTime(e.created_at)}</span>
                <span>{describe(e, lookup.userName)}</span>
              </li>
            ))}
          </ol>
        </SimpleFold>
      </section>
    </div>
  );
}

function describe(e: ImprovementDetail["events"][number], name: (id: string | null | undefined) => string): string {
  const d = e.data as { note?: string | null; reason?: string; assignee_id?: string };
  const who = name(e.actor_id);
  switch (e.type) {
    case "improvement.created":
      return `${who} suggested it.`;
    case "improvement.approved":
      return `${who} approved it and assigned it to ${name(d.assignee_id)}.${d.note ? ` “${d.note}”` : ""}`;
    case "improvement.declined":
      return `${who} closed it. “${d.reason ?? ""}”`;
    case "improvement.started":
      return `${who} started work.`;
    case "improvement.done":
      return `${who} marked it done.${d.note ? ` “${d.note}”` : ""}`;
    default:
      return `${who}: ${e.type}`;
  }
}

function SimpleFold({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <details className="fold">
      <summary>
        <ChevronRight className="fold-chevron" size={15} aria-hidden />
        <span className="fold-title">{title}</span>
        {meta && <span className="fold-meta">{meta}</span>}
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

function ImprovementTask({ detail }: { detail: ImprovementDetail }) {
  const { lookup, ws } = useWorkspace();
  const i = detail.improvement;
  const can = detail.can;
  const owner = i.module_id ? lookup.module(i.module_id)?.owner_id ?? "" : "";
  const engineers = useMemo(() => lookup.peopleWithRoles(["engineer"]).filter((u) => u.active), [lookup]);
  const [assignee, setAssignee] = useState(owner);
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [doneNote, setDoneNote] = useState("");
  const act = useMutate((api, args: { path: string; body?: Record<string, unknown> }) => api.post<ImprovementDetail>(`/improvements/${i.key}/${args.path}`, args.body ?? {}), {
    success: (_r, a) =>
      a.path === "approve" ? `Approved and sent to ${lookup.userName(String(a.body?.assignee_id ?? ""))}` : a.path === "decline" ? "Suggestion closed" : a.path === "start" ? "Started" : "Marked done",
  });

  if (can.approve) {
    return (
      <div className="callout warning">
        <Scale />
        <div className="grow stack-sm">
          <div className="title">Your decision: approve it or close it</div>
          <div className="small secondary">{lookup.userName(i.reporter_id)} suggested this {relativeTime(i.created_at)}. Read it below.</div>
          {!closing ? (
            <div className="inline-action stack">
              <div className="grid-2">
                <Field label="Engineer who builds it" htmlFor="imp-assignee">
                  <select id="imp-assignee" className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                    <option value="">Choose…</option>
                    {engineers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                        {u.id === owner ? " (module owner)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Note for the engineer (optional)" htmlFor="imp-note">
                  <input id="imp-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: keep it for the next release" />
                </Field>
              </div>
              <div className="row-wrap">
                <button className="btn btn-positive" disabled={!assignee || act.isPending} onClick={() => act.mutate({ path: "approve", body: { assignee_id: assignee, note } })}>
                  <Check /> Approve and send to engineer
                </button>
                <button className="btn btn-ghost" onClick={() => setClosing(true)}>
                  <XCircle /> Close as not needed
                </button>
              </div>
            </div>
          ) : (
            <div className="inline-action stack">
              <Field label="Why close it?" required htmlFor="imp-reason" help={`${lookup.userName(i.reporter_id)} sees this reason.`}>
                <textarea id="imp-reason" className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <div className="row-wrap">
                <button className="btn btn-danger solid" disabled={!reason.trim() || act.isPending} onClick={() => act.mutate({ path: "decline", body: { reason } })}>
                  Close suggestion
                </button>
                <button className="btn" onClick={() => setClosing(false)}>Back</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (can.start || can.done) {
    return (
      <div className="callout info">
        <Hammer />
        <div className="grow stack-sm">
          <div className="title">{i.status === "approved" ? "Approved for you to build" : "You're building this"}</div>
          <div className="small secondary">
            Approved by {lookup.userName(i.decided_by_id)}
            {i.decided_at ? ` ${relativeTime(i.decided_at)}` : ""}.
          </div>
          {i.decision_note && <div className="quote">“{i.decision_note}”</div>}
          {!finishing ? (
            <div className="row-wrap" style={{ marginTop: 6 }}>
              {can.start && (
                <button className="btn btn-primary btn-sm" disabled={act.isPending} onClick={() => act.mutate({ path: "start" })}>
                  Start work
                </button>
              )}
              <button className={cx("btn btn-sm", can.start ? "" : "btn-positive")} onClick={() => setFinishing(true)}>
                <CheckCircle2 /> Mark done
              </button>
            </div>
          ) : (
            <div className="inline-action stack">
              <Field label="What changed? (optional)" htmlFor="imp-done">
                <input id="imp-done" className="input" value={doneNote} onChange={(e) => setDoneNote(e.target.value)} placeholder="For example: released in 4.15" />
              </Field>
              <div className="row-wrap">
                <button className="btn btn-positive" disabled={act.isPending} onClick={() => act.mutate({ path: "done", body: { note: doneNote } })}>
                  <Check /> Mark done
                </button>
                <button className="btn" onClick={() => setFinishing(false)}>Back</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (i.status === "declined") {
    return (
      <div className="callout">
        <XCircle />
        <div>
          <div className="title">Closed by {lookup.userName(i.decided_by_id)}</div>
          {i.decision_note && <div className="quote">“{i.decision_note}”</div>}
        </div>
      </div>
    );
  }
  if (i.status === "done") {
    return (
      <div className="callout positive">
        <CheckCircle2 />
        <div>
          <div className="title">Done by {lookup.userName(i.done_by_id)}{i.done_at ? ` ${relativeTime(i.done_at)}` : ""}</div>
          {i.done_note && <div className="quote">“{i.done_note}”</div>}
        </div>
      </div>
    );
  }
  const who = i.status === "proposed" ? detail.waiting_on : lookup.userName(i.assignee_id);
  return (
    <div className="callout">
      <Lightbulb />
      <div>
        <div className="title">{i.status === "proposed" ? `Waiting for a decision from ${who.replace(/^Project manager \(|\)$/g, "")}` : `${who} is building it`}</div>
        {i.reporter_id === ws.me.id && <div className="small secondary">You'll be told when it's approved, closed or done.</div>}
      </div>
    </div>
  );
}
