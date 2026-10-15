import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Mascot, type MascotMood } from "@/components/art/mascot";

/** Friendly empty state with the Pantora mascot (or a custom icon). */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  mood = "sleepy",
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  mood?: MascotMood;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-line-strong bg-surface/60 px-6 py-8 text-center", className)}>
      <div className="relative mb-2">
        <Mascot mood={mood} className="h-20 w-20" />
        {icon && <span className="absolute -right-2 -bottom-1 flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white shadow-card [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      </div>
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
