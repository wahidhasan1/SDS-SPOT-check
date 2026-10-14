"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Hourglass,
  Keyboard,
  Medal,
  Mic,
  Scale,
  Shuffle,
  Swords,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { BattlePrompt } from "@/content/battle-prompts";
import type { BattleEvaluation, DemoPartner, Difficulty, TopicCategory } from "@/lib/types";
import { DIFFICULTIES, TOPIC_CATEGORIES } from "@/lib/types";
import { CATEGORY_LABELS, DIFFICULTY_LABELS, PROFICIENCY_LABELS } from "@/lib/labels";
import type { Rewards } from "@/server/services/gamification";
import { api, errorMessage } from "@/lib/api-client";
import { formatClock, formatDate } from "@/lib/dates";
import { SCORING_NOTE } from "@/lib/analysis/demo-analyzer";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, SampleBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Label, Segmented, Select, Textarea, FieldHint } from "@/components/ui/form";
import { ProgressRing } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { SpokenAnswer, type SpokenAnswerValue } from "@/features/audio/spoken-answer";
import { RewardsSummary } from "@/features/practice/rewards-summary";
import { ScoreBreakdown } from "./score-breakdown";
import { ConfirmDialog } from "@/components/ui/dialog";

type Stage = "home" | "finding" | "topic" | "prep" | "speaking" | "analyzing" | "result";

interface RecentBattle {
  id: string;
  sessionId: string;
  promptText: string;
  opponentName: string;
  result: string;
  userScore: number | null;
  opponentScore: number | null;
  createdAt: string;
  sample: boolean;
}

interface BattleResponse {
  sessionId: string;
  evaluation: BattleEvaluation;
  rewards: Rewards;
  providerNotice: string | null;
  duplicate: boolean;
}

const RULES = [
  ["Fluency and continuity", 25, "How long and how smoothly you keep talking, and how you link ideas."],
  ["Grammar and sentence construction", 25, "How often common error patterns appear for the number of words you used."],
  ["Vocabulary and expression", 20, "Variety and precision of your words, and avoiding overused phrases."],
  ["Relevance and clarity", 20, "Whether you answer the prompt directly in clear sentences."],
  ["Response development", 10, "Reasons, examples, and a clear finish."],
] as const;

