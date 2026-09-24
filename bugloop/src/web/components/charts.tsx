// Hand-drawn SVG/HTML charts. Thin marks, 2px lines, hairline grid, text in text tokens, a hover
// layer on every plot, and a legend whenever there is more than one series. Series colours come
// from the validated --series-N tokens, assigned by entity (never by rank).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);

/** Width of an element, kept current with a ResizeObserver. A callback ref, so it follows the element if it is replaced. */
function useWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [w, setW] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    observer.current = ro;
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  return [ref, w];
}

/** Round a maximum up to a readable axis end and return evenly spaced ticks. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const s = step < 1 ? 1 : step;
  const top = Math.ceil(max / s) * s;
  const out: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += s) out.push(Math.round(v * 100) / 100);
  return out;
}

// ---------------------------------------------------------------------------
// Line chart
// ---------------------------------------------------------------------------

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  values: number[];
}

export function LineChart({
  x,
  xFormat,
  series,
  height = 240,
  focus,
  onFocus,
  directLabels,
  valueLabel = (v: number) => String(v),
  tooltipTitle,
  ariaLabel,
  empty = "Nothing to show for this period yet.",
}: {
  x: string[];
  xFormat: (x: string) => string;
  series: LineSeries[];
  height?: number;
  focus?: string | null;
  onFocus?: (id: string | null) => void;
  directLabels?: boolean;
  valueLabel?: (v: number) => string;
  tooltipTitle?: (i: number) => string;
  ariaLabel: string;
  empty?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const labelled = directLabels ?? series.length <= 4;
  const m = { top: 12, right: labelled ? 104 : 14, bottom: 26, left: 36 };
  const w = Math.max(width, 280);
  const iw = w - m.left - m.right;
  const ih = height - m.top - m.bottom;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const n = x.length;
  const px = (i: number) => m.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const py = (v: number) => m.top + ih - (v / top) * ih;
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))));

  // Direct labels at the line ends, nudged apart so they never collide.
  const ends = useMemo(() => {
    if (!labelled) return [];
    const items = series.map((s) => ({ id: s.id, label: s.label, color: s.color, y: py(s.values[n - 1] ?? 0), v: s.values[n - 1] ?? 0 }));
    items.sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < 15) items[i].y = items[i - 1].y + 15;
    const overflow = items.length ? items[items.length - 1].y - (m.top + ih) : 0;
    if (overflow > 0) items.forEach((it) => (it.y -= overflow));
    return items;
  }, [series, labelled, n, ih, top]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const rel = e.clientX - rect.left - m.left;
    const i = n <= 1 ? 0 : Math.round((rel / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const dim = (id: string) => focus && focus !== id;
  const ordered = focus ? [...series.filter((s) => s.id !== focus), ...series.filter((s) => s.id === focus)] : series;

  if (!series.some((s) => s.values.some((v) => v > 0))) {
    return (
      <div className="chart chart-empty" style={{ height }} ref={ref}>
        {empty}
      </div>
    );
  }

  return (
    <div ref={ref} className="chart" style={{ height }}>
      {width > 0 && (
        <svg width={w} height={height} role="img" aria-label={ariaLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={m.left + iw} y1={py(t)} y2={py(t)} className="grid" />
              <text x={m.left - 8} y={py(t)} className="axis-label" textAnchor="end" dominantBaseline="middle">
                {valueLabel(t)}
              </text>
            </g>
          ))}
          {x.map((label, i) =>
            i % every === 0 || i === n - 1 ? (
              <text key={label} x={px(i)} y={height - 8} className="axis-label" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
                {xFormat(label)}
              </text>
            ) : null,
          )}
          {hover !== null && <line x1={px(hover)} x2={px(hover)} y1={m.top} y2={m.top + ih} className="crosshair" />}
          {ordered.map((s) => (
            <path
              key={s.id}
              d={s.values.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join("")}
              fill="none"
              stroke={s.color}
              strokeWidth={focus === s.id ? 2.5 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={dim(s.id) ? 0.18 : 1}
              style={{ cursor: onFocus ? "pointer" : undefined }}
            />
          ))}
          {hover !== null &&
            ordered.map((s) =>
              dim(s.id) ? null : <circle key={s.id} cx={px(hover)} cy={py(s.values[hover] ?? 0)} r={4} fill={s.color} className="marker" />,
            )}
          {ends.map((e) => (
            <g key={e.id} opacity={dim(e.id) ? 0.35 : 1} onClick={() => onFocus?.(focus === e.id ? null : e.id)} style={{ cursor: onFocus ? "pointer" : undefined }}>
              <line x1={m.left + iw + 6} x2={m.left + iw + 14} y1={e.y} y2={e.y} stroke={e.color} strokeWidth={2} strokeLinecap="round" />
              <text x={m.left + iw + 18} y={e.y} className="end-label" dominantBaseline="middle">
                {truncateLabel(e.label, 11)} <tspan className="end-value">{valueLabel(e.v)}</tspan>
              </text>
            </g>
          ))}
          <rect x={m.left} y={m.top} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div className="tooltip chart-tip" style={tipPosition(px(hover), w, m.top)}>
          <div className="tip-title">{tooltipTitle ? tooltipTitle(hover) : xFormat(x[hover])}</div>
          {[...series]
            .filter((s) => !dim(s.id))
            .sort((a, b) => (b.values[hover] ?? 0) - (a.values[hover] ?? 0))
            .map((s) => (
              <div key={s.id} className="tip-row">
                <span className="swatch" style={{ background: s.color }} />
                <span className="grow">{s.label}</span>
                <strong className="num">{valueLabel(s.values[hover] ?? 0)}</strong>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function tipPosition(x: number, width: number, top: number): React.CSSProperties {
  return x > width * 0.6 ? { right: width - x + 12, top } : { left: x + 12, top };
}

function truncateLabel(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function Legend({ items, focus, onFocus }: { items: { id: string; label: string; color: string; note?: string }[]; focus?: string | null; onFocus?: (id: string | null) => void }) {
  return (
    <div className="legend" role={onFocus ? "group" : undefined} aria-label="Legend">
      {items.map((it) => {
        const content = (
          <>
            <span className="swatch line" style={{ background: it.color }} />
            <span>{it.label}</span>
            {it.note && <span className="muted">{it.note}</span>}
          </>
        );
        return onFocus ? (
          <button key={it.id} className={cx("legend-item", focus === it.id && "on", focus && focus !== it.id && "dim")} onClick={() => onFocus(focus === it.id ? null : it.id)} aria-pressed={focus === it.id}>
            {content}
          </button>
        ) : (
          <span key={it.id} className="legend-item">
            {content}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bars (magnitude, one colour) and emphasis bars
// ---------------------------------------------------------------------------

export interface BarItem {
  id: string;
  label: ReactNode;
  value: number;
  display?: string;
  tooltip?: ReactNode;
  onClick?: () => void;
  emphasis?: boolean;
}

export function BarList({
  items,
  color = "var(--series-1)",
  emphasisMode,
  max,
  empty = "Nothing to show.",
  valueWidth = 36,
}: {
  items: BarItem[];
  color?: string;
  emphasisMode?: boolean;
  max?: number;
  empty?: string;
  /** Room kept free at the end of the longest bar for its value label, in px. */
  valueWidth?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const top = Math.max(1, max ?? Math.max(0, ...items.map((i) => i.value)));
  if (!items.length) return <div className="muted small">{empty}</div>;
  return (
    <div className="bars" onPointerLeave={() => setHover(null)}>
      {items.map((it) => {
        const fill = emphasisMode ? (it.emphasis ? "var(--accent)" : "var(--chart-muted)") : color;
        const Tag = it.onClick ? "button" : "div";
        return (
          <Tag key={it.id} className={cx("bar-row", it.onClick && "clickable")} onClick={it.onClick} onPointerEnter={() => setHover(it.id)} onFocus={() => setHover(it.id)} onBlur={() => setHover(null)}>
            <span className="bar-label">{it.label}</span>
            <span className="bar-track">
              <span className="bar" style={{ width: `calc((100% - ${valueWidth}px) * ${Math.max(it.value > 0 ? 0.015 : 0, it.value / top).toFixed(4)})`, background: fill }} />
              <span className="bar-value num">{it.display ?? it.value}</span>
            </span>
            {hover === it.id && it.tooltip && <span className="tooltip bar-tip">{it.tooltip}</span>}
          </Tag>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

export function StatTile({ label, value, unit, note, tone }: { label: ReactNode; value: ReactNode; unit?: string; note?: ReactNode; tone?: "danger" | "warning" | "positive" }) {
  return (
    <div className={cx("stat-tile", tone && `tone-text-${tone}`)}>
      <div className="stat">
        <span className="label">{label}</span>
        <span className="value num">
          {value}
          {unit && <small>{unit}</small>}
        </span>
        {note && <span className="note">{note}</span>}
      </div>
    </div>
  );
}

/** A tiny inline trend with no axes, for tables. */
export function Sparkline({ values, color = "var(--series-1)", width = 88, height = 22 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const n = values.length;
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / Math.max(1, n - 1)) * (width - 4) + 2).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`).join("");
  return (
    <svg width={width} height={height} aria-hidden className="sparkline">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Toggle between a chart and its data table (the accessible view). */
export function ChartOrTable({ chart, table, label }: { chart: ReactNode; table: ReactNode; label: string }) {
  const [mode, setMode] = useState<"chart" | "table">("chart");
  return (
    <div className="stack-sm">
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="link-btn tiny" onClick={() => setMode(mode === "chart" ? "table" : "chart")} aria-label={`Show ${label} as ${mode === "chart" ? "a table" : "a chart"}`}>
          {mode === "chart" ? "Show as table" : "Show as chart"}
        </button>
      </div>
      {mode === "chart" ? chart : <div className="table-wrap">{table}</div>}
    </div>
  );
}
