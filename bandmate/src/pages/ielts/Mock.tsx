import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Check, ClipboardCheck, Clock, Headphones, Info, Mic, PenLine } from 'lucide-react'
import { ApiError, api, errorMessage, patch, post } from '../../lib/api'
import { useUser } from '../../lib/session'
import { Badge, EmptyState, ErrorState, LimitNotice, Page, PageHeader, PageLoader, Segmented, Spinner, confirmDialog, cx, mmss, toast, useCountdown } from '../../components/ui'
import { TestPlayer } from '../../features/ielts/TestPlayer'
import type { Attempt } from '../../features/ielts/types'
import { RecordPanel } from '../../features/speaking/RecordPanel'
import { EssayEditor, type Submission } from './Writing'

type Section = 'listening' | 'reading' | 'writing' | 'speaking'
type MockView = {
  id: string
  mockId: string
  title: string
  testType: string
  status: 'in_progress' | 'completed'
  sectionIndex: number
  section: Section | null
  sectionStartedAt: number | null
  serverNow: number
  writingMinutes: number
  sections: { id: Section; status: 'done' | 'current' | 'locked' }[]
  content: {
    speaking: {
      part1: { topic: string; questions: string[]; promptId: string }
      part2: { promptId: string; cue: string; points: string[]; explain: string; prepSeconds: number; speakSeconds: number } | null
      part3: string[]
    }
  }
  underlying: {
    listening: { id: string; status: string } | null
    reading: { id: string; status: string } | null
    writing: { id: string; status: string; prompt_id: string }[]
    speaking: { id: string; part: number; question: string }[]
  }
  results: {
    bands: Record<Section, number | null>
    raw: { listening: string | null; reading: string | null }
    writing: ({ submissionId: string; task: number; wordCount: number; band: number | null } | null)[]
    speaking: { recordings: number; withAiFeedback: number; sessionIds: string[] }
    overall: number | null
    note: string
  } | null
}

const SECTION_INFO: Record<Section, { label: string; icon: typeof Headphones; time: string; about: string }> = {
  listening: { label: 'Listening', icon: Headphones, time: 'about 30 minutes', about: 'Four recordings, 40 questions. Each recording plays once — you can’t pause or rewind.' },
  reading: { label: 'Reading', icon: BookOpen, time: '60 minutes', about: 'Three passages, 40 questions. The timer keeps running even if you leave the page.' },
  writing: { label: 'Writing', icon: PenLine, time: '60 minutes', about: 'Task 1 (at least 150 words, about 20 minutes) and Task 2 (at least 250 words, about 40 minutes). Task 2 counts double.' },
  speaking: { label: 'Speaking', icon: Mic, time: '11–14 minutes', about: 'Part 1 interview, Part 2 cue card (1 minute to prepare, up to 2 minutes to speak) and Part 3 discussion. Answers are recorded and transcribed on our server; audio is not stored.' },
}

export default function Mock() {
  return (
    <Routes>
      <Route index element={<MockList />} />
      <Route path=":id" element={<MockRunner />} />
    </Routes>
  )
}

