import { useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Button, Input, Notice, Screen } from '../../src/components/ui';
import { errorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { API_URL } from '../../src/lib/config';
import { useApi } from '../../src/lib/useApi';

export default function Login() {
  const { login, loginWithCode } = useAuth();
  const providers = useApi<{ google: boolean }>('/api/auth/providers');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    // The server completes Google OAuth in the browser and redirects back with a one-time code.
    const result = await WebBrowser.openAuthSessionAsync(`${API_URL}/api/auth/google/start?client=mobile`, 'fluentpath://auth');
    if (result.type !== 'success') return;
    const code = Linking.parse(result.url).queryParams?.code;
    if (typeof code !== 'string') return setError('Google sign-in did not complete.');
    try {
      await loginWithCode(code);
      router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen>
      {error && <Notice tone="error" text={error} />}
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      <Button title="Sign in" onPress={submit} loading={busy} />
      {providers.data?.google && <Button title="Continue with Google" variant="secondary" onPress={google} />}
      <Button title="Forgot password?" variant="ghost" onPress={() => router.push('/forgot')} />
      <Button title="Create an account" variant="ghost" onPress={() => router.replace('/register')} />
    </Screen>
  );
}
