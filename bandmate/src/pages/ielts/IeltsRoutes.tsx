import { useEffect, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, ChevronRight, ClipboardCheck, Headphones, Info, Lock, Mic, PenLine, Sparkles, TrendingUp } from 'lucide-react'
import { TEST_TYPE_LABEL, type TestType } from '../../../shared/config'
import { api, errorMessage, post } from '../../lib/api'
import { useUser } from '../../lib/session'
import { Badge, EmptyState, ErrorState, Page, PageHeader, PageLoader, Progress, cx, toast } from '../../components/ui'
import { TestPlayer } from '../../features/ielts/TestPlayer'
import { Review } from '../../features/ielts/Review'
import type { Attempt } from '../../features/ielts/types'
import Writing from './Writing'
import Mock from './Mock'

export default function IeltsRoutes() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="reading" element={<TestList kind="reading" />} />
      <Route path="listening" element={<TestList kind="listening" />} />
      <Route path="test/:id" element={<TestRoute />} />
      <Route path="review/:id" element={<ReviewPage />} />
      <Route path="writing/*" element={<Writing />} />
      <Route path="mock/*" element={<Mock />} />
    </Routes>
  )
}

type Overview = {
  testType: TestType | null
  targetBand: number | null
  skills: {
    listening: SkillObj
    reading: SkillObj
    writing: { submissions: number; latestBand: number | null; aiReviewed: number }
    speaking: { recordings: number; latestBand: number | null; aiReviewed: number; avgSpeakingRate: number | null }
  }
  latestBands: Record<string, number | null>
  estimate: number | null
  estimateNote: string
  vocab: { saved: number; mastered: number }
  grammarMastered: number
  mocks: number
  weakTypes: { label: string; accuracy: number; skill: string; total: number }[]
  next: { title: string; reason: string; to: string }
}
type SkillObj = { attempts: number; latestBand: number | null; bestBand: number | null; recentAccuracy: number | null; history: { band: number; at: number }[] }

