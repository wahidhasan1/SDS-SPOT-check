"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { GraduationCap, Keyboard, Mic, RotateCcw, Wand2 } from "lucide-react";
import type { CoachPrompt } from "@/content/coach-prompts";
import type { AnalysisResult } from "@/lib/types";
import type { Rewards } from "@/server/services/gamification";
import { DIFFICULTY_LABELS } from "@/lib/labels";
import { api, errorMessage } from "@/lib/api-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FieldHint, Input, Label, Segmented, Select, Textarea } from "@/components/ui/form";
import { SpokenAnswer, type SpokenAnswerValue } from "@/features/audio/spoken-answer";
import { AnalysisView } from "@/features/practice/analysis-view";
import { RewardsSummary } from "@/features/practice/rewards-summary";

interface CoachResponse {
  sessionId: string;
  feedbackId: string;
  analysis: AnalysisResult;
  rewards: Rewards | null;
  providerNotice: string | null;
  duplicate: boolean;
}

export function CoachExperience({
  prompts,
  topicPrompt,
  initialPromptId,
  sttConfigured,
  aiConfigured,
}: {
  prompts: CoachPrompt[];
  topicPrompt: { id: string; prompt: string; title: string } | null;
  initialPromptId: string | null;
  sttConfigured: boolean;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [promptId, setPromptId] = useState<string>(topicPrompt?.id ?? initialPromptId ?? prompts[0].id);
  const [custom, setCustom] = useState("");
  const [mode, setMode] = useState<"typed" | "spoken">("typed");
  const [text, setText] = useState("");
  const [spoken, setSpoken] = useState<SpokenAnswerValue | null>(null);
  const [recorderKey, setRecorderKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoachResponse | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const idem = useRef<string>("");

  const preset = prompts.find((p) => p.id === promptId);
  const promptText = promptId === "custom" ? custom.trim() : promptId === topicPrompt?.id ? topicPrompt.prompt : preset?.prompt ?? "";
  const answer = mode === "typed" ? text.trim() : (spoken?.text ?? "").trim();
  const canSubmit = promptText.length >= 3 && answer.length >= 3 && !loading;

  async function analyze() {
    if (!canSubmit) {
      setError(promptText.length < 3 ? "Choose or write a prompt first." : "Write or record a response first.");
      return;
    }
    setLoading(true);
    setError(null);
    idem.current ||= crypto.randomUUID();
    try {
      const res = await api<CoachResponse>("/api/coach", {
        body: {
          promptId: promptId === "custom" ? null : promptId,
          promptText,
          response: answer,
          inputMode: mode === "spoken" && spoken?.hasRecording ? "spoken" : "typed",
          recordedSeconds: mode === "spoken" ? spoken?.recordedSeconds ?? 0 : 0,
          idempotencyKey: idem.current,
        },
      });
      setResult(res);
      router.refresh();
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    setResult(null);
    setText("");
    setSpoken(null);
    setRecorderKey((k) => k + 1);
    idem.current = "";
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Practice with your coach"
          description="Answer a prompt by typing or speaking. You'll get an improved version, clear explanations, and one focused exercise."
          icon={<GraduationCap className="h-5 w-5" />}
          action={<Badge tone={aiConfigured ? "brand" : "demo"}>{aiConfigured ? "AI provider connected" : "Demo analyzer"}</Badge>}
        />
        <CardBody className="space-y-5">
          <div>
            <Label htmlFor="coach-prompt">Practice prompt</Label>
            <Select
              id="coach-prompt"
              value={promptId}
              onChange={(e) => {
                setPromptId(e.target.value);
                idem.current = "";
              }}
              disabled={!!result}
            >
              {topicPrompt && <option value={topicPrompt.id}>Topic: {topicPrompt.title}</option>}
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.prompt}
                </option>
              ))}
              <option value="custom">Write my own prompt…</option>
            </Select>
            {preset && promptId === preset.id && (
              <FieldHint>
                Focus: {preset.focus} · {DIFFICULTY_LABELS[preset.difficulty]}
              </FieldHint>
            )}
            {promptId === "custom" && (
              <Input className="mt-2" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Describe your favorite season and why." maxLength={500} disabled={!!result} />
            )}
          </div>

          <div className="rounded-2xl bg-lavender p-4">
            <p className="text-lg font-bold text-ink">{promptText || "Your prompt will appear here."}</p>
          </div>

          {!result && (
            <>
              <Segmented
                label="Answer method"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "typed", label: <span className="inline-flex items-center gap-1.5"><Keyboard className="h-4 w-4" /> Type</span> },
                  { value: "spoken", label: <span className="inline-flex items-center gap-1.5"><Mic className="h-4 w-4" /> Record</span> },
                ]}
              />
              {mode === "typed" ? (
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <Label htmlFor="coach-answer" className="mb-0">
                      Your response
                    </Label>
                    {preset && (
                      <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-800" onClick={() => setText(preset.sampleAnswer)}>
                        <Wand2 className="h-4 w-4" /> Use a sample answer
                      </button>
                    )}
                  </div>
                  <Textarea id="coach-answer" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder="Write your answer the way you would say it." className="min-h-36" />
                  <FieldHint>
                    {text.trim().split(/\s+/).filter(Boolean).length} words · Typed answers are analyzed as text only; pronunciation and speaking speed aren&apos;t measured.
                  </FieldHint>
                </div>
              ) : (
                <SpokenAnswer key={recorderKey} maxSeconds={90} sttConfigured={sttConfigured} onChange={setSpoken} />
              )}
              {error && (
                <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
                  {error}
                </p>
              )}
              <Button size="lg" onClick={analyze} loading={loading} disabled={!answer || loading}>
                {loading ? "Analyzing your response…" : "Analyze Response"}
              </Button>
            </>
          )}
        </CardBody>
      </Card>

      {result && (
        <div ref={resultRef} className="scroll-mt-24 space-y-6">
          {result.rewards && (
            <Card>
              <CardBody>
                <RewardsSummary rewards={result.rewards} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Your feedback" description={promptText} />
            <CardBody>
              <AnalysisView analysis={result.analysis} sourceKind="coach" sourceId={result.sessionId} providerNotice={result.providerNotice} />
            </CardBody>
          </Card>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={startOver}>
              <RotateCcw className="h-4 w-4" /> Try another answer
            </Button>
            <ButtonLink href={`/history/${result.sessionId}`} size="lg" variant="outline">
              Open in history
            </ButtonLink>
            <ButtonLink href="/coach/saved" size="lg" variant="ghost">
              My Learning
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}
