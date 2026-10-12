import { useEffect, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenText, ChevronRight, Clock, History, Lock, MessagesSquare, Mic, Timer, Users } from 'lucide-react'
import { api } from '../../lib/api'
import { useUser } from '../../lib/session'
import { Badge, EmptyState, ErrorState, Page, PageHeader, PageLoader, Segmented, cx, mmss, useCountdown } from '../../components/ui'
import { RecordPanel } from '../../features/speaking/RecordPanel'
import { SpeakingResult } from '../../features/speaking/Result'
import type { SpeakingSession } from '../../features/speaking/recorder'

type Part1 = { id: string; part: 1; topic: string; questions: string[]; premium: boolean }
type Part2 = { id: string; part: 2; title: string; cue: string; points: string[]; explain: string; part3: string[]; premium: boolean }
type Prompts = { part1: Part1[]; part2: Part2[]; readAloud: { id: string; level: string; text: string }[] }

const usePrompts = () => useQuery({ queryKey: ['speaking-prompts'], queryFn: () => api<Prompts>('/speaking/prompts'), staleTime: 10 * 60_000 })

export default function SpeakPractice() {
  return (
    <Routes>
      <Route index element={<Hub />} />
      <Route path="part1/:id" element={<Part1Practice />} />
      <Route path="part2/:id" element={<Part2Practice />} />
      <Route path="part3/:id" element={<Part3Practice />} />
      <Route path="read-aloud" element={<ReadAloud />} />
      <Route path="history" element={<HistoryList />} />
      <Route path="history/:id" element={<HistoryItem />} />
    </Routes>
  )
}

function Hub() {
  const me = useUser()
  const q = usePrompts()
  const [tab, setTab] = useState<'1' | '2' | '3'>('1')
  const locked = (p: { premium: boolean }) => p.premium && me.plan.limits.premiumContent !== true
  return (
    <Page>
      <PageHeader
        eyebrow="Speaking practice"
        title="Practise on your own"
        back={{ to: '/speak', label: 'Speak' }}
        subtitle="Record answers to IELTS-style questions. We transcribe them on our server and give feedback on fluency, vocabulary and grammar."
        action={<Link to="/speak/practice/history" className="btn btn-secondary"><History className="size-4" /> History</Link>}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link to="/speak/call" className="card flex items-center gap-4 p-4 hover:border-primary/40">
          <span className="grid size-11 place-items-center rounded-xl bg-talk-soft text-talk"><Users className="size-5" /></span>
          <span className="flex-1"><b className="block">Practise with a real partner</b><span className="text-sm text-muted">Anonymous voice call with an IELTS mode</span></span>
          <ChevronRight className="size-5 text-faint" />
        </Link>
        <Link to="/speak/practice/read-aloud" className="card flex items-center gap-4 p-4 hover:border-primary/40">
          <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary"><BookOpenText className="size-5" /></span>
          <span className="flex-1"><b className="block">Read-aloud clarity check</b><span className="text-sm text-muted">Read a sentence; see which words were recognised</span></span>
          <ChevronRight className="size-5 text-faint" />
        </Link>
      </div>
      <Segmented label="IELTS speaking part" value={tab} onChange={setTab} items={[{ id: '1', label: 'Part 1 · Interview' }, { id: '2', label: 'Part 2 · Cue card' }, { id: '3', label: 'Part 3 · Discussion' }]} />
      <p className="mt-3 text-sm text-muted">
        {tab === '1' ? 'Short answers (about 20–30 seconds) to everyday questions. Give a reason or example each time.' : tab === '2' ? 'One minute to prepare with notes, then speak for up to two minutes.' : 'Longer, more abstract answers (about 45–60 seconds) linked to a Part 2 topic.'}
      </p>
      {q.isLoading ? <PageLoader /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tab === '1' && q.data!.part1.map((p) => <PromptCard key={p.id} to={`part1/${p.id}`} title={p.topic} sub={`${p.questions.length} questions`} locked={locked(p)} />)}
          {tab === '2' && q.data!.part2.map((p) => <PromptCard key={p.id} to={`part2/${p.id}`} title={p.title} sub="1 min prep · 2 min talk" locked={locked(p)} />)}
          {tab === '3' && q.data!.part2.map((p) => <PromptCard key={p.id} to={`part3/${p.id}`} title={p.title} sub={`${p.part3.length} discussion questions`} locked={locked(p)} />)}
        </div>
      )}
    </Page>
  )
}

