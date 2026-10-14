import type { Metadata } from "next";
import {
  AudioLines,
  Bookmark,
  CalendarCheck,
  CheckCheck,
  Clock,
  Compass,
  Flame,
  GraduationCap,
  Lock,
  MessageCircle,
  MessagesSquare,
  Swords,
  Target,
  Timer,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/server/auth";
import { getAchievements, getUserStats } from "@/server/queries";
import { LEVELS, XP_RULES } from "@/lib/game-rules";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Achievements" };

const ICONS: Record<string, LucideIcon> = {
  "message-circle": MessageCircle,
  "messages-square": MessagesSquare,
  "audio-lines": AudioLines,
  swords: Swords,
  trophy: Trophy,
  flame: Flame,
  "calendar-check": CalendarCheck,
  clock: Clock,
  timer: Timer,
  "check-check": CheckCheck,
  compass: Compass,
  bookmark: Bookmark,
  "graduation-cap": GraduationCap,
  target: Target,
};

export default async function AchievementsPage() {
  const { profile } = await requireUser();
  const stats = getUserStats(profile);
  const achievements = getAchievements(profile);
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const level = stats.xp.level;

  return (
    <div className="space-y-6">
      <PageHeader title="Achievements" description="Levels and badges celebrate consistent practice. They're motivational game progress — not language certifications." />

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 gap-6 bg-navy-900 p-6 text-white sm:p-8 lg:grid-cols-[minmax(0,1fr)_1.4fr]">
          <div>
            <p className="text-sm font-semibold text-brand-300">Level {level.current.index}</p>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight">{level.current.name}</h2>
            <p className="mt-2 text-white/70">{level.current.description}</p>
            <p className="mt-5 text-4xl font-extrabold tabular-nums">
              {stats.xp.total.toLocaleString("en-US")} <span className="text-lg font-semibold text-white/60">XP</span>
            </p>
            <div className="mt-3 max-w-sm">
              <div className="h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={Math.round(level.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next level">
                <div className="h-full rounded-full bg-brand-400" style={{ width: `${level.progress * 100}%` }} />
              </div>
              <p className="mt-2 text-sm text-white/70">{level.next ? `${level.xpToNext} XP to ${level.next.name}` : "You've reached the top level."}</p>
            </div>
          </div>
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5 lg:self-center">
            {LEVELS.map((l) => {
              const reached = stats.xp.total >= l.minXp;
              return (
                <li key={l.index} className={cn("rounded-2xl border p-3", reached ? "border-brand-400/50 bg-white/10" : "border-white/10 bg-white/[0.03] text-white/50")}>
                  <p className="text-xs font-bold">Level {l.index}</p>
                  <p className="mt-1 text-sm font-semibold">{l.name}</p>
                  <p className="mt-1 text-xs opacity-70">{l.minXp.toLocaleString("en-US")} XP</p>
                </li>
              );
            })}
          </ol>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          Badges <span className="text-muted">· {unlocked.length} of {achievements.length} unlocked</span>
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[...achievements]
          .sort((a, b) => Number(!!b.unlockedAt) - Number(!!a.unlockedAt) || b.progress.ratio - a.progress.ratio)
          .map((a) => {
            const Icon = ICONS[a.icon] ?? Trophy;
            const done = !!a.unlockedAt;
            return (
              <Card key={a.id} className={cn("p-5", !done && "bg-surface/70")} data-testid="achievement" data-unlocked={done}>
                <div className="flex items-start gap-4">
                  <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", done ? "bg-streak-50 text-streak-600" : "bg-surface-muted text-subtle")}>
                    {done ? <Icon className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn("font-bold", done ? "text-ink" : "text-ink-soft")}>{a.name}</p>
                      {done ? <Badge tone="success">Unlocked</Badge> : <Badge tone="neutral">Locked</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted">{a.description}</p>
                    {done ? (
                      <p className="mt-3 text-xs font-semibold text-success-700">Unlocked {formatDate(a.unlockedAt!, profile.timezone)}</p>
                    ) : (
                      <div className="mt-3">
                        <ProgressBar value={a.progress.value} max={a.target} tone="streak" label={`${a.name} progress`} />
                        <p className="mt-1.5 text-xs text-muted">
                          {a.progress.value} / {a.target}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
      </div>

      <Card>
        <CardHeader title="Ways to earn XP" />
        <CardBody>
          <ul className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Complete a conversation", `${XP_RULES.conversationBase} XP + ${XP_RULES.conversationPerMinute} per minute`],
              ["Finish a Speaking Battle", `${XP_RULES.battle} XP (+${XP_RULES.battlePersonalBest} for a personal best)`],
              ["Complete a coach exercise", `${XP_RULES.coachTyped} XP typed, ${XP_RULES.coachRecorded} XP recorded`],
              ["Reach your daily goal", `${XP_RULES.dailyGoal} XP once per day`],
              ["Practice on consecutive days", `${XP_RULES.streakPerDay} XP × streak length (max ${XP_RULES.streakPerDay * XP_RULES.streakBonusCap})`],
              ["Review feedback", `${XP_RULES.review} XP per item, once`],
            ].map(([what, xp]) => (
              <li key={what} className="rounded-2xl bg-surface-muted/60 p-4">
                <p className="font-semibold">{what}</p>
                <p className="mt-0.5 text-muted">{xp}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Rewards are tied to each activity, so refreshing a page or submitting twice never awards XP again.</p>
        </CardBody>
      </Card>
    </div>
  );
}
