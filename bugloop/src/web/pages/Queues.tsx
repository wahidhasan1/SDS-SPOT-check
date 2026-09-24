// Work queues: "Needs my action", the regression queue and notifications.

import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, BellOff, CheckCheck, ClipboardCheck, Inbox, PartyPopper } from "lucide-react";
import type { ActionItem, ActionItemKind } from "../../core/api";
import { useWorkspace } from "../app/context";
import { useActionItems, useMutate, useNotifications, useRegressionQueue } from "../api/hooks";
import { Person, SeverityBadge, StatusPill } from "../components/badges";
import { Empty, Loading, Tabs, cx } from "../components/ui";
import { NotificationLink } from "../layout/AppShell";
import { dayHeading, duration, shortDate } from "../lib/format";

const GROUPS: { kind: ActionItemKind; title: string; hint: string; tone?: string }[] = [
  { kind: "dispute", title: "Disputes to settle", hint: "The reporter disagrees with a decision. Uphold it or overturn it.", tone: "danger" },
  { kind: "answer_question", title: "Questions to answer", hint: "An engineer can't continue until you reply.", tone: "warning" },
  { kind: "run_regression", title: "Fixes to re-test", hint: "Verify the fix, or reopen it with evidence.", tone: "warning" },
  { kind: "reopened", title: "Reopened after failed regression", hint: "QA found the fix didn't hold.", tone: "danger" },
  { kind: "triage", title: "New bugs to triage", hint: "Start work, ask for information, or decide it isn't a bug." },
  { kind: "info_received", title: "Information received", hint: "The reporter answered your question." },
  { kind: "make_testable", title: "Fixes to make testable", hint: "Fixed, but not yet deployed where QA can test it." },
  { kind: "work", title: "In progress", hint: "Bugs you're working on." },
  { kind: "review_decision", title: "Decisions to review", hint: "Engineering closed your report without a fix. Accept or dispute.", tone: "warning" },
  { kind: "assign_regression", title: "Regressions without an owner", hint: "The reporter left or can't test. Pick someone." },
  { kind: "reassign", title: "Bugs owned by people who left", hint: "Give these a new owner." },
  { kind: "revisit", title: "Deferred bugs due for review", hint: "The deferral date has passed." },
  { kind: "close_verified", title: "Verified, ready to close", hint: "Close once you're happy with the verification." },
];

