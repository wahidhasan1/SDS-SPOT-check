import { Award, Flame, Sparkles, Target, TrendingUp } from "lucide-react";
import type { Rewards } from "@/server/services/gamification";
import { formatMinutes } from "@/lib/dates";
import { cn } from "@/lib/cn";

/** Shows exactly which rewards a completed activity earned. */
export function RewardsSummary({ rewards, className }: { rewards: Rewards; className?: string }) {
  const items = rewards.xpItems;
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-700">
          <Sparkles className="h-4 w-4" /> +{rewards.xpTotal} XP
        </span>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold", rewards.streak.extendedToday ? "bg-streak-50 text-streak-700" : "bg-surface-muted text-muted")}>
          <Flame className="h-4 w-4" />
          {rewards.streak.extendedToday ? `Streak: ${rewards.streak.current} day${rewards.streak.current === 1 ? "" : "s"}` : `Streak: ${rewards.streak.current} (needs 2 min today)`}
        </span>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold", rewards.goal.reachedNow || rewards.goal.practiceSecondsToday >= rewards.goal.goalSeconds ? "bg-success-50 text-success-700" : "bg-surface-muted text-muted")}>
          <Target className="h-4 w-4" />
          Today: {formatMinutes(rewards.goal.practiceSecondsToday)} / {formatMinutes(rewards.goal.goalSeconds)} min
        </span>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1 text-sm text-ink-soft">
          {items.map((i) => (
            <li key={i.key} className="flex justify-between gap-4">
              <span>{i.reason}</span>
              <span className="font-semibold text-brand-700">+{i.amount} XP</span>
            </li>
          ))}
        </ul>
      )}
      {rewards.levelUp && (
        <p className="flex items-center gap-2 rounded-xl bg-success-50 px-3.5 py-2.5 text-sm font-semibold text-success-700">
          <TrendingUp className="h-4 w-4" /> Level up! You are now a {rewards.levelUp.name}.
        </p>
      )}
      {rewards.newAchievements.map((a) => (
        <p key={a.id} className="flex items-center gap-2 rounded-xl bg-streak-50 px-3.5 py-2.5 text-sm font-semibold text-streak-700">
          <Award className="h-4 w-4" /> Achievement unlocked: {a.name}
        </p>
      ))}
    </div>
  );
}
