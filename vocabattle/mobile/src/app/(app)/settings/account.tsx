import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { Banner, Button, Card, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { passwordProblem } from '@/lib/validation';
import { useAuth } from '@/providers/auth-provider';

/** Account security: password change, sign out and permanent deletion. */
export default function Account() {
  const { session, updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const change = useMutation({ mutationFn: async () => { const p = passwordProblem(password); if (p) throw new Error(p); await updatePassword(password); } });
  const del = useMutation({ mutationFn: async () => { await api.deleteMyAccount(); await signOut(); } });

  return (
    <Screen title="Account security" back>
      <Card>
        <Text variant="tiny" color="textMuted">SIGNED IN AS</Text>
        <Text variant="bodyStrong">{session?.user.email}</Text>
        <Text variant="small" color="textMuted">Only you can see this.</Text>
      </Card>

      <SectionHeader title="Change password" />
      {change.isSuccess ? <Banner tone="success" message="Password updated." /> : null}
      {change.error ? <Banner tone="danger" message={errorMessage(change.error)} /> : null}
      <TextField label="New password" value={password} onChangeText={setPassword} secure autoComplete="new-password" hint="At least 8 characters with a number." />
      <Button title="Update password" variant="secondary" loading={change.isPending} onPress={() => change.mutate()} />

      <SectionHeader title="Sign out" />
      <Button title="Sign out of this device" variant="secondary" icon="log-out" onPress={() => signOut()} />

      <SectionHeader title="Delete account" />
      <Card tone="danger">
        <Text variant="bodyStrong" color="danger">This permanently deletes your account</Text>
        <Text variant="small">Your profile, assessments, saved words, progress, ratings and subscription link are removed. Opponents keep an anonymous record of past matches. Active app-store subscriptions must be cancelled in the store.</Text>
        <TextField testID="delete-confirm" label='Type DELETE to confirm' value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" />
        {del.error ? <Text variant="small" color="danger">{errorMessage(del.error)}</Text> : null}
        <Button testID="delete-account" title="Delete my account" variant="danger" icon="trash" disabled={confirmText !== 'DELETE'} loading={del.isPending} onPress={() => del.mutate()} />
      </Card>
    </Screen>
  );
}
