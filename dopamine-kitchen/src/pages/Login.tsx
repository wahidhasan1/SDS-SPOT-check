import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, FlaskConical, Gift, Loader2, ShieldCheck } from 'lucide-react'
import { useStore } from '../store/store'
import { toast } from '../store/toast'
import { cx, normalizeBdPhone, prettyPhone } from '../lib/format'
import { useTitle } from '../lib/hooks'
import { Logo } from '../components/Logo'
import { Avatar, Badge, Tabs } from '../components/ui'

type Mode = 'signup' | 'login'

export default function Login() {
  const [params, setParams] = useSearchParams()
  const mode: Mode = params.get('mode') === 'signup' ? 'signup' : 'login'
  useTitle(mode === 'signup' ? 'Sign up' : 'Log in')
  const next = params.get('next') || '/'
  const nav = useNavigate()
  const users = useStore((s) => s.db.users)
  const login = useStore((s) => s.login)
  const loginWithPhone = useStore((s) => s.loginWithPhone)
  const [step, setStep] = useState<'details' | 'otp'>('details')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [err, setErr] = useState<{ name?: string; phone?: string; otp?: string }>({})
  const [busy, setBusy] = useState(false)
  const normalized = normalizeBdPhone(phone)
  const existing = users.find((u) => u.phone === normalized)

  const setMode = (m: Mode) => {
    const p = new URLSearchParams(params)
    p.set('mode', m)
    setParams(p, { replace: true })
    setStep('details')
    setErr({})
  }

  const sendCode = () => {
    const e: typeof err = {}
    if (mode === 'signup' && name.trim().length < 2) e.name = 'Enter your name so we know what to call you'
    if (!normalized) e.phone = 'Enter a valid Bangladeshi mobile number, e.g. 01712-345678'
    else if (mode === 'signup' && existing) e.phone = 'This number already has an account.'
    else if (mode === 'login' && !existing) e.phone = 'No account with this number yet.'
    setErr(e)
    if (Object.keys(e).length) return
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      setStep('otp')
    }, 600)
  }

  const verify = () => {
    if (otp !== '123456') return setErr({ otp: 'That code is incorrect. In this demo it is always 123456.' })
    if (mode === 'login' && existing) {
      login(existing.id)
      toast('success', `Welcome back, ${existing.name.split(' ')[0]}`)
      nav(next, { replace: true })
      return
    }
    loginWithPhone(normalized!, name.trim())
    nav(`/welcome${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`, { replace: true })
  }

  return (
    <div className="mx-auto grid min-h-[86dvh] max-w-5xl items-center gap-8 px-4 py-8 lg:grid-cols-2">
      <div className="hidden lg:block">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand-surface p-10 text-white">
          <Logo light />
          <p className="mt-12 text-4xl font-extrabold leading-tight tracking-tight">Craving something?<br />Pick it. Track it.<br />Keep your money.</p>
          <p className="mt-4 text-white/80">Order food and fashion the way you normally would. Nothing is charged and nothing arrives, so the craving gets its moment and your wallet stays put.</p>
          <div className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-white/10 p-3 pr-4">
            <span className="grid size-10 place-items-center rounded-xl bg-sun-400 text-ink-900"><Gift className="size-5" /></span>
            <span className="text-sm"><b>New here?</b> Sign up and spin the welcome wheel for a voucher.</span>
          </div>
        </div>
      </div>

      <div className="card p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => (step === 'otp' ? setStep('details') : nav(-1))} className="icon-btn -ml-2" aria-label="Back"><ArrowLeft className="size-5" /></button>
          <Link to="/" className="lg:hidden"><Logo compact /></Link>
        </div>
        {step === 'details' && <Tabs value={mode} onChange={setMode} items={[{ id: 'signup', label: 'Sign up' }, { id: 'login', label: 'Log in' }]} className="mb-6" />}

        <h1 className="text-2xl font-extrabold tracking-tight">
          {step === 'otp' ? 'Enter the 6-digit code' : mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-1 text-[15px] text-ink-500">
          {step === 'otp' ? <>We “sent” it to {normalized && prettyPhone(normalized)}.</> : mode === 'signup' ? 'Takes 20 seconds. You get a welcome spin right after.' : 'Log in with your phone number.'}
        </p>

        {step === 'details' && (
          <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); sendCode() }} noValidate>
            {mode === 'signup' && (
              <div>
                <label htmlFor="su-name" className="label">Your name</label>
                <input id="su-name" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); setErr({}) }} placeholder="e.g. Rahim Uddin" className={cx('input h-12', err.name && 'input-error')} aria-invalid={!!err.name} aria-describedby={err.name ? 'su-name-err' : undefined} />
                {err.name && <p id="su-name-err" className="mt-1.5 text-sm font-medium text-red-600">{err.name}</p>}
              </div>
            )}
            <div>
              <label htmlFor="su-phone" className="label">Mobile number</label>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-xl border border-r-0 border-ink-200 bg-ink-50 px-3 text-sm font-bold">+880</span>
                <input id="su-phone" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => { setPhone(e.target.value); setErr({}) }} placeholder="1712-345678" className={cx('input h-12 rounded-l-none text-lg', err.phone && 'input-error')} aria-invalid={!!err.phone} aria-describedby={err.phone ? 'su-phone-err' : undefined} />
              </div>
              {err.phone && (
                <p id="su-phone-err" className="mt-1.5 text-sm font-medium text-red-600">
                  {err.phone}{' '}
                  {mode === 'signup' && existing && <button type="button" className="font-bold underline" onClick={() => setMode('login')}>Log in instead</button>}
                  {mode === 'login' && normalized && !existing && <button type="button" className="font-bold underline" onClick={() => setMode('signup')}>Sign up instead</button>}
                </p>
              )}
            </div>
            <button disabled={busy} className="btn btn-primary btn-lg w-full">{busy ? <><Loader2 className="size-5 animate-spin" /> Sending code…</> : 'Continue'}</button>
          </form>
        )}

        {step === 'otp' && (
          <form className="mt-6" onSubmit={(e) => { e.preventDefault(); verify() }}>
            <label htmlFor="otp" className="sr-only">Verification code</label>
            <input id="otp" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setErr({}) }} placeholder="••••••" className={cx('input h-14 text-center font-mono text-3xl tracking-[0.5em]', err.otp && 'input-error')} aria-invalid={!!err.otp} />
            {err.otp && <p className="mt-1.5 text-sm font-medium text-red-600">{err.otp}</p>}
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-sun-50 p-3 text-sm text-ink-700"><FlaskConical className="size-4 shrink-0 text-sun-700" /> Demo code: <b className="font-mono">123456</b>. No SMS is sent.</p>
            <button className="btn btn-primary btn-lg w-full mt-4" disabled={otp.length < 6}>{mode === 'signup' ? 'Create account' : 'Log in'}</button>
          </form>
        )}

        {mode === 'login' && step === 'details' && (
          <div className="mt-8">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Or try a demo account</p>
            <div className="mt-3 space-y-2">
              {users.map((u) => (
                <button key={u.id} onClick={() => { login(u.id); toast('success', `Signed in as ${u.name.split(' ')[0]}`); nav(next, { replace: true }) }} className="flex w-full items-center gap-3 rounded-2xl border border-ink-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/50">
                  <Avatar name={u.name} color={u.avatarColor} size={40} />
                  <span className="flex-1 min-w-0"><span className="block font-bold text-sm">{u.name}</span><span className="block text-xs text-ink-500">{prettyPhone(u.phone)}</span></span>
                  {u.role === 'admin' && <Badge tone="brand">Admin</Badge>}
                  <ChevronRight className="size-4 text-ink-300" />
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-500"><ShieldCheck className="size-4" /> Demo sign-in: no real SMS, no real account.</p>
      </div>
    </div>
  )
}
