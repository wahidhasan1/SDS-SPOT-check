import { describe, expect, it } from "vitest";
import { basicWorkspace, client, png } from "./helpers";
import type { BugDetail, DraftResult, ActionItemsResponse, NotificationsResponse } from "../src/core/api";

const HOUR = 3_600_000;

function newBugBody(w: ReturnType<typeof basicWorkspace>, extra: Record<string, unknown> = {}) {
  return {
    project_id: w.project.id,
    module_id: w.members.id,
    feature_id: w.editMember.id,
    title: "Member role changes are not kept after saving",
    description: "Updated member role appears to save, but reopening the member shows the previous role.",
    steps: ["Navigate to Members", "Open an existing member", "Edit the member's role", "Click Save", "Reopen the same member"],
    expected_result: "The updated role is kept.",
    actual_result: "The previous role is displayed after reopening the member.",
    environment_id: w.envs[1].id,
    severity: "major",
    priority: "high",
    ...extra,
  };
}

describe("end-to-end workflow (brief section 25)", () => {
  it("runs report → review → info → fix → failed regression → fix → verify → close with full history", async () => {
    const w = basicWorkspace();
    const { call } = client(w.ctx);
    const { wahid, sara, rafiq, nusrat } = w.users;

    // An earlier report already exists.
    const earlier = await call<BugDetail>(sara.id, "POST", "/bugs", {
      json: newBugBody(w, { title: "Member role changes are not saved", description: "Role reverts after reopening a member." }),
    });
    expect(earlier.status).toBe(201);
    w.clock.advance(24 * HOUR);

    // Wahid drafts with the assistant.
    const draft = await call<DraftResult>(wahid.id, "POST", "/ai/draft", {
      json: {
        text: "When I change the role and save it, it looks okay but after opening again the old role is there.",
        project_id: w.project.id,
        module_id: w.members.id,
        feature_id: w.editMember.id,
      },
    });
    expect(draft.status).toBe(200);
    expect(draft.body.provider).toBe("offline");
    expect(draft.body.steps.map((s) => s.value)).toContain("Change the role");
    expect(draft.body.actual_result?.value).toMatch(/old role/i);
    expect(draft.body.missing_information.map((m) => m.field)).toEqual(expect.arrayContaining(["expected_result", "environment"]));

    // Duplicate check before submitting finds the earlier bug.
    const similar = await call<{ items: { bug: { key: string }; level: string }[] }>(wahid.id, "POST", "/similar", {
      json: {
        project_id: w.project.id,
        module_id: w.members.id,
        title: draft.body.title?.value,
        actual_result: draft.body.actual_result?.value,
      },
    });
    expect(similar.body.items[0]?.bug.key).toBe(earlier.body.bug.key);

    // Wahid decides it's different and submits with a screenshot.
    const form = new FormData();
    form.set(
      "payload",
      JSON.stringify(
        newBugBody(w, {
          title: "Site placement role disappears after reopening member",
          duplicate_check: {
            checked_at: w.clock.now().toISOString(),
            candidates: [{ bug_id: earlier.body.bug.id, key: earlier.body.bug.key, score: 0.6, level: "high" }],
            decision: "submitted_anyway",
            note: "This is the site placement role, not the member role.",
          },
          ai_meta: {
            provider: "offline",
            model: null,
            drafted_fields: ["steps", "actual_result"],
            provenance: { steps: "reporter" },
            edited_fields: [],
            screenshot_observations: [],
            drafted_at: w.clock.now().toISOString(),
          },
        }),
      ),
    );
    form.append("files", png());
    const created = await call<BugDetail>(wahid.id, "POST", "/bugs", { form });
    expect(created.status).toBe(201);
    const key = created.body.bug.key;
    expect(created.body.bug.status).toBe("new");
    expect(created.body.bug.assignee_id).toBe(rafiq.id); // default owner of Members
    expect(created.body.bug.ai_assisted).toBe(true);
    expect(created.body.attachments).toHaveLength(1);
    expect(created.body.potential_duplicates.map((b) => b.key)).toContain(earlier.body.bug.key);

    // The engineer is notified.
    const rafiqNotes = await call<NotificationsResponse>(rafiq.id, "GET", "/notifications");
    expect(rafiqNotes.body.items.some((n) => n.title === `New bug ${key} has been assigned to you.`)).toBe(true);

    // Engineer investigates and asks a question.
    w.clock.advance(HOUR);
    expect((await call(rafiq.id, "POST", `/bugs/${key}/actions/start_work`)).status).toBe(200);
    w.clock.advance(2 * HOUR);
    const asked = await call<BugDetail>(rafiq.id, "POST", `/bugs/${key}/actions/request_info`, {
      json: { question: "Does it happen for every role, and which member did you edit?" },
    });
    expect(asked.body.bug.status).toBe("need_info");
    expect(asked.body.waiting_on).toMatchObject({ party: "qa", user_id: wahid.id });

    const wahidItems = await call<ActionItemsResponse>(wahid.id, "GET", "/action-items");
    expect(wahidItems.body.items.find((i) => i.bug.key === key)?.kind).toBe("answer_question");

    // Wahid answers with extra evidence; the bug returns to In Progress.
    w.clock.advance(HOUR);
    const answer = new FormData();
    answer.set("payload", JSON.stringify({ answer: "Every role. I edited Anna Berg (member #2231). Screenshot attached." }));
    answer.append("files", png());
    const answered = await call<BugDetail>(wahid.id, "POST", `/bugs/${key}/actions/provide_info`, { form: answer });
    expect(answered.status).toBe(200);
    expect(answered.body.bug.status).toBe("in_progress");
    expect(answered.body.attachments).toHaveLength(2);

    // Engineer fixes, but the fix still needs a deploy.
    w.clock.advance(20 * HOUR);
    const fixed = await call<BugDetail>(rafiq.id, "POST", `/bugs/${key}/actions/mark_fixed`, {
      json: { resolution: "Persist the placement role before closing the dialog.", fix_version: "2.14.1", available_now: false },
    });
    expect(fixed.body.bug.status).toBe("fixed");
    expect(fixed.body.bug.fixed_by_id).toBe(rafiq.id);
    w.clock.advance(HOUR / 2);
    const ready = await call<BugDetail>(rafiq.id, "POST", `/bugs/${key}/actions/ready_for_regression`, { json: { build: "2.14.1" } });
    expect(ready.body.bug.status).toBe("regression_required");
    expect(ready.body.regression_runs[0]).toMatchObject({ round: 1, assignee_id: wahid.id, result: "pending" });

    const wahidNotes = await call<NotificationsResponse>(wahid.id, "GET", "/notifications");
    expect(wahidNotes.body.items[0].title).toBe(`${key} has been marked Fixed. Regression testing required.`);

    // Engineers can't verify their own work.
    const engPass = await call(rafiq.id, "POST", `/bugs/${key}/actions/pass_regression`, { json: {} });
    expect(engPass.status).toBe(403);

    // Regression fails the first time.
    w.clock.advance(HOUR);
    const failed = await call<BugDetail>(wahid.id, "POST", `/bugs/${key}/actions/fail_regression`, {
      json: { details: "Admin → Editor is kept, but Editor → Viewer still reverts." },
    });
    expect(failed.body.bug.status).toBe("regression_failed");
    expect(failed.body.bug.reopen_count).toBe(1);
    const rafiqItems = await call<ActionItemsResponse>(rafiq.id, "GET", "/action-items");
    expect(rafiqItems.body.items.find((i) => i.bug.key === key)?.kind).toBe("reopened");

    // Second fix goes straight to regression.
    w.clock.advance(3 * HOUR);
    await call(rafiq.id, "POST", `/bugs/${key}/actions/start_work`);
    const refixed = await call<BugDetail>(rafiq.id, "POST", `/bugs/${key}/actions/mark_fixed`, {
      json: { resolution: "Also handle downgrades to Viewer.", fix_version: "2.14.2" },
    });
    expect(refixed.body.bug.status).toBe("regression_required");
    expect(refixed.body.regression_runs.map((r) => r.round)).toEqual([1, 2]);

    // QA verifies; the bug closes automatically.
    w.clock.advance(2 * HOUR);
    await call(wahid.id, "POST", `/bugs/${key}/actions/start_regression`);
    const passed = await call<BugDetail>(wahid.id, "POST", `/bugs/${key}/actions/pass_regression`, {
      json: { notes: "Checked Admin, Editor and Viewer.", build: "2.14.2" },
    });
    expect(passed.body.bug.status).toBe("closed");
    expect(passed.body.bug).toMatchObject({ reporter_id: wahid.id, fixed_by_id: rafiq.id, verified_by_id: wahid.id });
    expect(passed.body.bug.closed_at).toBeTruthy();

    // The timeline tells the whole story in order.
    const statusTrail = passed.body.events.filter((e) => e.type === "bug.status_changed").map((e) => (e.data as { to: string }).to);
    expect(statusTrail).toEqual([
      "in_progress",
      "need_info",
      "in_progress",
      "fixed",
      "regression_required",
      "regression_failed",
      "in_progress",
      "fixed",
      "regression_required",
      "verified",
      "closed",
    ]);
    expect(passed.body.events[0].type).toBe("bug.created");

    // The engineer hears that the fix was verified.
    const done = await call<NotificationsResponse>(rafiq.id, "GET", "/notifications");
    expect(done.body.items.some((n) => n.title === `Wahid Hasan verified the fix for ${key}.`)).toBe(true);

    // Analytics reflect the lifecycle.
    const dash = await call(nusrat.id, "GET", "/dashboard?days=30");
    expect(dash.status).toBe(200);
    expect(dash.body.status_counts.closed).toBe(1);
    expect(dash.body.metrics.regression_pass_rate).toBe(0.5);
    const contrib = await call(nusrat.id, "GET", "/analytics/contributions?weeks=4");
    expect(contrib.body.scope).toBe("team");
    const wahidStats = contrib.body.people.find((p: { user_id: string }) => p.user_id === wahid.id);
    expect(wahidStats).toMatchObject({ reported: 1, fixed: 1, reopened: 1, verified: 1 });
    const own = await call(wahid.id, "GET", "/analytics/contributions?weeks=4");
    expect(own.body.scope).toBe("self");
    expect(own.body.people).toHaveLength(1);
  });
});

