import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Flame,
  GraduationCap,
  Library,
  MessageSquareText,
  MessagesSquare,
  Mic,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";
import { requireUser } from "@/server/auth";
import { getUserStats, listFeedback, listSessions } from "@/server/queries";
import { dailyChallengeFor } from "@/content/battle-prompts";
import { CATEGORY_LABELS, DIFFICULTY_LABELS } from "@/lib/labels";
import { formatDate, formatMinutes, relativeDay, weekdayShort } from "@/lib/dates";
import { STREAK_RULE_TEXT } from "@/lib/game-rules";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge, SampleBadge } from "@/components/ui/badge";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionRow } from "@/components/app/session-row";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const stats = getUserStats(profile);
  const recent = listSessions(profile.id, { pageSize: 5 }).items;
  const latestFeedback = listFeedback(profile.id, { limit: 1 })[0] ?? null;
  const challenge = dailyChallengeFor(stats.today);
  const goalSeconds = stats.goal.minutes * 60;
  const goalRatio = Math.min(1, stats.goal.practiceSecondsToday / goalSeconds);
  const week = stats.days.slice(-7);
  const prevWeek = stats.days.slice(-14, -7);
  const weekSeconds = week.reduce((s, d) => s + d.practiceSeconds, 0);
  const prevSeconds = prevWeek.reduce((s, d) => s + d.practiceSeconds, 0);
  const weekHasSample = [...week, ...prevWeek].some((d) => d.isSample);
  const remaining = Math.max(0, goalSeconds - stats.goal.practiceSecondsToday);
  const firstSampleDate = stats.totals.sampleSessions > 0 ? stats.days.find((d) => d.isSample)?.date : null;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative overflow-hidden rounded-card bg-navy-900 p-6 text-white shadow-card sm:p-8">
          <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-brand-500/35 blur-3xl" aria-hidden />
          <div className="relative">
            <p className="text-sm font-semibold text-brand-300">{stats.streak.practicedToday ? "You've practiced today" : "Ready when you are"}</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Welcome back, {profile.displayName}!</h2>
            <p className="mt-2 max-w-lg text-white/70">Every conversation is a step toward speaking more confidently.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/free-talk" size="lg">
                <Mic className="h-5 w-5" /> Start Speaking
              </ButtonLink>
              <ButtonLink href={`/battles?prompt=${challenge.id}`} size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                Today&apos;s challenge
              </ButtonLink>
            </div>
            {profile.isDemoAccount && (
              <p className="mt-6 text-xs text-white/55">
                Demo account: activity before today{firstSampleDate ? ` (from ${relativeDay(firstSampleDate, stats.today)})` : ""} is preloaded sample history. Everything you do now is tracked for real.
              </p>
            )}
          </div>
        </div>
        <Card className="flex items-center gap-5 p-6 lg:w-80">
          <ProgressRing value={goalRatio} size={104} tone={stats.goal.reached ? "success" : "brand"} label={`Daily goal ${Math.round(goalRatio * 100)}% complete`}>
            <span className="text-2xl font-extrabold">{formatMinutes(stats.goal.practiceSecondsToday)}</span>
            <span className="text-[11px] font-semibold text-muted">of {stats.goal.minutes} min</span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">Today&apos;s goal</p>
            <p className="mt-1 font-bold text-ink">{stats.goal.reached ? "Goal reached — great work!" : `${formatMinutes(remaining)} min to go`}</p>
            <p className="mt-1 text-xs text-muted">Only practice time counts. Opening the app doesn&apos;t.</p>
          </div>
        </Card>
      </section>

      {/* Stats */}
      <section aria-label="Key statistics" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Speaking minutes" value={formatMinutes(stats.totals.practiceSeconds)} unit="min" icon={<Clock className="h-5 w-5" />} hint={stats.totals.sampleSessions ? "Includes sample history" : "All time"} />
        <StatCard label="Conversations" value={stats.totals.conversations} icon={<MessagesSquare className="h-5 w-5" />} tone="info" hint="Completed Free Talks" />
        <StatCard label="Current streak" value={stats.streak.current} unit={stats.streak.current === 1 ? "day" : "days"} icon={<Flame className="h-5 w-5" />} tone="streak" hint={`Longest: ${stats.streak.longest} days`} />
        <StatCard label="Battles completed" value={stats.totals.battles} icon={<Swords className="h-5 w-5" />} tone="success" hint={stats.battles.best != null ? `Best score: ${stats.battles.best}/100` : "No battles yet"} />
      </section>

      {/* Quick actions */}
      <section aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {[
          { href: "/free-talk", icon: MessagesSquare, title: "Start Free Talk", body: "5–15 minute conversation", tone: "bg-brand-50 text-brand-600" },
          { href: "/battles", icon: Swords, title: "Join a Speaking Battle", body: "30-second challenge", tone: "bg-streak-50 text-streak-600" },
          { href: "/coach", icon: GraduationCap, title: "Practice with AI", body: "Get a better version", tone: "bg-info-50 text-info-700" },
          { href: "/topics", icon: Library, title: "Explore topics", body: "40 conversation ideas", tone: "bg-success-50 text-success-600" },
          { href: "/history?feedback=1", icon: MessageSquareText, title: "Review feedback", body: "Revisit corrections", tone: "bg-lavender text-brand-700" },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="group rounded-card border border-line bg-surface p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop sm:p-5">
            <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", a.tone)}>
              <a.icon className="h-5.5 w-5.5" />
            </span>
            <p className="mt-4 font-bold text-ink">{a.title}</p>
            <p className="mt-0.5 text-sm text-muted">{a.body}</p>
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Daily challenge */}
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-5 bg-gradient-to-br from-streak-50 via-surface to-surface p-6 sm:flex-row sm:items-center">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-streak-500 text-white shadow-card">
                <Zap className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-streak-700">Daily challenge</p>
                  <Badge tone="neutral">{CATEGORY_LABELS[challenge.category]}</Badge>
                  <Badge tone="neutral">{DIFFICULTY_LABELS[challenge.difficulty]}</Badge>
                </div>
                <p className="mt-1 text-lg font-bold text-ink">{challenge.prompt}</p>
                <p className="mt-1 text-sm text-muted">{challenge.guidance}</p>
              </div>
              <ButtonLink href={`/battles?prompt=${challenge.id}`} className="shrink-0">
                Start challenge <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </div>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader
              title="Recent activity"
              description="Your latest practice sessions"
              action={
                <ButtonLink href="/history" variant="ghost" size="sm">
                  View all
                </ButtonLink>
              }
            />
            <CardBody className="pt-3">
              {recent.length === 0 ? (
                <EmptyState
                  icon={<MessagesSquare className="h-6 w-6" />}
                  title="No sessions yet"
                  description="Your conversations, battles, and coach exercises will appear here once you complete them."
                  action={<ButtonLink href="/free-talk">Start your first conversation</ButtonLink>}
                />
              ) : (
                <div className="-mx-3 divide-y divide-line/60">
                  {recent.map((s) => (
                    <SessionRow key={s.id} s={s} timeZone={profile.timezone} />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Streak widget */}
          <Card>
            <CardHeader title="Streak" icon={<Flame className="h-5 w-5" />} description={`${stats.streak.current}-day streak · longest ${stats.streak.longest}`} />
            <CardBody>
              <ol className="grid grid-cols-7 gap-1.5" aria-label="Last seven days">
                {week.map((d) => (
                  <li key={d.date} className="flex flex-col items-center gap-1.5">
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full",
                        d.qualifies ? "bg-streak-500 text-white" : d.practiceSeconds > 0 ? "bg-streak-100 text-streak-700" : "bg-surface-muted text-subtle",
                        d.date === stats.today && "ring-2 ring-brand-400 ring-offset-2",
                      )}
                      title={`${d.date}: ${formatMinutes(d.practiceSeconds)} min${d.isSample ? " (sample data)" : ""}`}
                    >
                      <Flame className={cn("h-4.5 w-4.5", d.qualifies && "fill-white/30")} aria-hidden />
                    </span>
                    <span className={cn("text-[11px] font-semibold", d.date === stats.today ? "text-brand-700" : "text-muted")}>{weekdayShort(d.date).slice(0, 2)}</span>
                    <span className="sr-only">{d.qualifies ? "counted toward streak" : d.practiceSeconds > 0 ? "some practice, below minimum" : "no practice"}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs leading-relaxed text-muted">{STREAK_RULE_TEXT}</p>
            </CardBody>
          </Card>

          {/* Progress summary */}
          <Card>
            <CardHeader title="This week" icon={<Trophy className="h-5 w-5" />} action={weekHasSample ? <SampleBadge label="Includes sample" /> : undefined} />
            <CardBody>
              <p className="text-3xl font-extrabold">
                {formatMinutes(weekSeconds)} <span className="text-base font-semibold text-subtle">min</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                {prevSeconds === 0 && weekSeconds === 0
                  ? "No practice logged in the last two weeks yet."
                  : weekSeconds >= prevSeconds
                    ? `Up ${formatMinutes(weekSeconds - prevSeconds)} min from the previous 7 days.`
                    : `${formatMinutes(prevSeconds - weekSeconds)} min less than the previous 7 days.`}
              </p>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-xs font-semibold text-muted">
                  <span>{stats.xp.level.current.name}</span>
                  <span>{stats.xp.total} XP</span>
                </div>
                <ProgressBar value={stats.xp.level.progress} label="Level progress" />
                <p className="mt-1.5 text-xs text-muted">{stats.xp.level.next ? `${stats.xp.level.xpToNext} XP to ${stats.xp.level.next.name}` : "Top level reached"}</p>
              </div>
              <ButtonLink href="/progress" variant="secondary" size="sm" className="mt-4 w-full">
                See full progress
              </ButtonLink>
            </CardBody>
          </Card>

          {/* Recent feedback */}
          <Card>
            <CardHeader title="Recent feedback" icon={<Sparkles className="h-5 w-5" />} action={latestFeedback?.origin === "seed" ? <SampleBadge label="Sample" /> : undefined} />
            <CardBody>
              {latestFeedback ? (
                <>
                  <p className="text-sm text-ink-soft">{latestFeedback.analysis.summary}</p>
                  {latestFeedback.analysis.issues.filter((i) => !i.minor && i.original)[0] && (
                    <div className="mt-3 rounded-xl bg-lavender p-3 text-sm">
                      <p className="text-muted line-through decoration-danger-500/60">{latestFeedback.analysis.issues.filter((i) => !i.minor)[0].original}</p>
                      <p className="mt-0.5 font-semibold text-ink">{latestFeedback.analysis.issues.filter((i) => !i.minor)[0].corrected}</p>
                    </div>
                  )}
                  <p className="mt-3 text-xs text-muted">
                    {latestFeedback.analyzer === "demo-rules" ? "Demo analyzer" : "AI feedback"} · {formatDate(latestFeedback.createdAt, profile.timezone)}
                  </p>
                  <ButtonLink href={latestFeedback.sessionId ? `/history/${latestFeedback.sessionId}` : "/coach"} variant="outline" size="sm" className="mt-3 w-full">
                    Review feedback
                  </ButtonLink>
                </>
              ) : (
                <EmptyState title="No feedback yet" description="Finish a battle or a coach exercise to get your first feedback." className="py-6" action={<ButtonLink href="/coach" size="sm">Try the coach</ButtonLink>} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
