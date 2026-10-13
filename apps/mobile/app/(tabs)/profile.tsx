import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CEFR_LABELS, TARGET_BANDS } from '@app/shared';
import { api, errorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useApi } from '../../src/lib/hooks';
import { useTheme } from '../../src/lib/theme';
import { Avatar, Badge, Button, Card, Chip, ErrorText, H1, H2, Input, Notice, P, Row, Screen } from '../../src/components/ui';

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Row between>
      <Text style={{ color: t.text, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </Row>
  );
}

export default function Profile() {
  const { user, setUser, logout, entitlements } = useAuth();
  const blocks = useApi<any[]>('/safety/blocks');
  const [err, setErr] = useState<string | null>(null);
  const [del, setDel] = useState({ open: false, password: '', confirm: '' });
  if (!user) return null;
  const patch = async (b: any) => {
    try {
      setUser(await api.patch('/me', b));
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Screen>
      <H1>Profile</H1>
      <Card style={{ alignItems: 'center' }}>
        <Avatar avatar={user.avatar} size={84} />
        <P muted small>Anonymous calling identity</P>
        <H2>{user.anonName}</H2>
        <Button small variant="ghost" title="🔄 New anonymous identity" onPress={async () => setUser(await api.post('/me/anon-identity'))} />
        <Badge label={user.cefrLevel ? `CEFR ${user.cefrLevel} · ${CEFR_LABELS[user.cefrLevel]}` : 'Level not assessed'} tone="primary" />
        <P small muted>🔥 {user.streakDays}-day streak · ⚔️ {user.battleRating} battle rating</P>
        <P small>Plan: {entitlements?.planName ?? '…'}</P>
      </Card>
      <ErrorText error={err} />
      <Card>
        <H2>IELTS</H2>
        <Row wrap>
          <Chip label="Academic" on={user.testType === 'academic'} onPress={() => patch({ testType: 'academic' })} />
          <Chip label="General" on={user.testType === 'general'} onPress={() => patch({ testType: 'general' })} />
          <Chip label="Not taking IELTS" on={user.testType === 'none'} onPress={() => patch({ testType: 'none' })} />
        </Row>
        <P small muted>Target band</P>
        <Row wrap>{TARGET_BANDS.map((b) => <Chip key={b} label={String(b)} on={user.targetBand === b} onPress={() => patch({ targetBand: b })} />)}</Row>
      </Card>
      <Card>
        <H2>Privacy</H2>
        <Toggle label="Show my level to speaking partners" value={user.privacy.showLevelToPartners} onChange={(v) => patch({ privacy: { showLevelToPartners: v } })} />
        <Toggle label="Show me on battle leaderboards" value={user.privacy.showOnLeaderboard} onChange={(v) => patch({ privacy: { showOnLeaderboard: v } })} />
      </Card>
      <Card>
        <H2>Notifications</H2>
        <Toggle label="Daily practice reminder" value={user.notificationPrefs.dailyReminder} onChange={(v) => patch({ notificationPrefs: { dailyReminder: v } })} />
        <Toggle label="Vocabulary review reminders" value={user.notificationPrefs.vocabReview} onChange={(v) => patch({ notificationPrefs: { vocabReview: v } })} />
        <Toggle label="Streak updates" value={user.notificationPrefs.streaks} onChange={(v) => patch({ notificationPrefs: { streaks: v } })} />
        <Button small variant="ghost" title="View notifications" onPress={() => router.push('/notifications')} />
      </Card>
      <Card>
        <H2>Blocked users</H2>
        {!blocks.data?.length ? <P small muted>You haven't blocked anyone.</P> : blocks.data.map((b) => (
          <Row key={b.id} between><P>{b.anon_name}</P><Button small variant="ghost" title="Unblock" onPress={async () => { await api.del(`/safety/blocks/${b.id}`); blocks.reload(); }} /></Row>
        ))}
      </Card>
      <Button title="⭐ Subscription" variant="secondary" onPress={() => router.push('/subscription')} />
      <Button title="📈 Progress" variant="secondary" onPress={() => router.push('/progress')} />
      <Button title="Sign out" variant="secondary" onPress={async () => { await logout(); router.replace('/welcome'); }} />
      {!del.open ? <Button title="Delete account" variant="ghost" onPress={() => setDel({ ...del, open: true })} /> : (
        <Card>
          <Notice tone="warning" text="This permanently deletes your account and all learning data. Cancel any app-store subscription in the store first." />
          <Input label="Password" secureTextEntry value={del.password} onChangeText={(v) => setDel({ ...del, password: v })} />
          <Input label='Type "DELETE"' value={del.confirm} onChangeText={(v) => setDel({ ...del, confirm: v })} />
          <Button variant="danger" title="Permanently delete" disabled={del.confirm !== 'DELETE'} onPress={async () => {
            try {
              await api.post('/auth/delete-account', { password: del.password, confirm: del.confirm });
              await logout();
              router.replace('/welcome');
            } catch (e) {
              setErr(errorMessage(e));
            }
          }} />
        </Card>
      )}
      <View style={{ height: 20 }} />
    </Screen>
  );
}
