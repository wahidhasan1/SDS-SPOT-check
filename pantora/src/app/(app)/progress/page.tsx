import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Flame,
  Gauge,
  Lightbulb,
  Medal as MedalIcon,
  Minus,
  Mic,
  Swords,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { requireUser } from "@/server/auth";
import {
  getAchievements,
  getBattleModeStats,
  getChallengeCounts,
  getScoreHistory,
  getUserStats,
  getWeeklyBreakdown,
  listFeedback,
  mistakePatterns,
  type DayPoint,
} from "@/server/queries";
import { formatDate, formatMinutes } from "@/lib/dates";
import { PRACTICE_TIME_RULE_TEXT, STREAK_MILESTONES, STREAK_RULE_TEXT, XP_RULES } from "@/lib/game-rules";
import { weekStartOf } from "@/lib/quests";
import { ISSUE_CATEGORY_LABELS } from "@/lib/labels";
import { SCORING_NOTE } from "@/lib/analysis/demo-analyzer";
import { BATTLE_MODES } from "@/content/battle-modes";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, SampleBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";
import { LevelBadge, Medal } from "@/components/art/medal";
import { EmptyArt, ProgressArt } from "@/components/art/scene-art";
import { BattleModeArt } from "@/components/art/battle-art";
import { achievementVisual } from "@/components/game/achievement-icons";
import { ActivityCalendar, DailyBars } from "@/features/progress/charts";
import { ScoreLineChart, Sparkline, WeeklyStack, WinDonut } from "@/features/progress/trend-charts";

export const metadata: Metadata = { title: "Progress" };

const DIM_COLORS = ["var(--color-brand-500)", "var(--color-pink-500)", "var(--color-sky-500)", "var(--color-mint-500)", "var(--color-orange-500)"];

function summarize(days: DayPoint[]) {
  return {
    minutes: days.reduce((s, d) => s + d.practiceSeconds, 0),
    sessions: days.reduce((s, d) => s + d.sessions, 0),
    xp: days.reduce((s, d) => s + d.xp, 0),
    activeDays: days.filter((d) => d.sessions > 0).length,
    hasSample: days.some((d) => d.isSample),
  };
}

function Delta({ now, before, unit = "" }: { now: number; before: number; unit?: string }) {
  if (now === 0 && before === 0) return <span className="text-xs font-semibold text-subtle">No activity either period</span>;
  if (before === 0) return <span className="text-xs font-semibold text-mint-700">New this period</span>;
  const diff = now - before;
  if (diff === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted">
        <Minus className="h-3.5 w-3.5" /> Same as before
      </span>
    );
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-bold", diff > 0 ? "text-mint-700" : "text-orange-700")}>
      {diff > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {diff > 0 ? "+" : ""}
      {diff}
      {unit} vs previous
    </span>
  );
}

