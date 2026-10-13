import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert, Button, Input } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuthShell, Divider, GoogleButton } from './AuthShell';

export function validatePassword(pw: string): string | undefined {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Include at least one letter and one number.';
  return undefined;
}

export default function Register() {
  const { register, integrations } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '' });
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fe: Record<string, string | undefined> = {};
    if (form.displayName.trim().length < 2) fe.displayName = 'Enter at least 2 characters.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) fe.email = 'Enter a valid email address.';
    fe.password = validatePassword(form.password);
    if (form.confirm !== form.password) fe.confirm = 'Passwords do not match.';
    if (!accept) fe.accept = 'Please accept to continue.';
    setErrors(fe);
    if (Object.values(fe).some(Boolean)) return;
    setBusy(true);
    setError(null);
    try {
      await register({ displayName: form.displayName.trim(), email: form.email.trim(), password: form.password });
      nav('/onboarding', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free forever plan. No credit card needed."
      footer={
        <span className="muted">
          Already have an account? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>
        </span>
      }
    >
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Display name" hint="Shown on your profile. Voice partners see a random anonymous name instead." value={form.displayName} onChange={set('displayName')} error={errors.displayName} autoComplete="nickname" maxLength={40} />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" />
        <Input label="Password" type="password" value={form.password} onChange={set('password')} error={errors.password} hint="At least 8 characters with a letter and a number." autoComplete="new-password" />
        <Input label="Confirm password" type="password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          <span>
            I agree to respectful behaviour in voice calls and have read the <Link to="/privacy" className="text-brand-600 hover:underline">privacy notice</Link>.
            {errors.accept && <span className="block text-red-600">{errors.accept}</span>}
          </span>
        </label>
        <Button type="submit" className="w-full" loading={busy}>Create account</Button>
      </form>
      {integrations?.googleAuth && (
        <>
          <Divider />
          <GoogleButton />
        </>
      )}
    </AuthShell>
  );
}
