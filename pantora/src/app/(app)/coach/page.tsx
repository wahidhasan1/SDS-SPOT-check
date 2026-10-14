import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, ChartColumn, ChevronRight, Dumbbell, History } from "lucide-react";
import { requireUser } from "@/server/auth";
import { listFeedback, listSavedSentences, listTopics, mistakePatterns } from "@/server/queries";
import { sttConfigured } from "@/server/stt";
import { config } from "@/server/config";
import { COACH_PROMPTS } from "@/content/coach-prompts";
import { ISSUE_CATEGORY_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/dates";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { SampleBadge, Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { CoachExperience } from "@/features/coach/coach-experience";

export const metadata: Metadata = { title: "AI Speaking Coach" };

const EXERCISE_FOR: Record<string, string> = {
  tense: "Tell the story of your last weekend using only past tense verbs.",
  agreement: "Describe a friend's routine: every verb after he/she needs -s.",
  articles: "Describe your street, choosing a / an / the before every noun.",
  prepositions: "Make sentences with for/since, interested in, depend on, listen to.",
  "word-choice": "Use take a photo, make a mistake, tell me, and really like.",
  "word-form": "Talk about advice, information, and homework without adding -s.",
  "sentence-structure": "Give three opinions: I agree that…, I suggest trying…, You should…",
  punctuation: "Read your improved answers aloud, pausing at commas.",
};

export default async function CoachPage({ searchParams }: { searchParams: Promise<{ topic?: string; prompt?: string }> }) {
  const { profile } = await requireUser();
  const params = await searchParams;
  const topic = listTopics().find((t) => t.id === params.topic);
  const recent = listFeedback(profile.id, { kind: "coach", limit: 5 });
  const patterns = mistakePatterns(profile.id).slice(0, 5);
  const saved = listSavedSentences(profile.id);
  const maxCount = Math.max(1, ...patterns.map((p) => p.count));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <CoachExperience
        prompts={COACH_PROMPTS}
        topicPrompt={topic ? { id: `topic:${topic.id}`, prompt: topic.openingQuestion, title: topic.title } : null}
        initialPromptId={COACH_PROMPTS.find((p) => p.id === params.prompt)?.id ?? null}
        sttConfigured={sttConfigured()}
        aiConfigured={Boolean(config.ai.anthropicKey)}
      />
      <div className="space-y-6">
        <Card>
          <CardHeader title="My Learning" icon={<Bookmark className="h-5 w-5" />} description={`${saved.length} saved sentence${saved.length === 1 ? "" : "s"}`} />
          <CardBody>
            {saved.slice(0, 2).map((s) => (
              <div key={s.id} className="mb-3 rounded-xl bg-surface-muted/60 p-3 text-sm">
                <p className="font-semibold">{s.corrected}</p>
              </div>
            ))}
            <ButtonLink href="/coach/saved" variant="secondary" size="sm" className="w-full">
              Open My Learning
            </ButtonLink>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Common mistake patterns" icon={<ChartColumn className="h-5 w-5" />} description="From all your feedback" />
          <CardBody>
            {patterns.length === 0 ? (
              <p className="text-sm text-muted">Not enough feedback yet. Patterns appear after a few answers are analyzed.</p>
            ) : (
              <ul className="space-y-3">
                {patterns.map((p) => (
                  <li key={p.category}>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{ISSUE_CATEGORY_LABELS[p.category]}</span>
                      <span className="text-muted">{p.count}×</span>
                    </div>
                    <ProgressBar value={p.count} max={maxCount} className="mt-1.5" label={`${ISSUE_CATEGORY_LABELS[p.category]} frequency`} />
                    {p.example && (
                      <p className="mt-1 text-xs text-muted">
                        e.g. “{p.example.original}” → “{p.example.corrected}”
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Suggested next exercises" icon={<Dumbbell className="h-5 w-5" />} />
          <CardBody>
            <ul className="space-y-2 text-sm text-ink-soft">
              {(patterns.length ? patterns.slice(0, 3).map((p) => EXERCISE_FOR[p.category]) : ["Answer one prompt by recording your voice.", "Add a reason with “because” to every opinion.", "Try a 30-second Speaking Battle."]).map((e) => (
                <li key={e} className="flex gap-2">
                  <span className="text-brand-500">•</span> {e}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recent feedback" icon={<History className="h-5 w-5" />} />
          <CardBody className="pt-3">
            {recent.length === 0 ? (
              <EmptyState title="No coach feedback yet" description="Your analyzed answers will be listed here." className="py-6" />
            ) : (
              <ul className="-mx-2 divide-y divide-line/60">
                {recent.map((f) => (
                  <li key={f.id}>
                    <Link href={f.sessionId ? `/history/${f.sessionId}` : "/history"} className="flex items-center gap-2 rounded-xl px-2 py-2.5 hover:bg-surface-muted/70">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{f.promptText}</span>
                        <span className="text-xs text-muted">
                          {formatDate(f.createdAt, profile.timezone)} · {f.inputMode === "spoken" ? "Spoken" : "Typed"}
                        </span>
                      </span>
                      {f.origin === "seed" ? <SampleBadge label="Sample" /> : f.reviewed ? <Badge tone="success">Reviewed</Badge> : null}
                      <ChevronRight className="h-4 w-4 text-subtle" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
