import { useId } from 'react'
import { cx } from '../lib/format'

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const gid = `dk-g-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C3AED" />
          <stop offset=".55" stopColor="#B43EDB" />
          <stop offset="1" stopColor="#FF5A36" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${gid})`} />
      <path d="M13 33h38a19 19 0 0 1-38 0z" fill="#fff" />
      <path d="M22 50h20" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".55" />
      <path d="M32 9l2.8 6.9L41.7 18.7l-6.9 2.8L32 28.4l-2.8-6.9-6.9-2.8 6.9-2.8z" fill="#FFE8A3" />
      <circle cx="45" cy="14" r="2.8" fill="#fff" opacity=".9" />
      <circle cx="20" cy="24" r="2.2" fill="#fff" opacity=".7" />
    </svg>
  )
}

export function Logo({ compact, light, className }: { compact?: boolean; light?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={compact ? 32 : 38} />
      <span className="leading-none">
        <span className={cx('block font-display font-extrabold tracking-tight', compact ? 'text-[17px]' : 'text-xl', light ? 'text-white' : 'text-ink-900')}>
          Dopamine<span className={light ? 'text-coral-200' : 'text-brand-600'}> Kitchen</span>
        </span>
        {!compact && <span className={cx('block text-[11px] font-medium mt-1', light ? 'text-white/75' : 'text-ink-500')}>Feed the craving. Skip the delivery.</span>}
      </span>
    </span>
  )
}
