import { ArrowRight, BookOpenCheck, CircleCheck, Gauge, Lightbulb, Sparkles, SpellCheck } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import { ISSUE_CATEGORY_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { SaveSentenceButton } from "./save-sentence-button";
import { CopyButton } from "./copy-button";

/** Full feedback view for a coach answer or a session analysis. */
export function AnalysisView({
  analysis,
  sourceKind,
  sourceId,
  savedKeys = [],
  providerNotice,
}: {
  analysis: AnalysisResult;
  sourceKind: "transcript" | "coach" | "battle";
  sourceId?: string | null;
  savedKeys?: string[];
  providerNotice?: string | null;
}) {
  const changed = analysis.sentences.filter((s) => s.changed);
  const major = analysis.issues.filter((i) => !i.minor && i.original);
  const redacted = !analysis.original;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={analysis.analyzer === "anthropic" ? "brand" : "demo"}>{analysis.analyzer === "anthropic" ? `AI feedback · ${analysis.model}` : "Demo analyzer (rule-based)"}</Badge>
        {analysis.speech && <Badge tone="info">Includes speech timing</Badge>}
      </div>
      {providerNotice && <p className="rounded-xl bg-streak-50 px-3.5 py-2.5 text-sm text-streak-700">{providerNotice}</p>}
      <p className="text-lg leading-relaxed text-ink">{analysis.summary}</p>

      {!redacted && (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-surface-muted/60 p-4">
            <p className="text-xs font-bold tracking-wide text-muted uppercase">Your response</p>
            <p className="mt-2 leading-relaxed">{analysis.original}</p>
          </div>
          <div className="rounded-2xl bg-success-50/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold tracking-wide text-success-700 uppercase">Improved version</p>
              <CopyButton text={analysis.improved} />
            </div>
            <p className="mt-2 leading-relaxed">{analysis.improved}</p>
          </div>
        </section>
      )}

      {analysis.strengths.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 font-bold">
            <CircleCheck className="h-5 w-5 text-success-600" /> What went well
          </h3>
          <ul className="mt-2 space-y-1.5 text-ink-soft">
            {analysis.strengths.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </section>
      )}

      {!redacted && (
        <section>
          <h3 className="flex items-center gap-2 font-bold">
            <SpellCheck className="h-5 w-5 text-brand-600" /> Important changes
          </h3>
          {changed.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No sentences needed grammar changes{analysis.analyzer === "demo-rules" ? " according to the demo rules (which only recognize common patterns)" : ""}.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {changed.map((s, i) => (
                <li key={i} className="rounded-2xl border border-line p-4">
                  {s.category && <Badge tone="neutral">{ISSUE_CATEGORY_LABELS[s.category]}</Badge>}
                  <p className="mt-2 text-sm text-muted line-through decoration-danger-500/60">{s.original}</p>
                  <p className="mt-0.5 flex items-start gap-2 font-semibold">
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-success-600" />
                    {s.corrected}
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">{s.explanation}</p>
                  {s.alternative && s.alternative !== s.corrected && (
                    <p className="mt-2 text-sm text-muted">
                      <span className="font-semibold text-ink-soft">Another way to say it:</span> {s.alternative}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1">
                    <SaveSentenceButton
                      original={s.original}
                      corrected={s.corrected}
                      explanation={s.explanation}
                      category={s.category}
                      sourceKind={sourceKind}
                      sourceId={sourceId}
                      initiallySaved={savedKeys.includes(`${s.original}→${s.corrected}`)}
                      label="Save to My Learning"
                    />
                    <CopyButton text={s.corrected} label="Copy corrected" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {major.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 font-bold">
            <BookOpenCheck className="h-5 w-5 text-brand-600" /> Grammar feedback
          </h3>
          <ul className="mt-2 space-y-2">
            {major.map((i, idx) => (
              <li key={idx} className="text-sm text-ink-soft">
                <span className="font-semibold text-ink">
                  “{i.original}” → “{i.corrected}”
                </span>{" "}
                — {i.explanation}
              </li>
            ))}
          </ul>
        </section>
      )}

      {analysis.vocabulary.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 font-bold">
            <Sparkles className="h-5 w-5 text-brand-600" /> Vocabulary suggestions
          </h3>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {analysis.vocabulary.map((v) => (
              <li key={v.phrase} className="rounded-2xl bg-lavender p-3.5 text-sm">
                <p>
                  Instead of <span className="font-semibold">“{v.phrase}”</span>, try{" "}
                  {v.alternatives.map((a, i) => (
                    <span key={a}>
                      <span className="font-semibold text-brand-700">{a}</span>
                      {i < v.alternatives.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
                <p className="mt-1 text-muted">{v.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="flex items-center gap-2 font-bold">
          <Gauge className="h-5 w-5 text-brand-600" /> Fluency
        </h3>
        {analysis.fluencyNotes ? (
          <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
            {analysis.fluencyNotes.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Not measured — fluency feedback needs a recording with real speech timing.</p>
        )}
      </section>

      <section className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
        <h3 className="flex items-center gap-2 font-bold text-brand-800">
          <Lightbulb className="h-5 w-5" /> Suggested exercise: {analysis.exercise.title}
        </h3>
        <p className="mt-1.5 text-sm text-ink-soft">{analysis.exercise.instructions}</p>
      </section>

      <div className="space-y-1">
        {analysis.limitations.map((l) => (
          <p key={l} className="text-xs text-muted">
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}