export function ActionPage() {
  const q = useActionItems();
  const items = q.data?.items ?? [];
  return (
    <div className="stack-lg narrow-page">
      <div className="page-head">
        <div>
          <h1>Needs my action</h1>
          <p className="sub">Everything that is waiting on you, oldest first within each group.</p>
        </div>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <section className="panel">
          <Empty icon={<PartyPopper />} title="Nothing needs you right now">
            New questions, regressions and decisions will show up here.
          </Empty>
        </section>
      ) : (
        GROUPS.map((g) => {
          const list = items.filter((i) => i.kind === g.kind);
          if (!list.length) return null;
          return (
            <section key={g.kind} className="panel">
              <div className="panel-head">
                <h2 className="row" style={{ gap: 8 }}>
                  {g.title} <span className={cx("chip", g.tone)}>{list.length}</span>
                </h2>
                <span className="hint">{g.hint}</span>
              </div>
              <div className="panel-body flush">
                <div className="list">
                  {list.map((it) => (
                    <ActionRow key={`${it.kind}-${it.bug.id}`} item={it} />
                  ))}
                </div>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function ActionRow({ item }: { item: ActionItem }) {
  const { lookup } = useWorkspace();
  const b = item.bug;
  return (
    <Link to={`/bugs/${b.key}`} className="list-row action-row">
      <div className="grow stack-sm" style={{ gap: 3 }}>
        <div className="row-wrap" style={{ gap: 8 }}>
          <span className="mono tiny muted">{b.key}</span>
          <StatusPill status={b.status} size="sm" />
          <SeverityBadge severity={b.severity} />
          <span className="tiny muted">{lookup.module(b.module_id)?.name}</span>
        </div>
        <div className="action-title">{b.title}</div>
        <div className="small secondary">{item.detail}</div>
      </div>
      <div className="stack-sm action-side">
        <span className={cx("tiny nowrap", b.overdue ? "danger-text" : "muted")} title={item.since}>
          Waiting {duration((Date.now() - Date.parse(item.since)) / 3_600_000)}
        </span>
        <span className="btn btn-sm">
          {item.label} <ArrowRight />
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Regression queue
// ---------------------------------------------------------------------------

export function RegressionPage() {
  const { ws, lookup } = useWorkspace();
  const canAll = ws.me.role === "qa_lead" || ws.me.role === "admin" || ws.me.role === "project_manager";
  const [scope, setScope] = useState<"mine" | "all">(ws.me.role === "project_manager" ? "all" : "mine");
  const q = useRegressionQueue(scope);
  const items = q.data?.items ?? [];
  return (
    <div className="stack-lg narrow-page">
      <div className="page-head">
        <div>
          <h1>Regression</h1>
          <p className="sub">Fixes waiting for QA to confirm them in a real build. Pass to verify, fail to reopen with evidence.</p>
        </div>
      </div>
      {canAll && (
        <Tabs
          value={scope}
          onChange={setScope}
          tabs={[
            { value: "mine", label: "Assigned to me" },
            { value: "all", label: "Everyone's" },
          ]}
        />
      )}
      <section className="panel">
        <div className="panel-body flush">
          {q.isLoading ? (
            <Loading />
          ) : items.length === 0 ? (
            <Empty icon={<ClipboardCheck />} title={scope === "mine" ? "No regressions waiting for you" : "No regressions waiting"}>
              When engineering marks a fix ready, it appears here.
            </Empty>
          ) : (
            <div className="list">
              {items.map((it) => {
                const b = it.bug;
                const started = !!it.run.started_at;
                return (
                  <Link key={it.run.id} to={`/bugs/${b.key}`} className="list-row regression-row">
                    <div className="grow stack-sm" style={{ gap: 3 }}>
                      <div className="row-wrap" style={{ gap: 8 }}>
                        <span className="mono tiny muted">{b.key}</span>
                        <StatusPill status={b.status} size="sm" />
                        <SeverityBadge severity={b.severity} />
                        {it.run.round > 1 && <span className="chip danger">Round {it.run.round}</span>}
                        {started && <span className="chip accent">Testing started</span>}
                      </div>
                      <div className="action-title">{b.title}</div>
                      <div className="small secondary">
                        Fixed by {lookup.userName(it.fixed_by_id)}
                        {it.fix_version ? ` in ${it.fix_version}` : ""}
                        {it.run.build && it.run.build !== it.fix_version ? ` · build ${it.run.build}` : ""}
                        {it.run.environment_id ? ` · ${lookup.environment(it.run.environment_id)?.name}` : ""}
                      </div>
                      {it.resolution_summary && <div className="small muted clamp-2">“{it.resolution_summary}”</div>}
                    </div>
                    <div className="stack-sm action-side">
                      {scope === "all" && <Person userId={it.run.assignee_id} empty="No owner" />}
                      <span className="tiny muted nowrap">Requested {shortDate(it.run.requested_at)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function NotificationsPage() {
  const q = useNotifications(200);
  const [filter, setFilter] = useState<"all" | "unread" | "action">("all");
  const markAll = useMutate((api) => api.post("/notifications/read", { all: true }), { success: "All notifications marked as read" });
  const all = q.data?.items ?? [];
  const items = all.filter((n) => (filter === "unread" ? !n.read_at : filter === "action" ? n.category === "action" : true));
  const groups: { day: string; items: typeof items }[] = [];
  for (const n of items) {
    const day = dayHeading(n.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(n);
    else groups.push({ day, items: [n] });
  }
  return (
    <div className="stack-lg narrow-page">
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="sub">Status changes, questions, decisions and mentions on bugs you're involved in.</p>
        </div>
        <button className="btn btn-sm" onClick={() => markAll.mutate(undefined)} disabled={!q.data?.unread || markAll.isPending}>
          <CheckCheck /> Mark all as read
        </button>
      </div>
      <Tabs
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: "all", label: "All" },
          { value: "unread", label: "Unread", count: q.data?.unread ?? null },
          { value: "action", label: "Action needed" },
        ]}
      />
      {q.isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <section className="panel">
          <Empty icon={filter === "unread" ? <Inbox /> : <BellOff />} title={filter === "unread" ? "No unread notifications" : "No notifications"} />
        </section>
      ) : (
        groups.map((g) => (
          <section key={g.day} className="stack-sm">
            <div className="eyebrow">{g.day}</div>
            <div className="panel notif-list">
              {g.items.map((n) => (
                <NotificationLink key={n.id} n={n} />
              ))}
            </div>
          </section>
        ))
      )}
      <p className="tiny muted">
        Choose which updates you get in <Link to="/settings">Profile &amp; preferences</Link>. Questions, regressions and decisions that need you are always sent.
      </p>
    </div>
  );
}
