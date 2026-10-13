import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Clock, FileClock, History, Lock, PenLine, RotateCcw } from 'lucide-react'
import { api, errorMessage, patch, post } from '../../lib/api'
import { useUser } from '../../lib/session'
import { Badge, ErrorState, Modal, Page, PageHeader, PageLoader, Segmented, confirmDialog, cx, mmss, toast } from '../../components/ui'
import { Chart, type ChartSpec } from '../../features/ielts/Chart'
import { AiFeedbackGate, BandPill, Notes, type Note } from '../../features/feedback'

export type WritingPrompt = { id: string; task: 1 | 2; kind: string; title: string; prompt: string; chart?: ChartSpec; structure: string[]; minutes: number; minWords: number; testType: string; premium: boolean; bullets?: string[] }
type Issue = { offset: number; length: number; message: string; replacements: string[]; type: 'grammar' | 'spelling' | 'style' }
type Checks = {
  stats: { wordCount: number; paragraphs: number; sentences: number; avgSentenceLength: number; complexSentences: number; lexicalVariety: number; linkingWords: Record<string, string[]> }
  criteria: Record<'task' | 'coherence' | 'lexical' | 'grammar', Note[]>
  issues: Issue[]
  grammarChecker: 'languagetool' | 'dictionary-only'
}
type AiFb = {
  overall_band_estimate: number
  summary: string
  criteria: { name: string; band: number; strengths: string[]; improvements: string[] }[]
  corrections: { original: string; corrected: string; explanation: string }[]
  improved_examples: { original: string; improved: string; why: string }[]
  next_steps: string[]
}
export type Submission = { id: string; promptId: string; prompt: WritingPrompt; text: string; wordCount: number; status: 'draft' | 'submitted'; checks: Checks | null; aiFeedback: AiFb | null; aiStatus: string | null; timeSpentS: number; createdAt: number; updatedAt: number; submittedAt: number | null; mockAttemptId: string | null }
type PromptSummary = { id: string; task: 1 | 2; kind: string; title: string; minutes: number; minWords: number; premium: boolean; submissions: { id: string; status: string; wordCount: number; updatedAt: number; band: number | null }[] }

export default function Writing() {
  return (
    <Routes>
      <Route index element={<WritingList />} />
      <Route path=":id" element={<SubmissionPage />} />
    </Routes>
  )
}

const KIND_LABEL: Record<string, string> = { line: 'Line graph', bar: 'Bar chart', table: 'Table', process: 'Process diagram', letter: 'Letter', essay: 'Essay', map: 'Map', pie: 'Pie chart' }

