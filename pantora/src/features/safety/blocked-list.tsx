"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

export function BlockedList({ blocks, timeZone }: { blocks: { id: string; kind: string; name: string; createdAt: string }[]; timeZone: string }) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  if (blocks.length === 0) return <EmptyState title="No one is blocked" description="You can block a partner during or after a conversation." className="py-6" />;
  return (
    <>
      <ul className="divide-y divide-line">
        {blocks.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-semibold">{b.name}</p>
              <p className="text-xs text-muted">
                {b.kind === "demo_partner" ? "Demo partner" : "Pantora user"} · blocked {formatDate(b.createdAt, timeZone)}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setTarget({ id: b.id, name: b.name })}>
              Unblock
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        title={`Unblock ${target?.name}?`}
        description="They could be matched with you again."
        confirmLabel="Unblock"
        loading={loading}
        onConfirm={async () => {
          if (!target) return;
          setLoading(true);
          try {
            await api("/api/safety/block", { method: "DELETE", body: { blockedId: target.id } });
            toast({ tone: "success", title: `${target.name} was unblocked` });
            setTarget(null);
            router.refresh();
          } catch (e) {
            toast({ tone: "error", title: "Could not unblock", description: errorMessage(e) });
          } finally {
            setLoading(false);
          }
        }}
      />
    </>
  );
}
