import { CircleCheck, Info, TrendingUp } from "lucide-react";
import type { ScoreCard } from "@/lib/types";
import { ProgressBar } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export function ScoreBreakdown({ score, compact }: { score: ScoreCard; compact?: boolean }) {
  return (
    <div className="space-y-4">
      {score.dimensions.map((d) => (
        <div key={d.key} className="rounded-2xl border border-line p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold text-ink">{d.label}</p>
            <p className="font-bold tabular-nums">
              {d.score}
              <span className="text-sm font-semibold text-subtle">/{d.max}</span>
            </p>
          </div>
          <ProgressBar value={d.score} max={d.max} className="mt-2" tone={d.score / d.max >= 0.75 ? "success" : d.score / d.max >= 0.5 ? "brand" : "streak"} label={`${d.label} score`} />
          {!compact && (
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex gap-2 text-muted">
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> {d.explanation}
              </p>
              <p className="flex gap-2 text-success-700">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> {d.wentWell}
              </p>
              {d.improve.map((i) => (
                <p key={i} className="flex gap-2 text-ink-soft">
                  <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {i}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="flex items-start gap-2 rounded-2xl bg-surface-muted/60 p-4 text-sm text-muted">
        <Badge tone="neutral">Pronunciation</Badge>
        <span>{score.pronunciation.note}</span>
      </div>
    </div>
  );
}
