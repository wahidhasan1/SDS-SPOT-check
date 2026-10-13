import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Ban, BookmarkPlus, CheckCircle2, Clock, Flag, Mic, Star, XCircle } from 'lucide-react'
import { callEngine, type CallState } from '../../features/call/engine'
import { errorMessage, post } from '../../lib/api'
import { Badge, Spinner, confirmDialog, cx, mmss, toast } from '../../components/ui'
import { ReportModal, topicLabel } from './CallScreen'

export const FEEDBACK_TAGS = ['Clear speaker', 'Good listener', 'Friendly', 'Rich vocabulary', 'Fluent', 'Helpful corrections', 'Patient']

export function endReasonText(reason: string, endedBy: string) {
  switch (reason) {
    case 'hangup':
      return endedBy === 'you' ? 'You ended the call.' : 'Your partner ended the call.'
    case 'partner_left':
      return endedBy === 'you' ? 'Your connection was lost for too long.' : 'Your partner lost their connection.'
    case 'connection_failed':
      return 'The audio connection could not be set up. This can happen on very strict networks (for example some office or school Wi-Fi). Try another network or mobile data.'
    case 'time_limit':
      return 'You reached the maximum call length for your plan.'
    case 'moderation':
      return 'The call was ended by our safety system.'
    case 'server_restart':
      return 'The call ended because the service restarted.'
    default:
      return 'The call has ended.'
  }
}