describe("decisions, disputes and duplicates", () => {
  it("lets QA dispute Not a Bug and a lead uphold it, after which it is locked", async () => {
    const w = basicWorkspace();
    const { call } = client(w.ctx);
    const { wahid, rafiq, nusrat } = w.users;
    const bug = (await call<BugDetail>(wahid.id, "POST", "/bugs", { json: newBugBody(w, { module_id: w.sites.id, feature_id: null }) })).body.bug;

    const noReason = await call(rafiq.id, "POST", `/bugs/${bug.key}/actions/mark_not_a_bug`, { json: {} });
    expect(noReason.status).toBe(400);

    const nab = await call<BugDetail>(rafiq.id, "POST", `/bugs/${bug.key}/actions/mark_not_a_bug`, {
      json: { reason: "Archived sites are hidden by design.", category: "works_as_designed" },
    });
    expect(nab.body.bug.status).toBe("not_a_bug");
    const items = await call<ActionItemsResponse>(wahid.id, "GET", "/action-items");
    expect(items.body.items[0]).toMatchObject({ kind: "review_decision" });

    const disputed = await call<BugDetail>(wahid.id, "POST", `/bugs/${bug.key}/actions/dispute`, {
      json: { reason: "The site isn't archived; it is active." },
    });
    expect(disputed.body.bug).toMatchObject({ status: "under_review", disputed: true });
    expect(disputed.body.waiting_on.party).toBe("lead");
    // The engineer can't simply re-reject while it is disputed.
    expect((await call(rafiq.id, "POST", `/bugs/${bug.key}/actions/mark_not_a_bug`, { json: { reason: "Still no" } })).status).toBe(403);

    const upheld = await call<BugDetail>(nusrat.id, "POST", `/bugs/${bug.key}/actions/uphold_decision`, {
      json: { note: "Checked with Rafiq: the site was archived on 3 Sep." },
    });
    expect(upheld.body.bug).toMatchObject({ status: "not_a_bug", dispute_locked: true, disputed: false });
    expect(upheld.body.bug.resolution_reason).toBe("Archived sites are hidden by design.");
    expect((await call(wahid.id, "POST", `/bugs/${bug.key}/actions/dispute`, { json: { reason: "again" } })).status).toBe(403);
    expect((await call(wahid.id, "POST", `/bugs/${bug.key}/actions/accept_decision`)).status).toBe(200);
  });

  it("overturns a dispute when an engineer accepts the bug", async () => {
    const w = basicWorkspace();
    const { call } = client(w.ctx);
    const { wahid, rafiq } = w.users;
    const bug = (await call<BugDetail>(wahid.id, "POST", "/bugs", { json: newBugBody(w) })).body.bug;
    await call(rafiq.id, "POST", `/bugs/${bug.key}/actions/mark_not_a_bug`, { json: { reason: "Expected." } });
    await call(wahid.id, "POST", `/bugs/${bug.key}/actions/dispute`, { json: { reason: "It isn't." } });
    const accepted = await call<BugDetail>(rafiq.id, "POST", `/bugs/${bug.key}/actions/start_work`);
    expect(accepted.body.bug).toMatchObject({ status: "in_progress", disputed: false });
    const notes = await call<NotificationsResponse>(wahid.id, "GET", "/notifications");
    expect(notes.body.items.some((n) => n.title === `${bug.key} was accepted as a bug after your dispute.`)).toBe(true);
  });

  it("links duplicates to the root original and keeps the reporter's credit", async () => {
    const w = basicWorkspace();
    const { call } = client(w.ctx);
    const { wahid, sara, rafiq } = w.users;
    const c = (await call<BugDetail>(sara.id, "POST", "/bugs", { json: newBugBody(w, { title: "Original" }) })).body.bug;
    const b = (await call<BugDetail>(wahid.id, "POST", "/bugs", { json: newBugBody(w, { title: "Second" }) })).body.bug;
    const a = (await call<BugDetail>(wahid.id, "POST", "/bugs", { json: newBugBody(w, { title: "Third" }) })).body.bug;

    await call(rafiq.id, "POST", `/bugs/${b.key}/actions/mark_duplicate`, { json: { duplicate_of: c.key } });
    const dupA = await call<BugDetail>(rafiq.id, "POST", `/bugs/${a.key}/actions/mark_duplicate`, { json: { duplicate_of: b.key } });
    expect(dupA.body.bug.duplicate_of_id).toBe(c.id);
    expect(dupA.body.duplicate_of?.key).toBe(c.key);

    const original = await call<BugDetail>(sara.id, "GET", `/bugs/${c.key}`);
    expect(original.body.duplicates.map((d) => d.key).sort()).toEqual([a.key, b.key].sort());
    expect(original.body.co_reporters.map((r) => r.user_id)).toEqual([wahid.id]);

    // Self and cyclic links are rejected.
    expect((await call(rafiq.id, "POST", `/bugs/${c.key}/actions/mark_duplicate`, { json: { duplicate_of: a.key } })).status).toBe(400);
  });
});

