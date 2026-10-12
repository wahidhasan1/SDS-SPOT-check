import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookmarkPlus, Brain, CalendarCheck, CheckCircle2, ChevronRight, Library, Search, Trash2, XCircle } from 'lucide-react'
import { CEFR_LEVELS } from '../../../shared/config'
import { api, del, errorMessage, post } from '../../lib/api'
import { AudioButton, SaveWordButton, WordCard, type Word } from '../../features/words'
import { Badge, EmptyState, ErrorState, Page, PageHeader, PageLoader, Progress, Spinner, confirmDialog, cx, toast } from '../../components/ui'

export default function Vocab() {
  return (
    <Routes>
      <Route index element={<VocabHome />} />
      <Route path="topic/:id" element={<TopicWords />} />
      <Route path="quiz" element={<Quiz />} />
      <Route path="saved" element={<Saved />} />
      <Route path="review" element={<Review />} />
      <Route path="word/:word" element={<Lookup />} />
    </Routes>
  )
}

type Topic = { id: string; label: string; total: number; seen: number; mastered: number }
type SavedResp = { due: number; items: { word: string; meaning: string; context: string | null; source: string; box: number; dueAt: number; correct: number; wrong: number; createdAt: number; ipa: string | null }[] }

function VocabHome() {
  const nav = useNavigate()
  const topics = useQuery({ queryKey: ['vocab-topics'], queryFn: () => api<Topic[]>('/vocab/topics') })
  const saved = useQuery({ queryKey: ['saved'], queryFn: () => api<SavedResp>('/vocab/saved') })
  const [q, setQ] = useState('')
  return (
    <Page>
      <PageHeader title="Vocabulary" subtitle="Learn words by topic, save new words and review them at the right time." />
      <form className="relative mb-6" onSubmit={(e) => (e.preventDefault(), q.trim() && nav(`/vocab/word/${encodeURIComponent(q.trim().toLowerCase())}`))}>
        <Search className="pointer-events-none absolute left-3.5 top-3 size-5 text-faint" />
        <input className="input pl-11" placeholder="Look up any English word" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Look up a word" />
      </form>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/vocab/quiz?kind=daily" className="card p-5 hover:border-primary/40">
          <CalendarCheck className="size-7 text-primary" />
          <p className="mt-3 font-bold">Daily challenge</p>
          <p className="text-sm text-muted">10 questions at your level. Weak words come back more often.</p>
        </Link>
        <Link to="/vocab/review" className="card p-5 hover:border-primary/40">
          <Brain className="size-7 text-talk" />
          <p className="mt-3 font-bold">Review {saved.data ? <Badge tone={saved.data.due ? 'talk' : 'neutral'}>{saved.data.due} due</Badge> : null}</p>
          <p className="text-sm text-muted">Spaced repetition: review saved words just before you forget them.</p>
        </Link>
        <Link to="/vocab/saved" className="card p-5 hover:border-primary/40">
          <BookmarkPlus className="size-7 text-good" />
          <p className="mt-3 font-bold">My words {saved.data && <span className="text-muted">({saved.data.items.length})</span>}</p>
          <p className="text-sm text-muted">Words you saved from lessons, calls and reading.</p>
        </Link>
      </div>
      <h2 className="h2 mb-3 mt-8">Topics</h2>
      {topics.isLoading ? <PageLoader /> : topics.error ? <ErrorState error={topics.error} onRetry={() => topics.refetch()} /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.data!.filter((t) => t.total > 0).map((t) => (
            <Link key={t.id} to={`/vocab/topic/${t.id}`} className="card flex flex-col gap-3 p-4 hover:border-primary/40">
              <div className="flex items-center justify-between">
                <p className="font-bold">{t.label}</p>
                <ChevronRight className="size-5 text-faint" />
              </div>
              <Progress value={t.mastered} max={t.total} tone="good" label={`${t.label} mastered`} />
              <p className="text-xs text-muted">{t.mastered} of {t.total} words mastered · {t.seen} practised</p>
            </Link>
          ))}
        </div>
      )}
    </Page>
  )
}

