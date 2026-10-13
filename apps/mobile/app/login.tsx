import { useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { errorMessage } from '../src/lib/api';
import { Button, ErrorText, H1, Input, Screen } from '../src/components/ui';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const u = await login(email.trim(), password);
      router.replace(u.onboardingCompleted ? '/(tabs)/home' : '/onboarding');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <H1>Welcome back</H1>
      <ErrorText error={err} />
      <Input label="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
      <Input label="Password" secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} />
      <Button title="Sign in" onPress={submit} loading={busy} />
      <Button title="Forgot password?" variant="ghost" onPress={() => router.push('/forgot')} />
    </Screen>
  );
}
