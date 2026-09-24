import { describe, expect, it } from "vitest";
import { SimilarityIndex } from "../src/core/similarity";
import { stem } from "../src/core/text";

const corpus = [
  {
    id: "b87",
    title: "Member role changes are not saved",
    description: "Editing a member's role shows a success message, but the old role is shown again after reopening the member.",
    actual_result: "The previous role is displayed after reopening the member record.",
    expected_result: "The updated role is kept.",
    steps: ["Open Members", "Edit a member", "Change the role", "Save", "Reopen the member"],
    module_id: "members",
    feature_id: "edit-member",
  },
  {
    id: "b90",
    title: "PDF export cuts off the last column of the SDS register",
    description: "When exporting the register to PDF with more than 8 columns, the last column is truncated.",
    actual_result: "The Revision date column is cut off on every page.",
    steps: ["Open SDS Hub", "Select all columns", "Export to PDF"],
    module_id: "reports",
  },
  {
    id: "b91",
    title: "Search in SDS Hub ignores Norwegian characters",
    description: "Searching for 'Rødt lim' returns no results although the product exists.",
    actual_result: "No results are shown.",
    module_id: "sds-hub",
  },
  {
    id: "b92",
    title: "Dashboard widgets overlap on 1366px screens",
    description: "The chemical inventory widget overlaps the risk widget on laptop screens.",
    actual_result: "Widgets overlap and text is clipped.",
    module_id: "dashboard",
  },
  {
    id: "b93",
    title: "Site location dropdown does not list archived sites",
    description: "Archived sites are missing from the location dropdown.",
    actual_result: "Only active sites are listed.",
    module_id: "sites",
  },
];

describe("similarity", () => {
  const index = new SimilarityIndex(corpus);

  it("stems common inflections to the same root", () => {
    expect(stem("saving")).toBe(stem("saved"));
    expect(stem("saves")).toBe(stem("save"));
    expect(stem("roles")).toBe(stem("role"));
  });

  it("matches the brief's example of differently worded reports", () => {
    const [match] = index.query({
      title: "Changes to site placement role disappear after reopening member",
      module_id: "members",
    });
    expect(match?.id).toBe("b87");
    expect(["high", "medium"]).toContain(match?.level);
  });

  it("rates an informal description of the same problem as high", () => {
    const [match] = index.query({
      title: "Member role is not kept after saving",
      description:
        "When I change the role and save it, it looks okay but after opening again the old role is there.",
      module_id: "members",
      feature_id: "edit-member",
    });
    expect(match?.id).toBe("b87");
    expect(match?.level).toBe("high");
    expect(match?.sameModule).toBe(true);
    expect(match?.sharedTerms.length).toBeGreaterThan(0);
  });

  it("does not match unrelated reports", () => {
    const matches = index.query({
      title: "Password reset email never arrives",
      description: "Requesting a password reset shows a confirmation but no email is received.",
      module_id: "settings",
    });
    expect(matches.filter((m) => m.level !== "low")).toHaveLength(0);
  });

  it("finds search problems described differently", () => {
    const [match] = index.query({
      title: "Searching products with ø or å returns nothing",
      module_id: "sds-hub",
    });
    expect(match?.id).toBe("b91");
  });

  it("excludes the query bug itself", () => {
    const matches = index.query({ ...corpus[0] });
    expect(matches.find((m) => m.id === "b87")).toBeUndefined();
  });
});
