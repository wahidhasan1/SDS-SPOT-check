import { useState } from 'react';

/** Rounded-top bar path anchored to the baseline (4px data-end radius). */
function barPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

/** left/top are percentages of the chart box. */
function Tooltip({ left, top, children }: { left: number; top: number; children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute z-10 -mt-2 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg dark:bg-slate-100 dark:text-slate-900" style={{ left: `${left}%`, top: `${top}%` }}>
      {children}
    </div>
  );
}

function shortDay(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
}

/** Single-series bar chart of study minutes per day. */
export function DailyBars({ data, goal }: { data: { day: string; minutes: number; xp: number }[]; goal?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 560, H = 160, L = 28, B = 22, T = 8;
  const max = Math.max(goal ?? 0, ...data.map((d) => d.minutes), 10);
  const top = Math.ceil(max / 10) * 10;
  const pw = W - L, ph = H - T - B;
  const slot = pw / data.length;
  const bw = slot - 2 - slot * 0.3; // 2px surface gap + breathing room
  const y = (v: number) => T + ph - (v / top) * ph;
  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Study minutes per day for the last 14 days">
          {[0, top / 2, top].map((t) => (
            <g key={t}>
              <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={L - 6} y={y(t) + 3.5} textAnchor="end" className="fill-slate-500 text-[10px] dark:fill-slate-400">{t}</text>
            </g>
          ))}
          {goal ? <line x1={L} x2={W} y1={y(goal)} y2={y(goal)} stroke="currentColor" strokeDasharray="4 4" className="text-slate-400" strokeWidth={1} /> : null}
          {data.map((d, i) => {
            const x = L + slot * i + (slot - bw) / 2;
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${d.day}: ${d.minutes} minutes`}>
                <rect x={L + slot * i} y={T} width={slot} height={ph} fill="transparent" />
                <path d={barPath(x, y(d.minutes), bw, T + ph - y(d.minutes))} fill="var(--series-1)" opacity={hover == null || hover === i ? 1 : 0.55} />
                <text x={L + slot * i + slot / 2} y={H - 6} textAnchor="middle" className={`text-[10px] ${i === data.length - 1 ? 'fill-slate-900 font-semibold dark:fill-white' : 'fill-slate-500 dark:fill-slate-400'}`}>{shortDay(d.day)}</text>
              </g>
            );
          })}
        </svg>
        {hover != null && (
          <Tooltip left={((L + slot * hover + slot / 2) / W) * 100} top={(y(data[hover].minutes) / H) * 100}>
            <div className="font-semibold">{new Date(`${data[hover].day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            <div>{data[hover].minutes} min · {data[hover].xp} XP</div>
          </Tooltip>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="muted">{goal ? `Dashed line: daily goal (${goal} min)` : ''}</span>
        <button className="text-brand-700 hover:underline dark:text-brand-300" onClick={() => setTable((t) => !t)}>{table ? 'Hide table' : 'Show as table'}</button>
      </div>
      {table && (
        <table className="mt-2 w-full text-xs">
          <thead><tr className="text-left"><th className="py-1">Day</th><th>Minutes</th><th>XP</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.day} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1">{d.day}</td><td>{d.minutes}</td><td>{d.xp}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

const MODULE_COLOR: Record<string, string> = { reading: 'var(--series-1)', listening: 'var(--series-2)', writing: 'var(--series-3)' };

/** Band estimates over time, one line per module (max three series). */
export function BandTrend({ points }: { points: { module: string; band: number; at: string }[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; p: { module: string; band: number; at: string } } | null>(null);
  const [table, setTable] = useState(false);
  const modules = Object.keys(MODULE_COLOR).filter((m) => points.some((p) => p.module === m));
  const W = 560, H = 200, L = 28, R = 70, T = 10, B = 20;
  const times = points.map((p) => new Date(p.at).getTime());
  const t0 = Math.min(...times), t1 = Math.max(...times);
  const x = (t: number) => L + (t1 === t0 ? (W - L - R) / 2 : ((t - t0) / (t1 - t0)) * (W - L - R));
  const y = (b: number) => T + (H - T - B) - (b / 9) * (H - T - B);
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-xs" aria-label="Legend">
        {modules.map((m) => <span key={m} className="flex items-center gap-1.5 capitalize"><span className="h-0.5 w-4 rounded" style={{ background: MODULE_COLOR[m], height: 2 }} />{m}</span>)}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Estimated band over time by module">
          {[0, 3, 6, 9].map((b) => (
            <g key={b}>
              <line x1={L} x2={W - R} y1={y(b)} y2={y(b)} stroke="var(--viz-grid)" />
              <text x={L - 6} y={y(b) + 3.5} textAnchor="end" className="fill-slate-500 text-[10px]">{b}</text>
            </g>
          ))}
          {modules.map((m) => {
            const ps = points.filter((p) => p.module === m);
            const last = ps[ps.length - 1];
            return (
              <g key={m}>
                <polyline fill="none" stroke={MODULE_COLOR[m]} strokeWidth={2} points={ps.map((p) => `${x(new Date(p.at).getTime())},${y(p.band)}`).join(' ')} />
                {ps.map((p, i) => {
                  const cx = x(new Date(p.at).getTime()), cy = y(p.band);
                  return (
                    <g key={i} onMouseEnter={() => setHover({ x: cx, y: cy, p })} onMouseLeave={() => setHover(null)}>
                      <circle cx={cx} cy={cy} r={12} fill="transparent" />
                      <circle cx={cx} cy={cy} r={4.5} fill={MODULE_COLOR[m]} stroke="var(--viz-surface)" strokeWidth={2} />
                    </g>
                  );
                })}
                <text x={x(new Date(last.at).getTime()) + 9} y={y(last.band) + 4} className="fill-slate-700 text-[11px] capitalize dark:fill-slate-200">{m} {last.band}</text>
              </g>
            );
          })}
        </svg>
        {hover && (
          <Tooltip left={(hover.x / W) * 100} top={(hover.y / H) * 100}>
            <div className="font-semibold capitalize">{hover.p.module}: band ≈ {hover.p.band}</div>
            <div>{new Date(hover.p.at).toLocaleDateString()}</div>
          </Tooltip>
        )}
      </div>
      <div className="mt-1 text-right text-xs"><button className="text-brand-700 hover:underline dark:text-brand-300" onClick={() => setTable((t) => !t)}>{table ? 'Hide table' : 'Show as table'}</button></div>
      {table && (
        <table className="mt-2 w-full text-xs">
          <thead><tr className="text-left"><th className="py-1">Date</th><th>Module</th><th>Band (est.)</th></tr></thead>
          <tbody>{points.map((p, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1">{new Date(p.at).toLocaleDateString()}</td><td className="capitalize">{p.module}</td><td>{p.band}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

/** Horizontal single-series bars, sorted, value labels in text ink. */
export function AccuracyBars({ rows }: { rows: { label: string; correct: number; total: number }[] }) {
  const sorted = [...rows].sort((a, b) => a.correct / a.total - b.correct / b.total);
  return (
    <ul className="space-y-2.5">
      {sorted.map((r) => {
        const pct = Math.round((r.correct / r.total) * 100);
        return (
          <li key={r.label} title={`${r.label}: ${r.correct} of ${r.total} correct`}>
            <div className="mb-1 flex justify-between text-sm"><span>{r.label}</span><span className="muted">{pct}% <span className="text-xs">({r.correct}/{r.total})</span></span></div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full" style={{ width: `${pct}%`, background: 'var(--series-1)' }} /></div>
          </li>
        );
      })}
    </ul>
  );
}