export default async function ProgressPage() {
  const { profile } = await requireUser();
  const stats = getUserStats(profile);
  const history = getScoreHistory(profile.id);
  const measured = history.filter((p) => !p.sample);
  const weeks = getWeeklyBreakdown(profile.id, stats.today);
  const modeStats = getBattleModeStats(profile.id);
  const counts = getChallengeCounts(profile.id);
  const achievements = getAchievements(profile);
  const patterns = mistakePatterns(profile.id).slice(0, 3);
  const feedback = listFeedback(profile.id, { limit: 4 });
  const level = stats.xp.level;
  const hasSample = stats.totals.sampleSessions > 0;

  const days = stats.days;
  const week = summarize(days.slice(-7));
  const prevWeek = summarize(days.slice(-14, -7));
  const month = summarize(days.slice(-30));
  const prevMonth = summarize(days.slice(-60, -30));

  // Skill trends: one line per rubric dimension, from scored battles.
  const dimKeys = history[0]?.dimensions.map((d) => ({ key: d.key, label: d.label, max: d.max })) ?? [];
  const trendThreshold = 4;
  const dimTrends = dimKeys.map((d, i) => {
    const series = history.map((p) => ({ v: p.dimensions.find((x) => x.key === d.key)?.score ?? 0, sample: p.sample }));
    const mine = measured.map((p) => p.dimensions.find((x) => x.key === d.key)?.score ?? 0);
    const half = Math.floor(mine.length / 2);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const change = mine.length >= trendThreshold ? avg(mine.slice(half)) - avg(mine.slice(0, half)) : null;
    const average = avg(series.map((s) => s.v));
    return { ...d, color: DIM_COLORS[i % DIM_COLORS.length], series, change, average };
  });
  const weakest = [...dimTrends].sort((a, b) => a.average / a.max - b.average / b.max)[0];

  const nextAchievements = achievements
    .filter((a) => !a.unlockedAt)
    .sort((a, b) => b.progress.ratio - a.progress.ratio)
    .slice(0, 3);
  const recentUnlocks = achievements
    .filter((a) => a.unlockedAt)
    .sort((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""))
    .slice(0, 3);
  const nextStreakMilestone = STREAK_MILESTONES.find((m) => m > stats.streak.current) ?? null;
  const winRate = stats.battles.total ? Math.round((stats.battles.wins / stats.battles.total) * 100) : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange-400 via-pink-500 to-brand-600 p-6 text-white shadow-card sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-dots-light" aria-hidden />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Your progress</h1>
            <p className="mt-2 max-w-xl text-white/85">Trends, streaks, and skills, calculated only from sessions you&apos;ve completed. Pantora never estimates a skill it hasn&apos;t measured.</p>
            {hasSample && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                Includes labeled sample history: hatched or hollow marks are preloaded demo data, solid marks are your own activity.
              </p>
            )}
          </div>
          <ProgressArt className="h-32 w-44 shrink-0 self-center animate-bob" />
        </div>
      </section>

      {/* Key numbers */}
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="col-span-2 flex items-center gap-4 rounded-[1.5rem] border border-line bg-surface p-4 shadow-card sm:p-5 lg:col-span-1">
          <LevelBadge level={level.current.index} className="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-muted">Level {level.current.index}</p>
            <p className="font-display text-lg leading-tight font-extrabold">{level.current.name}</p>
            <ProgressBar value={level.progress} tone="rainbow" className="mt-1.5" label="Progress to next level" />
            <p className="mt-1 text-xs text-muted">
              {stats.xp.total.toLocaleString("en-US")} XP{level.next ? ` · ${level.xpToNext} to ${level.next.name}` : " · max level"}
            </p>
          </div>
        </div>
        <StatTile icon={<Flame className="h-5 w-5" />} tone="bg-orange-500" label="Current streak" value={`${stats.streak.current}`} unit="days" hint={`Longest: ${stats.streak.longest} days`} />
        <StatTile icon={<Trophy className="h-5 w-5" />} tone="bg-pink-500" label="Battle win rate" value={winRate == null ? "–" : `${winRate}%`} hint={`${stats.battles.wins}W · ${stats.battles.draws}D · ${stats.battles.losses}L`} />
        <StatTile
          icon={<Target className="h-5 w-5" />}
          tone="bg-mint-500"
          label="Challenges done"
          value={`${counts.dailyChallenges + counts.questsClaimed}`}
          hint={`${counts.dailyChallenges} daily · ${counts.questsClaimed} weekly quests`}
        />
      </section>

      {/* Weekly & monthly summaries */}
      <section aria-labelledby="summaries" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <h2 id="summaries" className="sr-only">
          Weekly and monthly summaries
        </h2>
        {[
          { title: "Last 7 days", sub: "compared with the 7 days before", now: week, before: prevWeek },
          { title: "Last 30 days", sub: "compared with the 30 days before", now: month, before: prevMonth },
        ].map((p) => (
          <Card key={p.title}>
            <CardHeader
              title={p.title}
              description={p.sub}
              icon={<CalendarDays className="h-5 w-5" />}
              action={p.now.hasSample || p.before.hasSample ? <SampleBadge label="Includes sample" /> : undefined}
            />
            <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Speaking", `${formatMinutes(p.now.minutes)}`, "min", Math.round(p.now.minutes / 60), Math.round(p.before.minutes / 60), " min"],
                ["Sessions", `${p.now.sessions}`, "", p.now.sessions, p.before.sessions, ""],
                ["XP earned", `${p.now.xp}`, "", p.now.xp, p.before.xp, ""],
                ["Active days", `${p.now.activeDays}`, "", p.now.activeDays, p.before.activeDays, ""],
              ].map(([label, value, unit, n, b, u]) => (
                <div key={label as string} className="rounded-2xl bg-surface-muted/60 p-3">
                  <p className="text-xs font-bold text-muted">{label}</p>
                  <p className="font-display text-2xl font-extrabold">
                    {value}
                    {unit && <span className="text-sm text-subtle"> {unit}</span>}
                  </p>
                  <Delta now={n as number} before={b as number} unit={u as string} />
                </div>
              ))}
            </CardBody>
          </Card>
        ))}
      </section>

      {/* Activity */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Completed sessions" description="Per week, by activity, last 8 weeks" icon={<Gauge className="h-5 w-5" />} />
          <CardBody>
            <WeeklyStack weeks={weeks} currentWeek={weekStartOf(stats.today)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Streak history" description="Last six weeks of practice" icon={<Flame className="h-5 w-5" />} />
          <CardBody>
            <ActivityCalendar days={stats.days} today={stats.today} />
            {hasSample && <p className="mt-3 text-xs text-muted">Days with a dashed outline come from the demo account&apos;s sample history.</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Speaking minutes" description="Per day, last 14 days" icon={<Mic className="h-5 w-5" />} />
        <CardBody>
          <DailyBars days={stats.days.slice(-14)} goalMinutes={stats.goal.minutes} today={stats.today} />
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
                {[...stats.days.slice(-14)].reverse().map((d) => (
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

      {/* Feedback trends */}
      <section aria-labelledby="trends-title" className="space-y-5">
        <div>
          <h2 id="trends-title" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <TrendingUp className="h-6 w-6 text-brand-500" /> Feedback trends
          </h2>
          <p className="text-muted">From Speaking Battles scored with the 100-point rubric. {SCORING_NOTE}</p>
        </div>
        {history.length < 2 ? (
          <Card>
            <CardBody className="flex flex-col items-center py-10 text-center">
              <EmptyArt className="h-24 w-24" mood="think" />
              <p className="mt-3 text-lg font-bold">Not enough data yet</p>
              <p className="max-w-md text-sm text-muted">
                Trends appear after at least two scored Speaking Battles. You have {history.length}. Pantora doesn&apos;t estimate skills without evaluations.
              </p>
              <ButtonLink href="/battles" className="mt-4">
                <Swords className="h-4 w-4" /> Play a battle
              </ButtonLink>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader
                title="Battle scores over time"
                description={`${history.length} scored battles · ${measured.length} yours, ${history.length - measured.length} sample`}
                icon={<Trophy className="h-5 w-5" />}
              />
              <CardBody>
                <ScoreLineChart points={history} />
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-semibold text-brand-600">View as table</summary>
                  <table className="mt-3 w-full text-left text-sm">
                    <thead className="text-xs text-muted">
                      <tr>
                        <th className="py-1.5 font-semibold">Date</th>
                        <th className="py-1.5 font-semibold">Score</th>
                        <th className="py-1.5 font-semibold">Prompt</th>
                        <th className="py-1.5 font-semibold">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {[...history].reverse().map((p) => (
                        <tr key={p.id}>
                          <td className="py-1.5 whitespace-nowrap">{formatDate(p.date, profile.timezone)}</td>
                          <td className="py-1.5 tabular-nums">{p.total}</td>
                          <td className="py-1.5">
                            <Link href={`/history/${p.sessionId}`} className="hover:underline">
                              {p.prompt}
                            </Link>
                          </td>
                          <td className="py-1.5 text-muted">{p.sample ? "Sample" : "Yours"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Skill by skill" description="Each rubric dimension across your battles" icon={<Gauge className="h-5 w-5" />} />
              <CardBody>
                <ul className="space-y-3">
                  {dimTrends.map((d) => (
                    <li key={d.key} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{d.label}</p>
                        <p className="text-xs text-muted">
                          avg {d.average.toFixed(1)}/{d.max} ·{" "}
                          {d.change == null ? (
                            <span>trend after {trendThreshold} of your own battles</span>
                          ) : Math.abs(d.change) < 0.5 ? (
                            <span>steady</span>
                          ) : (
                            <span className={d.change > 0 ? "font-bold text-mint-700" : "font-bold text-orange-700"}>
                              {d.change > 0 ? "▲ up" : "▼ down"} {Math.abs(d.change).toFixed(1)} pts
                            </span>
                          )}
                        </p>
                      </div>
                      <Sparkline values={d.series} max={d.max} color={d.color} label={`${d.label} scores over time`} />
                    </li>
                  ))}
                  <li className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-line p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">Pronunciation</p>
                      <p className="text-xs text-muted">Not measured. Pronunciation needs a speech-analysis service, which isn&apos;t configured, so no score is shown. Accent never affects scores.</p>
                    </div>
                    <Badge tone="neutral">Not scored</Badge>
                  </li>
                </ul>
                {measured.length < trendThreshold && (
                  <p className="mt-4 rounded-xl bg-surface-muted px-3 py-2 text-xs text-muted">
                    Improvement is only claimed from your own battles: you have {measured.length} of the {trendThreshold} needed. Hollow points are sample history.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </section>

      {/* Battles + improve */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Battle record" icon={<Swords className="h-5 w-5" />} action={<ButtonLink href="/battles" variant="ghost" size="sm">Play</ButtonLink>} />
          <CardBody>
            <div className="flex items-center gap-5">
              <WinDonut wins={stats.battles.wins} draws={stats.battles.draws} losses={stats.battles.losses} />
              <dl className="grid flex-1 grid-cols-2 gap-2 text-sm">
                {[
                  ["Played", stats.battles.total],
                  ["Best score", stats.battles.best ?? "–"],
                  ["Average", stats.battles.average ?? "–"],
                  ["Daily challenges", counts.dailyChallenges],
                ].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl bg-surface-muted/60 px-3 py-2">
                    <dt className="text-xs font-bold text-muted">{l}</dt>
                    <dd className="font-display text-xl font-extrabold">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="mt-2 flex gap-3 text-xs text-muted">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-mint-500" /> Wins
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Draws
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-line-strong" /> Losses
              </span>
            </p>
            <ul className="mt-4 divide-y divide-line">
              {BATTLE_MODES.filter((m) => m.id !== "free-play").map((m) => {
                const s = modeStats[m.id];
                return (
                  <li key={m.id} className="flex items-center gap-3 py-2">
                    <BattleModeArt mode={m.id} className="h-8 w-11" />
                    <span className="flex-1 text-sm font-bold">{m.name}</span>
                    {s ? (
                      <span className="text-xs text-muted tabular-nums">
                        {s.played} played · {s.wins} won · best <strong className="text-ink">{s.best ?? "–"}</strong>
                        {s.sampleOnly ? " (sample)" : ""}
                      </span>
                    ) : (
                      <Link href={`/battles?mode=${m.id}`} className="text-xs font-bold text-brand-600 hover:underline">
                        Not played yet
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Areas to improve" description="From corrections in your feedback" icon={<Lightbulb className="h-5 w-5" />} />
          <CardBody className="space-y-3">
            {patterns.length === 0 && !weakest ? (
              <p className="text-sm text-muted">Nothing to suggest yet. Feedback from battles, the coach, and captioned conversations will show patterns here.</p>
            ) : (
              <>
                {weakest && history.length >= 2 && (
                  <div className="rounded-2xl bg-orange-50 p-4">
                    <p className="text-xs font-extrabold tracking-wide text-orange-700 uppercase">Focus skill</p>
                    <p className="mt-0.5 font-bold">{weakest.label}</p>
                    <p className="text-sm text-ink-soft">
                      Your lowest rubric area so far ({weakest.average.toFixed(1)}/{weakest.max} on average). Try a Story Sprint or Big Question to practice developing answers.
                    </p>
                  </div>
                )}
                {patterns.map((p) => (
                  <div key={p.category} className="rounded-2xl border border-line p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold">{ISSUE_CATEGORY_LABELS[p.category] ?? p.category}</p>
                      <Badge tone="neutral">
                        {p.count} correction{p.count === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    {p.example && (
                      <p className="mt-1.5 text-sm">
                        <span className="text-muted line-through decoration-danger-500/60">{p.example.original}</span> <ArrowRight className="inline h-3.5 w-3.5 text-subtle" />{" "}
                        <span className="font-semibold text-mint-700">{p.example.corrected}</span>
                      </p>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 pt-1">
                  <ButtonLink href="/coach" variant="secondary" size="sm">
                    Practice with AI Coach
                  </ButtonLink>
                  <ButtonLink href="/coach/saved" variant="ghost" size="sm">
                    My saved sentences
                  </ButtonLink>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Milestones */}
      <section aria-labelledby="milestones-title">
        <h2 id="milestones-title" className="mb-4 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <MedalIcon className="h-6 w-6 text-sun-500" /> Milestones
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MilestoneCard
            art={<LevelBadge level={Math.min(level.current.index + 1, 5)} locked={!level.next} className="h-14 w-14" />}
            label="Next level"
            title={level.next ? level.next.name : "Max level reached"}
            ratio={level.progress}
            hint={level.next ? `${level.xpToNext} XP to go` : "You're a Global Speaker"}
          />
          <MilestoneCard
            art={
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100">
                <Flame className="h-8 w-8 fill-sun-400 text-orange-500" />
              </span>
            }
            label="Next streak milestone"
            title={nextStreakMilestone ? `${nextStreakMilestone}-day streak` : "Legendary streak"}
            ratio={nextStreakMilestone ? stats.streak.current / nextStreakMilestone : 1}
            hint={nextStreakMilestone ? `${nextStreakMilestone - stats.streak.current} more day${nextStreakMilestone - stats.streak.current === 1 ? "" : "s"}` : "All streak milestones reached"}
          />
          {nextAchievements.slice(0, 2).map((a) => {
            const v = achievementVisual(a.id, a.icon);
            return (
              <MilestoneCard
                key={a.id}
                art={<Medal icon={v.icon} color={v.color} size="sm" />}
                label="Almost there"
                title={a.name}
                ratio={a.progress.ratio}
                hint={`${a.progress.value}/${a.progress.target} · ${a.description}`}
              />
            );
          })}
        </div>
        {recentUnlocks.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-line bg-surface p-4 shadow-card">
            <p className="text-sm font-bold text-muted">Recently unlocked:</p>
            {recentUnlocks.map((a) => {
              const v = achievementVisual(a.id, a.icon);
              return (
                <span key={a.id} className="inline-flex items-center gap-2 rounded-full bg-sun-50 py-1 pr-3 pl-1 text-sm font-bold">
                  <Medal icon={v.icon} color={v.color} size="sm" className="h-8 w-8" /> {a.name}
                </span>
              );
            })}
            <ButtonLink href="/achievements" variant="ghost" size="sm" className="ml-auto">
              All achievements <ChevronRight className="h-4 w-4" />
            </ButtonLink>
          </div>
        )}
      </section>

      {/* Recent feedback */}
      <Card>
        <CardHeader title="Recent feedback" icon={<CheckCheck className="h-5 w-5" />} action={<ButtonLink href="/history?feedback=1" variant="ghost" size="sm">All</ButtonLink>} />
        <CardBody className="pt-3">
          {feedback.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Feedback from battles, the coach, and captioned conversations will be listed here.</p>
          ) : (
            <ul className="-mx-2 divide-y divide-line/60">
              {feedback.map((f) => (
                <li key={f.id}>
                  <Link href={f.sessionId ? `/history/${f.sessionId}` : "/history"} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-surface-muted/70">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{f.promptText ?? "Practice feedback"}</span>
                      <span className="text-xs text-muted">
                        {f.kind === "battle" ? "Battle" : f.kind === "coach" ? "Coach" : "Conversation"} · {formatDate(f.createdAt, profile.timezone)} · {f.analysis.issues.filter((i) => !i.minor).length} correction
                        {f.analysis.issues.filter((i) => !i.minor).length === 1 ? "" : "s"}
                      </span>
                    </span>
                    {f.origin === "seed" && <SampleBadge label="Sample" />}
                    {f.reviewed ? <Badge tone="mint">Reviewed</Badge> : <Badge tone="streak">To review</Badge>}
                    <ChevronRight className="h-4 w-4 text-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

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
              Conversation {XP_RULES.conversationBase} + {XP_RULES.conversationPerMinute}/min · Battles 30–50 by type (+{XP_RULES.battlePersonalBest} personal best, +{XP_RULES.dailyChallenge} Daily Challenge) · Coach {XP_RULES.coachTyped}–{XP_RULES.coachRecorded} · Daily goal {XP_RULES.dailyGoal} · Streak day{" "}
              {XP_RULES.streakPerDay}×streak (max {XP_RULES.streakPerDay * XP_RULES.streakBonusCap}) · Review {XP_RULES.review} · Weekly quests 30–60. Each reward is given once.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function StatTile({ icon, tone, label, value, unit, hint }: { icon: React.ReactNode; tone: string; label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="rounded-[1.5rem] border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-muted">{label}</p>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-white", tone)}>{icon}</span>
      </div>
      <p className="mt-1 font-display text-3xl font-extrabold">
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-subtle">{unit}</span>}
      </p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function MilestoneCard({ art, label, title, ratio, hint }: { art: React.ReactNode; label: string; title: string; ratio: number; hint: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-[1.5rem] border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        {art}
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-wide text-muted uppercase">{label}</p>
          <p className="truncate font-bold">{title}</p>
        </div>
      </div>
      <ProgressBar value={ratio} tone="sun" label={`${title} progress`} />
      <p className="line-clamp-2 text-xs text-muted">{hint}</p>
    </div>
  );
}
