import { Fragment } from 'react'
import { ArrowDown } from 'lucide-react'

export type ChartSpec =
  | { type: 'line' | 'bar'; unit: string; x: string[]; series: { name: string; values: number[] }[]; yMax: number }
  | { type: 'table'; columns: string[]; rows: string[][]; caption?: string }
  | { type: 'process'; steps: string[] }

const COLORS = ['var(--primary)', 'var(--talk)', 'var(--good)', 'var(--warn)']

/** Renders Task 1 visuals from data, so charts are accessible, themeable and editable in the CMS. */
export function Chart({ spec, title }: { spec: ChartSpec; title: string }) {
  if (spec.type === 'table')
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] border-collapse text-[15px]">
          {spec.caption && <caption className="mb-2 text-left text-sm font-semibold text-muted">{spec.caption}</caption>}
          <thead><tr>{spec.columns.map((c) => <th key={c} className="border border-border bg-surface-2 px-3 py-2 text-left">{c}</th>)}</tr></thead>
          <tbody>{spec.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`border border-border px-3 py-2 ${j ? 'text-right tabular-nums' : ''}`}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    )
  if (spec.type === 'process')
    return (
      <ol className="flex flex-col items-center gap-1" aria-label={title}>
        {spec.steps.map((s, i) => (
          <Fragment key={i}>
            <li className="w-full max-w-sm rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-center text-[15px]"><b className="mr-1.5 text-primary">{i + 1}</b>{s}</li>
            {i < spec.steps.length - 1 && <ArrowDown className="size-4 text-faint" aria-hidden />}
          </Fragment>
        ))}
      </ol>
    )

  const W = 560
  const H = 300
  const pad = { l: 48, r: 16, t: 16, b: 44 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((spec.yMax / 4) * i))
  const y = (v: number) => pad.t + ih - (v / spec.yMax) * ih
  const desc = spec.series.map((s) => `${s.name}: ${s.values.map((v, i) => `${spec.x[i]} ${v}${spec.unit === '%' ? '%' : ` ${spec.unit}`}`).join(', ')}`).join('. ')
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img" aria-label={`${title}. ${desc}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">{t}{spec.unit === '%' ? '%' : ''}</text>
          </g>
        ))}
        {spec.type === 'line'
          ? spec.series.map((s, si) => {
              const step = iw / (spec.x.length - 1)
              const pts = s.values.map((v, i) => `${pad.l + i * step},${y(v)}`).join(' ')
              return (
                <g key={s.name}>
                  <polyline points={pts} fill="none" stroke={COLORS[si]} strokeWidth={2.5} />
                  {s.values.map((v, i) => <circle key={i} cx={pad.l + i * step} cy={y(v)} r={3.5} fill={COLORS[si]} />)}
                </g>
              )
            })
          : spec.x.map((_, xi) => {
              const groupW = iw / spec.x.length
              const barW = (groupW * 0.75) / spec.series.length
              return spec.series.map((s, si) => <rect key={`${xi}-${si}`} x={pad.l + xi * groupW + groupW * 0.125 + si * barW} y={y(s.values[xi])} width={barW - 2} height={pad.t + ih - y(s.values[xi])} fill={COLORS[si]} rx={2} />)
            })}
        {spec.x.map((label, i) => {
          const xPos = spec.type === 'line' ? pad.l + (i * iw) / (spec.x.length - 1) : pad.l + (i + 0.5) * (iw / spec.x.length)
          return <text key={label} x={xPos} y={H - pad.b + 18} textAnchor="middle" fontSize="12" fill="var(--muted)">{label}</text>
        })}
        <text x={14} y={pad.t + ih / 2} transform={`rotate(-90 14 ${pad.t + ih / 2})`} textAnchor="middle" fontSize="11" fill="var(--faint)">{spec.unit === '%' ? 'Percentage' : spec.unit}</text>
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-sm">
        {spec.series.map((s, i) => <span key={s.name} className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm" style={{ background: COLORS[i] }} />{s.name}</span>)}
      </figcaption>
    </figure>
  )
}
