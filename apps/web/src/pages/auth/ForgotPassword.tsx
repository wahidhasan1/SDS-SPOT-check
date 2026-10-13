import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Alert, Button, Input } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuthShell } from './AuthShell';

export default function ForgotPassword() {
  const { integrations } = useAuth();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ message: string }>('/api/auth/forgot-password', { email: email.trim() });
      setDone(r.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="We will email you a link to choose a new password." footer={<Link to="/login" className="font-semibold text-brand-600 hover:underline">Back to sign in</Link>}>
      {integrations && !integrations.email && (
        <Alert tone="warning" className="mb-4" title="Email delivery is not configured">
          This server has no SMTP settings, so reset emails are not sent. In development the reset link is written to the API server log and to the admin email outbox.
        </Alert>
      )}
      {done ? (
        <Alert tone="success">{done}</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <Button type="submit" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}
