import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Minus, Plus, Star, X, FlaskConical, PackageOpen, type LucideIcon } from 'lucide-react'
import { FALLBACK_ART } from '../data/images'
import { cx, hashStr, taka } from '../lib/format'

// ---------- Image with generated fallback ----------
export function Img({ src, alt, art, className, imgClassName }: { src: string; alt: string; art?: string; className?: string; imgClassName?: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(src ? 'loading' : 'error')
  useEffect(() => setState(src ? 'loading' : 'error'), [src])
  const fa = FALLBACK_ART[art ?? ''] ?? FALLBACK_ART.default
  const hue = (fa.hue + (hashStr(alt) % 30) - 15 + 360) % 360
  return (
    <div className={cx(!className?.includes('absolute') && 'relative', 'overflow-hidden bg-ink-100', className)}>
      {state !== 'ok' && (
        <div
          aria-hidden
          className={cx('absolute inset-0 flex items-center justify-center', state === 'loading' && 'skeleton rounded-none')}
          style={state === 'error' ? { containerType: 'size', background: `radial-gradient(circle at 30% 25%, hsl(${hue} 95% 88%), hsl(${(hue + 25) % 360} 85% 72%) 70%)` } : undefined}
        >
          {state === 'error' && (
            <>
              <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.9) 1.5px, transparent 1.6px)', backgroundSize: '14px 14px' }} />
              <span className="relative drop-shadow-[0_6px_10px_rgba(0,0,0,0.18)]" style={{ fontSize: 'clamp(1.6rem, 38cqmin, 4.2rem)' }}>{fa.emoji}</span>
            </>
          )}
        </div>
      )}
      {src && state !== 'error' && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          className={cx('size-full object-cover transition-opacity duration-500', state === 'ok' ? 'opacity-100' : 'opacity-0', imgClassName)}
        />
      )}
    </div>
  )
}

// ---------- Badges ----------
type Tone = 'brand' | 'sun' | 'success' | 'danger' | 'info' | 'neutral' | 'warning' | 'dark'
const toneCls: Record<Tone, string> = {
  brand: 'bg-brand-100 text-brand-700',
  sun: 'bg-sun-100 text-sun-800',
  success: 'bg-emerald-100 text-emerald-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-ink-100 text-ink-700',
  neutral: 'bg-ink-100 text-ink-700',
  warning: 'bg-amber-100 text-amber-800',
  dark: 'bg-ink-900/80 text-white backdrop-blur',
}
export const Badge = ({ tone = 'brand', children, className }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <span className={cx('badge', toneCls[tone], className)}>{children}</span>
)

export const DemoTag = ({ label = 'Demo', className }: { label?: string; className?: string }) => (
  <span className={cx('badge bg-amber-100 text-amber-800 border border-amber-200', className)}>
    <FlaskConical className="size-3" /> {label}
  </span>
)

// ---------- Rating ----------
export function Rating({ value, count, size = 'sm', className }: { value: number; count?: number; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 font-semibold text-ink-900', size === 'sm' ? 'text-[13px]' : 'text-sm', className)}>
      <Star className={cx('fill-amber-400 text-amber-400', size === 'sm' ? 'size-3.5' : 'size-4')} />
      {value.toFixed(1)}
      {count !== undefined && <span className="font-normal text-ink-500">({count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count})</span>}
    </span>
  )
}

export function Stars({ value, onChange, size = 20 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" disabled={!onChange} onClick={() => onChange?.(i)} aria-label={`${i} star`} className="disabled:cursor-default">
          <Star style={{ width: size, height: size }} className={cx('transition', i <= value ? 'fill-amber-400 text-amber-400' : 'text-ink-300')} />
        </button>
      ))}
    </div>
  )
}

// ---------- Price ----------
export function Price({ value, original, size = 'md', className }: { value: number; original?: number; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span className={cx('inline-flex items-baseline gap-1.5', className)}>
      <span className={cx('font-bold text-ink-900', size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-[15px]' : 'text-sm')}>{taka(value)}</span>
      {original !== undefined && original > value && <span className="text-[13px] text-ink-400 line-through">{taka(original)}</span>}
    </span>
  )
}

// ---------- Quantity stepper ----------
export function QtyStepper({ value, onChange, min = 0, max = 20, size = 'md' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'size-8' : 'size-10'
  return (
    <div className="inline-flex items-center rounded-full bg-white border border-ink-200 shadow-sm">
      <button type="button" aria-label="Decrease quantity" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min && min > 0} className={cx(s, 'grid place-items-center rounded-full text-brand-700 hover:bg-brand-50 disabled:text-ink-300')}>
        <Minus className="size-4" />
      </button>
      <span className={cx('min-w-7 text-center font-bold tabular-nums', size === 'sm' ? 'text-sm' : 'text-base')} aria-live="polite">{value}</span>
      <button type="button" aria-label="Increase quantity" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className={cx(s, 'grid place-items-center rounded-full text-brand-700 hover:bg-brand-50 disabled:text-ink-300')}>
        <Plus className="size-4" />
      </button>
    </div>
  )
}

// ---------- Skeletons ----------
export const Skeleton = ({ className }: { className?: string }) => <div className={cx('skeleton', className)} />

export const CardSkeleton = ({ tall }: { tall?: boolean }) => (
  <div className="card overflow-hidden">
    <Skeleton className={cx('rounded-none', tall ? 'aspect-[4/5]' : 'aspect-[16/9]')} />
    <div className="p-3.5 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  </div>
)

export function GridSkeleton({ count = 6, tall, className }: { count?: number; tall?: boolean; className?: string }) {
  return (
    <div className={className ?? 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}>
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} tall={tall} />)}
    </div>
  )
}

