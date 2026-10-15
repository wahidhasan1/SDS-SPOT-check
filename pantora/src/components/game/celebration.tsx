"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

const CONFETTI_COLORS = ["#ff3d9a", "#ffd23f", "#4cc3ff", "#3ee6a8", "#8c7cfb", "#ff9a52"];

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return document.documentElement.dataset.reducedMotion === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A one-shot confetti burst. Decorative; hidden from assistive tech and skipped with reduced motion. */
export function Confetti({ pieces = 70, className }: { pieces?: number; className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {Array.from({ length: pieces }, (_, i) => {
        const left = (i * 37) % 100;
        const dx = (((i * 53) % 120) - 60) * 2;
        const dy = 260 + ((i * 71) % 260);
        const rot = 360 + ((i * 97) % 540);
        const delay = ((i * 13) % 40) / 100;
        const shape = i % 3;
        return (
          <span
            key={i}
            className="absolute top-[-12px] block animate-confetti"
            style={
              {
                left: `${left}%`,
                width: shape === 2 ? 8 : 7,
                height: shape === 0 ? 14 : shape === 1 ? 7 : 8,
                borderRadius: shape === 1 ? "999px" : "2px",
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `${delay}s`,
                "--dx": `${dx}px`,
                "--dy": `${dy}px`,
                "--rot": `${rot}deg`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/** Animated number that counts up from 0 (or shows the final value with reduced motion). */
export function CountUp({ value, duration = 900, className, prefix = "", suffix = "" }: { value: number; duration?: number; className?: string; prefix?: string; suffix?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion() || value === 0) {
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <span className={cn("tabular-nums", className)} aria-label={`${prefix}${value}${suffix}`}>
      <span aria-hidden>
        {prefix}
        {shown}
        {suffix}
      </span>
    </span>
  );
}

/** Full-screen celebration for big moments: level ups, achievements, victories. */
export function CelebrationModal({
  open,
  onClose,
  art,
  eyebrow,
  title,
  children,
  actionLabel = "Awesome!",
}: {
  open: boolean;
  onClose: () => void;
  art: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actionLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-visible bg-transparent p-0 open:animate-pop-in"
    >
      {open && (
        <div className="relative overflow-hidden rounded-[2rem] bg-navy-900 bg-dots-light px-6 pt-8 pb-6 text-center text-white shadow-pop">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand-500/50 blur-3xl" aria-hidden />
          <Confetti />
          <div className="relative">
            <div className="mx-auto flex h-36 w-44 animate-bob items-center justify-center">{art}</div>
            {eyebrow && <p className="mt-3 text-xs font-extrabold tracking-[0.18em] text-sun-300 uppercase">{eyebrow}</p>}
            <h2 id={titleId} className="mt-1 text-3xl font-extrabold tracking-tight">
              {title}
            </h2>
            {children && <div className="mt-3 text-white/75">{children}</div>}
            <Button variant="pop" size="lg" className="mt-6 w-full" onClick={onClose} autoFocus>
              {actionLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
