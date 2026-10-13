import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpenText, ChevronRight, ClipboardCheck, Flame, GraduationCap, Library, Mic, PhoneCall, ScanText, Sparkles, Swords, Users } from 'lucide-react'
import { CEFR_INFO, type Cefr } from '../../shared/config'
import { api } from '../lib/api'
import { useUser } from '../lib/session'
import { Avatar, Badge, LevelBadge, Page, cx } from '../components/ui'

type CallStatus = { callsUsedToday: number; callsLimit: number; searchingNow: { casual: number; ielts: number } }
type Overview = { next: { title: string; reason: string; to: string }; estimate: number | null; targetBand: number | null; vocab: { saved: number } }
type BattleStatus = { rating: { rating: number; games: number }; usedToday: number; limit: number }

const greeting = () => {
  const h = new Date().getHours()
  return h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Home() {
  const me = useUser()
  const calls = useQuery({ queryKey: ['call-status'], queryFn: () => api<CallStatus>('/calls/status'), refetchInterval: 20_000 })
  const ov = useQuery({ queryKey: ['ielts-overview'], queryFn: () => api<Overview>('/ielts/overview') })
  const due = useQuery({ queryKey: ['vocab-review'], queryFn: () => api<unknown[]>('/vocab/review') })
  const battles = useQuery({ queryKey: ['battle-status'], queryFn: () => api<BattleStatus>('/battles/status') })
  const p = me.profile
  const left = calls.data ? (calls.data.callsLimit === -1 ? null : Math.max(0, calls.data.callsLimit - calls.data.callsUsedToday)) : undefined
  const searching = calls.data ? calls.data.searchingNow.casual + calls.data.searchingNow.ielts : 0
  const level = p.cefrLevel as Cefr | null
  const dueCount = due.data?.length ?? 0

  return (
    <Page>
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar icon={p.avatarIcon} color={p.avatarColor} size={52} label={p.anonName} />
        <div className="min-w-0 flex-1">
          <h1 className="h1 text-balance">{greeting()}, {p.displayName.split(' ')[0]}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            <LevelBadge level={level} />
            {level && <span>{CEFR_INFO[level].name}</span>}
            {p.goal === 'ielts' && p.targetBand && <span>· IELTS target {p.targetBand.toFixed(1)}</span>}
          </p>
        </div>
        <div className={cx('flex items-center gap-2 rounded-2xl px-4 py-2.5', me.streak.practicedToday ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-muted')} title="Days in a row with practice">
          <Flame className="size-5" />
          <span className="text-lg font-extrabold tabular-nums">{me.streak.current}</span>
          <span className="text-xs font-semibold">day{me.streak.current === 1 ? '' : 's'}{me.streak.practicedToday ? '' : ' · practise today'}</span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Link to="/speak/call" className="card group relative overflow-hidden border-0 p-6 text-white" style={{ backgroundImage: 'var(--hero)' }}>
          <div className="relative z-10 max-w-md">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold"><Users className="size-3.5" /> Real learners · anonymous</span>
            <h2 className="mt-3 text-2xl font-extrabold">Find a speaking partner</h2>
            <p className="mt-1 text-white/85">Practise English or IELTS Speaking in a voice call with another learner near your level. No real names, no video.</p>
            <span className="btn mt-5 bg-white text-[var(--hero-ink)] group-hover:scale-[1.02]"><PhoneCall className="size-5" /> Start a call</span>
            <p className="mt-3 text-sm text-white/80">
              {calls.data && (searching > 0 ? `${searching} ${searching === 1 ? 'person is' : 'people are'} looking for a partner right now · ` : 'Nobody is waiting right now — start, and you’ll be first in line · ')}
              {left === null ? 'Unlimited calls' : left !== undefined && `${left} call${left === 1 ? '' : 's'} left today`}
            </p>
          </div>
          <PhoneCall className="absolute -bottom-6 -right-6 size-48 rotate-12 text-white/10" aria-hidden />
        </Link>

        <div className="flex flex-col gap-4">
          {ov.data && (
            <Link to={ov.data.next.to} className="card flex items-start gap-3 p-5 hover:border-primary/40">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="flex-1">
                <span className="block text-xs font-bold uppercase tracking-wider text-primary">Next for you</span>
                <span className="block font-bold">{ov.data.next.title}</span>
                <span className="block text-sm text-muted">{ov.data.next.reason}</span>
              </span>
              <ChevronRight className="size-5 text-faint" />
            </Link>
          )}
          <Link to={dueCount ? '/vocab/review' : '/vocab'} className="card flex items-center gap-3 p-5 hover:border-primary/40">
            <span className="grid size-11 place-items-center rounded-xl bg-good-soft text-good"><Library className="size-5" /></span>
            <span className="flex-1">
              <span className="block font-bold">{dueCount ? `${dueCount} word${dueCount === 1 ? '' : 's'} to review` : 'Vocabulary'}</span>
              <span className="block text-sm text-muted">{dueCount ? 'Spaced repetition keeps them in long-term memory.' : 'Daily challenge, topic lists and your saved words.'}</span>
            </span>
            {dueCount > 0 && <Badge tone="good">Due</Badge>}
          </Link>
        </div>
      </div>

      <h2 className="h2 mb-3 mt-8">Practise</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile to="/ielts" icon={GraduationCap} tone="primary" title="IELTS preparation" sub={ov.data?.estimate != null ? `Estimated overall ${ov.data.estimate.toFixed(1)}` : 'Reading, Listening, Writing, Speaking'} />
        <Tile to="/speak/practice" icon={Mic} tone="talk" title="Speaking practice" sub="Record answers, get fluency feedback" />
        <Tile to="/ielts/mock" icon={ClipboardCheck} tone="warn" title="Mock test" sub="All four skills in exam conditions" />
        <Tile to="/battles" icon={Swords} tone="bad" title="Battles" sub={battles.data ? `Rating ${battles.data.rating.rating}${battles.data.rating.games ? ` · ${battles.data.rating.games} played` : ' · play your first'}` : 'Live quiz vs another learner'} />
        <Tile to="/read" icon={ScanText} tone="good" title="Read with AI" sub="Photo a page, tap any word" />
        <Tile to="/grammar" icon={BookOpenText} tone="primary" title="Grammar" sub="Short lessons and exercises" />
      </div>
    </Page>
  )
}

const TONE = { primary: 'bg-primary-soft text-primary', talk: 'bg-talk-soft text-talk', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', good: 'bg-good-soft text-good' }

function Tile({ to, icon: Icon, title, sub, tone }: { to: string; icon: typeof Mic; title: string; sub: string; tone: keyof typeof TONE }) {
  return (
    <Link to={to} className="card flex items-center gap-3 p-4 hover:border-primary/40">
      <span className={cx('grid size-11 shrink-0 place-items-center rounded-xl', TONE[tone])}><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1"><b className="block">{title}</b><span className="block truncate text-sm text-muted">{sub}</span></span>
      <ChevronRight className="size-5 shrink-0 text-faint" />
    </Link>
  )
}
