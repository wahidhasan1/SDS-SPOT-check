import type { Point } from '../services/analytics';
import { formatDate } from '../services/dates';

/** Accessible SVG line chart: raw entries (dashed) + optional trend line (solid). */
export function LineChart({ points, trend, unit, label, height = 220 }: { points: Point[]; trend?: Point[]; unit: string; label: string; height?: number }) {
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 14, t: 14, b: 30 };
  if (points.length === 0) return null;
  const all = [...points, ...(trend ?? [])];
  let lo = Math.min(...all.map((p) => p.value));
  let hi = Math.max(...all.map((p) => p.value));
  if (hi - lo < 1) {
    lo -= 1;
    hi += 1;
  }
  const span = hi - lo;
  lo -= span * 0.1;
  hi += span * 0.1;
  const t0 = new Date(points[0].date).getTime();
  const t1 = Math.max(t0 + 86_400_000, new Date(points[points.length - 1].date).getTime());
  const x = (d: string) => pad.l + ((new Date(d).getTime() - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const path = (ps: Point[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const ticks = [lo, lo + (hi - lo) / 2, hi];
  const xTicks = points.length > 1 ? [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]] : [points[0]];
  const summary = `${label}: ${points.length} entries from ${formatDate(points[0].date)} (${points[0].value}${unit}) to ${formatDate(points[points.length - 1].date)} (${points[points.length - 1].value}${unit}).`;
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="grid-line" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text className="axis-label" x={pad.l - 6} y={y(t) + 4} textAnchor="end">
              {Math.round(t * 10) / 10}
            </text>
          </g>
        ))}
        {xTicks.map((p, i) => (
          <text key={i} className="axis-label" x={x(p.date)} y={H - 8} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}>
            {formatDate(p.date, { month: 'short', day: 'numeric' })}
          </text>
        ))}
        {trend && trend.length > 1 && <path className="line-raw" d={path(points)} />}
        <path className="line-main" d={path(trend && trend.length > 1 ? trend : points)} />
        {points.map((p) => (
          <circle key={p.date} className="dot" cx={x(p.date)} cy={y(p.value)} r={3.5}>
            <title>{`${formatDate(p.date)}: ${p.value}${unit}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

export function BarChart({ bars, label, max = 100, unit = '%' }: { bars: Array<{ label: string; value: number; title?: string }>; label: string; max?: number; unit?: string }) {
  const W = 640;
  const H = 180;
  const pad = { l: 10, r: 10, t: 16, b: 28 };
  const bw = (W - pad.l - pad.r) / Math.max(1, bars.length);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${bars.map((b) => `${b.label} ${b.value}${unit}`).join(', ')}`}>
      <line className="grid-line" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
      {bars.map((b, i) => {
        const h = Math.max(3, (Math.min(b.value, max) / max) * (H - pad.t - pad.b));
        const cls = b.value === 0 ? 'bar zero' : b.value < 75 ? 'bar partial' : 'bar';
        return (
          <g key={i}>
            <rect className={cls} x={pad.l + i * bw + bw * 0.18} width={bw * 0.64} y={H - pad.b - h} height={h} rx={6}>
              <title>{b.title ?? `${b.label}: ${b.value}${unit}`}</title>
            </rect>
            <text className="axis-label" x={pad.l + i * bw + bw / 2} y={H - 9} textAnchor="middle">
              {b.label}
            </text>
            <text className="axis-label" x={pad.l + i * bw + bw / 2} y={H - pad.b - h - 5} textAnchor="middle">
              {b.value}
              {unit}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