function TopicWords() {
  const { id } = useParams()
  const [level, setLevel] = useState<string>('')
  const [open, setOpen] = useState<number | null>(null)
  const topics = useQuery({ queryKey: ['vocab-topics'], queryFn: () => api<Topic[]>('/vocab/topics') })
  const words = useQuery({ queryKey: ['words', id, level], queryFn: () => api<Word[]>(`/vocab/words?topic=${id}${level ? `&level=${level}` : ''}`) })
  const label = topics.data?.find((t) => t.id === id)?.label ?? 'Topic'
  return (
    <Page width="max-w-3xl">
      <PageHeader title={label} back={{ to: '/vocab', label: 'Vocabulary' }} action={<Link to={`/vocab/quiz?kind=vocab&topic=${id}`} className="btn btn-primary">Practise this topic</Link>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {['', ...CEFR_LEVELS].map((l) => <button key={l} onClick={() => setLevel(l)} className={cx('chip', level === l && 'chip-on')}>{l || 'All levels'}</button>)}
      </div>
      {words.isLoading ? <PageLoader /> : words.error ? <ErrorState error={words.error} /> : !words.data!.length ? <EmptyState icon={Library} title="No words at this level" body="Try another level." /> : (
        <div className="space-y-2">{words.data!.map((w) => <WordCard key={w.id} w={w} open={open === w.id} onToggle={() => setOpen(open === w.id ? null : w.id)} />)}</div>
      )}
    </Page>
  )
}

type QuizItem = { index: number; type: string; prompt: string; options: string[] | null; audio: string | null }
type QuizResp = { id: string; kind: string; items: QuizItem[]; answered: Record<string, { answer: string; correct: boolean }>; finished: boolean }
type Feedback = { correct: boolean; answer: string; explanation: string; word: string; score: number; done: boolean; total: number }

export function Quiz() {
  const [params] = useSearchParams()
  const kind = params.get('kind') === 'daily' ? 'daily' : 'vocab'
  const topic = params.get('topic') ?? undefined
  const qc = useQueryClient()
  const [quiz, setQuiz] = useState<QuizResp | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [i, setI] = useState(0)
  const [typed, setTyped] = useState('')
  const [fb, setFb] = useState<Feedback | null>(null)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<{ word: string; correct: boolean }[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const load = () => {
    setError(null)
    post<QuizResp>('/vocab/quiz', { kind, topic }).then((q) => {
      setQuiz(q)
      const first = q.items.findIndex((it) => !q.answered[it.index])
      setI(first < 0 ? q.items.length : first)
    }, setError)
  }
  useEffect(load, [kind, topic]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Page><ErrorState error={error} onRetry={load} /></Page>
  if (!quiz) return <PageLoader label="Preparing your questions…" />
  const item = quiz.items[i]
  const done = i >= quiz.items.length

  const answer = async (value: string) => {
    if (fb || busy) return
    setBusy(true)
    try {
      const r = await post<Feedback>(`/vocab/quiz/${quiz.id}/answer`, { index: item.index, answer: value })
      setFb(r)
      setResults((x) => [...x, { word: r.word, correct: r.correct }])
      if (r.done) qc.invalidateQueries({ queryKey: ['vocab-topics'] })
    } catch (e) {
      toast(errorMessage(e), 'bad')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    const answered = Object.values(quiz.answered).length ? Object.values(quiz.answered) : []
    const score = results.length ? results.filter((r) => r.correct).length + answered.filter((a) => a.correct).length : answered.filter((a) => a.correct).length
    return (
      <Page width="max-w-xl" className="text-center">
        <CheckCircle2 className="mx-auto size-14 text-good" />
        <h1 className="h1 mt-3">{kind === 'daily' ? 'Daily challenge complete' : 'Practice complete'}</h1>
        <p className="mt-2 text-4xl font-extrabold">{score} / {quiz.items.length}</p>
        {results.some((r) => !r.correct) && (
          <div className="card mt-6 p-4 text-left">
            <p className="font-bold">Words to review</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {results.filter((r) => !r.correct).map((r) => <SaveWordButton key={r.word} word={r.word} saved={false} source="quiz" />)}
            </div>
            <p className="mt-2 text-xs text-muted">Save them and they’ll come back in your reviews.</p>
          </div>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/vocab" className="btn btn-secondary">Back to vocabulary</Link>
          {kind === 'vocab' && <button className="btn btn-primary" onClick={() => (setQuiz(null), setResults([]), setFb(null), load())}>Another round</button>}
        </div>
      </Page>
    )
  }

  return (
    <Page width="max-w-xl">
      <div className="mb-5 flex items-center justify-between text-sm font-semibold">
        <Link to="/vocab" className="text-muted hover:text-text">✕ Quit</Link>
        <span className="text-muted">Question {i + 1} of {quiz.items.length}</span>
      </div>
      <Progress value={i + (fb ? 1 : 0)} max={quiz.items.length} className="mb-6" />
      <div className="fade-up" key={i}>
        <p className="text-xl font-bold">{item.prompt}</p>
        {item.audio && (
          <button className="btn btn-secondary mt-4" onClick={() => { audioRef.current?.pause(); audioRef.current = new Audio(item.audio!); void audioRef.current.play() }}>▶ Play the word</button>
        )}
        {item.options ? (
          <div className="mt-5 grid gap-2">
            {item.options.map((o) => {
              const isAnswer = fb && o.toLowerCase() === fb.answer.toLowerCase()
              return (
                <button key={o} disabled={!!fb || busy} onClick={() => answer(o)} className={cx('min-h-12 rounded-xl border px-4 py-3 text-left text-[15px] font-medium transition-colors', isAnswer ? 'border-good bg-good-soft' : fb ? 'border-border opacity-60' : 'border-border bg-surface hover:border-primary/60')}>
                  {o}
                </button>
              )
            })}
          </div>
        ) : (
          <form className="mt-5 flex gap-2" onSubmit={(e) => (e.preventDefault(), typed.trim() && answer(typed))}>
            <input className="input" autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!!fb} placeholder="Type what you hear" aria-label="Your answer" />
            <button className="btn btn-primary" disabled={!!fb || !typed.trim()}>Check</button>
          </form>
        )}
        {fb && (
          <div className={cx('mt-5 rounded-2xl p-4', fb.correct ? 'bg-good-soft' : 'bg-bad-soft')} role="status">
            <p className={cx('flex items-center gap-2 font-bold', fb.correct ? 'text-good' : 'text-bad')}>
              {fb.correct ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />} {fb.correct ? 'Correct!' : `Not quite. Answer: ${fb.answer}`}
            </p>
            <p className="mt-1 text-sm text-text/85">{fb.explanation}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AudioButton word={fb.word} />
              {!fb.correct && <SaveWordButton word={fb.word} saved={false} source="quiz" />}
              <button className="btn btn-primary ml-auto" autoFocus onClick={() => { setFb(null); setTyped(''); setI(i + 1) }}>{i + 1 === quiz.items.length ? 'See results' : 'Next'}</button>
            </div>
          </div>
        )}
      </div>
    </Page>
  )
}

function Saved() {
  const saved = useQuery({ queryKey: ['saved'], queryFn: () => api<SavedResp>('/vocab/saved') })
  const qc = useQueryClient()
  const [filter, setFilter] = useState('')
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const items = useMemo(() => (saved.data?.items ?? []).filter((w) => w.word.includes(filter.toLowerCase())), [saved.data, filter])
  const add = async () => {
    setBusy(true)
    try {
      const r = await post<{ word: string }>('/vocab/saved', { word, source: 'manual' })
      toast(`Saved “${r.word}”`)
      setWord('')
      qc.invalidateQueries({ queryKey: ['saved'] })
    } catch (e) {
      toast(errorMessage(e), 'bad')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Page width="max-w-3xl">
      <PageHeader title="My words" back={{ to: '/vocab', label: 'Vocabulary' }} action={saved.data?.due ? <Link to="/vocab/review" className="btn btn-primary">Review {saved.data.due} due</Link> : undefined} />
      <form className="mb-4 flex gap-2" onSubmit={(e) => (e.preventDefault(), word.trim() && void add())}>
        <input className="input" placeholder="Add a word or phrase" value={word} onChange={(e) => setWord(e.target.value)} maxLength={60} aria-label="Add a word" />
        <button className="btn btn-primary" disabled={busy || !word.trim()}>{busy ? <Spinner className="size-4 text-on-primary" /> : 'Add'}</button>
      </form>
      {saved.isLoading ? <PageLoader /> : saved.error ? <ErrorState error={saved.error} /> : !saved.data!.items.length ? (
        <EmptyState icon={BookmarkPlus} title="No saved words yet" body="Save words from lessons, quizzes, calls or photos you read. They’ll come back for review at the right time." action={<Link to="/vocab" className="btn btn-primary">Browse topics</Link>} />
      ) : (
        <>
          {saved.data!.items.length > 8 && <input className="input mb-3" placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter words" />}
          <div className="card divide-y divide-border">
            {items.map((w) => (
              <div key={w.word} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{w.word} {w.ipa && <span className="ml-1 font-mono text-xs font-normal text-muted">{w.ipa}</span>}</p>
                  <p className="text-sm text-muted">{w.meaning}</p>
                  {w.context && <p className="mt-1 line-clamp-2 text-xs italic text-faint">“{w.context}”</p>}
                  <p className="mt-1 text-xs text-muted">{w.dueAt <= Date.now() ? <span className="font-semibold text-talk">Due now</span> : `Next review ${new Date(w.dueAt).toLocaleDateString()}`} · Box {w.box}/6</p>
                </div>
                <AudioButton word={w.word} />
                <button className="btn btn-ghost size-9 p-0 text-muted" aria-label={`Remove ${w.word}`} onClick={async () => {
                  if (!(await confirmDialog({ title: `Remove “${w.word}”?`, confirm: 'Remove', tone: 'danger' }))) return
                  await del(`/vocab/saved/${encodeURIComponent(w.word)}`).then(() => qc.invalidateQueries({ queryKey: ['saved'] }), (e) => toast(errorMessage(e), 'bad'))
                }}><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </Page>
  )
}

type Card = { word: string; context: string | null; box: number; ipa: string | null; options: string[]; meaning: string }

function Review() {
  const qc = useQueryClient()
  const cards = useQuery({ queryKey: ['review'], queryFn: () => api<Card[]>('/vocab/review'), staleTime: Infinity })
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  if (cards.isLoading) return <PageLoader />
  if (cards.error) return <Page><ErrorState error={cards.error} /></Page>
  const list = cards.data!
  if (!list.length || i >= list.length)
    return (
      <Page width="max-w-xl">
        <EmptyState icon={Brain} title={list.length ? `Review done: ${score} / ${list.length}` : 'Nothing to review right now'} body={list.length ? 'Words you knew will come back later; missed words come back soon.' : 'Save more words, or come back when your next words are due.'} action={<Link to="/vocab" className="btn btn-primary" onClick={() => qc.invalidateQueries({ queryKey: ['saved'] })}>Back to vocabulary</Link>} />
      </Page>
    )
  const c = list[i]
  const choose = async (opt: string | null) => {
    if (picked !== null) return
    const knew = opt === c.meaning
    setPicked(opt ?? '')
    if (knew) setScore((s) => s + 1)
    await post('/vocab/review', { word: c.word, knew }).catch((e) => toast(errorMessage(e), 'bad'))
  }
  return (
    <Page width="max-w-xl">
      <div className="mb-5 flex items-center justify-between text-sm font-semibold">
        <Link to="/vocab" className="text-muted hover:text-text">✕ Stop</Link>
        <span className="text-muted">{i + 1} / {list.length}</span>
      </div>
      <div className="card p-6 text-center fade-up" key={c.word}>
        <p className="text-3xl font-extrabold">{c.word}</p>
        <div className="mt-1 flex items-center justify-center gap-1">{c.ipa && <span className="font-mono text-sm text-muted">{c.ipa}</span>}<AudioButton word={c.word} /></div>
        {c.context && <p className="mt-3 text-sm italic text-muted">“{c.context}”</p>}
      </div>
      <p className="mb-2 mt-5 text-sm font-semibold text-muted">What does it mean?</p>
      <div className="grid gap-2">
        {c.options.map((o) => (
          <button key={o} disabled={picked !== null} onClick={() => choose(o)} className={cx('rounded-xl border px-4 py-3 text-left text-[15px]', picked !== null && o === c.meaning ? 'border-good bg-good-soft' : picked === o ? 'border-bad bg-bad-soft' : 'border-border bg-surface hover:border-primary/50')}>{o}</button>
        ))}
        {picked === null && <button className="btn btn-ghost" onClick={() => choose(null)}>I don’t know</button>}
      </div>
      {picked !== null && <button className="btn btn-primary mt-5 w-full" autoFocus onClick={() => { setPicked(null); setI(i + 1) }}>Next</button>}
    </Page>
  )
}

function Lookup() {
  const { word } = useParams()
  const q = useQuery({ queryKey: ['lookup', word], queryFn: () => api<{ word: string; ipa: string | null; learner: Word | null; senses: { posLabel: string; definition: string; examples: string[]; synonyms: string[] }[] }>(`/vocab/lookup/${encodeURIComponent(word!)}`) })
  return (
    <Page width="max-w-2xl">
      <PageHeader title={q.data?.word ?? word} back={{ to: '/vocab', label: 'Vocabulary' }} />
      {q.isLoading ? <PageLoader /> : q.error ? <ErrorState error={q.error} title="Word not found" /> : (
        <>
          <div className="mb-4 flex items-center gap-2">
            {q.data!.ipa && <span className="font-mono text-muted">{q.data!.ipa}</span>}
            <AudioButton word={q.data!.word} />
            <SaveWordButton word={q.data!.word} saved={!!q.data!.learner?.saved} meaning={q.data!.learner?.definition ?? q.data!.senses[0]?.definition} />
          </div>
          {q.data!.learner && (
            <div className="card mb-4 border-primary/30 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Learner definition · {q.data!.learner.level}</p>
              <p className="mt-1 text-[15px]">{q.data!.learner.definition}</p>
              {q.data!.learner.examples.map((e) => <p key={e} className="mt-1 text-sm italic text-muted">{e}</p>)}
            </div>
          )}
          <div className="card divide-y divide-border">
            {q.data!.senses.map((s, i) => (
              <div key={i} className="p-4">
                <p className="text-xs font-bold uppercase text-muted">{s.posLabel}</p>
                <p className="mt-1 text-[15px]">{s.definition}</p>
                {s.examples.map((e) => <p key={e} className="mt-1 text-sm italic text-muted">“{e}”</p>)}
                {s.synonyms.length > 0 && <p className="mt-1 text-sm text-muted">Similar: {s.synonyms.join(', ')}</p>}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-faint">Dictionary senses: Princeton WordNet. Pronunciation: CMU Pronouncing Dictionary.</p>
        </>
      )}
    </Page>
  )
}
