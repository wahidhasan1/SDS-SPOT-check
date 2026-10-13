import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { registerSchema } from '@app/shared';
import { useAuth } from '../src/lib/auth';
import { errorMessage } from '../src/lib/api';
import { useTheme } from '../src/lib/theme';
import { Button, ErrorText, H1, Input, P, Screen } from '../src/components/ui';

export default function Register() {
  const t = useTheme();
  const { register } = useAuth();
  const [f, setF] = useState({ displayName: '', email: '', password: '', birthYear: '', accept: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(null);
    const parsed = registerSchema.safeParse({ email: f.email.trim(), password: f.password, displayName: f.displayName, birthYear: Number(f.birthYear), acceptTerms: f.accept });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? 'Check the form.');
    setBusy(true);
    try {
      await register(parsed.data as any);
      router.replace('/onboarding');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <H1>Create your account</H1>
      <ErrorText error={err} />
      <Input label="Your name (private)" value={f.displayName} onChangeText={(v) => setF({ ...f, displayName: v })} />
      <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} />
      <Input label="Password (8+ chars, letter and number)" secureTextEntry value={f.password} onChangeText={(v) => setF({ ...f, password: v })} />
      <Input label="Birth year" keyboardType="number-pad" maxLength={4} value={f.birthYear} onChangeText={(v) => setF({ ...f, birthYear: v.replace(/\D/g, '') })} />
      <P small muted>Used only for safety settings. Live calls are for adults (18+).</P>
      <Pressable onPress={() => setF({ ...f, accept: !f.accept })} accessibilityRole="checkbox" accessibilityState={{ checked: f.accept }} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Text style={{ fontSize: 22, color: t.primary }}>{f.accept ? '☑' : '☐'}</Text>
        <Text style={{ color: t.text, flex: 1 }}>I agree to the community guidelines and understand calls are not recorded.</Text>
      </Pressable>
      <Button title="Create account" onPress={submit} loading={busy} />
    </Screen>
  );
}
