"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Lock } from "lucide-react";
import type { UserProfile } from "@/lib/types";
import { AVATARS, REWARD_AVATARS, isAvatarUnlocked } from "@/lib/avatars";
import { LEVELS } from "@/lib/game-rules";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Reward avatars that unlock with levels. Unlocked ones can be equipped in one tap. */
export function AvatarRewards({ profile, levelIndex }: { profile: UserProfile; levelIndex: number }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  async function equip(key: string) {
    setSaving(key);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: {
          profile: {
            displayName: profile.displayName,
            avatar: key,
            proficiency: profile.proficiency,
            goals: profile.goals,
            dailyGoalMinutes: profile.dailyGoalMinutes,
            conversationPref: profile.conversationPref,
          },
        },
      });
      toast({ tone: "success", title: `${AVATARS[key].label} equipped`, description: "Your new avatar shows everywhere in Pantora." });
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't change avatar", description: errorMessage(e) });
    } finally {
      setSaving(null);
    }
  }

  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {REWARD_AVATARS.map((key) => {
        const preset = AVATARS[key];
        const unlocked = isAvatarUnlocked(key, levelIndex);
        const equipped = profile.avatar === key;
        const level = LEVELS.find((l) => l.index === preset.unlockLevel)!;
        return (
          <li key={key} className={cn("flex flex-col items-center rounded-[1.5rem] border-2 p-4 text-center", unlocked ? "border-brand-200 bg-brand-50/50" : "border-dashed border-line bg-surface")}>
            <div className="relative">
              <Avatar name={preset.label} avatar={key} size="xl" className={cn("h-20 w-20", !unlocked && "opacity-40 grayscale")} />
              {!unlocked && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-white">
                    <Lock className="h-4 w-4" />
                  </span>
                </span>
              )}
            </div>
            <p className="mt-3 font-display text-lg font-extrabold">{preset.label}</p>
            <p className="text-xs text-muted">
              Level {level.index} · {level.name}
            </p>
            <div className="mt-3 w-full">
              {equipped ? (
                <p className="flex items-center justify-center gap-1 rounded-2xl bg-mint-100 py-2 text-sm font-bold text-mint-700">
                  <Check className="h-4 w-4" /> Equipped
                </p>
              ) : unlocked ? (
                <Button size="sm" variant="secondary" className="w-full" onClick={() => equip(key)} loading={saving === key}>
                  Equip
                </Button>
              ) : (
                <p className="rounded-2xl bg-surface-muted py-2 text-xs font-bold text-muted">Reach level {level.index} to unlock</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
