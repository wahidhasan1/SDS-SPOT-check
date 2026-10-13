import { useEffect, useRef, useState } from 'react'
import { Headphones, Pause, Play } from 'lucide-react'
import { ApiError, post } from '../../lib/api'
import { ErrorState, Progress, Spinner, cx } from '../../components/ui'

type Item = { id: string; section: string; index: number; total: number; prompt: string; passage: string | null; audio: string | null; options: string[] }
export type AssessmentResult = { level: string; score: number; sections: Record<string, { correct: number; total: number }> }

const SECTION_LABEL: Record<string, string> = { vocabulary: 'Vocabulary', grammar: 'Grammar', reading: 'Reading', listening: 'Listening' }

/** Plays a short clip; placement allows at most two plays per item. */
function ClipPlayer({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [plays, setPlays] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [err, setErr] = useState(false)
  const max = 2
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
      <audio ref={ref} src={src} preload="auto" onPlay={() => setPlaying(true)} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onError={() => setErr(true)} />
      <button
        className="btn btn-primary size-12 rounded-full p-0"
        disabled={err || (!playing && plays >= max)}
        onClick={() => {
          const a = ref.current!
          if (playing) return a.pause()
          a.currentTime = 0
          void a.play().then(() => setPlays((p) => p + 1)).catch(() => setErr(true))
        }}
        aria-label={playing ? 'Pause' : 'Play recording'}
      >
        {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
      <div className="text-sm">
        <p className="flex items-center gap-1.5 font-bold"><Headphones className="size-4" /> Listen, then answer</p>
        <p className="text-muted">{err ? 'The audio could not be loaded.' : `You can play it ${max} times (${Math.max(0, max - plays)} left).`}</p>
      </div>
    </div>
  )
}

export function Assessment({ onDone }: { onDone: (r: AssessmentResult) => void }) {
  const [id, setId] = useState<string | null>(null)
  const [item, setItem] = useState<Item | null>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const start = async () => {
    setError(null)
    try {
      const r = await post<{ id: string; item: Item }>('/assessment/start')
      setId(r.id)
      setItem(r.item)
    } catch (e) {
      setError(e)
    }
  }
  useEffect(() => {
    void start()
  }, [])

  const submit = async () => {
    if (choice === null || !item || !id) return
    setBusy(true)
    try {
      const r = await post<{ done: boolean; item?: Item; result?: AssessmentResult }>('/assessment/answer', { assessmentId: id, itemId: item.id, choice })
      setChoice(null)
      if (r.done && r.result) onDone(r.result)
      else if (r.item) setItem(r.item)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'stale') void start()
      else setError(e)
    } finally {
      setBusy(false)
    }
  }

  if (error) return <ErrorState error={error} onRetry={start} title="The level check couldn’t continue" />
  if (!item) return <div className="flex justify-center py-16"><Spinner className="size-7" /></div>

  return (
    <div className="fade-up" key={item.id}>
      <div className="mb-5">
        <div className="mb-2 flex justify-between text-sm font-semibold">
          <span className="text-primary">{SECTION_LABEL[item.section]}</span>
          <span className="text-muted">Question {item.index} of {item.total}</span>
        </div>
        <Progress value={item.index - 1} max={item.total} label="Level check progress" />
      </div>
      {item.audio && <div className="mb-4"><ClipPlayer key={item.audio} src={item.audio} /></div>}
      {item.passage && <blockquote className="mb-4 rounded-2xl border-l-4 border-primary bg-surface-2 p-4 text-[15px] leading-relaxed">{item.passage}</blockquote>}
      <p className="text-lg font-bold">{item.prompt}</p>
      <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Answers">
        {item.options.map((o, i) => (
          <button
            key={i}
            role="radio"
            aria-checked={choice === i}
            onClick={() => setChoice(i)}
            className={cx('flex min-h-12 items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-[15px] font-medium transition-colors', choice === i ? 'border-primary bg-primary-soft text-text' : 'border-border bg-surface hover:border-primary/50')}
          >
            <span className={cx('grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold', choice === i ? 'border-primary bg-primary text-on-primary' : 'border-border text-muted')}>{String.fromCharCode(65 + i)}</span>
            {o}
          </button>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Not sure? Choose your best guess — the test adapts to you.</p>
        <button className="btn btn-primary min-w-28" onClick={submit} disabled={choice === null || busy}>
          {busy ? <Spinner className="size-4 text-on-primary" /> : item.index === item.total ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  )
}
