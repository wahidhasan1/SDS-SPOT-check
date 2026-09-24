import { Bot, Camera, Clock, Hourglass, PenLine, Sparkles, UserRound } from "lucide-react";
import type { Provenance, StatusKey, WaitingOn } from "../../core/types";
import { useWorkspace } from "../app/context";
import { duration, initials } from "../lib/format";
import { cx } from "./ui";

export function StatusPill({ status, size, title }: { status: StatusKey; size?: "sm" | "lg"; title?: string }) {
  const { lookup } = useWorkspace();
  const cfg = lookup.status(status);
  return (
    <span className={cx("pill", `tone-${cfg.color}`, size)} title={title ?? cfg.description}>
      <span className="dot" aria-hidden />
      {cfg.label}
    </span>
  );
}

export function SeverityBadge({ severity, bare }: { severity: string; bare?: boolean }) {
  const { lookup } = useWorkspace();
  const lvl = lookup.severity(severity);
  return (
    <span className={cx("sev", `tone-${lvl?.color ?? "slate"}`)} title={lvl?.description ?? undefined}>
      <span className="bar" aria-hidden />
      {!bare && (lvl?.label ?? severity)}
    </span>
  );
}

export function PriorityGlyph({ priority, showLabel = true }: { priority: string; showLabel?: boolean }) {
  const { lookup } = useWorkspace();
  const lvl = lookup.priority(priority);
  const total = 4;
  const filled = lvl ? Math.max(1, total + 1 - lvl.rank) : 1;
  return (
    <span className={cx("prio", priority === "urgent" && "urgent")} title={lvl ? `${lvl.label} priority: ${lvl.description ?? ""}` : priority}>
      <svg viewBox="0 0 16 16" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={1 + i * 4} y={11 - i * 3} width="3" height={4 + i * 3} rx="1" className={i < filled ? "on" : "off"} />
        ))}
      </svg>
      {showLabel && (lvl?.label ?? priority)}
    </span>
  );
}

export function Avatar({ userId, size }: { userId: string | null | undefined; size?: "sm" | "lg" }) {
  const { lookup } = useWorkspace();
  const u = lookup.user(userId);
  if (!u) {
    return (
      <span className={cx("avatar tone-slate", size)} title="Nobody">
        <UserRound size={size === "sm" ? 11 : 14} />
      </span>
    );
  }
  return (
    <span className={cx("avatar", `tone-${u.avatar_color}`, size, !u.active && "inactive")} title={`${u.name}${u.active ? "" : " (inactive)"}`}>
      {initials(u.name)}
    </span>
  );
}

export function Person({ userId, sub, size = "sm", empty = "Unassigned" }: { userId: string | null | undefined; sub?: string; size?: "sm" | "lg"; empty?: string }) {
  const { lookup } = useWorkspace();
  const u = lookup.user(userId);
  return (
    <span className="person">
      <Avatar userId={userId} size={size} />
      <span className="stack-sm" style={{ gap: 0, minWidth: 0 }}>
        <span className={cx("name truncate", !u && "muted")}>
          {u ? u.name : empty}
          {u && !u.active && <span className="muted small"> (left)</span>}
        </span>
        {sub && <span className="tiny muted truncate">{sub}</span>}
      </span>
    </span>
  );
}

export function WaitingOnChip({ waiting, overdue, hours }: { waiting: WaitingOn; overdue?: boolean; hours?: number }) {
  const { lookup } = useWorkspace();
  if (waiting.party === "nobody") return <span className="muted small">{waiting.label === "Nobody" ? "—" : waiting.label}</span>;
  const person = waiting.user_id ? lookup.user(waiting.user_id) : null;
  const tone = waiting.party === "qa" ? "warning" : waiting.party === "lead" ? "danger" : "accent";
  return (
    <span className="row" style={{ gap: 6 }} title={`Waiting on ${person ? person.name : waiting.label}${hours !== undefined ? ` for ${duration(hours)}` : ""}`}>
      {person ? <Avatar userId={person.id} size="sm" /> : <Hourglass size={14} className="muted" />}
      <span className={cx("chip", tone)} style={{ height: 20 }}>
        {waiting.party === "qa" ? "QA" : waiting.party === "lead" ? "Lead" : "Eng"}
      </span>
      <span className="small truncate secondary">{person ? person.name.split(" ")[0] : waiting.label}</span>
      {overdue && (
        <span className="chip danger" style={{ height: 20 }} title="Waiting longer than the attention threshold for this status">
          <Clock />
          {hours !== undefined ? duration(hours) : "overdue"}
        </span>
      )}
    </span>
  );
}

const PROV: Record<Provenance, { label: string; icon: typeof Bot; cls: string; title: string }> = {
  reporter: { label: "Provided by QA analyst", icon: PenLine, cls: "prov-reporter", title: "Taken from what the QA analyst wrote or selected." },
  screenshot: { label: "Observed in screenshot", icon: Camera, cls: "prov-screenshot", title: "Plainly visible in an attached screenshot." },
  ai_wording: { label: "AI-generated wording", icon: Sparkles, cls: "prov-ai", title: "Reworded by the assistant from facts the QA analyst provided." },
  ai_inferred: { label: "AI-inferred, please confirm", icon: Bot, cls: "prov-inferred", title: "The assistant read this from what was implied. Confirm or edit it." },
};

export function ProvenanceChip({ source, offline, label: override }: { source: Provenance; offline?: boolean; label?: string }) {
  const p = PROV[source];
  const Icon = p.icon;
  const label = override ?? (source === "ai_wording" && offline ? "Assistant wording" : p.label);
  return (
    <span className={cx("prov", p.cls)} title={p.title}>
      <Icon aria-hidden />
      {label}
    </span>
  );
}

export function PartyLabel({ party }: { party: WaitingOn["party"] }) {
  if (party === "qa") return <span className="chip warning">Waiting on QA</span>;
  if (party === "engineering") return <span className="chip accent">Waiting on engineering</span>;
  if (party === "lead") return <span className="chip danger">Waiting on QA lead</span>;
  return <span className="chip">No one waiting</span>;
}
