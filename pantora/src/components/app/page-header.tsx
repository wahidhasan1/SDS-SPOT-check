import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const TONES = {
  violet: "from-brand-500 via-brand-400 to-sky-400",
  pink: "from-pink-500 via-pink-400 to-orange-400",
  sky: "from-sky-500 via-sky-400 to-mint-400",
  mint: "from-mint-500 via-mint-400 to-sky-400",
  sun: "from-sun-400 via-orange-400 to-pink-400",
  navy: "from-navy-900 via-navy-800 to-brand-800",
} as const;

/**
 * Page title. With `art`, renders a colourful banner with an illustration;
 * without it, a simple heading row.
 */
export function PageHeader({
  title,
  description,
  actions,
  art,
  tone = "violet",
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  art?: ReactNode;
  tone?: keyof typeof TONES;
}) {
  if (art) {
    return (
      <section className={cn("relative mb-7 overflow-hidden rounded-[2rem] bg-gradient-to-br p-6 text-white shadow-card sm:p-7", TONES[tone])}>
        <div className="pointer-events-none absolute inset-0 bg-dots-light" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
            {description && <p className="mt-2 max-w-2xl text-white/90">{description}</p>}
            {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
          </div>
          <div className="hidden h-28 w-40 shrink-0 animate-bob items-center justify-center sm:flex [&>svg]:h-full [&>svg]:w-full">{art}</div>
        </div>
      </section>
    );
  }
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
