import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "success" | "streak" | "danger" | "info" | "sample" | "demo" | "dark" | "pink" | "sun" | "mint" | "sky";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-soft",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  streak: "bg-streak-50 text-streak-700",
  danger: "bg-danger-50 text-danger-700",
  info: "bg-info-50 text-info-700",
  sample: "border border-dashed border-line-strong bg-surface text-muted",
  demo: "bg-streak-100 text-streak-700",
  dark: "bg-white/15 text-white",
  pink: "bg-pink-50 text-pink-700",
  sun: "bg-sun-100 text-sun-700",
  mint: "bg-mint-50 text-mint-700",
  sky: "bg-sky-50 text-sky-700",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}

/** Marks preloaded demo history so it is never mistaken for the user's own activity. */
export function SampleBadge({ className, label = "Sample data" }: { className?: string; label?: string }) {
  return (
    <Badge tone="sample" className={className} title="Preloaded sample history for the demo account">
      {label}
    </Badge>
  );
}
