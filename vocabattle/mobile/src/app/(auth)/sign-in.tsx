import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SocialButtons } from '@/components/auth/social-buttons';
import { Banner, Button, Screen, Text, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/auth-provider';

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      const msg = errorMessage(e);
      if (/confirm/i.test(msg)) {
        router.push({ pathname: '/(auth)/verify-email', params: { email: email.trim() } });
      } else {
        setError(/invalid login/i.test(msg) ? 'That email and password do not match an account.' : msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Welcome back" subtitle="Sign in to continue your progress." back>
      {error ? <Banner tone="danger" message={error} /> : null}
      <View style={{ gap: Spacing.md }}>
        <TextField testID="signin-email" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <TextField testID="signin-password" label="Password" value={password} onChangeText={setPassword} secure autoComplete="current-password" onSubmitEditing={submit} />
      </View>
      <Button testID="signin-submit" title="Sign in" size="lg" loading={busy} onPress={submit} />
      <Link href="/(auth)/forgot-password" style={{ alignSelf: 'center' }}>
        <Text color="primary" variant="bodyStrong">Forgot your password?</Text>
      </Link>
      <SocialButtons onError={setError} />
      <Text align="center" color="textMuted">
        New here? <Link href="/(auth)/sign-up" replace><Text color="primary" variant="bodyStrong">Create an account</Text></Link>
      </Text>
    </Screen>
  );
}
