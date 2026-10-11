// Web build: device notifications are not supported, so these are no-ops and
// expo-notifications is not imported at all.
import type { NotificationPrefs } from './types';

export async function notificationPermission(_request: boolean): Promise<'unsupported'> {
  return 'unsupported';
}

export async function syncDailyReminder(_prefs: NotificationPrefs | undefined): Promise<void> {}
