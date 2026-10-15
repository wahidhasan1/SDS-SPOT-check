import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { get, getDb } from "@/server/db";
import { getBattleDimensionAverages, getBattleModeStats, getUserStats, listBattles, todayFor } from "@/server/queries";
import { sttConfigured } from "@/server/stt";
import { BATTLE_PROMPTS, dailyChallengeFor, getBattlePrompt, modeOfPromptId } from "@/content/battle-prompts";
import { getBattleMode } from "@/content/battle-modes";
import { BattleExperience } from "@/features/battles/battle-experience";
import { BattleGallery } from "@/features/battles/battle-gallery";

export const metadata: Metadata = { title: "Speaking Battles" };

export default async function BattlesPage({ searchParams }: { searchParams: Promise<{ mode?: string; prompt?: string; topic?: string; go?: string }> }) {
  const { profile } = await requireUser();
  const params = await searchParams;
  const today = todayFor(profile);
  const daily = dailyChallengeFor(today);
  const dailyDone = Boolean(get(getDb(), "SELECT 1 FROM xp_events WHERE user_id = ? AND source_key = ?", profile.id, `daily-challenge:${today}`));
  const stats = getUserStats(profile);
  const modeStats = getBattleModeStats(profile.id);

  const prompt = getBattlePrompt(params.prompt) ?? (params.topic ? BATTLE_PROMPTS.find((p) => p.topicId === params.topic) : undefined);
  const mode = getBattleMode(params.mode) ?? (prompt ? getBattleMode(prompt.mode) : undefined);

  if (!mode) {
    const recent = listBattles(profile.id, 6);
    return (
      <BattleGallery
        daily={daily}
        dailyDone={dailyDone}
        stats={stats.battles}
        modeStats={modeStats}
        timeZone={profile.timezone}
        recent={recent.map((b) => ({
          id: b.id,
          sessionId: b.sessionId,
          promptText: b.promptText,
          modeId: modeOfPromptId(b.promptId)?.id ?? null,
          opponentName: b.opponentName,
          result: b.result,
          userScore: b.userScore,
          opponentScore: b.opponentScore,
          createdAt: b.createdAt,
          sample: b.origin === "seed",
        }))}
      />
    );
  }

  const dims = getBattleDimensionAverages(profile.id);
  return (
    <BattleExperience
      key={`${mode.id}:${prompt?.id ?? ""}:${params.go ?? ""}`}
      mode={mode}
      prompts={BATTLE_PROMPTS}
      dailyChallengeId={daily.id}
      initialPromptId={prompt?.id ?? null}
      autoStart={params.go === "1" && Boolean(prompt || mode.id !== "free-play")}
      sttConfigured={sttConfigured()}
      modeStat={modeStats[mode.id] ?? null}
      overallBest={stats.battles.best}
      bestDimensions={dims.dimensions.map((d) => ({ key: d.key, label: d.label, max: d.max, best: d.best }))}
      player={{ displayName: profile.displayName, avatar: profile.avatar }}
    />
  );
}