function PromptCard({ to, title, sub, locked }: { to: string; title: string; sub: string; locked: boolean }) {
  const body = (
    <>
      <span className="min-w-0 flex-1"><b className="block truncate">{title}</b><span className="text-sm text-muted">{sub}</span></span>
      {locked ? <Badge tone="primary"><Lock className="size-3" /> Premium</Badge> : <ChevronRight className="size-5 text-faint" />}
    </>
  )
  return locked ? (
    <Link to="/account/plan" className="card flex items-center gap-3 p-4 opacity-75">{body}</Link>
  ) : (
    <Link to={`/speak/practice/${to}`} className="card flex items-center gap-3 p-4 hover:border-primary/40">{body}</Link>
  )
}

function useInvalidateOverview() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['ielts-overview'] })
    qc.invalidateQueries({ queryKey: ['speaking-history'] })
  }
}

/** Steps through a list of questions, recording one answer for each. */
function QuestionRun({ title, eyebrow, questions, part, promptId, maxSeconds, hint }: { title: string; eyebrow: string; questions: string[]; part: 1 | 3; promptId: string; maxSeconds: number; hint: string }) {
  const [i, setI] = useState(0)
  const [results, setResults] = useState<Record<number, SpeakingSession>>({})
  const done = useInvalidateOverview()
  const r = results[i]
  return (
    <Page width="max-w-3xl">
      <PageHeader eyebrow={eyebrow} title={title} back={{ to: '/speak/practice', label: 'Speaking practice' }} />
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Questions">
        {questions.map((_, n) => (
          <button key={n} role="tab" aria-selected={n === i} onClick={() => setI(n)} className={cx('chip', n === i && 'chip-on', results[n] && n !== i && 'border-good/40 text-good')}>
            {n + 1}
          </button>
        ))}
      </div>
      <div className="card mb-4 p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Question {i + 1} of {questions.length}</p>
        <p className="mt-1 text-xl font-bold">{questions[i]}</p>
      </div>
      {r ? (
        <>
          <SpeakingResult s={r} onUpdate={(s) => setResults((x) => ({ ...x, [i]: s }))} />
          <div className="mt-4 flex flex-wrap gap-2">
            {i < questions.length - 1 ? <button className="btn btn-primary" onClick={() => setI(i + 1)}>Next question</button> : <Link to="/speak/practice" className="btn btn-primary">Finish</Link>}
            <button className="btn btn-secondary" onClick={() => setResults(({ [i]: _drop, ...rest }) => rest)}>Try this question again</button>
          </div>
        </>
      ) : (
        <RecordPanel key={i} meta={{ part, mode: 'answer', question: questions[i], promptId }} maxSeconds={maxSeconds} hint={hint} onResult={(s) => { setResults((x) => ({ ...x, [i]: s })); done() }} />
      )}
    </Page>
  )
}

function Part1Practice() {
  const { id } = useParams()
  const q = usePrompts()
  if (q.isLoading) return <PageLoader />
  const p = q.data?.part1.find((x) => x.id === id)
  if (!p) return <Page><EmptyState icon={Mic} title="Topic not found" action={<Link to="/speak/practice" className="btn btn-primary">Back</Link>} /></Page>
  return <QuestionRun title={p.topic} eyebrow="Part 1 · Interview" questions={p.questions} part={1} promptId={p.id} maxSeconds={60} hint="Answer in 2–3 sentences: a direct answer, a reason, and an example." />
}

