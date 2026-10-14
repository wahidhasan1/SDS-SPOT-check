"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Bookmark, Check, Trash2 } from "lucide-react";
import type { SavedSentence } from "@/server/queries";
import { ISSUE_CATEGORY_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/dates";
import { api, errorMessage } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { CopyButton } from "@/features/practice/copy-button";

export function SavedSentencesList({ items, timeZone }: { items: SavedSentence[]; timeZone: string }) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | "todo" | "done">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SavedSentence | null>(null);
  const shown = useMemo(() => items.filter((i) => (filter === "all" ? true : filter === "todo" ? !i.reviewed : i.reviewed)), [items, filter]);

  async function review(id: string) {
    setBusy(id);
    try {
      const res = await api<{ xp: number; newAchievements: { name: string }[] }>(`/api/saved-sentences/${id}`, { body: {} });
      toast({ tone: "success", title: "Marked as reviewed", description: [res.xp ? `+${res.xp} XP` : null, ...res.newAchievements.map((a) => `Achievement unlocked: ${a.name}`)].filter(Boolean).join(" · ") || undefined });
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Could not update", description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!toDelete) return;
    setBusy(toDelete.id);
    try {
      await api(`/api/saved-sentences/${toDelete.id}`, { method: "DELETE" });
      toast({ tone: "success", title: "Removed from My Learning" });
      setToDelete(null);
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Could not remove", description: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Bookmark className="h-6 w-6" />}
        title="No saved sentences yet"
        description="When you see a correction you like — in a session review or coach feedback — tap Save to keep it here."
        action={<ButtonLink href="/coach">Get feedback from the coach</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Segmented
        label="Filter saved sentences"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: `All (${items.length})` },
          { value: "todo", label: `To review (${items.filter((i) => !i.reviewed).length})` },
          { value: "done", label: `Reviewed (${items.filter((i) => i.reviewed).length})` },
        ]}
      />
      {shown.length === 0 ? (
        <EmptyState title="Nothing here" description="No sentences match this filter." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {shown.map((s) => (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                {s.category && <Badge tone="neutral">{ISSUE_CATEGORY_LABELS[s.category]}</Badge>}
                {s.reviewed ? <Badge tone="success">Reviewed</Badge> : <Badge tone="streak">To review</Badge>}
                <span className="ml-auto text-xs text-muted">{formatDate(s.createdAt, timeZone)}</span>
              </div>
              <p className="mt-3 text-sm text-muted line-through decoration-danger-500/60">{s.original}</p>
              <p className="mt-1 text-lg font-semibold text-ink">{s.corrected}</p>
              {s.explanation && <p className="mt-2 text-sm text-ink-soft">{s.explanation}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-1 pt-4">
                {!s.reviewed && (
                  <Button size="sm" variant="secondary" onClick={() => review(s.id)} loading={busy === s.id}>
                    <Check className="h-4 w-4" /> Mark reviewed
                  </Button>
                )}
                <CopyButton text={s.corrected} />
                {s.sourceId && (
                  <Link href={`/history/${s.sourceId}`} className="px-2 text-sm font-semibold text-brand-600 hover:text-brand-800">
                    View source
                  </Link>
                )}
                <Button size="sm" variant="ghost" className="ml-auto text-danger-700 hover:bg-danger-50" onClick={() => setToDelete(s)} aria-label="Remove saved sentence">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Remove this sentence?"
        description="It will be removed from My Learning. This can't be undone."
        confirmLabel="Remove"
        tone="danger"
        loading={!!busy}
        onConfirm={remove}
      />
    </div>
  );
}
