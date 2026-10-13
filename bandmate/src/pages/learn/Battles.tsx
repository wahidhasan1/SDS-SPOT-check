import { useEffect, useReducer, useRef, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Crown, History, Loader2, Swords, Timer, Trophy, User, Users, WifiOff, X } from 'lucide-react'
import { api, errorMessage, post } from '../../lib/api'
import { socket, type WsMessage } from '../../lib/ws'
import { useUser } from '../../lib/session'
import { Avatar, Badge, EmptyState, ErrorState, LimitNotice, LevelBadge, Page, PageHeader, PageLoader, Segmented, confirmDialog, cx, mmss, toast } from '../../components/ui'

type Mode = 'mixed' | 'vocab' | 'grammar'
type Status = { rating: { rating: number; games: number; wins: number }; usedToday: number; limit: number; liveBattleId: string | null; searching: Record<Mode, number>; timing: { questions: number; questionMs: number } }
type PublicQ = { index: number; kind: 'vocab' | 'grammar'; prompt: string; options: string[] }

const MODE_LABEL: Record<Mode, string> = { mixed: 'Mixed', vocab: 'Vocabulary', grammar: 'Grammar' }

export default function Battles() {
  return (
    <Routes>
      <Route index element={<Hub />} />
      <Route path="live" element={<LiveBattle />} />
      <Route path="solo/:id" element={<Solo />} />
    </Routes>
  )
}

function Hub() {
  const me = useUser()
  const nav = useNavigate()
  const [tab, setTab] = useState<'play' | 'leaderboard' | 'history'>('play')
  const [mode, setMode] = useState<Mode>('mixed')
  const status = useQuery({ queryKey: ['battle-status'], queryFn: () => api<Status>('/battles/status'), refetchInterval: 15_000 })
  useEffect(() => {
    if (status.data?.liveBattleId) nav('/battles/live', { replace: true })
  }, [status.data?.liveBattleId, nav])
  const s = status.data
  const left = s ? (s.limit === -1 ? null : Math.max(0, s.limit - s.usedToday)) : undefined
  const startSolo = async () => {
    try {
      const r = await post<{ id: string }>('/battles/solo', { mode })
      nav(`/battles/solo/${r.id}`)
    } catch (e) {
      toast(errorMessage(e), 'bad')
    }
  }
  return (
    <Page width="max-w-3xl">
      <PageHeader title="Battles" eyebrow="Learn" subtitle="A 7-question quiz race against another learner. Answer correctly and fast. Your battle rating is separate from your English level." />
      <Segmented label="Battles section" value={tab} onChange={setTab} items={[{ id: 'play', label: 'Play' }, { id: 'leaderboard', label: 'Leaderboard' }, { id: 'history', label: 'History' }]} />
      <div className="mt-5">
        {tab === 'play' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="card p-3"><p className="text-2xl font-extrabold tabular-nums">{s?.rating.rating ?? me.rating.rating}</p><p className="text-xs text-muted">rating</p></div>
              <div className="card p-3"><p className="text-2xl font-extrabold tabular-nums">{s?.rating.wins ?? 0}<span className="text-base text-muted">/{s?.rating.games ?? 0}</span></p><p className="text-xs text-muted">wins / games</p></div>
              <div className="card p-3"><p className="text-2xl font-extrabold tabular-nums">{left === null ? '∞' : left ?? '–'}</p><p className="text-xs text-muted">battles left today</p></div>
            </div>
            <div className="card p-5">
              <p className="mb-2 font-bold">Question type</p>
              <Segmented label="Question type" value={mode} onChange={setMode} items={(Object.keys(MODE_LABEL) as Mode[]).map((m) => ({ id: m, label: MODE_LABEL[m] }))} />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button className="btn btn-primary btn-lg" disabled={left === 0} onClick={() => nav('/battles/live', { state: { mode } })}><Users className="size-5" /> Find an opponent</button>
                <button className="btn btn-secondary btn-lg" onClick={startSolo}><User className="size-5" /> Solo practice</button>
              </div>
              <p className="mt-3 text-sm text-muted">
                {s && (s.searching[mode] > 0 ? `${s.searching[mode]} ${s.searching[mode] === 1 ? 'learner is' : 'learners are'} looking for a ${MODE_LABEL[mode].toLowerCase()} battle now.` : 'No one is waiting for this mode right now. You can wait in the queue, or practise solo (no rating change).')}
              </p>
              {left === 0 && <div className="mt-3"><LimitNotice message="You’ve used today’s battles on the Free plan. Solo practice is still available." /></div>}
            </div>
          </div>
        )}
        {tab === 'leaderboard' && <Leaderboard />}
        {tab === 'history' && <BattleHistory />}
      </div>
    </Page>
  )
}

