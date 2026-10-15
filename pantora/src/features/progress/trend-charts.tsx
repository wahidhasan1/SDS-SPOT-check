"use client";

import { useState } from "react";
import type { ScorePoint, WeekBucket } from "@/server/queries";
import { cn } from "@/lib/cn";

const SAMPLE_HATCH = "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.6) 0 2px, transparent 2px 6px)";

function shortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

/**
 * Battle total scores over time. Measured results are solid dots; preloaded
 * sample history is drawn hollow with a dashed line so the two never blur together.
 */
export function ScoreLineChart({ points }: { points: ScorePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const pad = { l: 34, r: 14, t: 14, b: 26 };
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const segments = points.slice(1).map((p, i) => ({ from: points[i], to: p, i }));
  const hasSample = points.some((p) => p.sample);
  const hp = hover != null ? points[hover] : null;
  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Battle scores over time: ${points.map((p) => `${p.total}${p.sample ? " (sample)" : ""}`).join(", ")}`}>
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-subtle)">
                {t}
              </text>
            </g>
          ))}
          {segments.map((s) => (
            <line
              key={s.i}
              x1={x(s.i)}
              y1={y(s.from.total)}
              x2={x(s.i + 1)}
              y2={y(s.to.total)}
              stroke="var(--color-brand-500)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={s.from.sample || s.to.sample ? "6 6" : undefined}
              opacity={s.from.sample || s.to.sample ? 0.55 : 1}
            />
          ))}
          {points.map((p, i) => (
            <g key={p.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={x(i)} cy={y(p.total)} r="14" fill="transparent" />
              <circle
                cx={x(i)}
                cy={y(p.total)}
                r={hover === i ? 7 : 5.5}
                fill={p.sample ? "var(--color-surface)" : "var(--color-brand-500)"}
                stroke="var(--color-brand-500)"
                strokeWidth="2.5"
              />
            </g>
          ))}
          {points.length > 0 && (
            <>
              <text x={x(0)} y={H - 6} fontSize="11" fill="var(--color-subtle)" textAnchor="start">
                {shortDate(points[0].date)}
              </text>
              <text x={x(points.length - 1)} y={H - 6} fontSize="11" fill="var(--color-subtle)" textAnchor="end">
                {shortDate(points[points.length - 1].date)}
              </text>
            </>
          )}
        </svg>
        {hp && hover != null && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-xl bg-navy-900 px-3 py-2 text-xs text-white shadow-pop"
            style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(hp.total) / H) * 100}%`, marginTop: -12 }}
          >
            <p className="font-bold">
              {hp.total}/100 · {shortDate(hp.date)}
            </p>
            <p className="truncate text-white/75">{hp.prompt}</p>
            {hp.sample && <p className="text-sun-300">Sample history</p>}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-brand-500" /> Your scored battles
        </span>
        {hasSample && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-brand-500 bg-surface" /> Sample history (demo account)
          </span>
        )}
      </div>
    </div>
  );
}

/** Tiny trend line for one rubric dimension. */
export function Sparkline({ values, max, color = "var(--color-brand-500)", label }: { values: { v: number; sample: boolean }[]; max: number; color?: string; label: string }) {
  const W = 120;
  const H = 36;
  if (values.length === 0) return null;
  const x = (i: number) => (values.length === 1 ? W / 2 : 3 + (i / (values.length - 1)) * (W - 6));
  const y = (v: number) => 3 + (1 - v / max) * (H - 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-30" role="img" aria-label={label}>
      <polyline points={values.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
      {values.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.v)} r="2.6" fill={p.sample ? "#fff" : color} stroke={color} strokeWidth="1.6" />
      ))}
    </svg>
  );
}

const SERIES = [
  { key: "freeTalk", label: "Free Talk", cls: "bg-sky-500" },
  { key: "battles", label: "Battles", cls: "bg-pink-500" },
  { key: "coach", label: "AI Coach", cls: "bg-mint-500" },
] as const;

/** Completed sessions per week, stacked by activity type. */
export function WeeklyStack({ weeks, currentWeek }: { weeks: WeekBucket[]; currentWeek: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = weeks.map((w) => w.freeTalk + w.battles + w.coach);
  const top = Math.max(4, ...totals);
  return (
    <div>
      <div className="flex h-44 items-end gap-2 sm:gap-3">
        {weeks.map((w, i) => {
          const total = totals[i];
          return (
            <button
              type="button"
              key={w.weekStart}
              className="relative flex h-full flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`Week of ${shortDate(`${w.weekStart}T12:00:00Z`)}: ${w.freeTalk} Free Talk, ${w.battles} battles, ${w.coach} coach${w.hasSample ? " (includes sample history)" : ""}`}
            >
              {hover === i && (
                <span className="pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-lg bg-navy-900 px-2.5 py-1.5 text-left text-xs text-white shadow-pop">
                  <span className="block font-bold">Week of {shortDate(`${w.weekStart}T12:00:00Z`)}</span>
                  {w.freeTalk} talk · {w.battles} battles · {w.coach} coach
                  <span className="block text-white/70">{Math.round(w.minutes)} speaking min</span>
                  {w.hasSample && <span className="block text-sun-300">Includes sample history</span>}
                </span>
              )}
              <span
                className={cn("flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-xl transition-opacity", hover != null && hover !== i && "opacity-50", w.hasSample && "outline-2 outline-offset-2 outline-line-strong outline-dashed")}
                style={{ height: `${(total / top) * 100}%`, minHeight: total ? 6 : 0 }}
              >
                {SERIES.map((s) =>
                  w[s.key] ? <span key={s.key} className={cn("block w-full", s.cls)} style={{ flexGrow: w[s.key], backgroundImage: w.hasSample ? SAMPLE_HATCH : undefined }} /> : null,
                )}
              </span>
              <span className={cn("mt-1.5 text-[11px] font-semibold", w.weekStart === currentWeek ? "text-ink" : "text-subtle")}>
                {w.weekStart === currentWeek ? "This wk" : shortDate(`${w.weekStart}T12:00:00Z`)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded-sm", s.cls)} /> {s.label}
          </span>
        ))}
        {weeks.some((w) => w.hasSample) && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-brand-300" style={{ backgroundImage: SAMPLE_HATCH }} /> Hatched: includes sample history
          </span>
        )}
      </div>
    </div>
  );
}

/** Win / draw / loss ring. */
export function WinDonut({ wins, draws, losses }: { wins: number; draws: number; losses: number }) {
  const total = wins + draws + losses;
  const r = 42;
  const c = 2 * Math.PI * r;
  const parts = [
    { n: wins, color: "var(--color-mint-500)" },
    { n: draws, color: "var(--color-sky-400)" },
    { n: losses, color: "var(--color-line-strong)" },
  ];
  let offset = 0;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${wins} wins, ${draws} draws, ${losses} losses`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-surface-muted)" strokeWidth="12" />
        {total > 0 &&
          parts.map((p, i) => {
            const len = (p.n / total) * c;
            const el = <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={p.color} strokeWidth="12" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-extrabold">{total ? `${Math.round((wins / total) * 100)}%` : "–"}</span>
        <span className="text-[11px] font-bold text-muted">win rate</span>
      </div>
    </div>
  );
}
