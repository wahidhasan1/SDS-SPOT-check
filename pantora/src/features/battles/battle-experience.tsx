"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Flame,
  Gauge,
  Hourglass,
  Keyboard,
  Mic,
  RotateCcw,
  Shuffle,
  Sparkles,
  Swords,
  Target,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import type { BattlePrompt } from "@/content/battle-prompts";
import { MODE_COLOR_CLASSES, getBattleMode, type BattleMode } from "@/content/battle-modes";
import type { BattleEvaluation, DemoPartner, Difficulty, TopicCategory } from "@/lib/types";
import { DIFFICULTIES, TOPIC_CATEGORIES } from "@/lib/types";
import { CATEGORY_LABELS, DIFFICULTY_LABELS, PROFICIENCY_LABELS } from "@/lib/labels";
import { XP_RULES } from "@/lib/game-rules";
import type { Rewards } from "@/server/services/gamification";
import { api, errorMessage } from "@/lib/api-client";
import { formatClock } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Label, Segmented, Select, Textarea, FieldHint } from "@/components/ui/form";
import { ProgressRing } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/ui/dialog";
import { BattleModeArt } from "@/components/art/battle-art";
import { TrophyArt } from "@/components/art/scene-art";
import { Mascot } from "@/components/art/mascot";
import { Confetti } from "@/components/game/celebration";
import { SpokenAnswer, type SpokenAnswerValue } from "@/features/audio/spoken-answer";
import { RewardsSummary } from "@/features/practice/rewards-summary";
import { EngineHint, EngineToggle } from "@/features/hosted/engine-toggle";
import { HOSTED_MIC_NOTICE, isHostedPreview } from "@/lib/runtime";
import { ScoreBreakdown } from "./score-breakdown";
import { modeDifficultyLabel, modeTimeLabel, type ModeStatLite } from "./mode-card";

type Stage = "detail" | "finding" | "topic" | "prep" | "speaking" | "analyzing" | "result";

interface BattleResponse {
  sessionId: string;
  evaluation: BattleEvaluation;
  rewards: Rewards;
  providerNotice: string | null;
  duplicate: boolean;
  isDailyChallenge?: boolean;
}

const STEPS: { key: Stage[]; label: string }[] = [
  { key: ["finding"], label: "Match" },
  { key: ["topic"], label: "Topic" },
  { key: ["prep"], label: "Prep" },
  { key: ["speaking"], label: "Speak" },
  { key: ["analyzing", "result"], label: "Score" },
];