export function BattleExperience({
  prompts,
  dailyChallengeId,
  initialPromptId,
  sttConfigured,
  stats,
  bestDimensions,
  recent,
  timeZone,
}: {
  prompts: BattlePrompt[];
  dailyChallengeId: string;
  initialPromptId: string | null;
  sttConfigured: boolean;
  stats: { total: number; wins: number; draws: number; losses: number; best: number | null; average: number | null };
  bestDimensions: { key: string; label: string; max: number; best: number }[];
  recent: RecentBattle[];
  timeZone: string;
}) {
  const router = useRouter();
  const daily = prompts.find((p) => p.id === dailyChallengeId)!;
  const [stage, setStage] = useState<Stage>("home");
  const [difficulty, setDifficulty] = useState<Difficulty | "any">("any");
  const [category, setCategory] = useState<TopicCategory | "any">("any");
  const [prepSeconds, setPrepSeconds] = useState(30);
  const [speakSeconds, setSpeakSeconds] = useState(30);
  const [inputMode, setInputMode] = useState<"spoken" | "typed">("spoken");
  const [selectedId, setSelectedId] = useState<string | null>(initialPromptId);
  const [prompt, setPrompt] = useState<BattlePrompt | null>(null);
  const [opponent, setOpponent] = useState<DemoPartner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [typed, setTyped] = useState("");
  const [typingStarted, setTypingStarted] = useState(false);
  const [spoken, setSpoken] = useState<SpokenAnswerValue | null>(null);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState<BattleResponse | null>(null);
  const [view, setView] = useState<"you" | "opponent">("you");
  const [confirmQuit, setConfirmQuit] = useState(false);
  const startedAt = useRef<string>("");
  const idem = useRef("");

  const filtered = useMemo(
    () => prompts.filter((p) => (difficulty === "any" || p.difficulty === difficulty) && (category === "any" || p.category === category)),
    [prompts, difficulty, category],
  );
  const selected = selectedId ? prompts.find((p) => p.id === selectedId) ?? null : null;

  async function begin(p: BattlePrompt | null) {
    const chosen = p ?? filtered[Math.floor(Math.random() * filtered.length)];
    if (!chosen) {
      setError("No challenges match these filters. Try another difficulty or category.");
      return;
    }
    setError(null);
    setPrompt(chosen);
    setStage("finding");
    idem.current = crypto.randomUUID();
    startedAt.current = new Date().toISOString();
    try {
      const [res] = await Promise.all([
        api<{ partner: DemoPartner }>("/api/match", { body: { mode: "battle", promptId: chosen.id, topicId: chosen.topicId } }),
        new Promise((r) => setTimeout(r, 1800)),
      ]);
      setOpponent(res.partner);
      setStage((s) => (s === "finding" ? "topic" : s));
    } catch (e) {
      setError(errorMessage(e));
      setStage("home");
    }
  }

  // Countdowns
  useEffect(() => {
    if (stage !== "prep" && !(stage === "speaking" && inputMode === "typed" && typingStarted)) return;
    if (countdown <= 0) {
      if (stage === "prep") startSpeaking();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, countdown, typingStarted, inputMode]);

  function startPrep() {
    setCountdown(prepSeconds);
    setStage(prepSeconds > 0 ? "prep" : "speaking");
    if (prepSeconds === 0) startSpeaking();
  }

  function startSpeaking() {
    setStage("speaking");
    setTyped("");
    setSpoken(null);
    if (inputMode === "typed") {
      setCountdown(speakSeconds);
      setTypingStarted(true);
    }
  }

  const responseText = inputMode === "typed" ? typed.trim() : (spoken?.text ?? "").trim();
  const timeUp = inputMode === "typed" && typingStarted && countdown <= 0;

  async function submit() {
    if (!prompt || !opponent || !responseText) return;
    setStage("analyzing");
    setError(null);
    try {
      const [res] = await Promise.all([
        api<BattleResponse>("/api/battles", {
          body: {
            idempotencyKey: idem.current,
            promptId: prompt.id,
            opponentId: opponent.id,
            prepSeconds,
            speakSeconds,
            response: responseText,
            inputMode: inputMode === "spoken" && spoken?.hasRecording ? "spoken" : "typed",
            recordedSeconds: inputMode === "spoken" ? spoken?.recordedSeconds ?? 0 : 0,
            startedAt: startedAt.current,
          },
        }),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
      setResult(res);
      setView("you");
      setStage("result");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setStage("speaking");
    }
  }

  function playAgain() {
    setResult(null);
    setPrompt(null);
    setOpponent(null);
    setTypingStarted(false);
    setSpoken(null);
    setTyped("");
    setSelectedId(null);
    setStage("home");
  }

  const inFlow = stage !== "home" && stage !== "result";

  // ---------- Home ----------
  if (stage === "home") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            {/* Today's challenge / selected */}
            <Card className="overflow-hidden">
              <div className="relative bg-navy-900 p-6 text-white sm:p-8">
                <div className="pointer-events-none absolute -top-20 -right-10 h-60 w-60 rounded-full bg-streak-500/25 blur-3xl" aria-hidden />
                <div className="relative">
                  <p className="flex items-center gap-2 text-sm font-bold text-streak-400">
                    <Zap className="h-4 w-4" /> {selected && selected.id !== daily.id ? "Selected challenge" : "Today's challenge"}
                  </p>
                  <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{(selected ?? daily).prompt}</h2>
                  <p className="mt-2 text-white/70">{(selected ?? daily).guidance}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone="dark">{CATEGORY_LABELS[(selected ?? daily).category]}</Badge>
                    <Badge tone="dark">{DIFFICULTY_LABELS[(selected ?? daily).difficulty]}</Badge>
                    <Badge tone="dark">{speakSeconds}s to speak</Badge>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button size="lg" onClick={() => begin(selected ?? daily)}>
                      <Swords className="h-5 w-5" /> Start this challenge
                    </Button>
                    {selected && selected.id !== daily.id && (
                      <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={() => setSelectedId(null)}>
                        Back to today&apos;s challenge
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Setup */}
            <Card>
              <CardHeader title="Start a Practice Battle" description="Pick your settings and get a random challenge." icon={<Shuffle className="h-5 w-5" />} />
              <CardBody className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="difficulty">Difficulty</Label>
                    <Select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | "any")}>
                      <option value="any">Any difficulty</option>
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {DIFFICULTY_LABELS[d]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="category">Topic category</Label>
                    <Select id="category" value={category} onChange={(e) => setCategory(e.target.value as TopicCategory | "any")}>
                      <option value="any">Any category</option>
                      {TOPIC_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>Preparation time</Label>
                    <Segmented label="Preparation time" value={prepSeconds} onChange={setPrepSeconds} options={[0, 15, 30, 60].map((v) => ({ value: v, label: v === 0 ? "None" : `${v}s` }))} />
                  </div>
                  <div>
                    <Label>Speaking time</Label>
                    <Segmented label="Speaking time" value={speakSeconds} onChange={setSpeakSeconds} options={[30, 45, 60].map((v) => ({ value: v, label: `${v}s` }))} />
                  </div>
                </div>
                <div>
                  <Label>How will you answer?</Label>
                  <Segmented
                    label="Answer method"
                    value={inputMode}
                    onChange={setInputMode}
                    options={[
                      { value: "spoken", label: <span className="inline-flex items-center gap-1.5"><Mic className="h-4 w-4" /> Record my voice</span> },
                      { value: "typed", label: <span className="inline-flex items-center gap-1.5"><Keyboard className="h-4 w-4" /> Type my answer</span> },
                    ]}
                  />
                  <FieldHint>
                    {inputMode === "spoken"
                      ? "Your recording stays in your browser. Feedback uses a transcript (browser captions, typed, or server speech-to-text if configured)."
                      : "Typing works everywhere. Pronunciation and speaking speed are not measured for typed answers."}
                  </FieldHint>
                </div>
                <p className="text-sm text-muted">
                  {filtered.length} challenge{filtered.length === 1 ? "" : "s"} match these filters.
                </p>
                {error && (
                  <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
                    {error}
                  </p>
                )}
                <Button size="lg" onClick={() => begin(null)} disabled={filtered.length === 0}>
                  <Shuffle className="h-5 w-5" /> Start a Practice Battle
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Recent battle results" icon={<Trophy className="h-5 w-5" />} action={<ButtonLink href="/history?type=battle" variant="ghost" size="sm">All battles</ButtonLink>} />
              <CardBody className="pt-3">
                {recent.length === 0 ? (
                  <EmptyState icon={<Swords className="h-6 w-6" />} title="No battles yet" description="Your results will appear here after your first challenge." />
                ) : (
                  <ul className="-mx-3 divide-y divide-line/60">
                    {recent.map((b) => (
                      <li key={b.id}>
                        <Link href={`/history/${b.sessionId}`} className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-surface-muted/70">
                          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold", b.result === "win" ? "bg-success-50 text-success-700" : b.result === "draw" ? "bg-info-50 text-info-700" : "bg-surface-muted text-muted")}>
                            {b.userScore ?? "–"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{b.promptText}</span>
                            <span className="text-xs text-muted">
                              vs {b.opponentName} ({b.opponentScore ?? "–"}) · {formatDate(b.createdAt, timeZone)}
                            </span>
                          </span>
                          {b.sample && <SampleBadge label="Sample" />}
                          <Badge tone={b.result === "win" ? "success" : b.result === "draw" ? "info" : "neutral"}>{b.result === "win" ? "Won" : b.result === "draw" ? "Draw" : b.result === "loss" ? "Lost" : "No result"}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Battle statistics" icon={<Medal className="h-5 w-5" />} />
              <CardBody>
                <div className="grid grid-cols-2 gap-3 text-center">
                  {[
                    ["Battles", stats.total],
                    ["Wins", stats.wins],
                    ["Best score", stats.best ?? "–"],
                    ["Average", stats.average ?? "–"],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-2xl bg-surface-muted/60 p-3">
                      <p className="text-2xl font-extrabold">{value}</p>
                      <p className="text-xs font-semibold text-muted">{label}</p>
                    </div>
                  ))}
                </div>
                {bestDimensions.length > 0 && (
                  <>
                    <p className="mt-5 text-xs font-bold tracking-wide text-muted uppercase">Personal bests</p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {bestDimensions.map((d) => (
                        <li key={d.key} className="flex justify-between gap-3">
                          <span className="text-ink-soft">{d.label}</span>
                          <span className="font-semibold">
                            {d.best}/{d.max}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Rules and scoring" icon={<Scale className="h-5 w-5" />} />
              <CardBody className="space-y-3 text-sm">
                <ol className="list-decimal space-y-1 pl-5 text-ink-soft">
                  <li>You and an opponent get the same prompt.</li>
                  <li>Prepare, then speak for up to {speakSeconds} seconds.</li>
                  <li>Both answers are scored with the same 100-point rubric.</li>
                  <li>Scores within 2 points are a draw.</li>
                </ol>
                <ul className="space-y-2 border-t border-line pt-3">
                  {RULES.map(([label, max, desc]) => (
                    <li key={label}>
                      <p className="flex justify-between font-semibold">
                        <span>{label}</span>
                        <span>{max}</span>
                      </p>
                      <p className="text-muted">{desc}</p>
                    </li>
                  ))}
                </ul>
                <p className="border-t border-line pt-3 text-xs text-muted">{SCORING_NOTE} Pronunciation is scored only when a reliable speech-analysis service is available, and accent never affects scores.</p>
                <p className="text-xs text-muted">In demo mode, opponents are fictional and their answers are pre-written samples. Every battle earns XP, win or lose.</p>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ---------- In-flow ----------
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {inFlow && (
        <div className="flex items-center justify-between">
          <Badge tone="demo">Simulated battle · demo opponent</Badge>
          {stage !== "analyzing" && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmQuit(true)}>
              <X className="h-4 w-4" /> Quit battle
            </Button>
          )}
        </div>
      )}

      {stage === "finding" && (
        <Card>
          <CardBody className="flex flex-col items-center py-14 text-center">
            <div className="relative flex h-24 w-24 items-center justify-center" aria-hidden>
              <span className="absolute inset-0 animate-ping-slow rounded-full bg-streak-100" />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-streak-500 text-white">
                <Users className="h-7 w-7" />
              </span>
            </div>
            <h2 className="mt-6 text-xl font-bold">Finding an opponent…</h2>
            <p className="mt-1 text-muted">Demo mode uses fictional opponents with pre-written sample answers.</p>
          </CardBody>
        </Card>
      )}

      {prompt && opponent && (stage === "topic" || stage === "prep" || stage === "speaking" || stage === "analyzing") && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 bg-navy-900 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <Avatar name="You" avatar="aurora" size="md" />
              <div>
                <p className="font-bold">You</p>
                <p className="text-xs text-white/60">{inputMode === "spoken" ? "Voice answer" : "Typed answer"}</p>
              </div>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-extrabold tracking-wide">VS</span>
            <div className="flex items-center gap-3 text-right">
              <div>
                <p className="font-bold">{opponent.displayName}</p>
                <p className="text-xs text-white/60">{PROFICIENCY_LABELS[opponent.proficiency]} · demo</p>
              </div>
              <Avatar name={opponent.displayName} avatar={opponent.avatar} size="md" />
            </div>
          </div>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">{CATEGORY_LABELS[prompt.category]}</Badge>
              <Badge tone="neutral">{DIFFICULTY_LABELS[prompt.difficulty]}</Badge>
            </div>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight">{prompt.prompt}</h2>
            <p className="mt-2 text-muted">{prompt.guidance}</p>

            {stage === "topic" && (
              <div className="mt-6 space-y-4">
                <ul className="space-y-1.5 text-sm text-ink-soft">
                  <li>• Preparation: {prepSeconds === 0 ? "none" : `${prepSeconds} seconds`}</li>
                  <li>• Speaking: up to {speakSeconds} seconds{inputMode === "spoken" ? " (the timer starts when you press record)" : " (the timer starts when the writing box appears)"}</li>
                  <li>• {opponent.displayName}&apos;s answer is a pre-written sample, revealed after you submit.</li>
                </ul>
                <Button size="lg" onClick={startPrep}>
                  {prepSeconds ? "Start preparation" : "Start speaking"} <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            )}

            {stage === "prep" && (
              <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl bg-lavender p-6 text-center">
                <ProgressRing value={countdown / prepSeconds} size={120} label={`${countdown} seconds of preparation left`}>
                  <span className="font-mono text-3xl font-extrabold tabular-nums">{countdown}</span>
                  <span className="text-xs font-semibold text-muted">seconds</span>
                </ProgressRing>
                <p className="flex items-center gap-2 font-semibold">
                  <Hourglass className="h-4 w-4" /> Plan your answer: one main idea, one reason, one example.
                </p>
                <Button variant="secondary" onClick={() => startSpeaking()}>
                  I&apos;m ready
                </Button>
              </div>
            )}

            {(stage === "speaking" || stage === "analyzing") && (
              <div className="mt-6 space-y-4">
                {inputMode === "spoken" ? (
                  <SpokenAnswer
                    maxSeconds={speakSeconds}
                    sttConfigured={sttConfigured}
                    onChange={setSpoken}
                    onRecordingStart={() => setRecording(true)}
                    onRecordingStop={() => setRecording(false)}
                    disabled={stage === "analyzing"}
                    autoFocusRecord
                  />
                ) : (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Label htmlFor="typed-answer" className="mb-0">
                        Your answer
                      </Label>
                      <span className={cn("font-mono text-lg font-bold tabular-nums", countdown <= 5 ? "text-danger-600" : "text-ink")} aria-live="polite">
                        {formatClock(countdown)}
                      </span>
                    </div>
                    <Textarea
                      id="typed-answer"
                      autoFocus
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      disabled={timeUp || stage === "analyzing"}
                      placeholder="Write your answer as if you were saying it out loud."
                      className="min-h-40"
                    />
                    <FieldHint>{timeUp ? "Time's up! Submit your answer." : "Write the way you would speak. You can't edit after the timer ends."}</FieldHint>
                  </div>
                )}
                {error && (
                  <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
                    {error}
                  </p>
                )}
                <Button size="lg" onClick={submit} disabled={!responseText || recording} loading={stage === "analyzing"}>
                  {stage === "analyzing" ? "Analyzing both answers…" : "Submit answer"}
                </Button>
                {inputMode === "spoken" && !responseText && spoken?.hasRecording && (
                  <p className="text-sm text-muted">Add the text of your answer above so it can be scored.</p>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {stage === "result" && result && prompt && opponent && (
        <BattleResult result={result} prompt={prompt} opponent={opponent} view={view} setView={setView} onPlayAgain={playAgain} />
      )}

      <ConfirmDialog
        open={confirmQuit}
        onClose={() => setConfirmQuit(false)}
        title="Quit this battle?"
        description="Your answer won't be saved and you won't earn XP for this battle."
        confirmLabel="Quit"
        tone="danger"
        onConfirm={() => {
          setConfirmQuit(false);
          playAgain();
        }}
      />
    </div>
  );
}

function BattleResult({
  result,
  prompt,
  opponent,
  view,
  setView,
  onPlayAgain,
}: {
  result: BattleResponse;
  prompt: BattlePrompt;
  opponent: DemoPartner;
  view: "you" | "opponent";
  setView: (v: "you" | "opponent") => void;
  onPlayAgain: () => void;
}) {
  const ev = result.evaluation;
  const headline =
    ev.result === "win" ? "You won this round!" : ev.result === "draw" ? "It's a draw!" : ev.result === "loss" ? `${opponent.displayName} took this round` : "Scores ready";
  const encouragement =
    ev.result === "win"
      ? "Great answer. Check the feedback to see what made it work."
      : ev.result === "loss"
        ? "Every battle builds your speaking muscles. Look at one improvement below and try again."
        : "Neck and neck. Small improvements can make the difference.";
  const side = view === "you" ? ev.user : ev.opponent;
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className={cn("px-6 py-8 text-center", ev.result === "win" ? "bg-gradient-to-br from-success-50 to-surface" : "bg-gradient-to-br from-lavender to-surface")}>
          <Badge tone="demo">Simulated result</Badge>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">{headline}</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted">{encouragement}</p>
          <div className="mt-6 flex items-center justify-center gap-6 sm:gap-12">
            <div>
              <p className="text-5xl font-extrabold tabular-nums">{ev.user.score.total}</p>
              <p className="mt-1 text-sm font-semibold text-muted">You</p>
            </div>
            <span className="text-lg font-bold text-subtle">vs</span>
            <div>
              <p className="text-5xl font-extrabold text-ink-soft tabular-nums">{ev.opponent.score.total}</p>
              <p className="mt-1 text-sm font-semibold text-muted">{opponent.displayName} (sample)</p>
            </div>
          </div>
          <p className="mx-auto mt-5 max-w-xl text-xs text-muted">{ev.resultNote}</p>
        </div>
        <CardBody className="space-y-4">
          {result.providerNotice && <p className="rounded-xl bg-streak-50 px-3.5 py-2.5 text-sm text-streak-700">{result.providerNotice}</p>}
          {result.duplicate ? (
            <p className="text-sm text-muted">This battle was already saved, so no additional XP was awarded.</p>
          ) : (
            <RewardsSummary rewards={result.rewards} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Feedback"
          description={prompt.prompt}
          icon={<BookOpen className="h-5 w-5" />}
          action={<Badge tone={ev.user.score.analyzer === "anthropic" ? "brand" : "demo"}>{ev.user.score.analyzer === "anthropic" ? "AI feedback" : "Demo analyzer"}</Badge>}
        />
        <CardBody className="space-y-5">
          <Segmented
            label="Whose feedback"
            value={view}
            onChange={setView}
            options={[
              { value: "you", label: "Your answer" },
              { value: "opponent", label: `${opponent.displayName}'s sample` },
            ]}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface-muted/60 p-4">
              <p className="text-xs font-bold tracking-wide text-muted uppercase">{view === "you" ? "What you said" : "Sample answer (pre-written)"}</p>
              <p className="mt-2 text-sm leading-relaxed">{side.analysis.original}</p>
            </div>
            <div className="rounded-2xl bg-success-50/70 p-4">
              <p className="text-xs font-bold tracking-wide text-success-700 uppercase">Improved version</p>
              <p className="mt-2 text-sm leading-relaxed">{side.analysis.improved}</p>
            </div>
          </div>
          <p className="text-ink-soft">{side.analysis.summary}</p>
          <ScoreBreakdown score={side.score} />
          {side.analysis.limitations.map((l) => (
            <p key={l} className="text-xs text-muted">
              {l}
            </p>
          ))}
        </CardBody>
      </Card>

      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={onPlayAgain}>
          <Swords className="h-5 w-5" /> Play again
        </Button>
        <ButtonLink href={`/history/${result.sessionId}`} size="lg" variant="outline">
          Review in history
        </ButtonLink>
        <ButtonLink href="/dashboard" size="lg" variant="ghost">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
