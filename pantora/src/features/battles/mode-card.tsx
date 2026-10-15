import Link from "next/link";
import { ArrowRight, Clock, Gauge, Trophy, Zap } from "lucide-react";
import { MODE_COLOR_CLASSES, modeXpLabel, type BattleMode } from "@/content/battle-modes";
import { DIFFICULTY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { BattleModeArt } from "@/components/art/battle-art";
import { buttonClasses } from "@/components/ui/button";

export interface ModeStatLite {
  played: number;
  best: number | null;
  wins: number;
  sampleOnly: boolean;
}

export function modeDifficultyLabel(mode: BattleMode) {
  return mode.difficulty === "mixed" ? "Any level" : DIFFICULTY_LABELS[mode.difficulty];
}

export function modeTimeLabel(mode: BattleMode) {
  return mode.id === "free-play" ? "You set the timer" : `${mode.speakSeconds}s talk · ${mode.prepSeconds}s prep`;
}

/**
 * A battle-type card. The whole card opens the type's details; the button
 * either opens details too (gallery) or starts straight away (dashboard).
 */
export function BattleModeCard({
  mode,
  stat,
  detailHref,
  actionHref,
  actionLabel,
  compact = false,
  className,
  style,
}: {
  mode: BattleMode;
  stat?: ModeStatLite | null;
  detailHref: string;
  actionHref: string;
  actionLabel: string;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const c = MODE_COLOR_CLASSES[mode.color];
  return (
    <div
      className={cn("group lift relative flex flex-col overflow-hidden rounded-[1.75rem] bg-gradient-to-br p-3 shadow-card", c.card, className)}
      data-mode={mode.id}
      style={style}
    >
      <div className="pointer-events-none absolute inset-0 bg-dots-light" aria-hidden />
      <div className={cn("relative flex items-center justify-center", compact ? "h-28" : "h-36")}>
        <BattleModeArt mode={mode.id} className="h-full w-auto drop-shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3" />
      </div>
      <div className="relative flex flex-1 flex-col rounded-[1.35rem] bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-xl leading-tight font-extrabold tracking-tight text-ink">
            <Link href={detailHref} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
              {mode.name}
            </Link>
          </h3>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sun-100 px-2 py-0.5 text-xs font-extrabold text-sun-700">
            <Zap className="h-3.5 w-3.5 fill-sun-400 text-sun-500" aria-hidden />
            {modeXpLabel(mode)}
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold text-ink-soft">{mode.tagline}</p>
        {!compact && <p className="mt-1 text-sm text-muted">{mode.description}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-bold">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", c.chip)}>
            <Clock className="h-3.5 w-3.5" aria-hidden /> {modeTimeLabel(mode)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-ink-soft">
            <Gauge className="h-3.5 w-3.5" aria-hidden /> {modeDifficultyLabel(mode)}
          </span>
          {stat && stat.best != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-ink-soft" title={stat.sampleOnly ? "From sample history" : undefined}>
              <Trophy className="h-3.5 w-3.5" aria-hidden /> Best {stat.best}
              {stat.sampleOnly ? " (sample)" : ""}
            </span>
          )}
        </div>
        <div className="mt-auto pt-4">
          <Link href={actionHref} className={buttonClasses("dark", "md", "relative z-10 w-full")} aria-label={`${actionLabel}: ${mode.name}`}>
            {actionLabel} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
