import { describe, expect, it } from "vitest";
import { makeContext } from "./helpers";
import { seedDemo } from "../src/server/seed/demo";
import { actionItems, listNotifications } from "../src/server/services/inbox";
import { dashboard, contributions } from "../src/server/services/analytics";
import { getBugDetail, resolveBug } from "../src/server/services/bugs";

describe("demo seed", async () => {
  const { ctx } = makeContext();
  (ctx as { clock: { now: () => Date } }).clock = { now: () => new Date() };
  const summary = await seedDemo(ctx, { passwords: false });
  const user = (name: string) => ctx.store.findOne("users", { name })!;

  it("replays every scripted step without errors", () => {
    expect(summary.errors).toEqual([]);
    expect(summary.bugs).toBeGreaterThan(125);
  });

  it("places the brief's example bugs at their exact numbers", () => {
    const expectations: [number, string, string][] = [
      [87, "in_progress", "Member role changes are not saved"],
      [102, "in_progress", "Supplier request form accepts an empty product name"],
      [104, "regression_required", "Revision date not updated after uploading a new SDS version"],
      [108, "need_info", "Photos disappear from an incident report saved as a draft"],
      [112, "not_a_bug", "Archived sites are missing from the location picker"],
      [119, "duplicate", "Can send a supplier SDS request without a product name"],
      [124, "closed", "Hazard pictograms missing from the chemical register PDF"],
      [125, "new", "Invitation email shows the raw placeholder {{company_name}}"],
    ];
    for (const [n, status, title] of expectations) {
      const bug = resolveBug(ctx, String(n));
      expect(bug.key).toBe(`BUG-${String(n).padStart(6, "0")}`);
      expect(bug.status).toBe(status);
      expect(bug.title).toBe(title);
    }
  });

  it("gives BUG-000124 the brief's timeline", () => {
    const detail = getBugDetail(ctx, user("Wahid Hasan"), resolveBug(ctx, "124"));
    const trail = detail.events.map((e) => e.type === "bug.status_changed" ? `status:${(e.data as { to: string }).to}` : e.type);
    expect(trail).toEqual(
      expect.arrayContaining(["bug.created", "bug.assigned", "status:need_info", "status:new", "status:in_progress", "status:fixed", "status:regression_required", "status:verified", "status:closed"]),
    );
    expect(detail.bug.verified_by_id).toBe(user("Wahid Hasan").id);
    expect(detail.bug.fixed_by_id).toBe(user("Maria Olsen").id);
  });

  it("gives Wahid the brief's notifications and a realistic queue", () => {
    const wahid = user("Wahid Hasan");
    const titles = listNotifications(ctx, wahid).items.map((n) => n.title);
    expect(titles).toContain("BUG-000104 has been marked Fixed. Regression testing required.");
    expect(titles).toContain("Imran Hossain requested more information for BUG-000108.");
    expect(titles).toContain("BUG-000112 was marked Not a Bug.");
    expect(titles).toContain("BUG-000119 was marked Duplicate of BUG-000102.");
    const kinds = actionItems(ctx, wahid).items.map((i) => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(["answer_question", "run_regression", "review_decision"]));
  });

  it("covers the edge cases for leads and managers", () => {
    const nusrat = actionItems(ctx, user("Nusrat Jahan")).items.map((i) => `${i.kind}:${i.bug.title}`);
    expect(nusrat).toContain("dispute:Exposure report rounds concentrations to whole numbers");
    expect(nusrat).toContain("run_regression:Risk assessment PDF shows the previous revision number");
    expect(nusrat).toContain("reassign:Rearranged dashboard widgets go back to the default order");
    const hanne = actionItems(ctx, user("Hanne Lie")).items.map((i) => i.kind);
    expect(hanne).toContain("revisit");
  });

  it("flags simultaneous reports as potential duplicates", () => {
    const later = ctx.store.findOne("bugs", { title: "SDS search ignores Norwegian letters in product names" })!;
    const earlier = ctx.store.findOne("bugs", { title: "SDS search returns no results for product names with æ, ø or å" })!;
    expect(later.potential_duplicate_ids).toEqual([earlier.id]);
  });

  it("produces meaningful analytics", () => {
    const lead = user("Nusrat Jahan");
    const dash = dashboard(ctx, lead, { projectId: null, days: 90 });
    expect(dash.open_total).toBeGreaterThan(30);
    expect(dash.weekly.some((w) => w.reported > 0 && w.resolved > 0)).toBe(true);
    expect(dash.metrics.reopen_rate).toBeGreaterThan(0);
    const contrib = contributions(ctx, lead, { projectId: null, weeks: 12 });
    const wahid = contrib.people.find((p) => p.user_id === user("Wahid Hasan").id)!;
    expect(wahid.reported).toBeGreaterThan(10);
  });
});
