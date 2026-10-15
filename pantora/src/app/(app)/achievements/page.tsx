import type { Metadata } from "next";
import Link from "next/link";
import { Check, Crown, Flame, Gift, Medal as MedalIcon, Sparkles, Swords, Target, Trophy, Users, Zap } from "lucide-react";
import { requireUser } from "@/server/auth";
import { get, getDb } from "@/server/db";
import { getAchievements, getUserStats } from "@/server/queries";
import { getWeeklyQuests } from "@/server/services/quests";
import { getWeeklyLeague } from "@/server/services/league";
import { dailyChallengeFor } from "@/content/battle-prompts";
import { getBattleMode } from "@/content/battle-modes";
import { LEVELS, XP_RULES, streakBonusXp } from "@/lib/game-rules";
import { AVATARS } from "@/lib/avatars";
import { formatDate, formatMinutes } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { LevelBadge, Medal } from "@/components/art/medal";
import { LeagueArt, QuestArt, TrophyArt } from "@/components/art/scene-art";
import { achievementVisual } from "@/components/game/achievement-icons";
import { QuestBoard } from "@/features/achievements/quest-board";
import { AvatarRewards } from "@/features/achievements/avatar-rewards";

export const metadata: Metadata = { title: "Achievements" };

export default async function AchievementsPage() {
  const { profile } = await requireUser();
  const db = getDb();
  const stats = getUserStats(profile);
  const achievements = getAchievements(profile);
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const level = stats.xp.level;
  const quests = getWeeklyQuests(db, profile.id, stats.today);
  const league = getWeeklyLeague(db, profile, stats.today);
  const challenge = dailyChallengeFor(stats.today);
  const challengeDone = Boolean(get(db, "SELECT 1 FROM xp_events WHERE user_id = ? AND source_key = ?", profile.id, `daily-challenge:${stats.today}`));
  const daily = [
    {
      id: "daily-challenge",
      title: "Daily Challenge",
      description: `Finish today's ${getBattleMode(challenge.mode)!.name} prompt`,
      done: challengeDone,
      xp: XP_RULES.dailyChallenge,
      href: `/battles?prompt=${challenge.id}&go=1`,
      icon: Target,
      progress: challengeDone ? 1 : 0,
      label: challengeDone ? "Done" : "0/1",
    },
    {
      id: "daily-goal",
      title: "Daily goal",
      description: `Speak for ${stats.goal.minutes} minutes`,
      done: stats.goal.reached,
      xp: XP_RULES.dailyGoal,
      href: "/free-talk",
      icon: Sparkles,
      progress: Math.min(1, stats.goal.practiceSecondsToday / (stats.goal.minutes * 60)),
      label: `${formatMinutes(stats.goal.practiceSecondsToday)}/${stats.goal.minutes} min`,
    },
    {
      id: "streak",
      title: "Keep the streak",
      description: "Speak for 2 minutes today",
      done: stats.streak.practicedToday,
      xp: streakBonusXp(stats.streak.current + (stats.streak.practicedToday ? 0 : 1)),
      href: "/free-talk",
      icon: Flame,
      progress: Math.min(1, stats.goal.practiceSecondsToday / stats.streak.minSeconds),
      label: stats.streak.practicedToday ? "Done" : `${formatMinutes(stats.goal.practiceSecondsToday)}/2 min`,
    },
  ];

  return (
    <div className="space-y-10">
      {/* Player hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-navy-900 bg-dots-light p-6 text-white shadow-card sm:p-8">
        <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-brand-500/45 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-10 -bottom-24 h-72 w-72 rounded-full bg-sun-400/25 blur-3xl" aria-hidden />
        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative shrink-0 self-start">
              <Avatar name={profile.displayName} avatar={profile.avatar} size="xl" className="h-20 w-20 ring-4 ring-white/20 sm:h-28 sm:w-28" />
              <LevelBadge level={level.current.index} className="absolute -right-3 -bottom-3 h-11 w-11 sm:h-14 sm:w-14" />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold tracking-tight">Achievements</h1>
              <p className="mt-1 font-bold text-sun-300">
                Level {level.current.index} · {level.current.name}
              </p>
              <p className="mt-1 text-sm text-white/70">{level.current.description}</p>
              <p className="mt-3 font-display text-4xl font-extrabold tabular-nums">
                {stats.xp.total.toLocaleString("en-US")} <span className="text-lg text-white/60">XP</span>
              </p>
              <div className="mt-2 max-w-xs">
                <div className="h-3 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={Math.round(level.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next level">
                  <div className="h-full rounded-full bg-gradient-to-r from-sun-400 via-pink-400 to-brand-400" style={{ width: `${level.progress * 100}%` }} />
                </div>
                <p className="mt-1.5 text-sm text-white/70">{level.next ? `${level.xpToNext} XP to ${level.next.name}` : "You've reached the top level."}</p>
              </div>
            </div>
          </div>
          <ol className="grid grid-cols-5 gap-2" aria-label="Levels">
            {LEVELS.map((l) => {
              const reached = stats.xp.total >= l.minXp;
              const reward = Object.entries(AVATARS).find(([, a]) => a.unlockLevel === l.index);
              return (
                <li key={l.index} className={cn("flex flex-col items-center rounded-2xl p-2 text-center sm:p-3", reached ? "bg-white/12" : "bg-white/[0.04] text-white/50", l.index === level.current.index && "ring-2 ring-sun-300")}>
                  <LevelBadge level={l.index} locked={!reached} className="h-10 w-10 sm:h-12 sm:w-12" />
                  <p className="mt-1.5 hidden text-xs leading-tight font-bold sm:block">{l.name}</p>
                  <p className="text-[10px] opacity-70">{l.minXp.toLocaleString("en-US")} XP</p>
                  {reward && (
                    <span className="mt-1.5" title={`Unlocks the ${reward[1].label} avatar`}>
                      <Avatar name={reward[1].label} avatar={reward[0]} size="xs" className={cn(!reached && "opacity-40 grayscale")} />
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <nav aria-label="Achievement sections" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {[
          ["#quests", "Quests", Gift],
          ["#league", "League", Trophy],
          ["#badges", "Badges", MedalIcon],
          ["#rewards", "Rewards", Crown],
          ["#xp", "Ways to earn XP", Zap],
        ].map(([href, label, Icon]) => {
          const I = Icon as typeof Gift;
          return (
            <a key={href as string} href={href as string} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-line bg-surface px-4 py-2 text-sm font-bold hover:border-brand-300 hover:bg-brand-50">
              <I className="h-4 w-4 text-brand-500" /> {label as string}
            </a>
          );
        })}
      </nav>

      {/* Quests */}
      <section id="quests" aria-labelledby="quests-title" className="scroll-mt-24 space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <QuestArt className="h-16 w-20" />
          <div className="flex-1">
            <h2 id="quests-title" className="text-2xl font-extrabold tracking-tight">
              Quests
            </h2>
            <p className="text-muted">Daily goals reward you automatically. Weekly quests reset every Monday: finish them, then claim the XP.</p>
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-extrabold tracking-wide text-muted uppercase">Today</h3>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {daily.map((d) => (
              <li key={d.id}>
                <Link href={d.href} className={cn("lift flex items-center gap-3 rounded-[1.5rem] border-2 p-4", d.done ? "border-mint-300 bg-mint-50/70" : "border-line bg-surface")}>
                  <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white", d.done ? "bg-mint-500" : "bg-brand-500")}>
                    {d.done ? <Check className="h-6 w-6" strokeWidth={3} /> : <d.icon className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-bold">{d.title}</span>
                      <span className="text-xs font-extrabold text-sun-700">+{d.xp} XP</span>
                    </span>
                    <span className="block truncate text-sm text-muted">{d.description}</span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <ProgressBar value={d.progress} tone={d.done ? "success" : "brand"} className="h-1.5 flex-1" label={`${d.title} progress`} />
                      <span className="text-xs font-bold tabular-nums">{d.label}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-extrabold tracking-wide text-muted uppercase">
            This week
            <Badge tone="sun">
              {quests.daysLeft} day{quests.daysLeft === 1 ? "" : "s"} left
            </Badge>
            <span className="text-xs font-semibold tracking-normal normal-case">Counts only your own activity, not sample history.</span>
          </h3>
          <QuestBoard quests={quests.quests} />
        </div>
      </section>

      {/* League */}
      <section id="league" aria-labelledby="league-title" className="scroll-mt-24">
        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <div className="flex flex-col items-center justify-center bg-gradient-to-br from-sun-300 via-orange-400 to-pink-500 p-6 text-center text-ink">
              <LeagueArt className="h-36 w-48 animate-bob" />
              <h2 id="league-title" className="mt-2 text-2xl font-extrabold tracking-tight">
                {league.tier}
              </h2>
              <p className="text-sm font-semibold text-ink/75">Weekly friendly competition · resets Monday</p>
              <p className="mt-3 rounded-2xl bg-white/80 px-4 py-2 text-sm font-bold">
                {league.you.rank === 1 ? "You're leading this week!" : `${league.xpToPass} XP to pass ${league.aheadName}`}
              </p>
              <Badge tone="demo" className="mt-3">
                <Users className="h-3.5 w-3.5" /> Demo league: other players are fictional
              </Badge>
            </div>
            <CardBody>
              <ol className="space-y-1.5" aria-label="League standings">
                {league.entries.map((e) => (
                  <li
                    key={e.id}
                    className={cn("flex items-center gap-3 rounded-2xl px-3 py-2", e.isYou ? "bg-brand-50 ring-2 ring-brand-300" : e.rank <= 3 ? "bg-sun-50/70" : "")}
                    aria-current={e.isYou ? "true" : undefined}
                  >
                    <span className={cn("w-7 text-center font-display text-lg font-extrabold", e.rank === 1 ? "text-sun-500" : e.rank === 2 ? "text-sky-500" : e.rank === 3 ? "text-pink-500" : "text-subtle")}>{e.rank}</span>
                    <Avatar name={e.name} avatar={e.avatar} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {e.name}
                      {e.isYou ? " (you)" : ""}
                    </span>
                    {!e.isYou && <span className="hidden text-xs text-subtle sm:inline">simulated</span>}
                    <span className="font-display font-extrabold tabular-nums">{e.xp} XP</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-muted">
                Your weekly XP is real ({league.you.xp} XP since {formatDate(`${league.weekStart}T12:00:00Z`)}{profile.isDemoAccount ? ", including sample history" : ""}). The other players are Pantora&apos;s fictional demo partners with simulated XP. No one is ever demoted, and only top-three places are highlighted.
              </p>
            </CardBody>
          </div>
        </Card>
      </section>

      {/* Badges */}
      <section id="badges" aria-labelledby="badges-title" className="scroll-mt-24">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="badges-title" className="text-2xl font-extrabold tracking-tight">
              Badges
            </h2>
            <p className="text-muted">
              {unlocked.length} of {achievements.length} unlocked. Badges celebrate practice: they are game progress, not language certifications.
            </p>
          </div>
          <TrophyArt className="hidden h-16 w-20 sm:block" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...achievements]
            .sort((a, b) => Number(!!b.unlockedAt) - Number(!!a.unlockedAt) || b.progress.ratio - a.progress.ratio)
            .map((a) => {
              const v = achievementVisual(a.id, a.icon);
              const done = !!a.unlockedAt;
              return (
                <div
                  key={a.id}
                  className={cn("lift flex flex-col items-center rounded-[1.5rem] border p-4 text-center", done ? "border-sun-200 bg-gradient-to-b from-sun-50 to-surface shadow-card" : "border-line bg-surface/70")}
                  data-testid="achievement"
                  data-unlocked={done}
                >
                  <Medal icon={v.icon} color={v.color} locked={!done} />
                  <p className={cn("mt-2 leading-tight font-bold", done ? "text-ink" : "text-ink-soft")}>{a.name}</p>
                  <p className="mt-1 text-xs text-muted">{a.description}</p>
                  <div className="mt-auto w-full pt-3">
                    {done ? (
                      <Badge tone="mint">Unlocked {formatDate(a.unlockedAt!, profile.timezone)}</Badge>
                    ) : (
                      <>
                        <ProgressBar value={a.progress.value} max={a.target} tone="sun" label={`${a.name} progress`} />
                        <p className="mt-1 text-xs font-bold text-muted">
                          {a.progress.value} / {a.target}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* Rewards */}
      <section id="rewards" aria-labelledby="rewards-title" className="scroll-mt-24">
        <h2 id="rewards-title" className="text-2xl font-extrabold tracking-tight">
          Unlockable avatars
        </h2>
        <p className="mb-4 text-muted">Level up to unlock new Pantora Pals. Equip one and it shows on your profile, battles, and the league.</p>
        <AvatarRewards profile={profile} levelIndex={level.current.index} />
      </section>

      {/* XP */}
      <section id="xp" className="scroll-mt-24">
        <Card>
          <CardHeader title="Ways to earn XP" icon={<Zap className="h-5 w-5" />} />
          <CardBody>
            <ul className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Complete a conversation", `${XP_RULES.conversationBase} XP + ${XP_RULES.conversationPerMinute} per minute`, Users],
                ["Finish a Speaking Battle", `30–50 XP by battle type (+${XP_RULES.battlePersonalBest} for a personal best)`, Swords],
                ["Play the Daily Challenge", `+${XP_RULES.dailyChallenge} XP once per day`, Target],
                ["Complete a coach exercise", `${XP_RULES.coachTyped} XP typed, ${XP_RULES.coachRecorded} XP recorded`, Sparkles],
                ["Reach your daily goal", `${XP_RULES.dailyGoal} XP once per day`, Check],
                ["Practice on consecutive days", `${XP_RULES.streakPerDay} XP × streak length (max ${XP_RULES.streakPerDay * XP_RULES.streakBonusCap})`, Flame],
                ["Finish a weekly quest", "30–60 XP, claimed once per week", Gift],
                ["Review feedback", `${XP_RULES.review} XP per item, once`, MedalIcon],
              ].map(([what, xp, Icon]) => {
                const I = Icon as typeof Gift;
                return (
                  <li key={what as string} className="flex items-start gap-3 rounded-2xl bg-surface-muted/60 p-4">
                    <I className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                    <span>
                      <span className="block font-bold">{what as string}</span>
                      <span className="text-muted">{xp as string}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs text-muted">Rewards are tied to each activity, so refreshing a page or submitting twice never awards XP again.</p>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
