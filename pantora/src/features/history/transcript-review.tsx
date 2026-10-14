"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check, CheckCheck } from "lucide-react";
import type { TranscriptEntry } from "@/server/queries";
import { ISSUE_CATEGORY_LABELS } from "@/lib/labels";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SaveSentenceButton } from "@/features/practice/save-sentence-button";
import { CopyButton } from "@/features/practice/copy-button";

export function TranscriptReview({ entries, sessionId, partnerName, partnerScripted }: { entries: TranscriptEntry[]; sessionId: string; partnerName: string | null; partnerScripted: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [onlyCorrections, setOnlyCorrections] = useState(false);
  const shown = onlyCorrections ? entries.filter((e) => e.speaker === "user" && (e.corrected || e.alternative)) : entries;

  async function markReviewed(id: string) {
    setBusy(id);
    try {
      const res = await api<{ xp: number; newAchievements: { name: string }[] }>(`/api/transcript-entries/${id}/review`, { body: {} });
      toast({
        tone: "success",
        title: "Lesson marked as reviewed",
        description: [res.xp ? `+${res.xp} XP` : null, ...res.newAchievements.map((a) => `Achievement unlocked: ${a.name}`)].filter(Boolean).join(" · ") || undefined,
      });
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Could not update", description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  const corrections = entries.filter((e) => e.speaker === "user" && e.corrected).length;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">
        <input type="checkbox" checked={onlyCorrections} onChange={(e) => setOnlyCorrections(e.target.checked)} className="h-4 w-4 accent-brand-600" />
        Show only sentences with corrections ({corrections})
      </label>
      <ol className="space-y-3">
        {shown.map((e) => (
          <li key={e.id} className={cn("rounded-2xl p-4", e.speaker === "partner" ? "bg-surface-muted/60" : "border border-line bg-surface")}>
            <p className="text-[11px] font-bold tracking-wide text-muted uppercase">
              {e.speaker === "partner" ? `${partnerName ?? "Partner"}${partnerScripted ? " · scripted demo line" : ""}` : "You"}
            </p>
            {e.speaker === "partner" || (!e.corrected && !e.alternative) ? (
              <p className="mt-1 leading-relaxed">{e.original}</p>
            ) : (
              <div className="mt-1">
                {e.corrected ? (
                  <>
                    <p className="text-muted line-through decoration-danger-500/60">{e.original}</p>
                    <p className="mt-1 flex items-start gap-2 font-semibold text-ink">
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-success-600" /> {e.corrected}
                    </p>
                  </>
                ) : (
                  <p className="leading-relaxed">{e.original}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {e.category && <Badge tone="neutral">{ISSUE_CATEGORY_LABELS[e.category]}</Badge>}
                  {e.reviewed && (
                    <Badge tone="success">
                      <CheckCheck className="h-3.5 w-3.5" /> Reviewed
                    </Badge>
                  )}
                </div>
                {e.explanation && <p className="mt-2 text-sm text-ink-soft">{e.explanation}</p>}
                {e.alternative && (
                  <p className="mt-2 text-sm text-muted">
                    <span className="font-semibold text-ink-soft">Alternative expression:</span> {e.alternative}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-1">
                  <SaveSentenceButton
                    original={e.original}
                    corrected={(e.corrected ?? e.alternative)!}
                    explanation={e.explanation}
                    category={e.category}
                    sourceKind="transcript"
                    sourceId={sessionId}
                    initiallySaved={e.saved}
                  />
                  <CopyButton text={(e.corrected ?? e.alternative)!} label="Copy corrected" />
                  {!e.reviewed && (
                    <Button variant="ghost" size="sm" onClick={() => markReviewed(e.id)} loading={busy === e.id}>
                      <Check className="h-4 w-4" /> Mark reviewed
                    </Button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
