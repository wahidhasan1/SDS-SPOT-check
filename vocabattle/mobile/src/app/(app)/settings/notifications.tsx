import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { Banner, Button, Card, Chip, Row, Screen, SectionHeader, Text, ToggleRow } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { notificationPermission, syncDailyReminder } from '@/lib/notifications';
import type { NotificationPrefs } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

const TIMES = ['07:00', '08:00', '12:30', '18:00', '19:00', '20:00', '21:00', '22:00'];

/** Notification preferences. Daily reminders are scheduled locally on the device. */
export default function NotificationSettings() {
  const { profile, refreshProfile } = useAuth();
  const [permission, setPermission] = useState<string>('undetermined');
  const prefs = profile!.notification_prefs;
  const update = useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) => api.updateProfile(profile!.id, { notification_prefs: { ...prefs, ...patch } }),
    onSuccess: async (p) => { await refreshProfile(); await syncDailyReminder(p.notification_prefs); },
  });

  useEffect(() => { notificationPermission(false).then(setPermission).catch(() => {}); }, []);

  return (
    <Screen title="Notifications" back>
      {Platform.OS === 'web' ? <Banner tone="info" message="Reminders are delivered on the iOS and Android apps." /> : permission !== 'granted' ? (
        <Banner tone="warning" title="Notifications are off" message="Allow notifications so reminders can reach you.">
          <Button title="Allow notifications" size="sm" variant="secondary" style={{ alignSelf: 'flex-start' }}
            onPress={async () => { const p = await notificationPermission(true); setPermission(p); await syncDailyReminder(prefs); }} />
        </Banner>
      ) : null}
      {update.error ? <Banner tone="danger" message={errorMessage(update.error)} /> : null}
      <Card>
        <ToggleRow title="Daily learning reminder" value={prefs.daily_reminder} onChange={(v) => update.mutate({ daily_reminder: v })} />
        {prefs.daily_reminder ? (
          <>
            <Text variant="small" color="textMuted">Reminder time</Text>
            <Row wrap>{TIMES.map((t) => <Chip key={t} label={t} selected={prefs.reminder_time === t} onPress={() => update.mutate({ reminder_time: t })} />)}</Row>
          </>
        ) : null}
        <ToggleRow title="Vocabulary review reminders" value={prefs.review_reminders} onChange={(v) => update.mutate({ review_reminders: v })} />
        <ToggleRow title="Streak reminders" value={prefs.streak_reminders} onChange={(v) => update.mutate({ streak_reminders: v })} />
        <ToggleRow title="Battle events" value={prefs.battle_events} onChange={(v) => update.mutate({ battle_events: v })} />
        <ToggleRow title="Achievements" value={prefs.achievements} onChange={(v) => update.mutate({ achievements: v })} />
        <ToggleRow title="Product updates" subtitle="Rare. Off by default." value={prefs.product_updates} onChange={(v) => update.mutate({ product_updates: v })} />
      </Card>
      <SectionHeader title="How we notify" />
      <Text variant="small" color="textMuted">At most one learning reminder per day. Achievements and assessment results also appear in your in-app inbox. Server push for battle and review events requires push credentials (see setup docs).</Text>
    </Screen>
  );
}
