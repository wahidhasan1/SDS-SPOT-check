import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Captions, FileText, Sparkles, Swords } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getSessionDetail } from "@/server/queries";
import { getDemoPartner } from "@/content/partners";
import { SESSION_TYPE_LABELS } from "@/lib/labels";
import { formatDateTime, formatDuration } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, SampleBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { AnalysisView } from "@/features/practice/analysis-view";
import { ScoreBreakdown } from "@/features/battles/score-breakdown";
import { TranscriptReview } from "@/features/history/transcript-review";
import { ReviewFeedbackButton } from "@/features/history/review-feedback-button";
import { PartnerActions } from "@/features/history/partner-actions";

export const metadata: Metadata = { title: "Session Review" };

const END_REASONS: Record<string, string> = {
  completed: "Completed",
  time_up: "Finished on time",
  ended_early: "Ended early",
  skipped: "Partner skipped",
  left: "Partner left",
  connection_lost: "Connection lost",
  reported: "Ended after a report",
  blocked: "Ended after blocking",
};

export default async function SessionReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { profile, settings } = await requireUser();
  const { id } = await params;
  const detail = getSessionDetail(profile.id, id);
  if (!detail) notFound();
  const { session: s, transcript, feedback, battle } = detail;
  const demoPartner = getDemoPartner(detail.partnerId);
  const showPartner = settings.privacy.showPartnerNamesInHistory;
  const title = s.topicTitle ?? s.promptText ?? SESSION_TYPE_LABELS[s.type];

  return (
    <div className="space-y-6">
      <ButtonLink href="/history" variant="ghost" size="sm" className="-ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to history
      </ButtonLink>

      <Card>
        <CardBody className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">{SESSION_TYPE_LABELS[s.type]}</Badge>
              {s.status === "completed" ? <Badge tone="success">Completed</Badge> : <Badge tone="neutral">Incomplete</Badge>}
              {s.origin === "seed" && <SampleBadge />}
              {s.origin === "demo" && s.type !== "coach" && <Badge tone="demo">Simulated partner</Badge>}
              {s.origin === "live" && <Badge tone="success">Live session</Badge>}
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight">{title}</h1>
            {s.promptText && s.topicTitle && <p className="mt-1 text-muted">“{s.promptText}”</p>}
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-muted">Date</dt>
                <dd className="font-semibold">{formatDateTime(s.startedAt, profile.timezone)}</dd>
              </div>
              <div>
                <dt className="text-muted">Duration</dt>
                <dd className="font-semibold">{s.durationSeconds ? formatDuration(s.durationSeconds) : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Counted practice</dt>
                <dd className="font-semibold">{s.practiceSeconds ? formatDuration(s.practiceSeconds) : "None"}</dd>
              </div>
              <div>
                <dt className="text-muted">XP earned</dt>
                <dd className="font-semibold">{s.xpAwarded}</dd>
              </div>
              {s.endReason && (
                <div>
                  <dt className="text-muted">Outcome</dt>
                  <dd className="font-semibold">{END_REASONS[s.endReason] ?? s.endReason}</dd>
                </div>
              )}
            </dl>
          </div>
          {s.partnerName && detail.partnerId && (
            <div className="shrink-0 rounded-2xl border border-line p-4 md:w-72">
              <div className="flex items-center gap-3">
                <Avatar name={showPartner ? s.partnerName : "?"} avatar={demoPartner?.avatar ?? "slate"} />
                <div>
                  <p className="font-bold">{showPartner ? s.partnerName : "Partner (hidden)"}</p>
                  <p className="text-xs text-muted">{s.partnerKind === "demo_partner" ? "Fictional demo partner" : "Pantora user"}</p>
                </div>
              </div>
              <div className="mt-3">
                <PartnerActions
                  target={{ id: detail.partnerId, kind: s.partnerKind ?? "demo_partner", name: s.partnerName, sessionId: s.id, isDemo: s.partnerKind === "demo_partner" }}
                  blocked={detail.partnerBlocked}
                />
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {battle && battle.evaluation && (
        <Card>
          <CardHeader
            title="Battle result"
            icon={<Swords className="h-5 w-5" />}
            description={battle.evaluation.resultNote}
            action={<Badge tone={battle.result === "win" ? "success" : battle.result === "draw" ? "info" : "neutral"}>{battle.result === "win" ? "Won" : battle.result === "draw" ? "Draw" : battle.result === "loss" ? "Lost" : "No result"}</Badge>}
          />
          <CardBody className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line p-4">
                <p className="flex items-center justify-between text-sm font-semibold text-muted">
                  Your answer ({battle.userInputMode === "spoken" ? "spoken" : "typed"})<span className="text-2xl font-extrabold text-ink">{battle.userScore}</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed">{battle.userResponse}</p>
              </div>
              <div className="rounded-2xl bg-surface-muted/60 p-4">
                <p className="flex items-center justify-between text-sm font-semibold text-muted">
                  {battle.opponentName} — {battle.opponentResponseKind === "sample" ? "pre-written sample" : "live answer"}
                  <span className="text-2xl font-extrabold text-ink-soft">{battle.opponentScore}</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed">{battle.opponentResponse}</p>
              </div>
            </div>
            <ScoreBreakdown score={battle.evaluation.user.score} />
            <details className="rounded-2xl border border-line p-4">
              <summary className="cursor-pointer font-semibold">See {battle.opponentName}&apos;s score breakdown</summary>
              <div className="mt-4">
                <ScoreBreakdown score={battle.evaluation.opponent.score} compact />
              </div>
            </details>
          </CardBody>
        </Card>
      )}

      {s.type === "free_talk" && (
        <Card>
          <CardHeader
            title="Transcript and better sentences"
            icon={<Captions className="h-5 w-5" />}
            description={transcript?.note ?? undefined}
            action={
              transcript ? (
                <Badge tone={transcript.status === "available" ? (transcript.source === "sample" ? "sample" : "success") : "neutral"}>
                  {transcript.status === "available"
                    ? transcript.source === "sample"
                      ? "Sample transcript"
                      : transcript.source === "browser_speech"
                        ? "Browser captions"
                        : "Transcript"
                    : transcript.status === "not_retained"
                      ? "Not retained"
                      : "Not transcribed"}
                </Badge>
              ) : undefined
            }
          />
          <CardBody>
            {transcript?.status === "available" && transcript.entries.length > 0 ? (
              <>
                {transcript.expiresAt && (
                  <p className="mb-3 text-xs text-muted">This transcript will be deleted on {formatDateTime(transcript.expiresAt, profile.timezone)} (30-day retention).</p>
                )}
                <TranscriptReview entries={transcript.entries} sessionId={s.id} partnerName={showPartner ? s.partnerName : "Partner"} partnerScripted={s.partnerKind === "demo_partner"} />
              </>
            ) : (
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title={transcript?.status === "not_retained" ? "Transcript not kept" : "No transcript for this session"}
                description={
                  transcript?.status === "not_retained"
                    ? "Your privacy settings say not to retain transcripts. Feedback was generated and the text discarded."
                    : "Pantora never invents transcripts. Turn on live captions during a Free Talk to get a transcript and sentence corrections."
                }
              />
            )}
          </CardBody>
        </Card>
      )}

      {feedback.map((f) => (
        <Card key={f.id}>
          <CardHeader
            title={f.kind === "battle" ? "Feedback on your answer" : f.kind === "coach" ? "Coach feedback" : "Conversation feedback"}
            icon={<Sparkles className="h-5 w-5" />}
            description={f.origin === "seed" ? "Sample feedback generated for the demo account." : undefined}
            action={<ReviewFeedbackButton feedbackId={f.id} reviewed={f.reviewed} />}
          />
          <CardBody>
            {f.kind === "session" ? (
              // Sentence-level corrections are shown in the transcript above; summarize here.
              <div className={cn("space-y-3")}>
                <p className="text-ink-soft">{f.analysis.summary}</p>
                <ul className="space-y-1 text-sm text-ink-soft">
                  {f.analysis.strengths.map((st) => (
                    <li key={st}>• {st}</li>
                  ))}
                </ul>
                {f.analysis.vocabulary.length > 0 && (
                  <p className="text-sm text-muted">
                    Vocabulary ideas: {f.analysis.vocabulary.map((v) => `“${v.phrase}” → ${v.alternatives.slice(0, 2).join(" / ")}`).join("; ")}
                  </p>
                )}
                <div className="rounded-2xl bg-lavender p-4 text-sm">
                  <p className="font-bold text-brand-700">Suggested exercise: {f.analysis.exercise.title}</p>
                  <p className="mt-1 text-ink-soft">{f.analysis.exercise.instructions}</p>
                </div>
                {f.analysis.limitations.map((l) => (
                  <p key={l} className="text-xs text-muted">
                    {l}
                  </p>
                ))}
              </div>
            ) : (
              <AnalysisView analysis={f.analysis} sourceKind={f.kind === "battle" ? "battle" : "coach"} sourceId={s.id} savedKeys={detail.savedKeys} />
            )}
          </CardBody>
        </Card>
      ))}

      {feedback.length === 0 && s.type !== "free_talk" && (
        <EmptyState title="No feedback for this session" description="Feedback is created when an answer is analyzed." />
      )}
    </div>
  );
}
