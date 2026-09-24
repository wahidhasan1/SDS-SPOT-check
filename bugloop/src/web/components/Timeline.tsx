// The activity timeline: every status change, decision, question, answer, comment and piece of
// evidence in order. The heart of "what happened to this bug?".

import { useMemo, useState } from "react";
import { Cog, MessageSquare } from "lucide-react";
import type { BugDetail } from "../../core/api";
import type { Attachment, Comment, EventRecord } from "../../core/types";
import { describeEvent, type TimelineLookup, type TimelineTone } from "../../core/timeline";
import { useWorkspace } from "../app/context";
import { useMutate } from "../api/hooks";
import { dateTime, dayHeading, timeOfDay } from "../lib/format";
import { AttachmentGrid, FileDrop } from "./Attachments";
import { Avatar } from "./badges";
import { Segmented, cx } from "./ui";

interface Entry {
  id: string;
  at: string;
  actorId: string | null;
  system: boolean;
  kind: "event" | "comment";
  text: string;
  detail: string | null;
  tone: TimelineTone;
  comment: Comment | null;
  attachments: Attachment[];
}

const HIDDEN = new Set([
  "bug.disputed",
  "bug.dispute_resolved",
  "bug.decision_upheld",
  "bug.reopened",
  "bug.closed",
  "regression.passed",
  "regression.failed",
  "bug.info_requested",
  "bug.info_provided",
]);

const COMMENT_KIND_LABEL: Record<Comment["kind"], string | null> = {
  comment: null,
  question: "Question",
  answer: "Answer",
  dispute: "Dispute",
  decision: "Decision",
  regression: "Regression result",
  evidence: "Evidence",
};

function buildEntries(detail: BugDetail, L: TimelineLookup): Entry[] {
  const comments = new Map(detail.comments.map((c) => [c.id, c]));
  const atts = new Map(detail.attachments.map((a) => [a.id, a]));
  const attsByComment = new Map<string, Attachment[]>();
  for (const a of detail.attachments) {
    if (!a.comment_id) continue;
    attsByComment.set(a.comment_id, [...(attsByComment.get(a.comment_id) ?? []), a]);
  }
  const usedComments = new Set<string>();
  const usedAtts = new Set<string>();
  const byTime = new Map<string, EventRecord[]>();
  for (const e of detail.events) byTime.set(e.created_at, [...(byTime.get(e.created_at) ?? []), e]);

  const entries: Entry[] = [];
  for (const e of detail.events) {
    if (HIDDEN.has(e.type)) continue;
    const d = e.data as Record<string, unknown>;
    const siblings = byTime.get(e.created_at) ?? [];
    const described = describeEvent(e, L);

    if (e.type === "comment.added") {
      const c = comments.get(String(d.comment_id));
      if (!c) continue;
      usedComments.add(c.id);
      const cAtts = attsByComment.get(c.id) ?? [];
      cAtts.forEach((a) => usedAtts.add(a.id));
      entries.push({ id: e.id, at: e.created_at, actorId: e.actor_id, system: false, kind: "comment", text: "commented", detail: null, tone: "neutral", comment: c, attachments: cAtts });
      continue;
    }
    // A regression request is folded into the status change that caused it.
    const toRegression = (x: EventRecord) => x.type === "bug.status_changed" && (x.data as { to?: string }).to === "regression_required";
    if (e.type === "regression.requested" && siblings.some(toRegression)) continue;
    if (described.quiet && e.type !== "regression.requested" && !(e.type === "bug.status_changed" && d.action === "confirm")) continue;
    if (e.type === "bug.status_changed" && d.action === "confirm") continue;

    // Pull in the comment and evidence that belong to this action.
    let commentId = typeof d.comment_id === "string" ? d.comment_id : null;
    let attachmentIds = Array.isArray(d.attachment_ids) ? (d.attachment_ids as string[]) : [];
    let detailText = described.detail;
    if (e.type === "bug.status_changed" && (d.action === "pass_regression" || d.action === "fail_regression")) {
      const run = siblings.find((s) => s.type === (d.action === "pass_regression" ? "regression.passed" : "regression.failed"));
      const rd = (run?.data ?? {}) as Record<string, unknown>;
      commentId = commentId ?? (typeof rd.comment_id === "string" ? rd.comment_id : null);
      attachmentIds = [...attachmentIds, ...((rd.attachment_ids as string[] | undefined) ?? [])];
      const bits = [
        typeof rd.build === "string" && rd.build ? `Build ${rd.build}` : null,
        L.environment(rd.environment_id as string) ? `in ${L.environment(rd.environment_id as string)}` : null,
        rd.round ? `round ${rd.round}` : null,
      ].filter(Boolean);
      const notes = typeof rd.notes === "string" && rd.notes ? rd.notes : null;
      detailText = d.action === "pass_regression" ? [notes, bits.join(" · ")].filter(Boolean).join("\n") : detailText;
    }
    if (toRegression(e)) {
      const rr = siblings.find((x) => x.type === "regression.requested");
      const rd = (rr?.data ?? {}) as Record<string, unknown>;
      if (rr) {
        const who = typeof rd.assignee_id === "string" ? L.user(rd.assignee_id) : null;
        const build = typeof rd.build === "string" && rd.build ? ` build ${rd.build}` : "";
        detailText = who ? `Round ${rd.round}: ${who} will re-test${build}.` : `Round ${rd.round}: waiting for a QA owner.`;
      }
    }
    const c = commentId ? comments.get(commentId) ?? null : null;
    if (c) usedComments.add(c.id);
    const linked = [...attachmentIds.map((id) => atts.get(id)).filter((a): a is Attachment => !!a), ...(c ? attsByComment.get(c.id) ?? [] : [])];
    const unique = linked.filter((a, i) => linked.findIndex((x) => x.id === a.id) === i);
    unique.forEach((a) => usedAtts.add(a.id));
    if (e.type === "bug.created") {
      for (const a of detail.attachments) if (a.context === "report" && !usedAtts.has(a.id)) {
        unique.push(a);
        usedAtts.add(a.id);
      }
    }
    entries.push({
      id: e.id,
      at: e.created_at,
      actorId: e.actor_id,
      system: described.system,
      kind: "event",
      text: described.text,
      detail: c ? c.body : detailText,
      tone: described.tone,
      comment: null,
      attachments: unique,
    });
  }
  for (const c of detail.comments) {
    if (usedComments.has(c.id)) continue;
    const cAtts = attsByComment.get(c.id) ?? [];
    entries.push({ id: c.id, at: c.created_at, actorId: c.author_id, system: false, kind: "comment", text: "commented", detail: null, tone: "neutral", comment: c, attachments: cAtts });
  }
  entries.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return entries;
}

