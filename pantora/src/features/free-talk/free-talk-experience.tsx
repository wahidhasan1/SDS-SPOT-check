"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Ban,
  Captions,
  CaptionsOff,
  CircleCheck,
  Clock,
  Flag,
  Lightbulb,
  MessageCircleQuestion,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import type { DemoPartner, MatchingPrefs, Proficiency, Topic } from "@/lib/types";
import { PROFICIENCY_LEVELS } from "@/lib/types";
import { CATEGORY_LABELS, DIFFICULTY_LABELS, PROFICIENCY_LABELS, ISSUE_CATEGORY_LABELS } from "@/lib/labels";
import type { Rewards } from "@/server/services/gamification";
import { api, errorMessage } from "@/lib/api-client";
import { formatClock, formatDuration } from "@/lib/dates";
import { MIN_COMPLETED_CONVERSATION_SECONDS } from "@/lib/game-rules";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Label, Segmented, Select, Switch } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useMicrophone } from "@/features/audio/use-microphone";
import { useSpeechRecognition } from "@/features/audio/use-speech-recognition";
import { speakText, stopSpeaking } from "@/features/audio/speak";
import { LevelMeter } from "@/features/audio/level-meter";
import { BlockDialog, ReportDialog } from "@/features/safety/safety-dialogs";
import { RewardsSummary } from "@/features/practice/rewards-summary";
import { FreeTalkArt } from "@/components/art/scene-art";
import { XP_RULES } from "@/lib/game-rules";
import { Mascot } from "@/components/art/mascot";
import { Confetti } from "@/components/game/celebration";
import { GENERIC_TOPIC, buildPartnerScript } from "./script";
import { LiveCall } from "./live-call";
import { HOSTED_MIC_NOTICE, isHostedPreview } from "@/lib/runtime";

type Phase = "setup" | "searching" | "found" | "connecting" | "active" | "saving" | "summary";
type EndReason = "completed" | "ended_early" | "time_up" | "skipped" | "left" | "connection_lost" | "reported" | "blocked";

interface CompleteResponse {
  sessionId: string;
  status: "completed" | "incomplete";
  durationSeconds: number;
  rewards: Rewards;
  transcriptStatus: string | null;
  feedback: {
    id: string | null;
    analyzer: "demo-rules" | "anthropic";
    summary: string;
    strengths: string[];
    issues: { original: string; corrected: string; explanation: string; category: keyof typeof ISSUE_CATEGORY_LABELS }[];
    vocabulary: { phrase: string; alternatives: string[] }[];
    exercise: { title: string; instructions: string };
    providerNotice: string | null;
  } | null;
}

interface Line {
  speaker: "user" | "partner";
  text: string;
}

const SEARCH_MESSAGES = ["Looking for partners at your level…", "Checking shared interests…", "Almost there…"];

