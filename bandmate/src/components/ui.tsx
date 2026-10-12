import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, Bird, Cat, CheckCircle2, Cloud, Dog, Feather, Fish, Flower2, Info, Leaf, Loader2, Lock, Moon, Mountain, Rabbit, Snail, Squirrel, Star, Sun, Turtle, WifiOff, X, XCircle, type LucideIcon,
} from 'lucide-react'
import { CEFR_INFO, type Cefr } from '../../shared/config'
import { ApiError } from '../lib/api'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function Spinner({ className = 'size-5', label = 'Loading' }: { className?: string; label?: string }) {
  return <Loader2 className={cx('animate-spin text-muted', className)} aria-label={label} role="status" />
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-muted">
      <Spinner className="size-7" />
      {label}
    </div>
  )
}

export function Page({ children, className, width = 'max-w-5xl' }: { children: ReactNode; className?: string; width?: string }) {
  return <div className={cx('mx-auto w-full px-4 pb-28 pt-5 sm:px-6 md:pb-12 md:pt-8 fade-up', width, className)}>{children}</div>
}

export function PageHeader({ title, subtitle, back, action, eyebrow }: { title: ReactNode; subtitle?: ReactNode; back?: { to: string; label: string }; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6">
      {back && (
        <Link to={back.to} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-text">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">{eyebrow}</p>}
          <h1 className="h1">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}

const TONES = {
  neutral: 'bg-surface-2 text-muted',
  primary: 'bg-primary-soft text-primary',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  talk: 'bg-talk-soft text-talk',
}
export type Tone = keyof typeof TONES

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', TONES[tone], className)}>{children}</span>
}

export function LevelBadge({ level, className }: { level: string | null | undefined; className?: string }) {
  if (!level) return <Badge className={className}>Level not set</Badge>
  return (
    <Badge tone="primary" className={className}>
      {level} · {CEFR_INFO[level as Cefr]?.name}
    </Badge>
  )
}

const ICONS: Record<string, LucideIcon> = { bird: Bird, cat: Cat, dog: Dog, fish: Fish, rabbit: Rabbit, squirrel: Squirrel, turtle: Turtle, snail: Snail, feather: Feather, leaf: Leaf, flower: Flower2, sun: Sun, moon: Moon, star: Star, cloud: Cloud, mountain: Mountain }

export function Avatar({ icon, color, size = 44, className, label }: { icon: string; color: string; size?: number; className?: string; label?: string }) {
  const Icon = ICONS[icon] ?? Star
  return (
    <span className={cx('inline-grid shrink-0 place-items-center rounded-full text-white', className)} style={{ width: size, height: size, background: color }} role={label ? 'img' : undefined} aria-label={label}>
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} />
    </span>
  )
}

