"use client";

import { useState } from "react";
import type { DayPoint } from "@/server/queries";
import { formatMinutes, weekdayShort } from "@/lib/dates";
import { cn } from "@/lib/cn";

function longDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

function dayLabel(d: DayPoint) {
  return `${longDate(d.date)}: ${formatMinutes(d.practiceSeconds)} min, ${d.sessions} session${d.sessions === 1 ? "" : "s"}${d.isSample ? " (sample data)" : ""}`;
}

/** Daily speaking minutes as thin rounded bars. Sample-history days are hatched and labeled in the legend. */
export function DailyBars({ days, goalMinutes, today }: { days: DayPoint[]; goalMinutes: number; today: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const maxMin = Math.max(goalMinutes, ...days.map((d) => d.practiceSeconds / 60), 1);
  const top = Math.ceil(maxMin / 5) * 5;
  const ticks = [0, top / 2, top];
  const hasSample = days.some((d) => d.isSample && d.practiceSeconds > 0);
  return (
    <div>
      <div className="relative flex h-52 gap-3">
        {/* y axis */}
        <div className="flex w-7 flex-col justify-between pb-6 text-right text-[11px] text-subtle tabular-nums" aria-hidden>
          {[...ticks].reverse().map((t) => (
            <span key={t}>{Math.round(t)}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 bottom-6" aria-hidden>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
            <div className="absolute inset-x-0 border-t-2 border-success-500/70" style={{ bottom: `${(goalMinutes / top) * 100}%` }}>
              <span className="absolute -top-5 right-0 rounded bg-surface px-1 text-[11px] font-semibold text-success-700">Goal {goalMinutes} min</span>
            </div>
          </div>
          <ol className="absolute inset-0 flex items-end gap-[2px]" aria-label="Daily speaking minutes">
            {days.map((d, i) => {
              const h = (d.practiceSeconds / 60 / top) * 100;
              return (
                <li key={d.date} className="relative flex h-full flex-1 flex-col items-center justify-end">
                  <button
                    type="button"
                    className="flex h-full w-full items-end justify-center pb-6 focus-visible:outline-offset-0"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={dayLabel(d)}
                  >
                    <span
                      className={cn(
                        "block w-full max-w-7 rounded-t-[4px] transition-opacity",
                        d.isSample ? "bg-brand-300" : "bg-brand-500",
                        hover !== null && hover !== i && "opacity-50",
                      )}
                      style={{
                        height: `${Math.max(h, d.practiceSeconds > 0 ? 2 : 0)}%`,
                        backgroundImage: d.isSample ? "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.55) 0 2px, transparent 2px 6px)" : undefined,
                      }}
                    />
                  </button>
                  <span className={cn("absolute bottom-0 text-[11px]", d.date === today ? "font-bold text-brand-700" : "text-subtle")} aria-hidden>
                    {days.length <= 14 ? weekdayShort(d.date).slice(0, 2) : i % 7 === 6 ? longDate(d.date).split(", ")[1] : ""}
                  </span>
                  {hover === i && (
                    <span className="pointer-events-none absolute bottom-full z-10 mb-1 w-max max-w-48 rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs text-white shadow-pop">
                      <span className="block font-semibold">{longDate(d.date)}</span>
                      {formatMinutes(d.practiceSeconds)} min · {d.sessions} session{d.sessions === 1 ? "" : "s"}
                      {d.isSample && <span className="block text-white/70">Sample history</span>}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-brand-500" /> Your tracked practice
        </span>
        {hasSample && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-brand-300" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.55) 0 2px, transparent 2px 6px)" }} /> Sample history (demo account)
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-success-500" /> Daily goal
        </span>
      </div>
    </div>
  );
}

const STEPS = [
  { max: 0, cls: "bg-surface-muted", label: "No practice" },
  { max: 119, cls: "bg-brand-200", label: "Under 2 min" },
  { max: 299, cls: "bg-brand-300", label: "2–5 min" },
  { max: 599, cls: "bg-brand-500", label: "5–10 min" },
  { max: Infinity, cls: "bg-brand-700", label: "10+ min" },
];

function stepFor(seconds: number) {
  return STEPS.find((s) => seconds <= s.max) ?? STEPS[STEPS.length - 1];
}

/** Six-week activity calendar. One hue, light to dark; sample days get a dashed outline. */
export function ActivityCalendar({ days, today }: { days: DayPoint[]; today: string }) {
  const [hover, setHover] = useState<DayPoint | null>(null);
  // Align to weeks starting on Monday.
  const last = days.slice(-42);
  const firstDow = (new Date(`${last[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const padded: (DayPoint | null)[] = [...Array(firstDow).fill(null), ...last];
  const weeks: (DayPoint | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  return (
    <div>
      <div className="flex gap-3">
        <div className="grid grid-rows-7 gap-1 pt-0 text-[11px] text-subtle" aria-hidden>
          {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((d, i) => (
            <span key={i} className="flex h-6 items-center sm:h-7">
              {d}
            </span>
          ))}
        </div>
        <div className="flex gap-1" role="grid" aria-label="Practice activity, last six weeks">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-rows-7 gap-1" role="row">
              {Array.from({ length: 7 }, (_, di) => {
                const d = week[di];
                if (!d) return <span key={di} className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />;
                const step = stepFor(d.practiceSeconds);
                return (
                  <button
                    type="button"
                    role="gridcell"
                    key={di}
                    aria-label={dayLabel(d)}
                    onMouseEnter={() => setHover(d)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(d)}
                    onBlur={() => setHover(null)}
                    className={cn(
                      "h-6 w-6 rounded-[5px] sm:h-7 sm:w-7",
                      step.cls,
                      d.isSample && d.practiceSeconds > 0 && "outline-2 -outline-offset-2 outline-white/70 outline-dashed",
                      d.date === today && "ring-2 ring-streak-500 ring-offset-1",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 min-h-5 text-sm text-ink-soft" aria-live="polite">
        {hover ? dayLabel(hover) : "Hover or focus a day to see details."}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
        {STEPS.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded-sm", s.cls)} /> {s.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm ring-2 ring-streak-500" /> Today
        </span>
      </div>
    </div>
  );
}
