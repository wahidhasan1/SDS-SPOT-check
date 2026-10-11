import { router } from 'expo-router';
import { useState } from 'react';

import { Banner, Button, EmptyState, Screen, TextField } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { passwordProblem } from '@/lib/validation';
import { useAuth } from '@/providers/auth-provider';

/** Opened from the password-recovery email (which signs the user in with a recovery session). */
export default function ResetPassword() {
  const { session, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'danger'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session) {
    return (
      <Screen title="Reset password" back>
        <EmptyState icon="link-outline" title="Link expired or invalid" message="Request a new reset link and open it on this device." />
        <Button title="Request a new link" onPress={() => router.replace('/(auth)/forgot-password')} />
      </Screen>
    );
  }

  return (
    <Screen title="Choose a new password" back>
      {status ? <Banner tone={status.tone} message={status.msg} /> : null}
      <TextField label="New password" value={password} onChangeText={setPassword} secure autoComplete="new-password" hint="At least 8 characters with a number." />
      <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" />
      <Button
        title="Update password"
        loading={busy}
        onPress={async () => {
          const problem = passwordProblem(password);
          if (problem) { setStatus({ tone: 'danger', msg: problem }); return; }
          if (password !== confirm) { setStatus({ tone: 'danger', msg: 'Passwords do not match.' }); return; }
          setBusy(true);
          try { await updatePassword(password); setStatus({ tone: 'success', msg: 'Password updated.' }); setTimeout(() => router.replace('/'), 800); }
          catch (e) { setStatus({ tone: 'danger', msg: errorMessage(e) }); }
          finally { setBusy(false); }
        }}
      />
    </Screen>
  );
}
