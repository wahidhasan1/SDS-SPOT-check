"use client";

import { useState } from "react";
import { Flame, Sparkles, Target, Zap } from "lucide-react";
import type { Rewards } from "@/server/services/gamification";
import { formatMinutes } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { CelebrationModal, CountUp } from "@/components/game/celebration";
import { LevelBadge, Medal } from "@/components/art/medal";
import { achievementVisual } from "@/components/game/achievement-icons";

/** Shows exactly which rewards a completed activity earned, with a celebration for big moments. */
export function RewardsSummary({ rewards, className }: { rewards: Rewards; className?: string }) {
  const items = rewards.xpItems;
  const big = Boolean(rewards.levelUp) || rewards.newAchievements.length > 0;
  const [celebrate, setCelebrate] = useState(big);
  const goalDone = rewards.goal.reachedNow || rewards.goal.practiceSecondsToday >= rewards.goal.goalSeconds;
  const goalPct = Math.min(1, rewards.goal.practiceSecondsToday / Math.max(1, rewards.goal.goalSeconds));
  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-pink-500 p-4 text-white">
          <span className="absolute inset-y-0 left-0 w-1/3 animate-shine bg-white/20" aria-hidden />
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-white/80 uppercase">
            <Sparkles className="h-4 w-4" /> XP earned
          </p>
          <p className="mt-1 font-display text-4xl font-extrabold">
            <CountUp value={rewards.xpTotal} prefix="+" suffix=" XP" />
          </p>
        </div>
        <div className={cn("rounded-2xl p-4", rewards.streak.extendedToday ? "bg-orange-50" : "bg-surface-muted")}>
          <p className={cn("flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase", rewards.streak.extendedToday ? "text-orange-700" : "text-muted")}>
            <Flame className={cn("h-4 w-4", rewards.streak.extendedToday && "animate-flame fill-sun-400 text-orange-500")} /> Streak
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold">
            {rewards.streak.current} day{rewards.streak.current === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-muted">{rewards.streak.extendedToday ? (rewards.streak.milestone ? `${rewards.streak.milestone}-day milestone!` : "Extended today") : "Needs 2 min of speaking today"}</p>
        </div>
        <div className={cn("rounded-2xl p-4", goalDone ? "bg-mint-50" : "bg-surface-muted")}>
          <p className={cn("flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase", goalDone ? "text-mint-700" : "text-muted")}>
            <Target className="h-4 w-4" /> Daily goal
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold">
            {formatMinutes(rewards.goal.practiceSecondsToday)}
            <span className="text-base text-muted"> / {formatMinutes(rewards.goal.goalSeconds)} min</span>
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-mint-500 transition-[width] duration-700" style={{ width: `${goalPct * 100}%` }} />
          </div>
        </div>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((i, index) => (
            <li
              key={i.key}
              className="flex animate-slide-up items-center justify-between gap-4 rounded-xl bg-surface-muted/70 px-3.5 py-2 text-sm"
              style={{ animationDelay: `${150 + index * 120}ms` }}
            >
              <span className="flex items-center gap-2 text-ink-soft">
                <Zap className="h-4 w-4 text-sun-500" aria-hidden /> {i.reason}
              </span>
              <span className="font-extrabold text-brand-700">+{i.amount} XP</span>
            </li>
          ))}
        </ul>
      )}
      {rewards.levelUp && (
        <p className="flex items-center gap-3 rounded-2xl bg-mint-50 px-4 py-3 text-sm font-semibold text-mint-700">
          <LevelBadge level={rewards.levelUp.index} className="h-9 w-9" /> Level up! You are now a {rewards.levelUp.name}.
        </p>
      )}
      {rewards.newAchievements.map((a) => {
        const v = achievementVisual(a.id, a.icon);
        return (
          <p key={a.id} className="flex items-center gap-3 rounded-2xl bg-sun-50 px-4 py-3 text-sm font-semibold text-sun-700">
            <Medal icon={v.icon} color={v.color} size="sm" className="h-10 w-10" /> Achievement unlocked: {a.name}
          </p>
        );
      })}
      {big && (
        <CelebrationModal
          open={celebrate}
          onClose={() => setCelebrate(false)}
          eyebrow={rewards.levelUp ? "Level up" : "Achievement unlocked"}
          title={rewards.levelUp ? rewards.levelUp.name : rewards.newAchievements[0].name}
          art={
            rewards.levelUp ? (
              <LevelBadge level={rewards.levelUp.index} className="h-32 w-32" />
            ) : (
              (() => {
                const v = achievementVisual(rewards.newAchievements[0].id, rewards.newAchievements[0].icon);
                return <Medal icon={v.icon} color={v.color} size="lg" className="h-32 w-32" />;
              })()
            )
          }
        >
          <p>{rewards.levelUp ? rewards.levelUp.description : rewards.newAchievements[0].description}</p>
          {(rewards.levelUp ? rewards.newAchievements : rewards.newAchievements.slice(1)).map((a) => (
            <p key={a.id} className="mt-2 text-sm font-semibold text-sun-300">
              + Achievement: {a.name}
            </p>
          ))}
          <p className="mt-2 text-sm font-bold text-white">+{rewards.xpTotal} XP from this session</p>
        </CelebrationModal>
      )}
    </div>
  );
}
