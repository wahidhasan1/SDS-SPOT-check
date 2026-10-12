import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, MailCheck } from 'lucide-react'
import { PublicShell } from '../../components/Layout'
import { Field, Spinner, cx } from '../../components/ui'
import { ApiError, post } from '../../lib/api'

type Mode = 'login' | 'signup' | 'forgot' | 'reset'
const THIS_YEAR = new Date().getFullYear()

export default function Auth({ mode }: { mode: Mode }) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({})
  const [show, setShow] = useState(false)
  const [sent, setSent] = useState(false)
  const [f, setF] = useState({ email: '', password: '', displayName: '', birthYear: '', accept: false })
  const set = (k: keyof typeof f, v: string | boolean) => {
    setF((s) => ({ ...s, [k]: v }))
    setFieldErr((e) => ({ ...e, [k]: '' }))
    setError(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (mode !== 'reset' && !/^\S+@\S+\.\S+$/.test(f.email)) errs.email = 'Enter a valid email address'
    if (mode === 'signup' || mode === 'reset') {
      if (f.password.length < 8) errs.password = 'Use at least 8 characters'
      else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) errs.password = 'Use letters and at least one number'
    }
    if (mode === 'login' && !f.password) errs.password = 'Enter your password'
    if (mode === 'signup') {
      if (f.displayName.trim().length < 2) errs.displayName = 'Enter your name'
      const y = Number(f.birthYear)
      if (!y || y < 1920 || y > THIS_YEAR) errs.birthYear = 'Enter the year you were born, e.g. 1998'
      else if (THIS_YEAR - y < 13) errs.birthYear = 'You must be at least 13 to use this app'
      if (!f.accept) errs.accept = 'Please accept to continue'
    }
    setFieldErr(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signup') await post('/auth/signup', { email: f.email, password: f.password, displayName: f.displayName, birthYear: Number(f.birthYear), acceptTerms: true })
      if (mode === 'login') await post('/auth/login', { email: f.email, password: f.password })
      if (mode === 'forgot') {
        await post('/auth/forgot', { email: f.email })
        setSent(true)
        return
      }
      if (mode === 'reset') await post('/auth/reset', { token: params.get('token') ?? '', password: f.password })
      await qc.invalidateQueries({ queryKey: ['me'] })
      const next = params.get('next')
      nav(mode === 'signup' ? '/onboarding' : next && next.startsWith('/') ? next : '/', { replace: true })
    } catch (err) {
      const e = err as ApiError
      if (e.code === 'invalid' && Array.isArray(e.data.issues)) {
        const m: Record<string, string> = {}
        for (const i of e.data.issues as { path: string; message: string }[]) m[i.path] ??= i.message
        setFieldErr(m)
      } else setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const title = { login: 'Welcome back', signup: 'Create your free account', forgot: 'Reset your password', reset: 'Choose a new password' }[mode]
  const cta = { login: 'Log in', signup: 'Create account', forgot: 'Send reset link', reset: 'Save new password' }[mode]

  return (
    <PublicShell>
      <div className="w-full max-w-md fade-up">
        <div className="card p-6 sm:p-8">
          <h1 className="h1">{title}</h1>
          {mode === 'signup' && <p className="mt-1.5 text-muted">Takes about a minute. Then a short level check.</p>}
          {mode === 'forgot' && !sent && <p className="mt-1.5 text-muted">Enter your email and we’ll send you a link to set a new password.</p>}

          {sent ? (
            <div className="mt-6 flex gap-3 rounded-2xl bg-good-soft p-4 text-good">
              <MailCheck className="size-6 shrink-0" />
              <p className="text-sm font-medium">If an account exists for <b>{f.email}</b>, a reset link is on its way. It works for one hour. Check your spam folder too.</p>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              {mode === 'signup' && (
                <Field label="Your first name" htmlFor="displayName" error={fieldErr.displayName} hint="Only shown to you. Speaking partners see an anonymous name.">
                  <input id="displayName" className={cx('input', fieldErr.displayName && 'input-error')} autoComplete="given-name" value={f.displayName} onChange={(e) => set('displayName', e.target.value)} />
                </Field>
              )}
              {mode !== 'reset' && (
                <Field label="Email" htmlFor="email" error={fieldErr.email}>
                  <input id="email" type="email" inputMode="email" autoComplete="email" className={cx('input', fieldErr.email && 'input-error')} value={f.email} onChange={(e) => set('email', e.target.value)} />
                </Field>
              )}
              {mode !== 'forgot' && (
                <Field label={mode === 'reset' ? 'New password' : 'Password'} htmlFor="password" error={fieldErr.password} hint={mode !== 'login' ? 'At least 8 characters, with letters and a number.' : undefined}>
                  <div className="relative">
                    <input id="password" type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={cx('input pr-11', fieldErr.password && 'input-error')} value={f.password} onChange={(e) => set('password', e.target.value)} />
                    <button type="button" onClick={() => setShow(!show)} className="absolute right-1 top-1 grid size-9 place-items-center rounded-lg text-muted hover:text-text" aria-label={show ? 'Hide password' : 'Show password'}>
                      {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </Field>
              )}
              {mode === 'signup' && (
                <>
                  <Field label="Year of birth" htmlFor="birthYear" error={fieldErr.birthYear} hint="Voice calls with strangers are only for adults (18+).">
                    <input id="birthYear" inputMode="numeric" maxLength={4} placeholder="e.g. 1998" className={cx('input', fieldErr.birthYear && 'input-error')} value={f.birthYear} onChange={(e) => set('birthYear', e.target.value.replace(/\D/g, ''))} />
                  </Field>
                  <div>
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input type="checkbox" className="mt-0.5 size-5 accent-[var(--primary)]" checked={f.accept} onChange={(e) => set('accept', e.target.checked)} />
                      <span className="text-muted">
                        I agree to the <Link to="/terms" className="link" target="_blank">Terms</Link>, <Link to="/privacy" className="link" target="_blank">Privacy policy</Link> and <Link to="/guidelines" className="link" target="_blank">Community guidelines</Link>.
                      </span>
                    </label>
                    {fieldErr.accept && <p className="mt-1.5 text-sm font-medium text-bad" role="alert">{fieldErr.accept}</p>}
                  </div>
                </>
              )}
              {error && <p className="rounded-xl bg-bad-soft p-3 text-sm font-medium text-bad" role="alert">{error}</p>}
              <button className="btn btn-primary w-full" disabled={busy}>
                {busy && <Spinner className="size-4 text-on-primary" />} {cta}
              </button>
            </form>
          )}

          <div className="mt-6 space-y-2 text-center text-sm text-muted">
            {mode === 'login' && (
              <>
                <p><Link to="/forgot-password" className="link">Forgot your password?</Link></p>
                <p>New here? <Link to="/signup" className="link">Create an account</Link></p>
              </>
            )}
            {mode === 'signup' && <p>Already have an account? <Link to="/login" className="link">Log in</Link></p>}
            {(mode === 'forgot' || mode === 'reset') && <p><Link to="/login" className="link">Back to log in</Link></p>}
          </div>
        </div>
      </div>
    </PublicShell>
  )
}