export function BattleExperience({
  mode,
  prompts,
  dailyChallengeId,
  initialPromptId,
  autoStart,
  sttConfigured,
  modeStat,
  overallBest,
  bestDimensions,
  player,
}: {
  mode: BattleMode;
  prompts: BattlePrompt[];
  dailyChallengeId: string;
  initialPromptId: string | null;
  autoStart: boolean;
  sttConfigured: boolean;
  modeStat: ModeStatLite | null;
  overallBest: number | null;
  bestDimensions: { key: string; label: string; max: number; best: number }[];
  player: { displayName: string; avatar: string };
}) {
  const router = useRouter();
  const isFree = mode.id === "free-play";
  const colors = MODE_COLOR_CLASSES[mode.color];
  const [stage, setStage] = useState<Stage>(autoStart ? "finding" : "detail");
  const [choice, setChoice] = useState<string>(initialPromptId ?? "shuffle");
  const [difficulty, setDifficulty] = useState<Difficulty | "any">("any");
  const [category, setCategory] = useState<TopicCategory | "any">("any");
  const [prepSeconds, setPrepSeconds] = useState(isFree ? 30 : mode.prepSeconds);
  const [speakSeconds, setSpeakSeconds] = useState(isFree ? 45 : mode.speakSeconds);
  const [inputMode, setInputMode] = useState<"spoken" | "typed">(isHostedPreview ? "typed" : "spoken");
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
  const autoStarted = useRef(false);

  const pool = useMemo(
    () =>
      prompts.filter(
        (p) =>
          (isFree || p.mode === mode.id) &&
          (!isFree || ((difficulty === "any" || p.difficulty === difficulty) && (category === "any" || p.category === category))),
      ),
    [prompts, isFree, mode.id, difficulty, category],
  );
  const selected = choice === "shuffle" ? null : prompts.find((p) => p.id === choice) ?? null;
  const selectedMode = selected ? getBattleMode(selected.mode)! : mode;
  const xpForBattle = isFree ? (selected ? selectedMode.xp : null) : mode.xp;

  async function begin(p: BattlePrompt | null) {
    const chosen = p ?? pool[Math.floor(Math.random() * pool.length)];
    if (!chosen) {
      setError("No prompts match these filters. Try another difficulty or category.");
      setStage("detail");
      return;
    }
    setError(null);
    setPrompt(chosen);
    setResult(null);
    setTyped("");
    setSpoken(null);
    setTypingStarted(false);
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
      setStage("detail");
    }
  }

  // Started from a "Play now" link: skip the detail view.
  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    autoStarted.current = true;
    const t = setTimeout(() => begin(selected), 0);
    return () => {
      // Strict mode runs effects twice; let the second run schedule the start again.
      clearTimeout(t);
      autoStarted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const words = responseText ? responseText.split(/\s+/).length : 0;

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

  function backToDetail() {
    setResult(null);
    setPrompt(null);
    setOpponent(null);
    setTypingStarted(false);
    setSpoken(null);
    setTyped("");
    setStage("detail");
  }

  // ---------- Detail ----------
  if (stage === "detail") {
    return (
      <div className="space-y-6">
        <Link href="/battles" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> All battle types
        </Link>

        <section className={cn("relative overflow-hidden rounded-[2rem] bg-gradient-to-br p-3 shadow-card", colors.card)}>
          <div className="pointer-events-none absolute inset-0 bg-dots-light" aria-hidden />
          <div className="relative grid grid-cols-1 items-center gap-2 md:grid-cols-[18rem_minmax(0,1fr)]">
            <BattleModeArt mode={mode.id} className="mx-auto h-44 w-auto animate-bob md:h-52" />
            <div className="rounded-[1.5rem] bg-white p-5 sm:p-6">
              <p className={cn("text-xs font-extrabold tracking-[0.14em] uppercase", colors.text)}>Battle type</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{mode.name}</h1>
              <p className="mt-1 text-lg font-semibold text-ink-soft">{mode.tagline}</p>
              <p className="mt-2 text-muted">{mode.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1", colors.chip)}>
                  <Clock className="h-4 w-4" /> {isFree ? `${speakSeconds}s talk · ${prepSeconds}s prep` : modeTimeLabel(mode)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-ink-soft">
                  <Gauge className="h-4 w-4" /> {modeDifficultyLabel(mode)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sun-100 px-3 py-1 text-sun-700">
                  <Zap className="h-4 w-4 fill-sun-400 text-sun-500" /> {xpForBattle != null ? `${xpForBattle} XP` : "30–50 XP"}
                </span>
                {modeStat?.best != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-ink-soft">
                    <Trophy className="h-4 w-4" /> Best {modeStat.best}
                    {modeStat.sampleOnly ? " (sample)" : ""} · {modeStat.played} played
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card>
            <CardBody className="space-y-6">
              <div className={cn("rounded-2xl p-5", colors.soft)}>
                <p className={cn("flex items-center gap-1.5 text-xs font-extrabold tracking-wide uppercase", colors.text)}>
                  {selected ? (
                    <>
                      <Target className="h-4 w-4" /> {selected.id === dailyChallengeId ? "Today's Daily Challenge" : "Your prompt"}
                    </>
                  ) : (
                    <>
                      <Shuffle className="h-4 w-4" /> Surprise prompt
                    </>
                  )}
                </p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight">{selected ? selected.prompt : "A random prompt will be revealed when the battle starts."}</h2>
                {selected && <p className="mt-1 text-ink-soft">{selected.guidance}</p>}
              </div>

              {isFree && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                </div>
              )}

              <fieldset>
                <legend className="mb-2 text-sm font-bold">Pick a prompt</legend>
                <div className={cn("grid grid-cols-1 gap-2", isFree && "max-h-80 overflow-y-auto pr-1")} role="radiogroup" aria-label="Prompt">
                  <PromptOption checked={choice === "shuffle"} onSelect={() => setChoice("shuffle")} title="Shuffle" subtitle={`Surprise me with one of ${pool.length} prompt${pool.length === 1 ? "" : "s"}`} icon={<Shuffle className="h-4 w-4" />} />
                  {pool.map((p) => (
                    <PromptOption
                      key={p.id}
                      checked={choice === p.id}
                      onSelect={() => setChoice(p.id)}
                      title={p.prompt}
                      subtitle={`${isFree ? `${getBattleMode(p.mode)!.name} · ` : ""}${DIFFICULTY_LABELS[p.difficulty]} · ${CATEGORY_LABELS[p.category]}`}
                      daily={p.id === dailyChallengeId}
                    />
                  ))}
                </div>
              </fieldset>

              {isFree && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Preparation time</Label>
                    <Segmented label="Preparation time" value={prepSeconds} onChange={setPrepSeconds} options={[0, 15, 30, 60].map((v) => ({ value: v, label: v === 0 ? "None" : `${v}s` }))} />
                  </div>
                  <div>
                    <Label>Speaking time</Label>
                    <Segmented label="Speaking time" value={speakSeconds} onChange={setSpeakSeconds} options={[30, 45, 60].map((v) => ({ value: v, label: `${v}s` }))} />
                  </div>
                </div>
              )}

              <div>
                <Label>How will you answer?</Label>
                <Segmented
                  label="Answer method"
                  value={inputMode}
                  onChange={setInputMode}
                  options={[
                    ...(isHostedPreview ? [] : [{ value: "spoken" as const, label: <span className="inline-flex items-center gap-1.5"><Mic className="h-4 w-4" /> Record my voice</span> }]),
                    { value: "typed", label: <span className="inline-flex items-center gap-1.5"><Keyboard className="h-4 w-4" /> Type my answer</span> },
                  ]}
                />
                <FieldHint>
                  {isHostedPreview
                    ? HOSTED_MIC_NOTICE
                    : inputMode === "spoken"
                      ? "Your recording stays in your browser. Feedback uses a transcript (browser captions, typed, or server speech-to-text if configured)."
                      : "Typing works everywhere. Pronunciation and speaking speed are not measured for typed answers."}
                </FieldHint>
              </div>
              {isHostedPreview && (
                <div className="space-y-2">
                  <Label>Feedback by</Label>
                  <EngineToggle compact />
                  <EngineHint />
                </div>
              )}
              {error && (
                <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
                  {error}
                </p>
              )}
              <Button size="lg" variant="pink" className="w-full text-lg sm:w-auto" onClick={() => begin(selected)} disabled={!selected && pool.length === 0}>
                <Swords className="h-5 w-5" /> Start battle
              </Button>
            </CardBody>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader title="How it works" icon={<BookOpen className="h-5 w-5" />} />
              <CardBody>
                <ol className="space-y-3">
                  {["Get matched with a demo opponent", ...mode.howItWorks, "Both answers are scored out of 100"].map((step, i) => (
                    <li key={step} className="flex items-start gap-3">
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-extrabold", colors.chip)}>{i + 1}</span>
                      <span className="pt-0.5 font-semibold text-ink-soft">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs font-bold tracking-wide text-muted uppercase">Trains</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {mode.skills.map((s) => (
                    <Badge key={s} tone="brand">
                      {s}
                    </Badge>
                  ))}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Rewards" icon={<Sparkles className="h-5 w-5" />} />
              <CardBody>
                <ul className="space-y-2 text-sm">
                  <RewardRow label={isFree ? "Finish the battle (XP of the prompt's type)" : "Finish the battle, win or lose"} value={xpForBattle != null ? `+${xpForBattle} XP` : "+30–50 XP"} />
                  <RewardRow label={`Beat your best score${overallBest != null ? ` (${overallBest})` : ""}`} value={`+${XP_RULES.battlePersonalBest} XP`} />
                  <RewardRow label="Play today's Daily Challenge prompt" value={`+${XP_RULES.dailyChallenge} XP`} highlight={selected?.id === dailyChallengeId} />
                  <RewardRow label="Recorded answers count toward your streak minutes" value={<Flame className="h-4 w-4 text-orange-500" />} />
                </ul>
                {bestDimensions.length > 0 && (
                  <>
                    <p className="mt-4 text-xs font-bold tracking-wide text-muted uppercase">Your personal bests</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {bestDimensions.map((d) => (
                        <li key={d.key} className="flex justify-between gap-3">
                          <span className="text-ink-soft">{d.label}</span>
                          <span className="font-bold">
                            {d.best}/{d.max}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ---------- In the battle ----------
  const inFlow = stage !== "result";
  const stepIndex = STEPS.findIndex((s) => s.key.includes(stage));
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("flex h-10 w-12 items-center justify-center rounded-xl", colors.soft)}>
            <BattleModeArt mode={mode.id} className="h-8 w-auto" />
          </span>
          <div>
            <p className="font-display leading-tight font-extrabold">{mode.name}</p>
            <Badge tone="demo">Simulated battle · demo opponent</Badge>
          </div>
        </div>
        {inFlow && stage !== "analyzing" && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmQuit(true)}>
            <X className="h-4 w-4" /> Quit battle
          </Button>
        )}
      </div>

      <ol className="grid grid-cols-5 gap-1.5" aria-label="Battle progress">
        {STEPS.map((s, i) => (
          <li key={s.label} aria-current={i === stepIndex ? "step" : undefined}>
            <div className={cn("h-2 rounded-full transition-colors duration-500", i < stepIndex || stage === "result" ? "bg-mint-500" : i === stepIndex ? "bg-pink-500" : "bg-line")} />
            <p className={cn("mt-1 text-center text-[11px] font-bold", i === stepIndex ? "text-ink" : "text-subtle")}>{s.label}</p>
          </li>
        ))}
      </ol>

      {stage === "finding" && (
        <Card className="overflow-hidden">
          <div className="relative bg-navy-900 bg-dots-light px-6 py-12 text-center text-white">
            <div className="flex items-center justify-center gap-6 sm:gap-10">
              <div className="animate-slide-up text-center">
                <Avatar name={player.displayName} avatar={player.avatar} size="lg" className="ring-4 ring-brand-400" />
                <p className="mt-2 text-sm font-bold">{player.displayName}</p>
              </div>
              <span className="animate-pop-in font-display text-4xl font-extrabold text-sun-300" aria-hidden>
                VS
              </span>
              <div className="relative flex h-16 w-16 items-center justify-center" aria-hidden>
                <span className="absolute inset-0 animate-ping-slow rounded-full bg-pink-500/40" />
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-pink-500 font-display text-2xl font-extrabold ring-4 ring-pink-300">?</span>
              </div>
            </div>
            <h2 className="mt-8 text-xl font-bold">Finding an opponent…</h2>
            <p className="mt-1 text-white/65">Demo mode uses fictional opponents with pre-written sample answers.</p>
          </div>
        </Card>
      )}

      {prompt && opponent && (stage === "topic" || stage === "prep" || stage === "speaking" || stage === "analyzing") && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 bg-navy-900 bg-dots-light px-5 py-4 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={player.displayName} avatar={player.avatar} size="md" className="ring-brand-400" />
              <div className="min-w-0">
                <p className="truncate font-bold">{player.displayName}</p>
                <p className="text-xs text-white/60">{inputMode === "spoken" ? "Voice answer" : "Typed answer"}</p>
              </div>
            </div>
            <span className="rounded-full bg-sun-400 px-3 py-1 font-display text-sm font-extrabold text-ink">VS</span>
            <div className="flex min-w-0 items-center gap-3 text-right">
              <div className="min-w-0">
                <p className="truncate font-bold">{opponent.displayName}</p>
                <p className="text-xs text-white/60">{PROFICIENCY_LABELS[opponent.proficiency]} · demo</p>
              </div>
              <Avatar name={opponent.displayName} avatar={opponent.avatar} size="md" className="ring-pink-400" />
            </div>
          </div>
          <CardBody>
            <div className={cn("animate-pop-in rounded-2xl p-5", colors.soft)}>
              <div className="flex flex-wrap gap-2">
                <Badge tone="brand">{CATEGORY_LABELS[prompt.category]}</Badge>
                <Badge tone="neutral">{DIFFICULTY_LABELS[prompt.difficulty]}</Badge>
                {prompt.id === dailyChallengeId && <Badge tone="pink">Daily Challenge +{XP_RULES.dailyChallenge} XP</Badge>}
              </div>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight">{prompt.prompt}</h2>
              <p className="mt-1.5 text-ink-soft">{prompt.guidance}</p>
            </div>

            {stage === "topic" && (
              <div className="mt-6 space-y-4">
                {!isHostedPreview && (
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
                  </div>
                )}
                <ul className="space-y-1.5 text-sm text-ink-soft">
                  <li className="flex items-center gap-2">
                    <Hourglass className="h-4 w-4 shrink-0 text-brand-500" /> Preparation: {prepSeconds === 0 ? "none" : `${prepSeconds} seconds`}
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="h-4 w-4 shrink-0 text-brand-500" /> Speaking: up to {speakSeconds} seconds
                    {inputMode === "spoken" ? " (the timer starts when you press record)" : " (the timer starts when the writing box appears)"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Swords className="h-4 w-4 shrink-0 text-brand-500" /> {opponent.displayName}&apos;s answer is a pre-written sample, revealed after you submit.
                  </li>
                </ul>
                <Button size="lg" variant="pink" onClick={startPrep}>
                  {prepSeconds ? "Start preparation" : "Start speaking"} <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            )}

            {stage === "prep" && (
              <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl bg-lavender p-6 text-center">
                <ProgressRing value={countdown / Math.max(1, prepSeconds)} size={132} stroke={11} tone="pink" label={`${countdown} seconds of preparation left`}>
                  <span className="font-display text-4xl font-extrabold tabular-nums">{countdown}</span>
                  <span className="text-xs font-bold text-muted">seconds</span>
                </ProgressRing>
                <p className="flex items-center gap-2 font-semibold">
                  <Hourglass className="h-4 w-4" /> Plan it: {mode.howItWorks[2] ?? "one main idea, one reason, one example."}
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
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <Label htmlFor="typed-answer" className="mb-0">
                        Your answer
                      </Label>
                      <span className="text-xs font-bold text-muted">{words} words</span>
                    </div>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                        <div
                          className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", countdown <= 5 ? "bg-danger-500" : countdown <= speakSeconds / 3 ? "bg-orange-500" : "bg-mint-500")}
                          style={{ width: `${(countdown / Math.max(1, speakSeconds)) * 100}%` }}
                        />
                      </div>
                      <span className={cn("font-mono text-lg font-bold tabular-nums", countdown <= 5 ? "animate-shake text-danger-600" : "text-ink")} aria-live="polite">
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
                {stage === "analyzing" ? (
                  <div className="rounded-2xl bg-navy-900 p-5 text-white" role="status">
                    <p className="flex items-center gap-2 font-bold">
                      <Sparkles className="h-4 w-4 animate-spin-slow text-sun-300" /> Analyzing both answers…
                    </p>
                    <div className="mt-3 space-y-2" aria-hidden>
                      {[78, 56, 90, 64, 40].map((w, i) => (
                        <div key={i} className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full animate-pulse rounded-full bg-gradient-to-r from-brand-400 to-pink-400" style={{ width: `${w}%`, animationDelay: `${i * 150}ms` }} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Button size="lg" onClick={submit} disabled={!responseText || recording}>
                    Submit answer
                  </Button>
                )}
                {inputMode === "spoken" && !responseText && spoken?.hasRecording && <p className="text-sm text-muted">Add the text of your answer above so it can be scored.</p>}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {stage === "result" && result && prompt && opponent && (
        <BattleResult
          result={result}
          prompt={prompt}
          opponent={opponent}
          player={player}
          view={view}
          setView={setView}
          onRematch={() => begin(selected)}
          onChangeSettings={backToDetail}
          rematchLabel={selected ? "Play again" : "Rematch: new prompt"}
        />
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
          backToDetail();
        }}
      />
    </div>
  );
}

function PromptOption({ checked, onSelect, title, subtitle, icon, daily }: { checked: boolean; onSelect: () => void; title: string; subtitle: string; icon?: React.ReactNode; daily?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors",
        checked ? "border-brand-500 bg-brand-50" : "border-line bg-surface hover:border-brand-200 hover:bg-surface-muted/60",
      )}
    >
      <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", checked ? "border-brand-600 bg-brand-600 text-white" : "border-line-strong")}>
        {checked && <Check className="h-3 w-3" strokeWidth={4} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-bold text-ink">
          {icon}
          {title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          {subtitle}
          {daily && <Badge tone="pink">Daily Challenge</Badge>}
        </span>
      </span>
    </button>
  );
}

function RewardRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <li className={cn("flex items-center justify-between gap-3 rounded-xl px-3 py-2", highlight ? "bg-pink-50" : "bg-surface-muted/60")}>
      <span className="text-ink-soft">{label}</span>
      <span className="shrink-0 font-extrabold text-brand-700">{value}</span>
    </li>
  );
}

function BattleResult({
  result,
  prompt,
  opponent,
  player,
  view,
  setView,
  onRematch,
  onChangeSettings,
  rematchLabel,
}: {
  result: BattleResponse;
  prompt: BattlePrompt;
  opponent: DemoPartner;
  player: { displayName: string; avatar: string };
  view: "you" | "opponent";
  setView: (v: "you" | "opponent") => void;
  onRematch: () => void;
  onChangeSettings: () => void;
  rematchLabel: string;
}) {
  const ev = result.evaluation;
  const won = ev.result === "win";
  const stamp = won ? "Victory!" : ev.result === "draw" ? "Draw!" : ev.result === "loss" ? "Good fight!" : "Scores ready";
  const encouragement = won
    ? "Great answer. Check the feedback to see what made it work."
    : ev.result === "loss"
      ? `${opponent.displayName} took this round. Every battle builds your speaking muscles: pick one improvement below and try again.`
      : "Neck and neck. Small improvements can make the difference.";
  const personalBest = result.rewards.xpItems.some((i) => i.key.endsWith(":personal-best"));
  const side = view === "you" ? ev.user : ev.opponent;
  const oppDims = new Map(ev.opponent.score.dimensions.map((d) => [d.key, d]));
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className={cn("relative overflow-hidden px-6 pt-8 pb-7 text-center text-white", won ? "bg-gradient-to-br from-brand-600 via-pink-500 to-orange-400" : "bg-navy-900 bg-dots-light")}>
          {won && !result.duplicate && <Confetti />}
          <div className="relative">
            <Badge tone="dark">Simulated result</Badge>
            <div className="mx-auto mt-3 flex h-28 w-36 items-center justify-center">
              {won ? (
                <TrophyArt className="h-full w-full animate-bob" />
              ) : (
                <Mascot mood={ev.result === "draw" ? "wow" : "happy"} color={ev.result === "draw" ? "#4cc3ff" : "#8c7cfb"} className="h-28 w-28 animate-bob" />
              )}
            </div>
            <h2 className="mt-2 animate-stamp font-display text-4xl font-extrabold tracking-tight uppercase sm:text-5xl">{stamp}</h2>
            <p className="mx-auto mt-2 max-w-lg text-white/85">{encouragement}</p>
            {personalBest && (
              <p className="mx-auto mt-3 inline-flex animate-pop-in items-center gap-1.5 rounded-full bg-sun-400 px-3 py-1 text-sm font-extrabold text-ink">
                <Trophy className="h-4 w-4" /> New personal best!
              </p>
            )}
            <div className="mt-6 flex items-center justify-center gap-5 sm:gap-10">
              <div className="flex flex-col items-center">
                <Avatar name={player.displayName} avatar={player.avatar} size="lg" />
                <p className="mt-2 font-display text-5xl font-extrabold tabular-nums">{ev.user.score.total}</p>
                <p className="text-sm font-semibold text-white/75">You</p>
              </div>
              <span className="font-display text-xl font-extrabold text-white/60">vs</span>
              <div className="flex flex-col items-center">
                <Avatar name={opponent.displayName} avatar={opponent.avatar} size="lg" />
                <p className="mt-2 font-display text-5xl font-extrabold text-white/85 tabular-nums">{ev.opponent.score.total}</p>
                <p className="text-sm font-semibold text-white/75">{opponent.displayName} (sample)</p>
              </div>
            </div>
            <p className="mx-auto mt-5 max-w-xl text-xs text-white/70">{ev.resultNote}</p>
          </div>
        </div>
        <CardBody className="space-y-4">
          {result.providerNotice && <p className="rounded-xl bg-sun-50 px-3.5 py-2.5 text-sm text-sun-700">{result.providerNotice}</p>}
          {result.duplicate ? <p className="text-sm text-muted">This battle was already saved, so no additional XP was awarded.</p> : <RewardsSummary rewards={result.rewards} />}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Round by round" description="Your score vs the sample answer on each part of the rubric." icon={<Swords className="h-5 w-5" />} />
        <CardBody className="space-y-3">
          {ev.user.score.dimensions.map((d, i) => {
            const o = oppDims.get(d.key);
            return (
              <div key={d.key} className="animate-slide-up" style={{ animationDelay: `${i * 90}ms` }}>
                <div className="flex justify-between gap-3 text-sm font-bold">
                  <span>{d.label}</span>
                  <span className="shrink-0 text-muted tabular-nums">
                    <span className="text-brand-700">{d.score}</span> – {o?.score ?? "–"} <span className="font-semibold">/ {d.max}</span>
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1.5" aria-hidden>
                  <div className="flex h-3 justify-end overflow-hidden rounded-l-full bg-surface-muted">
                    <div className="h-full rounded-l-full bg-brand-500 transition-[width] duration-700" style={{ width: `${(d.score / d.max) * 100}%` }} />
                  </div>
                  <div className="h-3 overflow-hidden rounded-r-full bg-surface-muted">
                    <div className="h-full rounded-r-full bg-pink-400 transition-[width] duration-700" style={{ width: `${((o?.score ?? 0) / d.max) * 100}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
          <p className="flex gap-4 pt-1 text-xs font-bold text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-pink-400" /> {opponent.displayName} (sample)
            </span>
          </p>
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
            <div className="rounded-2xl bg-mint-50 p-4">
              <p className="text-xs font-bold tracking-wide text-mint-700 uppercase">Improved version</p>
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
        <Button size="lg" variant="pink" onClick={onRematch}>
          <RotateCcw className="h-5 w-5" /> {rematchLabel}
        </Button>
        <Button size="lg" variant="outline" onClick={onChangeSettings}>
          Change prompt
        </Button>
        <ButtonLink href="/battles" size="lg" variant="outline">
          Other battle types
        </ButtonLink>
        <ButtonLink href={`/history/${result.sessionId}`} size="lg" variant="ghost">
          Review in history
        </ButtonLink>
      </div>
    </div>
  );
}
