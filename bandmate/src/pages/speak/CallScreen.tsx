import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Ban, ChevronLeft, ChevronRight, Flag, Mic, MicOff, PhoneOff, RefreshCcw, ShieldCheck, Timer, UserRoundX, WifiOff } from 'lucide-react'
import { CALL_TOPICS, type CallMode } from '../../../shared/config'
import { callEngine, useCall, type CallState, type Prompts } from '../../features/call/engine'
import { api, errorMessage, patch, post } from '../../lib/api'
import { useRefreshMe, useUser } from '../../lib/session'
import { Avatar, Badge, LevelBadge, LimitNotice, Modal, Spinner, confirmDialog, cx, mmss, toast, useCountdown } from '../../components/ui'
import { CallSummary } from './CallSummary'

export const topicLabel = (id: string | null) => CALL_TOPICS.find((t) => t.id === id)?.label ?? 'Free conversation'

type Status = { callsUsedToday: number; callsLimit: number; inCall: string | null; searchingNow: { casual: number; ielts: number } }

export default function CallScreen() {
  const call = useCall()
  if (call.phase === 'idle' || call.phase === 'failed') return <Setup call={call} />
  if (call.phase === 'mic' || call.phase === 'matching') return <Matching call={call} />
  if (call.phase === 'ended') return <CallSummary call={call} />
  return <InCall call={call} />
}

