import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, CreditCard, Flame, ShieldAlert, Swords } from 'lucide-react'
import { api, post } from '../../lib/api'
import { EmptyState, ErrorState, Page, PageHeader, PageLoader, cx } from '../../components/ui'

type Item = { id: number; kind: string; title: string; body: string | null; link: string | null; readAt: number | null; createdAt: number }

const ICON: Record<string, typeof Bell> = { reminder: Flame, billing: CreditCard, moderation: ShieldAlert, safety: ShieldAlert, battle: Swords }

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(t).toLocaleDateString()
}

export default function Notifications() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ items: Item[]; unread: number }>('/notifications') })
  // Opening the page marks everything as read (after it has been shown once).
  useEffect(() => {
    if (!q.data?.unread) return
    const t = window.setTimeout(() => void post('/notifications/read').then(() => qc.invalidateQueries({ queryKey: ['notifications'] })), 1500)
    return () => window.clearTimeout(t)
  }, [q.data?.unread, qc])
  return (
    <Page width="max-w-2xl">
      <PageHeader title="Notifications" action={q.data?.unread ? <button className="btn btn-ghost btn-sm" onClick={() => post('/notifications/read').then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))}><CheckCheck className="size-4" /> Mark all read</button> : undefined} />
      {q.isLoading ? <PageLoader /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data!.items.length ? (
        <EmptyState icon={Bell} title="No notifications yet" body={<>Reminders, plan changes and safety notices appear here. Set a daily reminder in <Link to="/profile/notifications" className="link">settings</Link>.</>} />
      ) : (
        <ul className="card divide-y divide-border overflow-hidden">
          {q.data!.items.map((n) => {
            const Icon = ICON[n.kind] ?? Bell
            const body = (
              <>
                <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', n.readAt ? 'bg-surface-2 text-muted' : 'bg-primary-soft text-primary')}><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block', !n.readAt && 'font-bold')}>{n.title}</span>
                  {n.body && <span className="block text-sm text-muted">{n.body}</span>}
                  <span className="block text-xs text-faint">{ago(n.createdAt)}</span>
                </span>
                {!n.readAt && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              </>
            )
            return <li key={n.id}>{n.link ? <Link to={n.link} className="flex gap-3 p-4 hover:bg-surface-2">{body}</Link> : <div className="flex gap-3 p-4">{body}</div>}</li>
          })}
        </ul>
      )}
    </Page>
  )
}
