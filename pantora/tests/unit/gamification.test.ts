import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "@/server/db";
import { seedDemoData, syncContent, DEMO_USER_ID } from "@/server/db/seed";
import { createUser } from "@/server/services/users";
import { achievementStats, recordSession, totalXp } from "@/server/services/gamification";
import { get } from "@/server/db/sql";

let db: DatabaseSync;

function newUser() {
  return createUser(db, {
    displayName: "Tester",
    avatar: "aurora",
    proficiency: "intermediate",
    goals: ["fluency"],
    conversationPref: "both",
    dailyGoalMinutes: 5,
    timezone: "UTC",
  });
}

const base = (userId: string, key: string, seconds: number, at = new Date("2026-10-14T10:00:00Z")) => ({
  userId,
  type: "free_talk" as const,
  topicId: "ideal-weekend",
  durationSeconds: seconds,
  practiceSeconds: seconds,
  startedAt: new Date(at.getTime() - seconds * 1000),
  endedAt: at,
  status: (seconds >= 60 ? "completed" : "incomplete") as "completed" | "incomplete",
  origin: "demo" as const,
  idempotencyKey: key,
  xp: seconds >= 60 ? [{ key: "conversation", amount: 40, reason: "test" }] : [],
});

beforeEach(() => {
  db = openDatabase(":memory:");
  syncContent(db);
});

describe("recordSession", () => {
  it("awards XP, goal and streak once, and is idempotent", () => {
    const u = newUser();
    const first = recordSession(db, base(u.id, "abc12345", 360));
    expect(first.created).toBe(true);
    expect(first.rewards.goal.reachedNow).toBe(true);
    expect(first.rewards.streak).toMatchObject({ current: 1, extendedToday: true });
    expect(first.rewards.newAchievements.map((a) => a.id)).toContain("first-conversation");
    const xp = totalXp(db, u.id);
    expect(xp).toBe(40 + 25 + 5);

    const again = recordSession(db, base(u.id, "abc12345", 360));
    expect(again.created).toBe(false);
    expect(again.sessionId).toBe(first.sessionId);
    expect(totalXp(db, u.id)).toBe(xp);
  });

  it("does not count incomplete sessions", () => {
    const u = newUser();
    const r = recordSession(db, base(u.id, "short-session", 30));
    expect(r.rewards.xpTotal).toBe(0);
    expect(get<{ n: number }>(db, "SELECT COUNT(*) AS n FROM user_activity WHERE user_id = ? AND practice_seconds > 0", u.id)?.n).toBe(0);
    expect(achievementStats(db, u.id, "2026-10-14").conversations).toBe(0);
  });

  it("requires 2 minutes in a day for the streak", () => {
    const u = newUser();
    const r = recordSession(db, base(u.id, "one-minute-talk", 90));
    expect(r.rewards.streak.extendedToday).toBe(false);
    const r2 = recordSession(db, base(u.id, "second-talk-1", 60, new Date("2026-10-14T12:00:00Z")));
    expect(r2.rewards.streak.extendedToday).toBe(true);
  });
});

describe("demo seed", () => {
  it("creates consistent sample history", () => {
    const now = new Date();
    seedDemoData(db, now);
    const stats = achievementStats(db, DEMO_USER_ID, now.toISOString().slice(0, 10));
    expect(stats.conversations).toBe(12);
    expect(stats.battles).toBe(4);
    expect(stats.longestStreak).toBe(6);
    expect(get<{ n: number }>(db, "SELECT COUNT(*) AS n FROM sessions WHERE origin != 'seed' AND user_id = ?", DEMO_USER_ID)?.n).toBe(0);
  });
});