// ------------------------------------------------------------------------------------------------ Setup
function Setup({ call }: { call: CallState }) {
  const me = useUser()
  const refresh = useRefreshMe()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const status = useQuery({ queryKey: ['call-status'], queryFn: () => api<Status>('/calls/status'), refetchInterval: 15_000 })
  const initialTopic = params.get('topic') ?? call.request?.topic ?? 'random'
  const [mode, setMode] = useState<CallMode>(call.request?.mode ?? (initialTopic.startsWith('ielts') ? 'ielts' : 'casual'))
  const [topic, setTopic] = useState(initialTopic)
  const [role, setRole] = useState(call.request?.role ?? 'either')
  const [genderPref, setGenderPref] = useState<string>(call.request?.genderPref ?? '')
  const [agree, setAgree] = useState(false)
  const premium = me.plan.limits.genderPreference === true

  const topics = CALL_TOPICS.filter((t) => (mode === 'ielts' ? 'ielts' in t : !('ielts' in t)))
  useEffect(() => {
    if (!topics.some((t) => t.id === topic)) setTopic(mode === 'ielts' ? 'ielts-1' : 'random')
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const s = status.data
  const left = s && s.callsLimit !== -1 ? Math.max(0, s.callsLimit - s.callsUsedToday) : null
  const blockedReason = !me.adult ? 'age' : !me.profile.cefrLevel ? 'level' : null

  const start = async () => {
    if (!me.profile.voiceConsent) {
      if (!agree) return toast('Please accept the community guidelines first.', 'bad')
      await patch('/me/profile', { voiceConsent: true })
      await refresh()
    }
    void callEngine.start({ mode, topic, role, genderPref: genderPref || null })
  }

  const err = call.phase === 'failed' ? call.error : null

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pb-10 pt-4">
      <button onClick={() => (callEngine.reset(), nav('/speak'))} className="btn btn-ghost -ml-2 mb-2 gap-1"><ArrowLeft className="size-5" /> Speaking</button>
      <h1 className="h1">Find a speaking partner</h1>
      <p className="mt-1.5 text-muted">We’ll connect you with another learner for a live voice call. You’ll appear as <b className="text-text">{me.profile.anonName}</b>.</p>

      {err && <FailureNotice code={err.code} message={err.message} onRetry={start} />}

      {blockedReason === 'age' ? (
        <div className="card mt-6 p-5">
          <UserRoundX className="size-7 text-muted" />
          <p className="mt-2 font-bold">Voice calls are for adults (18+)</p>
          <p className="mt-1 text-sm text-muted">To keep everyone safe, live calls with strangers are only available to users aged 18 or over. You can still practise speaking with AI feedback.</p>
          <Link to="/speak/practice" className="btn btn-primary mt-4">Practise speaking with AI</Link>
        </div>
      ) : (
        <>
          <section className="mt-6">
            <p className="label">Practice mode</p>
            <div className="grid grid-cols-2 gap-2">
              {([['casual', 'Conversation', 'Chat about everyday topics'], ['ielts', 'IELTS Speaking', 'Practise Part 1, 2 or 3']] as const).map(([id, t, d]) => (
                <button key={id} onClick={() => setMode(id)} aria-pressed={mode === id} className={cx('card p-3.5 text-left transition-colors', mode === id ? 'border-primary ring-3 ring-primary/15' : 'hover:border-primary/40')}>
                  <span className="block font-bold">{t}</span>
                  <span className="block text-sm text-muted">{d}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <p className="label">Topic <span className="font-normal text-muted">(optional)</span></p>
            <div className="flex flex-wrap gap-2">
              {topics.map((t) => <button key={t.id} onClick={() => setTopic(t.id)} aria-pressed={topic === t.id} className={cx('chip', topic === t.id && 'chip-on')}>{t.label}</button>)}
            </div>
          </section>

          {mode === 'ielts' && (
            <section className="mt-5">
              <p className="label">Your role</p>
              <div className="flex flex-wrap gap-2">
                {[['candidate', 'Candidate (I answer)'], ['partner', 'Practice partner (I ask)'], ['either', 'Either']].map(([id, l]) => (
                  <button key={id} onClick={() => setRole(id)} aria-pressed={role === id} className={cx('chip', role === id && 'chip-on')}>{l}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">This is peer practice, not an official IELTS test. The practice partner reads the questions and keeps time.</p>
            </section>
          )}

          <section className="mt-5">
            <p className="label">Partner preference</p>
            {premium ? (
              <select className="input" value={genderPref} onChange={(e) => setGenderPref(e.target.value)} aria-label="Partner gender preference">
                <option value="">Anyone</option>
                <option value="female">Women only (who chose to share their gender)</option>
                <option value="male">Men only (who chose to share their gender)</option>
              </select>
            ) : (
              <p className="text-sm text-muted">Anyone at a similar level. <Link to="/account/plan" className="link">Premium</Link> lets you choose a partner preference.</p>
            )}
          </section>

          <div className="card mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
            <span className="flex items-center gap-2">Your level <LevelBadge level={me.profile.cefrLevel} /></span>
            <span className="text-muted">{left === null ? 'Unlimited calls' : `${left} of ${s?.callsLimit} calls left today`}</span>
            {s && <span className="text-muted">{s.searchingNow[mode]} {s.searchingNow[mode] === 1 ? 'learner is' : 'learners are'} searching now</span>}
          </div>

          {!me.profile.voiceConsent && (
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-primary-soft p-4 text-sm">
              <input type="checkbox" className="mt-0.5 size-5 accent-[var(--primary)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>
                I’ll follow the <Link to="/guidelines" className="link" target="_blank">community guidelines</Link>: be respectful, stay anonymous, no harassment. I understand I can report or block anyone and that calls are not recorded.
              </span>
            </label>
          )}

          {left === 0 ? (
            <div className="mt-6"><LimitNotice message="You’ve used all your voice calls for today. They reset tomorrow." /></div>
          ) : (
            <button className="btn btn-talk btn-lg mt-6 w-full" onClick={start} disabled={!me.profile.voiceConsent && !agree}>
              <Mic className="size-5" /> Start call
            </button>
          )}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted"><ShieldCheck className="size-4" /> Calls are never recorded. Your partner can’t see your email or real name.</p>
        </>
      )}
    </div>
  )
}

function FailureNotice({ code, message, onRetry }: { code: string; message: string; onRetry: () => void }) {
  if (code === 'limit_reached' || code === 'premium_required') return <div className="mt-5"><LimitNotice message={message} /></div>
  const mic = code.startsWith('mic_')
  return (
    <div className="mt-5 flex gap-3 rounded-2xl border border-bad/25 bg-bad-soft p-4 text-sm text-bad" role="alert">
      {mic ? <MicOff className="size-5 shrink-0" /> : code === 'offline' ? <WifiOff className="size-5 shrink-0" /> : <AlertTriangle className="size-5 shrink-0" />}
      <div className="flex-1">
        <p className="font-bold">{mic ? 'Microphone problem' : code === 'in_call' ? 'You are still in another call' : 'We couldn’t start the call'}</p>
        <p className="mt-0.5 text-text/80">{message}</p>
        {!mic && code !== 'age_restricted' && code !== 'assessment_required' && (
          <button className="btn btn-secondary btn-sm mt-3" onClick={onRetry}>
            <RefreshCcw className="size-4" /> Try again
          </button>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------ Matching
function Matching({ call }: { call: CallState }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [])
  const waited = call.searchingSince ? Date.now() - call.searchingSince : 0
  const me = useUser()
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center px-6 pb-10 pt-16 text-center">
      <div className="relative grid size-40 place-items-center">
        {call.phase === 'matching' && [0, 0.8, 1.6].map((d) => <span key={d} className="absolute inset-6 rounded-full bg-talk/30 ripple" style={{ animationDelay: `${d}s` }} />)}
        <Avatar icon={me.profile.avatarIcon} color={me.profile.avatarColor} size={96} className="relative ring-4 ring-surface" />
      </div>
      <h1 className="h1 mt-8" aria-live="polite">{call.phase === 'mic' ? 'Allow microphone access' : 'Finding your speaking partner…'}</h1>
      <p className="mt-2 text-muted">
        {call.phase === 'mic'
          ? 'Your browser will ask to use the microphone. Choose “Allow” so your partner can hear you.'
          : waited > 45_000
            ? 'Still looking. We’re widening the search to more levels and topics.'
            : waited > 15_000
              ? 'Looking a little wider for a good match…'
              : `Matching you with a learner near ${me.profile.cefrLevel ?? 'your level'}.`}
      </p>
      {call.phase === 'matching' && (
        <>
          <p className="mt-4 font-mono text-2xl font-bold tabular-nums">{mmss(waited)}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge tone="primary">{call.request?.mode === 'ielts' ? 'IELTS Speaking' : 'Conversation'}</Badge>
            <Badge>{topicLabel(call.request?.topic ?? null)}</Badge>
            <LevelBadge level={me.profile.cefrLevel} />
          </div>
          <p className="mt-4 text-sm text-muted">{call.waitingOthers > 0 ? `${call.waitingOthers} other ${call.waitingOthers === 1 ? 'learner is' : 'learners are'} searching right now.` : 'No one else is searching right now. Stay here — you’ll be connected as soon as someone joins.'}</p>
        </>
      )}
      <button className="btn btn-secondary btn-lg mt-10 min-w-40" onClick={() => callEngine.cancel()}>Cancel</button>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------ In call
function InCall({ call }: { call: CallState }) {
  const [reportOpen, setReportOpen] = useState(false)
  const p = call.partner
  const statusText = {
    found: 'Partner found!',
    connecting: 'Connecting audio…',
    connected: call.partnerReconnecting ? 'Partner reconnecting…' : 'Connected',
    reconnecting: 'Reconnecting…',
  }[call.phase as 'found' | 'connecting' | 'connected' | 'reconnecting']
  const tone = call.phase === 'connected' && !call.partnerReconnecting ? 'good' : call.phase === 'found' ? 'talk' : 'warn'
  const remaining = call.maxSeconds * 1000 - call.elapsedMs

  useEffect(() => {
    if (call.warning) toast(call.warning, 'info')
  }, [call.warning])

  const block = async () => {
    if (!(await confirmDialog({ title: `Block ${p?.anonName}?`, body: 'The call will end and you will never be matched with this person again.', confirm: 'Block and end call', tone: 'danger' }))) return
    try {
      await post(`/calls/${call.sessionId}/block`)
      toast('Blocked. You won’t be matched again.')
    } catch (e) {
      toast(errorMessage(e), 'bad')
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4" onClick={() => document.querySelector<HTMLAudioElement>('audio[data-role="remote-audio"]')?.play().catch(() => undefined)}>
      <div className="flex items-center justify-between">
        <Badge tone={tone}>
          <span className={cx('size-2 rounded-full', tone === 'good' ? 'bg-good' : tone === 'talk' ? 'bg-talk' : 'bg-warn animate-pulse')} /> {statusText}
        </Badge>
        <span className="flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums text-muted" aria-label="Call duration">
          <Timer className="size-4" /> {mmss(call.elapsedMs)} {call.maxSeconds > 0 && <span className="font-normal text-faint">/ {mmss(call.maxSeconds * 1000)}</span>}
        </span>
      </div>

      <div className="flex flex-col items-center pb-4 pt-8 text-center">
        <div className="relative">
          <span className="absolute -inset-3 rounded-full bg-talk/25 transition-transform duration-150" style={{ transform: `scale(${call.phase === 'connected' && !call.partnerMuted ? 1 + call.partnerLevel * 0.35 : 0.85})`, opacity: call.partnerLevel > 0.05 ? 1 : 0 }} />
          {p && <Avatar icon={p.avatarIcon} color={p.avatarColor} size={104} className="relative" label={`${p.anonName}'s avatar`} />}
          {call.partnerMuted && <span className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-surface text-bad shadow"><MicOff className="size-5" aria-label="Partner is muted" /></span>}
        </div>
        <p className="mt-4 text-2xl font-extrabold" data-testid="partner-name">{p?.anonName}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {p?.level ? <LevelBadge level={p.level} /> : <Badge>Level hidden</Badge>}
          <Badge>{topicLabel(call.topic)}</Badge>
          {call.mode === 'ielts' && <Badge tone="talk">You are the {call.shared.swapped ? (call.role === 'candidate' ? 'practice partner' : 'candidate') : call.role === 'candidate' ? 'candidate' : 'practice partner'}</Badge>}
        </div>
        {(call.selfReconnecting || call.partnerReconnecting || call.phase === 'reconnecting') && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-warn-soft px-3 py-2 text-sm font-semibold text-warn" role="status">
            <Spinner className="size-4 text-warn" /> {call.selfReconnecting ? 'Your connection dropped. Reconnecting…' : call.partnerReconnecting ? 'Your partner’s connection dropped. Waiting for them to come back…' : 'The audio connection is unstable. Trying to recover…'}
          </p>
        )}
        {remaining > 0 && remaining < 60_000 && call.phase === 'connected' && <p className="mt-3 text-sm font-semibold text-warn">Less than a minute left in this call.</p>}
      </div>

      {call.prompts && <PromptPanel call={call} prompts={call.prompts} />}

      <div className="mt-auto pt-6">
        <div className="flex items-center justify-center gap-5">
          <button onClick={() => callEngine.toggleMute()} className={cx('grid size-16 place-items-center rounded-full border-2 transition-colors', call.muted ? 'border-bad bg-bad-soft text-bad' : 'border-border bg-surface text-text')} aria-pressed={call.muted} aria-label={call.muted ? 'Unmute microphone' : 'Mute microphone'}>
            {call.muted ? <MicOff className="size-7" /> : <Mic className="size-7" style={{ transform: `scale(${1 + call.micLevel * 0.25})` }} />}
          </button>
          <button onClick={() => callEngine.hangup()} className="grid size-20 place-items-center rounded-full bg-bad text-white shadow-[var(--shadow-pop)] transition-transform active:scale-95" aria-label="End call">
            <PhoneOff className="size-8" />
          </button>
          <button onClick={() => setReportOpen(true)} className="grid size-16 place-items-center rounded-full border-2 border-border bg-surface text-text" aria-label="Report or block">
            <Flag className="size-6" />
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-muted">{call.muted ? 'You are muted' : 'Microphone on'} · This call is not recorded</p>
      </div>
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} sessionId={call.sessionId!} partnerName={p?.anonName ?? 'this user'} onBlock={block} />
    </div>
  )
}

function PromptPanel({ call, prompts }: { call: CallState; prompts: Prompts }) {
  const i = call.shared.promptIndex
  const examinerRole = call.mode === 'ielts' && (call.shared.swapped ? call.role === 'candidate' : call.role !== 'candidate')
  const timer = call.shared.timer
  const left = useCountdown(timer?.endsAt ?? null)
  const go = (n: number) => callEngine.sync({ kind: 'prompt', index: n })

  if (prompts.kind === 'part2') {
    return (
      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Part 2 · Cue card</p>
        <p className="mt-2 text-lg font-bold">{prompts.card.cue}</p>
        <p className="mt-2 text-sm text-muted">You should say:</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[15px]">{prompts.card.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
        <p className="mt-1 text-[15px]">{prompts.card.explain}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {timer && left > 0 ? (
            <Badge tone={timer.phase === 'prep' ? 'warn' : 'talk'} className="px-3 py-1.5 text-sm">{timer.phase === 'prep' ? 'Preparation' : 'Speaking'} · {mmss(left)}</Badge>
          ) : timer && left === 0 ? (
            <Badge tone="good" className="px-3 py-1.5 text-sm">{timer.phase === 'prep' ? 'Preparation over — start speaking' : 'Time is up'}</Badge>
          ) : null}
          {examinerRole && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => callEngine.sync({ kind: 'timer', phase: 'prep', seconds: prompts.prepSeconds })}>Start 1-min preparation</button>
              <button className="btn btn-secondary btn-sm" onClick={() => callEngine.sync({ kind: 'timer', phase: 'speak', seconds: prompts.speakSeconds })}>Start 2-min talk</button>
            </>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => callEngine.sync({ kind: 'swap' })}>Swap roles</button>
        </div>
        {examinerRole && (
          <div className="mt-4 rounded-xl bg-surface-2 p-3 text-sm">
            <p className="font-bold">Follow-up questions (you ask)</p>
            <ul className="mt-1 list-disc pl-5 text-muted">{prompts.followUp.map((q) => <li key={q}>{q}</li>)}</ul>
          </div>
        )}
      </div>
    )
  }

  const list =
    prompts.kind === 'casual' ? prompts.questions.map((q) => ({ title: 'Conversation starter', q })) : prompts.kind === 'part1' ? prompts.sets.flatMap((s) => s.questions.map((q) => ({ title: `Part 1 · ${s.title}`, q }))) : prompts.questions.map((q) => ({ title: `Part 3 · ${prompts.title}`, q }))
  const cur = list[Math.min(i, list.length - 1)]
  if (!cur) return null
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">{cur.title}</p>
        <span className="text-xs font-semibold text-muted">{Math.min(i, list.length - 1) + 1} / {list.length}</span>
      </div>
      <p className="mt-2 min-h-14 text-lg font-bold">{cur.q}</p>
      {call.mode === 'ielts' && <p className="mt-1 text-xs text-muted">{examinerRole ? 'You read the question; your partner answers.' : 'Your partner asks; you answer in full sentences.'}</p>}
      <div className="mt-3 flex justify-between">
        <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => go(i - 1)}><ChevronLeft className="size-4" /> Previous</button>
        <button className="btn btn-secondary btn-sm" disabled={i >= list.length - 1} onClick={() => go(i + 1)}>Next question <ChevronRight className="size-4" /></button>
      </div>
    </div>
  )
}

export const REPORT_REASONS = [
  ['harassment', 'Rude, insulting or threatening'],
  ['hate', 'Hate speech or discrimination'],
  ['sexual', 'Sexual or inappropriate content'],
  ['scam', 'Asked for money, contacts or personal details'],
  ['spam', 'Spam or advertising'],
  ['underage', 'Seems to be under 18'],
  ['silent', 'Silent / not practising'],
  ['other', 'Something else'],
] as const

export function ReportModal({ open, onClose, sessionId, partnerName, onBlock }: { open: boolean; onClose: () => void; sessionId: string; partnerName: string; onBlock?: () => void }) {
  const [reason, setReason] = useState<string>('')
  const [details, setDetails] = useState('')
  const [block, setBlock] = useState(true)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      const r = await post<{ alreadyReported: boolean }>(`/calls/${sessionId}/report`, { reason, details: details.trim() || null, block })
      toast(r.alreadyReported ? 'You already reported this user. Thanks.' : 'Report sent. Thank you for keeping the community safe.')
      onClose()
    } catch (e) {
      toast(errorMessage(e), 'bad')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Report ${partnerName}`}
      footer={
        <>
          {onBlock && <button className="btn btn-secondary mr-auto" onClick={() => (onClose(), onBlock())}><Ban className="size-4" /> Block only</button>}
          <button className="btn btn-danger" disabled={!reason || busy} onClick={submit}>{busy && <Spinner className="size-4 text-white" />} Send report</button>
        </>
      }
    >
      <p className="text-sm text-muted">What happened? Reports are private — {partnerName} won’t know who reported them.</p>
      <div className="mt-3 grid gap-1.5" role="radiogroup" aria-label="Reason">
        {REPORT_REASONS.map(([id, l]) => (
          <label key={id} className={cx('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-[15px]', reason === id ? 'border-primary bg-primary-soft' : 'border-border')}>
            <input type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} className="size-4 accent-[var(--primary)]" /> {l}
          </label>
        ))}
      </div>
      <textarea className="input mt-3 h-24 py-2" maxLength={1000} placeholder="Add details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} aria-label="Details" />
      <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} className="size-4 accent-[var(--primary)]" /> Also block {partnerName} (ends the call if it’s still running)
      </label>
    </Modal>
  )
}
