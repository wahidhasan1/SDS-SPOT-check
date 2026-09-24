import { Link, useNavigate } from "react-router";
import { ArrowRight, Bot, Clock, Copy, GitMerge, Hourglass, Repeat2, Scale } from "lucide-react";
import type { BugListItem } from "../../core/types";
import { useWorkspace } from "../app/context";
import { relativeTime, duration } from "../lib/format";
import { Avatar, PriorityGlyph, SeverityBadge, StatusPill } from "./badges";
import { Empty, cx } from "./ui";

export type BugColumn = "key" | "title" | "status" | "severity" | "priority" | "waiting" | "people" | "reporter" | "assignee" | "activity" | "in_status";

const DEFAULT_COLUMNS: BugColumn[] = ["title", "status", "severity", "waiting", "people", "activity"];

/** Who has to act next, for how long, and whether that is longer than it should be. */
export function WaitingCell({ bug }: { bug: BugListItem }) {
  const { lookup } = useWorkspace();
  const w = bug.waiting_on;
  if (w.party === "nobody") return <span className="small muted">—</span>;
  const person = w.user_id ? lookup.user(w.user_id) : null;
  const party = w.party === "qa" ? "QA" : w.party === "lead" ? "QA lead" : "Engineering";
  return (
    <span className="waiting-cell" title={`Waiting on ${person?.name ?? w.label} for ${duration(bug.hours_in_status)}${bug.overdue ? ", longer than the attention time for this status" : ""}`}>
      {person ? (
        <Avatar userId={person.id} size="sm" />
      ) : (
        <span className="avatar sm tone-slate" aria-hidden>
          <Hourglass size={11} />
        </span>
      )}
      <span className="stack-sm" style={{ gap: 0, minWidth: 0 }}>
        <span className="small truncate">{person ? person.name : w.label}</span>
        <span className={cx("tiny nowrap", bug.overdue ? "danger-text" : "muted")}>
          {party} · {duration(bug.hours_in_status)}
          {bug.overdue && (
            <>
              {" "}
              <Clock size={11} style={{ verticalAlign: "-1px" }} />
            </>
          )}
        </span>
      </span>
    </span>
  );
}

function PeopleCell({ bug }: { bug: BugListItem }) {
  const { lookup } = useWorkspace();
  return (
    <span className="people-cell" title={`Reported by ${lookup.userName(bug.reporter_id)} · ${bug.assignee_id ? `assigned to ${lookup.userName(bug.assignee_id)}` : "unassigned"}`}>
      <Avatar userId={bug.reporter_id} size="sm" />
      <ArrowRight size={11} className="muted" aria-hidden />
      <Avatar userId={bug.assignee_id} size="sm" />
    </span>
  );
}

export function BugFlags({ bug }: { bug: BugListItem }) {
  return (
    <>
      {bug.reopen_count > 0 && (
        <span className="chip danger flag" title={`Reopened ${bug.reopen_count} time${bug.reopen_count === 1 ? "" : "s"} after failed regression`}>
          <Repeat2 /> {bug.reopen_count}×
        </span>
      )}
      {bug.disputed && (
        <span className="chip warning flag" title="The reporter disputed a decision on this bug">
          <Scale /> Disputed
        </span>
      )}
      {bug.potential_duplicate_ids.length > 0 && bug.status === "new" && (
        <span className="chip flag" title="Closely matches an existing bug">
          <Copy /> Possible duplicate
        </span>
      )}
      {bug.duplicate_of_id && (
        <span className="chip flag" title="Marked as a duplicate">
          <GitMerge /> Duplicate
        </span>
      )}
      {bug.ai_assisted && (
        <span className="chip ai flag" title="Drafted with the AI assistant and reviewed by the reporter">
          <Bot /> AI-assisted
        </span>
      )}
    </>
  );
}

