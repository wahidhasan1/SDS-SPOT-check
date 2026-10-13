import { cx } from '../lib/format'

/** App icon: a lowercase "p" (stem + ring) on a jade tile, with the sun dot. Legible down to 16px. */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="18" fill="#0A7F57" />
      <rect x="17" y="17" width="9" height="36" rx="4.5" fill="#fff" />
      <circle cx="33.5" cy="30" r="11" fill="none" stroke="#fff" strokeWidth="9" />
      <circle cx="49" cy="15" r="5" fill="#FFC233" />
    </svg>
  )
}

/** Wordmark: "pikk" with the sun dot over the i. */
export function Wordmark({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cx('relative inline-flex items-baseline font-extrabold tracking-[-0.045em] leading-none', light ? 'text-white' : 'text-ink-900', className)} aria-label="pikk">
      <span aria-hidden>p</span>
      <span aria-hidden className="relative">
        ı
        <span className="absolute left-1/2 top-[0.02em] size-[0.2em] -translate-x-1/2 rounded-full bg-sun-400" />
      </span>
      <span aria-hidden>kk</span>
    </span>
  )
}

export function Logo({ compact, light, className }: { compact?: boolean; light?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <LogoMark size={compact ? 30 : 36} />
      <span className="leading-none">
        <Wordmark light={light} className={compact ? 'text-[22px]' : 'text-[26px]'} />
        {!compact && <span className={cx('block text-[11px] font-semibold mt-1', light ? 'text-white/75' : 'text-ink-500')}>Pick anything. Pay nothing.</span>}
      </span>
    </span>
  )
}
