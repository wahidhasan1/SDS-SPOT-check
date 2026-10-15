"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Gift, Zap } from "lucide-react";
import type { QuestProgress } from "@/server/services/quests";
import type { Level } from "@/lib/game-rules";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { CelebrationModal } from "@/components/game/celebration";
import { QuestArt } from "@/components/art/scene-art";
import { LevelBadge } from "@/components/art/medal";

const RING: Record<QuestProgress["color"], string> = {
  violet: "bg-brand-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  sky: "bg-sky-500",
  mint: "bg-mint-500",
  sun: "bg-sun-400",
};
const BAR: Record<QuestProgress["color"], "brand" | "pink" | "streak" | "sky" | "success" | "sun"> = {
  violet: "brand",
  pink: "pink",
  orange: "streak",
  sky: "sky",
  mint: "success",
  sun: "sun",
};

/** Weekly quests with claimable XP rewards. */
export function QuestBoard({ quests }: { quests: QuestProgress[] }) {
  const router = useRouter();
  const toast = useToast();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ title: string; xp: number; levelUp: Level | null } | null>(null);

  async function claim(q: QuestProgress) {
    setClaiming(q.id);
    try {
      const res = await api<{ xp: number; levelUp: Level | null }>(`/api/quests/${q.id}/claim`, { body: {} });
      setCelebration({ title: q.title, xp: res.xp, levelUp: res.levelUp });
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't claim that quest", description: errorMessage(e) });
    } finally {
      setClaiming(null);
    }
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {quests.map((q) => {
          const ready = q.complete && !q.claimed;
          return (
            <li
              key={q.id}
              className={cn(
                "flex flex-col rounded-[1.5rem] border-2 bg-surface p-4 transition-colors",
                ready ? "border-sun-400 bg-sun-50 shadow-[0_0_0_4px_var(--color-sun-100)]" : q.claimed ? "border-mint-300 bg-mint-50/60" : "border-line",
              )}
              data-testid="quest"
            >
              <div className="flex items-start gap-3">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white", q.claimed ? "bg-mint-500" : RING[q.color], ready && "animate-wiggle")}>
                  {q.claimed ? <Check className="h-6 w-6" strokeWidth={3} /> : <Gift className="h-5.5 w-5.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg leading-tight font-extrabold">{q.title}</p>
                  <p className="text-sm text-muted">{q.description}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sun-100 px-2 py-0.5 text-xs font-extrabold text-sun-700">
                  <Zap className="h-3.5 w-3.5 fill-sun-400 text-sun-500" aria-hidden />
                  {q.xp} XP
                </span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <ProgressBar value={q.value} max={q.target} tone={q.claimed ? "success" : BAR[q.color]} className="flex-1" label={`${q.title} progress`} />
                <span className="text-sm font-bold tabular-nums">
                  {q.value}/{q.target}
                </span>
              </div>
              <div className="mt-3">
                {q.claimed ? (
                  <p className="text-sm font-bold text-mint-700">Claimed · +{q.xp} XP</p>
                ) : ready ? (
                  <Button variant="pop" className="w-full" onClick={() => claim(q)} loading={claiming === q.id}>
                    <Gift className="h-4 w-4" /> Claim {q.xp} XP
                  </Button>
                ) : (
                  <Link href={q.href} className="text-sm font-bold text-brand-600 hover:underline">
                    Make progress →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {celebration && (
        <CelebrationModal
          open
          onClose={() => setCelebration(null)}
          eyebrow="Quest complete"
          title={`+${celebration.xp} XP`}
          art={celebration.levelUp ? <LevelBadge level={celebration.levelUp.index} className="h-32 w-32" /> : <QuestArt className="h-full w-full" />}
        >
          <p>You finished “{celebration.title}”. Nice work!</p>
          {celebration.levelUp && <p className="mt-2 font-bold text-sun-300">Level up! You are now a {celebration.levelUp.name}.</p>}
        </CelebrationModal>
      )}
    </>
  );
}
