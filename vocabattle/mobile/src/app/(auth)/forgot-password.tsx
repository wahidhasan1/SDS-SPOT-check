import { useState } from 'react';

import { Banner, Button, Screen, TextField } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { validEmail } from '@/lib/validation';
import { useAuth } from '@/providers/auth-provider';

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'danger'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Screen title="Reset password" subtitle="We'll email you a secure link to choose a new password." back>
      {status ? <Banner tone={status.tone} message={status.msg} /> : null}
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Button
        title="Send reset link"
        loading={busy}
        onPress={async () => {
          if (!validEmail(email)) { setStatus({ tone: 'danger', msg: 'Enter a valid email address.' }); return; }
          setBusy(true);
          try {
            await requestPasswordReset(email);
            // Same message whether or not the account exists (no account enumeration).
            setStatus({ tone: 'success', msg: 'If an account exists for that email, a reset link is on its way.' });
          } catch (e) { setStatus({ tone: 'danger', msg: errorMessage(e) }); }
          finally { setBusy(false); }
        }}
      />
    </Screen>
  );
}