function Leaderboard() {
  const q = useQuery({ queryKey: ['leaderboard'], queryFn: () => api<{ top: { rank: number; name: string; color: string; icon: string; rating: number; games: number; wins: number; level: string | null; you: boolean }[]; you: { rating: number; games: number; rank: number | null; optedIn: boolean } }>('/battles/leaderboard') })
  if (q.isLoading) return <PageLoader />
  if (q.error) return <ErrorState error={q.error} />
  const d = q.data!
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {d.you.optedIn ? (d.you.rank ? `You are #${d.you.rank} with a rating of ${d.you.rating}.` : 'Play a battle to appear on the leaderboard.') : <>You are hidden from the leaderboard. <Link to="/profile/privacy" className="link">Change in Privacy</Link>.</>}
      </p>
      {!d.top.length ? <EmptyState icon={Trophy} title="No rated battles yet" body="Be the first on the board." /> : (
        <ol className="card divide-y divide-border overflow-hidden">
          {d.top.map((t) => (
            <li key={t.rank} className={cx('flex items-center gap-3 px-4 py-3', t.you && 'bg-primary-soft')}>
              <span className={cx('w-7 text-center font-extrabold tabular-nums', t.rank <= 3 ? 'text-warn' : 'text-muted')}>{t.rank <= 3 ? <Crown className="mx-auto size-5" /> : t.rank}</span>
              <Avatar icon={t.icon} color={t.color} size={36} label={t.name} />
              <span className="min-w-0 flex-1"><b className="block truncate">{t.name}{t.you && ' (you)'}</b><span className="text-xs text-muted">{t.wins} wins · {t.games} games</span></span>
              {t.level && <LevelBadge level={t.level} />}
              <span className="font-extrabold tabular-nums">{t.rating}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function BattleHistory() {
  const q = useQuery({ queryKey: ['battle-history'], queryFn: () => api<{ id: string; mode: Mode; kind: string; status: string; at: number; score: number; correct: number; total: number; result: string | null; ratingChange: number | null; opponent: { name: string; color: string; icon: string; score: number } | null }[]>('/battles/history') })
  if (q.isLoading) return <PageLoader />
  if (q.error) return <ErrorState error={q.error} />
  if (!q.data!.length) return <EmptyState icon={History} title="No battles yet" />
  return (
    <ul className="card divide-y divide-border">
      {q.data!.map((b) => (
        <li key={b.id} className="flex items-center gap-3 px-4 py-3">
          {b.opponent ? <Avatar icon={b.opponent.icon} color={b.opponent.color} size={36} label={b.opponent.name} /> : <span className="grid size-9 place-items-center rounded-full bg-surface-2"><User className="size-4 text-muted" /></span>}
          <span className="min-w-0 flex-1">
            <b className="block truncate">{b.kind === 'solo' ? 'Solo practice' : b.status === 'aborted' ? 'Cancelled battle' : `vs ${b.opponent?.name ?? 'Deleted user'}`}</b>
            <span className="text-xs text-muted">{MODE_LABEL[b.mode] ?? b.mode} · {b.correct}/{b.total} correct · {b.score} pts{b.opponent && ` vs ${b.opponent.score}`} · {new Date(b.at).toLocaleDateString()}</span>
          </span>
          {b.result && b.kind === 'live' && <Badge tone={b.result === 'win' ? 'good' : b.result === 'loss' ? 'bad' : 'neutral'}>{b.result}</Badge>}
          {b.ratingChange !== null && <span className={cx('w-10 text-right text-sm font-bold tabular-nums', b.ratingChange >= 0 ? 'text-good' : 'text-bad')}>{b.ratingChange >= 0 ? '+' : ''}{b.ratingChange}</span>}
        </li>
      ))}
    </ul>
  )
}

// ------------------------------------------------------------------------------------------- live battle
type Opp = { name: string; color: string; icon: string; rating: number; score: number; connected: boolean }
type Reveal = { answer: string; explanation: string; yours: { answer: string; correct: boolean; points: number } | null; opponent: { correct: boolean; points: number } | null }
type End = { result: 'win' | 'loss' | 'draw'; forfeit: 'you' | 'opponent' | null; you: { score: number; correct: number; ratingBefore: number; ratingAfter: number }; opponent: { name: string; color: string; icon: string; score: number; correct: number }; total: number }
type S = {
  phase: 'connecting' | 'queued' | 'countdown' | 'question' | 'reveal' | 'end' | 'aborted' | 'error'
  battleId: string | null
  opp: Opp | null
  scores: { you: number; opp: number }
  q: number
  total: number
  question: PublicQ | null
  endsAt: number | null
  picked: string | null
  oppAnswered: boolean
  reveal: Reveal | null
  end: End | null
  message: string | null
  limit: boolean
  queuedAt: number
}
const init: S = { phase: 'connecting', battleId: null, opp: null, scores: { you: 0, opp: 0 }, q: -1, total: 7, question: null, endsAt: null, picked: null, oppAnswered: false, reveal: null, end: null, message: null, limit: false, queuedAt: Date.now() }

function useLiveBattle(mode: Mode, myId: string) {
  const [s, set] = useReducer((a: S, b: Partial<S>) => ({ ...a, ...b }), init)
  const ref = useRef(s)
  ref.current = s
  useEffect(() => {
    socket.connect()
    const scoresFrom = (m: WsMessage) => {
      const sc = m.scores as Record<string, number> | undefined
      if (!sc) return ref.current.scores
      const opp = Object.entries(sc).find(([k]) => k !== myId)?.[1] ?? 0
      return { you: sc[myId] ?? 0, opp }
    }
    const offs = [
      socket.on('battle.queued', () => set({ phase: 'queued', queuedAt: Date.now() })),
      socket.on('battle.found', (m) => set({ phase: 'countdown', battleId: String(m.battleId), opp: m.opponent as Opp, total: Number(m.total), endsAt: Date.now() + Number(m.startsIn) })),
      socket.on('battle.state', (m) => {
        const opp = m.opponent as Opp
        set({ battleId: String(m.battleId), opp, total: Number(m.total), q: Number(m.q), scores: { you: (m.you as { score: number }).score, opp: opp.score }, question: (m.question as PublicQ) ?? null, phase: m.phase === 'question' ? 'question' : m.phase === 'reveal' ? 'reveal' : 'countdown', endsAt: m.endsIn != null ? Date.now() + Number(m.endsIn) : null, picked: m.answered ? '…' : null })
      }),
      socket.on('battle.question', (m) => set({ phase: 'question', q: Number(m.q), question: m.question as PublicQ, endsAt: Date.now() + Number(m.endsIn), picked: null, oppAnswered: false, reveal: null, scores: scoresFrom(m) })),
      socket.on('battle.answered', (m) => set({ scores: scoresFrom(m) })),
      socket.on('battle.opponent_answered', () => set({ oppAnswered: true })),
      socket.on('battle.reveal', (m) => set({ phase: 'reveal', reveal: { answer: String(m.answer), explanation: String(m.explanation), yours: m.yours as Reveal['yours'], opponent: m.opponent as Reveal['opponent'] }, scores: scoresFrom(m) })),
      socket.on('battle.opponent_status', (m) => ref.current.opp && set({ opp: { ...ref.current.opp, connected: !!m.connected } })),
      socket.on('battle.end', (m) => set({ phase: 'end', end: m as unknown as End })),
      socket.on('battle.aborted', (m) => set({ phase: 'aborted', message: String(m.message) })),
      // No running battle to resume: join the queue (only on first entry, never after a result).
      socket.on('battle.gone', () => ref.current.phase === 'connecting' && socket.send({ t: 'battle.queue', mode })),
      socket.on('battle.error', (m) => set({ phase: 'error', message: String(m.message), limit: m.code === 'limit_reached' })),
      socket.on('error', (m) => {
        if (String(m.for ?? '').startsWith('battle.') && m.code !== 'already_answered' && m.code !== 'not_open') set({ phase: 'error', message: String(m.message) })
      }),
      // After a network drop, rejoin the running battle.
      socket.onStatus((st) => st === 'open' && ref.current.battleId && ref.current.phase !== 'end' && socket.send({ t: 'battle.resume' })),
    ]
    // Resume a running battle (e.g. after a reload), otherwise join the queue.
    socket.send({ t: 'battle.resume' })
    return () => {
      offs.forEach((o) => o())
      if (ref.current.phase === 'queued' || ref.current.phase === 'connecting') socket.send({ t: 'battle.cancel' })
    }
  }, [mode, myId])
  return [s, set] as const
}

function LiveBattle() {
  const me = useUser()
  const nav = useNavigate()
  const qc = useQueryClient()
  const loc = useLocation()
  const mode = ((loc.state as { mode?: Mode } | null)?.mode ?? 'mixed') as Mode
  const [s, set] = useLiveBattle(mode, me.id)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    if (s.phase === 'end' || s.phase === 'aborted') {
      qc.invalidateQueries({ queryKey: ['battle-status'] })
      qc.invalidateQueries({ queryKey: ['me'] })
    }
  }, [s.phase, qc])

  const leave = async () => {
    if (s.phase === 'queued' || s.phase === 'connecting') {
      socket.send({ t: 'battle.cancel' })
      return nav('/battles')
    }
    const ok = await confirmDialog({ title: 'Leave the battle?', body: 'Leaving now counts as a loss.', confirm: 'Leave' })
    if (ok) {
      socket.send({ t: 'battle.leave' })
      nav('/battles')
    }
  }
  const answer = (opt: string) => {
    if (s.phase !== 'question' || s.picked || !s.battleId) return
    set({ picked: opt })
    socket.send({ t: 'battle.answer', battleId: s.battleId, q: s.q, answer: opt })
  }

  if (s.phase === 'connecting' || s.phase === 'queued')
    return (
      <Page width="max-w-md">
        <div className="card mt-10 flex flex-col items-center gap-4 p-8 text-center">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-xl font-bold">Finding an opponent…</p>
          <p className="text-sm text-muted">{MODE_LABEL[mode]} · matched by battle rating · {mmss(now - s.queuedAt)}</p>
          <p className="text-xs text-muted">Only real learners. If nobody joins, you can keep waiting or try solo practice.</p>
          <button className="btn btn-secondary" onClick={leave}>Cancel</button>
        </div>
      </Page>
    )

  if (s.phase === 'error' || s.phase === 'aborted')
    return (
      <Page width="max-w-md">
        <div className="card mt-10 space-y-4 p-6 text-center">
          <p className="text-lg font-bold">{s.phase === 'aborted' ? 'Battle cancelled' : 'Can’t start a battle'}</p>
          {s.limit ? <LimitNotice message={s.message ?? ''} /> : <p className="text-muted">{s.message}</p>}
          <Link to="/battles" className="btn btn-primary">Back to battles</Link>
        </div>
      </Page>
    )

  if (s.phase === 'end' && s.end) {
    const e = s.end
    const delta = e.you.ratingAfter - e.you.ratingBefore
    return (
      <Page width="max-w-md">
        <div className="card mt-6 p-6 text-center">
          <Trophy className={cx('mx-auto size-12', e.result === 'win' ? 'text-warn' : 'text-faint')} />
          <p className="mt-2 text-3xl font-extrabold">{e.result === 'win' ? 'You won!' : e.result === 'draw' ? 'It’s a draw' : 'You lost'}</p>
          {e.forfeit && <p className="text-sm text-muted">{e.forfeit === 'opponent' ? 'Your opponent left the battle.' : 'You left the battle.'}</p>}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-primary-soft p-3"><p className="text-xs font-semibold text-primary">You</p><p className="text-2xl font-extrabold tabular-nums">{e.you.score}</p><p className="text-xs text-muted">{e.you.correct}/{e.total} correct</p></div>
            <div className="rounded-xl bg-surface-2 p-3"><p className="truncate text-xs font-semibold text-muted">{e.opponent.name}</p><p className="text-2xl font-extrabold tabular-nums">{e.opponent.score}</p><p className="text-xs text-muted">{e.opponent.correct}/{e.total} correct</p></div>
          </div>
          <p className="mt-4 font-semibold">Rating {e.you.ratingBefore} → <b>{e.you.ratingAfter}</b> <span className={delta >= 0 ? 'text-good' : 'text-bad'}>({delta >= 0 ? '+' : ''}{delta})</span></p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button className="btn btn-primary" onClick={() => { set({ ...init, phase: 'queued', queuedAt: Date.now() }); socket.send({ t: 'battle.queue', mode }) }}>Play again</button>
            <Link to="/battles" className="btn btn-secondary">Done</Link>
          </div>
        </div>
      </Page>
    )
  }

  const left = s.endsAt ? Math.max(0, s.endsAt - now) : 0
  const q = s.question
  return (
    <Page width="max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2"><Avatar icon={me.profile.avatarIcon} color={me.profile.avatarColor} size={36} label="You" /><span><b className="block text-sm">You</b><span className="text-lg font-extrabold tabular-nums">{s.scores.you}</span></span></div>
        <Swords className="size-5 text-faint" />
        {s.opp && (
          <div className="flex flex-1 items-center justify-end gap-2 text-right">
            <span><b className="block max-w-28 truncate text-sm">{s.opp.name}</b><span className="text-lg font-extrabold tabular-nums">{s.scores.opp}</span></span>
            <span className="relative"><Avatar icon={s.opp.icon} color={s.opp.color} size={36} label={s.opp.name} />{!s.opp.connected && <WifiOff className="absolute -bottom-1 -right-1 size-4 rounded-full bg-surface p-0.5 text-bad" />}</span>
          </div>
        )}
      </div>
      {s.opp && !s.opp.connected && <p className="mb-3 rounded-xl bg-warn-soft p-2 text-center text-sm text-warn">Your opponent lost connection. Waiting a few seconds for them to come back…</p>}

      {s.phase === 'countdown' ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <p className="text-sm text-muted">Get ready!</p>
          <p className="text-6xl font-extrabold tabular-nums">{Math.max(1, Math.ceil(left / 1000))}</p>
        </div>
      ) : q && (
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <Badge>{q.kind === 'grammar' ? 'Grammar' : 'Vocabulary'}</Badge>
            <span className="text-muted">Question {s.q + 1} of {s.total}</span>
            <span className={cx('ml-auto flex items-center gap-1 font-bold tabular-nums', left < 5000 && s.phase === 'question' && 'text-bad')}><Timer className="size-4" /> {s.phase === 'question' ? Math.ceil(left / 1000) : 0}s</span>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${s.phase === 'question' ? (left / 15000) * 100 : 0}%` }} /></div>
          <p className="text-lg font-bold">{q.prompt}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {q.options.map((o) => {
              const correct = s.reveal && o === s.reveal.answer
              const wrongPick = s.reveal && o === s.picked && o !== s.reveal.answer
              return (
                <button key={o} disabled={s.phase !== 'question' || !!s.picked} onClick={() => answer(o)} className={cx('flex min-h-12 items-center gap-2 rounded-xl border-2 px-4 py-2 text-left text-[15px] font-semibold transition', correct ? 'border-good bg-good-soft' : wrongPick ? 'border-bad bg-bad-soft' : s.picked === o ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/50')}>
                  <span className="flex-1">{o}</span>
                  {correct && <Check className="size-5 text-good" />}
                  {wrongPick && <X className="size-5 text-bad" />}
                </button>
              )
            })}
          </div>
          <p className="mt-3 min-h-5 text-sm text-muted" aria-live="polite">
            {s.phase === 'question' && (s.picked ? `Answer locked in.${s.oppAnswered ? '' : ' Waiting for your opponent…'}` : s.oppAnswered ? 'Your opponent has answered!' : '')}
            {s.phase === 'reveal' && s.reveal && (
              <>
                {s.reveal.yours ? (s.reveal.yours.correct ? `Correct! +${s.reveal.yours.points}` : 'Not this time.') : 'Time’s up.'} {s.reveal.explanation}
              </>
            )}
          </p>
        </div>
      )}
      <button className="btn btn-ghost btn-sm mt-4" onClick={leave}>Leave battle</button>
    </Page>
  )
}

// ------------------------------------------------------------------------------------------- solo
type SoloResult = { correct: boolean; points: number; timedOut: boolean; answer: string; explanation: string; finished: boolean }
type SoloView = { id: string; mode: Mode; status: string; questions: (PublicQ & { yourAnswer?: string; answer?: string; explanation?: string })[]; score: number; correct: number; answered: number }

function Solo() {
  const { id } = useParams()
  const qc = useQueryClient()
  const v = useQuery({ queryKey: ['solo', id], queryFn: () => api<SoloView>(`/battles/solo/${id}`), gcTime: 0 })
  const [cur, setCur] = useState<{ q: number; question: PublicQ; endsAt: number } | null>(null)
  const [res, setRes] = useState<(SoloResult & { picked: string }) | null>(null)
  const [score, setScore] = useState(0)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(t)
  }, [])
  const open = async () => {
    setRes(null)
    try {
      const r = await post<{ q: number; question: PublicQ; endsIn: number }>(`/battles/solo/${id}/next`)
      setCur({ q: r.q, question: r.question, endsAt: Date.now() + r.endsIn })
    } catch (e) {
      toast(errorMessage(e), 'bad')
    }
  }
  const pick = async (o: string) => {
    if (!cur || res) return
    try {
      const r = await post<SoloResult>(`/battles/solo/${id}/answer`, { q: cur.q, answer: o })
      setRes({ ...r, picked: o })
      setScore((x) => x + r.points)
      if (r.finished) qc.invalidateQueries({ queryKey: ['solo', id] })
    } catch (e) {
      toast(errorMessage(e), 'bad')
    }
  }
  // Time's up on the client: submit an empty answer so the server records it.
  useEffect(() => {
    if (cur && !res && now > cur.endsAt + 600) void pick('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now])

  if (v.isLoading) return <PageLoader />
  if (v.error) return <Page><ErrorState error={v.error} /></Page>
  const d = v.data!
  if (d.status === 'finished' && (!cur || res?.finished))
    return (
      <Page width="max-w-md">
        <div className="card mt-6 p-6 text-center">
          <Trophy className="mx-auto size-10 text-warn" />
          <p className="mt-2 text-2xl font-extrabold">Practice complete</p>
          <p className="mt-1 text-muted">{d.correct}/{d.questions.length} correct · {d.score} points</p>
          <p className="mt-1 text-xs text-muted">Solo practice doesn’t change your battle rating.</p>
          <div className="mt-5 flex justify-center gap-2"><Link to="/battles" className="btn btn-primary">Back to battles</Link></div>
        </div>
      </Page>
    )
  const left = cur ? Math.max(0, cur.endsAt - now) : 0
  return (
    <Page width="max-w-2xl">
      <PageHeader title="Solo practice" eyebrow={MODE_LABEL[d.mode]} back={{ to: '/battles', label: 'Battles' }} action={<span className="text-lg font-extrabold tabular-nums">{score || d.score} pts</span>} />
      {!cur ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-muted">{d.questions.length} questions · 15 seconds each · faster correct answers score more.</p>
          <button className="btn btn-primary btn-lg" onClick={open}>{d.answered ? 'Continue' : 'Start'}</button>
        </div>
      ) : (
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <Badge>{cur.question.kind === 'grammar' ? 'Grammar' : 'Vocabulary'}</Badge>
            <span className="text-muted">Question {cur.q + 1} of {d.questions.length}</span>
            {!res && <span className={cx('ml-auto flex items-center gap-1 font-bold tabular-nums', left < 5000 && 'text-bad')}><Timer className="size-4" /> {Math.ceil(left / 1000)}s</span>}
          </div>
          <p className="text-lg font-bold">{cur.question.prompt}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {cur.question.options.map((o) => (
              <button key={o} disabled={!!res} onClick={() => pick(o)} className={cx('min-h-12 rounded-xl border-2 px-4 py-2 text-left text-[15px] font-semibold', res && o === res.answer ? 'border-good bg-good-soft' : res && o === res.picked ? 'border-bad bg-bad-soft' : 'border-border hover:border-primary/50')}>{o}</button>
            ))}
          </div>
          {res && (
            <div className="mt-4">
              <p className={cx('font-bold', res.correct ? 'text-good' : 'text-bad')}>{res.correct ? `Correct! +${res.points}` : res.timedOut ? 'Time’s up.' : 'Not quite.'}</p>
              <p className="text-sm text-muted">{res.explanation}</p>
              <button className="btn btn-primary mt-3" onClick={() => (res.finished ? v.refetch().then(() => setCur(null)) : open())}>{res.finished ? 'See result' : 'Next question'}</button>
            </div>
          )}
        </div>
      )}
    </Page>
  )
}
