import { useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Lightbulb, ShieldCheck, Sparkles } from 'lucide-react'
import { ApiError, errorMessage, patch } from '../lib/api'
import { useConfig, useRefreshMe, useUser } from '../lib/session'
import { LimitNotice, NotConfigured, Spinner, cx, toast } from '../components/ui'

export type Note = { level: 'good' | 'warn' | 'tip'; text: string }

const NOTE_ICON = { good: CheckCircle2, warn: AlertTriangle, tip: Lightbulb }
const NOTE_TONE = { good: 'text-good', warn: 'text-warn', tip: 'text-primary' }

/** A list of rule-based check results (good / needs work / tip). */
export function Notes({ notes, empty = 'Nothing to flag here.' }: { notes: Note[]; empty?: string }) {
  if (!notes.length) return <p className="text-sm text-muted">{empty}</p>
  return (
    <ul className="space-y-2">
      {notes.map((n, i) => {
        const Icon = NOTE_ICON[n.level]
        return (
          <li key={i} className="flex gap-2 text-[15px]">
            <Icon className={cx('mt-0.5 size-4.5 shrink-0', NOTE_TONE[n.level])} aria-label={n.level === 'good' ? 'Good' : n.level === 'warn' ? 'Needs work' : 'Tip'} />
            <span>{n.text}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function BandPill({ band, label }: { band: number; label?: string }) {
  return (
    <span className="inline-flex flex-col items-center rounded-xl bg-primary-soft px-3 py-1.5 text-primary">
      <span className="text-xl font-extrabold tabular-nums">{band.toFixed(1)}</span>
      {label && <span className="text-[11px] font-semibold">{label}</span>}
    </span>
  )
}

/**
 * Wraps a "Get AI feedback" action with the honest states it needs: provider not configured,
 * consent to send text to the AI provider, daily plan limit reached, and errors.
 */
export function AiFeedbackGate({ what, run, children }: { what: string; run: () => Promise<unknown>; children?: ReactNode }) {
  const me = useUser()
  const cfg = useConfig()
  const refresh = useRefreshMe()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<ApiError | Error | null>(null)
  if (cfg.data && !cfg.data.features.aiFeedback)
    return <NotConfigured feature="AI feedback">An AI provider key (ANTHROPIC_API_KEY) hasn’t been set on the server, so AI feedback is switched off. The automatic checks on this page still work.</NotConfigured>
  const go = async () => {
    setBusy(true)
    setErr(null)
    try {
      if (!me.profile.aiConsent) {
        await patch('/me/profile', { aiConsent: true })
        await refresh()
      }
      await run()
    } catch (e) {
      setErr(e as Error)
      if (!(e instanceof ApiError && e.code === 'limit_reached')) toast(errorMessage(e), 'bad')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="card border-primary/25 p-5">
      <p className="flex items-center gap-2 font-bold"><Sparkles className="size-5 text-primary" /> AI feedback</p>
      <p className="mt-1 text-sm text-muted">{children ?? `Get criterion-by-criterion feedback on your ${what}, with an unofficial band estimate and corrections.`}</p>
      {!me.profile.aiConsent && (
        <p className="mt-3 flex gap-2 rounded-xl bg-surface-2 p-3 text-xs text-muted">
          <ShieldCheck className="size-4 shrink-0 text-good" />
          <span>Your {what} text will be sent to our AI provider (Anthropic) to generate feedback. It is not used to identify you. By continuing you agree to this; you can turn it off any time in Profile → Privacy.</span>
        </p>
      )}
      {err instanceof ApiError && err.code === 'limit_reached' ? (
        <div className="mt-3"><LimitNotice message={err.message} /></div>
      ) : (
        <button className="btn btn-primary mt-3" disabled={busy} onClick={go}>
          {busy ? <><Spinner className="size-4" /> Generating feedback…</> : me.profile.aiConsent ? 'Get AI feedback' : 'Agree and get AI feedback'}
        </button>
      )}
      {busy && <p className="mt-2 text-xs text-muted">This usually takes 10–40 seconds.</p>}
    </div>
  )
}
