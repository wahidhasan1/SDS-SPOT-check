import { cn } from "@/lib/cn";

export function LevelMeter({ level, bars = 12, className, active = true }: { level: number; bars?: number; className?: string; active?: boolean }) {
  return (
    <div className={cn("flex h-6 items-end gap-0.5", className)} aria-hidden>
      {Array.from({ length: bars }, (_, i) => {
        const threshold = (i + 1) / bars;
        const on = active && level >= threshold * 0.85;
        return <span key={i} className={cn("w-1 rounded-full transition-all duration-75", on ? "bg-success-500" : "bg-line-strong")} style={{ height: `${30 + (i / bars) * 70}%` }} />;
      })}
    </div>
  );
}
