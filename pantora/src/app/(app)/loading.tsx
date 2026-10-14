export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-40 animate-pulse rounded-card bg-surface-muted" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-card bg-surface-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-card bg-surface-muted" />
    </div>
  );
}
