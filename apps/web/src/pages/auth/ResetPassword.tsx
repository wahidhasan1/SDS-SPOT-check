import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert, Button, Input } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuthShell } from './AuthShell';
import { validatePassword } from './Register';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { setMe } = useAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(token ? null : 'This reset link is missing its token. Request a new link.');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pe = validatePassword(pw);
    if (pe) return setError(pe);
    if (pw !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/reset-password', { token, password: pw });
      setMe(null);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Choose a new password">
      {done ? (
        <div className="space-y-4">
          <Alert tone="success">Your password has been changed. For safety, you have been signed out on all devices.</Alert>
          <Link to="/login" className="block text-center font-semibold text-brand-600 hover:underline">Sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <Input label="New password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" hint="At least 8 characters with a letter and a number." />
          <Input label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          <Button type="submit" className="w-full" loading={busy} disabled={!token}>Save new password</Button>
        </form>
      )}
    </AuthShell>
  );
}