export function Progress({ value, max = 100, tone = 'primary', className, label }: { value: number; max?: number; tone?: 'primary' | 'good' | 'talk' | 'warn'; className?: string; label?: string }) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const bar = { primary: 'bg-primary', good: 'bg-good', talk: 'bg-talk', warn: 'bg-warn' }[tone]
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', bar)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string | null; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, items, className, label }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[]; className?: string; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex rounded-xl bg-surface-2 p-1', className)}>
      {items.map((it) => (
        <button
          key={it.id}
          role="radio"
          aria-checked={value === it.id}
          onClick={() => onChange(it.id)}
          className={cx('h-9 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors', value === it.id ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
        <Icon className="size-7" />
      </span>
      <p className="mt-4 text-lg font-bold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = "We couldn't load this" }: { error: unknown; onRetry?: () => void; title?: string }) {
  const offline = error instanceof ApiError && error.code === 'offline'
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-bad-soft text-bad">{offline ? <WifiOff className="size-6" /> : <AlertTriangle className="size-6" />}</span>
      <p className="mt-3 font-bold">{offline ? 'You are offline' : title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{error instanceof Error ? error.message : 'Something went wrong.'}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm mt-4" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

/** Honest notice for features that need an external service the server doesn't have configured. */
export function NotConfigured({ feature, children }: { feature: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-4 text-sm text-warn">
      <Info className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-bold">{feature} isn’t available on this server yet</p>
        <p className="mt-0.5 opacity-90">{children ?? 'The administrator needs to configure it. Everything else keeps working.'}</p>
      </div>
    </div>
  )
}

export function LimitNotice({ message }: { message: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/25 bg-primary-soft p-4 text-sm">
      <Lock className="size-5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 font-medium text-text">{message}</p>
      <Link to="/account/plan" className="btn btn-primary btn-sm">
        See plans
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------- Modal
export function Modal({ open, onClose, title, children, footer, size = 'md', dismissible = true }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg'; dismissible?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose()
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button')?.focus(), 30)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus()
    }
  }, [open, onClose, dismissible])
  if (!open) return null
  const w = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-black/45 fade-up" onClick={dismissible ? onClose : undefined} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className={cx('relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface shadow-[var(--shadow-pop)] fade-up sm:rounded-3xl', w)}>
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
          <h2 id={id} className="h2">
            {title}
          </h2>
          {dismissible && (
            <button className="btn btn-ghost btn-sm -mr-2 size-9 p-0" onClick={onClose} aria-label="Close">
              <X className="size-5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Toasts & confirm (tiny external store)
type Toast = { id: number; tone: 'good' | 'bad' | 'info'; text: string }
let toasts: Toast[] = []
let seq = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach((s) => s())
export function toast(text: string, tone: Toast['tone'] = 'good') {
  const id = ++seq
  toasts = [...toasts.filter((t) => t.text !== text), { id, tone, text }].slice(-3)
  emit()
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, tone === 'bad' ? 5000 : 2800)
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => void subs.delete(cb)
    },
    () => toasts,
  )
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      {list.map((t) => {
        const Icon = t.tone === 'good' ? CheckCircle2 : t.tone === 'bad' ? XCircle : Info
        return (
          <div key={t.id} className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl bg-text px-4 py-3 text-sm font-semibold text-bg shadow-[var(--shadow-pop)] fade-up">
            <Icon className={cx('size-5 shrink-0', t.tone === 'good' ? 'text-good' : t.tone === 'bad' ? 'text-bad' : 'text-primary')} />
            {t.text}
          </div>
        )
      })}
    </div>
  )
}

type ConfirmReq = { title: string; body?: ReactNode; confirm: string; tone?: 'danger' | 'primary'; resolve: (v: boolean) => void }
let confirmReq: ConfirmReq | null = null
const confirmSubs = new Set<() => void>()
export const confirmDialog = (r: Omit<ConfirmReq, 'resolve'>) =>
  new Promise<boolean>((resolve) => {
    confirmReq = { ...r, resolve }
    confirmSubs.forEach((s) => s())
  })

export function ConfirmHost() {
  const req = useSyncExternalStore(
    (cb) => {
      confirmSubs.add(cb)
      return () => void confirmSubs.delete(cb)
    },
    () => confirmReq,
  )
  const close = (v: boolean) => {
    req?.resolve(v)
    confirmReq = null
    confirmSubs.forEach((s) => s())
  }
  return (
    <Modal
      open={!!req}
      onClose={() => close(false)}
      title={req?.title}
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={() => close(false)}>
            Cancel
          </button>
          <button className={cx('btn', req?.tone === 'danger' ? 'btn-danger' : 'btn-primary')} onClick={() => close(true)} data-autofocus>
            {req?.confirm}
          </button>
        </>
      }
    >
      {req?.body && <div className="text-[15px] text-muted">{req.body}</div>}
    </Modal>
  )
}

export function useCountdown(endsAt: number | null) {
  const [left, setLeft] = useState(() => (endsAt ? Math.max(0, endsAt - Date.now()) : 0))
  useEffect(() => {
    if (!endsAt) return
    const tick = () => setLeft(Math.max(0, endsAt - Date.now()))
    tick()
    const t = window.setInterval(tick, 250)
    return () => window.clearInterval(t)
  }, [endsAt])
  return left
}

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
