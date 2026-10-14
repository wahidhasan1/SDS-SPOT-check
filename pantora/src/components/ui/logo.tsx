import { cn } from "@/lib/cn";

/** Pantora mark: two overlapping speech bubbles forming a "P" — two voices meeting. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <rect width="40" height="40" rx="12" fill="#11153a" />
      <path d="M11 10h11a8 8 0 0 1 0 16h-5v5.5L11 26z" fill="#7c6cf8" />
      <circle cx="26.5" cy="24.5" r="6.5" fill="#22b5f2" opacity="0.92" />
      <circle cx="17" cy="18" r="2.2" fill="#fff" />
    </svg>
  );
}

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("text-xl font-extrabold tracking-tight", tone === "light" ? "text-white" : "text-ink")}>
        Pantora
      </span>
    </span>
  );
}
