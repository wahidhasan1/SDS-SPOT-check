import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Check, Flame, Gift, Globe2, MessagesSquare, Mic, PlayCircle, Sparkles, Swords, Target, Trophy, Zap } from "lucide-react";
import { requireUser } from "@/server/auth";
import { get, getDb } from "@/server/db";
import { getBattleModeStats, getUserStats, listFeedback, listSessions } from "@/server/queries";
import { getWeeklyQuests } from "@/server/services/quests";
import { getWeeklyLeague } from "@/server/services/league";
import { dailyChallengeFor } from "@/content/battle-prompts";
import { BATTLE_MODES, getBattleMode } from "@/content/battle-modes";
import { XP_RULES } from "@/lib/game-rules";
import { formatMinutes } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { Mascot } from "@/components/art/mascot";
import { LevelBadge } from "@/components/art/medal";
import { CoachArt, DailyChallengeArt, FreeTalkArt, QuestArt } from "@/components/art/scene-art";
import { BattleModeArt } from "@/components/art/battle-art";
import { BattleModeCard } from "@/features/battles/mode-card";

export const metadata: Metadata = { title: "Dashboard" };

interface NextStep {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  art: React.ReactNode;
}

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const db = getDb();
  const stats = getUserStats(profile);
  const today = stats.today;
  const challenge = dailyChallengeFor(today);
  const challengeMode = getBattleMode(challenge.mode)!;
  const challengeDone = Boolean(get(db, "SELECT 1 FROM xp_events WHERE user_id = ? AND source_key = ?", profile.id, `daily-challenge:${today}`));
  const modeStats = getBattleModeStats(profile.id);
  const quests = getWeeklyQuests(db, profile.id, today);
  const league = getWeeklyLeague(db, profile, today);
  const goalSeconds = stats.goal.minutes * 60;
  const goalRatio = Math.min(1, stats.goal.practiceSecondsToday / goalSeconds);
  const remaining = Math.max(0, goalSeconds - stats.goal.practiceSecondsToday);
  const level = stats.xp.level;

  // Continue Practicing: the single most useful next step.
  const unfinished = listSessions(profile.id, { status: "incomplete", pageSize: 1 }).items.find((s) => s.origin !== "seed" && s.activityDate >= today);
  const claimable = quests.quests.find((q) => q.complete && !q.claimed);
  const toReview = listFeedback(profile.id, { limit: 5 }).find((f) => !f.reviewed && f.origin !== "seed" && f.sessionId);
  const untried = BATTLE_MODES.find((m) => m.id !== "free-play" && !modeStats[m.id]);
  const steps: NextStep[] = [];
  if (unfinished) {
    steps.push({
      eyebrow: "Unfinished",
      title: `Pick up where you left off`,
      description: `Your ${unfinished.type === "free_talk" ? "Free Talk" : "session"}${unfinished.topicTitle ? ` on “${unfinished.topicTitle}”` : ""} ended early. A full conversation earns XP and counts toward your streak.`,
      href: unfinished.topicId ? `/free-talk?topic=${unfinished.topicId}` : "/free-talk",
      cta: "Try again",
      art: <FreeTalkArt className="h-20 w-28" />,
    });
  }
  if (claimable) {
    steps.push({
      eyebrow: "Quest complete",
      title: `Claim +${claimable.xp} XP for “${claimable.title}”`,
      description: `${claimable.description}: done! Your reward is waiting in Achievements.`,
      href: "/achievements#quests",
      cta: "Claim reward",
      art: <QuestArt className="h-20 w-28" />,
    });
  }
  if (!stats.goal.reached) {
    steps.push({
      eyebrow: "Daily goal",
      title: stats.goal.practiceSecondsToday > 0 ? `${formatMinutes(remaining)} min to hit today's goal` : `Start today's ${stats.goal.minutes}-minute goal`,
      description: "A short Free Talk conversation is the fastest way to log speaking minutes.",
      href: "/free-talk",
      cta: "Start Free Talk",
      art: <FreeTalkArt className="h-20 w-28" />,
    });
  }
  if (toReview?.sessionId) {
    steps.push({
      eyebrow: "Review",
      title: "Review your latest feedback",
      description: `${toReview.analysis?.issues.filter((i) => !i.minor).length ?? 0} corrections from ${toReview.promptText ? `“${toReview.promptText}”` : "your last session"}. +${XP_RULES.review} XP for each review.`,
      href: `/history/${toReview.sessionId}`,
      cta: "Review now",
      art: <CoachArt className="h-20 w-28" />,
    });
  }
  if (untried) {
    steps.push({
      eyebrow: "Something new",
      title: `Try ${untried.name}`,
      description: `${untried.tagline} ${untried.speakSeconds}-second battle, +${untried.xp} XP.`,
      href: `/battles?mode=${untried.id}`,
      cta: "See battle",
      art: <BattleModeArt mode={untried.id} className="h-20 w-28" />,
    });
  }
  steps.push({
    eyebrow: "Keep it rolling",
    title: "Play a Quick Fire round",
    description: "Thirty seconds, one question, instant feedback.",
    href: "/battles?mode=quick-fire&go=1",
    cta: "Play",
    art: <BattleModeArt mode="quick-fire" className="h-20 w-28" />,
  });
  const [primary, ...others] = steps;
  const secondary = others.slice(0, 2);

  return (
    <div className="space-y-8">
      {/* Hero + daily challenge */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-[2rem] bg-navy-900 bg-dots-light p-6 text-white shadow-card sm:p-7 lg:col-span-8">
          <div className="pointer-events-none absolute -top-24 -right-10 h-72 w-72 rounded-full bg-brand-500/45 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-60 w-60 rounded-full bg-pink-500/30 blur-3xl" aria-hidden />
          <div className="relative flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-sun-300">{stats.streak.practicedToday ? "You've practiced today. Nice!" : "Ready when you are"}</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Welcome back, {profile.displayName}!</h1>
              <p className="mt-1.5 max-w-md text-white/70">Every conversation is a step toward speaking more confidently.</p>
            </div>
            <Mascot mood={stats.streak.practicedToday ? "cheer" : "wave"} className="hidden h-28 w-28 shrink-0 animate-bob sm:block" />
          </div>

          <div className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)]">
            <Link href="/progress" className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10 transition-colors hover:bg-white/15">
              <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", stats.streak.practicedToday ? "bg-orange-500" : "bg-white/15")}>
                <Flame className={cn("h-6 w-6", stats.streak.practicedToday ? "animate-flame fill-sun-300 text-white" : "text-white/70")} aria-hidden />
              </span>
              <span>
                <span className="block font-display text-2xl leading-none font-extrabold">{stats.streak.current} days</span>
                <span className="text-xs font-semibold text-white/65">{stats.streak.practicedToday ? "Streak safe today" : "Speak 2 min to keep it"}</span>
              </span>
            </Link>
            <Link href="/achievements" className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10 transition-colors hover:bg-white/15">
              <LevelBadge level={level.current.index} className="h-11 w-11" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base leading-tight font-extrabold">{level.current.name}</span>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/15">
                  <span className="block h-full rounded-full bg-gradient-to-r from-sun-400 to-pink-400" style={{ width: `${level.progress * 100}%` }} />
                </span>
                <span className="mt-1 block text-xs font-semibold text-white/65">
                  {stats.xp.total.toLocaleString("en-US")} XP{level.next ? ` · ${level.xpToNext} to next` : ""}
                </span>
              </span>
            </Link>
            <Link href="/progress" className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/10 transition-colors hover:bg-white/15">
              <ProgressRing value={goalRatio} size={46} stroke={6} tone={stats.goal.reached ? "success" : "pink"} label={`Daily goal ${Math.round(goalRatio * 100)}% complete`}>
                {stats.goal.reached ? <Check className="h-5 w-5 text-mint-300" /> : <Target className="h-4.5 w-4.5 text-white/80" />}
              </ProgressRing>
              <span>
                <span className="block font-display text-2xl leading-none font-extrabold">
                  {formatMinutes(stats.goal.practiceSecondsToday)}
                  <span className="text-sm text-white/60">/{stats.goal.minutes}</span>
                </span>
                <span className="text-xs font-semibold text-white/65">{stats.goal.reached ? "Daily goal reached" : `of ${stats.goal.minutes} min today`}</span>
              </span>
            </Link>
          </div>
          <div className="relative mt-4 flex flex-wrap items-center gap-3">
            <ButtonLink href="/free-talk" size="lg" variant="pop">
              <Mic className="h-5 w-5" /> Start Speaking
            </ButtonLink>
            <Link href="/achievements#league" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold ring-1 ring-white/10 hover:bg-white/15">
              <Trophy className="h-4 w-4 text-sun-300" /> #{league.you.rank} in the {league.tier}
              <span className="text-xs font-semibold text-white/55">(demo)</span>
            </Link>
          </div>
        </div>

        {/* Daily challenge */}
        <div className="relative flex flex-col overflow-hidden rounded-[2rem] border-2 border-sun-300 bg-gradient-to-br from-sun-100 via-sun-50 to-pink-100 p-6 lg:col-span-4">
          <div className="flex items-start justify-between gap-3">
            <Badge tone="pink">
              <Target className="h-3.5 w-3.5" /> Daily Challenge
            </Badge>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-sun-700 shadow-sm">
              <Zap className="h-3.5 w-3.5 fill-sun-400 text-sun-500" /> +{XP_RULES.dailyChallenge} bonus XP
            </span>
          </div>
          <DailyChallengeArt className="mx-auto mt-2 h-24 w-32 animate-bob" />
          <p className="mt-2 text-xs font-extrabold tracking-wide text-pink-700 uppercase">{challengeMode.name} battle</p>
          <h2 className="mt-0.5 text-xl leading-snug font-extrabold tracking-tight">{challenge.prompt}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Objective: finish this prompt today. +{challengeMode.xp} XP for the battle plus the daily bonus.
          </p>
          <div className="mt-auto pt-4">
            {challengeDone ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                <span className="flex items-center gap-2 font-bold text-mint-700">
                  <Check className="h-5 w-5" strokeWidth={3} /> Completed today
                </span>
                <Link href={`/battles?prompt=${challenge.id}&go=1`} className="text-sm font-bold text-brand-700 hover:underline">
                  Play again
                </Link>
              </div>
            ) : (
              <ButtonLink href={`/battles?prompt=${challenge.id}&go=1`} variant="pink" size="lg" className="w-full">
                <PlayCircle className="h-5 w-5" /> Accept challenge
              </ButtonLink>
            )}
          </div>
        </div>
      </section>

      {/* Continue practicing */}
      <section aria-labelledby="continue-title" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center lg:col-span-7">
          <div className="flex h-24 w-32 shrink-0 items-center justify-center self-center rounded-2xl bg-lavender">{primary.art}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold tracking-wide text-brand-600 uppercase">
              <span id="continue-title">Continue practicing</span> · {primary.eyebrow}
            </p>
            <h2 className="mt-0.5 text-xl font-extrabold tracking-tight">{primary.title}</h2>
            <p className="mt-1 text-sm text-muted">{primary.description}</p>
          </div>
          <ButtonLink href={primary.href} className="shrink-0">
            {primary.cta} <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
          {secondary.map((s) => (
            <Link key={s.title} href={s.href} className="group lift flex items-center gap-3 rounded-[1.5rem] border border-line bg-surface p-3 pr-4 shadow-card">
              <span className="flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted [&>svg]:h-12 [&>svg]:w-16">{s.art}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-extrabold tracking-wide text-muted uppercase">Up next · {s.eyebrow}</span>
                <span className="block truncate font-bold">{s.title}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-subtle transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      {/* Speaking battles */}
      <section aria-labelledby="battles-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="battles-title" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
              <Swords className="h-6 w-6 text-pink-500" /> Speaking Battles
            </h2>
            <p className="text-muted">Pick a mini-game and beat the clock. Every battle earns XP, win or lose.</p>
          </div>
          <ButtonLink href="/battles" variant="outline" size="sm">
            All battle details <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
        <div className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3">
          {BATTLE_MODES.map((m) => (
            <BattleModeCard
              key={m.id}
              mode={m}
              stat={modeStats[m.id]}
              detailHref={`/battles?mode=${m.id}`}
              actionHref={m.id === "free-play" ? `/battles?mode=${m.id}` : `/battles?mode=${m.id}&go=1`}
              actionLabel={m.id === "free-play" ? "Set up" : "Start"}
              compact
              className="w-[78vw] max-w-xs shrink-0 snap-start sm:w-auto sm:max-w-none"
            />
          ))}
        </div>
      </section>

      {/* Free Talk + Coach */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-400 via-sky-500 to-brand-500 p-6 text-white shadow-card sm:p-7 lg:col-span-7">
          <div className="pointer-events-none absolute inset-0 bg-dots-light" aria-hidden />
          <div className="relative grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <div>
              <Badge tone="dark">
                <MessagesSquare className="h-3.5 w-3.5" /> Free Talk
              </Badge>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Talk it out, no pressure</h2>
              <p className="mt-2 text-white/85">Match with a conversation partner around your level, pick a topic, and just talk. Corrections come after, never during.</p>
              <ul className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                <li className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
                  <Globe2 className="h-3.5 w-3.5" /> 40 topics
                </li>
                <li className="rounded-full bg-white/20 px-2.5 py-1">3–10 min</li>
                <li className="rounded-full bg-white/20 px-2.5 py-1">+{XP_RULES.conversationBase} XP and up</li>
                <li className="rounded-full bg-white/20 px-2.5 py-1">Demo partners are fictional</li>
              </ul>
              <ButtonLink href="/free-talk" size="lg" variant="white" className="mt-5">
                <Mic className="h-5 w-5" /> Find a partner
              </ButtonLink>
            </div>
            <FreeTalkArt className="mx-auto h-40 w-auto animate-bob" />
          </div>
        </div>

        <div className="relative flex flex-col overflow-hidden rounded-[2rem] bg-gradient-to-br from-mint-300 via-mint-400 to-sky-400 p-6 text-ink shadow-card lg:col-span-5">
          <div className="pointer-events-none absolute inset-0 bg-dots-light" aria-hidden />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <Badge tone="dark" className="bg-ink/80">
                <Sparkles className="h-3.5 w-3.5" /> AI Speaking Coach
              </Badge>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Sound more natural</h2>
              <p className="mt-1 text-ink-soft">Answer a prompt and get an improved version with explanations.</p>
            </div>
            <CoachArt className="h-24 w-28 shrink-0" />
          </div>
          <ul className="relative mt-4 grid grid-cols-2 gap-2 text-sm font-bold">
            {[
              ["Feedback", "on every answer"],
              ["Grammar", "fixes explained"],
              ["Natural English", "better phrasing"],
            ].map(([t, s]) => (
              <li key={t} className="rounded-2xl bg-white/80 px-3 py-2">
                <span className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-mint-600" strokeWidth={3} /> {t}
                </span>
                <span className="block text-xs font-semibold text-muted">{s}</span>
              </li>
            ))}
            <li className="rounded-2xl border-2 border-dashed border-ink/20 bg-white/40 px-3 py-2" title="Pronunciation needs a speech-analysis service, which the demo doesn't have.">
              <span className="flex items-center gap-1.5 text-ink-soft">Pronunciation</span>
              <span className="block text-xs font-semibold text-muted">not scored in the demo</span>
            </li>
          </ul>
          <div className="relative mt-auto flex flex-wrap gap-2 pt-5">
            <ButtonLink href="/coach" variant="dark">
              <BookOpenCheck className="h-4 w-4" /> Practice with Coach
            </ButtonLink>
            <ButtonLink href="/coach/saved" variant="white">
              My Learning
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Weekly quests teaser */}
      <section className="flex flex-col gap-4 rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center">
        <QuestArt className="h-20 w-28 shrink-0 self-center" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold tracking-wide text-orange-600 uppercase">
            <Gift className="mr-1 inline h-3.5 w-3.5" /> Weekly quests · {quests.daysLeft} day{quests.daysLeft === 1 ? "" : "s"} left
          </p>
          <p className="mt-0.5 font-bold">
            {quests.quests.filter((q) => q.claimed).length} of {quests.quests.length} claimed
            {claimable ? " · a reward is ready to claim!" : ""}
          </p>
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {quests.quests.map((q) => (
              <span key={q.id} className={cn("h-2 flex-1 rounded-full", q.claimed ? "bg-mint-500" : q.complete ? "animate-pulse bg-sun-400" : q.value > 0 ? "bg-brand-300" : "bg-line")} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden -space-x-2 sm:flex" aria-hidden>
            {league.entries.slice(0, 3).map((e) => (
              <Avatar key={e.id} name={e.name} avatar={e.avatar} size="sm" />
            ))}
          </div>
          <ButtonLink href="/achievements#quests" variant="secondary">
            View quests <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
