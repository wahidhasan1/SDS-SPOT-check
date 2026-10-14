import Link from "next/link";
import { ChevronRight, GraduationCap, MessagesSquare, Swords } from "lucide-react";
import type { SessionListItem } from "@/server/queries";
import { SESSION_TYPE_LABELS } from "@/lib/labels";
import { formatDateTime, formatDuration } from "@/lib/dates";
import { Badge, SampleBadge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

const ICONS = { free_talk: MessagesSquare, battle: Swords, coach: GraduationCap };
const ICON_TONES = { free_talk: "bg-brand-50 text-brand-600", battle: "bg-streak-50 text-streak-600", coach: "bg-info-50 text-info-700" };

export function SessionRow({ s, timeZone, showPartner = true }: { s: SessionListItem; timeZone: string; showPartner?: boolean }) {
  const Icon = ICONS[s.type];
  const title = s.topicTitle ?? s.promptText ?? SESSION_TYPE_LABELS[s.type];
  return (
    <Link href={`/history/${s.id}`} className="group flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-muted/70 sm:gap-4">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", ICON_TONES[s.type])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{SESSION_TYPE_LABELS[s.type]}</span>
          <span aria-hidden>·</span>
          <span>{formatDateTime(s.startedAt, timeZone)}</span>
          {s.durationSeconds > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>{formatDuration(s.durationSeconds)}</span>
            </>
          )}
          {showPartner && s.partnerName && (
            <>
              <span aria-hidden>·</span>
              <span>with {s.partnerName}</span>
            </>
          )}
        </span>
      </span>
      <span className="hidden shrink-0 flex-wrap items-center justify-end gap-1.5 sm:flex">
        {s.origin === "seed" && <SampleBadge label="Sample" />}
        {s.battleResult && s.battleResult !== "no_result" && (
          <Badge tone={s.battleResult === "win" ? "success" : s.battleResult === "draw" ? "info" : "neutral"}>
            {s.battleResult === "win" ? "Won" : s.battleResult === "draw" ? "Draw" : "Lost"} · {s.battleScore}
          </Badge>
        )}
        {s.status === "completed" ? <Badge tone="success">Completed</Badge> : <Badge tone="neutral">Incomplete</Badge>}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
