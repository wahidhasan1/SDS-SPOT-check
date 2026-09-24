// The bug's position in the QA ↔ engineering loop, with side-branches shown as callouts.

import { Check, CornerDownLeft, Pause, Ban, Copy, MessageCircleQuestion } from "lucide-react";
import type { Bug, StatusKey } from "../../core/types";
import { useWorkspace } from "../app/context";
import { cx } from "./ui";

const STAGES = ["Reported", "Triage", "In progress", "Fixed", "Regression", "Verified", "Closed"] as const;

function stageOf(status: StatusKey, returnTo: StatusKey | null): number {
  switch (status) {
    case "new":
      return 0;
    case "under_review":
      return 1;
    case "in_progress":
    case "regression_failed":
      return 2;
    case "need_info":
      return returnTo === "in_progress" || returnTo === "regression_failed" ? 2 : returnTo === "under_review" ? 1 : 0;
    case "fixed":
      return 3;
    case "regression_required":
      return 4;
    case "verified":
      return 5;
    case "closed":
      return 6;
    case "not_a_bug":
    case "duplicate":
    case "deferred":
      return 1;
  }
}

export function LifecycleTrack({ bug }: { bug: Bug }) {
  const { lookup } = useWorkspace();
  const current = stageOf(bug.status, bug.info_return_status);
  const stopped = bug.status === "not_a_bug" || bug.status === "duplicate" || bug.status === "deferred";
  const forced = bug.status === "closed" && !bug.verified_at && !!bug.close_reason;
  const cfg = lookup.status(bug.status);

  const branch = (() => {
    switch (bug.status) {
      case "need_info":
        return { icon: MessageCircleQuestion, text: "Waiting for more information from QA", tone: "warning" };
      case "regression_failed":
        return { icon: CornerDownLeft, text: `Reopened after failed regression${bug.reopen_count > 1 ? ` (${bug.reopen_count}×)` : ""}`, tone: "danger" };
      case "not_a_bug":
        return { icon: Ban, text: "Resolved as Not a Bug", tone: "neutral" };
      case "duplicate":
        return { icon: Copy, text: "Resolved as a duplicate", tone: "neutral" };
      case "deferred":
        return { icon: Pause, text: "Deferred", tone: "neutral" };
      default:
        if (forced) return { icon: Ban, text: "Closed without verification", tone: "danger" };
        if (bug.disputed) return { icon: MessageCircleQuestion, text: "Decision disputed by the reporter", tone: "warning" };
        return null;
    }
  })();

  return (
    <div className="lifecycle">
      <ol className="lifecycle-track" aria-label={`Lifecycle: ${cfg.label}`}>
        {STAGES.map((label, i) => {
          const done = bug.status === "closed" && !forced ? true : i < current && !(stopped && i > current);
          const isCurrent = i === current && !(bug.status === "closed" && !forced);
          const muted = (stopped || forced) && i > current;
          return (
            <li key={label} className={cx("stage", done && "done", isCurrent && "current", muted && "muted", isCurrent && `tone-${cfg.color}`)}>
              <span className="node" aria-hidden>
                {done ? <Check /> : null}
              </span>
              <span className="stage-label">{label}</span>
              {isCurrent && <span className="sr-only">(current)</span>}
            </li>
          );
        })}
      </ol>
      {branch && (
        <div className={cx("lifecycle-branch", branch.tone)}>
          <branch.icon aria-hidden />
          <span>{branch.text}</span>
          {bug.regression_round > 1 && bug.status === "regression_required" && <span className="muted">· regression round {bug.regression_round}</span>}
        </div>
      )}
      {!branch && bug.regression_round > 1 && (bug.status === "regression_required" || bug.status === "closed" || bug.status === "verified") && (
        <div className="lifecycle-branch neutral">
          <CornerDownLeft aria-hidden />
          <span>
            {bug.status === "regression_required" ? `Regression round ${bug.regression_round}` : `Verified on regression round ${bug.regression_round}`} · reopened {bug.reopen_count}×
          </span>
        </div>
      )}
    </div>
  );
}
