import { useMemo, useState } from 'react'
import { Clock, Target } from 'lucide-react'
import { Badge, Progress, Segmented, mmss } from '../../components/ui'
import { QuestionGroup } from './Questions'
import { TYPE_LABEL, sectionsOf, type Attempt } from './types'

/** Results with explanations: score, band (full tests only), time, accuracy by question type, and every question. */
export function Review({ a }: { a: Attempt }) {
  const r = a.result!
  const map = useMemo(() => new Map(r.items.map((i) => [i.n, i])), [r.items])
  const sections = sectionsOf(a.test).map((s, i) => ({ s, i })).filter(({ i }) => a.scope === null || a.scope === i)
  const [view, setView] = useState<'questions' | 'text'>('questions')
  const [sec, setSec] = useState(sections[0].i)
  const s = sectionsOf(a.test)[sec]
  const pct = Math.round((r.score / r.max) * 100)
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-semibold text-muted">Score</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{r.score}<span className="text-lg text-muted">/{r.max}</span></p>
          <Progress value={r.score} max={r.max} tone={pct >= 70 ? 'good' : pct >= 50 ? 'warn' : 'talk'} className="mt-2" />
        </div>
        <div className="card p-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-muted"><Target className="size-4" /> Band estimate</p>
          {r.band !== null ? (
            <>
              <p className="mt-1 text-3xl font-extrabold">{r.band.toFixed(1)}</p>
              <p className="text-xs text-muted">Unofficial — approximate conversion of your raw score.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Bands are estimated for full 40-question tests only. This was a focused practice set.</p>
          )}
        </div>
        <div className="card p-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-muted"><Clock className="size-4" /> Time</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{mmss(a.timeSpentS * 1000)}</p>
          <p className="text-xs text-muted">of {mmss(a.timeLimitS * 1000)} recommended{r.late ? ' · answers after the time limit were not counted' : ''}</p>
        </div>
      </div>

      {Object.keys(r.byType).length > 1 && (
        <div className="card mt-4 p-5">
          <p className="font-bold">By question type</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Object.entries(r.byType).map(([t, v]) => (
              <div key={t}>
                <div className="mb-1 flex justify-between text-sm"><span>{TYPE_LABEL[t] ?? t}</span><span className="font-semibold tabular-nums">{v.correct}/{v.total}</span></div>
                <Progress value={v.correct} max={v.total} tone={v.correct / v.total >= 0.7 ? 'good' : 'warn'} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {sections.length > 1 && sections.map(({ i }) => <button key={i} onClick={() => setSec(i)} className={`chip ${sec === i ? 'chip-on' : ''}`}>{a.kind === 'reading' ? `Passage ${i + 1}` : `Part ${i + 1}`}</button>)}
        <Segmented className="ml-auto" label="Show" value={view} onChange={setView} items={[{ id: 'questions', label: 'Answers' }, { id: 'text', label: a.kind === 'reading' ? 'Passage' : 'Transcript' }]} />
      </div>
      <div className="mt-4">
        {view === 'questions' ? (
          <div className="space-y-8">{s.groups.map((g, i) => <QuestionGroup key={i} group={g} answers={Object.fromEntries(r.items.map((x) => [x.n, x.given]))} onAnswer={() => undefined} review={map} />)}</div>
        ) : a.kind === 'reading' ? (
          <article className="card space-y-3 p-5 text-[15.5px] leading-relaxed">
            <h3 className="text-lg font-bold">{s.title}</h3>
            {s.paragraphs?.map((p, i) => <p key={i}>{p.label && <b className="mr-2 text-primary">{p.label}</b>}{p.text}</p>)}
          </article>
        ) : (
          <div className="card space-y-2 p-5 text-[15px]">
            {s.script?.map((l, i) => <p key={i}><Badge className="mr-2">{l.s}</Badge>{l.text}</p>) ?? <p className="text-muted">Transcript not available.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