export function BugTable({ items, columns = DEFAULT_COLUMNS, empty, emptyHint }: { items: BugListItem[]; columns?: BugColumn[]; empty?: string; emptyHint?: string }) {
  const { lookup } = useWorkspace();
  const navigate = useNavigate();
  const has = (c: BugColumn) => columns.includes(c);
  if (!items.length) return <Empty title={empty ?? "No bugs here"}>{emptyHint}</Empty>;
  return (
    <>
      <div className="table-wrap bug-table-wrap">
        <table className="table bug-table">
          <thead>
            <tr>
              {has("key") && <th>ID</th>}
              {has("title") && <th>Bug</th>}
              {has("status") && <th>Status</th>}
              {has("severity") && <th title={has("priority") ? undefined : "Severity, with priority below"}>Severity</th>}
              {has("priority") && <th>Priority</th>}
              {has("waiting") && <th>Waiting on</th>}
              {has("in_status") && <th className="num">In status</th>}
              {has("people") && <th>People</th>}
              {has("reporter") && <th>Reporter</th>}
              {has("assignee") && <th>Assignee</th>}
              {has("activity") && <th>Activity</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((b) => {
              const mod = lookup.module(b.module_id);
              const feat = lookup.feature(b.feature_id);
              return (
                <tr key={b.id} className={cx("clickable", b.archived_at && "archived")} onClick={(e) => !(e.target as HTMLElement).closest("a,button") && navigate(`/bugs/${b.key}`)}>
                  {has("key") && <td className="id">{b.key}</td>}
                  {has("title") && (
                    <td className="title-cell">
                      <Link to={`/bugs/${b.key}`} className="t">
                        {b.title}
                      </Link>
                      <div className="meta tiny muted">
                        {!has("key") && <span className="mono">{b.key}</span>}
                        <span>
                          {mod?.name ?? "No module"}
                          {feat ? ` › ${feat.name}` : ""}
                        </span>
                        <BugFlags bug={b} />
                      </div>
                    </td>
                  )}
                  {has("status") && (
                    <td>
                      <StatusPill status={b.status} size="sm" />
                    </td>
                  )}
                  {has("severity") && (
                    <td>
                      <span className="stack-sm" style={{ gap: 3 }}>
                        <SeverityBadge severity={b.severity} />
                        {!has("priority") && <PriorityGlyph priority={b.priority} />}
                      </span>
                    </td>
                  )}
                  {has("priority") && (
                    <td>
                      <PriorityGlyph priority={b.priority} />
                    </td>
                  )}
                  {has("waiting") && (
                    <td style={{ maxWidth: 190 }}>
                      <WaitingCell bug={b} />
                    </td>
                  )}
                  {has("in_status") && <td className={cx("num nowrap", b.overdue && "danger-text")}>{duration(b.hours_in_status)}</td>}
                  {has("people") && (
                    <td>
                      <PeopleCell bug={b} />
                    </td>
                  )}
                  {has("reporter") && (
                    <td>
                      <span className="row" style={{ gap: 6 }}>
                        <Avatar userId={b.reporter_id} size="sm" />
                        <span className="small truncate secondary" style={{ maxWidth: 110 }}>{lookup.userName(b.reporter_id)}</span>
                      </span>
                    </td>
                  )}
                  {has("assignee") && (
                    <td>
                      {b.assignee_id ? (
                        <span className="row" style={{ gap: 6 }}>
                          <Avatar userId={b.assignee_id} size="sm" />
                          <span className="small truncate secondary" style={{ maxWidth: 110 }}>{lookup.userName(b.assignee_id)}</span>
                        </span>
                      ) : (
                        <span className="small muted">Unassigned</span>
                      )}
                    </td>
                  )}
                  {has("activity") && (
                    <td className="small muted nowrap" title={b.last_activity_at}>
                      {relativeTime(b.last_activity_at)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="bug-cards">
        {items.map((b) => (
          <Link key={b.id} to={`/bugs/${b.key}`} className="bug-card">
            <div className="row-between">
              <span className="mono tiny muted">{b.key}</span>
              <StatusPill status={b.status} size="sm" />
            </div>
            <div className="bug-card-title">{b.title}</div>
            <div className="row-wrap tiny muted">
              <span>{lookup.module(b.module_id)?.name}</span>
              <SeverityBadge severity={b.severity} />
              <BugFlags bug={b} />
            </div>
            <div className="row-between">
              <WaitingCell bug={b} />
              <span className="tiny muted">{relativeTime(b.last_activity_at)}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