function WritingList() {
  const me = useUser()
  const nav = useNavigate()
  const q = useQuery({ queryKey: ['writing-prompts'], queryFn: () => api<PromptSummary[]>('/writing/prompts') })
  const [busy, setBusy] = useState<string | null>(null)
  const open = async (promptId: string) => {
    setBusy(promptId)
    try {
      const s = await post<Submission>('/writing/submissions', { promptId })
      nav(`/ielts/writing/${s.id}`)
    } catch (e) {
      toast(errorMessage(e), 'bad')
      setBusy(null)
    }
  }
  const tt = me.profile.testType === 'general_training' ? 'General Training' : 'Academic'
  return (
    <Page width="max-w-4xl">
      <PageHeader eyebrow={tt} title="Writing" back={{ to: '/ielts', label: 'IELTS' }} subtitle="Write with a timer and word count. Your work autosaves. After submitting you get automatic checks, and optional AI feedback with an unofficial band estimate." />
      {q.isLoading ? <PageLoader /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        [1, 2].map((task) => (
          <section key={task} className="mb-8">
            <h2 className="h2 mb-1">Task {task}</h2>
            <p className="mb-3 text-sm text-muted">{task === 1 ? (me.profile.testType === 'general_training' ? 'A letter of at least 150 words · 20 minutes' : 'Describe visual information in at least 150 words · 20 minutes') : 'An essay of at least 250 words · 40 minutes · counts double'}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.data!.filter((p) => p.task === task).map((p) => {
                const locked = p.premium && me.plan.limits.premiumContent !== true
                const draft = p.submissions.find((s) => s.status === 'draft')
                const done = p.submissions.filter((s) => s.status === 'submitted')
                const best = done.reduce<number | null>((m, s) => (s.band !== null ? Math.max(m ?? 0, s.band) : m), null)
                return (
                  <div key={p.id} className="card flex flex-col p-4">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 font-bold">{p.title}</p>
                      {locked ? <Badge tone="primary"><Lock className="size-3" /> Premium</Badge> : <Badge>{KIND_LABEL[p.kind] ?? p.kind}</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {done.length ? `${done.length} submitted` : 'Not attempted'}
                      {best !== null && ` · best AI estimate ${best.toFixed(1)}`}
                      {draft && ` · draft ${draft.wordCount} words`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {locked ? (
                        <Link to="/account/plan" className="btn btn-secondary btn-sm">See Premium</Link>
                      ) : (
                        <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => open(p.id)}>{draft ? 'Continue draft' : done.length ? 'Write again' : 'Start'}</button>
                      )}
                      {done.slice(0, 3).map((s) => <Link key={s.id} to={`/ielts/writing/${s.id}`} className="chip">{new Date(s.updatedAt).toLocaleDateString()}{s.band !== null && ` · ${s.band.toFixed(1)}`}</Link>)}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))
      )}
    </Page>
  )
}

function SubmissionPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['writing-sub', id], queryFn: () => api<Submission>(`/writing/submissions/${id}`), staleTime: Infinity, gcTime: 0 })
  if (q.isLoading) return <PageLoader />
  if (q.error) return <Page><ErrorState error={q.error} /></Page>
  const s = q.data!
  const set = (n: Submission) => {
    qc.setQueryData(['writing-sub', id], n)
    qc.invalidateQueries({ queryKey: ['writing-prompts'] })
    qc.invalidateQueries({ queryKey: ['ielts-overview'] })
  }
  if (s.status === 'draft')
    return (
      <Page width="max-w-6xl">
        <PageHeader eyebrow={`Writing Task ${s.prompt.task}`} title={s.prompt.title} back={{ to: '/ielts/writing', label: 'Writing' }} />
        <EssayEditor sub={s} onSubmitted={set} />
      </Page>
    )
  return (
    <Page width="max-w-4xl">
      <PageHeader eyebrow={`Writing Task ${s.prompt.task}${s.mockAttemptId ? ' · mock test' : ''}`} title={s.prompt.title} back={s.mockAttemptId ? { to: `/ielts/mock/${s.mockAttemptId}`, label: 'Mock test' } : { to: '/ielts/writing', label: 'Writing' }} />
      <WritingFeedback s={s} onUpdate={set} />
    </Page>
  )
}

