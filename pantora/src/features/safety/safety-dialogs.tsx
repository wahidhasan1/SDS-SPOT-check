"use client";

import { useState } from "react";
import { REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/schemas";
import { api, errorMessage } from "@/lib/api-client";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label, Textarea, FieldHint } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

export interface SafetyTarget {
  id: string;
  kind: "demo_partner" | "user";
  name: string;
  sessionId?: string | null;
  isDemo?: boolean;
}

export function ReportDialog({
  open,
  onClose,
  target,
  onReported,
}: {
  open: boolean;
  onClose: () => void;
  target: SafetyTarget;
  onReported?: (opts: { alsoBlocked: boolean }) => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number] | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason) {
      setError("Choose a reason for the report.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api("/api/safety/report", {
        body: { reportedId: target.id, reportedKind: target.kind, reportedName: target.name, sessionId: target.sessionId ?? null, reason, details },
      });
      if (alsoBlock) await api("/api/safety/block", { body: { blockedId: target.id, blockedKind: target.kind, blockedName: target.name } });
      toast({
        tone: "success",
        title: "Report submitted",
        description: `Thank you. Your report about ${target.name} was recorded${alsoBlock ? " and they are blocked" : ""}. You can follow its status in the Safety Center.`,
      });
      onReported?.({ alsoBlocked: alsoBlock });
      setReason(null);
      setDetails("");
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Report ${target.name}`}
      description="Reports are private. The person you report is not told who reported them."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={submitting}>
            Submit report
          </Button>
        </>
      }
    >
      {target.isDemo && (
        <p className="mb-4 rounded-xl bg-streak-50 px-3.5 py-2.5 text-sm text-streak-700">
          {target.name} is a fictional demo partner. Your report is still recorded so you can see how reporting works.
        </p>
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">What happened?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                "rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-colors",
                reason === r ? "border-danger-500 bg-danger-50 text-danger-700" : "border-line hover:bg-surface-muted",
              )}
            >
              {REPORT_REASON_LABELS[r]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-4">
        <Label htmlFor="report-details">Details (optional)</Label>
        <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="Tell us what happened. Don't include your own personal information." />
        <FieldHint>{details.length}/1000</FieldHint>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="h-4 w-4 accent-brand-600" />
        Also block {target.name} so you are never matched again
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger-600">
          {error}
        </p>
      )}
    </Dialog>
  );
}

export function BlockDialog({ open, onClose, target, onBlocked }: { open: boolean; onClose: () => void; target: SafetyTarget; onBlocked?: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      tone="danger"
      title={`Block ${target.name}?`}
      description={`You won't be matched with ${target.name} again${target.isDemo ? " in demo matching" : ""}. You can unblock them later in the Safety Center.`}
      confirmLabel="Block"
      loading={loading}
      onConfirm={async () => {
        setLoading(true);
        try {
          await api("/api/safety/block", { body: { blockedId: target.id, blockedKind: target.kind, blockedName: target.name } });
          toast({ tone: "success", title: `${target.name} is blocked`, description: "They won't be selected as your partner again." });
          onBlocked?.();
          onClose();
        } catch (e) {
          toast({ tone: "error", title: "Could not block", description: errorMessage(e) });
        } finally {
          setLoading(false);
        }
      }}
    />
  );
}
