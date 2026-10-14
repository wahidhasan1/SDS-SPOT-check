import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, addDays, computeStreaks, conversationXp, eligibleAchievements, levelForXp, streakBonusXp } from "@/lib/game-rules";

describe("streaks", () => {
  const today = "2026-10-14";
  it("counts consecutive days ending today", () => {
    expect(computeStreaks(["2026-10-12", "2026-10-13", "2026-10-14"], today)).toMatchObject({ current: 3, practicedToday: true });
  });
  it("keeps a streak alive when today is not done yet", () => {
    expect(computeStreaks(["2026-10-12", "2026-10-13"], today)).toMatchObject({ current: 2, practicedToday: false });
  });
  it("breaks the streak after a missed day", () => {
    expect(computeStreaks(["2026-10-10", "2026-10-11"], today).current).toBe(0);
  });
  it("tracks the longest streak", () => {
    expect(computeStreaks(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-10-14"], today)).toMatchObject({ current: 1, longest: 4 });
  });
  it("handles month boundaries", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(computeStreaks(["2026-02-28", "2026-03-01"], "2026-03-01").current).toBe(2);
  });
});

describe("xp and levels", () => {
  it("awards conversation XP by full minutes with a cap", () => {
    expect(conversationXp(59)).toBe(30);
    expect(conversationXp(5 * 60 + 30)).toBe(40);
    expect(conversationXp(10 * 3600)).toBe(90);
  });
  it("caps streak bonuses", () => {
    expect(streakBonusXp(3)).toBe(15);
    expect(streakBonusXp(40)).toBe(50);
  });
  it("computes levels and progress", () => {
    expect(levelForXp(0).current.name).toBe("First Words");
    const l = levelForXp(500);
    expect(l.current.name).toBe("Brave Speaker");
    expect(l.next?.name).toBe("Consistent Talker");
    expect(l.xpToNext).toBe(250);
    expect(levelForXp(99999).next).toBeNull();
  });
});

describe("achievements", () => {
  const zero = { conversations: 0, battles: 0, longestStreak: 0, practiceMinutes: 0, reviews: 0, topicCategories: 0, savedSentences: 0, coachSessions: 0, goalDays: 0 };
  it("unlocks nothing for a new user", () => {
    expect(eligibleAchievements(zero)).toEqual([]);
  });
  it("unlocks by threshold", () => {
    const ids = eligibleAchievements({ ...zero, conversations: 5, longestStreak: 7, practiceMinutes: 60 });
    expect(ids).toEqual(expect.arrayContaining(["first-conversation", "five-conversations", "seven-day-streak", "one-hour"]));
    expect(ids).not.toContain("twenty-conversations");
  });
  it("has unique ids", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
