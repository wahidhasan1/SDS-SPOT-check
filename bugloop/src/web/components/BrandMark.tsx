// The Bugloop mark: a loop that closes on itself, the report-to-verification cycle.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" role="img" aria-label="Bugloop">
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <path d="M22.5 11.2a8 8 0 1 0 1.3 6.3" fill="none" stroke="var(--text-inverse)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M19.4 9.6l3.4 1.5-1.1 3.6" fill="none" stroke="var(--text-inverse)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="2.6" fill="var(--text-inverse)" />
    </svg>
  );
}