// ---------- Empty / error states ----------
export function EmptyState({ icon: Icon = PackageOpen, title, body, action, className, tone = 'brand' }: { icon?: LucideIcon; title: string; body?: ReactNode; action?: ReactNode; className?: string; tone?: 'brand' | 'danger' }) {
  return (
    <div className={cx('flex flex-col items-center text-center py-14 px-6 animate-fade-in', className)} role="status">
      <div className={cx('grid size-20 place-items-center rounded-full mb-5', tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600')}>
        <Icon className="size-9" strokeWidth={1.75} />
      </div>
      <h3 className="text-xl font-extrabold tracking-tight">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-[15px] text-ink-500">{body}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

// ---------- Modal / bottom sheet ----------
export function Modal({ open, onClose, title, children, footer, size = 'md', hideClose }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg'; hideClose?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !hideClose && onClose()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, hideClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-[2px] animate-fade-in" onClick={() => !hideClose && onClose()} />
      <div className={cx('relative w-full bg-white shadow-lift animate-slide-up flex flex-col max-h-[92dvh] rounded-t-3xl sm:rounded-3xl', size === 'sm' ? 'sm:max-w-md' : size === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl')}>
        <div className="sm:hidden mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-ink-200" />
        {(title || !hideClose) && (
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
            <div className="font-display text-lg font-bold">{title}</div>
            {!hideClose && (
              <button onClick={onClose} className="icon-btn -mr-2" aria-label="Close">
                <X className="size-5" />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-5 flex-1">{children}</div>
        {footer && <div className="border-t border-ink-100 px-5 py-4 pb-safe">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// ---------- Section header ----------
export function SectionHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-end justify-between gap-4 mb-4', className)}>
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// ---------- Horizontal scroller with arrows ----------
export function HScroll({ children, className, itemClass }: { children: ReactNode; className?: string; itemClass?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ l: false, r: true })
  const update = () => {
    const el = ref.current
    if (!el) return
    setEdges({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }
  useEffect(update, [])
  const by = (d: number) => ref.current?.scrollBy({ left: d * (ref.current.clientWidth * 0.8), behavior: 'smooth' })
  return (
    <div className={cx('relative group/h', className)}>
      <div ref={ref} onScroll={update} className={cx('flex gap-4 overflow-x-auto scrollbar-none snap-x scroll-px-4 -mx-4 px-4 pb-2', itemClass)}>
        {children}
      </div>
      {edges.l && (
        <button onClick={() => by(-1)} aria-label="Scroll left" className="hidden md:grid absolute -left-4 top-1/2 -translate-y-1/2 size-10 place-items-center rounded-full bg-white shadow-lift border border-ink-100 opacity-0 group-hover/h:opacity-100 transition">
          <ChevronLeft className="size-5" />
        </button>
      )}
      {edges.r && (
        <button onClick={() => by(1)} aria-label="Scroll right" className="hidden md:grid absolute -right-4 top-1/2 -translate-y-1/2 size-10 place-items-center rounded-full bg-white shadow-lift border border-ink-100 opacity-0 group-hover/h:opacity-100 transition">
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  )
}

// ---------- Tabs ----------
export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cx('flex gap-1 p-1 rounded-2xl bg-ink-100 overflow-x-auto scrollbar-none', className)} role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={cx('flex-1 min-w-fit px-3.5 h-9 rounded-xl text-[13px] font-semibold transition whitespace-nowrap', value === it.id ? 'bg-white shadow-sm text-ink-900' : 'text-ink-500 hover:text-ink-900')}
        >
          {it.label}
          {it.count !== undefined && <span className={cx('ml-1.5 rounded-full px-1.5 text-[11px]', value === it.id ? 'bg-brand-100 text-brand-700' : 'bg-ink-200 text-ink-500')}>{it.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ---------- Toggle ----------
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-ink-300')}>
      <span className={cx('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
    </button>
  )
}

// ---------- Field ----------
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
    </label>
  )
}

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className="inline-grid place-items-center rounded-full font-bold text-white shrink-0" style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}cc)`, fontSize: size * 0.38 }}>
      {initials}
    </span>
  )
}

export function StoreLogo({ emoji, initials, bg, size = 48, className }: { emoji?: string; initials?: string; bg: string; size?: number; className?: string }) {
  return (
    <span className={cx('inline-grid place-items-center rounded-2xl text-white font-display font-extrabold ring-4 ring-white shadow-card shrink-0', className)} style={{ width: size, height: size, background: `linear-gradient(140deg, ${bg}, ${bg}dd)`, fontSize: emoji ? size * 0.5 : size * 0.34 }}>
      {emoji ?? initials}
    </span>
  )
}

export function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="py-3 border-b border-ink-100 last:border-0">
      <p className="mb-2.5 text-sm font-bold">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

/** Short, non-blocking celebration burst (1.6s). */
export function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 8) * 0.15, color: ['#FFC233', '#0F9466', '#121513', '#FFE08A', '#6FC9A3'][i % 5], rot: (i * 47) % 360 })), [])
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`@keyframes dk-fall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(260px) rotate(540deg);opacity:0}}`}</style>
      {pieces.map((p, i) => <span key={i} className="absolute top-0 h-2.5 w-1.5 rounded-sm" style={{ left: `${p.left}%`, background: p.color, transform: `rotate(${p.rot}deg)`, animation: `dk-fall 1.6s ${p.delay * 0.6}s ease-in forwards` }} />)}
    </div>
  )
}
