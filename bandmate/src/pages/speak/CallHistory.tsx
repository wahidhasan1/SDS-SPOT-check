import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { ChevronRight, Flag, History, Mic } from 'lucide-react'
import { api } from '../../lib/api'
import { Badge, EmptyState, ErrorState, Page, PageHeader, PageLoader, mmss } from '../../components/ui'
import { ReportModal, topicLabel } from './CallScreen'
import { endReasonText } from './CallSummary'

export type CallItem = {
  id: string
  mode: string
  topic: string
  status: string
  createdAt: number
  connected: boolean
  durationS: number
  endReason: string | null
  endedBy: string | null
  myRole: string | null
  partner: { anonName: string; level: string | null; formerMember: boolean }
  myFeedback: { rating: number | null; tags: string[]; selfAssessment: Record<string, number> | null } | null
  partnerTags: string[]
}

export default function CallHistory() {
  const { id } = useParams()
  return id ? <CallDetail id={id} /> : <CallList />
}

function CallList() {
  const q = useInfiniteQuery({
    queryKey: ['call-history'],
    queryFn: ({ pageParam }) => api<CallItem[]>(`/calls/history?limit=20${pageParam ? `&before=${pageParam}` : ''}`),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.length === 20 ? last[last.length - 1].createdAt : undefined),
  })
  const items = q.data?.pages.flat() ?? []
  return (
    <Page width="max-w-3xl">
      <PageHeader title="Call history" back={{ to: '/speak', label: 'Speaking' }} subtitle="Partners are shown by their anonymous names only." />
      {q.isLoading ? (
        <PageLoader />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !items.length ? (
        <EmptyState icon={History} title="No calls yet" body="When you talk with a partner, your calls appear here." action={<Link to="/speak/call" className="btn btn-talk"><Mic className="size-4" /> Find a partner</Link>} />
      ) : (
        <>
          <div className="card divide-y divide-border">
            {items.map((c) => (
              <Link key={c.id} to={`/speak/history/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{topicLabel(c.topic)}</p>
                  <p className="text-sm text-muted">{new Date(c.createdAt).toLocaleString()} · {c.partner.anonName}</p>
                </div>
                <div className="text-right">
                  {c.connected ? <p className="font-mono text-sm font-bold tabular-nums">{mmss(c.durationS * 1000)}</p> : <Badge tone="bad">No connection</Badge>}
                  {c.connected && <p className="text-xs text-muted">{c.durationS >= 60 ? 'Completed' : 'Short call'}</p>}
                </div>
                <ChevronRight className="size-5 text-faint" />
              </Link>
            ))}
          </div>
          {q.hasNextPage && <button className="btn btn-secondary mt-4 w-full" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>Load more</button>}
        </>
      )}
    </Page>
  )
}

function CallDetail({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['call', id], queryFn: () => api<CallItem>(`/calls/${id}`) })
  const [report, setReport] = useState(false)
  if (q.isLoading) return <PageLoader />
  if (q.error) return <Page><ErrorState error={q.error} /></Page>
  const c = q.data!
  return (
    <Page width="max-w-2xl">
      <PageHeader title={topicLabel(c.topic)} eyebrow={c.mode === 'ielts' ? 'IELTS Speaking practice' : 'Conversation'} back={{ to: '/speak/history', label: 'Call history' }} />
      <div className="card divide-y divide-border">
        {[
          ['Date', new Date(c.createdAt).toLocaleString()],
          ['Duration', c.connected ? mmss(c.durationS * 1000) : 'Did not connect'],
          ['Partner', `${c.partner.anonName}${c.partner.formerMember ? ' (account deleted)' : ''}${c.partner.level ? ` · ${c.partner.level}` : ''}`],
          ['Your role', c.myRole === 'candidate' ? 'Candidate' : c.myRole === 'examiner' ? 'Practice partner' : 'Speaker'],
          ['How it ended', c.endReason ? endReasonText(c.endReason, c.endedBy ?? '') : '—'],
          ['Your rating', c.myFeedback?.rating ? `${c.myFeedback.rating} / 5` : 'Not rated'],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-wrap justify-between gap-2 p-4 text-[15px]"><span className="text-muted">{k}</span><span className="max-w-[65%] text-right font-semibold">{v}</span></div>
        ))}
      </div>
      {c.partnerTags.length > 0 && (
        <div className="card mt-4 p-4">
          <p className="font-bold">Your partner said you were…</p>
          <div className="mt-2 flex flex-wrap gap-2">{c.partnerTags.map((t) => <Badge key={t} tone="good">{t}</Badge>)}</div>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to={`/speak/call?topic=${c.topic}`} className="btn btn-talk"><Mic className="size-4" /> Practise this topic again</Link>
        {!c.partner.formerMember && <button className="btn btn-ghost text-bad" onClick={() => setReport(true)}><Flag className="size-4" /> Report</button>}
      </div>
      <ReportModal open={report} onClose={() => setReport(false)} sessionId={c.id} partnerName={c.partner.anonName} />
    </Page>
  )
}