function MockList() {
  const me = useUser()
  const nav = useNavigate()
  const q = useQuery({ queryKey: ['mocks'], queryFn: () => api<{ mocks: { id: string; title: string; testType: string }[]; attempts: { id: string; mockId: string; status: string; startedAt: number; finishedAt: number | null; sectionIndex: number; overall: number | null; bands: Record<Section, number | null> | null }[] }>('/mock') })
  const [busy, setBusy] = useState(false)
  const [limit, setLimit] = useState<string | null>(null)
  const start = async (mockId: string) => {
    const open = q.data?.attempts.find((a) => a.mockId === mockId && a.status === 'in_progress')
    if (!open) {
      const ok = await confirmDialog({
        title: 'Start a full mock test?',
        body: <>The test takes about 2 hours 45 minutes. Each section is timed and you can’t go back to a finished section.{me.plan.limits.mockTestsPerWeek !== -1 && <><br /><br />Your plan includes <b>{String(me.plan.limits.mockTestsPerWeek)}</b> mock test{me.plan.limits.mockTestsPerWeek === 1 ? '' : 's'} per week; starting uses one.</>}</>,
        confirm: 'Start mock test',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      const v = await post<MockView>('/mock/start', { mockId })
      nav(`/ielts/mock/${v.id}`)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'limit_reached') setLimit(e.message)
      else toast(errorMessage(e), 'bad')
      setBusy(false)
    }
  }
  return (
    <Page width="max-w-4xl">
      <PageHeader eyebrow={me.profile.testType === 'general_training' ? 'General Training' : 'Academic'} title="Mock tests" back={{ to: '/ielts', label: 'IELTS' }} subtitle="A full practice test in exam conditions: Listening, Reading, Writing and Speaking, in order. You get an unofficial estimated band for each skill." />
      {limit && <div className="mb-4"><LimitNotice message={limit} /></div>}
      {q.isLoading ? <PageLoader /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data!.mocks.length ? <EmptyState icon={ClipboardCheck} title="No mock tests for your test type yet" /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {q.data!.mocks.map((m) => {
              const open = q.data!.attempts.find((a) => a.mockId === m.id && a.status === 'in_progress')
              return (
                <div key={m.id} className="card p-5">
                  <p className="h2">{m.title}</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-muted">
                    {(Object.keys(SECTION_INFO) as Section[]).map((s) => {
                      const I = SECTION_INFO[s].icon
                      return <li key={s} className="flex items-center gap-2"><I className="size-4 text-primary" /> {SECTION_INFO[s].label} · {SECTION_INFO[s].time}</li>
                    })}
                  </ul>
                  <button className="btn btn-primary mt-4 w-full" disabled={busy} onClick={() => start(m.id)}>{open ? `Continue (${SECTION_INFO[(['listening', 'reading', 'writing', 'speaking'] as Section[])[open.sectionIndex]]?.label ?? ''})` : 'Start mock test'}</button>
                </div>
              )
            })}
          </div>
          {q.data!.attempts.some((a) => a.status === 'completed') && (
            <section className="mt-8">
              <h2 className="h2 mb-3">Past results</h2>
              <ul className="space-y-2">
                {q.data!.attempts.filter((a) => a.status === 'completed').map((a) => (
                  <li key={a.id}>
                    <Link to={`/ielts/mock/${a.id}`} className="card flex flex-wrap items-center gap-3 p-4 hover:border-primary/40">
                      <span className="flex-1 font-semibold">{q.data!.mocks.find((m) => m.id === a.mockId)?.title ?? 'Mock test'} · {new Date(a.startedAt).toLocaleDateString()}</span>
                      {a.bands && (Object.entries(a.bands) as [Section, number | null][]).map(([k, v]) => <Badge key={k}>{SECTION_INFO[k].label[0]} {v?.toFixed(1) ?? '–'}</Badge>)}
                      <Badge tone="primary">Overall {a.overall?.toFixed(1) ?? '–'}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Page>
  )
}

function MockRunner() {
  const { id } = useParams()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['mock', id], queryFn: () => api<MockView>(`/mock/attempts/${id}`), gcTime: 0 })
  const [busy, setBusy] = useState(false)
  const set = (v: MockView) => qc.setQueryData(['mock', id], v)
  const complete = useCallback(
    async (section: Section) => {
      setBusy(true)
      try {
        set(await post<MockView>(`/mock/attempts/${id}/complete`, { section }))
        qc.invalidateQueries({ queryKey: ['ielts-overview'] })
        window.scrollTo(0, 0)
      } catch (e) {
        toast(errorMessage(e), 'bad')
      } finally {
        setBusy(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  )
  if (q.isLoading) return <PageLoader />
  if (q.error) return <Page><ErrorState error={q.error} /></Page>
  const m = q.data!
  if (m.status === 'completed') return <MockResults m={m} />
  const section = m.section!
  const info = SECTION_INFO[section]

  if (!m.sectionStartedAt)
    return (
      <Page width="max-w-2xl">
        <PageHeader eyebrow={m.title} title={`Section ${m.sectionIndex + 1}: ${info.label}`} back={{ to: '/ielts/mock', label: 'Mock tests' }} />
        <Stepper m={m} />
        <div className="card mt-6 p-6">
          <info.icon className="size-8 text-primary" />
          <p className="mt-3 text-lg font-bold">{info.label} · {info.time}</p>
          <p className="mt-1 text-muted">{info.about}</p>
          {section === 'listening' && <p className="mt-3 flex gap-2 text-sm text-muted"><Headphones className="size-4 shrink-0" /> Use headphones and check your volume before you begin.</p>}
          <button
            className="btn btn-primary mt-5"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                set(await post<MockView>(`/mock/attempts/${id}/begin`))
              } catch (e) {
                toast(errorMessage(e), 'bad')
              } finally {
                setBusy(false)
              }
            }}
          >
            Begin {info.label}
          </button>
        </div>
      </Page>
    )

  if (section === 'listening' || section === 'reading') return <ObjectiveSection m={m} section={section} onDone={() => complete(section)} busy={busy} />
  if (section === 'writing') return <WritingSection m={m} onDone={() => complete('writing')} busy={busy} />
  return <SpeakingSection m={m} onDone={() => complete('speaking')} busy={busy} onRefresh={() => q.refetch()} />
}

function Stepper({ m }: { m: MockView }) {
  return (
    <ol className="flex gap-1.5" aria-label="Mock test sections">
      {m.sections.map((s) => (
        <li key={s.id} className={cx('flex flex-1 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold', s.status === 'done' ? 'bg-good-soft text-good' : s.status === 'current' ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-faint')} aria-current={s.status === 'current' ? 'step' : undefined}>
          {s.status === 'done' && <Check className="size-3.5" />}
          {SECTION_INFO[s.id].label}
        </li>
      ))}
    </ol>
  )
}

function ObjectiveSection({ m, section, onDone, busy }: { m: MockView; section: 'listening' | 'reading'; onDone: () => void; busy: boolean }) {
  const nav = useNavigate()
  const u = m.underlying[section]
  const q = useQuery({ queryKey: ['attempt', u?.id], queryFn: () => api<Attempt>(`/ielts/attempts/${u!.id}`), enabled: !!u, staleTime: Infinity, gcTime: 0 })
  if (!u || q.isLoading) return <PageLoader />
  if (q.error) return <Page><ErrorState error={q.error} /></Page>
  if (q.data!.status === 'submitted' || busy)
    return (
      <Page width="max-w-2xl">
        <div className="card mt-10 flex flex-col items-center gap-3 p-8 text-center">
          {busy ? <Spinner className="size-8" /> : <Check className="size-8 text-good" />}
          <p className="text-lg font-bold">{SECTION_INFO[section].label} finished</p>
          {!busy && <button className="btn btn-primary" onClick={onDone}>Continue to the next section</button>}
        </div>
      </Page>
    )
  return <TestPlayer initial={q.data!} onExit={() => nav('/ielts/mock')} onSubmitted={() => onDone()} />
}

/** Both writing tasks share one 60-minute clock. Answers autosave; time-up submits whatever is written. */
function WritingSection({ m, onDone, busy }: { m: MockView; onDone: () => void; busy: boolean }) {
  const subs = useQuery({ queryKey: ['mock-writing', m.id], queryFn: () => Promise.all(m.underlying.writing.map((w) => api<Submission>(`/writing/submissions/${w.id}`))), staleTime: Infinity, gcTime: 0 })
  const [task, setTask] = useState<'0' | '1'>('0')
  const skew = useMemo(() => m.serverNow - Date.now(), [m.serverNow])
  const endsAt = m.sectionStartedAt! + m.writingMinutes * 60_000 - skew
  const left = useCountdown(endsAt)
  const texts = useRef<Record<string, string>>({})
  const finishing = useRef(false)
  const finish = useCallback(
    async (auto: boolean) => {
      if (finishing.current) return
      if (!auto) {
        const ok = await confirmDialog({ title: 'Finish the Writing section?', body: 'Both tasks will be submitted as they are. You can’t come back to them.', confirm: 'Finish writing' })
        if (!ok) return
      }
      finishing.current = true
      // Flush the latest text of each task before the server submits them.
      await Promise.all(Object.entries(texts.current).map(([sid, text]) => patch(`/writing/submissions/${sid}`, { text }).catch(() => undefined)))
      if (auto) toast('Time is up. Your writing has been submitted.', 'info')
      onDone()
    },
    [onDone],
  )
  useEffect(() => {
    if (left <= 0 && subs.data) void finish(true)
  }, [left, subs.data, finish])
  if (subs.isLoading || busy) return <PageLoader label="Saving your writing…" />
  if (subs.error) return <Page><ErrorState error={subs.error} /></Page>
  const list = subs.data!
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <p className="font-bold">Writing</p>
        <Segmented label="Task" value={task} onChange={setTask} items={list.map((s, i) => ({ id: String(i) as '0' | '1', label: `Task ${s.prompt.task}` }))} />
        <span className={cx('ml-auto flex items-center gap-1.5 font-bold tabular-nums', left < 5 * 60_000 && 'text-bad')} aria-live="off"><Clock className="size-4" /> {mmss(left)}</span>
        <button className="btn btn-primary btn-sm" onClick={() => finish(false)}>Finish writing</button>
      </header>
      <div className="mx-auto max-w-6xl p-4">
        {list.map((s, i) => (
          <div key={s.id} className={cx(String(i) !== task && 'hidden')}>
            <p className="mb-3 text-sm text-muted">Task {s.prompt.task}: spend about {s.prompt.task === 1 ? 20 : 40} minutes. Write at least {s.prompt.minWords} words.</p>
            <EssayEditorTracked sub={s} onText={(t) => (texts.current[s.id] = t)} />
          </div>
        ))}
      </div>
    </div>
  )
}

function EssayEditorTracked({ sub, onText }: { sub: Submission; onText: (t: string) => void }) {
  // The editor autosaves itself; we also observe its textarea so the latest words are flushed on finish.
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector('textarea')
    if (!el) return
    const h = () => onText(el.value)
    el.addEventListener('input', h)
    return () => el.removeEventListener('input', h)
  }, [onText])
  return <div ref={ref}><EssayEditor sub={sub} mock /></div>
}

function SpeakingSection({ m, onDone, busy, onRefresh }: { m: MockView; onDone: () => void; busy: boolean; onRefresh: () => void }) {
  const sp = m.content.speaking
  const card = sp.part2
  const p2q = card ? `${card.cue} ${card.points.join('; ')} ${card.explain}` : ''
  const steps = useMemo(
    () => [
      ...sp.part1.questions.map((q) => ({ part: 1 as const, q, promptId: sp.part1.promptId, max: 60 })),
      ...(card ? [{ part: 2 as const, q: p2q, promptId: card.promptId, max: card.speakSeconds }] : []),
      ...sp.part3.map((q) => ({ part: 3 as const, q, promptId: card?.promptId ?? sp.part1.promptId, max: 120 })),
    ],
    [sp, card, p2q],
  )
  const answered = new Set(m.underlying.speaking.map((s) => s.question))
  const idx = steps.findIndex((s) => !answered.has(s.q))
  const step = idx >= 0 ? steps[idx] : null
  const [prepEnds, setPrepEnds] = useState<number | null>(null)
  const prepLeft = useCountdown(prepEnds)
  const [prepDone, setPrepDone] = useState(false)
  useEffect(() => {
    if (prepEnds && prepLeft <= 0) setPrepDone(true)
  }, [prepEnds, prepLeft])
  const [notes, setNotes] = useState('')
  if (busy) return <PageLoader label="Finishing…" />
  return (
    <Page width="max-w-2xl">
      <PageHeader eyebrow={m.title} title="Speaking" />
      <Stepper m={m} />
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-primary" style={{ width: `${((idx < 0 ? steps.length : idx) / steps.length) * 100}%` }} /></div>
      {step ? (
        <div className="mt-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Part {step.part}{step.part === 1 ? ` · ${sp.part1.topic}` : ''} · question {idx + 1} of {steps.length}</p>
          {step.part === 2 && card ? (
            <>
              <div className="card border-2 border-primary/30 p-5">
                <p className="text-lg font-bold">{card.cue}</p>
                <p className="mt-2 text-sm text-muted">You should say:</p>
                <ul className="mt-1 list-disc pl-5">{card.points.map((x) => <li key={x}>{x}</li>)}</ul>
                <p className="mt-1">{card.explain}</p>
              </div>
              {!prepDone ? (
                <div className="card space-y-3 p-5">
                  {prepEnds ? <p className="font-bold tabular-nums">Preparation: {mmss(prepLeft)}</p> : <p className="text-muted">You have one minute to prepare. You can make notes.</p>}
                  {prepEnds && <textarea className="input min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" aria-label="Notes" />}
                  {!prepEnds ? <button className="btn btn-primary" onClick={() => setPrepEnds(Date.now() + card.prepSeconds * 1000)}>Start preparation</button> : <button className="btn btn-secondary btn-sm" onClick={() => setPrepDone(true)}>I’m ready to speak</button>}
                </div>
              ) : (
                <>
                  {notes && <div className="card whitespace-pre-wrap p-4 text-sm"><b>Your notes:</b> {notes}</div>}
                  <RecordPanel key={step.q} meta={{ part: 2, mode: 'answer', question: step.q, promptId: step.promptId, mockAttemptId: m.id }} maxSeconds={step.max} hint="Speak for up to 2 minutes. Recording stops automatically." onResult={() => onRefresh()} />
                </>
              )}
            </>
          ) : (
            <>
              <div className="card p-5"><p className="text-xl font-bold">{step.q}</p></div>
              <RecordPanel key={step.q} compact meta={{ part: step.part, mode: 'answer', question: step.q, promptId: step.promptId, mockAttemptId: m.id }} maxSeconds={step.max} onResult={() => onRefresh()} />
            </>
          )}
          <p className="flex gap-1.5 text-xs text-muted"><Info className="mt-0.5 size-3.5 shrink-0" /> If you can’t record (no microphone or speech analysis unavailable) you can finish the section now; your overall band then can’t be estimated.</p>
          <button className="btn btn-ghost btn-sm" onClick={async () => (await confirmDialog({ title: 'Finish Speaking now?', body: 'Unanswered questions will be skipped.', confirm: 'Finish' })) && onDone()}>Finish speaking early</button>
        </div>
      ) : (
        <div className="card mt-6 flex flex-col items-center gap-3 p-8 text-center">
          <Check className="size-8 text-good" />
          <p className="text-lg font-bold">All speaking questions answered</p>
          <button className="btn btn-primary" onClick={onDone}>Finish the mock test and see results</button>
        </div>
      )}
    </Page>
  )
}

function MockResults({ m }: { m: MockView }) {
  const r = m.results!
  return (
    <Page width="max-w-3xl">
      <PageHeader eyebrow={m.title} title="Mock test results" back={{ to: '/ielts/mock', label: 'Mock tests' }} />
      <div className="card p-6 text-center">
        <p className="text-sm font-semibold text-muted">Estimated overall band</p>
        <p className="mt-1 text-5xl font-extrabold">{r.overall?.toFixed(1) ?? '—'}</p>
        {r.overall === null && <p className="mt-2 text-sm text-muted">An overall band needs an estimate for all four skills. Get AI feedback on your writing and speaking below to complete it.</p>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SkillResult label="Listening" band={r.bands.listening} detail={r.raw.listening ? `${r.raw.listening} correct` : 'Not completed'} to={m.underlying.listening && `/ielts/review/${m.underlying.listening.id}`} />
        <SkillResult label="Reading" band={r.bands.reading} detail={r.raw.reading ? `${r.raw.reading} correct` : 'Not completed'} to={m.underlying.reading && `/ielts/review/${m.underlying.reading.id}`} />
        <div className="card p-4">
          <div className="flex items-center justify-between"><p className="font-bold">Writing</p><Badge tone={r.bands.writing !== null ? 'primary' : 'neutral'}>{r.bands.writing?.toFixed(1) ?? '—'}</Badge></div>
          <ul className="mt-2 space-y-1 text-sm">
            {r.writing.map((w, i) => w && (
              <li key={i}><Link className="link" to={`/ielts/writing/${w.submissionId}`}>Task {w.task}</Link> · {w.wordCount} words · {w.band !== null ? `AI estimate ${w.band.toFixed(1)}` : 'open to get AI feedback'}</li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between"><p className="font-bold">Speaking</p><Badge tone={r.bands.speaking !== null ? 'primary' : 'neutral'}>{r.bands.speaking?.toFixed(1) ?? '—'}</Badge></div>
          <p className="mt-2 text-sm text-muted">{r.speaking.recordings} answer{r.speaking.recordings === 1 ? '' : 's'} recorded · {r.speaking.withAiFeedback} with AI feedback</p>
          {r.speaking.sessionIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">{r.speaking.sessionIds.map((sid, i) => <Link key={sid} to={`/speak/practice/history/${sid}`} className="chip">Answer {i + 1}</Link>)}</div>
          )}
        </div>
      </div>
      <p className="mt-4 flex gap-1.5 text-sm text-muted"><Info className="mt-0.5 size-4 shrink-0" /> {r.note}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/ielts" className="btn btn-primary">IELTS dashboard</Link>
        <Link to="/ielts/mock" className="btn btn-secondary">All mock tests</Link>
      </div>
    </Page>
  )
}

function SkillResult({ label, band, detail, to }: { label: string; band: number | null; detail: string; to: string | null }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between"><p className="font-bold">{label}</p><Badge tone={band !== null ? 'primary' : 'neutral'}>{band?.toFixed(1) ?? '—'}</Badge></div>
      <p className="mt-2 text-sm text-muted">{detail}{to && <> · <Link to={to} className="link">Review answers</Link></>}</p>
    </div>
  )
}
