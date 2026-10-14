"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, RotateCcw } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function ResetDemoButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <RotateCcw className="h-4 w-4" /> Reset demo data
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        tone="danger"
        title="Reset all demo data?"
        description="Every profile and record on this server will be deleted and the original sample data restored. This can't be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={loading}
              disabled={confirm !== "RESET"}
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  await api("/api/admin/reset", { body: { confirm } });
                  toast({ tone: "success", title: "Demo data restored", description: "You're now signed in to the demo account." });
                  setOpen(false);
                  setConfirm("");
                  router.refresh();
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setLoading(false);
                }
              }}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <Label htmlFor="reset-confirm">
          Type <span className="font-mono">RESET</span> to confirm
        </Label>
        <Input id="reset-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        {error && <p className="mt-2 text-sm font-medium text-danger-600">{error}</p>}
      </Dialog>
    </>
  );
}

export function ExitAdminButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await api("/api/admin/access", { method: "DELETE" }).catch(() => {});
        router.refresh();
      }}
      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
    >
      <LogOut className="h-4 w-4" /> Exit admin
    </button>
  );
}
