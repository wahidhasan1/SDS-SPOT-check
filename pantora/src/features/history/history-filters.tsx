"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Input, Label, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface Filters {
  type: string;
  status: string;
  from: string;
  to: string;
  sort: string;
  feedback: boolean;
}

const TYPES = [
  ["all", "All"],
  ["free_talk", "Free Talk"],
  ["battle", "Speaking Battles"],
  ["coach", "AI Practice"],
] as const;

export function HistoryFiltersBar({ initial }: { initial: Filters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [f, setF] = useState(initial);

  function apply(next: Filters) {
    setF(next);
    const params = new URLSearchParams();
    if (next.type !== "all") params.set("type", next.type);
    if (next.status !== "all") params.set("status", next.status);
    if (next.from) params.set("from", next.from);
    if (next.to) params.set("to", next.to);
    if (next.sort !== "newest") params.set("sort", next.sort);
    if (next.feedback) params.set("feedback", "1");
    start(() => router.push(`${pathname}${params.size ? `?${params}` : ""}`));
  }

  const dirty = f.type !== "all" || f.status !== "all" || f.from || f.to || f.sort !== "newest" || f.feedback;

  return (
    <div className={cn("space-y-4 rounded-card border border-line bg-surface p-4 shadow-card transition-opacity", pending && "opacity-70")}>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Session type">
        {TYPES.map(([value, label]) => (
          <button
            key={value}
            role="radio"
            aria-checked={f.type === value}
            onClick={() => apply({ ...f, type: value })}
            className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition-colors", f.type === value ? "bg-brand-600 text-white" : "bg-surface-muted text-ink-soft hover:bg-line")}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <Label htmlFor="h-status">Status</Label>
          <Select id="h-status" value={f.status} onChange={(e) => apply({ ...f, status: e.target.value })}>
            <option value="all">Completed and incomplete</option>
            <option value="completed">Completed</option>
            <option value="incomplete">Incomplete</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="h-from">From</Label>
          <Input id="h-from" type="date" value={f.from} max={f.to || undefined} onChange={(e) => apply({ ...f, from: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="h-to">To</Label>
          <Input id="h-to" type="date" value={f.to} min={f.from || undefined} onChange={(e) => apply({ ...f, to: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="h-sort">Sort by</Label>
          <Select id="h-sort" value={f.sort} onChange={(e) => apply({ ...f, sort: e.target.value })}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="longest">Longest duration</option>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium">
            <input type="checkbox" checked={f.feedback} onChange={(e) => apply({ ...f, feedback: e.target.checked })} className="h-4 w-4 accent-brand-600" />
            With feedback
          </label>
          {dirty && (
            <Button variant="ghost" size="icon" aria-label="Clear filters" onClick={() => apply({ type: "all", status: "all", from: "", to: "", sort: "newest", feedback: false })}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
