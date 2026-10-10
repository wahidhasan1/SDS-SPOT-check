import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { syncDailyReminder } from '@/lib/notifications';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/providers/theme-provider';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  useEffect(() => { syncDailyReminder(profile?.notification_prefs).catch(() => {}); }, [profile?.notification_prefs]);
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