/** The task question with its chart and an optional structure guide. */
export function TaskPrompt({ p, guide = true }: { p: WritingPrompt; guide?: boolean }) {
  const [showGuide, setShowGuide] = useState(false)
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="whitespace-pre-line text-[15.5px] leading-relaxed">{p.prompt}</p>
        {p.bullets && <ul className="mt-2 list-disc pl-5 text-[15.5px]">{p.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
        <p className="mt-3 text-sm font-semibold text-muted">Write at least {p.minWords} words.</p>
      </div>
      {p.chart && <div className="card p-4"><Chart spec={p.chart} title={p.title} /></div>}
      {guide && p.structure?.length > 0 && (
        <div className="card p-4">
          <button className="flex w-full items-center justify-between text-left font-bold" onClick={() => setShowGuide((v) => !v)} aria-expanded={showGuide}>
            Suggested structure <ChevronDown className={cx('size-5 transition', showGuide && 'rotate-180')} />
          </button>
          {showGuide && <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">{p.structure.map((x) => <li key={x}>{x}</li>)}</ol>}
        </div>
      )}
    </div>
  )
}

const countWords = (t: string) => (t.match(/[A-Za-z0-9’'-]+/g) ?? []).length
const localKey = (id: string) => `bm_essay_${id}`

/**
 * The essay editor: word count, practice timer, debounced autosave (with a local backup in case the
 * connection drops), draft history, and submit. In a mock test the mock controls timing and submission.
 */
export function EssayEditor({ sub, onSubmitted, mock = false }: { sub: Submission; onSubmitted?: (s: Submission) => void; mock?: boolean }) {
  const [text, setText] = useState(sub.text)
  const [save, setSave] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved')
  const [savedAt, setSavedAt] = useState(sub.updatedAt)
  const [elapsed, setElapsed] = useState(sub.timeSpentS)
  const [view, setView] = useState<'task' | 'answer'>('task')
  const [drafts, setDrafts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const textRef = useRef(text)
  textRef.current = text
  const elapsedRef = useRef(elapsed)
  elapsedRef.current = elapsed
  const p = sub.prompt
  const words = useMemo(() => countWords(text), [text])

  // A local backup is newer than the server copy (e.g. saved while offline): offer it back.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(localKey(sub.id))
      if (!raw) return
      const b = JSON.parse(raw) as { text: string; at: number }
      if (b.at > sub.updatedAt + 1000 && b.text !== sub.text && b.text.trim()) {
        void confirmDialog({ title: 'Restore unsaved work?', body: 'This device has a newer version of your answer that didn’t reach the server. Restore it?', confirm: 'Restore' }).then((ok) => {
          if (ok) {
            setText(b.text)
            setSave('dirty')
          }
        })
      }
    } catch {
      /* storage unavailable */
    }
  }, [sub.id, sub.text, sub.updatedAt])

  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === 'visible' && setElapsed((e) => e + 1), 1000)
    return () => window.clearInterval(t)
  }, [])

  const doSave = useCallback(async () => {
    setSave('saving')
    try {
      const r = await patch<{ savedAt: number }>(`/writing/submissions/${sub.id}`, { text: textRef.current, timeSpentS: elapsedRef.current })
      setSavedAt(r.savedAt)
      setSave('saved')
    } catch {
      setSave('error')
    }
  }, [sub.id])

  useEffect(() => {
    if (save !== 'dirty') return
    try {
      localStorage.setItem(localKey(sub.id), JSON.stringify({ text, at: Date.now() }))
    } catch {
      /* storage unavailable */
    }
    const t = window.setTimeout(() => void doSave(), 1500)
    return () => window.clearTimeout(t)
  }, [text, save, doSave, sub.id])

  // Retry failed saves, and flush when the tab is hidden.
  useEffect(() => {
    if (save !== 'error') return
    const t = window.setTimeout(() => void doSave(), 5000)
    return () => window.clearTimeout(t)
  }, [save, doSave])
  useEffect(() => {
    const flush = () => document.visibilityState === 'hidden' && (save === 'dirty' || save === 'error') && void doSave()
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [save, doSave])

  const submit = async () => {
    const ok = await confirmDialog({
      title: 'Submit your answer?',
      body: <>You won’t be able to edit it afterwards.{words < p.minWords && <><br /><b>You have written {words} words; the minimum is {p.minWords}. Short answers lose marks.</b></>}</>,
      confirm: 'Submit',
    })
    if (!ok) return
    setSubmitting(true)
    try {
      const r = await post<Submission>(`/writing/submissions/${sub.id}/submit`, { text, timeSpentS: elapsed })
      try {
        localStorage.removeItem(localKey(sub.id))
      } catch {
        /* ignore */
      }
      onSubmitted?.(r)
    } catch (e) {
      toast(errorMessage(e), 'bad')
      setSubmitting(false)
    }
  }

  const over = elapsed > p.minutes * 60
  const statusText = save === 'saving' ? 'Saving…' : save === 'dirty' ? 'Unsaved changes' : save === 'error' ? 'Not saved — retrying (a copy is kept on this device)' : `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return (
    <div>
      <div className="mb-3 lg:hidden">
        <Segmented label="View" value={view} onChange={setView} items={[{ id: 'task', label: 'Task' }, { id: 'answer', label: `Your answer (${words})` }]} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={cx(view !== 'task' && 'hidden lg:block')}><TaskPrompt p={p} /></div>
        <div className={cx('flex flex-col', view !== 'answer' && 'hidden lg:flex')}>
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className={cx('font-bold tabular-nums', words >= p.minWords ? 'text-good' : 'text-text')} aria-live="polite">{words} / {p.minWords} words</span>
            {!mock && <span className={cx('flex items-center gap-1 tabular-nums', over ? 'text-warn' : 'text-muted')}><Clock className="size-4" /> {mmss(elapsed * 1000)} / {p.minutes}:00</span>}
            <span className={cx('ml-auto text-xs', save === 'error' ? 'text-bad' : 'text-muted')} role="status">{statusText}</span>
          </div>
          <textarea
            className="input min-h-[55vh] flex-1 resize-y font-[inherit] text-[16px] leading-relaxed"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setSave('dirty')
            }}
            placeholder={p.task === 1 && p.kind === 'letter' ? 'Dear …,' : 'Start writing here…'}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="sentences"
            aria-label="Your answer"
          />
          <p className="mt-1 text-xs text-faint">The browser spellchecker is off, as in the real test.</p>
          {!mock && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={submitting || words < 20} onClick={submit}>{submitting ? 'Checking…' : 'Submit for feedback'}</button>
              <button className="btn btn-ghost" onClick={() => setDrafts(true)}><FileClock className="size-4" /> Draft history</button>
            </div>
          )}
        </div>
      </div>
      {drafts && (
        <DraftHistory
          id={sub.id}
          onClose={() => setDrafts(false)}
          onRestore={(t) => {
            setText(t)
            setSave('dirty')
            setDrafts(false)
            toast('Draft restored.', 'good')
          }}
        />
      )}
    </div>
  )
}

function DraftHistory({ id, onClose, onRestore }: { id: string; onClose: () => void; onRestore: (t: string) => void }) {
  const q = useQuery({ queryKey: ['drafts', id], queryFn: () => api<{ id: number; text: string; wordCount: number; savedAt: number }[]>(`/writing/submissions/${id}/drafts`), gcTime: 0 })
  const [sel, setSel] = useState<number | null>(null)
  const d = q.data?.find((x) => x.id === sel)
  return (
    <Modal open onClose={onClose} title="Draft history" size="lg" footer={d && <button className="btn btn-primary" onClick={() => onRestore(d.text)}><RotateCcw className="size-4" /> Restore this version</button>}>
      <p className="mb-3 text-sm text-muted">Snapshots are saved automatically about once a minute while you write.</p>
      {q.isLoading ? <PageLoader /> : !q.data?.length ? <p className="text-sm text-muted">No snapshots yet.</p> : (
        <div className="grid gap-3 md:grid-cols-[200px_1fr]">
          <ul className="space-y-1">
            {q.data.map((x) => (
              <li key={x.id}>
                <button onClick={() => setSel(x.id)} className={cx('w-full rounded-lg px-3 py-2 text-left text-sm', sel === x.id ? 'bg-primary-soft text-primary' : 'hover:bg-surface-2')}>
                  {new Date(x.savedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} · {x.wordCount} words
                </button>
              </li>
            ))}
          </ul>
          <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm">{d ? d.text : 'Choose a snapshot to preview it.'}</div>
        </div>
      )}
    </Modal>
  )
}

/** The essay with automatic-check issues highlighted. Click a highlight to see the explanation. */
function HighlightedEssay({ text, issues }: { text: string; issues: Issue[] }) {
  const clean = text.replace(/\r/g, '').trim()
  const [open, setOpen] = useState<number | null>(null)
  const parts: ReactNode[] = []
  let pos = 0
  const sorted = [...issues].map((x, i) => ({ ...x, i })).sort((a, b) => a.offset - b.offset)
  for (const is of sorted) {
    if (is.offset < pos) continue
    parts.push(clean.slice(pos, is.offset))
    parts.push(
      <button
        key={is.i}
        onClick={() => setOpen(open === is.i ? null : is.i)}
        className={cx('rounded-sm underline decoration-2 underline-offset-4', is.type === 'spelling' ? 'decoration-bad' : is.type === 'grammar' ? 'decoration-warn' : 'decoration-primary', open === is.i && 'bg-warn-soft')}
        aria-label={`${is.type} issue: ${is.message}`}
      >
        {clean.slice(is.offset, is.offset + is.length)}
      </button>,
    )
    pos = is.offset + is.length
  }
  parts.push(clean.slice(pos))
  const cur = sorted.find((x) => x.i === open)
  return (
    <div>
      <div className="whitespace-pre-wrap text-[15.5px] leading-[1.9]">{parts}</div>
      {cur && (
        <div className="sticky bottom-20 mt-3 rounded-xl border border-border bg-surface p-3 text-sm shadow-lg md:bottom-4">
          <p><Badge tone={cur.type === 'spelling' ? 'bad' : cur.type === 'grammar' ? 'warn' : 'primary'}>{cur.type}</Badge> {cur.message}</p>
          {cur.replacements.length > 0 && <p className="mt-1">Suggestion: <b>{cur.replacements.join(' / ')}</b></p>}
        </div>
      )}
    </div>
  )
}

export function WritingFeedback({ s, onUpdate }: { s: Submission; onUpdate: (s: Submission) => void }) {
  const nav = useNavigate()
  const c = s.checks
  const ai = s.aiFeedback
  const [showTask, setShowTask] = useState(false)
  const again = async () => {
    try {
      const n = await post<Submission>('/writing/submissions', { promptId: s.promptId, fresh: true })
      nav(`/ielts/writing/${n.id}`)
    } catch (e) {
      toast(errorMessage(e), 'bad')
    }
  }
  return (
    <div className="space-y-5">
      {c && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Words', `${c.stats.wordCount}`, c.stats.wordCount >= s.prompt.minWords ? 'good' : 'warn'],
            ['Paragraphs', `${c.stats.paragraphs}`, ''],
            ['Avg sentence', `${c.stats.avgSentenceLength} words`, ''],
            ['Time', mmss(s.timeSpentS * 1000), ''],
          ].map(([k, v, tone]) => (
            <div key={k} className="card p-3 text-center">
              <p className={cx('text-xl font-extrabold tabular-nums', tone === 'good' && 'text-good', tone === 'warn' && 'text-warn')}>{v}</p>
              <p className="text-xs text-muted">{k}</p>
            </div>
          ))}
        </div>
      )}

      <button className="flex items-center gap-1 text-sm font-semibold text-primary" onClick={() => setShowTask((v) => !v)} aria-expanded={showTask}>
        <ChevronRight className={cx('size-4 transition', showTask && 'rotate-90')} /> {showTask ? 'Hide' : 'Show'} the task
      </button>
      {showTask && <TaskPrompt p={s.prompt} guide={false} />}

      {ai ? (
        <section className="card border-primary/25 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <p className="font-bold">AI feedback</p>
              <p className="text-xs text-muted">Unofficial practice estimate — not an IELTS score.</p>
            </div>
            <BandPill band={ai.overall_band_estimate} label="Estimate" />
          </div>
          <p className="mt-3 text-[15px]">{ai.summary}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {ai.criteria.map((cr) => (
              <div key={cr.name} className="rounded-xl bg-surface-2 p-4">
                <div className="flex items-center justify-between gap-2"><p className="font-bold">{cr.name}</p><Badge tone="primary">{cr.band.toFixed(1)}</Badge></div>
                {cr.strengths.length > 0 && <ul className="mt-2 space-y-1 text-sm">{cr.strengths.map((x, i) => <li key={i} className="flex gap-1.5"><span className="text-good">+</span>{x}</li>)}</ul>}
                {cr.improvements.length > 0 && <ul className="mt-2 space-y-1 text-sm">{cr.improvements.map((x, i) => <li key={i} className="flex gap-1.5"><span className="text-warn">→</span>{x}</li>)}</ul>}
              </div>
            ))}
          </div>
          {ai.corrections.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 font-bold">Corrections</p>
              <ul className="space-y-2 text-[15px]">
                {ai.corrections.map((x, i) => <li key={i} className="rounded-xl bg-surface-2 p-3"><s className="text-muted">{x.original}</s> → <b>{x.corrected}</b><span className="block text-sm text-muted">{x.explanation}</span></li>)}
              </ul>
            </div>
          )}
          {ai.improved_examples.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 font-bold">Stronger versions of your sentences</p>
              <ul className="space-y-2 text-[15px]">
                {ai.improved_examples.map((x, i) => <li key={i} className="rounded-xl bg-surface-2 p-3"><span className="text-muted">{x.original}</span><br /><b>{x.improved}</b><span className="block text-sm text-muted">{x.why}</span></li>)}
              </ul>
            </div>
          )}
          {ai.next_steps.length > 0 && (
            <div className="mt-5"><p className="mb-1 font-bold">Next steps</p><ol className="list-decimal space-y-1 pl-5 text-[15px]">{ai.next_steps.map((x, i) => <li key={i}>{x}</li>)}</ol></div>
          )}
        </section>
      ) : (
        <AiFeedbackGate what="essay" run={async () => onUpdate(await post<Submission>(`/writing/submissions/${s.id}/ai-feedback`))} />
      )}

      {c && (
        <section>
          <h2 className="h2 mb-1">Automatic checks</h2>
          <p className="mb-3 text-sm text-muted">Rule-based pointers grouped by the four IELTS criteria. They don’t produce a band score.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {([['task', s.prompt.task === 1 ? 'Task achievement' : 'Task response'], ['coherence', 'Coherence & cohesion'], ['lexical', 'Lexical resource'], ['grammar', 'Grammatical range & accuracy']] as const).map(([k, label]) => (
              <div key={k} className="card p-4"><p className="mb-2 font-bold">{label}</p><Notes notes={c.criteria[k]} /></div>
            ))}
          </div>
          {c.grammarChecker === 'dictionary-only' && <p className="mt-2 text-xs text-muted">The grammar checker (LanguageTool) wasn’t available, so only spelling was checked.</p>}
        </section>
      )}

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="h2 flex-1">Your answer</h2>
          {c && c.issues.length > 0 && (
            <span className="flex flex-wrap gap-3 text-xs text-muted">
              <span><span className="mr-1 inline-block h-0.5 w-4 bg-bad align-middle" />spelling</span>
              <span><span className="mr-1 inline-block h-0.5 w-4 bg-warn align-middle" />grammar</span>
              <span><span className="mr-1 inline-block h-0.5 w-4 bg-primary align-middle" />style</span>
            </span>
          )}
        </div>
        {c ? <HighlightedEssay text={s.text} issues={c.issues} /> : <p className="whitespace-pre-wrap">{s.text}</p>}
        {c && c.issues.length > 0 && <p className="mt-3 text-xs text-muted">{c.issues.length} possible issue{c.issues.length > 1 ? 's' : ''} found. Tap an underlined word for details.</p>}
      </section>

      {!s.mockAttemptId && (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={again}><PenLine className="size-4" /> Write a new version</button>
          <Link to="/ielts/writing" className="btn btn-secondary"><History className="size-4" /> All writing tasks</Link>
        </div>
      )}
    </div>
  )
}