export function Activity({ detail }: { detail: BugDetail }) {
  const { lookup } = useWorkspace();
  const [filter, setFilter] = useState<"all" | "comments" | "history">("all");
  const L = useMemo<TimelineLookup>(() => {
    const refs = new Map([...detail.referenced_bugs, ...detail.duplicates, ...(detail.duplicate_of ? [detail.duplicate_of] : [])].map((b) => [b.id, b.key]));
    return { ...lookup.timeline, bugKey: (id) => (id ? refs.get(id) ?? null : null) };
  }, [detail, lookup]);
  const entries = useMemo(() => buildEntries(detail, L), [detail, L]);
  const shown = entries.filter((e) => (filter === "all" ? true : filter === "comments" ? e.kind === "comment" || !!e.comment || (e.detail && !e.system) : e.kind === "event"));

  const groups: { day: string; items: Entry[] }[] = [];
  for (const e of shown) {
    const day = dayHeading(e.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Activity</h2>
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "comments", label: "Discussion" },
            { value: "history", label: "History" },
          ]}
        />
      </div>
      <div className="panel-body">
        <ol className="timeline">
          {groups.map((g) => (
            <li key={g.day} className="tl-day">
              <div className="tl-day-label">{g.day}</div>
              <ol>
                {g.items.map((e) => (
                  <TimelineItem key={e.id} e={e} />
                ))}
              </ol>
            </li>
          ))}
        </ol>
        {detail.permissions.can_comment && <Composer detail={detail} />}
      </div>
    </section>
  );
}

function TimelineItem({ e }: { e: Entry }) {
  const { lookup } = useWorkspace();
  const name = e.system ? "Bugloop" : lookup.userName(e.actorId);
  const kindLabel = e.comment ? COMMENT_KIND_LABEL[e.comment.kind] : null;
  if (e.kind === "comment" && e.comment) {
    return (
      <li className="tl-item comment">
        <span className="tl-icon">
          <Avatar userId={e.actorId} size="sm" />
        </span>
        <div className="tl-card">
          <div className="tl-head">
            <strong>{name}</strong>
            {kindLabel && <span className="chip" style={{ height: 19, fontSize: 11 }}>{kindLabel}</span>}
            <time className="muted" dateTime={e.at} title={dateTime(e.at)}>
              {timeOfDay(e.at)}
            </time>
          </div>
          <div className="tl-body">{e.comment.body}</div>
          {e.attachments.length > 0 && <AttachmentGrid attachments={e.attachments} size="sm" />}
        </div>
      </li>
    );
  }
  return (
    <li className={cx("tl-item", `tone-${e.tone}`, e.system && "system")}>
      <span className="tl-icon">{e.system ? <span className="tl-sys"><Cog size={13} /></span> : <Avatar userId={e.actorId} size="sm" />}</span>
      <div className="tl-line">
        <div className="tl-head">
          {e.system ? <span className="tl-text">{/[.!?]$/.test(e.text) ? e.text : `${e.text}.`}</span> : (
            <span className="tl-text">
              <strong>{name}</strong> {e.text}
            </span>
          )}
          <time className="muted" dateTime={e.at} title={dateTime(e.at)}>
            {timeOfDay(e.at)}
          </time>
        </div>
        {e.detail && (
          <div className="tl-detail">
            {e.comment === null && e.detail.includes("\n") ? e.detail.split("\n").map((line, i) => <div key={i}>{line}</div>) : e.detail}
          </div>
        )}
        {e.attachments.length > 0 && <AttachmentGrid attachments={e.attachments} size="sm" />}
      </div>
    </li>
  );
}

function Composer({ detail }: { detail: BugDetail }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const post = useMutate((api, args: { body: string; files: File[] }) => api.postWithFiles(`/bugs/${detail.bug.key}/comments`, { body: args.body }, args.files), {
    success: "Comment added",
  });
  const submit = () => {
    if (!body.trim() && !files.length) return;
    post.mutate(
      { body, files },
      {
        onSuccess: () => {
          setBody("");
          setFiles([]);
        },
      },
    );
  };
  return (
    <div className="composer">
      <MessageSquare className="muted" size={18} />
      <div className="grow stack-sm">
        <textarea
          className="textarea"
          rows={3}
          placeholder="Add a comment. Mention someone with @name."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          aria-label="Comment"
        />
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <div className="grow">
            <FileDrop files={files} onChange={setFiles} compact label="Attach files" />
          </div>
          <button className="btn btn-primary" onClick={submit} disabled={post.isPending || (!body.trim() && !files.length)}>
            {post.isPending && <span className="spinner" />}Comment
          </button>
        </div>
      </div>
    </div>
  );
}
