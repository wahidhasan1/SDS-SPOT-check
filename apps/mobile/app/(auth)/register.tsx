import { useState } from 'react';
import { router } from 'expo-router';
import { Button, Input, Notice, Screen } from '../../src/components/ui';
import { errorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';

export default function Register() {
  const { register } = useAuth();
  const [f, setF] = useState({ displayName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (f.displayName.trim().length < 2) return setError('Display name must be at least 2 characters.');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setError('Enter a valid email address.');
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) return setError('Password needs at least 8 characters with a letter and a number.');
    if (f.password !== f.confirm) return setError('Passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      await register({ displayName: f.displayName.trim(), email: f.email.trim(), password: f.password });
      router.replace('/onboarding');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      {error && <Notice tone="error" text={error} />}
      <Input label="Display name" value={f.displayName} onChangeText={(v) => setF({ ...f, displayName: v })} maxLength={40} />
      <Input label="Email" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} autoCapitalize="none" keyboardType="email-address" />
      <Input label="Password" value={f.password} onChangeText={(v) => setF({ ...f, password: v })} secureTextEntry />
      <Input label="Confirm password" value={f.confirm} onChangeText={(v) => setF({ ...f, confirm: v })} secureTextEntry />
      <Notice text="Voice partners only ever see a random anonymous name. By continuing you agree to behave respectfully in calls." />
      <Button title="Create account" onPress={submit} loading={busy} />
    </Screen>
  );
}
