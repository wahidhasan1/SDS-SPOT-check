import { useState } from 'react'
import { Mic, MicOff, ShieldCheck, Square, X } from 'lucide-react'
import { ApiError, errorMessage, patch } from '../../lib/api'
import { useConfig, useRefreshMe, useUser } from '../../lib/session'
import { LimitNotice, NotConfigured, Spinner, cx, mmss, toast } from '../../components/ui'
import { analyseSpeech, useRecorder, type SpeakingSession } from './recorder'

type Meta = Parameters<typeof analyseSpeech>[1]

/** Asks once for permission to analyse speech on our server. Nothing is recorded before this. */
export function SpeechConsent() {
  const refresh = useRefreshMe()
  const [busy, setBusy] = useState(false)
  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 font-bold"><ShieldCheck className="size-5 text-good" /> Allow speech analysis?</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        <li>When you record an answer, the audio is sent to our server and transcribed by a speech recogniser running on that server.</li>
        <li>The audio is deleted straight after processing. We keep only the transcript and timing measurements so you can see your progress.</li>
        <li>Nothing is sent to third parties unless you separately ask for AI feedback (and then only the transcript).</li>
      </ul>
      <button
        className="btn btn-primary mt-4"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await patch('/me/profile', { speechConsent: true })
            await refresh()
          } catch (e) {
            toast(errorMessage(e), 'bad')
          } finally {
            setBusy(false)
          }
        }}
      >
        I agree, allow speech analysis
      </button>
    </div>
  )
}

/** Record → analyse. Handles consent, permission, unsupported browsers, limits and server errors. */
export function RecordPanel({ meta, maxSeconds = 120, onResult, hint, compact = false }: { meta: Meta; maxSeconds?: number; onResult: (s: SpeakingSession) => void; hint?: string; compact?: boolean }) {
  const me = useUser()
  const cfg = useConfig()
  const rec = useRecorder({ maxMs: maxSeconds * 1000 })
  const [phase, setPhase] = useState<'ready' | 'analysing'>('ready')
  const [err, setErr] = useState<ApiError | Error | null>(null)

  if (cfg.data && !cfg.data.features.speechRecognition)
    return <NotConfigured feature="Speech recognition">The speech model files haven’t been downloaded on the server (run <code>npm run models</code>). Calling partners still works.</NotConfigured>
  if (!me.profile.speechConsent) return <SpeechConsent />

  const finish = async () => {
    const blob = await rec.stop()
    if (!blob) return
    setPhase('analysing')
    setErr(null)
    try {
      onResult(await analyseSpeech(blob, meta))
    } catch (e) {
      setErr(e as Error)
    } finally {
      setPhase('ready')
    }
  }

  if (phase === 'analysing')
    return (
      <div className={cx('card flex flex-col items-center gap-3 text-center', compact ? 'p-5' : 'p-8')} role="status">
        <Spinner className="size-8" />
        <p className="font-bold">Listening to your answer…</p>
        <p className="text-sm text-muted">Transcribing and measuring fluency. This takes a few seconds.</p>
      </div>
    )

  const recording = rec.state === 'recording'
  const left = Math.max(0, maxSeconds * 1000 - rec.elapsed)
  return (
    <div className={cx('card flex flex-col items-center gap-3 text-center', compact ? 'p-5' : 'p-8')}>
      {rec.state === 'unsupported' ? (
        <p className="text-sm text-bad">This browser can’t record audio. Please use a recent version of Chrome, Edge, Firefox or Safari.</p>
      ) : rec.state === 'denied' ? (
        <>
          <MicOff className="size-8 text-bad" />
          <p className="font-bold">Microphone blocked</p>
          <p className="max-w-sm text-sm text-muted">Allow microphone access for this site in your browser’s address bar or settings, then try again.</p>
          <button className="btn btn-secondary" onClick={() => rec.setState('idle')}>Try again</button>
        </>
      ) : (
        <>
          <button
            onClick={() => (recording ? void finish() : void rec.start())}
            disabled={rec.state === 'requesting'}
            className={cx('relative grid size-20 place-items-center rounded-full text-white shadow-lg transition', recording ? 'bg-bad' : 'bg-primary hover:scale-105')}
            aria-label={recording ? 'Stop recording and analyse' : 'Start recording'}
          >
            {recording && <span className="absolute inset-0 rounded-full bg-bad/40" style={{ transform: `scale(${1 + rec.level * 0.6})`, transition: 'transform 80ms' }} aria-hidden />}
            {recording ? <Square className="relative size-7 fill-current" /> : rec.state === 'requesting' ? <Spinner className="size-7" /> : <Mic className="relative size-8" />}
          </button>
          {recording ? (
            <>
              <p className="font-bold tabular-nums" aria-live="polite">Recording · {mmss(rec.elapsed)} <span className="font-normal text-muted">({mmss(left)} left)</span></p>
              <div className="flex gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => void finish()}>Stop & analyse</button>
                <button className="btn btn-ghost btn-sm" onClick={rec.cancel}><X className="size-4" /> Discard</button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">{hint ?? 'Tap the microphone and answer out loud. Tap again when you finish.'}</p>
          )}
          {rec.state === 'error' && <p className="text-sm text-bad">The microphone couldn’t be started. Check that no other app is using it.</p>}
        </>
      )}
      {err && (err instanceof ApiError && err.code === 'limit_reached' ? <LimitNotice message={err.message} /> : <p className="text-sm text-bad" role="alert">{errorMessage(err)}</p>)}
    </div>
  )
}
