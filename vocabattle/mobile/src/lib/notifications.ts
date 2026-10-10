import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationPrefs } from './types';

const DAILY_ID = 'vocabattle-daily-reminder';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export async function notificationPermission(request: boolean): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  if (Platform.OS === 'web') return 'unsupported';
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !request) return current.granted ? 'granted' : current.canAskAgain ? 'undetermined' : 'denied';
  const next = await Notifications.requestPermissionsAsync();
  return next.granted ? 'granted' : 'denied';
}

/**
 * Keeps the local daily reminder in sync with the user's preferences.
 * Local scheduling needs no push server; server-sent push (battle events,
 * achievements) is configured separately — see docs/SETUP.md.
 */
export async function syncDailyReminder(prefs: NotificationPrefs | undefined) {
  if (Platform.OS === 'web' || !prefs) return;
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});
  if (!prefs.daily_reminder) return;
  if ((await notificationPermission(false)) !== 'granted') return;
  const [h, m] = (prefs.reminder_time || '19:00').split(':').map((x) => parseInt(x, 10));
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', { name: 'Learning reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content: { title: 'Time for English 🦉', body: 'A few minutes today keeps your streak alive.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h || 19, minute: m || 0, channelId: 'reminders' },
  });
}