function Spark({ data }: { data: { band: number }[] }) {
  if (data.length < 2) return null
  const w = 120
  const h = 32
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d.band - 2) / 7) * h}`).join(' ')
  return <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-28" aria-label={`Band history: ${data.map((d) => d.band).join(', ')}`} role="img"><polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth={2} /></svg>
}

function Dashboard() {
  const me = useUser()
  const q = useQuery({ queryKey: ['ielts-overview'], queryFn: () => api<Overview>('/ielts/overview') })
  if (q.isLoading) return <PageLoader />
  if (q.error) return <Page><ErrorState error={q.error} onRetry={() => q.refetch()} /></Page>
  const o = q.data!
  const tt = (o.testType ?? 'academic') as TestType
  const skills = [
    { id: 'listening', label: 'Listening', icon: Headphones, to: '/ielts/listening', band: o.latestBands.listening, sub: o.skills.listening.attempts ? `${o.skills.listening.attempts} attempts · recent accuracy ${o.skills.listening.recentAccuracy ?? '–'}%` : 'Not started', spark: o.skills.listening.history },
    { id: 'reading', label: 'Reading', icon: BookOpen, to: '/ielts/reading', band: o.latestBands.reading, sub: o.skills.reading.attempts ? `${o.skills.reading.attempts} attempts · recent accuracy ${o.skills.reading.recentAccuracy ?? '–'}%` : 'Not started', spark: o.skills.reading.history },
    { id: 'writing', label: 'Writing', icon: PenLine, to: '/ielts/writing', band: o.latestBands.writing, sub: o.skills.writing.submissions ? `${o.skills.writing.submissions} submitted · ${o.skills.writing.aiReviewed} AI-reviewed` : 'Not started', spark: [] },
    { id: 'speaking', label: 'Speaking', icon: Mic, to: '/speak/practice', band: o.latestBands.speaking, sub: o.skills.speaking.recordings ? `${o.skills.speaking.recordings} recordings${o.skills.speaking.avgSpeakingRate ? ` · ${o.skills.speaking.avgSpeakingRate} wpm` : ''}` : 'Not started', spark: [] },
  ]
  return (
    <Page>
      <PageHeader
        eyebrow={TEST_TYPE_LABEL[tt]}
        title="IELTS preparation"
        subtitle={<>Target band <b className="text-text">{o.targetBand?.toFixed(1) ?? '—'}</b> · <Link to="/profile/goals" className="link">Change goals</Link></>}
        action={<Link to="/ielts/mock" className="btn btn-primary"><ClipboardCheck className="size-5" /> Mock test</Link>}
      />
      {me.profile.goal !== 'ielts' && <p className="mb-4 rounded-xl bg-surface-2 p-3 text-sm text-muted">Your goal is general English, but IELTS practice is great for everyone. <Link to="/profile/goals" className="link">Set an IELTS goal</Link> to get a target-based plan.</p>}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Link to={o.next.to} className="card flex items-start gap-4 border-primary/30 bg-primary-soft p-5">
          <Sparkles className="mt-0.5 size-6 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Recommended next</p>
            <p className="mt-0.5 text-lg font-bold">{o.next.title}</p>
            <p className="text-sm text-muted">{o.next.reason}</p>
          </div>
          <ChevronRight className="size-5 text-primary" />
        </Link>
        <div className="card p-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-muted"><TrendingUp className="size-4" /> Estimated overall band</p>
          {o.estimate !== null ? (
            <p className="mt-1 text-4xl font-extrabold">{o.estimate.toFixed(1)} <span className="text-base font-semibold text-muted">/ target {o.targetBand?.toFixed(1)}</span></p>
          ) : (
            <p className="mt-1 text-2xl font-extrabold text-faint">Not enough data yet</p>
          )}
          <p className="mt-1 flex gap-1.5 text-xs text-muted"><Info className="mt-0.5 size-3.5 shrink-0" /> {o.estimateNote}</p>
        </div>
      </div>

      <h2 className="h2 mb-3 mt-8">Your four skills</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {skills.map((s) => (
          <Link key={s.id} to={s.to} className="card flex flex-col p-4 hover:border-primary/40">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold"><s.icon className="size-5 text-primary" /> {s.label}</span>
              {s.band !== null ? <Badge tone={o.targetBand && s.band >= o.targetBand ? 'good' : 'warn'}>{s.band.toFixed(1)}</Badge> : <Badge>—</Badge>}
            </div>
            <p className="mt-2 text-sm text-muted">{s.sub}</p>
            <div className="mt-auto pt-2"><Spark data={s.spark} /></div>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-faint">Skill bands are unofficial practice estimates: Listening and Reading from full practice tests; Writing and Speaking from AI feedback when available.</p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="h2">Areas to improve</h2>
          {o.weakTypes.length ? (
            <div className="mt-3 space-y-3">
              {o.weakTypes.map((w) => (
                <div key={w.label + w.skill}>
                  <div className="mb-1 flex justify-between text-sm"><span>{w.label} <span className="text-muted">({w.skill})</span></span><span className="font-semibold">{w.accuracy}%</span></div>
                  <Progress value={w.accuracy} tone="warn" />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Complete a few Reading or Listening sets and we’ll show which question types need more work.</p>
          )}
        </section>
        <section className="card p-5">
          <h2 className="h2">Vocabulary & grammar</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <Link to="/vocab/saved" className="rounded-xl bg-surface-2 p-3"><p className="text-2xl font-extrabold">{o.vocab.saved}</p><p className="text-xs text-muted">saved words ({o.vocab.mastered} well known)</p></Link>
            <Link to="/grammar" className="rounded-xl bg-surface-2 p-3"><p className="text-2xl font-extrabold">{o.grammarMastered}</p><p className="text-xs text-muted">grammar lessons mastered</p></Link>
          </div>
        </section>
      </div>
    </Page>
  )
}

type TestSummary = { id: string; title: string; testType: string; premium: boolean; questions: number; sections: { index: number; title: string; questions: number }[]; attempts: { id: string; status: string; score: number | null; max: number | null; band: number | null; startedAt: number; mode: string; scope: number | null }[] }

function TestList({ kind }: { kind: 'reading' | 'listening' }) {
  const me = useUser()
  const nav = useNavigate()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['tests', kind], queryFn: () => api<TestSummary[]>(`/ielts/tests?kind=${kind}`) })
  const [busy, setBusy] = useState<string | null>(null)
  const start = async (contentId: string, mode: 'practice' | 'exam', scope: number | null) => {
    setBusy(`${contentId}-${mode}-${scope}`)
    try {
      const a = await post<Attempt>('/ielts/attempts', { contentId, mode, scope })
      qc.invalidateQueries({ queryKey: ['tests', kind] })
      nav(`/ielts/test/${a.id}`)
    } catch (e) {
      toast(errorMessage(e), 'bad')
      setBusy(null)
    }
  }
  const tt = (me.profile.testType ?? 'academic') as TestType
  return (
    <Page width="max-w-4xl">
      <PageHeader
        title={kind === 'reading' ? 'Reading' : 'Listening'}
        eyebrow={kind === 'reading' ? TEST_TYPE_LABEL[tt] : 'Academic & General Training'}
        back={{ to: '/ielts', label: 'IELTS' }}
        subtitle={kind === 'reading' ? 'Practise one passage at a time (20 minutes each), or take the full 60-minute test in exam mode.' : 'Practise one part with full audio controls, or take the full test in exam mode: each recording plays once.'}
      />
      {q.isLoading ? <PageLoader /> : q.error ? <ErrorState error={q.error} /> : !q.data!.length ? <EmptyState icon={BookOpen} title="No tests yet" /> : (
        <div className="space-y-5">
          {q.data!.map((t) => {
            const locked = t.premium && me.plan.limits.premiumContent !== true
            const open = t.attempts.find((a) => a.status === 'in_progress')
            return (
              <section key={t.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="h2">{t.title} {locked && <Badge tone="primary"><Lock className="size-3" /> Premium</Badge>}</h2>
                    <p className="text-sm text-muted">{t.questions} questions · {kind === 'reading' ? '60 minutes' : 'about 30 minutes'}</p>
                  </div>
                  <button className="btn btn-primary" disabled={locked || !!busy} onClick={() => start(t.id, 'exam', null)}>Full test (exam mode)</button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {t.sections.map((s) => {
                    const best = t.attempts.filter((a) => a.scope === s.index && a.status === 'submitted').reduce<number | null>((m, a) => Math.max(m ?? 0, a.score ?? 0), null)
                    return (
                      <button key={s.index} disabled={locked || !!busy} onClick={() => start(t.id, 'practice', s.index)} className="flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-primary/50">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{s.title}</span>
                          <span className="block text-xs text-muted">{s.questions} questions · practice{best !== null ? ` · best ${best}/${s.questions}` : ''}</span>
                        </span>
                        <ChevronRight className="size-4 text-faint" />
                      </button>
                    )
                  })}
                </div>
                {open && <p className="mt-3 text-sm"><Link to={`/ielts/test/${open.id}`} className="link">Continue your unfinished {open.mode === 'exam' ? 'test' : 'practice'} →</Link></p>}
                {t.attempts.some((a) => a.status === 'submitted') && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">History</p>
                    <div className="flex flex-wrap gap-2">
                      {t.attempts.filter((a) => a.status === 'submitted').slice(0, 6).map((a) => (
                        <Link key={a.id} to={`/ielts/review/${a.id}`} className="chip">
                          {a.scope === null ? 'Full' : `${kind === 'reading' ? 'P' : 'Part '}${a.scope + 1}`} · {a.score}/{a.max}{a.band !== null && ` · ${a.band.toFixed(1)}`}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </Page>
  )
}

function TestRoute() {
  const { id } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['attempt', id], queryFn: () => api<Attempt>(`/ielts/attempts/${id}`), staleTime: Infinity, gcTime: 0 })
  useEffect(() => {
    if (q.data?.status === 'submitted') nav(`/ielts/review/${id}`, { replace: true })
  }, [q.data, id, nav])
  if (q.isLoading || q.data?.status === 'submitted') return <PageLoader />
  if (q.error) return <Page><ErrorState error={q.error} /></Page>
  return (
    <TestPlayer
      initial={q.data!}
      onExit={() => nav(q.data!.kind === 'reading' ? '/ielts/reading' : '/ielts/listening')}
      onSubmitted={(a) => {
        qc.setQueryData(['review', a.id], a)
        qc.invalidateQueries({ queryKey: ['ielts-overview'] })
        nav(`/ielts/review/${a.id}`, { replace: true })
      }}
    />
  )
}

function ReviewPage() {
  const { id } = useParams()
  const q = useQuery({ queryKey: ['review', id], queryFn: () => api<Attempt>(`/ielts/attempts/${id}`) })
  if (q.isLoading) return <PageLoader />
  if (q.error) return <Page><ErrorState error={q.error} /></Page>
  const a = q.data!
  if (!a.result) return <Page><EmptyState icon={BookOpen} title="This attempt isn’t finished yet" action={<Link to={`/ielts/test/${a.id}`} className="btn btn-primary">Continue</Link>} /></Page>
  return (
    <Page width="max-w-4xl">
      <PageHeader title="Your results" eyebrow={a.test.title} back={{ to: a.kind === 'reading' ? '/ielts/reading' : '/ielts/listening', label: a.kind === 'reading' ? 'Reading' : 'Listening' }} />
      <Review a={a} />
      <div className={cx('mt-8 flex flex-wrap gap-2')}>
        <Link to={a.kind === 'reading' ? '/ielts/reading' : '/ielts/listening'} className="btn btn-primary">Practise more</Link>
        <Link to="/ielts" className="btn btn-secondary">IELTS dashboard</Link>
      </div>
    </Page>
  )
}
