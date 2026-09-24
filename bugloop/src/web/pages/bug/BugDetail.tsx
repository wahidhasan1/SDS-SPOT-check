import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Bell, BellOff, CircleAlert, Copy, Eye, FilePenLine, Info, MessageCircleQuestion, Scale, ShieldAlert, Sparkles, UserPlus } from "lucide-react";
import type { BugDetail as Detail } from "../../../core/api";
import { FREQUENCIES, FREQUENCY_LABELS, REJECTION_CATEGORY_LABELS, type RejectionCategory } from "../../../core/types";
import { ACTION_DEFS, type ActionKey } from "../../../core/workflow";
import type { ReportField } from "../../../core/permissions";
import { useToast, useWorkspace } from "../../app/context";
import { errorMessage, useBug, useMutate } from "../../api/hooks";
import { ActionDialog, buttonClass, useRunAction } from "../../components/ActionDialog";
import { FileDrop } from "../../components/Attachments";
import { LifecycleTrack } from "../../components/LifecycleTrack";
import { PriorityGlyph, SeverityBadge, StatusPill, WaitingOnChip } from "../../components/badges";
import { Activity } from "../../components/Timeline";
import { Dialog, Field, Loading, cx } from "../../components/ui";
import { shortDate } from "../../lib/format";
import { ReportCard } from "./ReportCard";
import { ActionsPanel, DetailsPanel, LinksPanel, PeoplePanel, RegressionPanel, SimilarPanel, SummaryPanel } from "./Panels";

export function BugDetailPage() {
  const { ref } = useParams();
  const q = useBug(ref);
  const navigate = useNavigate();
  if (q.isLoading) return <Loading label="Loading bug…" />;
  if (q.error || !q.data) {
    return (
      <div className="panel" style={{ padding: 28 }}>
        <div className="empty">
          <CircleAlert />
          <div className="title">{errorMessage(q.error)}</div>
          <button className="btn" onClick={() => navigate("/bugs")}>
            Back to bugs
          </button>
        </div>
      </div>
    );
  }
  return <BugView detail={q.data} />;
}

