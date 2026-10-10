import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Banner, Button, EmptyState, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';

export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { resendVerification } = useAuth();
  const [status, setStatus] = useState<{ tone: 'success' | 'danger'; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Screen title="Verify your email" back>
      <EmptyState
        icon="mail-unread-outline"
        title="Check your inbox"
        message={`We sent a confirmation link to ${email ?? 'your email address'}. Open it on this device, then sign in.`}
      />
      {status ? <Banner tone={status.tone} message={status.msg} /> : null}
      <Button title="I've confirmed — sign in" onPress={() => router.replace('/(auth)/sign-in')} />
      <Button
        title="Resend email"
        variant="secondary"
        loading={busy}
        disabled={!email}
        onPress={async () => {
          setBusy(true);
          try { await resendVerification(email!); setStatus({ tone: 'success', msg: 'Sent! It can take a minute to arrive.' }); }
          catch (e) { setStatus({ tone: 'danger', msg: errorMessage(e) }); }
          finally { setBusy(false); }
        }}
      />
    </Screen>
  );
}
