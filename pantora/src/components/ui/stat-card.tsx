import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  unit,
  icon,
  tone = "brand",
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon: ReactNode;
  tone?: "brand" | "success" | "streak" | "info";
  hint?: ReactNode;
  className?: string;
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-600",
    streak: "bg-streak-50 text-streak-600",
    info: "bg-info-50 text-info-700",
  };
  return (
    <div className={cn("rounded-card border border-line bg-surface p-4 shadow-card sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted">{label}</p>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tones[tone])}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-subtle">{unit}</span>}
      </p>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
