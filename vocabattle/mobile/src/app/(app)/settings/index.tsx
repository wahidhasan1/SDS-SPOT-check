import Constants from 'expo-constants';
import { router } from 'expo-router';

import { Card, ListRow, Screen, SectionHeader, Segmented, Text } from '@/components/ui';
import { ACCENT_KEY, useLocalPref } from '@/lib/preferences';
import { useAuth } from '@/providers/auth-provider';
import { type ThemePreference, useTheme } from '@/providers/theme-provider';

/** Application settings. */
export default function Settings() {
  const { preference, setPreference } = useTheme();
  const { profile, signOut } = useAuth();
  const [accent, setAccent] = useLocalPref<'en-GB' | 'en-US' | 'en-AU'>(ACCENT_KEY, 'en-GB');

  return (
    <Screen title="Settings" back>
      <SectionHeader title="Appearance" />
      <Segmented<ThemePreference> value={preference} onChange={setPreference} options={[
        { value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
      ]} />
      <SectionHeader title="Audio" />
      <Text variant="small" color="textMuted">Pronunciation accent (uses your device’s voices)</Text>
      <Segmented value={accent} onChange={setAccent} options={[
        { value: 'en-GB', label: 'British' }, { value: 'en-US', label: 'American' }, { value: 'en-AU', label: 'Australian' },
      ]} />
      <SectionHeader title="Preferences" />
      <Card>
        <ListRow icon="language" title="Interface language" subtitle={profile?.interface_language?.toUpperCase()} onPress={() => router.push('/profile-edit')} />
        <ListRow icon="notifications" title="Notifications" onPress={() => router.push('/settings/notifications')} testID="settings-notifications" />
        <ListRow icon="eye-off" title="Privacy" subtitle="Leaderboards, battle identity, blocked users" onPress={() => router.push('/settings/privacy')} testID="settings-privacy" />
        <ListRow icon="star" title="Subscription" onPress={() => router.push('/subscription')} />
      </Card>
      <SectionHeader title="Account" />
      <Card>
        <ListRow icon="key" title="Account security" subtitle="Password, sign-in and account deletion" onPress={() => router.push('/settings/account')} testID="settings-account" />
        <ListRow icon="help-circle" title="Help & support" onPress={() => router.push('/help')} />
        <ListRow icon="log-out" title="Sign out" danger onPress={() => signOut()} testID="settings-sign-out" />
      </Card>
      <Text variant="small" color="textFaint" align="center">Vocabattle {Constants.expoConfig?.version ?? ''}</Text>
    </Screen>
  );
}