export function CallSummary({ call }: { call: CallState }) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const e = call.ended!
  const completed = e.durationS >= 60
  const connected = e.durationS > 0
  const [rating, setRating] = useState<number | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [self, setSelf] = useState({ fluency: 3, vocabulary: 3, confidence: 3 })
  const [selfOn, setSelfOn] = useState(false)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [word, setWord] = useState('')
  const [savedWords, setSavedWords] = useState<string[]>([])

  const again = () => {
    const req = call.request
    callEngine.reset()
    qc.invalidateQueries({ queryKey: ['call-status'] })
    if (req) void callEngine.start(req)
  }

  const sendFeedback = async () => {
    setBusy(true)
    try {
      await post(`/calls/${e.sessionId}/feedback`, { rating, tags, selfAssessment: selfOn ? self : null })
      setSent(true)
      toast('Thanks for your feedback!')
    } catch (err) {
      toast(errorMessage(err), 'bad')
    } finally {
      setBusy(false)
    }
  }

  const saveWord = async () => {
    const w = word.trim()
    if (!w) return
    try {
      await post('/vocab/saved', { word: w, source: 'call', context: `Speaking practice: ${topicLabel(call.topic)}` })
      setSavedWords((s) => [...s, w])
      setWord('')
    } catch (err) {
      toast(errorMessage(err), 'bad')
    }
  }

  const block = async () => {
    if (!(await confirmDialog({ title: `Block ${call.partner?.anonName}?`, body: 'You will never be matched with this person again.', confirm: 'Block', tone: 'danger' }))) return
    await post(`/calls/${e.sessionId}/block`).then(() => toast('Blocked.'), (err) => toast(errorMessage(err), 'bad'))
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-8 fade-up">
      <div className="text-center">
        <span className={cx('mx-auto grid size-16 place-items-center rounded-full', connected ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad')}>
          {connected ? <CheckCircle2 className="size-8" /> : <XCircle className="size-8" />}
        </span>
        <h1 className="h1 mt-4">{!connected ? 'Call didn’t connect' : completed ? 'Great practice!' : 'Call ended'}</h1>
        <p className="mx-auto mt-2 max-w-md text-muted" data-testid="end-reason">{endReasonText(e.reason, e.endedBy)}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Badge tone="primary"><Clock className="size-3.5" /> {mmss(e.durationS * 1000)}</Badge>
          <Badge>{call.mode === 'ielts' ? 'IELTS Speaking' : 'Conversation'}</Badge>
          <Badge>{topicLabel(call.topic)}</Badge>
          {call.partner && <Badge>with {call.partner.anonName}</Badge>}
        </div>
        {!connected && <p className="mt-3 text-sm text-muted">Calls that don’t connect don’t count towards your daily limit.</p>}
      </div>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <button className="btn btn-talk btn-lg sm:flex-1" onClick={again}><Mic className="size-5" /> Find another partner</button>
        <button className="btn btn-secondary btn-lg sm:flex-1" onClick={() => (callEngine.reset(), nav("/speak"))}>Done</button>
      </div>

      {connected && call.sessionId && (
        <section className="card mt-6 p-5">
          <h2 className="h2">How was the conversation?</h2>
          {sent ? (
            <p className="mt-2 text-sm text-good">Feedback saved. Your partner only sees the positive tags you chose, anonymously.</p>
          ) : (
            <>
              <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)} className="p-1">
                    <Star className={cx('size-8', rating && n <= rating ? 'fill-warn text-warn' : 'text-faint')} />
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm font-semibold">What was good about your partner?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {FEEDBACK_TAGS.map((t) => (
                  <button key={t} aria-pressed={tags.includes(t)} disabled={!tags.includes(t) && tags.length >= 4} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} className={cx('chip', tags.includes(t) && 'chip-on')}>{t}</button>
                ))}
              </div>
              <label className="mt-5 flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={selfOn} onChange={(ev) => setSelfOn(ev.target.checked)} className="size-4 accent-[var(--primary)]" /> Rate my own speaking (private)
              </label>
              {selfOn && (
                <div className="mt-3 grid gap-3">
                  {(['fluency', 'vocabulary', 'confidence'] as const).map((k) => (
                    <label key={k} className="grid grid-cols-[110px_1fr_24px] items-center gap-3 text-sm capitalize">
                      {k}
                      <input type="range" min={1} max={5} value={self[k]} onChange={(ev) => setSelf({ ...self, [k]: Number(ev.target.value) })} className="accent-[var(--primary)]" />
                      <span className="font-bold">{self[k]}</span>
                    </label>
                  ))}
                </div>
              )}
              <button className="btn btn-primary mt-5" onClick={sendFeedback} disabled={busy || (!rating && !tags.length && !selfOn)}>{busy && <Spinner className="size-4 text-on-primary" />} Save feedback</button>
            </>
          )}
        </section>
      )}

      {connected && (
        <section className="card mt-4 p-5">
          <h2 className="h2">Save new words</h2>
          <p className="mt-1 text-sm text-muted">Heard a useful word or phrase? Save it to review later.</p>
          <form className="mt-3 flex gap-2" onSubmit={(ev) => (ev.preventDefault(), void saveWord())}>
            <input className="input" placeholder="e.g. break the ice" value={word} onChange={(ev) => setWord(ev.target.value)} maxLength={60} aria-label="Word or phrase" />
            <button className="btn btn-secondary"><BookmarkPlus className="size-4" /> Save</button>
          </form>
          {savedWords.length > 0 && <p className="mt-2 text-sm text-good">Saved: {savedWords.join(', ')} · <Link to="/vocab/saved" className="link">Review</Link></p>}
        </section>
      )}

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link to="/speak/practice" className="card p-4 hover:border-primary/40"><p className="font-bold">Practise alone with AI</p><p className="text-sm text-muted">Record an answer and get transcript-based feedback.</p></Link>
        <Link to="/vocab" className="card p-4 hover:border-primary/40"><p className="font-bold">Build vocabulary</p><p className="text-sm text-muted">Topic words for your next conversation.</p></Link>
      </section>

      {call.sessionId && call.partner && (
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn btn-ghost btn-sm text-bad" onClick={() => setReportOpen(true)}><Flag className="size-4" /> Report</button>
          <button className="btn btn-ghost btn-sm text-bad" onClick={block}><Ban className="size-4" /> Block</button>
        </div>
      )}
      {call.sessionId && <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} sessionId={call.sessionId} partnerName={call.partner?.anonName ?? 'this user'} />}
    </div>
  )
}
