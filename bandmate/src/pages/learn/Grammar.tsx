import { useState } from 'react'
import { Link, Route, Routes, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, ChevronRight, Sparkles, XCircle } from 'lucide-react'
import { CEFR_LEVELS, CEFR_INFO } from '../../../shared/config'
import { api, errorMessage, post } from '../../lib/api'
import { Badge, ErrorState, Page, PageHeader, PageLoader, Spinner, cx, toast } from '../../components/ui'

export default function Grammar() {
  return (
    <Routes>
      <Route index element={<LessonList />} />
      <Route path=":id" element={<Lesson />} />
    </Routes>
  )
}

type LessonSummary = { id: string; title: string; level: string; topic: string; summary: string; exercises: number; bestScore: number | null; attempts: number; mastered: boolean }

function LessonList() {
  const q = useQuery({ queryKey: ['grammar'], queryFn: () => api<{ lessons: LessonSummary[]; recommended: string | null }>('/grammar/lessons') })
  if (q.isLoading) return <PageLoader />
  if (q.error) return <Page><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>
  const { lessons, recommended } = q.data!
  const rec = lessons.find((l) => l.id === recommended)
  return (
    <Page>
      <PageHeader title="Grammar" subtitle="Short lessons with clear examples, common mistakes and practice. Grouped by level." />
      {rec && (
        <Link to={`/grammar/${rec.id}`} className="card mb-6 flex items-center gap-4 border-primary/30 bg-primary-soft p-5">
          <Sparkles className="size-7 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Recommended for you</p>
            <p className="font-bold">{rec.title}</p>
            <p className="text-sm text-muted">{rec.summary}</p>
          </div>
          <ChevronRight className="size-5 text-primary" />
        </Link>
      )}
      {CEFR_LEVELS.filter((lv) => lessons.some((l) => l.level === lv)).map((lv) => (
        <section key={lv} className="mb-6">
          <h2 className="h2 mb-2">{lv} · {CEFR_INFO[lv].name}</h2>
          <div className="card divide-y divide-border">
            {lessons.filter((l) => l.level === lv).map((l) => (
              <Link key={l.id} to={`/grammar/${l.id}`} className="flex items-center gap-3 p-4 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{l.title}</p>
                  <p className="truncate text-sm text-muted">{l.summary}</p>
                </div>
                {l.mastered ? <Badge tone="good"><CheckCircle2 className="size-3.5" /> Mastered</Badge> : l.bestScore !== null ? <Badge tone="warn">Best {l.bestScore}/{l.exercises}</Badge> : <Badge>{l.exercises} exercises</Badge>}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Page>
  )
}

type Exercise = { index: number; type: 'mcq' | 'fill' | 'fix'; prompt: string; options: string[] | null; tokens: string[] | null }
type LessonData = { id: string; title: string; level: string; topic: string; summary: string; sections: { heading: string; text: string; examples: string[] }[]; mistakes: [string, string, string][]; exercises: Exercise[] }
type Result = { index: number; correct: boolean; answer: string; explanation: string }

function Lesson() {
  const { id } = useParams()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['grammar', id], queryFn: () => api<LessonData>(`/grammar/lessons/${id}`) })
  const [answers, setAnswers] = useState<(string | number | null)[]>([])
  const [results, setResults] = useState<{ score: number; total: number; results: Result[] } | null>(null)
  const [busy, setBusy] = useState(false)
  if (q.isLoading) return <PageLoader />
  if (q.error) return <Page><ErrorState error={q.error} /></Page>
  const l = q.data!
  const set = (i: number, v: string | number) => !results && setAnswers((a) => Object.assign([...a], { [i]: v }))
  const check = async () => {
    setBusy(true)
    try {
      const r = await post<{ score: number; total: number; results: Result[] }>(`/grammar/lessons/${id}/check`, { answers: l.exercises.map((_, i) => answers[i] ?? null) })
      setResults(r)
      qc.invalidateQueries({ queryKey: ['grammar'] })
      window.scrollTo({ top: document.getElementById('practice')!.offsetTop - 80, behavior: 'smooth' })
    } catch (e) {
      toast(errorMessage(e), 'bad')
    } finally {
      setBusy(false)
    }
  }
  const answeredCount = l.exercises.filter((_, i) => answers[i] !== undefined && answers[i] !== '').length
  return (
    <Page width="max-w-3xl">
      <PageHeader title={l.title} eyebrow={`${l.level} · ${l.topic}`} subtitle={l.summary} back={{ to: '/grammar', label: 'Grammar' }} />
      <div className="space-y-4">
        {l.sections.map((s) => (
          <section key={s.heading} className="card p-5">
            <h2 className="h2">{s.heading}</h2>
            <p className="mt-1 text-[15px] text-muted">{s.text}</p>
            <ul className="mt-3 space-y-1.5">
              {s.examples.map((e) => <li key={e} className="rounded-lg bg-surface-2 px-3 py-2 text-[15px]">{e}</li>)}
            </ul>
          </section>
        ))}
        {l.mistakes.length > 0 && (
          <section className="card p-5">
            <h2 className="h2 flex items-center gap-2"><AlertCircle className="size-5 text-warn" /> Common mistakes</h2>
            <div className="mt-3 space-y-3">
              {l.mistakes.map(([wrong, right, why]) => (
                <div key={wrong} className="text-[15px]">
                  <p className="text-bad line-through decoration-bad/60">{wrong}</p>
                  <p className="font-semibold text-good">{right}</p>
                  <p className="text-sm text-muted">{why}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <h2 id="practice" className="h2 mb-3 mt-8">Practice</h2>
      {results && (
        <div className={cx('mb-4 rounded-2xl p-4', results.score / results.total >= 0.8 ? 'bg-good-soft text-good' : 'bg-warn-soft text-warn')} role="status">
          <p className="text-lg font-bold">{results.score} / {results.total} correct{results.score / results.total >= 0.8 ? ' — lesson mastered!' : ''}</p>
          <p className="text-sm text-text/80">Read the explanations below, then try again to improve your score.</p>
        </div>
      )}
      <div className="space-y-3">
        {l.exercises.map((e, i) => {
          const r = results?.results[i]
          return (
            <div key={i} className={cx('card p-4', r && (r.correct ? 'border-good/50' : 'border-bad/50'))}>
              <p className="font-semibold"><span className="mr-2 text-muted">{i + 1}.</span>{e.prompt}</p>
              {e.type === 'mcq' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {e.options!.map((o, k) => <button key={k} onClick={() => set(i, k)} disabled={!!results} className={cx('chip', answers[i] === k && 'chip-on')}>{o}</button>)}
                </div>
              )}
              {e.type === 'fill' && <input className="input mt-3 max-w-sm" value={String(answers[i] ?? '')} disabled={!!results} onChange={(ev) => set(i, ev.target.value)} placeholder="Type your answer" aria-label={`Answer ${i + 1}`} autoCapitalize="off" />}
              {e.type === 'fix' && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-muted">Tap the word that is wrong.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {e.tokens!.map((t, k) => <button key={k} onClick={() => set(i, k)} disabled={!!results} className={cx('rounded-lg border px-2.5 py-1.5 text-[15px]', answers[i] === k ? 'border-bad bg-bad-soft text-bad' : 'border-border hover:border-primary/50')}>{t}</button>)}
                  </div>
                </div>
              )}
              {r && (
                <div className="mt-3 flex gap-2 text-sm">
                  {r.correct ? <CheckCircle2 className="size-5 shrink-0 text-good" /> : <XCircle className="size-5 shrink-0 text-bad" />}
                  <div>{!r.correct && <p className="font-semibold">Answer: {r.answer}</p>}<p className="text-muted">{r.explanation}</p></div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="sticky bottom-20 mt-5 flex justify-end md:bottom-4">
        {results ? (
          <button className="btn btn-primary btn-lg shadow-[var(--shadow-pop)]" onClick={() => { setResults(null); setAnswers([]); window.scrollTo({ top: document.getElementById('practice')!.offsetTop - 80 }) }}>Try again</button>
        ) : (
          <button className="btn btn-primary btn-lg shadow-[var(--shadow-pop)]" onClick={check} disabled={busy || answeredCount === 0}>{busy && <Spinner className="size-4 text-on-primary" />} Check answers ({answeredCount}/{l.exercises.length})</button>
        )}
      </div>
    </Page>
  )
}
