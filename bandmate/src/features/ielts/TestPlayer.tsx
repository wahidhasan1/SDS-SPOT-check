import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Flag, Pause, Play, RotateCcw, RotateCw, Timer } from 'lucide-react'
import { api, errorMessage, patch, post } from '../../lib/api'
import { Badge, Segmented, Spinner, confirmDialog, cx, mmss, toast, useCountdown } from '../../components/ui'
import { QuestionGroup } from './Questions'
import { sectionsOf, type Attempt, type Section } from './types'

/** Plays one listening part. Exam mode: a single play, no pausing or seeking (enforced by the server too). */
export function AudioPart({ attempt, partIndex, part, onPlayed }: { attempt: Attempt; partIndex: number; part: Section; onPlayed: (p: number[]) => void }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [state, setState] = useState({ playing: false, t: 0, d: 0, error: false, loading: true })
  const exam = attempt.mode === 'exam'
  const played = attempt.played.includes(partIndex)
  const [rate, setRate] = useState(1)
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate
  }, [rate])
  const start = async () => {
    const a = ref.current!
    if (exam) {
      try {
        const r = await post<{ played: number[] }>(`/ielts/attempts/${attempt.id}/played`, { part: partIndex })
        onPlayed(r.played)
      } catch (e) {
        return toast(errorMessage(e), 'bad')
      }
    }
    await a.play().catch(() => setState((s) => ({ ...s, error: true })))
  }
  return (
    <div className="card p-4">
      <audio
        ref={ref}
        src={`/audio/listening/${part.id}.mp3`}
        preload="auto"
        onLoadedMetadata={(e) => setState((s) => ({ ...s, d: e.currentTarget.duration, loading: false }))}
        onTimeUpdate={(e) => setState((s) => ({ ...s, t: e.currentTarget.currentTime }))}
        onPlay={() => setState((s) => ({ ...s, playing: true }))}
        onPause={() => setState((s) => ({ ...s, playing: false }))}
        onEnded={() => setState((s) => ({ ...s, playing: false }))}
        onError={() => setState((s) => ({ ...s, error: true, loading: false }))}
      />
      <div className="flex items-center gap-3">
        {exam ? (
          <button className="btn btn-primary size-12 rounded-full p-0" disabled={played || state.loading || state.error} onClick={start} aria-label={`Play ${part.title}`}>
            <Play className="size-5" />
          </button>
        ) : (
          <>
            <button className="btn btn-ghost size-10 p-0" onClick={() => (ref.current!.currentTime = Math.max(0, state.t - 5))} aria-label="Back 5 seconds"><RotateCcw className="size-5" /></button>
            <button className="btn btn-primary size-12 rounded-full p-0" disabled={state.error} onClick={() => (state.playing ? ref.current!.pause() : void start())} aria-label={state.playing ? 'Pause' : 'Play'}>
              {state.playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            </button>
            <button className="btn btn-ghost size-10 p-0" onClick={() => (ref.current!.currentTime = Math.min(state.d, state.t + 5))} aria-label="Forward 5 seconds"><RotateCw className="size-5" /></button>
          </>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{part.title}</p>
          {exam || !state.d ? (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-primary transition-[width]" style={{ width: `${state.d ? (state.t / state.d) * 100 : 0}%` }} /></div>
          ) : (
            <input type="range" min={0} max={state.d} step={0.5} value={state.t} onChange={(e) => (ref.current!.currentTime = Number(e.target.value))} className="mt-1 w-full accent-[var(--primary)]" aria-label="Audio position" />
          )}
          <p className="mt-0.5 text-xs tabular-nums text-muted">{mmss(state.t * 1000)} / {state.d ? mmss(state.d * 1000) : '–:––'}</p>
        </div>
        {!exam && (
          <select className="input h-9 w-auto py-0 text-sm" value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Playback speed">
            {[0.75, 0.9, 1, 1.15].map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>
        )}
      </div>
      {state.error && <p className="mt-2 text-sm text-bad">The recording could not be loaded. Check your connection and reload the page.</p>}
      {exam && <p className="mt-2 text-xs text-muted">{played && !state.playing ? 'This recording has been played. In the exam you hear each part once.' : 'Exam mode: you can play this recording once. You can’t pause or rewind.'}</p>}
      {part.context && <p className="mt-2 text-sm text-muted">{part.context}</p>}
    </div>
  )
}

export function TestPlayer({ initial, onSubmitted, onExit }: { initial: Attempt; onSubmitted: (a: Attempt) => void; onExit: () => void }) {
  const [a, setA] = useState(initial)
  const [answers, setAnswers] = useState<Record<string, string>>(initial.answers)
  const [flagged, setFlagged] = useState<number[]>(initial.flagged)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved')
  const [submitting, setSubmitting] = useState(false)
  const allSections = sectionsOf(a.test)
  const visible = a.scope === null ? allSections.map((s, i) => ({ s, i })) : [{ s: allSections[a.scope], i: a.scope }]
  const [secIdx, setSecIdx] = useState(visible[0].i)
  const [mobileView, setMobileView] = useState<'passage' | 'questions'>('passage')
  const [current, setCurrent] = useState<number | null>(null)
  const isReading = a.kind === 'reading'
  const skew = useMemo(() => initial.serverNow - Date.now(), [initial.serverNow])
  const endsAt = a.startedAt + a.timeLimitS * 1000 - skew
  const left = useCountdown(endsAt)
  const startedLocal = useRef(Date.now())
  const answersRef = useRef(answers)
  answersRef.current = answers

  // Debounced autosave of answers and flags.
  const save = useCallback(async (ans: Record<string, string>, fl: number[]) => {
    setSaveState('saving')
    try {
      await patch(`/ielts/attempts/${a.id}`, { answers: ans, flagged: fl, timeSpentS: a.timeSpentS + Math.round((Date.now() - startedLocal.current) / 1000) })
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }, [a.id, a.timeSpentS])
  useEffect(() => {
    if (saveState !== 'dirty') return
    const t = window.setTimeout(() => void save(answers, flagged), 1200)
    return () => window.clearTimeout(t)
  }, [answers, flagged, saveState, save])

  const answer = (n: number, v: string) => {
    setAnswers((x) => ({ ...x, [n]: v }))
    setCurrent(n)
    setSaveState('dirty')
  }

  const submit = useCallback(async (auto = false) => {
    if (submitting) return
    if (!auto) {
      const unanswered = a.questionNumbers.filter((n) => !answers[n]?.trim()).length
      const ok = await confirmDialog({ title: 'Submit your answers?', body: <>You can’t change your answers after submitting.{unanswered > 0 && <><br /><b>{unanswered} question{unanswered > 1 ? 's are' : ' is'} unanswered.</b></>}{flagged.length > 0 && <><br />{flagged.length} marked for review.</>}</>, confirm: 'Submit' })
      if (!ok) return
    }
    setSubmitting(true)
    try {
      const r = await post<Attempt>(`/ielts/attempts/${a.id}/submit`, { answers: Object.fromEntries(Object.entries(answersRef.current).filter(([, v]) => v.trim())) })
      onSubmitted(r)
    } catch (e) {
      toast(errorMessage(e), 'bad')
      setSubmitting(false)
    }
  }, [a.id, a.questionNumbers, answers, flagged.length, onSubmitted, submitting])

  // Time's up: submit automatically (exam mode) or warn (practice).
  const warned = useRef(false)
  useEffect(() => {
    if (left > 0 || submitting) return
    if (a.mode === 'exam') {
      toast('Time is up. Your answers have been submitted.', 'info')
      void submit(true)
    } else if (!warned.current) {
      warned.current = true
      toast('Recommended time is over. You can keep going or submit.', 'info')
    }
  }, [left, a.mode, submit, submitting])

  useEffect(() => {
    const flush = () => document.visibilityState === 'hidden' && saveState === 'dirty' && void save(answersRef.current, flagged)
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [flagged, save, saveState])

  // Track which question has focus (for "mark for review").
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const el = (e.target as HTMLElement).closest('[id^="qq-"], [id^="q-"]')
      if (el) setCurrent(Number(el.id.replace(/^qq?-/, '')))
    }
    document.addEventListener('focusin', onFocus)
    return () => document.removeEventListener('focusin', onFocus)
  }, [])

  const sec = allSections[secIdx]
  const numbersFor = (i: number) => {
    const s = allSections[i]
    return s.groups.flatMap((g) => (g.type === 'gaps' || g.type === 'mcq_multi' ? g.numbers : g.questions.map((q) => q.n)))
  }
  const goTo = (n: number) => {
    const idx = visible.find(({ i }) => numbersFor(i).includes(n))?.i
    if (idx !== undefined && idx !== secIdx) setSecIdx(idx)
    setMobileView('questions')
    setCurrent(n)
    window.setTimeout(() => {
      const el = document.getElementById(`q-${n}`) ?? document.getElementById(`qq-${n}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      ;(document.getElementById(`q-${n}`) as HTMLElement | null)?.focus?.({ preventScroll: true })
    }, 60)
  }
  const toggleFlag = () => {
    if (!current) return toast('Tap a question first, then mark it for review.', 'info')
    setFlagged((f) => (f.includes(current) ? f.filter((x) => x !== current) : [...f, current]))
    setSaveState('dirty')
  }

  const passage = isReading && sec.paragraphs && (
    <article className="text-[15.5px] leading-relaxed">
      <h2 className="text-xl font-extrabold">{sec.title}</h2>
      {sec.intro && <p className="mt-1 text-sm text-muted">{sec.intro}</p>}
      <div className="mt-4 space-y-3">
        {sec.paragraphs.map((p, i) => (
          <p key={i}>{p.label && <b className="mr-2 text-primary">{p.label}</b>}{p.text}</p>
        ))}
      </div>
    </article>
  )
  const questions = (
    <div className="space-y-8">
      {!isReading && <AudioPart attempt={a} partIndex={secIdx} part={sec} onPlayed={(played) => setA((x) => ({ ...x, played }))} />}
      {sec.groups.map((g, i) => <QuestionGroup key={`${secIdx}-${i}`} group={g} answers={answers} onAnswer={answer} />)}
    </div>
  )

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 sm:px-5">
        <button className="btn btn-ghost btn-sm" onClick={onExit}>Exit</button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{a.test.title}</p>
          <p className="text-xs text-muted">{a.mode === 'exam' ? 'Exam mode' : 'Practice'} · {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? <span className="text-bad">Not saved — check connection</span> : saveState === 'dirty' ? 'Unsaved changes' : 'All answers saved'}</p>
        </div>
        <Badge tone={left < 5 * 60_000 ? 'bad' : 'neutral'} className="px-3 py-1.5 text-sm tabular-nums"><Timer className="size-4" /> {mmss(left)}</Badge>
        <button className="btn btn-primary btn-sm" onClick={() => submit()} disabled={submitting}>{submitting ? <Spinner className="size-4 text-on-primary" /> : 'Submit'}</button>
      </header>

      {visible.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface px-3 py-2 sm:px-5">
          {visible.map(({ i }) => (
            <button key={i} onClick={() => setSecIdx(i)} className={cx('chip shrink-0', secIdx === i && 'chip-on')}>{isReading ? `Passage ${i + 1}` : `Part ${i + 1}`}</button>
          ))}
        </div>
      )}

      {isReading ? (
        <>
          <div className="shrink-0 border-b border-border bg-surface px-3 py-2 md:hidden">
            <Segmented label="View" value={mobileView} onChange={setMobileView} items={[{ id: 'passage', label: 'Passage' }, { id: 'questions', label: 'Questions' }]} className="w-full" />
          </div>
          <div className="grid min-h-0 flex-1 md:grid-cols-2">
            <div className={cx('min-h-0 overflow-y-auto border-border px-4 py-5 sm:px-6 md:block md:border-r', mobileView === 'passage' ? 'block' : 'hidden')}>{passage}</div>
            <div className={cx('min-h-0 overflow-y-auto px-4 py-5 sm:px-6 md:block', mobileView === 'questions' ? 'block' : 'hidden')}>{questions}</div>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">{questions}</div></div>
      )}

      <nav className="shrink-0 border-t border-border bg-surface px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-5" aria-label="Questions">
        <div className="flex items-center gap-2">
          <button onClick={toggleFlag} className={cx('btn btn-sm shrink-0', current && flagged.includes(current) ? 'btn-secondary text-warn' : 'btn-ghost')} aria-pressed={!!current && flagged.includes(current)}>
            <Flag className="size-4" /> <span className="hidden sm:inline">{current && flagged.includes(current) ? 'Unmark' : 'Mark for review'}</span>
          </button>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-1">
            {a.questionNumbers.map((n) => {
              const done = !!answers[n]?.trim()
              const fl = flagged.includes(n)
              return (
                <button key={n} onClick={() => goTo(n)} aria-label={`Question ${n}${done ? ', answered' : ''}${fl ? ', marked for review' : ''}`} className={cx('relative grid size-8 shrink-0 place-items-center rounded-md text-xs font-bold', done ? 'bg-primary text-on-primary' : 'bg-surface-2 text-muted', current === n && 'ring-2 ring-primary ring-offset-1 ring-offset-surface')}>
                  {n}
                  {fl && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-surface bg-warn" />}
                </button>
              )
            })}
          </div>
          <span className="hidden shrink-0 text-xs font-semibold text-muted sm:block">{a.questionNumbers.filter((n) => answers[n]?.trim()).length}/{a.questionNumbers.length}</span>
        </div>
      </nav>
    </div>
  )
}

export async function loadAttempt(id: string) {
  return api<Attempt>(`/ielts/attempts/${id}`)
}
