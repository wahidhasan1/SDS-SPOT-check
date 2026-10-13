import { config } from '../config';
import { q } from '../db/pool';
import { deliverToUser } from '../realtime/hub';

export interface NewNotification {
  userId: string;
  kind: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  dedupeKey?: string;
  push?: boolean;
}

/** Stores an in-app notification and, when requested, sends a push to registered devices. */
export async function notify(n: NewNotification): Promise<boolean> {
  const rows = await q(
    `INSERT INTO notifications (user_id, kind, title, body, data, dedupe_key) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id`,
    [n.userId, n.kind, n.title, n.body, n.data ?? {}, n.dedupeKey ?? null],
  );
  if (rows.length === 0) return false;
  deliverToUser(n.userId, { t: 'notification', title: n.title, body: n.body, kind: n.kind } as any);
  if (n.push) await sendPush(n.userId, n.title, n.body, n.data ?? {});
  return true;
}

async function sendPush(userId: string, title: string, body: string, data: Record<string, unknown>) {
  const tokens = await q<{ token: string }>(`SELECT token FROM push_tokens WHERE user_id=$1`, [userId]);
  const expoTokens = tokens.map((t) => t.token).filter((t) => t.startsWith('ExponentPushToken['));
  if (expoTokens.length === 0 || config.isTest) return;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (config.expoAccessToken) headers.Authorization = `Bearer ${config.expoAccessToken}`;
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(expoTokens.map((to) => ({ to, title, body, data, sound: 'default' }))),
    });
    const json: any = await res.json().catch(() => null);
    // Remove tokens Expo reports as no longer registered.
    const tickets: any[] = json?.data ?? [];
    for (let i = 0; i < tickets.length; i++) {
      if (tickets[i]?.details?.error === 'DeviceNotRegistered') {
        await q('DELETE FROM push_tokens WHERE token=$1', [expoTokens[i]]);
      }
    }
  } catch (e) {
    console.warn('push send failed', (e as Error).message);
  }
}
