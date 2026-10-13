import type { ChartSpec } from '@fluentpath/shared';

const COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)'];

function Legend({ names }: { names: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
      {names.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
          {n}
        </span>
      ))}
    </div>
  );
}

function niceMax(v: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
  return Math.ceil(v / pow) * pow;
}

function BarLine({ spec }: { spec: ChartSpec }) {
  const cats = spec.categories ?? [];
  const series = spec.series ?? [];
  const max = niceMax(Math.max(...series.flatMap((s) => s.values), 1));
  const W = 560, H = 280, L = 44, B = 30, T = 10, R = 10;
  const pw = W - L - R, ph = H - T - B;
  const y = (v: number) => T + ph - (v / max) * ph;
  const ticks = Array.from({ length: 6 }, (_, i) => (max / 5) * i);
  const group = pw / Math.max(cats.length, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={spec.title}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-slate-200 dark:stroke-slate-700" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">{Math.round(t)}</text>
        </g>
      ))}
      {cats.map((c, ci) => (
        <text key={c} x={L + group * ci + group / 2} y={H - 10} textAnchor="middle" className="fill-slate-600 text-[11px] dark:fill-slate-300">{c}</text>
      ))}
      {spec.kind === 'bar'
        ? series.map((s, si) => {
            const bw = (group * 0.75) / series.length;
            return s.values.map((v, ci) => (
              <rect key={`${si}-${ci}`} x={L + group * ci + group * 0.125 + bw * si} y={y(v)} width={bw - 2} height={T + ph - y(v)} fill={COLORS[si % COLORS.length]} rx={2}>
                <title>{`${s.name}, ${cats[ci]}: ${v}${spec.unit === '%' ? '%' : ''}`}</title>
              </rect>
            ));
          })
        : series.map((s, si) => (
            <g key={s.name}>
              <polyline fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth={2.5} points={s.values.map((v, ci) => `${L + group * ci + group / 2},${y(v)}`).join(' ')} />
              {s.values.map((v, ci) => (
                <circle key={ci} cx={L + group * ci + group / 2} cy={y(v)} r={3.5} fill={COLORS[si % COLORS.length]}>
                  <title>{`${s.name}, ${cats[ci]}: ${v}`}</title>
                </circle>
              ))}
            </g>
          ))}
    </svg>
  );
}

function Pies({ spec }: { spec: ChartSpec }) {
  const cats = spec.categories ?? [];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(spec.series ?? []).map((s) => {
        const total = s.values.reduce((a, b) => a + b, 0) || 1;
        let angle = -Math.PI / 2;
        return (
          <figure key={s.name} className="text-center">
            <svg viewBox="-110 -110 220 220" className="mx-auto w-48" role="img" aria-label={`${spec.title} ${s.name}`}>
              {s.values.map((v, i) => {
                const a0 = angle;
                const a1 = angle + (v / total) * Math.PI * 2;
                angle = a1;
                const large = a1 - a0 > Math.PI ? 1 : 0;
                const mid = (a0 + a1) / 2;
                const d = `M0 0 L${100 * Math.cos(a0)} ${100 * Math.sin(a0)} A100 100 0 ${large} 1 ${100 * Math.cos(a1)} ${100 * Math.sin(a1)} Z`;
                return (
                  <g key={i}>
                    <path d={d} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={1}><title>{`${cats[i]}: ${v}%`}</title></path>
                    {v >= 5 && <text x={62 * Math.cos(mid)} y={62 * Math.sin(mid) + 4} textAnchor="middle" className="fill-white text-[12px] font-semibold">{v}%</text>}
                  </g>
                );
              })}
            </svg>
            <figcaption className="mt-1 text-sm font-semibold">{s.name}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function MapView({ title, features }: { title: string; features: NonNullable<ChartSpec['mapBefore']> }) {
  return (
    <figure>
      <svg viewBox="0 0 100 100" className="w-full rounded-lg border border-slate-200 bg-emerald-50/40 dark:border-slate-700 dark:bg-slate-800" role="img" aria-label={title}>
        {features.map((f, i) => (
          <g key={i}>
            <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={1.5} className={/road|street/i.test(f.label) ? 'fill-slate-300 dark:fill-slate-600' : /park/i.test(f.label) ? 'fill-emerald-200 dark:fill-emerald-800' : 'fill-white dark:fill-slate-700'} stroke="#64748b" strokeWidth={0.4} />
            <text x={f.x + f.w / 2} y={f.y + f.h / 2 + 1.2} textAnchor="middle" className="fill-slate-800 text-[3.4px] dark:fill-slate-100">{f.label}</text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 text-center text-sm font-semibold">{title}</figcaption>
    </figure>
  );
}

export function Chart({ spec }: { spec: ChartSpec }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-3 text-center text-sm font-semibold">{spec.title}</h3>
      {(spec.kind === 'bar' || spec.kind === 'line') && (
        <>
          <BarLine spec={spec} />
          <Legend names={(spec.series ?? []).map((s) => s.name)} />
        </>
      )}
      {spec.kind === 'pie' && (
        <>
          <Pies spec={spec} />
          <Legend names={spec.categories ?? []} />
        </>
      )}
      {spec.kind === 'table' && spec.rows && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>{spec.rows[0].map((h) => <th key={h} className="border-b border-slate-300 px-3 py-2 text-left font-semibold dark:border-slate-600">{h}</th>)}</tr>
            </thead>
            <tbody>
              {spec.rows.slice(1).map((r, i) => (
                <tr key={i} className="odd:bg-slate-50 dark:odd:bg-slate-800/50">{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {spec.kind === 'process' && spec.steps && (
        <ol className="flex flex-col items-stretch gap-2">
          {spec.steps.map((s, i) => (
            <li key={i} className="flex flex-col items-center">
              <div className="w-full rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-center text-sm dark:border-brand-800 dark:bg-brand-900/30">
                <span className="mr-2 font-bold text-brand-700 dark:text-brand-300">{i + 1}</span>
                {s}
              </div>
              {i < spec.steps!.length - 1 && <span className="text-brand-500" aria-hidden>↓</span>}
            </li>
          ))}
        </ol>
      )}
      {spec.kind === 'map' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {spec.mapBefore && <MapView title="Before" features={spec.mapBefore} />}
          {spec.mapAfter && <MapView title="Now" features={spec.mapAfter} />}
        </div>
      )}
    </div>
  );
}
