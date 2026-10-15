"use client";

import { Lock } from "lucide-react";
import { AVATARS, AVATAR_KEYS, isAvatarUnlocked } from "@/lib/avatars";
import { LEVELS } from "@/lib/game-rules";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";

/** Avatar chooser. Reward avatars stay locked until the player reaches their level. */
export function AvatarPicker({
  value,
  onChange,
  name,
  levelIndex,
  size = "md",
}: {
  value: string;
  onChange: (key: string) => void;
  name: string;
  levelIndex: number;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Avatar">
      {AVATAR_KEYS.map((key) => {
        const unlocked = isAvatarUnlocked(key, levelIndex);
        const preset = AVATARS[key];
        const levelName = preset.unlockLevel ? LEVELS.find((l) => l.index === preset.unlockLevel)?.name : null;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            aria-label={unlocked ? preset.label : `${preset.label} (unlocks at level ${preset.unlockLevel})`}
            title={unlocked ? preset.label : `Reward avatar: reach level ${preset.unlockLevel} (${levelName}) to unlock`}
            disabled={!unlocked}
            onClick={() => onChange(key)}
            className={cn(
              "relative rounded-full p-0.5 transition-transform",
              value === key ? "scale-105 ring-3 ring-brand-500 ring-offset-2" : unlocked && "hover:scale-110",
              !unlocked && "cursor-not-allowed",
            )}
          >
            <Avatar name={name || "?"} avatar={key} size={size} className={cn(!unlocked && "opacity-40 grayscale")} />
            {!unlocked && (
              <span className="absolute -right-1 -bottom-1 flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full bg-navy-900 px-1 text-[10px] font-bold text-white">
                <Lock className="h-2.5 w-2.5" aria-hidden />
                {preset.unlockLevel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
