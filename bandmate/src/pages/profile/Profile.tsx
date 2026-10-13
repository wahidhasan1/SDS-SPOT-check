import { useEffect, useState, type ReactNode } from 'react'
import { Link, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, ChevronRight, CreditCard, Download, Eye, Gauge, LogOut, Moon, Palette, RefreshCw, Shield, ShieldCheck, Sparkles, Target, Trash2, UserRound } from 'lucide-react'
import { CALL_TOPICS, CEFR_INFO, LIMIT_KEYS, TARGET_BANDS, type Cefr, type LimitKey } from '../../../shared/config'
import { ApiError, api, del, errorMessage, patch, post } from '../../lib/api'
import { useConfig, useRefreshMe, useUser, type Me } from '../../lib/session'
import { getThemePref, setThemePref, type ThemePref } from '../../lib/theme'
import { currentPushSubscription, disablePush, enablePush, pushSupported } from '../../lib/push'
import { Avatar, Badge, ErrorState, Field, LevelBadge, Modal, NotConfigured, Page, PageHeader, PageLoader, Progress, Segmented, Spinner, confirmDialog, cx, toast } from '../../components/ui'
import { Assessment, type AssessmentResult } from '../../features/assessment/Assessment'
import { LANGUAGES } from '../onboarding/Onboarding'

export default function Profile() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="goals" element={<Goals />} />
      <Route path="level" element={<Level />} />
      <Route path="privacy" element={<Privacy />} />
      <Route path="notifications" element={<NotificationSettings />} />
      <Route path="appearance" element={<Appearance />} />
      <Route path="plan" element={<Plan />} />
      <Route path="plan/test-checkout" element={<TestCheckout />} />
    </Routes>
  )
}

/** Saves profile fields and refreshes the signed-in user. */
function useSave() {
  const refresh = useRefreshMe()
  return async (body: Partial<Record<keyof Me['profile'] | 'timezoneOffset', unknown>>, msg = 'Saved') => {
    try {
      await patch('/me/profile', body)
      await refresh()
      if (msg) toast(msg)
      return true
    } catch (e) {
      toast(errorMessage(e), 'bad')
      return false
    }
  }
}

function Row({ to, icon: Icon, title, sub, right }: { to: string; icon: typeof Target; title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
      <Icon className="size-5 shrink-0 text-muted" />
      <span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span>{sub && <span className="block truncate text-sm text-muted">{sub}</span>}</span>
      {right}
      <ChevronRight className="size-4 shrink-0 text-faint" />
    </Link>
  )
}

function Overview() {
  const me = useUser()
  const nav = useNavigate()
  const qc = useQueryClient()
  const p = me.profile
  const level = p.cefrLevel as Cefr | null
  const logout = async () => {
    await post('/auth/logout').catch(() => undefined)
    qc.clear()
    nav('/welcome', { replace: true })
  }
  return (
    <Page width="max-w-2xl">
      <div className="card mb-5 flex flex-wrap items-center gap-4 p-5">
        <Avatar icon={p.avatarIcon} color={p.avatarColor} size={64} label={p.anonName} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold">{p.displayName}</h1>
          <p className="text-sm text-muted">{me.email}</p>
          <p className="mt-1 text-sm">In calls you appear as <b>{p.anonName}</b></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LevelBadge level={level} />
          <Badge tone={me.plan.planId === 'free' ? 'neutral' : 'primary'}>{me.plan.planName}</Badge>
        </div>
      </div>
      <div className="mb-5 grid grid-cols-3 gap-3 text-center">
        <div className="card p-3"><p className="text-xl font-extrabold tabular-nums">{me.streak.current}</p><p className="text-xs text-muted">day streak</p></div>
        <div className="card p-3"><p className="text-xl font-extrabold tabular-nums">{me.rating.rating}</p><p className="text-xs text-muted">battle rating</p></div>
        <div className="card p-3"><p className="text-xl font-extrabold">{level ?? '—'}</p><p className="text-xs text-muted">{level ? CEFR_INFO[level].name : 'level'}</p></div>
      </div>
      <nav className="card divide-y divide-border overflow-hidden" aria-label="Settings">
        <Row to="/profile/goals" icon={Target} title="Goals" sub={p.goal === 'ielts' ? `IELTS ${p.testType === 'general_training' ? 'General Training' : 'Academic'} · target ${p.targetBand?.toFixed(1) ?? '—'}` : p.goal === 'work' ? 'English for work' : 'General English'} />
        <Row to="/profile/level" icon={Gauge} title="English level" sub="Your level history and retake the level check" />
        <Row to="/account/plan" icon={CreditCard} title="Plan" sub={me.plan.planId === 'free' ? 'Free plan · see Premium' : `${me.plan.planName}${me.plan.subscription?.cancelAtPeriodEnd ? ' · ends soon' : ''}`} />
        <Row to="/profile/privacy" icon={ShieldCheck} title="Privacy & safety" sub="Visibility, consents, blocked users, your data" />
        <Row to="/profile/notifications" icon={Bell} title="Reminders & notifications" sub={p.remindersEnabled ? `Daily reminder at ${String(p.reminderHour ?? 19).padStart(2, '0')}:00` : 'Reminders off'} />
        <Row to="/profile/appearance" icon={Palette} title="Appearance" sub="Light, dark or system theme" />
        {me.role === 'admin' && <Row to="/admin" icon={Shield} title="Admin" sub="Content, moderation, users, plans" />}
      </nav>
      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <Link to="/guidelines" className="link">Community guidelines</Link>
        <Link to="/privacy" className="link">Privacy policy</Link>
        <Link to="/terms" className="link">Terms</Link>
      </div>
      <button className="btn btn-secondary mt-5 w-full sm:w-auto" onClick={logout}><LogOut className="size-4" /> Log out</button>
    </Page>
  )
}

