import { useState } from "react";
import { Link } from "react-router";
import { Bot, Link2, Plus, RefreshCcw, Sparkles, X } from "lucide-react";
import type { BugDetail, RegressionChecksResult, SummaryResult } from "../../../core/api";
import { ACTION_DEFS, type ActionKey } from "../../../core/workflow";
import { ROLE_LABELS } from "../../../core/types";
import { useApi, useToast, useWorkspace } from "../../app/context";
import { errorMessage, useMutate, useSimilarForBug } from "../../api/hooks";
import { ActionDialog, buttonClass, useRunAction } from "../../components/ActionDialog";
import { BugPicker } from "../../components/BugPicker";
import { Avatar, Person, StatusPill } from "../../components/badges";
import { Dialog, Field, Panel } from "../../components/ui";
import { dateTime, duration, relativeTime, shortDate } from "../../lib/format";

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const PRIMARY_ORDER: ActionKey[] = ["provide_info", "pass_regression", "start_work", "mark_fixed", "ready_for_regression", "accept_decision", "uphold_decision", "start_review", "close", "restore"];

export function ActionsPanel({ detail }: { detail: BugDetail }) {
  const [open, setOpen] = useState<ActionKey | null>(null);
  const run = useRunAction(detail);
  const actions = detail.actions;
  const primary = PRIMARY_ORDER.find((a) => actions.includes(a));
  const trigger = (a: ActionKey) => {
    if (ACTION_DEFS[a].fields.length === 0) run.mutate({ action: a, input: {}, files: [] });
    else setOpen(a);
  };
  const secondary = actions.filter((a) => a !== primary && a !== "archive" && a !== "force_close" && a !== "restore");
  const danger = actions.filter((a) => a === "archive" || a === "force_close");
  return (
    <Panel title="Actions" hint={actions.length ? undefined : "Nothing for you to do right now"} className={actions.length || detail.hints.length ? "actions-panel" : "actions-panel is-empty"}>
      <div className="stack-sm">
        {primary && (
          <button className={buttonClass(primary, true) + " btn-block"} onClick={() => trigger(primary)} disabled={run.isPending} title={ACTION_DEFS[primary].description}>
            {run.isPending && run.variables?.action === primary && <span className="spinner" />}
            {ACTION_DEFS[primary].label}
          </button>
        )}
        {secondary.length > 0 && (
          <div className="action-grid">
            {secondary.map((a) => (
              <button key={a} className={buttonClass(a) + " btn-sm"} onClick={() => trigger(a)} disabled={run.isPending} title={ACTION_DEFS[a].description}>
                {run.isPending && run.variables?.action === a && <span className="spinner" />}
                {ACTION_DEFS[a].label}
              </button>
            ))}
          </div>
        )}
        {danger.length > 0 && (
          <div className="row-wrap" style={{ marginTop: 4 }}>
            {danger.map((a) => (
              <button key={a} className="btn btn-ghost btn-sm" onClick={() => trigger(a)} title={ACTION_DEFS[a].description}>
                {ACTION_DEFS[a].label}
              </button>
            ))}
          </div>
        )}
        {detail.hints.map((h) => (
          <p key={h} className="small muted">
            {h}
          </p>
        ))}
        {!actions.length && !detail.hints.length && (
          <p className="small muted">You can still comment, add evidence or watch this bug.</p>
        )}
      </div>
      {open && <ActionDialog detail={detail} action={open} onClose={() => setOpen(null)} />}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// People and credit
// ---------------------------------------------------------------------------

export function PeoplePanel({ detail }: { detail: BugDetail }) {
  const { lookup } = useWorkspace();
  const b = detail.bug;
  const perms = detail.permissions;
  const engineers = lookup.peopleWithRoles(["engineer", "admin"]).filter((u) => u.role === "engineer" || u.id === b.assignee_id);
  const qa = lookup.peopleWithRoles(["qa_analyst", "qa_lead"]).filter((u) => u.id !== b.fixed_by_id);
  const assign = useMutate((api, id: string) => api.post(`/bugs/${b.key}/assign`, { assignee_id: id || null }), { success: "Assignment updated" });
  const collab = useMutate((api, ids: string[]) => api.post(`/bugs/${b.key}/collaborators`, { user_ids: ids }), { success: "Collaborators updated" });
  const reassign = useMutate((api, id: string) => api.post(`/bugs/${b.key}/regression/assignee`, { user_id: id }), { success: "Regression reassigned" });
  const pending = detail.regression_runs.find((r) => r.result === "pending");
  const assignee = lookup.user(b.assignee_id);

  return (
    <Panel title="People">
      <dl className="people">
        <div>
          <dt>Reported by</dt>
          <dd>
            <Person userId={b.reporter_id} sub={dateTime(b.created_at)} />
            {detail.co_reporters.length > 0 && (
              <div className="co-reporters">
                <span className="tiny muted">Also reported by</span>
                {detail.co_reporters.map((c) => (
                  <span key={c.id} className="row" style={{ gap: 6 }} title={c.note ?? undefined}>
                    <Avatar userId={c.user_id} size="sm" />
                    <span className="small">{lookup.userName(c.user_id)}</span>
                    <span className="tiny muted">{c.via_bug_id ? "via duplicate" : "seeing it too"}</span>
                  </span>
                ))}
              </div>
            )}
          </dd>
        </div>
        <div>
          <dt>Assigned to</dt>
          <dd>
            {perms.can_assign ? (
              <select className="select select-sm" value={b.assignee_id ?? ""} onChange={(e) => assign.mutate(e.target.value)} aria-label="Assignee">
                <option value="">Unassigned</option>
                {engineers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
                {assignee && !assignee.active && <option value={assignee.id}>{assignee.name} (left)</option>}
              </select>
            ) : (
              <Person userId={b.assignee_id} />
            )}
            {assignee && !assignee.active && <div className="tiny" style={{ color: "var(--danger)" }}>This person has left. Reassign the bug.</div>}
          </dd>
        </div>
        {(b.collaborator_ids.length > 0 || perms.can_assign) && (
          <div>
            <dt>Collaborators</dt>
            <dd>
              <div className="row-wrap">
                {b.collaborator_ids.map((id) => (
                  <span key={id} className="chip">
                    <Avatar userId={id} size="sm" /> {lookup.userName(id)}
                    {perms.can_assign && (
                      <button onClick={() => collab.mutate(b.collaborator_ids.filter((x) => x !== id))} aria-label={`Remove ${lookup.userName(id)}`}>
                        <X />
                      </button>
                    )}
                  </span>
                ))}
                {perms.can_assign && (
                  <select
                    className="select select-sm"
                    style={{ width: "auto" }}
                    value=""
                    onChange={(e) => e.target.value && collab.mutate([...b.collaborator_ids, e.target.value])}
                    aria-label="Add collaborator"
                  >
                    <option value="">Add…</option>
                    {engineers
                      .filter((u) => u.id !== b.assignee_id && !b.collaborator_ids.includes(u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </dd>
          </div>
        )}
        {b.reviewed_by_id && (
          <div>
            <dt>Reviewed by</dt>
            <dd>
              <Person userId={b.reviewed_by_id} sub={b.reviewed_at ? shortDate(b.reviewed_at) : undefined} />
            </dd>
          </div>
        )}
        {b.fixed_by_id && (
          <div>
            <dt>Fixed by</dt>
            <dd>
              <Person userId={b.fixed_by_id} sub={[b.fix_version, b.fixed_at ? shortDate(b.fixed_at) : null].filter(Boolean).join(" · ")} />
            </dd>
          </div>
        )}
        {pending && (
          <div>
            <dt>Regression by</dt>
            <dd>
              {perms.can_reassign_regression ? (
                <select className="select select-sm" value={pending.assignee_id ?? ""} onChange={(e) => e.target.value && reassign.mutate(e.target.value)} aria-label="Regression owner">
                  {!pending.assignee_id && <option value="">Needs an owner</option>}
                  {qa.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Person userId={pending.assignee_id} empty="Needs a QA owner" sub={`Round ${pending.round}`} />
              )}
            </dd>
          </div>
        )}
        {b.verified_by_id && (
          <div>
            <dt>Verified by</dt>
            <dd>
              <Person userId={b.verified_by_id} sub={b.verified_at ? dateTime(b.verified_at) : undefined} />
            </dd>
          </div>
        )}
        {b.closed_at && (
          <div>
            <dt>Closed</dt>
            <dd className="small">
              {dateTime(b.closed_at)}
              {b.closed_by_id ? ` by ${lookup.userName(b.closed_by_id)}` : " automatically"}
            </dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Details (with severity / priority changes)
// ---------------------------------------------------------------------------

export function DetailsPanel({ detail }: { detail: BugDetail }) {
  const { ws, lookup } = useWorkspace();
  const b = detail.bug;
  const perms = detail.permissions;
  const [pending, setPending] = useState<{ field: "severity" | "priority"; value: string } | null>(null);
  const [reason, setReason] = useState("");
  const change = useMutate((api, args: { field: "severity" | "priority"; value: string; reason?: string }) => api.patch(`/bugs/${b.key}`, { [args.field]: args.value, reason: args.reason ?? null }), {
    success: (_r, args) => `${args.field === "severity" ? "Severity" : "Priority"} changed`,
  });
  const request = (field: "severity" | "priority", value: string) => {
    const rule = perms[field];
    if (rule.reasonRequired) {
      setReason("");
      setPending({ field, value });
    } else change.mutate({ field, value });
  };
  const project = lookup.project(b.project_id);
  const mod = lookup.module(b.module_id);
  const feature = lookup.feature(b.feature_id);
  const cfg = lookup.status(b.status);
  return (
    <Panel title="Details">
      <dl className="details">
        <div>
          <dt>Project</dt>
          <dd>{project?.name}</dd>
        </div>
        <div>
          <dt>Module</dt>
          <dd>
            {mod?.name}
            {feature && <span className="muted"> › {feature.name}</span>}
            {b.affected_module_ids.length > 0 && (
              <div className="tiny muted">Also affects: {b.affected_module_ids.map((id) => lookup.module(id)?.name).filter(Boolean).join(", ")}</div>
            )}
          </dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd>
            {perms.severity.allowed ? (
              <select className="select select-sm" value={b.severity} onChange={(e) => request("severity", e.target.value)} aria-label="Severity">
                {ws.severities.filter((s) => s.active || s.key === b.severity).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            ) : (
              lookup.severity(b.severity)?.label
            )}
          </dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>
            {perms.priority.allowed ? (
              <select className="select select-sm" value={b.priority} onChange={(e) => request("priority", e.target.value)} aria-label="Priority">
                {ws.priorities.filter((s) => s.active || s.key === b.priority).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            ) : (
              lookup.priority(b.priority)?.label
            )}
          </dd>
        </div>
        <div>
          <dt>Time in {cfg.label}</dt>
          <dd className={detail.overdue ? "overdue-text" : ""}>
            {duration(detail.hours_in_status)}
            {detail.overdue && cfg.attention_hours && <span className="tiny"> · over the {duration(cfg.attention_hours)} attention time</span>}
          </dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd>{relativeTime(b.last_activity_at)}</dd>
        </div>
        {b.tags.length > 0 && (
          <div>
            <dt>Tags</dt>
            <dd className="row-wrap">
              {b.tags.map((t) => (
                <Link key={t} to={`/bugs?view=all&tag=${encodeURIComponent(t)}`} className="tag">
                  {t}
                </Link>
              ))}
            </dd>
          </div>
        )}
      </dl>
      {pending && (
        <Dialog
          title={`Change ${pending.field} to ${pending.field === "severity" ? lookup.severity(pending.value)?.label : lookup.priority(pending.value)?.label}`}
          description={
            pending.field === "severity"
              ? "Severity is the reporter's assessment of impact. Explain the change: the reporter is notified."
              : "This bug is already resolved, so priority changes need a reason."
          }
          onClose={() => setPending(null)}
          footer={
            <>
              <button className="btn" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!reason.trim() || change.isPending}
                onClick={() => change.mutate({ ...pending, reason }, { onSuccess: () => setPending(null) })}
              >
                Change {pending.field}
              </button>
            </>
          }
        >
          <Field label="Reason" required htmlFor="change-reason">
            <textarea id="change-reason" className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="A workaround exists through bulk edit." />
          </Field>
        </Dialog>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Regression rounds and AI-suggested checks
// ---------------------------------------------------------------------------

export function RegressionPanel({ detail }: { detail: BugDetail }) {
  const { lookup } = useWorkspace();
  const api = useApi();
  const toast = useToast();
  const runs = detail.regression_runs;
  const [checks, setChecks] = useState<RegressionChecksResult | null>(null);
  const [loading, setLoading] = useState(false);
  const canTest = detail.actions.includes("pass_regression");
  if (!runs.length) return null;
  const suggest = async (offline = false) => {
    setLoading(true);
    try {
      setChecks(await api.post<RegressionChecksResult>(`/bugs/${detail.bug.key}/ai/regression-checks${offline ? "?offline=1" : ""}`));
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Panel title="Regression" hint={`${runs.length} round${runs.length === 1 ? "" : "s"}`}>
      <ol className="rounds">
        {[...runs].reverse().map((r) => (
          <li key={r.id} className={`round ${r.result}`}>
            <div className="row-between">
              <strong>Round {r.round}</strong>
              <span className={`round-result ${r.result}`}>{r.result === "pending" ? (r.started_at ? "Testing" : "Waiting") : r.result === "passed" ? "Passed" : r.result === "failed" ? "Failed" : "Cancelled"}</span>
            </div>
            <div className="small secondary">
              {r.completed_by_id ? lookup.userName(r.completed_by_id) : r.assignee_id ? lookup.userName(r.assignee_id) : "No QA owner yet"}
              {r.build && <span className="mono"> · {r.build}</span>}
              {lookup.environment(r.environment_id) && <span> · {lookup.environment(r.environment_id)?.name}</span>}
            </div>
            <div className="tiny muted">{r.completed_at ? `Finished ${dateTime(r.completed_at)}` : `Requested ${relativeTime(r.requested_at)}`}</div>
            {r.notes && <div className="small round-notes">{r.notes}</div>}
          </li>
        ))}
      </ol>
      {canTest && (
        <div className="stack-sm" style={{ marginTop: 12 }}>
          {!checks && (
            <button className="btn btn-sm" onClick={() => suggest(false)} disabled={loading}>
              {loading ? <span className="spinner" /> : <Sparkles />} Suggest regression checks
            </button>
          )}
          {checks && (
            <div className="ai-card">
              <div className="row-between">
                <span className="row small" style={{ gap: 6 }}>
                  <Bot size={14} /> Suggested checks · {checks.provider === "offline" ? "offline assistant" : "AI"}
                </span>
                <button className="icon-btn" onClick={() => setChecks(null)} aria-label="Dismiss suggestions">
                  <X size={14} />
                </button>
              </div>
              <ol className="checks">
                {checks.checks.map((c, i) => (
                  <li key={i}>
                    <strong>{c.title}</strong>
                    <ul>
                      {c.steps.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ul>
                    <span className="tiny muted">{c.why}</span>
                  </li>
                ))}
              </ol>
              <span className="tiny muted">Suggestions only. You decide what to test.</span>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Links, duplicates and similar bugs
// ---------------------------------------------------------------------------

export function LinksPanel({ detail }: { detail: BugDetail }) {
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState("");
  const b = detail.bug;
  const add = useMutate((api, key: string) => api.post(`/bugs/${b.key}/links`, { target: key }), { success: "Bugs linked" });
  const remove = useMutate((api, id: string) => api.delete(`/bugs/${b.key}/links/${id}`), { success: "Link removed" });
  const related = detail.links.filter((l) => l.kind === "related");
  const empty = !detail.duplicate_of && !detail.duplicates.length && !related.length && !detail.potential_duplicates.length;
  return (
    <Panel
      title="Linked bugs"
      actions={
        detail.permissions.can_link && !adding ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            <Link2 /> Link
          </button>
        ) : null
      }
    >
      <div className="stack-sm">
        {detail.duplicate_of && (
          <LinkedRow label="Duplicate of" bug={detail.duplicate_of} />
        )}
        {detail.duplicates.map((d) => (
          <LinkedRow key={d.id} label="Duplicate report" bug={d} />
        ))}
        {detail.potential_duplicates.map((d) => (
          <LinkedRow key={d.id} label="Possible duplicate of" bug={d} />
        ))}
        {related.map((l) => (
          <LinkedRow key={l.id} label="Related" bug={l.bug} onRemove={detail.permissions.can_link ? () => remove.mutate(l.id) : undefined} />
        ))}
        {empty && !adding && <p className="small muted">No linked bugs.</p>}
        {adding && (
          <div className="stack-sm">
            <BugPicker value={target} onPick={setTarget} excludeId={b.id} />
            <div className="row">
              <button className="btn btn-primary btn-sm" disabled={!target || add.isPending} onClick={() => add.mutate(target, { onSuccess: () => { setAdding(false); setTarget(""); } })}>
                <Plus /> Link bug
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function LinkedRow({ label, bug, onRemove }: { label: string; bug: import("../../../core/types").BugRef; onRemove?: () => void }) {
  return (
    <div className="linked">
      <span className="tiny muted">{label}</span>
      <div className="row" style={{ gap: 8 }}>
        <Link to={`/bugs/${bug.key}`} className="mono small">
          {bug.key}
        </Link>
        <StatusPill status={bug.status} size="sm" />
        {onRemove && (
          <button className="icon-btn" style={{ width: 24, height: 24, marginLeft: "auto" }} onClick={onRemove} aria-label={`Unlink ${bug.key}`}>
            <X size={14} />
          </button>
        )}
      </div>
      <div className="small truncate" title={bug.title}>
        {bug.title}
      </div>
    </div>
  );
}

export function SimilarPanel({ detail }: { detail: BugDetail }) {
  const similar = useSimilarForBug(detail.bug.key);
  const items = (similar.data?.items ?? []).filter((s) => s.bug.id !== detail.duplicate_of?.id && !detail.duplicates.some((d) => d.id === s.bug.id));
  if (!items.length) return null;
  return (
    <Panel title="Similar bugs">
      <div className="stack-sm">
        <p className="tiny muted">Matched by wording, module and symptom. Suggestions only.</p>
        {items.slice(0, 4).map((s) => (
          <Link key={s.bug.id} to={`/bugs/${s.bug.key}`} className="similar-row">
            <span className={`sim-level ${s.level}`}>{s.level}</span>
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="row-wrap" style={{ gap: 4 }}>
                <span className="mono tiny muted nowrap">{s.bug.key}</span>
                <StatusPill status={s.bug.status} size="sm" />
              </span>
              <span className="small clamp-2" style={{ marginTop: 2 }}>
                {s.bug.title}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// AI activity summary
// ---------------------------------------------------------------------------

export function SummaryPanel({ detail }: { detail: BugDetail }) {
  const api = useApi();
  const toast = useToast();
  const { ws } = useWorkspace();
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async (offline = false) => {
    setLoading(true);
    setFailed(false);
    try {
      setSummary(await api.post<SummaryResult>(`/bugs/${detail.bug.key}/ai/summary${offline ? "?offline=1" : ""}`));
    } catch (err) {
      setFailed(true);
      toast(errorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Panel title="Catch up" hint={summary ? undefined : "Summarize the history"}>
      {!summary ? (
        <div className="stack-sm">
          <p className="small muted">Get a short summary of what happened, who is waiting and what's next.</p>
          <div className="row-wrap">
            <button className="btn btn-sm" onClick={() => run(false)} disabled={loading}>
              {loading ? <span className="spinner" /> : <Sparkles />} Summarize activity
            </button>
            {failed && ws.ai.provider !== "offline" && (
              <button className="btn btn-ghost btn-sm" onClick={() => run(true)}>
                <RefreshCcw /> Use offline summary
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="ai-card">
          <div className="row-between">
            <span className="row small" style={{ gap: 6 }}>
              <Bot size={14} /> {summary.provider === "offline" ? "Offline summary" : "AI summary"}
            </span>
            <button className="icon-btn" onClick={() => setSummary(null)} aria-label="Dismiss summary">
              <X size={14} />
            </button>
          </div>
          <p className="small">{summary.summary}</p>
          <p className="small">
            <strong>Now:</strong> {summary.current_state}
          </p>
          {summary.open_questions.length > 0 && (
            <div className="small">
              <strong>Open questions</strong>
              <ul>
                {summary.open_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="small">
            <strong>Next:</strong> {summary.next_step}
          </p>
          <span className="tiny muted">Generated from this bug's timeline. Check details before acting.</span>
        </div>
      )}
    </Panel>
  );
}

export function roleLabel(role: keyof typeof ROLE_LABELS) {
  return ROLE_LABELS[role];
}
