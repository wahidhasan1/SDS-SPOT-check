import { useState } from 'react';
import { api, errorMessage } from '../src/lib/api';
import { Button, ErrorText, H1, Input, Notice, Screen } from '../src/components/ui';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Screen>
      <H1>Reset password</H1>
      {msg && <Notice text={msg} tone="success" />}
      <ErrorText error={err} />
      <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Button title="Send reset link" onPress={async () => {
        try {
          setMsg((await api.post<{ message: string }>('/auth/forgot-password', { email: email.trim() })).message);
        } catch (e) {
          setErr(errorMessage(e));
        }
      }} />
    </Screen>
  );
}
