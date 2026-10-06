import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, FlaskConical, Loader2, ShieldCheck } from 'lucide-react'
import { useStore } from '../store/store'
import { toast } from '../store/toast'
import { cx, normalizeBdPhone, prettyPhone } from '../lib/format'
import { useTitle } from '../lib/hooks'
import { Logo } from '../components/Logo'
import { Avatar, Badge } from '../components/ui'

export default function Login() {
  useTitle('Log in')
  const [params] = useSearchParams()
  const next = params.get('next') || '/'
  const nav = useNavigate()
  const users = useStore((s) => s.db.users)
  const login = useStore((s) => s.login)
  const loginWithPhone = useStore((s) => s.loginWithPhone)
  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const normalized = normalizeBdPhone(phone)
  const existing = users.find((u) => u.phone === normalized)

  const done = (id: string) => {
    const u = useStore.getState().db.users.find((x) => x.id === id)
    toast('success', `Welcome${u ? `, ${u.name.split(' ')[0]}` : ''}!`, 'You are using a demo account.')
    nav(next, { replace: true })
  }

  return (
    <div className="mx-auto grid min-h-[80dvh] max-w-5xl items-center gap-8 px-4 py-8 lg:grid-cols-2">
      <div className="hidden lg:block">
        <div className="relative overflow-hidden rounded-[2rem] bg-brand-gradient p-10 text-white">
          <div className="absolute -right-10 -top-10 size-60 rounded-full bg-white/10" />
          <Logo light />
          <p className="mt-10 font-display text-4xl font-extrabold leading-tight">Satisfy the urge.<br />Keep the money.</p>
          <p className="mt-4 text-white/80">Browse, order and track food and fashion as if it were real — then watch the craving fade when the simulation completes.</p>
        </div>
      </div>
      <div className="card p-6 sm:p-8">
        <button onClick={() => (step === 'phone' ? nav(-1) : setStep('phone'))} className="icon-btn -ml-2 mb-2" aria-label="Back"><ArrowLeft className="size-5" /></button>
        <h1 className="font-display text-2xl font-extrabold">{step === 'phone' ? 'Log in or sign up' : step === 'otp' ? 'Enter verification code' : 'What should we call you?'}</h1>
        <p className="mt-1 text-sm text-ink-500">{step === 'phone' ? 'Use your phone number — OTP is simulated.' : step === 'otp' ? <>We “sent” a 6-digit code to {normalized && prettyPhone(normalized)}.</> : 'Create your demo profile.'}</p>

        {step === 'phone' && (
          <form className="mt-5" onSubmit={(e) => { e.preventDefault(); if (!normalized) return setErr('Enter a valid Bangladeshi mobile number, e.g. 01712-345678'); setErr(''); setBusy(true); setTimeout(() => { setBusy(false); setStep('otp') }, 700) }}>
            <label className="label">Mobile number</label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-xl border border-r-0 border-ink-200 bg-ink-50 px-3 text-sm font-semibold">🇧🇩 +880</span>
              <input autoFocus inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setErr('') }} placeholder="1712-345678" className={cx('input rounded-l-none text-lg', err && 'input-error')} />
            </div>
            {err && <p className="mt-1.5 text-xs font-medium text-red-600">{err}</p>}
            <button disabled={busy} className="btn btn-primary btn-lg w-full mt-4">{busy ? <Loader2 className="size-5 animate-spin" /> : 'Send code'}</button>
          </form>
        )}

        {step === 'otp' && (
          <form className="mt-5" onSubmit={(e) => { e.preventDefault(); if (otp !== '123456') return setErr('Incorrect code. The demo OTP is 123456.'); setErr(''); if (existing) { login(existing.id); done(existing.id) } else setStep('name') }}>
            <input autoFocus inputMode="numeric" maxLength={6} value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setErr('') }} placeholder="••••••" className={cx('input h-14 text-center font-mono text-3xl tracking-[0.5em]', err && 'input-error')} />
            {err && <p className="mt-1.5 text-xs font-medium text-red-600">{err}</p>}
            <p className="mt-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900"><FlaskConical className="mr-1 inline size-3.5" /> Demo OTP: <b className="font-mono">123456</b> — no SMS is sent.</p>
            <button className="btn btn-primary btn-lg w-full mt-4">Verify</button>
            <button type="button" onClick={() => toast('info', 'Code re-sent (simulated)', 'It is still 123456.')} className="mt-2 w-full text-sm font-semibold text-brand-700">Resend code</button>
          </form>
        )}

        {step === 'name' && (
          <form className="mt-5" onSubmit={(e) => { e.preventDefault(); if (name.trim().length < 2) return setErr('Please enter your name'); const id = loginWithPhone(normalized!, name.trim()); done(id) }}>
            <input autoFocus value={name} onChange={(e) => { setName(e.target.value); setErr('') }} placeholder="Your name" className={cx('input h-12', err && 'input-error')} />
            {err && <p className="mt-1.5 text-xs font-medium text-red-600">{err}</p>}
            <button className="btn btn-primary btn-lg w-full mt-4">Create demo account</button>
          </form>
        )}

        {step === 'phone' && (
          <div className="mt-8">
            <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide text-ink-400"><span className="h-px flex-1 bg-ink-200" /> or continue as a demo user <span className="h-px flex-1 bg-ink-200" /></div>
            <div className="mt-3 space-y-2">
              {users.map((u) => (
                <button key={u.id} onClick={() => { login(u.id); done(u.id) }} className="flex w-full items-center gap-3 rounded-2xl border border-ink-200 p-3 text-left hover:border-brand-300 hover:bg-brand-50/50">
                  <Avatar name={u.name} color={u.avatarColor} size={40} />
                  <span className="flex-1 min-w-0"><span className="block font-semibold text-sm">{u.name}</span><span className="block text-xs text-ink-500">{prettyPhone(u.phone)}</span></span>
                  {u.role === 'admin' && <Badge tone="brand">Admin</Badge>}
                  <ChevronRight className="size-4 text-ink-300" />
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-400"><ShieldCheck className="size-4" /> Demo authentication — no real accounts or SMS.</p>
      </div>
    </div>
  )
}
