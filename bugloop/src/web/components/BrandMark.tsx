// The Bugloop mark: a loop that closes on itself, the report-to-verification cycle.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" role="img" aria-label="Bugloop">
      <defs>
        <linearGradient id="bl-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7187ff" />
          <stop offset="1" stopColor="#3a4fe0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#bl-mark)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="rgba(255,255,255,0.25)" />
      <path d="M22.5 11.2a8 8 0 1 0 1.3 6.3" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M19.4 9.6l3.4 1.5-1.1 3.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="2.6" fill="#fff" />
    </svg>
  );
}
