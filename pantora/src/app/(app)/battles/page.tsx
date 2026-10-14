import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { getBattleDimensionAverages, getUserStats, listBattles, todayFor } from "@/server/queries";
import { sttConfigured } from "@/server/stt";
import { BATTLE_PROMPTS, dailyChallengeFor } from "@/content/battle-prompts";
import { BattleExperience } from "@/features/battles/battle-experience";

export const metadata: Metadata = { title: "Speaking Battles" };

export default async function BattlesPage({ searchParams }: { searchParams: Promise<{ prompt?: string; topic?: string }> }) {
  const { profile } = await requireUser();
  const params = await searchParams;
  const stats = getUserStats(profile);
  const recent = listBattles(profile.id, 5);
  const dims = getBattleDimensionAverages(profile.id);
  const initialPromptId =
    BATTLE_PROMPTS.find((p) => p.id === params.prompt)?.id ?? BATTLE_PROMPTS.find((p) => p.topicId && p.topicId === params.topic)?.id ?? null;
  return (
    <BattleExperience
      prompts={BATTLE_PROMPTS}
      dailyChallengeId={dailyChallengeFor(todayFor(profile)).id}
      initialPromptId={initialPromptId}
      sttConfigured={sttConfigured()}
      stats={stats.battles}
      bestDimensions={dims.dimensions.map((d) => ({ key: d.key, label: d.label, max: d.max, best: d.best }))}
      recent={recent.map((b) => ({
        id: b.id,
        sessionId: b.sessionId,
        promptText: b.promptText,
        opponentName: b.opponentName,
        result: b.result,
        userScore: b.userScore,
        opponentScore: b.opponentScore,
        createdAt: b.createdAt,
        sample: b.origin === "seed",
      }))}
      timeZone={profile.timezone}
    />
  );
}
