import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, CalendarDays, CheckCheck, ChevronRight, Clock, Flame, Gauge, MessagesSquare, Swords, Timer, Trophy } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getBattleDimensionAverages, getUserStats, listFeedback } from "@/server/queries";
import { formatDate, formatDuration, formatMinutes } from "@/lib/dates";
import { PRACTICE_TIME_RULE_TEXT, STREAK_RULE_TEXT, XP_RULES } from "@/lib/game-rules";
import { SCORING_NOTE } from "@/lib/analysis/demo-analyzer";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, SampleBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { ActivityCalendar, DailyBars } from "@/features/progress/charts";

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const { profile } = await requireUser();
  const stats = getUserStats(profile);
  const skills = getBattleDimensionAverages(profile.id);
  const feedback = listFeedback(profile.id, { limit: 6 });
  const last14 = stats.days.slice(-14);
  const last30 = stats.days.slice(-30);
  const monthSeconds = last30.reduce((s, d) => s + d.practiceSeconds, 0);
  const activeDays30 = last30.filter((d) => d.practiceSeconds > 0).length;
  const hasSample = stats.totals.sampleSessions > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your progress"
        description="Practice time, streaks, and skills — calculated only from sessions you've completed."
        actions={hasSample ? <SampleBadge label="Includes sample history" /> : undefined}
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Summary">
        <StatCard label="Total practice" value={formatMinutes(stats.totals.practiceSeconds)} unit="min" icon={<Clock className="h-5 w-5" />} />
        <StatCard label="Sessions" value={stats.totals.sessions} icon={<MessagesSquare className="h-5 w-5" />} tone="info" hint={`${stats.totals.conversations} talks · ${stats.totals.battles} battles · ${stats.totals.coach} coach`} />
        <StatCard label="Avg. conversation" value={stats.totals.avgSessionSeconds ? formatDuration(stats.totals.avgSessionSeconds) : "—"} icon={<Timer className="h-5 w-5" />} tone="success" />
        <StatCard label="Current streak" value={stats.streak.current} unit="days" icon={<Flame className="h-5 w-5" />} tone="streak" hint={`Longest: ${stats.streak.longest} days`} />
        <StatCard label="Last 30 days" value={formatMinutes(monthSeconds)} unit="min" icon={<CalendarDays className="h-5 w-5" />} hint={`${activeDays30} active day${activeDays30 === 1 ? "" : "s"}`} />
        <StatCard label="Battles" value={stats.battles.total} icon={<Swords className="h-5 w-5" />} tone="streak" hint={`${stats.battles.wins} won · ${stats.battles.draws} draw · ${stats.battles.losses} lost`} />
        <StatCard label="Saved sentences" value={stats.totals.savedSentences} icon={<Bookmark className="h-5 w-5" />} tone="info" />
        <StatCard label="Feedback reviewed" value={stats.totals.reviewedCount} icon={<CheckCheck className="h-5 w-5" />} tone="success" hint={`${stats.totals.feedbackCount} feedback reports`} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Weekly activity" description="Speaking minutes per day, last 14 days" icon={<Gauge className="h-5 w-5" />} />
          <CardBody>
            {last14.every((d) => d.practiceSeconds === 0) ? (
              <EmptyState title="No practice in the last two weeks" description="Your daily minutes will appear here after your next session." action={<ButtonLink href="/free-talk">Start a conversation</ButtonLink>} />
            ) : (
              <DailyBars days={last14} goalMinutes={stats.goal.minutes} today={stats.today} />
            )}
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold text-brand-600">View as table</summary>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-1.5 font-semibold">Date</th>
                    <th className="py-1.5 font-semibold">Minutes</th>
                    <th className="py-1.5 font-semibold">Sessions</th>
                    <th className="py-1.5 font-semibold">XP</th>
                    <th className="py-1.5 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...last14].reverse().map((d) => (
                    <tr key={d.date}>
                      <td className="py-1.5">{d.date}</td>
                      <td className="py-1.5 tabular-nums">{formatMinutes(d.practiceSeconds)}</td>
                      <td className="py-1.5 tabular-nums">{d.sessions}</td>
                      <td className="py-1.5 tabular-nums">{d.xp}</td>
                      <td className="py-1.5 text-muted">{d.isSample ? "Sample" : d.sessions ? "Tracked" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Monthly activity" description="Last six weeks" icon={<CalendarDays className="h-5 w-5" />} />
          <CardBody>
            <ActivityCalendar days={stats.days} today={stats.today} />
            {hasSample && <p className="mt-3 text-xs text-muted">Days with a dashed outline come from the demo account&apos;s sample history.</p>}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Progress by skill"
            description="Average Speaking Battle scores by rubric dimension"
            icon={<Trophy className="h-5 w-5" />}
            action={skills.sampleCount > 0 ? <SampleBadge label={`${skills.sampleCount} of ${skills.count} sample`} /> : undefined}
          />
          <CardBody>
            {skills.count < 2 ? (
              <EmptyState
                title="Not enough data yet"
                description={`Skill averages appear after at least two scored Speaking Battles. You have ${skills.count}. Pantora doesn't estimate skills without evaluations.`}
                action={<ButtonLink href="/battles" size="sm">Take a Speaking Battle</ButtonLink>}
              />
            ) : (
              <>
                <ul className="space-y-4">
                  {skills.dimensions.map((d) => (
                    <li key={d.key}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="font-semibold text-ink">{d.label}</span>
                        <span className="text-muted tabular-nums">
                          avg <span className="font-semibold text-ink">{d.average.toFixed(1)}</span>/{d.max} · best {d.best}
                        </span>
                      </div>
                      <ProgressBar value={d.average} max={d.max} className="mt-1.5" label={`${d.label} average`} />
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted">
                  Based on {skills.count} scored battles. {SCORING_NOTE}
                </p>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Feedback history" icon={<CheckCheck className="h-5 w-5" />} action={<ButtonLink href="/history?feedback=1" variant="ghost" size="sm">All</ButtonLink>} />
          <CardBody className="pt-3">
            {feedback.length === 0 ? (
              <EmptyState title="No feedback yet" description="Feedback from battles, the coach, and captioned conversations will be listed here." />
            ) : (
              <ul className="-mx-2 divide-y divide-line/60">
                {feedback.map((f) => (
                  <li key={f.id}>
                    <Link href={f.sessionId ? `/history/${f.sessionId}` : "/history"} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-surface-muted/70">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{f.promptText ?? "Practice feedback"}</span>
                        <span className="text-xs text-muted">
                          {f.kind === "battle" ? "Battle" : f.kind === "coach" ? "Coach" : "Conversation"} · {formatDate(f.createdAt, profile.timezone)} ·{" "}
                          {f.analysis.issues.filter((i) => !i.minor).length} correction{f.analysis.issues.filter((i) => !i.minor).length === 1 ? "" : "s"}
                        </span>
                      </span>
                      {f.origin === "seed" && <SampleBadge label="Sample" />}
                      {f.reviewed ? <Badge tone="success">Reviewed</Badge> : <Badge tone="streak">To review</Badge>}
                      <ChevronRight className="h-4 w-4 text-subtle" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="How progress is calculated" />
        <CardBody className="grid grid-cols-1 gap-6 text-sm text-ink-soft md:grid-cols-3">
          <div>
            <p className="font-semibold text-ink">Practice time</p>
            <p className="mt-1">{PRACTICE_TIME_RULE_TEXT} Conversations under 1 minute are saved as incomplete and don&apos;t count.</p>
          </div>
          <div>
            <p className="font-semibold text-ink">Streaks</p>
            <p className="mt-1">{STREAK_RULE_TEXT} Your streak stays alive until the end of the next day.</p>
          </div>
          <div>
            <p className="font-semibold text-ink">XP</p>
            <p className="mt-1">
              Conversation {XP_RULES.conversationBase} + {XP_RULES.conversationPerMinute}/min · Battle {XP_RULES.battle} (+{XP_RULES.battlePersonalBest} personal best) · Coach {XP_RULES.coachTyped}–{XP_RULES.coachRecorded} · Daily goal {XP_RULES.dailyGoal} · Streak day {XP_RULES.streakPerDay}×streak (max {XP_RULES.streakPerDay * XP_RULES.streakBonusCap}) · Review {XP_RULES.review}. Each reward is given once per activity.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
