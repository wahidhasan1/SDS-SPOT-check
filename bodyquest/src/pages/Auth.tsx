import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark, Icon } from '../components/Icon';
import { Button, Field, Note } from '../components/ui';
import { validateDisplayName, validateEmail, validatePassword } from '../store/auth';
import { useApp } from '../store/AppStore';
import { loadUserData } from '../store/userData';
import { LocalStorageAdapter } from '../store/storage';

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <Link to="/" className="brand" style={{ padding: 0 }}>
          <BrandMark />
          <span className="brand-name">BODYQUEST</span>
        </Link>
        <div>
          <h2 style={{ fontSize: '2rem' }}>
            Consistency beats intensity.
            <br />
            <span style={{ color: 'var(--accent)' }}>Every session counts.</span>
          </h2>
          <p style={{ color: 'var(--ink-muted)' }}>Home workouts, food and recovery guidance, streaks that respect rest days, and fair battles on consistency.</p>
        </div>
        <p className="small" style={{ color: 'var(--ink-muted)' }}>
          General fitness guidance only — not a substitute for medical advice.
        </p>
      </aside>
      <main className="auth-main" id="main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}

const DemoAuthNote = () => (
  <Note tone="warning" title="Demo authentication">
    Accounts are stored only in this browser (password hashed with PBKDF2). This is not production-grade sign-in and nothing syncs between devices.
  </Note>
);

export function SignUp() {
  const { auth, user } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.title = 'Sign up · BODYQUEST';
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = { name: validateDisplayName(name), email: validateEmail(email), pw: validatePassword(pw) };
    setErrors(errs);
    setFormError('');
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      await auth.signUp(email, pw, name);
      navigate('/onboarding');
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <h1>Create your account</h1>
      <p className="muted">Start your quest in about 3 minutes.</p>
      {user?.isGuest && <Note tone="info">You’re in guest mode. Creating an account starts fresh — guest data stays under the guest profile on this device.</Note>}
      <form onSubmit={submit} noValidate className="stack-lg mt-3">
        <Field label="Your name" error={errors.name ?? undefined}>
          {(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />}
        </Field>
        <Field label="Email" error={errors.email ?? undefined}>
          {(p) => <input {...p} className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}
        </Field>
        <Field label="Password" error={errors.pw ?? undefined} hint="At least 8 characters with a letter and a number.">
          {(p) => (
            <div className="input-group">
              <input {...p} className="input" type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
              <button type="button" className="btn btn-secondary" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                <Icon name={showPw ? 'eyeOff' : 'eye'} size={18} />
              </button>
            </div>
          )}
        </Field>
        {formError && <Note tone="danger">{formError}</Note>}
        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <div className="mt-3 stack">
        <DemoAuthNote />
        <p className="muted text-center">
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </div>
    </AuthFrame>
  );
}

export function SignIn() {
  const { auth } = useApp();
  const navigate = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.title = 'Sign in · BODYQUEST';
  }, []);

  const goNext = (userId: string) => {
    const d = loadUserData(new LocalStorageAdapter(), userId);
    navigate(d.plan ? loc.state?.from ?? '/app' : '/onboarding');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = { email: validateEmail(email), pw: pw ? null : 'Password is required.' };
    setErrors(errs);
    setFormError('');
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      const u = await auth.signIn(email, pw);
      goNext(u.id);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <h1>Welcome back</h1>
      <p className="muted">Sign in to continue your quest.</p>
      <form onSubmit={submit} noValidate className="stack-lg mt-3">
        <Field label="Email" error={errors.email ?? undefined}>
          {(p) => <input {...p} className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}
        </Field>
        <Field label="Password" error={errors.pw ?? undefined}>
          {(p) => <input {...p} className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />}
        </Field>
        {formError && <Note tone="danger">{formError}</Note>}
        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <div className="divider" />
      <Button
        variant="secondary"
        block
        icon="user"
        onClick={() => {
          auth.guest();
          navigate('/onboarding');
        }}
      >
        Continue as guest
      </Button>
      <Button
        className="mt-2"
        variant="secondary"
        block
        icon="play"
        onClick={async () => {
          await auth.demo();
          navigate('/app');
        }}
      >
        Explore the demo account
      </Button>
      <div className="mt-3 stack">
        <DemoAuthNote />
        <p className="muted text-center">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </AuthFrame>
  );
}
