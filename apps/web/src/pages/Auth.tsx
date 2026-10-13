import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { registerSchema } from '@app/shared';
import { APP_NAME, api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/hooks';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link to="/welcome" className="brand" style={{ justifyContent: 'center' }}>
          <span className="brand-mark">◐</span>
          {APP_NAME}
        </Link>
        <div className="card pad-lg">
          <h1 style={{ fontSize: '1.4rem' }}>{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const u = await login(email, password);
      nav(u.onboardingCompleted ? '/' : '/onboarding');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="Welcome back">
      <form className="stack" onSubmit={submit}>
        {err && <div className="alert error" role="alert">{err}</div>}
        <label className="field">
          Email
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Password
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn block lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <div className="row between small">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/register">Create an account</Link>
        </div>
      </form>
    </Shell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', birthYear: '', accept: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const input = {
      email: form.email,
      password: form.password,
      displayName: form.displayName,
      birthYear: Number(form.birthYear),
      acceptTerms: form.accept as true,
    };
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    setBusy(true);
    try {
      await register(parsed.data as any);
      nav('/onboarding');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="Create your account">
      <form className="stack" onSubmit={submit}>
        {err && <div className="alert error" role="alert">{err}</div>}
        <label className="field">
          Your name
          <input className="input" required value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
          <span className="hint">Only shown to you. Speaking partners see an anonymous name.</span>
        </label>
        <label className="field">
          Email
          <input className="input" type="email" autoComplete="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label className="field">
          Password
          <input className="input" type="password" autoComplete="new-password" required value={form.password} onChange={(e) => set('password', e.target.value)} />
          <span className="hint">At least 8 characters with a letter and a number.</span>
        </label>
        <label className="field">
          Birth year
          <input className="input" inputMode="numeric" required placeholder="e.g. 1998" value={form.birthYear} onChange={(e) => set('birthYear', e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <span className="hint">Used only for age-appropriate safety settings. Live calls are for adults (18+).</span>
        </label>
        <label className="row small" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={form.accept} onChange={(e) => set('accept', e.target.checked)} />
          <span>
            I agree to the <Link to="/guidelines" target="_blank">community guidelines</Link> and understand that calls are not recorded.
          </span>
        </label>
        <button className="btn block lg" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <div className="small center">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </form>
    </Shell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api.post<{ message: string }>('/auth/forgot-password', { email });
      setMsg(r.message);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Shell title="Reset your password">
      <form className="stack" onSubmit={submit}>
        {msg && <div className="alert success">{msg}</div>}
        {err && <div className="alert error">{err}</div>}
        <label className="field">
          Email
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button className="btn block">Send reset link</button>
        <Link to="/login" className="small center">Back to sign in</Link>
      </form>
    </Shell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await api.post('/auth/reset-password', { token: params.get('token') ?? '', password });
      setDone(true);
      setTimeout(() => nav('/login'), 1500);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Shell title="Choose a new password">
      <form className="stack" onSubmit={submit}>
        {done && <div className="alert success">Password updated. Redirecting to sign in…</div>}
        {err && <div className="alert error">{err}</div>}
        <label className="field">
          New password
          <input className="input" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn block">Update password</button>
      </form>
    </Shell>
  );
}