function Goals() {
  const me = useUser()
  const save = useSave()
  const p = me.profile
  const [f, setF] = useState({ goal: p.goal ?? 'ielts', testType: p.testType ?? 'academic', targetBand: p.targetBand ?? 6.5, dailyMinutes: p.dailyMinutes ?? 20, nativeLanguage: p.nativeLanguage ?? '', interests: p.interests, gender: p.gender, displayName: p.displayName })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const [busy, setBusy] = useState(false)
  const casual = CALL_TOPICS.filter((t) => !t.id.startsWith('ielts') && t.id !== 'random')
  return (
    <Page width="max-w-2xl">
      <PageHeader title="Goals & details" back={{ to: '/profile', label: 'Profile' }} />
      <form
        className="card space-y-5 p-5"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          await save({ ...f, nativeLanguage: f.nativeLanguage || null, testType: f.goal === 'ielts' ? f.testType : p.testType, targetBand: f.goal === 'ielts' ? f.targetBand : p.targetBand, timezoneOffset: -new Date().getTimezoneOffset() })
          setBusy(false)
        }}
      >
        <Field label="Your name" htmlFor="dn" hint="Only you see this. Partners see your anonymous name.">
          <input id="dn" className="input" value={f.displayName} maxLength={40} onChange={(e) => set('displayName', e.target.value)} />
        </Field>
        <Field label="Main goal">
          <Segmented label="Main goal" value={f.goal} onChange={(v) => set('goal', v)} items={[{ id: 'ielts', label: 'IELTS' }, { id: 'general', label: 'General English' }, { id: 'work', label: 'Work' }]} />
        </Field>
        {f.goal === 'ielts' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="IELTS test">
              <Segmented label="IELTS test" value={f.testType} onChange={(v) => set('testType', v)} items={[{ id: 'academic', label: 'Academic' }, { id: 'general_training', label: 'General Training' }]} />
            </Field>
            <Field label="Target band" htmlFor="tb">
              <select id="tb" className="input" value={f.targetBand} onChange={(e) => set('targetBand', Number(e.target.value))}>{TARGET_BANDS.map((b) => <option key={b} value={b}>{b.toFixed(1)}</option>)}</select>
            </Field>
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Daily study time">
            <div className="flex flex-wrap gap-2">{[10, 20, 30, 60].map((m) => <button type="button" key={m} onClick={() => set('dailyMinutes', m)} className={cx('chip', f.dailyMinutes === m && 'chip-on')}>{m} min</button>)}</div>
          </Field>
          <Field label="First language" htmlFor="nl" hint="Used for translations.">
            <select id="nl" className="input" value={f.nativeLanguage} onChange={(e) => set('nativeLanguage', e.target.value)}><option value="">Choose…</option>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select>
          </Field>
        </div>
        <Field label="Topics you like to talk about" hint="Used to suggest call topics.">
          <div className="flex flex-wrap gap-2">
            {casual.map((t) => {
              const on = f.interests.includes(t.id)
              return <button type="button" key={t.id} aria-pressed={on} onClick={() => set('interests', on ? f.interests.filter((x) => x !== t.id) : [...f.interests, t.id])} className={cx('chip', on && 'chip-on')}>{t.label}</button>
            })}
          </div>
        </Field>
        <Field label="Gender (optional)" hint="Only used if a Premium partner asks to be matched by gender. Never shown to partners.">
          <Segmented label="Gender" value={f.gender ?? 'none'} onChange={(v) => set('gender', v === 'none' ? null : (v as 'female' | 'male' | 'other'))} items={[{ id: 'none', label: 'Prefer not to say' }, { id: 'female', label: 'Female' }, { id: 'male', label: 'Male' }, { id: 'other', label: 'Other' }]} />
        </Field>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </Page>
  )
}

