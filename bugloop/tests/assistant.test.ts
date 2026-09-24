import { describe, expect, it } from "vitest";
import { heuristicDraft } from "../src/server/ai/heuristic";
import type { DraftRequest } from "../src/server/ai/provider";

const context = {
  project: { name: "SDS Manager" },
  module: { name: "Members" },
  feature: null,
  environment: null,
  modules: [
    { name: "Members", features: [{ name: "Edit member" }, { name: "Invite member" }] },
    { name: "Sites", features: [] },
  ],
  environments: [{ name: "Production" }, { name: "Staging" }, { name: "QA" }, { name: "Development" }],
  severities: ["critical", "major", "minor", "trivial"],
} as unknown as DraftRequest["context"];

function draft(text: string, extra: Partial<DraftRequest> = {}) {
  return heuristicDraft({ text, images: [], fields: {}, answers: [], context, ...extra } as DraftRequest);
}

describe("offline assistant", () => {
  it("structures the brief's example without inventing anything", () => {
    const d = draft(
      "I found a problem in the member settings page. When I change the role and save it, it looks saved, but when I open the member again the old role is there.",
    );
    expect(d.title?.value).toBe("Members: Old role is there after opening the member again");
    expect(d.steps.map((s) => s.value)).toEqual(["Go to Members", "Change the role", "Save it", "Open the member again"]);
    expect(d.steps[0].source).toBe("ai_inferred");
    expect(d.actual_result?.value).toBe("The old role is there.");
    // Nothing about the expected result, environment or browser was said, so it asks.
    expect(d.expected_result).toBeNull();
    expect(d.browser).toBeNull();
    expect(d.missing_information.map((m) => m.field)).toEqual(expect.arrayContaining(["expected_result", "environment", "browser"]));
  });

  it("keeps the object of a trailing action and separates what the analyst saw", () => {
    const d = draft(
      "In Members > Edit member, when I change the phone number and click Save it shows Saved, but after reloading the page the old phone number is back. Happens every time on Staging in Chrome.",
    );
    expect(d.title?.value).toBe("Members: Old phone number is back after reloading the page");
    expect(d.steps.map((s) => s.value)).toEqual(["Go to Members › Edit member", "Change the phone number", "Click Save", "Reload the page"]);
    expect(d.actual_result?.value).toBe("It shows Saved. The old phone number is back.");
    expect(d.frequency?.value).toBe("always");
    expect(d.browser?.value).toMatch(/chrome/i);
  });

  it("reads a single 'after …' sentence as an action and its consequence", () => {
    const d = draft("After saving the old role is there.");
    expect(d.steps.map((s) => s.value)).toEqual(["Go to Members", "Save"]);
    expect(d.actual_result?.value).toBe("The old role is there.");
  });

  it("does not mistake a symptom with 'should' in a relative clause for an expectation", () => {
    const d = draft("Export to PDF shows empty boxes where the pictograms should be");
    expect(d.expected_result).toBeNull();
    expect(d.actual_result?.value).toBe("Export to PDF shows empty boxes where the pictograms should be.");
    expect(d.steps).toHaveLength(0);
    expect(d.missing_information.map((m) => m.field)).toContain("steps");
  });

  it("treats a plain 'should' sentence as the expected result", () => {
    const d = draft("When I change the role and save it, the old role comes back. It should keep the new role.");
    expect(d.expected_result?.value).toBe("It should keep the new role.");
  });
});
