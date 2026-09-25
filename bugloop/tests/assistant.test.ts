import { describe, expect, it } from "vitest";
import { heuristicDraft } from "../src/server/ai/heuristic";
import type { DraftPage, DraftRequest } from "../src/server/ai/provider";
import { PRODUCT_MAPS } from "../src/server/seed/productmap";

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
  severities: ["critical", "major", "minor", "trivial"].map((key) => ({ key, label: key, description: null })),
  priorities: ["urgent", "high", "medium", "low"].map((key) => ({ key, label: key, description: null })),
  page: null,
  pages: [],
} as unknown as DraftRequest["context"];

const members = PRODUCT_MAPS.sds.modules.find((m) => m.name === "Members")!;
const editMember = members.features!.find((f) => f.name === "Edit member")!.pages![0];
const memberList = members.pages![0];
const toPage = (p: typeof editMember, feature: string | null): DraftPage => ({
  id: p.name,
  name: p.name,
  module: "Members",
  feature,
  path: p.path ?? null,
  description: p.description ?? null,
  elements: p.elements as string[],
  rules: p.rules as string[],
  keywords: (p.keywords as string[]) ?? [],
  importance: (p.importance ?? "normal") as DraftPage["importance"],
});
const withMap = { ...context, pages: [toPage(memberList, null), toPage(editMember, "Edit member")] } as DraftRequest["context"];

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

  it("places a short description on the right screen using the product map", () => {
    const d = draft("changed the role and saved, reopened the member and the old role is back", { context: withMap });
    expect(d.page?.value).toBe("Edit member");
    expect(d.page?.source).toBe("ai_inferred");
    expect(d.module).toBeNull(); // already chosen by the analyst
    expect(d.feature?.value).toBe("Edit member");
    expect(d.location?.element).toBe("Role dropdown");
    expect(d.location?.box).toBeNull(); // it can't see screenshots, so it never draws a box
    expect(d.steps[0].value).toBe("Open Members › Edit member (/members/:id/edit)");
    // The page's rule becomes the expected result, marked for confirmation.
    expect(d.expected_result?.source).toBe("ai_inferred");
    expect(d.expected_result?.value).toBe("Saving keeps every changed field, and reopening the member shows the new values.");
    expect(d.missing_information.map((m) => m.field)).not.toContain("expected_result");
    expect(d.title?.value).toMatch(/^Edit member: /);
  });

  it("suggests a priority from severity, frequency and the screen's importance", () => {
    const d = draft("changed the role and saved, reopened the member and the old role is back. Happens every time.", { context: withMap });
    expect(d.severity_suggestion?.key).toBe("major");
    expect(d.priority_suggestion?.key).toBe("high");
    expect(d.priority_suggestion?.rationale).toMatch(/Edit member/);
  });

  it("keeps the analyst's own page choice", () => {
    const d = draft("the table is slow", { context: { ...withMap, page: toPage(memberList, null) } as DraftRequest["context"] });
    expect(d.page).toEqual({ value: "Member list", source: "reporter" });
  });

  it("treats a plain 'should' sentence as the expected result", () => {
    const d = draft("When I change the role and save it, the old role comes back. It should keep the new role.");
    expect(d.expected_result?.value).toBe("It should keep the new role.");
  });
});