describe("permissions and edge cases", () => {
  it("routes regression to the QA lead when the reporter is not QA or has left", async () => {
    const w = basicWorkspace();
    const { call } = client(w.ctx);
    const { maria, rafiq, nusrat } = w.users;
    // An engineer reports a bug; QA must still verify it.
    const bug = (await call<BugDetail>(maria.id, "POST", "/bugs", { json: newBugBody(w) })).body.bug;
    await call(rafiq.id, "POST", `/bugs/${bug.key}/actions/start_work`);
    const fixed = await call<BugDetail>(rafiq.id, "POST", `/bugs/${bug.key}/actions/mark_fixed`, { json: { resolution: "Done" } });
    expect(fixed.body.regression_runs[0].assignee_id).toBe(nusrat.id);
  });

  it("requires a reason when engineering changes severity and tells the reporter", async () => {
    const w = basicWorkspace();
    const { call } = client(w.ctx);
    const { wahid, rafiq } = w.users;
    const bug = (await call<BugDetail>(wahid.id, "POST", "/bugs", { json: newBugBody(w, { severity: "critical" }) })).body.bug;
    expect((await call(rafiq.id, "PATCH", `/bugs/${bug.key}`, { json: { severity: "minor" } })).status).toBe(400);
    const ok = await call<BugDetail>(rafiq.id, "PATCH", `/bugs/${bug.key}`, { json: { severity: "major", reason: "Workaround exists via bulk edit." } });
    expect(ok.body.bug.severity).toBe("major");
    const notes = await call<NotificationsResponse>(wahid.id, "GET", "/notifications");
    expect(notes.body.items[0].title).toBe(`Severity of ${bug.key} changed from Critical to Major.`);
    // QA can't edit fields an engineer owns after triage, and can't touch someone else's report.
    expect((await call(w.users.sara.id, "PATCH", `/bugs/${bug.key}`, { json: { fields: { title: "Hijack" } } })).status).toBe(403);
  });

  it("archives instead of deleting, and only leads restore", async () => {
    const w = basicWorkspace();
    const { call } = client(w.ctx);
    const { wahid, nusrat } = w.users;
    const bug = (await call<BugDetail>(wahid.id, "POST", "/bugs", { json: newBugBody(w, { module_id: w.sites.id, feature_id: null }) })).body.bug;
    const archived = await call<BugDetail>(wahid.id, "POST", `/bugs/${bug.key}/actions/archive`, { json: { reason: "Reported by mistake" } });
    expect(archived.body.bug.archived_at).toBeTruthy();
    const list = await call(wahid.id, "GET", "/bugs?view=all");
    expect(list.body.items.find((b: { key: string }) => b.key === bug.key)).toBeUndefined();
    expect((await call(wahid.id, "POST", `/bugs/${bug.key}/actions/restore`)).status).toBe(403);
    expect((await call(nusrat.id, "POST", `/bugs/${bug.key}/actions/restore`)).body.bug.archived_at).toBeNull();
  });

  it("filters and searches the bug list", async () => {
    const w = basicWorkspace();
    const { call } = client(w.ctx);
    const { wahid, sara } = w.users;
    const one = (await call<BugDetail>(wahid.id, "POST", "/bugs", { json: newBugBody(w, { tags: ["Roles", "regression"] }) })).body.bug;
    await call(sara.id, "POST", "/bugs", { json: newBugBody(w, { title: "Site list is empty", module_id: w.sites.id, feature_id: null, severity: "minor" }) });
    expect((await call(wahid.id, "GET", "/bugs?view=mine")).body.total).toBe(1);
    expect((await call(wahid.id, "GET", `/bugs?q=${one.number}`)).body.items[0].key).toBe(one.key);
    expect((await call(wahid.id, "GET", "/bugs?q=sara")).body.total).toBe(1);
    expect((await call(wahid.id, "GET", "/bugs?severity=minor")).body.total).toBe(1);
    expect((await call(wahid.id, "GET", "/bugs?tag=roles")).body.total).toBe(1);
    expect((await call(wahid.id, "GET", `/bugs?module=${w.sites.id}`)).body.total).toBe(1);
    expect((await call(wahid.id, "GET", "/bugs?view=waiting_engineering")).body.total).toBe(2);
  });

  it("rejects unauthenticated requests and unknown actions", async () => {
    const w = basicWorkspace();
    const { call } = client(w.ctx);
    expect((await call(null, "GET", "/workspace")).status).toBe(401);
    expect((await call(w.users.wahid.id, "POST", "/bugs/BUG-000001/actions/teleport")).status).toBe(404);
  });
});
