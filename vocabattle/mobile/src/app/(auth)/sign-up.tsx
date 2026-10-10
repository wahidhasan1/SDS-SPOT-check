import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SocialButtons } from '@/components/auth/social-buttons';
import { Banner, Button, Screen, Text, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import { passwordProblem, validEmail } from '@/lib/validation';
import { useAuth } from '@/providers/auth-provider';

export default function SignUp() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Tell us what to call you.';
    if (!validEmail(email)) next.email = 'Enter a valid email address.';
    const pw = passwordProblem(password);
    if (pw) next.password = pw;
    if (confirm !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const { needsVerification } = await signUp(email, password, name);
      if (needsVerification) router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim() } });
      // Otherwise the session switches the navigator to onboarding automatically.
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Create your account" subtitle="Free forever — upgrade any time." back>
      {formError ? <Banner tone="danger" message={formError} /> : null}
      <View style={{ gap: Spacing.md }}>
        <TextField testID="signup-name" label="Display name" value={name} onChangeText={setName} autoComplete="name" error={errors.name} maxLength={40} />
        <TextField testID="signup-email" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
        <TextField testID="signup-password" label="Password" value={password} onChangeText={setPassword} secure autoComplete="new-password" error={errors.password} hint="At least 8 characters with a number." />
        <TextField testID="signup-confirm" label="Confirm password" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" error={errors.confirm} onSubmitEditing={submit} />
      </View>
      <Button testID="signup-submit" title="Create account" size="lg" loading={busy} onPress={submit} />
      <SocialButtons onError={setFormError} />
      <Text variant="small" color="textMuted" align="center">
        By creating an account you agree to the Terms of Service and Privacy Policy.
      </Text>
      <Text align="center" color="textMuted">
        Already registered? <Link href="/(auth)/sign-in" replace><Text color="primary" variant="bodyStrong">Sign in</Text></Link>
      </Text>
    </Screen>
  );
}
