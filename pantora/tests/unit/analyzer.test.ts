import { describe, expect, it } from "vitest";
import { analyzeText, decideResult, scoreAnalysis } from "@/lib/analysis/demo-analyzer";

describe("demo analyzer", () => {
  it("fixes since + duration with present perfect continuous", () => {
    const a = analyzeText("I am working here since two years.");
    expect(a.improved).toBe("I have been working here for two years.");
    expect(a.issues.map((i) => i.ruleId)).toEqual(expect.arrayContaining(["since-duration", "continuous-with-duration"]));
    expect(a.analyzer).toBe("demo-rules");
  });

  it("uses the past tense after a finished time marker", () => {
    const a = analyzeText("Yesterday I go to market.");
    expect(a.improved).toBe("Yesterday, I went to the market.");
  });

  it("carries past context to following sentences", () => {
    const a = analyzeText("Yesterday I go to the park. Then I meet my friend and we eat lunch.");
    expect(a.improved).toContain("I met my friend and we ate lunch");
  });

  it("fixes third-person agreement and common collocations", () => {
    const a = analyzeText("I am agree. It help you to discuss about ideas. My colleague speak three languages.");
    expect(a.improved).toBe("I agree. It helps you to discuss ideas. My colleague speaks three languages.");
  });

  it("does not change correct sentences", () => {
    const text = "Did he go home? I have been living here for five years, and I am waiting for the bus.";
    const a = analyzeText(text);
    expect(a.issues.filter((i) => !i.minor)).toHaveLength(0);
    expect(a.improved).toBe(text);
  });

  it("does not treat present perfect as past context", () => {
    const a = analyzeText("I wanted to talk with you. We have found some problems and the team need more time.");
    expect(a.improved).toContain("We have found some problems and the team needs more time.");
  });

  it("only reports fluency when speech timing is provided", () => {
    expect(analyzeText("I like music.").fluencyNotes).toBeNull();
    const spoken = analyzeText("I like music because it helps me relax.", { speech: { durationSeconds: 5, wordsPerMinute: 96, source: "recording" } });
    expect(spoken.fluencyNotes?.[0]).toContain("96 words per minute");
  });

  it("labels typed answers as not measuring pronunciation", () => {
    const a = analyzeText("I like music.", { inputMode: "typed" });
    expect(a.limitations.join(" ")).toMatch(/pronunciation, accent, and speaking speed were not measured/);
  });
});

describe("scoring", () => {
  const ctx = { prompt: "Describe your ideal weekend", targetSeconds: 30 };
  it("scores within each dimension's maximum and sums to the total", () => {
    const s = scoreAnalysis(analyzeText("My ideal weekend is relaxing because I sleep late and meet friends. For example, we cook together."), ctx);
    for (const d of s.dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(d.max);
    }
    expect(s.total).toBe(s.dimensions.reduce((a, d) => a + d.score, 0));
    expect(s.dimensions.map((d) => d.max).reduce((a, b) => a + b)).toBe(100);
    expect(s.pronunciation.measured).toBe(false);
  });

  it("is deterministic", () => {
    const text = "I go to the park every weekend with my family.";
    expect(scoreAnalysis(analyzeText(text), ctx)).toEqual(scoreAnalysis(analyzeText(text), ctx));
  });

  it("scores a developed, correct answer higher than a short one with errors", () => {
    const good = scoreAnalysis(
      analyzeText(
        "My ideal weekend starts with a slow breakfast with my family. After that, I usually go hiking because fresh air helps me relax. For example, last month we climbed a small mountain near the city. In the evening, I like cooking dinner for my friends. Overall, a quiet, active weekend gives me energy for the week.",
      ),
      ctx,
    );
    const weak = scoreAnalysis(analyzeText("Weekend good. I go park. He like it."), ctx);
    expect(good.total).toBeGreaterThan(weak.total + 20);
  });

  it("treats close scores as a draw", () => {
    expect(decideResult(80, 79)).toBe("draw");
    expect(decideResult(80, 70)).toBe("win");
    expect(decideResult(60, 70)).toBe("loss");
  });
});
