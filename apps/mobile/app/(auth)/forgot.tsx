import { useState } from 'react';
import { Button, Input, Notice, Screen } from '../../src/components/ui';
import { api, errorMessage } from '../../src/lib/api';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      {msg && <Notice tone={msg.tone} text={msg.text} />}
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Button
        title="Send reset link"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            const r = await api.post<{ message: string }>('/api/auth/forgot-password', { email: email.trim() });
            setMsg({ tone: 'success', text: `${r.message} Open the link on this device or any browser to choose a new password.` });
          } catch (e) {
            setMsg({ tone: 'error', text: errorMessage(e) });
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
