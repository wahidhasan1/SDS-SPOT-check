import { appName } from '../lib/session'

/** Mark: a speech bubble holding three rising bars (speaking + band score progress). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 6h36a10 10 0 0 1 10 10v24a10 10 0 0 1-10 10H30l-11 9v-9h-5A10 10 0 0 1 4 40V16A10 10 0 0 1 14 6z" fill="var(--primary)" />
      <rect x="17" y="30" width="7" height="11" rx="3" fill="var(--on-primary)" />
      <rect x="28.5" y="23" width="7" height="18" rx="3" fill="var(--on-primary)" />
      <rect x="40" y="15" width="7" height="26" rx="3" fill="#FF8A63" />
    </svg>
  )
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="text-lg font-extrabold tracking-tight">{appName()}</span>
    </span>
  )
}
