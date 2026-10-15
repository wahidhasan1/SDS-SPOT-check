import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "@/server/db";
import { syncContent } from "@/server/db/seed";
import { createUser } from "@/server/services/users";
import { battleXpItems, recordSession, totalXp } from "@/server/services/gamification";
import { QuestError, claimQuest, getWeeklyQuests } from "@/server/services/quests";
import { getWeeklyLeague } from "@/server/services/league";
import { BATTLE_MODES, getBattleMode } from "@/content/battle-modes";
import { BATTLE_PROMPTS, dailyChallengeFor, promptsForMode } from "@/content/battle-prompts";
import { getDemoPartner } from "@/content/partners";
import { weekStartOf } from "@/lib/quests";
import { isAvatarUnlocked, AVATARS } from "@/lib/avatars";
import { XP_RULES } from "@/lib/game-rules";

let db: DatabaseSync;
const NOW = new Date("2026-10-14T10:00:00Z"); // a Wednesday

function newUser() {
  return createUser(db, { displayName: "Tester", avatar: "aurora", proficiency: "intermediate", goals: ["fluency"], conversationPref: "both", dailyGoalMinutes: 5, timezone: "UTC" });
}

function battle(userId: string, key: string, promptId: string, at = NOW, opts: { dailyChallengeDate?: string | null } = {}) {
  return recordSession(db, {
    userId,
    type: "battle",
    durationSeconds: 90,
    practiceSeconds: 0,
    startedAt: new Date(at.getTime() - 90_000),
    endedAt: at,
    status: "completed",
    origin: "demo",
    idempotencyKey: key,
    promptText: "x",
    xp: battleXpItems(db, userId, null, promptId, opts),
  });
}

beforeEach(() => {
  db = openDatabase(":memory:");
  syncContent(db);
});

describe("battle types", () => {
  it("every prompt belongs to a real type, and every type has at least 3 prompts", () => {
    for (const p of BATTLE_PROMPTS) {
      expect(getBattleMode(p.mode), p.id).toBeDefined();
      expect(getDemoPartner(p.sampleResponse.partnerId), p.id).toBeDefined();
    }
    for (const m of BATTLE_MODES.filter((m) => m.id !== "free-play")) expect(promptsForMode(m.id).length).toBeGreaterThanOrEqual(3);
    expect(promptsForMode("free-play")).toHaveLength(BATTLE_PROMPTS.length);
    expect(new Set(BATTLE_PROMPTS.map((p) => p.id)).size).toBe(BATTLE_PROMPTS.length);
  });

  it("awards the XP of the prompt's battle type", () => {
    const u = newUser();
    const quick = BATTLE_PROMPTS.find((p) => p.mode === "quick-fire")!;
    const big = BATTLE_PROMPTS.find((p) => p.mode === "big-question")!;
    expect(battleXpItems(db, u.id, null, quick.id)[0].amount).toBe(getBattleMode("quick-fire")!.xp);
    expect(battleXpItems(db, u.id, null, big.id)[0].amount).toBe(getBattleMode("big-question")!.xp);
    expect(battleXpItems(db, u.id, null, "unknown")[0].amount).toBe(XP_RULES.battle);
  });

  it("gives the Daily Challenge bonus only once per day", () => {
    const u = newUser();
    const daily = dailyChallengeFor("2026-10-14");
    const first = battle(u.id, "b1", daily.id, NOW, { dailyChallengeDate: "2026-10-14" });
    const second = battle(u.id, "b2", daily.id, new Date(NOW.getTime() + 60_000), { dailyChallengeDate: "2026-10-14" });
    const bonus = (r: typeof first) => r.rewards.xpItems.filter((i) => i.key === "daily-challenge:2026-10-14").length;
    expect(bonus(first)).toBe(1);
    expect(bonus(second)).toBe(0);
  });
});

describe("weekly quests", () => {
  it("weeks start on Monday", () => {
    expect(weekStartOf("2026-10-14")).toBe("2026-10-12");
    expect(weekStartOf("2026-10-12")).toBe("2026-10-12");
    expect(weekStartOf("2026-10-18")).toBe("2026-10-12");
  });

  it("tracks progress and pays out once when complete", () => {
    const u = newUser();
    const quick = BATTLE_PROMPTS.filter((p) => p.mode === "quick-fire");
    expect(() => claimQuest(db, u.id, "battle-royale", NOW)).toThrow(QuestError);
    battle(u.id, "q1", quick[0].id);
    battle(u.id, "q2", quick[1].id);
    battle(u.id, "q3", BATTLE_PROMPTS.find((p) => p.mode === "story-sprint")!.id);
    const quests = getWeeklyQuests(db, u.id, "2026-10-14").quests;
    expect(quests.find((q) => q.id === "battle-royale")).toMatchObject({ value: 3, complete: true, claimed: false });
    expect(quests.find((q) => q.id === "mix-it-up")).toMatchObject({ complete: false });
    const before = totalXp(db, u.id);
    const res = claimQuest(db, u.id, "battle-royale", NOW);
    expect(totalXp(db, u.id)).toBe(before + res.xp);
    expect(() => claimQuest(db, u.id, "battle-royale", NOW)).toThrow(/already claimed/);
    expect(() => claimQuest(db, u.id, "nope", NOW)).toThrow(QuestError);
  });

  it("starts fresh the next week", () => {
    const u = newUser();
    battle(u.id, "w1", BATTLE_PROMPTS[0].id);
    expect(getWeeklyQuests(db, u.id, "2026-10-19").quests.find((q) => q.id === "battle-royale")!.value).toBe(0);
  });
});

describe("league and rewards", () => {
  it("league is deterministic and includes the player's real weekly XP", () => {
    const u = newUser();
    battle(u.id, "l1", BATTLE_PROMPTS[0].id);
    const a = getWeeklyLeague(db, u, "2026-10-14");
    const b = getWeeklyLeague(db, u, "2026-10-14");
    expect(a.entries).toEqual(b.entries);
    expect(a.you.xp).toBe(totalXp(db, u.id));
    expect(a.entries.filter((e) => e.isYou)).toHaveLength(1);
    expect(a.entries.map((e) => e.rank)).toEqual(a.entries.map((_, i) => i + 1));
  });

  it("reward avatars unlock by level", () => {
    expect(isAvatarUnlocked("aurora", 1)).toBe(true);
    expect(isAvatarUnlocked("nova", 1)).toBe(false);
    expect(isAvatarUnlocked("nova", AVATARS.nova.unlockLevel!)).toBe(true);
    expect(isAvatarUnlocked("missing", 5)).toBe(false);
  });
});