function Part3Practice() {
  const { id } = useParams()
  const q = usePrompts()
  if (q.isLoading) return <PageLoader />
  const p = q.data?.part2.find((x) => x.id === id)
  if (!p) return <Page><EmptyState icon={MessagesSquare} title="Topic not found" action={<Link to="/speak/practice" className="btn btn-primary">Back</Link>} /></Page>
  return <QuestionRun title={p.title} eyebrow="Part 3 · Discussion" questions={p.part3} part={3} promptId={p.id} maxSeconds={120} hint="Give your opinion, explain why, compare viewpoints, and give an example." />
}

/** Cue card: one minute of preparation with notes, then up to two minutes of speaking. */
function Part2Practice() {
  const { id } = useParams()
  const q = usePrompts()
  const done = useInvalidateOverview()
  const [stage, setStage] = useState<'intro' | 'prep' | 'speak'>('intro')
  const [prepEnds, setPrepEnds] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<SpeakingSession | null>(null)
  const left = useCountdown(prepEnds)
  useEffect(() => {
    if (stage === 'prep' && prepEnds && left <= 0) setStage('speak')
  }, [stage, prepEnds, left])
  if (q.isLoading) return <PageLoader />
  const p = q.data?.part2.find((x) => x.id === id)
  if (!p) return <Page><EmptyState icon={Mic} title="Cue card not found" action={<Link to="/speak/practice" className="btn btn-primary">Back</Link>} /></Page>
  const card = (
    <div className="card border-2 border-primary/30 p-5">
      <p className="text-lg font-bold">{p.cue}</p>
      <p className="mt-2 text-sm text-muted">You should say:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">{p.points.map((x) => <li key={x}>{x}</li>)}</ul>
      <p className="mt-1">{p.explain}</p>
    </div>
  )
  return (
    <Page width="max-w-3xl">
      <PageHeader eyebrow="Part 2 · Cue card" title={p.title} back={{ to: '/speak/practice', label: 'Speaking practice' }} />
      {card}
      <div className="mt-4">
        {result ? (
          <>
            <SpeakingResult s={result} onUpdate={setResult} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/speak/practice/part3/${p.id}`} className="btn btn-primary">Continue to Part 3 questions</Link>
              <button className="btn btn-secondary" onClick={() => { setResult(null); setStage('intro'); setPrepEnds(null) }}>Try again</button>
            </div>
          </>
        ) : stage === 'intro' ? (
          <div className="card flex flex-col items-center gap-3 p-6 text-center">
            <Timer className="size-8 text-primary" />
            <p className="max-w-md text-sm text-muted">You’ll have <b className="text-text">1 minute</b> to prepare (you can make notes), then up to <b className="text-text">2 minutes</b> to speak. Try to keep going for the full time.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn btn-primary" onClick={() => { setPrepEnds(Date.now() + 60_000); setStage('prep') }}>Start 1-minute preparation</button>
              <button className="btn btn-ghost" onClick={() => setStage('speak')}>Skip preparation</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {stage === 'prep' && (
              <div className="card flex items-center gap-3 p-4">
                <Clock className="size-5 text-primary" />
                <p className="flex-1 font-bold tabular-nums" aria-live="polite">Preparation: {mmss(left)}</p>
                <button className="btn btn-secondary btn-sm" onClick={() => setStage('speak')}>I’m ready</button>
              </div>
            )}
            <label className="block">
              <span className="text-sm font-semibold">Your notes {stage === 'speak' && <span className="font-normal text-muted">(keep them in view while you talk)</span>}</span>
              <textarea className="input mt-1 min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Key words only: who / what / when / why…" />
            </label>
            {stage === 'speak' && <RecordPanel meta={{ part: 2, mode: 'answer', question: `${p.cue} ${p.points.join('; ')} ${p.explain}`, promptId: p.id }} maxSeconds={120} hint="Tap the microphone and talk for up to 2 minutes. Recording stops automatically at 2:00." onResult={(s) => { setResult(s); done() }} />}
          </div>
        )}
      </div>
    </Page>
  )
}

function ReadAloud() {
  const q = usePrompts()
  const [i, setI] = useState(0)
  const [result, setResult] = useState<SpeakingSession | null>(null)
  if (q.isLoading) return <PageLoader />
  if (q.error) return <Page><ErrorState error={q.error} /></Page>
  const items = q.data!.readAloud
  const s = items[i]
  return (
    <Page width="max-w-3xl">
      <PageHeader eyebrow="Clarity check" title="Read aloud" back={{ to: '/speak/practice', label: 'Speaking practice' }} subtitle="Read the sentence naturally. We check which words a speech recogniser understood — a quick, honest proxy for clarity, not an official pronunciation score." />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {items.map((x, n) => <button key={x.id} onClick={() => { setI(n); setResult(null) }} className={cx('chip', n === i && 'chip-on')}>{n + 1} · {x.level}</button>)}
      </div>
      <div className="card mb-4 p-6"><p className="text-xl font-semibold leading-relaxed">{s.text}</p></div>
      {result ? (
        <>
          <SpeakingResult s={result} onUpdate={setResult} />
          <div className="mt-4 flex gap-2">
            <button className="btn btn-secondary" onClick={() => setResult(null)}>Try again</button>
            {i < items.length - 1 && <button className="btn btn-primary" onClick={() => { setI(i + 1); setResult(null) }}>Next sentence</button>}
          </div>
        </>
      ) : (
        <RecordPanel key={s.id} compact meta={{ part: 0, mode: 'read-aloud', question: s.text }} maxSeconds={30} onResult={setResult} hint="Tap the microphone, read the sentence, then tap again." />
      )}
    </Page>
  )
}

function HistoryList() {
  const q = useQuery({ queryKey: ['speaking-history'], queryFn: () => api<SpeakingSession[]>('/speaking/history') })
  return (
    <Page width="max-w-3xl">
      <PageHeader title="Speaking history" back={{ to: '/speak/practice', label: 'Speaking practice' }} subtitle="Transcripts and feedback from your recorded answers. Audio is never stored." />
      {q.isLoading ? <PageLoader /> : q.error ? <ErrorState error={q.error} /> : !q.data!.length ? (
        <EmptyState icon={Mic} title="No recordings yet" body="Your analysed answers will appear here." action={<Link to="/speak/practice" className="btn btn-primary">Start practising</Link>} />
      ) : (
        <ul className="space-y-2">
          {q.data!.map((s) => (
            <li key={s.id}>
              <Link to={`/speak/practice/history/${s.id}`} className="card flex items-center gap-3 p-4 hover:border-primary/40">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.question}</span>
                  <span className="text-sm text-muted">{s.mode === 'read-aloud' ? 'Read aloud' : `Part ${s.part}`} · {Math.round(s.durationS)} s · {new Date(s.createdAt).toLocaleDateString()}{s.mockAttemptId ? ' · mock test' : ''}</span>
                </span>
                {s.aiFeedback && <Badge tone="primary">AI</Badge>}
                <ChevronRight className="size-5 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

function HistoryItem() {
  const { id } = useParams()
  const nav = useNavigate()
  const q = useQuery({ queryKey: ['speaking', id], queryFn: () => api<SpeakingSession>(`/speaking/${id}`) })
  const qc = useQueryClient()
  if (q.isLoading) return <PageLoader />
  if (q.error) return <Page><ErrorState error={q.error} onRetry={() => nav('/speak/practice/history')} /></Page>
  const s = q.data!
  return (
    <Page width="max-w-3xl">
      <PageHeader eyebrow={s.mode === 'read-aloud' ? 'Read aloud' : `Part ${s.part}`} title={s.question} back={{ to: '/speak/practice/history', label: 'History' }} />
      <SpeakingResult s={s} onUpdate={(n) => { qc.setQueryData(['speaking', id], n); qc.invalidateQueries({ queryKey: ['speaking-history'] }) }} />
    </Page>
  )
}
