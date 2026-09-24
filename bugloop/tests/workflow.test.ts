import { describe, expect, it } from "vitest";
import { availableActions, checkAction, targetStatus, type WorkflowContext } from "../src/core/workflow";
import type { Role, StatusKey } from "../src/core/types";
import { waitingOn } from "../src/core/statuses";

const actor = (id: string, role: Role) => ({ id, role, active: true });
const QA = actor("qa1", "qa_analyst");
const QA2 = actor("qa2", "qa_analyst");
const ENG = actor("eng1", "engineer");
const LEAD = actor("lead1", "qa_lead");
const PM = actor("pm1", "project_manager");

function ctx(status: StatusKey, a = ENG, extra: Partial<WorkflowContext["bug"]> = {}, regression: WorkflowContext["regression"] = null): WorkflowContext {
  return {
    actor: a,
    bug: {
      status,
      reporter_id: QA.id,
      assignee_id: ENG.id,
      fixed_by_id: null,
      info_requested_from_id: null,
      info_return_status: null,
      disputed: false,
      dispute_locked: false,
      dispute_context: null,
      archived_at: null,
      decision_acknowledged_at: null,
      confirmed_at: null,
      ...extra,
    },
    regression,
    autoCloseOnVerify: true,
    isStatusEnabled: () => true,
  };
}

describe("workflow engine", () => {
  it("lets engineers triage new bugs but not QA", () => {
    expect(availableActions(ctx("new", ENG))).toEqual(
      expect.arrayContaining(["start_work", "start_review", "confirm", "request_info", "mark_not_a_bug", "mark_duplicate", "defer"]),
    );
    const qaActions = availableActions(ctx("new", QA));
    expect(qaActions).not.toContain("start_work");
    expect(qaActions).not.toContain("mark_fixed");
    // The reporter can archive a mistaken report only while it is new and unassigned.
    expect(qaActions).not.toContain("archive");
    expect(availableActions(ctx("new", QA, { assignee_id: null }))).toContain("archive");
  });

  it("never lets engineers verify or close a fixed bug", () => {
    const c = ctx("regression_required", ENG, { fixed_by_id: ENG.id }, { assignee_id: QA.id, started_at: null });
    expect(checkAction("pass_regression", c).ok).toBe(false);
    expect(checkAction("fail_regression", c).ok).toBe(false);
    expect(checkAction("close", c).ok).toBe(false);
    expect(checkAction("force_close", c).ok).toBe(false);
  });

  it("lets only the regression owner or a lead verify", () => {
    const run = { assignee_id: QA.id, started_at: null };
    expect(checkAction("pass_regression", ctx("regression_required", QA, { fixed_by_id: ENG.id }, run)).ok).toBe(true);
    expect(checkAction("pass_regression", ctx("regression_required", QA2, { fixed_by_id: ENG.id }, run)).ok).toBe(false);
    expect(checkAction("pass_regression", ctx("regression_required", LEAD, { fixed_by_id: ENG.id }, run)).ok).toBe(true);
  });

  it("enforces separation of duties even for leads", () => {
    const run = { assignee_id: LEAD.id, started_at: null };
    const result = checkAction("pass_regression", ctx("regression_required", LEAD, { fixed_by_id: LEAD.id }, run));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/someone else must verify/);
  });

  it("returns need-info bugs to the status they came from", () => {
    const c = ctx("need_info", QA, { info_return_status: "in_progress", info_requested_from_id: QA.id });
    expect(checkAction("provide_info", c).ok).toBe(true);
    expect(targetStatus("provide_info", c.bug, () => true)).toBe("in_progress");
    expect(checkAction("provide_info", ctx("need_info", QA2, { info_requested_from_id: QA.id })).ok).toBe(false);
  });

  it("supports disputes and upholding by a lead", () => {
    expect(checkAction("dispute", ctx("not_a_bug", QA)).ok).toBe(true);
    expect(checkAction("dispute", ctx("not_a_bug", QA2)).ok).toBe(false);
    expect(checkAction("dispute", ctx("not_a_bug", QA, { dispute_locked: true })).ok).toBe(false);

    const disputed = {
      disputed: true,
      dispute_context: {
        from: "not_a_bug" as const,
        reason: "It is a bug",
        disputed_by_id: QA.id,
        disputed_at: "2026-09-01T00:00:00.000Z",
        decided_by_id: ENG.id,
        resolution_reason: "Expected",
        rejection_category: null,
        duplicate_of_id: null,
      },
    };
    expect(checkAction("uphold_decision", ctx("under_review", LEAD, disputed)).ok).toBe(true);
    expect(checkAction("uphold_decision", ctx("under_review", PM, disputed)).ok).toBe(true);
    expect(checkAction("uphold_decision", ctx("under_review", ENG, disputed)).ok).toBe(false);
    // While disputed, an engineer cannot simply re-reject it.
    expect(checkAction("mark_not_a_bug", ctx("under_review", ENG, disputed)).ok).toBe(false);
    expect(targetStatus("uphold_decision", ctx("under_review", LEAD, disputed).bug, () => true)).toBe("not_a_bug");
  });

  it("lets QA reopen closed bugs and blocks everything on archived bugs except restore", () => {
    expect(checkAction("reopen", ctx("closed", QA)).ok).toBe(true);
    expect(checkAction("reopen", ctx("closed", ENG)).ok).toBe(false);
    const archived = ctx("in_progress", ENG, { archived_at: "2026-09-01T00:00:00.000Z" });
    expect(availableActions(archived)).toEqual([]);
    expect(availableActions({ ...archived, actor: LEAD })).toEqual(["restore"]);
  });

  it("hides optional statuses when disabled", () => {
    const c = { ...ctx("new", ENG), isStatusEnabled: (k: StatusKey) => k !== "deferred" && k !== "under_review" };
    const actions = availableActions(c);
    expect(actions).not.toContain("defer");
    expect(actions).not.toContain("start_review");
  });

  it("describes who a bug is waiting on", () => {
    const base = { assignee_id: ENG.id, reporter_id: QA.id, info_requested_from_id: null, disputed: false, archived_at: null };
    expect(waitingOn({ ...base, status: "need_info" }, { regressionAssigneeId: null, autoCloseOnVerify: true })).toMatchObject({ party: "qa", user_id: QA.id });
    expect(waitingOn({ ...base, status: "regression_required" }, { regressionAssigneeId: QA2.id, autoCloseOnVerify: true })).toMatchObject({ party: "qa", user_id: QA2.id });
    expect(waitingOn({ ...base, status: "in_progress" }, { regressionAssigneeId: null, autoCloseOnVerify: true })).toMatchObject({ party: "engineering", user_id: ENG.id });
    expect(waitingOn({ ...base, status: "closed" }, { regressionAssigneeId: null, autoCloseOnVerify: true }).party).toBe("nobody");
  });
});