export function FreeTalkExperience({
  profile,
  matching,
  retention,
  topics,
  favoriteIds,
  initialTopicId,
  liveEnabled,
}: {
  profile: { id: string; displayName: string; avatar: string; proficiency: Proficiency };
  matching: MatchingPrefs;
  retention: "keep" | "30d" | "none";
  topics: Topic[];
  favoriteIds: string[];
  initialTopicId: string | null;
  liveEnabled: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [phase, setPhase] = useState<Phase>("setup");
  const [duration, setDuration] = useState<5 | 10 | 15>(matching.durationMinutes);
  const [range, setRange] = useState<[Proficiency, Proficiency]>(matching.proficiencyRange);
  const [suggestTopic, setSuggestTopic] = useState(initialTopicId ? false : matching.suggestTopic);
  const [topicId, setTopicId] = useState<string>(initialTopicId ?? "");
  const [englishOnly, setEnglishOnly] = useState(matching.englishOnly);
  const [captionsWanted, setCaptionsWanted] = useState(true);
  const [readAloud, setReadAloud] = useState(false);
  const [partner, setPartner] = useState<DemoPartner | null>(null);
  const [matchReasons, setMatchReasons] = useState<string[]>([]);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [searchMsg, setSearchMsg] = useState(0);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [result, setResult] = useState<CompleteResponse | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Call state
  const [elapsed, setElapsed] = useState(0);
  const [online, setOnline] = useState(true);
  const [script, setScript] = useState<string[]>([]);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [partnerSpeaking, setPartnerSpeaking] = useState(false);
  const [confirm, setConfirm] = useState<null | "end" | "skip">(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const startedAtRef = useRef<Date | null>(null);
  const idemRef = useRef<string>("");
  const elapsedRef = useRef(0);
  const linesRef = useRef<Line[]>([]);
  const captionsUsedRef = useRef(false);
  const [reply, setReply] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  const mic = useMicrophone();
  const speech = useSpeechRecognition((text) => {
    captionsUsedRef.current = true;
    setLines((l) => [...l, { speaker: "user", text }]);
  });

  useEffect(() => {
    linesRef.current = lines;
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const sortedTopics = useMemo(() => {
    const fav = new Set(favoriteIds);
    return [...topics].sort((a, b) => Number(fav.has(b.id)) - Number(fav.has(a.id)) || a.title.localeCompare(b.title));
  }, [topics, favoriteIds]);

  const pickTopic = useCallback((): Topic | null => {
    if (!suggestTopic) return topics.find((t) => t.id === topicId) ?? null;
    const pool = topics.filter((t) => (matching.topicCategories.length ? matching.topicCategories.includes(t.category) : true) && t.durationMinutes <= duration);
    const list = pool.length ? pool : topics;
    return list[Math.floor(Math.random() * list.length)];
  }, [suggestTopic, topicId, topics, matching.topicCategories, duration]);

  // ---------- Matching ----------
  async function startMatching(extraExclude: string[] = excludeIds) {
    setMatchError(null);
    setPhase("searching");
    setSearchMsg(0);
    const chosen = pickTopic();
    setTopic(chosen);
    const wait = 2200 + Math.random() * 1600;
    const timer = setInterval(() => setSearchMsg((m) => Math.min(SEARCH_MESSAGES.length - 1, m + 1)), wait / 3);
    try {
      const [res] = await Promise.all([
        api<{ partner: DemoPartner; reasons: string[] }>("/api/match", {
          body: { mode: "free_talk", topicId: chosen?.id ?? null, proficiencyRange: range, excludeIds: extraExclude },
        }),
        new Promise((r) => setTimeout(r, wait)),
      ]);
      setPartner(res.partner);
      setMatchReasons(res.reasons);
      setPhase((p) => (p === "searching" ? "found" : p));
    } catch (e) {
      setMatchError(errorMessage(e));
      setPhase("setup");
    } finally {
      clearInterval(timer);
    }
  }

  function cancelSearch() {
    setPhase("setup");
  }

  function skipPartnerBeforeCall() {
    if (!partner) return;
    const next = [...excludeIds, partner.id];
    setExcludeIds(next.length >= 7 ? [partner.id] : next);
    startMatching(next.length >= 7 ? [partner.id] : next);
  }

  // ---------- Call ----------
  async function startCall() {
    if (!partner) return;
    setPhase("connecting");
    idemRef.current = crypto.randomUUID();
    if (!isHostedPreview) await mic.start();
    await new Promise((r) => setTimeout(r, 1200));
    const s = buildPartnerScript(partner.displayName, topic ?? GENERIC_TOPIC, partner.displayName.length);
    setScript(s);
    setScriptIndex(1);
    const first: Line[] = [
      { speaker: "partner", text: s[0] },
      { speaker: "partner", text: s[1] },
    ];
    setLines(first);
    captionsUsedRef.current = false;
    elapsedRef.current = 0;
    setElapsed(0);
    startedAtRef.current = new Date();
    setPhase("active");
    if (captionsWanted && speech.supported && !isHostedPreview) speech.start();
    if (readAloud) say(`${s[0]} ${s[1]}`);
  }

  function say(text: string) {
    setPartnerSpeaking(true);
    if (!speakText(text, () => setPartnerSpeaking(false))) setPartnerSpeaking(false);
  }

  function nextPrompt() {
    const idx = Math.min(scriptIndex + 1, script.length - 1);
    if (idx === scriptIndex) return;
    setScriptIndex(idx);
    setLines((l) => [...l, { speaker: "partner", text: script[idx] }]);
    if (readAloud) say(script[idx]);
  }

  // Timer: counts only while the call is active and online, and ends the call when time is up.
  const finishRef = useRef<(reason: EndReason) => void>(() => {});
  useEffect(() => {
    if (phase !== "active" || !online) return;
    const t = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= duration * 60) {
        clearInterval(t);
        toast({ tone: "info", title: "Time's up", description: "Great job — your conversation has ended." });
        finishRef.current("time_up");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, online, duration, toast]);

  // Connection monitoring (real browser network state).
  useEffect(() => {
    if (phase !== "active") return;
    const off = () => setOnline(false);
    const on = () => {
      setOnline(true);
      toast({ tone: "success", title: "Reconnected", description: "Your connection is back. The timer has resumed." });
    };
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, [phase, toast]);

  const plannedSeconds = duration * 60;

  const finishCall = useCallback(
    async (reason: EndReason, then?: "summary" | "rematch") => {
      speech.stop();
      stopSpeaking();
      mic.stop();
      setPhase("saving");
      setSaveError(null);
      const captured = linesRef.current;
      const hasUserLines = captured.some((l) => l.speaker === "user");
      const body = {
        idempotencyKey: idemRef.current,
        partnerId: partner!.id,
        partnerKind: "demo_partner",
        topicId: topic?.id ?? null,
        startedAt: (startedAtRef.current ?? new Date()).toISOString(),
        endedAt: new Date().toISOString(),
        plannedSeconds,
        activeSeconds: elapsedRef.current,
        endReason: reason,
        captions: captionsUsedRef.current || hasUserLines ? { source: captionsUsedRef.current ? "browser_speech" : "typed", lines: captured } : null,
      };
      try {
        const res = await api<CompleteResponse>("/api/sessions/free-talk", { body });
        router.refresh();
        if (then === "rematch") {
          toast({
            tone: "info",
            title: res.status === "completed" ? "Conversation saved" : "Partner skipped",
            description: res.status === "completed" ? `${formatDuration(res.durationSeconds)} added to your practice.` : "Short sessions under a minute aren't counted.",
          });
          const next = [...excludeIds, partner!.id];
          setExcludeIds(next);
          startMatching(next);
        } else {
          setResult(res);
          setPhase("summary");
        }
      } catch (e) {
        setSaveError(errorMessage(e));
        setPhase("summary");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partner, topic, plannedSeconds, excludeIds, mic, speech],
  );

  useEffect(() => {
    finishRef.current = (reason) => finishCall(reason);
  }, [finishCall]);

  function retrySave() {
    setResult(null);
    finishCall("completed");
  }

  function resetToSetup() {
    setPhase("setup");
    setPartner(null);
    setResult(null);
    setSaveError(null);
    setLines([]);
    setExcludeIds([]);
  }

  const remaining = Math.max(0, plannedSeconds - elapsed);
  const partnerTarget = partner ? { id: partner.id, kind: "demo_partner" as const, name: partner.displayName, isDemo: true } : null;

  // ---------- Render ----------
  if (mode === "live" && liveEnabled) {
    return (
      <LiveCall
        duration={duration}
        topic={topics.find((t) => t.id === topicId) ?? null}
        onExit={() => setMode("demo")}
      />
    );
  }

  if (phase === "setup") {
    return (
      <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-400 via-sky-500 to-brand-500 p-6 text-white shadow-card sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-dots-light" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Free Talk</h1>
            <p className="mt-2 max-w-xl text-white/90">Relaxed voice conversations with another learner. No scores, no pressure — just speaking. Corrections come after, never during.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/20 px-2.5 py-1">+{XP_RULES.conversationBase} XP and up</span>
              <span className="rounded-full bg-white/20 px-2.5 py-1">Counts toward your streak</span>
              <span className="rounded-full bg-white/20 px-2.5 py-1">Demo partners are fictional</span>
            </div>
          </div>
          <FreeTalkArt className="hidden h-36 w-48 shrink-0 animate-bob sm:block" />
        </div>
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader title="Set up your conversation" description="Pick a length and who you'd like to talk with." icon={<Users className="h-5 w-5" />} />
          <CardBody className="space-y-6">
            {liveEnabled && (
              <div>
                <Label>Partner type</Label>
                <Segmented
                  label="Partner type"
                  value={mode}
                  onChange={(v) => setMode(v)}
                  options={[
                    { value: "demo", label: "Demo partner" },
                    { value: "live", label: "Live (people on this server)" },
                  ]}
                />
              </div>
            )}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Label>Your level</Label>
                <p className="flex h-11 items-center justify-between rounded-xl border border-line bg-surface-muted/50 px-3.5 text-[15px]">
                  {PROFICIENCY_LABELS[profile.proficiency]}
                  <Link href="/settings#profile" className="text-sm font-semibold text-brand-600 hover:text-brand-800">
                    Change
                  </Link>
                </p>
              </div>
              <div>
                <Label>Conversation length</Label>
                <Segmented
                  label="Conversation length"
                  value={duration}
                  onChange={setDuration}
                  options={[
                    { value: 5, label: "5 min" },
                    { value: 10, label: "10 min" },
                    { value: 15, label: "15 min" },
                  ]}
                />
              </div>
              <div>
                <Label htmlFor="range-low">Partner level from</Label>
                <Select id="range-low" value={range[0]} onChange={(e) => setRange([e.target.value as Proficiency, range[1]])}>
                  {PROFICIENCY_LEVELS.map((p) => (
                    <option key={p} value={p}>
                      {PROFICIENCY_LABELS[p]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="range-high">to</Label>
                <Select id="range-high" value={range[1]} onChange={(e) => setRange([range[0], e.target.value as Proficiency])}>
                  {PROFICIENCY_LEVELS.map((p) => (
                    <option key={p} value={p}>
                      {PROFICIENCY_LABELS[p]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="rounded-2xl border border-line p-4">
              <Switch
                checked={suggestTopic}
                onChange={setSuggestTopic}
                label="Suggest a topic for me"
                description="We'll pick a topic from your preferred categories. Turn off to choose one yourself."
              />
              {!suggestTopic && (
                <div className="pt-2">
                  <Label htmlFor="topic">Topic</Label>
                  <Select id="topic" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                    <option value="">No topic — talk freely</option>
                    {sortedTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {favoriteIds.includes(t.id) ? "★ " : ""}
                        {t.title} · {CATEGORY_LABELS[t.category]} · {DIFFICULTY_LABELS[t.difficulty]}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1.5 text-xs text-muted">
                    Browse ideas in the <Link href="/topics" className="font-semibold text-brand-600">Topics library</Link>.
                  </p>
                </div>
              )}
              <div className="border-t border-line">
                <Switch
                  checked={englishOnly}
                  onChange={setEnglishOnly}
                  label="English-only conversation"
                  description="Both partners agree to speak only English, even if you share another language."
                />
              </div>
              {!isHostedPreview && (
              <div className="border-t border-line">
                <Switch
                  checked={captionsWanted && speech.supported}
                  onChange={setCaptionsWanted}
                  disabled={!speech.supported}
                  label="Live captions of what you say"
                  description={
                    speech.supported
                      ? `Uses your browser's speech recognition (in Chrome, audio is processed by Google's speech service). Captions are used for your transcript and feedback${retention === "none" ? ", then discarded (transcript retention is off)" : ""}.`
                      : "Not supported in this browser (try Chrome or Edge). You'll still be able to practice, but there will be no transcript or feedback."
                  }
                />
              </div>
              )}
              <div className="border-t border-line">
                <Switch
                  checked={readAloud}
                  onChange={setReadAloud}
                  label="Read partner lines aloud"
                  description="Demo partner prompts can be read by your browser's built-in voice."
                />
              </div>
            </div>

            {isHostedPreview ? (
              <p className="rounded-2xl bg-surface-muted/60 p-4 text-sm text-ink-soft">
                <span className="font-semibold text-ink">Hosted preview: </span>
                {HOSTED_MIC_NOTICE}
              </p>
            ) : (
              <MicCheck mic={mic} />
            )}

            {matchError && (
              <p role="alert" className="rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
                {matchError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => startMatching([])} disabled={PROFICIENCY_LEVELS.indexOf(range[0]) > PROFICIENCY_LEVELS.indexOf(range[1])}>
                <Sparkles className="h-5 w-5" /> Start Matching
              </Button>
              {PROFICIENCY_LEVELS.indexOf(range[0]) > PROFICIENCY_LEVELS.indexOf(range[1]) && (
                <p className="text-sm font-medium text-danger-600">The “from” level must be lower than or equal to the “to” level.</p>
              )}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card className="border-sun-300 bg-sun-50">
            <CardBody>
              <p className="flex items-center gap-2 text-sm font-bold text-sun-700">
                <Lightbulb className="h-4.5 w-4.5" /> How demo mode works
              </p>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                <li>• Partners are fictional profiles. No real person is on the other end.</li>
                <li>• Partner lines are scripted prompts shown as text, so you can practice answering out loud.</li>
                <li>• Your microphone is only used on this device for the level meter{speech.supported ? " and optional captions" : ""}. Nothing is recorded.</li>
                <li>• Time you spend in the conversation counts toward your goal and streak.</li>
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <ShieldCheck className="h-4.5 w-4.5 text-brand-600" /> You&apos;re in control
              </p>
              <p className="mt-2 text-sm text-muted">
                End, skip, block, or report at any time during a conversation. Blocked partners are never matched with you again.
              </p>
              <Link href="/safety" className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:text-brand-800">
                Safety Center →
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
      </div>
    );
  }

  if (phase === "searching") {
    return (
      <Card className="mx-auto max-w-xl overflow-hidden">
        <CardBody className="flex flex-col items-center bg-gradient-to-b from-sky-50 to-surface py-14 text-center">
          <div className="relative flex h-36 w-36 items-center justify-center" aria-hidden>
            <span className="absolute inset-0 animate-ping-slow rounded-full bg-sky-200" />
            <span className="absolute inset-4 animate-ping-slow rounded-full bg-sky-300 [animation-delay:0.6s]" />
            <Mascot mood="think" color="#4cc3ff" className="relative h-28 w-28 animate-bob" />
          </div>
          <h2 className="mt-8 text-xl font-bold">Searching for a partner</h2>
          <p className="mt-2 text-muted" aria-live="polite">
            {SEARCH_MESSAGES[searchMsg]}
          </p>
          <Badge tone="demo" className="mt-4">
            Demo matching · fictional partners
          </Badge>
          <Button variant="outline" className="mt-8" onClick={cancelSearch}>
            <X className="h-4 w-4" /> Cancel
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (phase === "found" && partner) {
    return (
      <Card className="mx-auto max-w-2xl animate-pop-in overflow-hidden">
        <div className="relative overflow-hidden bg-gradient-to-br from-sky-500 via-brand-500 to-pink-500 px-6 py-8 text-center text-white">
          <Confetti pieces={36} />
          <p className="relative animate-stamp font-display text-sm font-extrabold tracking-[0.2em] text-sun-300 uppercase">It&apos;s a match!</p>
          <Avatar name={partner.displayName} avatar={partner.avatar} size="xl" className="mx-auto mt-4" />
          <h2 className="mt-4 text-2xl font-extrabold">{partner.displayName}</h2>
          <p className="mt-1 text-white/75">Estimated level: {PROFICIENCY_LABELS[partner.proficiency]}</p>
          <Badge tone="dark" className="mt-3">
            Fictional demo partner
          </Badge>
        </div>
        <CardBody className="space-y-5">
          <p className="text-ink-soft">{partner.bio}</p>
          <div className="flex flex-wrap gap-2">
            {partner.interests.map((i) => (
              <Badge key={i} tone="brand">
                {i}
              </Badge>
            ))}
          </div>
          <dl className="grid grid-cols-1 gap-3 rounded-2xl bg-surface-muted/60 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-muted">Topic</dt>
              <dd className="mt-0.5 font-semibold">{topic?.title ?? "Free conversation"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted">Mode</dt>
              <dd className="mt-0.5 font-semibold">Free Talk · {duration} min</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted">Language</dt>
              <dd className="mt-0.5 font-semibold">{englishOnly ? "English only" : "English practice"}</dd>
            </div>
          </dl>
          <ul className="space-y-1 text-sm text-muted">
            {matchReasons.map((r) => (
              <li key={r} className="flex items-center gap-2">
                <CircleCheck className="h-4 w-4 text-success-600" /> {r}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={startCall}>
              <Mic className="h-5 w-5" /> Start conversation
            </Button>
            <Button size="lg" variant="outline" onClick={skipPartnerBeforeCall}>
              <SkipForward className="h-5 w-5" /> Skip partner
            </Button>
            <Button size="lg" variant="ghost" onClick={resetToSetup}>
              Cancel
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (phase === "connecting" && partner) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardBody className="flex flex-col items-center py-14 text-center">
          <Avatar name={partner.displayName} avatar={partner.avatar} size="xl" className="animate-pulse" />
          <h2 className="mt-6 text-xl font-bold">Connecting to {partner.displayName}…</h2>
          <p className="mt-2 max-w-sm text-muted">
            {mic.state === "requesting" ? "Please allow microphone access so you can practice out loud. Nothing is recorded." : "Setting up your simulated demo call."}
          </p>
        </CardBody>
      </Card>
    );
  }

  if ((phase === "active" || phase === "saving") && partner) {
    const usedFollowUps = new Set(lines.map((l) => l.text));
    const followUps = (topic ?? GENERIC_TOPIC).followUps.filter((q) => ![...usedFollowUps].some((t) => t.endsWith(q)));
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="overflow-hidden">
          {/* Status bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="demo">Demo session</Badge>
              {online ? (
                <Badge tone="success">
                  <Wifi className="h-3.5 w-3.5" /> Connected (simulated)
                </Badge>
              ) : (
                <Badge tone="danger">
                  <WifiOff className="h-3.5 w-3.5" /> Connection lost — reconnecting…
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 font-mono text-sm font-semibold tabular-nums" aria-label={`${formatClock(elapsed)} elapsed, ${formatClock(remaining)} remaining`}>
              <Clock className="h-4 w-4 text-muted" />
              {formatClock(elapsed)} <span className="text-subtle">/ {formatClock(plannedSeconds)}</span>
            </div>
          </div>

          {!online && (
            <div role="alert" className="flex items-center gap-2 bg-danger-50 px-6 py-2.5 text-sm text-danger-700">
              <RefreshCw className="h-4 w-4 animate-spin" /> Your device is offline. The timer is paused and will resume when the connection returns.
            </div>
          )}

          <div className="grid grid-cols-1 gap-0 md:grid-cols-[14rem_minmax(0,1fr)]">
            {/* Partner */}
            <div className="flex flex-col items-center border-b border-line bg-gradient-to-b from-lavender to-surface px-6 py-8 text-center md:border-r md:border-b-0">
              <div className="relative">
                {partnerSpeaking && <span className="absolute inset-0 animate-ping-slow rounded-full bg-brand-300" />}
                <Avatar name={partner.displayName} avatar={partner.avatar} size="xl" className="relative" />
              </div>
              <p className="mt-4 text-lg font-bold">{partner.displayName}</p>
              <p className="text-sm text-muted">{PROFICIENCY_LABELS[partner.proficiency]}</p>
              <p className="mt-2 text-xs text-muted">Scripted demo partner — not a live person</p>
              <div className="mt-6 w-full rounded-2xl bg-surface p-3 text-left shadow-card">
                <p className="text-xs font-semibold text-muted">{isHostedPreview ? "Answer mode" : "Your microphone"}</p>
                {isHostedPreview ? (
                  <p className="mt-1.5 text-sm font-semibold text-brand-700">Typing</p>
                ) : (
                  <>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className={cn("text-sm font-semibold", mic.state === "ready" ? (mic.muted ? "text-streak-700" : "text-success-700") : "text-danger-700")}>
                    {mic.state === "ready" ? (mic.muted ? "Muted" : "Live") : mic.state === "denied" ? "Blocked" : "Unavailable"}
                  </span>
                  <LevelMeter level={mic.level} bars={8} active={mic.state === "ready"} />
                </div>
                {mic.error && <p className="mt-1.5 text-xs text-danger-600">{mic.error} You can still practice out loud.</p>}
                  </>
                )}
              </div>
            </div>

            {/* Conversation feed */}
            <div className="flex min-h-[22rem] flex-col">
              <div ref={feedRef} className="max-h-[26rem] flex-1 space-y-3 overflow-y-auto p-4 sm:p-6" aria-live="polite" aria-label="Conversation">
                {lines.map((l, i) => (
                  <div key={i} className={cn("flex", l.speaker === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                        l.speaker === "user" ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md bg-surface-muted text-ink",
                      )}
                    >
                      {l.speaker === "partner" && (
                        <span className="mb-0.5 flex items-center gap-2 text-[11px] font-bold tracking-wide text-muted uppercase">
                          {partner.displayName} · scripted
                          <button className="text-brand-600 hover:text-brand-800" onClick={() => say(l.text)} aria-label="Read this line aloud">
                            <Volume2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      )}
                      {l.text}
                    </div>
                  </div>
                ))}
                {speech.interim && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-100 px-4 py-2.5 text-[15px] text-brand-800 italic">{speech.interim}</div>
                  </div>
                )}
                {!speech.listening && lines.every((l) => l.speaker === "partner") && (
                  <p className="pt-2 text-center text-sm text-muted">
                    {isHostedPreview
                      ? "Type your answer below as if you were saying it. Tap “Next question” when you're ready."
                      : `Answer out loud${speech.supported ? ", or turn on captions to see a transcript of what you say" : ""}. You can also type what you said below. Tap “Next question” when you're ready.`}
                  </p>
                )}
              </div>
              <div className="space-y-3 border-t border-line p-3 sm:px-6">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = reply.trim();
                    if (!text) return;
                    setLines((l) => [...l, { speaker: "user", text }]);
                    setReply("");
                  }}
                >
                  <label htmlFor="typed-reply" className="sr-only">
                    Type what you said
                  </label>
                  <input
                    id="typed-reply"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    maxLength={1000}
                    disabled={phase === "saving"}
                    placeholder={isHostedPreview ? "Type your answer…" : "Type what you said (optional)…"}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] placeholder:text-subtle focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
                  />
                  <Button type="submit" variant="outline" disabled={!reply.trim() || phase === "saving"}>
                    Add
                  </Button>
                </form>
                <Button variant="secondary" onClick={nextPrompt} disabled={scriptIndex >= script.length - 1 || phase === "saving"} className="w-full sm:w-auto">
                  <MessageCircleQuestion className="h-4.5 w-4.5" /> Next question from {partner.displayName}
                </Button>
                {speech.error && <p className="mt-2 text-xs text-danger-600">{speech.error}</p>}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-line bg-surface-muted/40 px-4 py-4 sm:gap-3">
            {!isHostedPreview && (
              <>
              <ControlButton
                label={mic.muted ? "Unmute" : "Mute"}
                active={mic.muted}
                disabled={mic.state !== "ready"}
                onClick={() => mic.setMuted(!mic.muted)}
                icon={mic.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              />
              <ControlButton
                label={speech.listening ? "Captions on" : "Captions off"}
                active={speech.listening}
                disabled={!speech.supported}
                onClick={() => (speech.listening ? speech.stop() : speech.start())}
                icon={speech.listening ? <Captions className="h-6 w-6" /> : <CaptionsOff className="h-6 w-6" />}
              />
              </>
            )}
            <ControlButton
              label={readAloud ? "Voice on" : "Voice off"}
              active={readAloud}
              onClick={() => {
                if (readAloud) stopSpeaking();
                setReadAloud(!readAloud);
              }}
              icon={readAloud ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
            />
            <ControlButton label="Skip" onClick={() => setConfirm("skip")} icon={<SkipForward className="h-6 w-6" />} />
            <ControlButton label="Report" onClick={() => setReportOpen(true)} icon={<Flag className="h-6 w-6" />} />
            <ControlButton label="Block" onClick={() => setBlockOpen(true)} icon={<Ban className="h-6 w-6" />} />
            <button
              onClick={() => setConfirm("end")}
              disabled={phase === "saving"}
              className="flex flex-col items-center gap-1 text-xs font-semibold text-danger-700 disabled:opacity-50"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-600 text-white shadow-card transition-colors hover:bg-danger-700">
                <PhoneOff className="h-6 w-6" />
              </span>
              {phase === "saving" ? "Saving…" : "End call"}
            </button>
          </div>
        </Card>

        {/* Topic sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader title={topic?.title ?? GENERIC_TOPIC.title} description={topic ? `${CATEGORY_LABELS[topic.category]} · ${DIFFICULTY_LABELS[topic.difficulty]}` : "Free conversation"} icon={<Sparkles className="h-5 w-5" />} />
            <CardBody>
              <p className="rounded-xl bg-lavender p-3.5 text-sm font-semibold text-ink">{(topic ?? GENERIC_TOPIC).openingQuestion}</p>
              <p className="mt-4 text-xs font-bold tracking-wide text-muted uppercase">Questions you can ask {partner.displayName}</p>
              <ul className="mt-2 space-y-2 text-sm text-ink-soft">
                {(followUps.length ? followUps : (topic ?? GENERIC_TOPIC).followUps).slice(0, 4).map((q) => (
                  <li key={q} className="flex gap-2">
                    <span className="text-brand-500">•</span>
                    {q}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-sm text-muted">
              <p className="font-semibold text-ink">Stuck? Try these</p>
              <ul className="mt-2 space-y-1.5">
                <li>“Could you say that again, please?”</li>
                <li>“What I mean is…”</li>
                <li>“That reminds me of…”</li>
                <li>“How about you?”</li>
              </ul>
            </CardBody>
          </Card>
        </div>

        <ConfirmDialog
          open={confirm === "end"}
          onClose={() => setConfirm(null)}
          title="End this conversation?"
          description={
            elapsed < MIN_COMPLETED_CONVERSATION_SECONDS
              ? "Conversations shorter than 1 minute are saved as incomplete and don't count toward your goal."
              : `You've talked for ${formatDuration(elapsed)}. It will be saved to your history.`
          }
          confirmLabel="End call"
          tone="danger"
          onConfirm={() => {
            setConfirm(null);
            finishCall(elapsed >= plannedSeconds ? "time_up" : "ended_early");
          }}
        />
        <ConfirmDialog
          open={confirm === "skip"}
          onClose={() => setConfirm(null)}
          title={`Skip ${partner.displayName}?`}
          description="This ends the current conversation (it's saved to your history) and finds you a new partner."
          confirmLabel="Skip and find someone new"
          onConfirm={() => {
            setConfirm(null);
            finishCall("skipped", "rematch");
          }}
        />
        {partnerTarget && (
          <>
            <ReportDialog
              open={reportOpen}
              onClose={() => setReportOpen(false)}
              target={partnerTarget}
              onReported={({ alsoBlocked }) => {
                if (alsoBlocked) finishCall("reported");
              }}
            />
            <BlockDialog open={blockOpen} onClose={() => setBlockOpen(false)} target={partnerTarget} onBlocked={() => finishCall("blocked")} />
          </>
        )}
      </div>
    );
  }

  // Summary
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {saveError ? (
        <Card>
          <CardBody className="text-center">
            <h2 className="text-xl font-bold">We couldn&apos;t save your conversation</h2>
            <p className="mt-2 text-muted">{saveError}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={retrySave}>Try again</Button>
              <Button variant="outline" onClick={resetToSetup}>
                Discard
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : result ? (
        <>
          <Card className="overflow-hidden">
            <div className={cn("relative overflow-hidden px-6 py-7 text-center", result.status === "completed" ? "bg-gradient-to-br from-mint-100 via-sky-50 to-surface" : "bg-surface-muted/60")}>
              <Mascot mood={result.status === "completed" ? "cheer" : "happy"} color={result.status === "completed" ? "#3ee6a8" : "#8c7cfb"} className="mx-auto h-24 w-24 animate-bob" />
              <h2 className="text-3xl font-extrabold">{result.status === "completed" ? "Conversation complete!" : "Conversation ended early"}</h2>
              <p className="mt-1 text-muted">
                {result.status === "completed"
                  ? `Nice work${partner ? ` talking with ${partner.displayName}` : ""}. Every minute builds confidence.`
                  : "Sessions shorter than 1 minute are saved as incomplete and don't earn rewards."}
              </p>
            </div>
            <CardBody className="space-y-6">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <SummaryStat label="Duration" value={formatDuration(result.durationSeconds)} />
                <SummaryStat label="Topic" value={topic?.title ?? "Free conversation"} />
                <SummaryStat
                  label="Transcript"
                  value={
                    result.transcriptStatus === "available"
                      ? "Captured from captions"
                      : result.transcriptStatus === "not_retained"
                        ? "Analyzed, not kept"
                        : "Not transcribed"
                  }
                />
                <SummaryStat
                  label="Feedback"
                  value={result.feedback ? (result.feedback.analyzer === "anthropic" ? "AI feedback ready" : "Demo analyzer feedback") : "Not available"}
                />
              </dl>
              {result.status === "completed" && <RewardsSummary rewards={result.rewards} />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Key suggestions" icon={<Lightbulb className="h-5 w-5" />} action={result.feedback && <Badge tone={result.feedback.analyzer === "anthropic" ? "brand" : "demo"}>{result.feedback.analyzer === "anthropic" ? "AI feedback" : "Demo analyzer"}</Badge>} />
            <CardBody>
              {result.feedback ? (
                <div className="space-y-4">
                  {result.feedback.providerNotice && <p className="rounded-xl bg-streak-50 px-3.5 py-2.5 text-sm text-streak-700">{result.feedback.providerNotice}</p>}
                  <p className="text-ink-soft">{result.feedback.summary}</p>
                  {result.feedback.issues.filter((i) => i.original).map((i, idx) => (
                    <div key={idx} className="rounded-2xl border border-line p-4">
                      <Badge tone="neutral">{ISSUE_CATEGORY_LABELS[i.category]}</Badge>
                      <p className="mt-2 text-sm text-muted line-through decoration-danger-500/60">{i.original}</p>
                      <p className="font-semibold">{i.corrected}</p>
                      <p className="mt-1.5 text-sm text-muted">{i.explanation}</p>
                    </div>
                  ))}
                  <div className="rounded-2xl bg-lavender p-4">
                    <p className="text-sm font-bold text-brand-700">Try next: {result.feedback.exercise.title}</p>
                    <p className="mt-1 text-sm text-ink-soft">{result.feedback.exercise.instructions}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {result.status !== "completed"
                    ? "No feedback for incomplete sessions."
                    : "Feedback needs a transcript of what you said. Turn on live captions next time (Chrome or Edge), or practice with the AI Coach to get feedback on a typed or recorded answer."}
                </p>
              )}
            </CardBody>
          </Card>

          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href={`/history/${result.sessionId}`} size="lg">
              Review session <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <Button size="lg" variant="outline" onClick={resetToSetup}>
              Start another conversation
            </Button>
            <ButtonLink href="/dashboard" size="lg" variant="ghost">
              Back to dashboard
            </ButtonLink>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ControlButton({ label, icon, onClick, active, disabled }: { label: string; icon: React.ReactNode; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-1 text-xs font-semibold text-ink-soft disabled:opacity-40" aria-pressed={active}>
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full border transition-colors",
          active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface hover:bg-surface-muted",
        )}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-muted/60 p-3.5">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}

function MicCheck({ mic }: { mic: ReturnType<typeof useMicrophone> }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface-muted/60 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Microphone check</p>
        <p className="text-xs text-muted">
          {mic.state === "ready"
            ? "Say something — the bars should move. Your audio isn't recorded or sent anywhere."
            : mic.error ?? "Test your microphone before you start. Your browser will ask for permission."}
        </p>
      </div>
      {mic.state === "ready" ? (
        <div className="flex items-center gap-3">
          <LevelMeter level={mic.level} bars={14} />
          <Button variant="outline" size="sm" onClick={mic.stop}>
            Stop test
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={mic.start} loading={mic.state === "requesting"}>
          <Mic className="h-4 w-4" /> Test microphone
        </Button>
      )}
    </div>
  );
}
