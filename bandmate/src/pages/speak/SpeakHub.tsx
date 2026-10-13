import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, History, Mic, Sparkles, Users } from 'lucide-react'
import { api } from '../../lib/api'
import { useUser } from '../../lib/session'
import { Badge, Page, PageHeader, Spinner, mmss } from '../../components/ui'
import { topicLabel } from './CallScreen'
import type { CallItem } from './CallHistory'

export default function SpeakHub() {
  const me = useUser()
  const status = useQuery({ queryKey: ['call-status'], queryFn: () => api<{ callsUsedToday: number; callsLimit: number; searchingNow: { casual: number; ielts: number } }>('/calls/status'), refetchInterval: 20_000 })
  const history = useQuery({ queryKey: ['call-history', 'recent'], queryFn: () => api<CallItem[]>('/calls/history?limit=3') })
  const s = status.data
  return (
    <Page>
      <PageHeader title="Speaking" subtitle="Talk with real learners, or practise on your own with feedback." />
      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/speak/call" className="card group relative overflow-hidden p-6 transition-colors hover:border-talk/50">
          <span className="grid size-14 place-items-center rounded-2xl bg-talk text-white"><Mic className="size-7" /></span>
          <p className="mt-4 text-xl font-extrabold">Find a speaking partner</p>
          <p className="mt-1 text-muted">A live, anonymous voice call with another learner near your level.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {s ? (
              <>
                <Badge tone="talk"><Users className="size-3.5" /> {s.searchingNow.casual + s.searchingNow.ielts} searching now</Badge>
                <Badge>{s.callsLimit === -1 ? 'Unlimited calls' : `${Math.max(0, s.callsLimit - s.callsUsedToday)} calls left today`}</Badge>
              </>
            ) : (
              <Spinner className="size-4" />
            )}
          </div>
          {!me.adult && <p className="mt-3 text-sm font-semibold text-warn">Voice calls are available from age 18.</p>}
        </Link>
        <Link to="/speak/practice" className="card p-6 transition-colors hover:border-primary/40">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary text-on-primary"><Sparkles className="size-7" /></span>
          <p className="mt-4 text-xl font-extrabold">Practise with AI</p>
          <p className="mt-1 text-muted">Answer IELTS Speaking questions, see your transcript and get feedback on fluency, vocabulary and grammar.</p>
          <p className="mt-4 text-sm font-semibold text-primary">No partner needed →</p>
        </Link>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="h2">Recent calls</h2>
          <Link to="/speak/history" className="link text-sm">All calls</Link>
        </div>
        {history.isLoading ? (
          <Spinner />
        ) : !history.data?.length ? (
          <div className="card flex items-center gap-3 p-5 text-sm text-muted"><History className="size-5" /> No calls yet. Your first conversation is one tap away.</div>
        ) : (
          <div className="card divide-y divide-border">
            {history.data.map((c) => (
              <Link key={c.id} to={`/speak/history/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{topicLabel(c.topic)} · {c.partner.anonName}</p>
                  <p className="text-sm text-muted">{new Date(c.createdAt).toLocaleString()} · {c.connected ? mmss(c.durationS * 1000) : 'Did not connect'}</p>
                </div>
                <ChevronRight className="size-5 text-faint" />
              </Link>
            ))}
          </div>
        )}
      </section>
      <p className="mt-6 text-sm text-muted">Please follow the <Link to="/guidelines" className="link">community guidelines</Link>. Manage blocked users in <Link to="/profile/privacy" className="link">Privacy & safety</Link>.</p>
    </Page>
  )
}