function Level() {
  const me = useUser()
  const refresh = useRefreshMe()
  const hist = useQuery({ queryKey: ['proficiency-history'], queryFn: () => api<{ level: string; score: number | null; source: string; created_at?: number; createdAt?: number }[]>('/me/proficiency-history') })
  const status = useQuery({ queryKey: ['assessment-status'], queryFn: () => api<{ lastAt: number | null; nextAt: number | null }>('/assessment/status') })
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const level = me.profile.cefrLevel as Cefr | null
  const canRetake = !status.data?.nextAt || status.data.nextAt <= Date.now()
  if (running && !result)
    return (
      <Page width="max-w-2xl">
        <PageHeader title="Level check" back={{ to: '/profile/level', label: 'English level' }} />
        <Assessment onDone={(r) => { setResult(r); void refresh(); void hist.refetch(); void status.refetch() }} />
      </Page>
    )
  return (
    <Page width="max-w-2xl">
      <PageHeader title="English level" back={{ to: '/profile', label: 'Profile' }} subtitle="Your level is measured by the adaptive level check — it can’t be set by hand. It is an estimate, not an official certificate." />
      {result && <div className="card mb-4 border-good/40 bg-good-soft p-4"><p className="font-bold text-good">New result: {result.level}</p></div>}
      <div className="card p-5">
        <div className="flex items-center gap-3"><LevelBadge level={level} className="text-base" /><p className="text-lg font-bold">{level ? CEFR_INFO[level].name : 'Not assessed yet'}</p></div>
        {level && <p className="mt-2 text-[15px] text-muted">{CEFR_INFO[level].can}</p>}
        <div className="mt-4">
          {canRetake ? (
            <button className="btn btn-primary" onClick={() => { setResult(null); setRunning(true) }}>Retake the level check</button>
          ) : (
            <p className="text-sm text-muted">You can retake the level check on {new Date(status.data!.nextAt!).toLocaleDateString()}. Waiting a week between checks gives a fairer picture of progress.</p>
          )}
        </div>
      </div>
      <h2 className="h2 mb-2 mt-6">History</h2>
      {hist.isLoading ? <PageLoader /> : !hist.data?.length ? <p className="text-sm text-muted">No results yet.</p> : (
        <ul className="card divide-y divide-border">
          {hist.data.map((h, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3"><LevelBadge level={h.level} /><span className="flex-1 text-sm text-muted">{h.source === 'assessment' ? 'Level check' : h.source}</span><span className="text-sm tabular-nums text-muted">{new Date(h.createdAt ?? h.created_at ?? 0).toLocaleDateString()}</span></li>
          ))}
        </ul>
      )}
    </Page>
  )
}

