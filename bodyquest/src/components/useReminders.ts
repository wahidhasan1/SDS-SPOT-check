import { useEffect, useRef } from 'react';
import { useApp } from '../store/AppStore';
import { dayTotal } from '../services/hydration';
import { hydrationTargetFor } from '../store/selectors';

/**
 * Optional hydration reminders. These only work while BODYQUEST is open in a browser tab —
 * there is no push-notification server in this local build. Reminders use the browser
 * Notification API when permission is granted, otherwise an in-app toast. They stop once
 * the day's target (or a medical limit) is reached and are quiet between 22:00 and 07:00.
 */
export function useHydrationReminders() {
  const { data, today, pushToast, now } = useApp();
  const last = useRef<number>(Date.now());
  const s = data.hydrationSettings;
  useEffect(() => {
    if (!s.remindersEnabled) return;
    const t = window.setInterval(() => {
      const h = new Date(now()).getHours();
      if (h < 7 || h >= 22) return;
      if (Date.now() - last.current < s.reminderIntervalMin * 60_000) return;
      last.current = Date.now();
      const target = hydrationTargetFor(data, today);
      if (target && dayTotal(data.hydration, today) >= target.ml) return;
      const msg = 'Time for a glass of water? Sip regularly through the day.';
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        new Notification('BODYQUEST hydration reminder', { body: msg });
      } else {
        pushToast('info', `💧 ${msg}`);
      }
    }, 30_000);
    return () => window.clearInterval(t);
  }, [s.remindersEnabled, s.reminderIntervalMin, data, today, pushToast, now]);
}
