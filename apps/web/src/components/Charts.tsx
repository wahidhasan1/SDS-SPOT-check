import { useState, type ReactNode } from 'react';

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

interface Series {
  name: string;
  values: number[];
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="legend" aria-hidden>
      {series.map((s, i) => (
        <span key={s.name}>
          <i style={{ background: SERIES[i % SERIES.length] }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function TableView({ categories, series, unit }: { categories: string[]; series: Series[]; unit?: string }) {
  return (
    <table className="table small">
      <thead>
        <tr>
          <th></th>
          {series.map((s) => <th key={s.name}>{s.name}</th>)}
        </tr>
      </thead>
      <tbody>
        {categories.map((c, ci) => (
          <tr key={c}>
            <td>{c}</td>
            {series.map((s) => <td key={s.name}>{s.values[ci]}{unit === '%' ? '%' : ''}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartFrame({ title, children, table }: { title?: string; children: ReactNode; table: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="viz" style={{ margin: 0, position: 'relative' }}>
      <div className="row between" style={{ marginBottom: 6 }}>
        {title ? <figcaption style={{ fontWeight: 700 }}>{title}</figcaption> : <span />}
        <button className="btn ghost sm" onClick={() => setAsTable((t) => !t)}>{asTable ? 'Show chart' : 'Show as table'}</button>
      </div>
      {asTable ? table : children}
    </figure>
  );
}

export function GroupedBarChart({ categories, series, unit, max }: { categories: string[]; series: Series[]; unit?: string; max?: number }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const W = 520, H = 280, L = 48, B = 34, T = 14, R = 8;
  const top = max ?? niceMax(Math.max(...series.flatMap((s) => s.values)));
  const plotW = W - L - R, plotH = H - T - B;
  const groupW = plotW / categories.length;
  const barW = Math.min(28, (groupW * 0.72) / series.length - 2);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const y = (v: number) => T + plotH - (v / top) * plotH;
  return (
    <ChartFrame table={<TableView categories={categories} series={series} unit={unit} />}>
      <Legend series={series} />
      <div style={{ position: 'relative' }} onMouseLeave={() => setTip(null)}>
        <svg className="big" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Bar chart: ${series.map((s) => s.name).join(', ')} across ${categories.join(', ')}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text className="tick" x={L - 6} y={y(t) + 4} textAnchor="end">{Math.round(t)}{unit === '%' ? '%' : ''}</text>
            </g>
          ))}
          {categories.map((c, ci) => {
            const gx = L + ci * groupW + (groupW - series.length * (barW + 2)) / 2;
            return (
              <g key={c}>
                {series.map((s, si) => {
                  const v = s.values[ci];
                  const x = gx + si * (barW + 2);
                  const h = Math.max(1, (v / top) * plotH);
                  return (
                    <g key={s.name}>
                      <path
                        className="mark"
                        d={`M${x},${T + plotH} v${-(h - 4)} q0,-4 4,-4 h${barW - 8} q4,0 4,4 v${h - 4} z`}
                        fill={SERIES[si % SERIES.length]}
                      />
                      <rect
                        className="hit"
                        x={x - 1}
                        y={T}
                        width={barW + 2}
                        height={plotH}
                        onMouseMove={(e) => {
                          const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                          setTip({ x: e.clientX - r.left + 12, y: e.clientY - r.top - 10, text: `${c} · ${s.name}: ${v}${unit === '%' ? '%' : ` ${unit ?? ''}`}` });
                        }}
                      />
                    </g>
                  );
                })}
                <text className="tick" x={L + ci * groupW + groupW / 2} y={H - 12} textAnchor="middle">{c}</text>
              </g>
            );
          })}
          <line x1={L} x2={W - R} y1={T + plotH} y2={T + plotH} stroke="var(--axis)" strokeWidth={1} />
        </svg>
        {tip && <div className="viz-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
      </div>
      {unit && unit !== '%' && <div className="tiny muted">Values in {unit}</div>}
    </ChartFrame>
  );
}

export function LineChart({ categories, series, unit, max }: { categories: string[]; series: Series[]; unit?: string; max?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520, H = 280, L = 48, B = 34, T = 14, R = 120;
  const top = max ?? niceMax(Math.max(...series.flatMap((s) => s.values)));
  const plotW = W - L - R, plotH = H - T - B;
  const x = (i: number) => L + (categories.length === 1 ? plotW / 2 : (i / (categories.length - 1)) * plotW);
  const y = (v: number) => T + plotH - (v / top) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  return (
    <ChartFrame table={<TableView categories={categories} series={series} unit={unit} />}>
      <Legend series={series} />
      <div style={{ position: 'relative' }}>
        <svg
          className="big"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Line chart: ${series.map((s) => s.name).join(', ')}`}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            const i = Math.round(((px - L) / plotW) * (categories.length - 1));
            setHover(i >= 0 && i < categories.length ? i : null);
          }}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={L + plotW} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text className="tick" x={L - 6} y={y(t) + 4} textAnchor="end">{Math.round(t)}</text>
            </g>
          ))}
          {categories.map((c, i) => (
            <text key={c} className="tick" x={x(i)} y={H - 12} textAnchor="middle">{c}</text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + plotH} stroke="var(--axis)" strokeDasharray="3 3" />}
          {series.map((s, si) => {
            const color = SERIES[si % SERIES.length];
            const last = s.values.length - 1;
            return (
              <g key={s.name}>
                <polyline fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
                {s.values.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={color} stroke="var(--surface)" strokeWidth={2} />
                ))}
                <text className="lbl" x={x(last) + 8} y={y(s.values[last]) + 4}>{s.name}</text>
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div className="viz-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: 0, transform: 'translateX(8px)' }}>
            <b>{categories[hover]}</b>
            {series.map((s) => <div key={s.name}>{s.name}: {s.values[hover]}</div>)}
          </div>
        )}
      </div>
      {unit && <div className="tiny muted">Values in {unit}</div>}
    </ChartFrame>
  );
}

export function ProcessDiagram({ steps }: { steps: { label: string; detail: string }[] }) {
  return (
    <div className="process" role="list" aria-label="Process stages">
      {steps.map((s, i) => (
        <div key={s.label} style={{ display: 'contents' }}>
          <div className="step" role="listitem">
            <div className="n">Stage {i + 1}</div>
            <div style={{ fontWeight: 700 }}>{s.label}</div>
            <div className="small muted">{s.detail}</div>
          </div>
          {i < steps.length - 1 && <div className="arrow" aria-hidden>→</div>}
        </div>
      ))}
    </div>
  );
}

export function MapsVisual({ maps }: { maps: { title: string; items: { label: string; x: number; y: number; w: number; h: number; road?: boolean }[] }[] }) {
  return (
    <div className="grid cols-2">
      {maps.map((m) => (
        <figure key={m.title} style={{ margin: 0 }}>
          <figcaption style={{ fontWeight: 700, marginBottom: 4 }}>{m.title}</figcaption>
          <svg viewBox="0 0 100 100" style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)' }} role="img" aria-label={`Map ${m.title}: ${m.items.map((i) => i.label).join(', ')}`}>
            {m.items.map((it) => (
              <g key={it.label}>
                <rect x={it.x} y={it.y} width={it.w} height={it.h} rx={it.road ? 0 : 2} fill={it.road ? 'var(--axis)' : 'var(--surface)'} stroke="var(--border)" strokeWidth={0.4} />
                <text x={it.x + it.w / 2} y={it.road ? it.y - 1 : it.y + it.h / 2 + 1.2} textAnchor="middle" style={{ fontSize: 3.2, fill: 'var(--text)' }}>{it.label}</text>
              </g>
            ))}
          </svg>
        </figure>
      ))}
    </div>
  );
}

export function SimpleTable({ headers, rows, note }: { headers: string[]; rows: string[][]; note?: string }) {
  return (
    <div>
      <table className="table">
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
      {note && <div className="tiny muted mt">{note}</div>}
    </div>
  );
}

export function WritingVisual({ visual }: { visual: any }) {
  if (!visual) return null;
  switch (visual.type) {
    case 'bar':
      return <GroupedBarChart categories={visual.categories} series={visual.series} unit={visual.unit} max={visual.max} />;
    case 'line':
      return <LineChart categories={visual.categories} series={visual.series} unit={visual.unit} max={visual.max} />;
    case 'table':
      return <SimpleTable headers={visual.headers} rows={visual.rows} note={visual.note} />;
    case 'process':
      return <ProcessDiagram steps={visual.steps} />;
    case 'maps':
      return <MapsVisual maps={visual.maps} />;
    default:
      return null;
  }
}

/** Single-series daily activity bars (no legend needed; the title names the series). */
export function ActivityBars({ data }: { data: { day: string; activities: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.activities));
  const W = 320, H = 120, B = 22, T = 16;
  const bw = W / data.length;
  return (
    <figure className="viz" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Activities per day: ${data.map((d) => `${d.day} ${d.activities}`).join(', ')}`}>
        <line x1={0} x2={W} y1={H - B} y2={H - B} stroke="var(--axis)" />
        {data.map((d, i) => {
          const h = d.activities ? Math.max(4, ((H - B - T) * d.activities) / max) : 0;
          const x = i * bw + bw * 0.22;
          const w = bw * 0.56;
          const label = new Date(d.day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
          return (
            <g key={d.day}>
              <title>{`${label}: ${d.activities} activit${d.activities === 1 ? 'y' : 'ies'}`}</title>
              {h > 0 && <path d={`M${x},${H - B} v${-(h - 4)} q0,-4 4,-4 h${w - 8} q4,0 4,4 v${h - 4} z`} fill="var(--series-1)" />}
              {d.activities > 0 && <text className="lbl" x={x + w / 2} y={H - B - h - 4} textAnchor="middle">{d.activities}</text>}
              <text className="tick" x={x + w / 2} y={H - 6} textAnchor="middle">{label}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Band meter: value on the 0–9 IELTS scale with an optional target marker. */
export function BandMeter({ label, band, target, sub }: { label: string; band: number | null; target?: number | null; sub?: string }) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row between small">
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span>{band != null ? <b>{band.toFixed(1)}</b> : <span className="muted">Not scored yet</span>}{target ? <span className="muted"> / target {target}</span> : null}</span>
      </div>
      <div style={{ position: 'relative' }}>
        <div className="progress" aria-hidden><div style={{ width: `${((band ?? 0) / 9) * 100}%`, background: 'var(--primary)' }} /></div>
        {target ? <div title={`Target ${target}`} style={{ position: 'absolute', top: -3, left: `calc(${(target / 9) * 100}% - 1px)`, width: 2, height: 14, background: 'var(--text)' }} /> : null}
      </div>
      {sub && <div className="tiny muted">{sub}</div>}
    </div>
  );
}
