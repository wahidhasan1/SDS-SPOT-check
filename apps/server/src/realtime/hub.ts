import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type pg from 'pg';
import type { ServerMessage } from '@app/shared';
import { pool } from '../db/pool';

/**
 * Connection registry + message delivery. A user may hold several sockets (web tab + phone).
 * When a user is connected to another server instance, messages are relayed through
 * Postgres LISTEN/NOTIFY so horizontal scaling works without extra infrastructure.
 */
export interface Conn {
  id: string;
  ws: WebSocket;
  userId: string | null;
  platform: string;
  tokens: number;
  lastRefill: number;
}

const INSTANCE_ID = randomUUID();
const byUser = new Map<string, Set<Conn>>();
let listener: pg.PoolClient | null = null;

export function registerConn(c: Conn) {
  if (!c.userId) return;
  let set = byUser.get(c.userId);
  if (!set) byUser.set(c.userId, (set = new Set()));
  set.add(c);
}

export function unregisterConn(c: Conn): boolean {
  if (!c.userId) return false;
  const set = byUser.get(c.userId);
  if (!set) return false;
  set.delete(c);
  if (set.size === 0) {
    byUser.delete(c.userId);
    return true; // user has no more local sockets
  }
  return false;
}

export function isUserConnectedLocally(userId: string): boolean {
  return (byUser.get(userId)?.size ?? 0) > 0;
}

export function sendTo(c: Conn, msg: ServerMessage) {
  if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg));
}

function deliverLocal(userId: string, msg: ServerMessage): boolean {
  const set = byUser.get(userId);
  if (!set || set.size === 0) return false;
  const data = JSON.stringify(msg);
  for (const c of set) if (c.ws.readyState === 1) c.ws.send(data);
  return true;
}

export function deliverToUser(userId: string, msg: ServerMessage) {
  if (deliverLocal(userId, msg)) return;
  if (!listener) return;
  const payload = JSON.stringify({ from: INSTANCE_ID, userId, msg });
  if (payload.length > 7900) return; // NOTIFY payload limit; SDP for audio-only calls fits comfortably
  pool.query('SELECT pg_notify($1, $2)', ['rt_events', payload]).catch(() => undefined);
}

export async function startPubSub() {
  if (process.env.REALTIME_PUBSUB === 'off') return;
  listener = await pool.connect();
  await listener.query('LISTEN rt_events');
  listener.on('notification', (n) => {
    try {
      const { from, userId, msg } = JSON.parse(n.payload ?? '{}');
      if (from !== INSTANCE_ID) deliverLocal(userId, msg);
    } catch {
      /* ignore */
    }
  });
}

export async function stopPubSub() {
  if (listener) {
    await listener.query('UNLISTEN *').catch(() => undefined);
    listener.release();
    listener = null;
  }
}

/** Simple token bucket per socket: 30 messages burst, 15/s sustained (ICE candidates arrive in bursts). */
export function allowMessage(c: Conn): boolean {
  const now = Date.now();
  const elapsed = (now - c.lastRefill) / 1000;
  c.tokens = Math.min(60, c.tokens + elapsed * 15);
  c.lastRefill = now;
  if (c.tokens < 1) return false;
  c.tokens -= 1;
  return true;
}

export function allConnectedUserIds(): string[] {
  return [...byUser.keys()];
}