function Toggle({ label, desc, checked, onChange, disabled }: { label: string; desc?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5">
      <span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span>{desc && <span className="block text-sm text-muted">{desc}</span>}</span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden className={cx('mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary', checked ? 'bg-primary' : 'bg-border')}>
        <span className={cx('size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </span>
    </label>
  )
}

function Privacy() {
  const me = useUser()
  const save = useSave()
  const qc = useQueryClient()
  const refresh = useRefreshMe()
  const nav = useNavigate()
  const p = me.profile
  const blocked = useQuery({ queryKey: ['blocked'], queryFn: () => api<{ anonName: string | null; sessionId: string | null; blockedAt: number }[]>('/calls/blocked') })
  const [del_, setDel] = useState(false)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Page width="max-w-2xl">
      <PageHeader title="Privacy & safety" back={{ to: '/profile', label: 'Profile' }} />
      <h2 className="h2 mb-2">What partners see</h2>
      <div className="card divide-y divide-border">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Avatar icon={p.avatarIcon} color={p.avatarColor} size={40} label={p.anonName} />
          <span className="flex-1"><b className="block">{p.anonName}</b><span className="text-sm text-muted">Your anonymous name in calls, battles and the leaderboard</span></span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try {
                await post('/me/anon-identity')
                await refresh()
                toast('New anonymous identity')
              } catch (e) {
                toast(errorMessage(e), 'bad')
              }
            }}
          >
            <RefreshCw className="size-4" /> New name
          </button>
        </div>
        <Toggle label="Show my level to partners" desc="Partners see your CEFR level badge during calls." checked={p.showLevelToPartners} onChange={(v) => save({ showLevelToPartners: v })} />
        <Toggle label="Show me on the battle leaderboard" desc="Only your anonymous name and rating are shown." checked={p.showOnLeaderboard} onChange={(v) => save({ showOnLeaderboard: v })} />
      </div>

      <h2 className="h2 mb-2 mt-6">Consents</h2>
      <div className="card divide-y divide-border">
        <Toggle label="Voice calls with other learners" desc="Needed to start calls. Calls are peer-to-peer and never recorded." checked={p.voiceConsent} onChange={(v) => save({ voiceConsent: v })} />
        <Toggle label="Speech analysis" desc="Your practice recordings are transcribed on our server, then deleted. Only the transcript is kept." checked={p.speechConsent} onChange={(v) => save({ speechConsent: v })} />
        <Toggle label="AI feedback and translation" desc="Your essay, transcript or selected text is sent to our AI provider (Anthropic) when you ask for feedback or a translation." checked={p.aiConsent} onChange={(v) => save({ aiConsent: v })} />
      </div>

      <h2 className="h2 mb-2 mt-6">Blocked partners</h2>
      <div className="card">
        {blocked.isLoading ? <div className="p-4"><Spinner /></div> : !blocked.data?.length ? <p className="p-4 text-sm text-muted">You haven’t blocked anyone. Blocked people are never matched with you again.</p> : (
          <ul className="divide-y divide-border">
            {blocked.data.map((b, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <UserRound className="size-5 text-muted" />
                <span className="flex-1"><b className="block">{b.anonName ?? 'Partner'}</b><span className="text-sm text-muted">Blocked {new Date(b.blockedAt).toLocaleDateString()}</span></span>
                {b.sessionId && (
                  <button className="btn btn-ghost btn-sm" onClick={async () => { await del(`/calls/${b.sessionId}/block`); qc.invalidateQueries({ queryKey: ['blocked'] }); toast('Unblocked') }}>Unblock</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="h2 mb-2 mt-6">Your data</h2>
      <div className="card divide-y divide-border">
        <a href="/api/me/export" className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2" download="my-data.json">
          <Download className="size-5 text-muted" />
          <span className="flex-1"><b className="block">Download my data</b><span className="text-sm text-muted">Profile, results, essays, transcripts and saved words as JSON</span></span>
        </a>
        <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-bad hover:bg-bad-soft" onClick={() => setDel(true)}>
          <Trash2 className="size-5" />
          <span className="flex-1"><b className="block">Delete my account</b><span className="text-sm opacity-80">Permanently removes your account and learning data</span></span>
        </button>
      </div>

      <Modal
        open={del_}
        onClose={() => setDel(false)}
        title="Delete your account?"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDel(false)}>Cancel</button>
            <button
              className="btn bg-bad text-white"
              disabled={!pw || busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await del('/me', { password: pw })
                  qc.clear()
                  nav('/welcome', { replace: true })
                } catch (e) {
                  toast(errorMessage(e), 'bad')
                  setBusy(false)
                }
              }}
            >
              Delete permanently
            </button>
          </>
        }
      >
        <p className="text-[15px]">This permanently deletes your profile, progress, essays, transcripts, saved words and subscription records. It can’t be undone. {me.plan.subscription?.provider === 'stripe' && <b>Cancel your Premium subscription first in Plan → Manage billing, so you aren’t charged again.</b>}{me.plan.subscription?.provider === 'revenuecat' && <b>Cancel your subscription in the App Store or Google Play first.</b>}</p>
        <Field label="Enter your password to confirm" htmlFor="delpw"><input id="delpw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></Field>
      </Modal>
    </Page>
  )
}

function NotificationSettings() {
  const me = useUser()
  const cfg = useConfig()
  const save = useSave()
  const p = me.profile
  const [device, setDevice] = useState<'unknown' | 'on' | 'off'>('unknown')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void currentPushSubscription().then((s) => setDevice(s ? 'on' : 'off'))
  }, [])
  const f = cfg.data?.features
  return (
    <Page width="max-w-2xl">
      <PageHeader title="Reminders & notifications" back={{ to: '/profile', label: 'Profile' }} />
      <div className="card divide-y divide-border">
        <Toggle label="Daily practice reminder" desc="Only sent if you haven’t practised yet that day." checked={p.remindersEnabled} onChange={(v) => save({ remindersEnabled: v, reminderHour: p.reminderHour ?? 19, timezoneOffset: -new Date().getTimezoneOffset() })} />
        {p.remindersEnabled && (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex-1 font-semibold">Reminder time</span>
            <select className="input w-auto" value={p.reminderHour ?? 19} onChange={(e) => save({ reminderHour: Number(e.target.value), timezoneOffset: -new Date().getTimezoneOffset() })} aria-label="Reminder time">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </div>
        )}
        <Toggle label="Push notifications" desc="Reminders, Premium changes and safety notices on your devices. In-app notifications are always kept." checked={p.pushEnabled} onChange={(v) => save({ pushEnabled: v })} />
      </div>
      <h2 className="h2 mb-2 mt-6">This device</h2>
      {f && !f.push ? (
        <NotConfigured feature="Push notifications">The server needs VAPID keys (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY). You’ll still see reminders inside the app.</NotConfigured>
      ) : !pushSupported() ? (
        <p className="card p-4 text-sm text-muted">This browser doesn’t support push notifications. On iPhone, add the app to your Home Screen first (Share → Add to Home Screen).</p>
      ) : (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <Bell className="size-5 text-muted" />
          <span className="flex-1 text-sm">{device === 'on' ? 'Push notifications are on for this device.' : 'Push notifications are off for this device.'}</span>
          <button
            className={cx('btn btn-sm', device === 'on' ? 'btn-secondary' : 'btn-primary')}
            disabled={busy || device === 'unknown'}
            onClick={async () => {
              setBusy(true)
              try {
                if (device === 'on') {
                  await disablePush()
                  setDevice('off')
                } else {
                  await enablePush(f!.vapidPublicKey!)
                  setDevice('on')
                  toast('Push notifications enabled')
                }
              } catch (e) {
                toast(errorMessage(e), 'bad')
              } finally {
                setBusy(false)
              }
            }}
          >
            {device === 'on' ? 'Turn off' : 'Turn on'}
          </button>
        </div>
      )}
    </Page>
  )
}

