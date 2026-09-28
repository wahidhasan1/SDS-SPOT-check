import { describe, expect, it } from "vitest";
import { basicWorkspace, client } from "./helpers";
import type { ActionItemsResponse, ImprovementDetail, NotificationsResponse, PolishResult } from "../src/core/api";
import { tidyEnglish } from "../src/server/ai/tidy";

describe("improvement suggestions", () => {
  it("goes from the analyst to the project manager to the engineer", async () => {
    const w = basicWorkspace();
    const { call } = client(w.ctx);
    const { wahid, rafiq, hanne } = w.users;

    const rough = "in members page when i edit member evry time i have to scrol down to find save buton. pls put save buton on top also so its not hassel";
    const polished = await call<PolishResult>(wahid.id, "POST", "/ai/polish-improvement", { json: { project_id: w.project.id, text: rough } });
    expect(polished.status).toBe(200);
    expect(polished.body.provider).toBe("offline");
    expect(polished.body.body).toBe("In Members page when I edit member every time I have to scroll down to find save button. Please put save button on top also so it's not hassle.");
    expect(polished.body.body).toMatch(/^In Members page/);
    expect(polished.body.module_id).toBe(w.members.id);

    const created = await call<ImprovementDetail>(wahid.id, "POST", "/improvements", {
      json: { project_id: w.project.id, module_id: polished.body.module_id, title: polished.body.title, body: polished.body.body, original_text: rough, polished_by: "offline" },
    });
    expect(created.status).toBe(201);
    const imp = created.body.improvement;
    expect(imp.key).toBe("IMP-000001");
    expect(imp.status).toBe("proposed");
    expect(imp.original_text).toBe(rough);

    // The project manager is told and sees it in their queue; the engineer can't approve.
    const pmNotes = await call<NotificationsResponse>(hanne.id, "GET", "/notifications");
    expect(pmNotes.body.items[0]).toMatchObject({ title: "Wahid Hasan suggested an improvement: IMP-000001.", improvement_id: imp.id });
    const pmQueue = await call<ActionItemsResponse>(hanne.id, "GET", "/action-items");
    expect(pmQueue.body.improvements.map((i) => i.kind)).toEqual(["review_improvement"]);
    expect((await call(rafiq.id, "POST", `/improvements/${imp.key}/approve`, { json: {} })).status).toBe(403);

    // Approved without naming anyone: the module owner builds it.
    const approved = await call<ImprovementDetail>(hanne.id, "POST", `/improvements/${imp.key}/approve`, { json: { note: "Good idea, keep it sticky." } });
    expect(approved.body.improvement).toMatchObject({ status: "approved", assignee_id: w.members.owner_id, decided_by_id: hanne.id });
    const owner = w.members.owner_id!;
    const engQueue = await call<ActionItemsResponse>(owner, "GET", "/action-items");
    expect(engQueue.body.improvements.map((i) => i.kind)).toEqual(["build_improvement"]);

    const done = await call<ImprovementDetail>(owner, "POST", `/improvements/${imp.key}/done`, { json: { note: "Save is now pinned to the top." } });
    expect(done.body.improvement.status).toBe("done");
    const wahidNotes = await call<NotificationsResponse>(wahid.id, "GET", "/notifications");
    expect(wahidNotes.body.items.map((n) => n.title)).toEqual(expect.arrayContaining(["Your suggestion IMP-000001 was approved.", expect.stringMatching(/finished IMP-000001/)]));
    expect(done.body.events.map((e) => e.type)).toEqual(["improvement.created", "improvement.approved", "improvement.done"]);
  });

  it("lets the project manager close a suggestion with a reason", async () => {
    const w = basicWorkspace();
    const { call } = client(w.ctx);
    const { wahid, hanne } = w.users;
    const created = await call<ImprovementDetail>(wahid.id, "POST", "/improvements", { json: { project_id: w.project.id, body: "Make the logo bigger." } });
    const key = created.body.improvement.key;
    expect((await call(hanne.id, "POST", `/improvements/${key}/decline`, { json: {} })).status).toBe(400);
    const closed = await call<ImprovementDetail>(hanne.id, "POST", `/improvements/${key}/decline`, { json: { reason: "The brand guidelines fix the logo size." } });
    expect(closed.body.improvement).toMatchObject({ status: "declined", decision_note: "The brand guidelines fix the logo size." });
    expect((await call(hanne.id, "POST", `/improvements/${key}/approve`, { json: {} })).status).toBe(409);
    const notes = await call<NotificationsResponse>(wahid.id, "GET", "/notifications");
    expect(notes.body.items[0].title).toBe(`Your suggestion ${key} was closed by Hanne Pm.`);
  });

  it("tidies rough English without changing what it says", () => {
    expect(tidyEnglish("i think  the filter shoud stay when u go back ,its realy confusng")).toBe("I think the filter should stay when you go back, it's really confusing.");
    expect(tidyEnglish("dont reset the page\nplz keep my search")).toBe("Don't reset the page. Please keep my search.");
  });
});
