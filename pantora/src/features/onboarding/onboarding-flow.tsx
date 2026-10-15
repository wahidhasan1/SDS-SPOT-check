"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarClock,
  Coffee,
  Ear,
  Flame,
  Heart,
  Languages,
  MessagesSquare,
  Mic,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
} from "lucide-react";
import { AvatarPicker } from "@/components/app/avatar-picker";
import { Mascot, type MascotAccessory, type MascotMood } from "@/components/art/mascot";
import { Confetti } from "@/components/game/celebration";
import { GOAL_LABELS, PROFICIENCY_DESCRIPTIONS, PROFICIENCY_LABELS } from "@/lib/labels";
import { CONVERSATION_PREFS, DAILY_GOALS, LEARNING_GOALS, PROFICIENCY_LEVELS, type ConversationPref, type LearningGoal, type Proficiency } from "@/lib/types";
import { displayNameSchema } from "@/lib/schemas";
import { api, errorMessage } from "@/lib/api-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChoiceCard, FieldHint, Input, Label } from "@/components/ui/form";
import { Logo } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/ui/progress";
import { DemoStartButton } from "@/components/marketing/demo-start-button";

interface Draft {
  displayName: string;
  avatar: string;
  proficiency: Proficiency | null;
  goals: LearningGoal[];
  conversationPref: ConversationPref | null;
  dailyGoalMinutes: number | null;
}

const EMPTY: Draft = { displayName: "", avatar: "aurora", proficiency: null, goals: [], conversationPref: null, dailyGoalMinutes: null };
const STORAGE_KEY = "pantora-onboarding-draft";
const STEPS = ["Welcome", "Display name", "Level", "Goals", "Conversation style", "Daily target", "Finish"];

const GOAL_ICONS: Record<LearningGoal, typeof Mic> = {
  confidence: Heart,
  fluency: TrendingUp,
  grammar: Languages,
  vocabulary: Sparkles,
  work: Briefcase,
  everyday: Coffee,
  pronunciation: Ear,
};

const NAME_SUGGESTIONS = ["Brave Owl", "Morning Talker", "Curious Fox", "Quiet Storm", "Blue Notebook"];

