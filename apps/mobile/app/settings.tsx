import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Button, Card, H2, Input, Notice, P, Row, Screen } from '../src/components/ui';
import { api, errorMessage } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { useTheme } from '../src/lib/theme';
import { useApi } from '../src/lib/useApi';

export default function Settings() {
  const { me, refresh, logout } = useAuth();
  const t = useTheme();
  const blocks = useApi<{ blocks: { id: string; alias: string; createdAt: string }[] }>('/api/blocks');
  const [err, setErr] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  const set = async (patch: Record<string, unknown>) => {
    setErr(null);
    try {
      await api.patch('/api/settings', patch);
      await refresh();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const toggle = (label: string, key: keyof typeof me.settings, hint?: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}><Text style={{ color: t.text, fontWeight: '600' }}>{label}</Text>{hint && <P muted style={{ fontSize: 13 }}>{hint}</P>}</View>
      <Switch accessibilityLabel={label} value={Boolean(me.settings[key])} onValueChange={(v) => set({ [key]: v })} />
    </View>
  );
  const del = async () => {
    setBusy(true);
    try {
      await api.del('/api/account', { password: me.hasPassword ? pw : undefined, confirm });
      Alert.alert('Account deleted', 'Your account and personal data have been deleted.');
      await logout();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Settings & privacy' }} />
      {err && <Notice tone="error" text={err} />}
      <Card>
        <H2>Study</H2>
        <Text style={{ color: t.text }}>Daily goal: {me.settings.dailyGoalMinutes} minutes</Text>
        <Row>{[10, 15, 20, 30, 45, 60].map((m) => <Button key={m} small variant={me.settings.dailyGoalMinutes === m ? 'primary' : 'secondary'} title={`${m}`} onPress={() => set({ dailyGoalMinutes: m })} />)}</Row>
      </Card>
      <Card>
        <H2>Notifications</H2>
        {toggle('Email notifications', 'notifyEmail', 'Only sent if the server has email configured.')}
        {toggle('Streak reminders', 'notifyStreak')}
        {toggle('Feedback ready', 'notifyFeedback')}
      </Card>
      <Card>
        <H2>Voice calls & privacy</H2>
        {toggle('Allow voice calls', 'allowCalls')}
        {toggle('Show my level to partners', 'showLevelInCalls', 'Partners only ever see a random name.')}
      </Card>
      <Card>
        <H2>Blocked users</H2>
        {blocks.data?.blocks.length === 0 && <P muted>You have not blocked anyone.</P>}
        {blocks.data?.blocks.map((b) => (
          <Row key={b.id}><Text style={{ color: t.text, flex: 1 }}>{b.alias}</Text><Button small variant="secondary" title="Unblock" onPress={async () => { await api.del(`/api/blocks/${b.id}`).catch((e) => setErr(errorMessage(e))); blocks.reload(); }} /></Row>
        ))}
      </Card>
      <Card>
        <H2>Delete account</H2>
        <P muted>This permanently deletes your account, progress, recordings and scanned pages. It cannot be undone.</P>
        {me.hasPassword && <Input label="Password" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" />}
        <Input label='Type "DELETE" to confirm' value={confirm} onChangeText={setConfirm} autoCapitalize="characters" />
        <Button variant="danger" title="Delete my account" loading={busy} disabled={confirm !== 'DELETE' || (me.hasPassword && !pw)} onPress={() => Alert.alert('Delete account permanently?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: del }])} />
      </Card>
    </Screen>
  );
}
