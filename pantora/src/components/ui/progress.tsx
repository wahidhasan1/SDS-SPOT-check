import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  max = 1,
  tone = "brand",
  className,
  label,
}: {
  value: number;
  max?: number;
  tone?: "brand" | "success" | "streak" | "danger" | "pink" | "sky" | "sun" | "rainbow";
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const colors = {
    brand: "bg-gradient-to-r from-brand-500 to-brand-400",
    success: "bg-gradient-to-r from-mint-500 to-mint-400",
    streak: "bg-gradient-to-r from-orange-500 to-sun-400",
    danger: "bg-danger-500",
    pink: "bg-gradient-to-r from-pink-500 to-pink-400",
    sky: "bg-gradient-to-r from-sky-500 to-sky-400",
    sun: "bg-gradient-to-r from-sun-500 to-sun-300",
    rainbow: "bg-gradient-to-r from-brand-500 via-pink-500 to-orange-400",
  };
  return (
    <div
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-surface-muted", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value * 100) / 100}
      aria-label={label}
    >
      <div className={cn("relative h-full overflow-hidden rounded-full transition-[width] duration-700", colors[tone])} style={{ width: `${pct}%` }}>
        <span className="absolute inset-x-1 top-[18%] h-[28%] rounded-full bg-white/35" aria-hidden />
      </div>
    </div>
  );
}

export function ProgressRing({
  value,
  size = 96,
  stroke = 9,
  tone = "brand",
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "brand" | "success" | "streak" | "pink" | "sky";
  children?: React.ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const colors = {
    brand: "var(--color-brand-500)",
    success: "var(--color-mint-500)",
    streak: "var(--color-orange-500)",
    pink: "var(--color-pink-500)",
    sky: "var(--color-sky-500)",
  };
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