function Appearance() {
  const [pref, setPref] = useState<ThemePref>(getThemePref())
  return (
    <Page width="max-w-2xl">
      <PageHeader title="Appearance" back={{ to: '/profile', label: 'Profile' }} />
      <div className="card p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold"><Moon className="size-5 text-muted" /> Theme</p>
        <Segmented label="Theme" value={pref} onChange={(v) => { setPref(v); setThemePref(v) }} items={[{ id: 'system', label: 'System' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]} />
      </div>
    </Page>
  )
}

// ------------------------------------------------------------------------------------------- plan & billing
type Billing = {
  plans: { id: string; name: string; priceLabel: string | null; limits: Record<LimitKey, number | boolean> }[]
  current: Me['plan']
  usage: Partial<Record<LimitKey, { used: number; limit: number }>>
  providers: { stripe: boolean; revenuecat: boolean; test: boolean }
  hasStripeCustomer: boolean
}

const fmtLimit = (v: number | boolean | undefined) => (typeof v === 'boolean' ? (v ? 'Yes' : '—') : v === -1 ? 'Unlimited' : String(v ?? '—'))

function Plan() {
  const refresh = useRefreshMe()
  const nav = useNavigate()
  const loc = useLocation()
  const [params, setParams] = useSearchParams()
  const q = useQuery({ queryKey: ['billing'], queryFn: () => api<Billing>('/billing') })
  const [busy, setBusy] = useState(false)
  const [notConfigured, setNotConfigured] = useState(false)
  const checkout = params.get('checkout')
  const [waiting, setWaiting] = useState(checkout === 'success')

  // After returning from checkout, access starts only when the provider confirms the payment (webhook).
  useEffect(() => {
    if (!waiting) return
    let n = 0
    const t = window.setInterval(async () => {
      n++
      await refresh()
      const r = await q.refetch()
      if (r.data?.current.planId !== 'free' || n > 20) {
        window.clearInterval(t)
        setWaiting(false)
        setParams({}, { replace: true })
      }
    }, 2000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting])

  if (q.isLoading) return <PageLoader />
  if (q.error) return <Page><ErrorState error={q.error} /></Page>
  const b = q.data!
  const premium = b.plans.find((p) => p.id === 'premium')
  const free = b.plans.find((p) => p.id === 'free')
  const sub = b.current.subscription
  const isPremium = b.current.planId !== 'free'
  const anyProvider = b.providers.stripe || b.providers.test

  const upgrade = async () => {
    setBusy(true)
    try {
      const r = await post<{ provider: string; url: string }>('/billing/checkout', { planId: 'premium' })
      if (r.provider === 'test') nav('/account/plan/test-checkout')
      else window.location.assign(r.url)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'not_configured') setNotConfigured(true)
      else toast(errorMessage(e), 'bad')
      setBusy(false)
    }
  }
  const manage = async () => {
    setBusy(true)
    try {
      if (sub?.provider === 'stripe') window.location.assign((await post<{ url: string }>('/billing/portal')).url)
      else if (sub?.provider === 'test') {
        const ok = await confirmDialog({ title: 'Cancel test subscription?', body: 'Premium stays active until the end of the period.', confirm: 'Cancel subscription' })
        if (ok) {
          await post('/billing/test/cancel', { immediately: false })
          await refresh()
          await q.refetch()
        }
        setBusy(false)
      }
    } catch (e) {
      toast(errorMessage(e), 'bad')
      setBusy(false)
    }
  }
  const restore = async () => {
    setBusy(true)
    try {
      await post('/billing/sync')
      await refresh()
      await q.refetch()
      toast('Purchases checked')
    } catch (e) {
      toast(errorMessage(e), 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page width="max-w-3xl">
      <PageHeader title="Your plan" back={{ to: loc.pathname.startsWith('/account') ? '/profile' : '/profile', label: 'Profile' }} />
      {waiting && (
        <div className="card mb-4 flex items-center gap-3 p-4" role="status"><Spinner /><p className="text-sm">Waiting for the payment provider to confirm your payment. Premium starts as soon as it does.</p></div>
      )}
      {checkout === 'cancelled' && <p className="card mb-4 p-4 text-sm text-muted">Checkout was cancelled. You haven’t been charged.</p>}

      <div className={cx('card p-5', isPremium && 'border-primary/40')}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-muted">Current plan</p>
            <p className="text-2xl font-extrabold">{b.current.planName}</p>
          </div>
          {isPremium && <Badge tone="primary"><Sparkles className="size-3" /> Premium</Badge>}
        </div>
        {sub && (
          <p className="mt-2 text-sm text-muted">
            {sub.provider === 'admin' ? 'Granted by the team' : sub.provider === 'test' ? 'Test subscription (development mode, no money moved)' : sub.provider === 'revenuecat' ? 'Purchased in the mobile app' : 'Billed through Stripe'}
            {sub.currentPeriodEnd && ` · ${sub.cancelAtPeriodEnd || sub.provider === 'admin' ? 'ends' : 'renews'} ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`}
            {sub.status === 'past_due' && <b className="text-warn"> · payment problem — please update your payment method</b>}
          </p>
        )}
        <div className="mt-4 space-y-3">
          {(Object.entries(b.usage) as [LimitKey, { used: number; limit: number }][]).map(([k, u]) => (
            <div key={k}>
              <div className="mb-1 flex justify-between text-sm"><span>{LIMIT_KEYS[k]}</span><span className="tabular-nums text-muted">{u.limit === -1 ? `${u.used} used · unlimited` : `${u.used} / ${u.limit}`}</span></div>
              {u.limit !== -1 && <Progress value={u.used} max={Math.max(1, u.limit)} tone={u.used >= u.limit ? 'warn' : 'primary'} />}
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {isPremium && (sub?.provider === 'stripe' || sub?.provider === 'test') && <button className="btn btn-secondary" disabled={busy} onClick={manage}><CreditCard className="size-4" /> {sub.provider === 'stripe' ? 'Manage billing' : 'Cancel test subscription'}</button>}
          {isPremium && sub?.provider === 'revenuecat' && <p className="text-sm text-muted">Manage or cancel your subscription in the App Store or Google Play.</p>}
          {(b.providers.stripe || b.hasStripeCustomer) && <button className="btn btn-ghost" disabled={busy} onClick={restore}><RefreshCw className="size-4" /> Restore purchases</button>}
        </div>
      </div>

      {premium && free && (
        <div className="card mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[15px]">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left"><th className="px-4 py-3 font-semibold">Feature</th><th className="px-4 py-3 font-semibold">Free</th><th className="px-4 py-3 font-semibold text-primary">Premium</th></tr>
              </thead>
              <tbody>
                {(Object.keys(LIMIT_KEYS) as LimitKey[]).map((k) => (
                  <tr key={k} className="border-b border-border last:border-0"><td className="px-4 py-2.5">{LIMIT_KEYS[k]}</td><td className="px-4 py-2.5 tabular-nums text-muted">{fmtLimit(free.limits[k])}</td><td className="px-4 py-2.5 font-semibold tabular-nums">{fmtLimit(premium.limits[k])}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isPremium && (
            <div className="border-t border-border p-5">
              <p className="mb-3 text-sm text-muted">{premium.priceLabel}</p>
              {notConfigured || !anyProvider ? (
                <NotConfigured feature="Payments">Premium can’t be bought on this server yet because no payment provider is set up. Nothing will be charged. {b.providers.revenuecat && 'Mobile in-app purchases are handled by the mobile app.'}</NotConfigured>
              ) : (
                <button className="btn btn-primary btn-lg" disabled={busy} onClick={upgrade}><Sparkles className="size-5" /> Upgrade to Premium</button>
              )}
              <p className="mt-3 text-xs text-muted">Free features stay free. Your progress is kept if you cancel.</p>
            </div>
          )}
        </div>
      )}
    </Page>
  )
}

/** Development-only checkout. Only reachable when the server runs with TEST_PAYMENTS=true (never in production). */
function TestCheckout() {
  const nav = useNavigate()
  const refresh = useRefreshMe()
  const qc = useQueryClient()
  const [card, setCard] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Page width="max-w-md">
      <PageHeader title="Test checkout" back={{ to: '/account/plan', label: 'Plan' }} />
      <div className="mb-4 rounded-2xl border-2 border-dashed border-warn bg-warn-soft p-4 text-sm text-warn">
        <b>TEST MODE — no real payment.</b> This screen exists only on development servers started with <code>TEST_PAYMENTS=true</code>. It is refused in production. Enter the test card <b>4242 4242 4242 4242</b>.
      </div>
      <form
        className="card space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await post('/billing/test/complete', { planId: 'premium', testCard: card.replace(/\s+/g, ' ').trim() })
            await refresh()
            qc.invalidateQueries({ queryKey: ['billing'] })
            toast('Test Premium is active')
            nav('/account/plan')
          } catch (err) {
            toast(errorMessage(err), 'bad')
            setBusy(false)
          }
        }}
      >
        <Field label="Test card number" htmlFor="tc"><input id="tc" className="input" inputMode="numeric" value={card} onChange={(e) => setCard(e.target.value)} placeholder="4242 4242 4242 4242" /></Field>
        <button className="btn btn-primary w-full" disabled={busy}><Eye className="size-4" /> Activate test Premium (30 days)</button>
      </form>
    </Page>
  )
}