function BugView({ detail }: { detail: Detail }) {
  const b = detail.bug;
  const toast = useToast();
  const { lookup } = useWorkspace();
  const [edit, setEdit] = useState(false);
  const [alsoSeen, setAlsoSeen] = useState(false);
  const watch = useMutate((api, on: boolean) => (on ? api.post(`/bugs/${b.key}/watch`) : api.delete(`/bugs/${b.key}/watch`)), {
    success: (_r, on) => (on ? "You'll be notified about changes" : "You won't be notified about this bug"),
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(b.key);
      toast(`Copied ${b.key}`);
    } catch {
      toast(`Copying isn't available here. Select the ID to copy it: ${b.key}`);
    }
  };

  return (
    <div className="bug-page">
      <div className="bug-head">
        <div className="row-wrap bug-crumbs" style={{ gap: 6 }}>
          <Link to="/bugs" className="btn btn-ghost btn-sm" aria-label="Back to bugs">
            <ArrowLeft /> Bugs
          </Link>
          <span className="muted">/</span>
          <button className="bug-key" onClick={copy} title="Copy bug ID">
            {b.key} <Copy size={13} />
          </button>
          <span className="muted small">
            {lookup.project(b.project_id)?.name} · {lookup.module(b.module_id)?.name}
          </span>
        </div>
        <div className="row-between bug-head-row">
          <h1 className="bug-title">{b.title}</h1>
          <div className="row-wrap bug-head-actions">
            {detail.permissions.can_also_see && (
              <button className="btn btn-sm" onClick={() => setAlsoSeen(true)} title="Add yourself as a co-reporter, with extra evidence">
                <UserPlus /> I'm seeing this too
              </button>
            )}
            {detail.permissions.editable_fields.length > 0 && (
              <button className="btn btn-sm" onClick={() => setEdit(true)}>
                <FilePenLine /> Edit report
              </button>
            )}
            <button className="btn btn-sm" onClick={() => watch.mutate(!detail.is_watching)} aria-pressed={detail.is_watching}>
              {detail.is_watching ? <BellOff /> : <Bell />}
              {detail.is_watching ? "Unwatch" : "Watch"}
            </button>
          </div>
        </div>
        <div className="row-wrap bug-badges">
          <StatusPill status={b.status} size="lg" />
          <SeverityBadge severity={b.severity} />
          <PriorityGlyph priority={b.priority} />
          {detail.waiting_on.party !== "nobody" && (
            <>
              <span className="sep" aria-hidden />
              <span className="small muted">Waiting on</span>
              <WaitingOnChip waiting={detail.waiting_on} overdue={detail.overdue} hours={detail.hours_in_status} />
            </>
          )}
          {b.ai_assisted && (
            <span className="chip ai" title="Drafted with the AI assistant and reviewed by the reporter">
              <Sparkles /> AI-assisted report
            </span>
          )}
          {b.reopen_count > 0 && <span className="chip danger">Reopened {b.reopen_count}×</span>}
          {b.disputed && <span className="chip warning">Decision disputed</span>}
          {b.archived_at && <span className="chip danger">Archived</span>}
        </div>
      </div>

      <LifecycleTrack bug={b} />

      <div className="bug-grid">
        <div className="bug-main">
          <ContextCallouts detail={detail} />
          <ReportCard detail={detail} />
          <Activity detail={detail} />
        </div>
        <aside className="bug-rail">
          <ActionsPanel detail={detail} />
          <PeoplePanel detail={detail} />
          <DetailsPanel detail={detail} />
          <RegressionPanel detail={detail} />
          <LinksPanel detail={detail} />
          <SimilarPanel detail={detail} />
          <SummaryPanel detail={detail} />
        </aside>
      </div>
      {edit && <EditReportDialog detail={detail} onClose={() => setEdit(false)} />}
      {alsoSeen && <AlsoSeenDialog detail={detail} onClose={() => setAlsoSeen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// What's next: the one or two things this person should know or do now
// ---------------------------------------------------------------------------

function CalloutActions({ detail, keys }: { detail: Detail; keys: ActionKey[] }) {
  const [open, setOpen] = useState<ActionKey | null>(null);
  const run = useRunAction(detail);
  const available = keys.filter((k) => detail.actions.includes(k));
  if (!available.length) return null;
  return (
    <div className="row-wrap" style={{ marginTop: 10 }}>
      {available.map((k, i) => (
        <button
          key={k}
          className={buttonClass(k, i === 0) + " btn-sm"}
          disabled={run.isPending}
          onClick={() => (ACTION_DEFS[k].fields.length ? setOpen(k) : run.mutate({ action: k, input: {}, files: [] }))}
        >
          {ACTION_DEFS[k].label}
        </button>
      ))}
      {open && <ActionDialog detail={detail} action={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ContextCallouts({ detail }: { detail: Detail }) {
  const { lookup, ws } = useWorkspace();
  const b = detail.bug;
  const me = ws.me.id;
  const out: React.ReactNode[] = [];
  const lastComment = (kind: string) => [...detail.comments].reverse().find((c) => c.kind === kind);

  if (b.archived_at) {
    out.push(
      <div key="arch" className="callout danger">
        <ShieldAlert />
        <div>
          <div className="title">Archived {shortDate(b.archived_at)} by {lookup.userName(b.archived_by_id)}</div>
          <div>{b.archive_reason}</div>
          <CalloutActions detail={detail} keys={["restore"]} />
        </div>
      </div>,
    );
  }

  if (b.status === "need_info") {
    const q = lastComment("question");
    const asked = b.info_requested_from_id ?? b.reporter_id;
    out.push(
      <div key="info" className={cx("callout", asked === me ? "warning" : "info")}>
        <MessageCircleQuestion />
        <div className="grow">
          <div className="title">
            {asked === me ? `${lookup.userName(q?.author_id)} needs more information from you` : `Waiting on ${lookup.userName(asked)} for more information`}
          </div>
          {q && <div className="quote">“{q.body}”</div>}
          <CalloutActions detail={detail} keys={["provide_info"]} />
        </div>
      </div>,
    );
  }

  if (b.status === "regression_required") {
    const run = detail.regression_runs.find((r) => r.result === "pending");
    const mine = run?.assignee_id === me;
    out.push(
      <div key="reg" className={cx("callout", mine ? "warning" : "info")}>
        <Eye />
        <div className="grow">
          <div className="title">
            {mine ? "The fix is ready for you to test" : `Waiting on ${run?.assignee_id ? lookup.userName(run.assignee_id) : "a QA owner"} to run regression`}
            {run && run.round > 1 ? ` (round ${run.round})` : ""}
          </div>
          <div>
            {lookup.userName(b.fixed_by_id)} fixed it{b.fix_version ? <> in <span className="mono">{b.fix_version}</span></> : null}: {b.resolution_summary}
          </div>
          <CalloutActions detail={detail} keys={["pass_regression", "fail_regression", "start_regression"]} />
        </div>
      </div>,
    );
  }

  if (b.status === "fixed") {
    out.push(
      <div key="fixed" className="callout info">
        <Info />
        <div className="grow">
          <div className="title">Fixed, not yet available for testing</div>
          <div>
            {b.resolution_summary}
            {b.fix_version && <> · <span className="mono">{b.fix_version}</span></>}
          </div>
          <CalloutActions detail={detail} keys={["ready_for_regression"]} />
        </div>
      </div>,
    );
  }

  if (b.status === "regression_failed") {
    const fail = lastComment("regression");
    out.push(
      <div key="failed" className="callout danger">
        <CircleAlert />
        <div className="grow">
          <div className="title">QA says it still fails{b.reopen_count > 1 ? ` (reopened ${b.reopen_count}×)` : ""}</div>
          {fail && <div className="quote">“{fail.body}” · {lookup.userName(fail.author_id)}</div>}
          <CalloutActions detail={detail} keys={["start_work", "mark_fixed"]} />
        </div>
      </div>,
    );
  }

  if ((b.status === "not_a_bug" || b.status === "duplicate" || b.status === "deferred") && !b.archived_at) {
    const label = lookup.status(b.status).label;
    const cat = b.rejection_category ? REJECTION_CATEGORY_LABELS[b.rejection_category as RejectionCategory] : null;
    const awaiting = b.reporter_id === me && !b.decision_acknowledged_at;
    out.push(
      <div key="decision" className={cx("callout", awaiting ? "warning" : "info")}>
        <Scale />
        <div className="grow">
          <div className="title">
            {label} · decided by {lookup.userName(b.decision_by_id)}
            {b.decision_at && ` on ${shortDate(b.decision_at)}`}
            {cat && <span className="muted"> · {cat}</span>}
          </div>
          {b.status === "duplicate" && detail.duplicate_of && (
            <div>
              Original: <Link to={`/bugs/${detail.duplicate_of.key}`} className="mono">{detail.duplicate_of.key}</Link> {detail.duplicate_of.title}. The reporter keeps co-reporter credit there.
            </div>
          )}
          {b.status === "deferred" && (b.deferred_target || b.deferred_until) && (
            <div>
              {b.deferred_target && <>Target: {b.deferred_target}. </>}
              {b.deferred_until && <>Revisit on {shortDate(b.deferred_until)}.</>}
            </div>
          )}
          {b.resolution_reason && <div className="quote">“{b.resolution_reason}”</div>}
          {b.dispute_locked && <div className="small muted">A lead upheld this decision after a dispute. It is final.</div>}
          {b.decision_acknowledged_at && <div className="small muted">The reporter accepted this decision.</div>}
          <CalloutActions detail={detail} keys={["accept_decision", "dispute", "resume"]} />
        </div>
      </div>,
    );
  }

  if (b.disputed && b.dispute_context) {
    const d = b.dispute_context;
    out.push(
      <div key="dispute" className="callout warning">
        <Scale />
        <div className="grow">
          <div className="title">
            {lookup.userName(d.disputed_by_id)} disputed the {lookup.status(d.from).label} decision by {lookup.userName(d.decided_by_id)}
          </div>
          <div className="quote">“{d.reason}”</div>
          {d.resolution_reason && <div className="small muted">Original reason: {d.resolution_reason}</div>}
          <div className="small secondary" style={{ marginTop: 4 }}>A QA lead or product manager can uphold the decision, or an engineer can accept the bug by starting work.</div>
          <CalloutActions detail={detail} keys={["uphold_decision", "start_work"]} />
        </div>
      </div>,
    );
  }

  if (detail.potential_duplicates.length && (b.status === "new" || b.status === "under_review")) {
    out.push(
      <div key="potential" className="callout info">
        <Copy />
        <div className="grow">
          <div className="title">Possible duplicate detected</div>
          <div>
            This report closely matches{" "}
            {detail.potential_duplicates.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ", "}
                <Link to={`/bugs/${p.key}`} className="mono">{p.key}</Link>
              </span>
            ))}
            . Bugloop never merges reports on its own; triage decides.
          </div>
          <CalloutActions detail={detail} keys={["mark_duplicate"]} />
        </div>
      </div>,
    );
  }

  if (b.duplicate_check?.decision === "submitted_anyway" && b.duplicate_check.candidates.length) {
    out.push(
      <div key="dupcheck" className="callout">
        <Info />
        <div>
          <div className="title">The reporter checked for duplicates before submitting</div>
          <div>
            They reviewed{" "}
            {b.duplicate_check.candidates.map((c, i) => (
              <span key={c.bug_id}>
                {i > 0 && ", "}
                <Link to={`/bugs/${c.key}`} className="mono">{c.key}</Link>
              </span>
            ))}{" "}
            and judged this to be a different issue.
            {b.duplicate_check.note && <> “{b.duplicate_check.note}”</>}
          </div>
        </div>
      </div>,
    );
  }

  if (b.status === "closed" && b.close_reason && !b.verified_at) {
    out.push(
      <div key="forced" className="callout danger">
        <ShieldAlert />
        <div>
          <div className="title">Closed without verification by {lookup.userName(b.closed_by_id)}</div>
          <div>{b.close_reason}</div>
        </div>
      </div>,
    );
  }

  return out.length ? <div className="stack">{out}</div> : null;
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function EditReportDialog({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const { lookup, ws } = useWorkspace();
  const b = detail.bug;
  const can = new Set<ReportField>(detail.permissions.editable_fields);
  const [v, setV] = useState({
    title: b.title,
    description: b.description,
    steps: b.steps.join("\n"),
    expected_result: b.expected_result,
    actual_result: b.actual_result,
    module_id: b.module_id,
    feature_id: b.feature_id ?? "",
    environment_id: b.environment_id ?? "",
    browser: b.browser ?? "",
    device: b.device ?? "",
    os: b.os ?? "",
    app_version: b.app_version ?? "",
    page_url: b.page_url ?? "",
    frequency: b.frequency,
    tags: b.tags.join(", "),
    notes: b.notes ?? "",
  });
  const save = useMutate(
    (api, fields: Record<string, unknown>) => api.patch(`/bugs/${b.key}`, { fields }),
    { success: "Report updated" },
  );
  const submit = () => {
    const fields: Record<string, unknown> = {};
    const put = (k: ReportField, val: unknown, orig: unknown) => {
      if (can.has(k) && JSON.stringify(val) !== JSON.stringify(orig)) fields[k] = val;
    };
    put("title", v.title, b.title);
    put("description", v.description, b.description);
    put("steps", v.steps.split("\n").map((s) => s.trim()).filter(Boolean), b.steps);
    put("expected_result", v.expected_result, b.expected_result);
    put("actual_result", v.actual_result, b.actual_result);
    put("module_id", v.module_id, b.module_id);
    put("feature_id", v.feature_id || null, b.feature_id);
    put("environment_id", v.environment_id || null, b.environment_id);
    put("browser", v.browser || null, b.browser);
    put("device", v.device || null, b.device);
    put("os", v.os || null, b.os);
    put("app_version", v.app_version || null, b.app_version);
    put("page_url", v.page_url || null, b.page_url);
    put("frequency", v.frequency, b.frequency);
    put("tags", v.tags.split(",").map((t) => t.trim()).filter(Boolean), b.tags);
    put("notes", v.notes || null, b.notes);
    if (!Object.keys(fields).length) return onClose();
    save.mutate(fields, { onSuccess: onClose });
  };
  const text = (k: keyof typeof v, label: string, area = false, rows = 3) =>
    can.has(k as ReportField) ? (
      <Field label={label} htmlFor={`edit-${k}`}>
        {area ? (
          <textarea id={`edit-${k}`} className="textarea" rows={rows} value={String(v[k])} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
        ) : (
          <input id={`edit-${k}`} className="input" value={String(v[k])} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
        )}
      </Field>
    ) : null;
  return (
    <Dialog
      title={`Edit report · ${b.key}`}
      description="Every change is recorded in the timeline with the old and new values."
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={save.isPending}>
            Save changes
          </button>
        </>
      }
    >
      {text("title", "Title")}
      {text("description", "Description", true)}
      {text("steps", "Steps to reproduce (one per line)", true, 5)}
      <div className="grid-2">
        {text("expected_result", "Expected result", true)}
        {text("actual_result", "Actual result", true)}
      </div>
      <div className="grid-2">
        {can.has("module_id") && (
          <Field label="Module" htmlFor="edit-module">
            <select id="edit-module" className="select" value={v.module_id} onChange={(e) => setV({ ...v, module_id: e.target.value, feature_id: "" })}>
              {lookup.modulesOf(b.project_id).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {can.has("feature_id") && (
          <Field label="Feature" htmlFor="edit-feature">
            <select id="edit-feature" className="select" value={v.feature_id} onChange={(e) => setV({ ...v, feature_id: e.target.value })}>
              <option value="">Not specified</option>
              {lookup.featuresOf(v.module_id).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {can.has("environment_id") && (
          <Field label="Environment" htmlFor="edit-env">
            <select id="edit-env" className="select" value={v.environment_id} onChange={(e) => setV({ ...v, environment_id: e.target.value })}>
              <option value="">Not specified</option>
              {ws.environments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {can.has("frequency") && (
          <Field label="Frequency" htmlFor="edit-freq">
            <select id="edit-freq" className="select" value={v.frequency} onChange={(e) => setV({ ...v, frequency: e.target.value as typeof v.frequency })}>
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </Field>
        )}
        {text("browser", "Browser")}
        {text("device", "Device")}
        {text("os", "Operating system")}
        {text("app_version", "App version / build")}
      </div>
      {text("page_url", "Page URL")}
      {text("tags", "Tags (comma separated)")}
      {text("notes", "Additional notes", true)}
    </Dialog>
  );
}

function AlsoSeenDialog({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const add = useMutate((api, args: { note: string; files: File[] }) => api.postWithFiles(`/bugs/${detail.bug.key}/also-seen`, { note: args.note }, args.files), {
    success: "You're credited as a co-reporter",
  });
  return (
    <Dialog
      title="I'm seeing this too"
      description="You'll be credited as a co-reporter and the assignee is notified. Add anything that's different in your case."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={add.isPending} onClick={() => add.mutate({ note, files }, { onSuccess: onClose })}>
            Add me as co-reporter
          </button>
        </>
      }
    >
      <Field label="What you saw" htmlFor="also-note" help="For example another environment, browser or record.">
        <textarea id="also-note" className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <FileDrop files={files} onChange={setFiles} compact label="Attach evidence" />
    </Dialog>
  );
}
