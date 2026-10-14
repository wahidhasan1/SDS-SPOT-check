import { describe, expect, it } from "vitest";
import { inRange, selectPartner } from "@/lib/matching";
import { DEMO_PARTNERS } from "@/content/partners";

const fixed = () => 0;

describe("partner matching", () => {
  it("respects the proficiency range", () => {
    const m = selectPartner(DEMO_PARTNERS, { proficiencyRange: ["advanced", "advanced"], blockedIds: [], random: fixed });
    expect(m?.partner.proficiency).toBe("advanced");
    expect(m?.widenedRange).toBe(false);
  });
  it("never selects a blocked partner", () => {
    const blocked = DEMO_PARTNERS.filter((p) => p.id !== "demo-omar").map((p) => p.id);
    for (let i = 0; i < 20; i++) {
      const m = selectPartner(DEMO_PARTNERS, { proficiencyRange: ["beginner", "advanced"], blockedIds: blocked });
      expect(m?.partner.id).toBe("demo-omar");
    }
  });
  it("returns null when everyone is blocked", () => {
    expect(selectPartner(DEMO_PARTNERS, { proficiencyRange: ["beginner", "advanced"], blockedIds: DEMO_PARTNERS.map((p) => p.id) })).toBeNull();
  });
  it("widens the range rather than failing", () => {
    const only = DEMO_PARTNERS.filter((p) => p.proficiency === "beginner");
    const m = selectPartner(only, { proficiencyRange: ["advanced", "advanced"], blockedIds: [] });
    expect(m?.widenedRange).toBe(true);
  });
  it("avoids the most recent partners when possible", () => {
    const m = selectPartner(DEMO_PARTNERS, { proficiencyRange: ["intermediate", "intermediate"], blockedIds: [], recentPartnerIds: ["demo-amara", "demo-priya"], random: fixed });
    expect(m?.partner.id).toBe("demo-omar");
  });
  it("handles reversed ranges", () => {
    expect(inRange("intermediate", ["advanced", "beginner"])).toBe(true);
  });
});