export function OnboardingFlow({ signedInAs, demoMode }: { signedInAs: string | null; demoMode: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  // Restore an unfinished draft (browser-only convenience).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from browser storage
      if (raw) setDraft({ ...EMPTY, ...JSON.parse(raw) });
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* storage unavailable */
    }
  }, [draft]);

  const nameCheck = useMemo(() => displayNameSchema.safeParse(draft.displayName), [draft.displayName]);
  const stepValid = [
    true,
    nameCheck.success,
    draft.proficiency !== null,
    draft.goals.length > 0,
    draft.conversationPref !== null,
    draft.dailyGoalMinutes !== null,
    true,
  ][step];

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  function next() {
    setTouched(true);
    if (!stepValid) return;
    setTouched(false);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      await api("/api/onboarding", {
        body: {
          displayName: draft.displayName.trim(),
          avatar: draft.avatar,
          proficiency: draft.proficiency,
          goals: draft.goals,
          conversationPref: draft.conversationPref,
          dailyGoalMinutes: draft.dailyGoalMinutes,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setCreated(draft.displayName.trim());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <Shell>
        <div className="animate-pop-in py-6 text-center">
          <div className="relative mx-auto h-32 w-full max-w-sm">
            <Confetti pieces={50} />
            <Mascot mood="cheer" color="#ff6fb5" className="relative mx-auto h-32 w-32 animate-bob" />
          </div>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Welcome to Pantora, {created}!</h1>
          <p className="mx-auto mt-3 max-w-md text-muted">
            Your profile is ready. Your goal is {draft.dailyGoalMinutes} minutes a day — a short Free Talk or two Speaking Battles will get you
            there. Mistakes are welcome here.
          </p>
          <div className="mx-auto mt-8 grid grid-cols-1 max-w-md gap-3 text-left sm:grid-cols-2">
            <div className="rounded-2xl border border-line p-4">
              <Target className="h-5 w-5 text-brand-600" />
              <p className="mt-2 text-sm font-semibold">Daily goal</p>
              <p className="text-sm text-muted">{draft.dailyGoalMinutes} minutes of speaking</p>
            </div>
            <div className="rounded-2xl border border-line p-4">
              <Flame className="h-5 w-5 text-streak-600" />
              <p className="mt-2 text-sm font-semibold">Streak rule</p>
              <p className="text-sm text-muted">2+ minutes of speaking in a day</p>
            </div>
          </div>
          <Button
            size="lg"
            className="mt-8"
            onClick={() => {
              router.push("/dashboard");
              router.refresh();
            }}
          >
            Go to my dashboard <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
          <span>
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </span>
          <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
        </div>
        <ProgressBar value={step + 1} max={STEPS.length} label="Onboarding progress" />
      </div>

      <div key={step} className="animate-fade-in">
        {step === 0 && (
          <div>
            <Mascot mood="wave" className="h-24 w-24 animate-bob" />
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Speak English without the fear of being judged</h1>
            <p className="mt-3 text-lg leading-relaxed text-muted">
              Pantora connects you with other learners for relaxed voice conversations, short speaking challenges, and friendly feedback. Let&apos;s set
              up your profile — it takes less than a minute.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                [ShieldCheck, "You stay anonymous: only your display name is shown."],
                [Heart, "Mistakes are expected. Feedback is private and explains how to improve."],
                [CalendarClock, "Small daily goals build confidence faster than long, rare sessions."],
              ].map(([Icon, text]) => {
                const I = Icon as typeof Mic;
                return (
                  <li key={text as string} className="flex items-start gap-3 text-ink-soft">
                    <I className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                    {text as string}
                  </li>
                );
              })}
            </ul>
            {signedInAs && (
              <p className="mt-6 rounded-xl bg-streak-50 px-4 py-3 text-sm text-streak-700">
                You&apos;re currently using Pantora as <strong>{signedInAs}</strong> on this browser. Finishing onboarding creates a new profile and
                switches to it. <Link href="/dashboard" className="font-semibold underline">Back to dashboard</Link>
              </p>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <StepTitle title="Choose a display name" subtitle="This is how partners will see you. It doesn't need to be your real name." />
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={draft.displayName}
              onChange={(e) => update({ displayName: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && next()}
              placeholder="e.g. Brave Owl"
              maxLength={24}
              autoFocus
              aria-invalid={touched && !nameCheck.success}
              aria-describedby="name-hint"
            />
            <div id="name-hint">
              {touched && !nameCheck.success ? (
                <FieldHint error>{nameCheck.error.issues[0]?.message}</FieldHint>
              ) : (
                <FieldHint>2–24 characters. Avoid sharing personal details like your full name or city.</FieldHint>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {NAME_SUGGESTIONS.map((n) => (
                <button key={n} type="button" onClick={() => update({ displayName: n })} className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft hover:border-brand-300 hover:bg-brand-50">
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-6 mb-2 text-sm font-semibold">Pick your Pantora Pal</p>
            <AvatarPicker value={draft.avatar} onChange={(avatar) => update({ avatar })} name={draft.displayName} levelIndex={1} />
            <p className="mt-2 text-xs text-muted">Locked avatars are rewards you unlock by leveling up.</p>
          </div>
        )}

        {step === 2 && (
          <div>
            <StepTitle title="How comfortable are you speaking English?" subtitle="This is just a starting estimate to help with matching — not a permanent label. You can change it any time." />
            <div className="grid grid-cols-1 gap-2.5" role="radiogroup" aria-label="English proficiency">
              {PROFICIENCY_LEVELS.map((level) => (
                <ChoiceCard
                  key={level}
                  selected={draft.proficiency === level}
                  onSelect={() => update({ proficiency: level })}
                  title={PROFICIENCY_LABELS[level]}
                  description={PROFICIENCY_DESCRIPTIONS[level]}
                />
              ))}
            </div>
            {touched && !stepValid && <FieldHint error>Choose the level that feels closest.</FieldHint>}
          </div>
        )}

        {step === 3 && (
          <div>
            <StepTitle title="What do you want to work on?" subtitle="Choose as many as you like." />
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {LEARNING_GOALS.map((goal) => {
                const Icon = GOAL_ICONS[goal];
                const selected = draft.goals.includes(goal);
                return (
                  <ChoiceCard
                    key={goal}
                    multiple
                    selected={selected}
                    icon={<Icon className="h-5 w-5" />}
                    onSelect={() => update({ goals: selected ? draft.goals.filter((g) => g !== goal) : [...draft.goals, goal] })}
                    title={GOAL_LABELS[goal]}
                  />
                );
              })}
            </div>
            {touched && !stepValid && <FieldHint error>Choose at least one goal.</FieldHint>}
          </div>
        )}

        {step === 4 && (
          <div>
            <StepTitle title="How would you like to practice?" subtitle="You can use every feature either way — this just shapes your dashboard and suggestions." />
            <div className="grid grid-cols-1 gap-2.5" role="radiogroup" aria-label="Conversation preference">
              {CONVERSATION_PREFS.map((pref) => (
                <ChoiceCard
                  key={pref}
                  selected={draft.conversationPref === pref}
                  onSelect={() => update({ conversationPref: pref })}
                  icon={pref === "free_talk" ? <MessagesSquare className="h-5 w-5" /> : pref === "battles" ? <Swords className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                  title={pref === "free_talk" ? "Free Talk" : pref === "battles" ? "Speaking Battles" : "Both"}
                  description={
                    pref === "free_talk"
                      ? "Relaxed 5–15 minute conversations on everyday topics."
                      : pref === "battles"
                        ? "Short, timed answers with a score and detailed feedback."
                        : "Mix relaxed conversations with quick challenges."
                  }
                />
              ))}
            </div>
            {touched && !stepValid && <FieldHint error>Choose one option.</FieldHint>}
          </div>
        )}

        {step === 5 && (
          <div>
            <StepTitle title="Set a daily practice target" subtitle="Start small. You can raise it later, and a missed day is never a failure." />
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Daily practice target">
              {DAILY_GOALS.map((m) => (
                <ChoiceCard
                  key={m}
                  selected={draft.dailyGoalMinutes === m}
                  onSelect={() => update({ dailyGoalMinutes: m })}
                  title={`${m} minutes`}
                  description={m === 5 ? "Casual" : m === 10 ? "Regular" : m === 15 ? "Serious" : "Intense"}
                />
              ))}
            </div>
            {touched && !stepValid && <FieldHint error>Choose a daily target.</FieldHint>}
          </div>
        )}

        {step === 6 && (
          <div>
            <StepTitle title="You're all set" subtitle="Here's your profile. Go back to change anything." />
            <div className="rounded-2xl border border-line bg-surface-muted/40 p-5">
              <div className="flex items-center gap-4">
                <Avatar name={draft.displayName} avatar={draft.avatar} size="lg" />
                <div>
                  <p className="text-lg font-bold">{draft.displayName}</p>
                  <p className="text-sm text-muted">{draft.proficiency && PROFICIENCY_LABELS[draft.proficiency]} (estimate)</p>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-muted">Goals</dt>
                  <dd className="mt-0.5">{draft.goals.map((g) => GOAL_LABELS[g]).join(", ")}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted">Practice style</dt>
                  <dd className="mt-0.5">{draft.conversationPref === "free_talk" ? "Free Talk" : draft.conversationPref === "battles" ? "Speaking Battles" : "Both"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted">Daily target</dt>
                  <dd className="mt-0.5">{draft.dailyGoalMinutes} minutes</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted">Payment</dt>
                  <dd className="mt-0.5">None required</dd>
                </div>
              </dl>
            </div>
            <p className="mt-4 text-sm text-muted">
              In this demo build, your profile is stored in the local Pantora database on this server and linked to this browser with a cookie.
            </p>
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-10 flex flex-wrap-reverse items-center justify-between gap-3">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={submitting}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        ) : demoMode ? (
          <DemoStartButton variant="ghost" size="md">
            Explore the demo account instead
          </DemoStartButton>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={next} size="lg">
            {step === 0 ? "Let's begin" : "Continue"} <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={finish} loading={submitting} size="lg">
            Create my profile
          </Button>
        )}
      </div>
    </Shell>
  );
}

const STEP_MASCOTS: Record<string, { mood: MascotMood; color: string; accessory?: MascotAccessory }> = {
  "Choose a display name": { mood: "happy", color: "#8c7cfb" },
  "How comfortable are you speaking English?": { mood: "think", color: "#4cc3ff" },
  "What do you want to work on?": { mood: "wow", color: "#ff6fb5", accessory: "cap" },
  "How would you like to practice?": { mood: "happy", color: "#3ee6a8", accessory: "headset" },
  "Set a daily practice target": { mood: "cheer", color: "#ffd23f" },
  "You're all set": { mood: "cheer", color: "#8c7cfb", accessory: "crown" },
};

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  const m = STEP_MASCOTS[title] ?? { mood: "happy" as const, color: "#8c7cfb" };
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 text-muted">{subtitle}</p>
      </div>
      <Mascot key={title} mood={m.mood} color={m.color} accessory={m.accessory} className="hidden h-20 w-20 shrink-0 animate-pop-in sm:block" />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-lavender to-canvas">
      <header className="mx-auto flex h-20 max-w-2xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Pantora home">
          <Logo />
        </Link>
        <ButtonLink href="/" variant="ghost" size="sm">
          Exit
        </ButtonLink>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
        <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-card sm:p-10">{children}</div>
      </main>
    </div>
  );
}
