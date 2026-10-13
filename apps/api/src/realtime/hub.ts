import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { z } from 'zod';
import type { ClientMessage, ServerMessage } from '@fluentpath/shared';
import { allowedOrigins, resolveSessionToken, tokenFromRequest, type AuthUser } from '../plugins/auth';

export interface Conn {
  id: number;
  socket: WebSocket;
  user: AuthUser;
  alive: boolean;
}

type Handler = (conn: Conn, msg: ClientMessage) => void | Promise<void>;
type CloseHandler = (conn: Conn) => void | Promise<void>;

const conns = new Map<string, Set<Conn>>();
const handlers = new Map<string, Handler>();
const closeHandlers: CloseHandler[] = [];
let nextId = 1;

export function send(conn: Conn, msg: ServerMessage) {
  if (conn.socket.readyState === conn.socket.OPEN) conn.socket.send(JSON.stringify(msg));
}

export function sendToUser(userId: string, msg: ServerMessage) {
  for (const c of conns.get(userId) ?? []) send(c, msg);
}

export function isOnline(userId: string) {
  return (conns.get(userId)?.size ?? 0) > 0;
}

/** Register a handler for message types starting with a prefix, e.g. "call." */
export function on(prefix: string, handler: Handler) {
  handlers.set(prefix, handler);
}

export function onClose(handler: CloseHandler) {
  closeHandlers.push(handler);
}

const messageSchema = z.object({ type: z.string().min(1).max(40) }).passthrough();

function attach(socket: WebSocket, user: AuthUser) {
  const conn: Conn = { id: nextId++, socket, user, alive: true };
  if (!conns.has(user.id)) conns.set(user.id, new Set());
  conns.get(user.id)!.add(conn);
  socket.on('pong', () => (conn.alive = true));
  socket.on('message', async (raw) => {
    let msg: ClientMessage;
    try {
      const parsed = messageSchema.safeParse(JSON.parse(String(raw)));
      if (!parsed.success) throw new Error('bad');
      msg = parsed.data as unknown as ClientMessage;
    } catch {
      return send(conn, { type: 'error', code: 'bad_message', message: 'Invalid message.' });
    }
    if (msg.type === 'ping') return send(conn, { type: 'pong' });
    const prefix = msg.type.split('.')[0] + '.';
    const h = handlers.get(prefix);
    if (!h) return send(conn, { type: 'error', code: 'unknown_type', message: `Unknown message type ${msg.type}` });
    try {
      await h(conn, msg);
    } catch (err) {
      send(conn, { type: 'error', code: 'server_error', message: (err as Error).message || 'Something went wrong.' });
    }
  });
  socket.on('close', async () => {
    conns.get(user.id)?.delete(conn);
    if (conns.get(user.id)?.size === 0) conns.delete(user.id);
    for (const h of closeHandlers) {
      try {
        await h(conn);
      } catch {
        /* ignore */
      }
    }
  });
  send(conn, { type: 'ready', userId: user.id });
  return conn;
}

export async function realtimeRoutes(app: FastifyInstance) {
  // Heartbeat: terminate sockets that stop answering pings (e.g. phone lost network).
  const beat = setInterval(() => {
    for (const set of conns.values())
      for (const c of set) {
        if (!c.alive) {
          c.socket.terminate();
          continue;
        }
        c.alive = false;
        try {
          c.socket.ping();
        } catch {
          /* ignore */
        }
      }
  }, 25_000);
  app.addHook('onClose', async () => clearInterval(beat));

  app.get('/ws', { websocket: true }, (socket: WebSocket, req: FastifyRequest) => {
    const t = tokenFromRequest(req);
    // Cross-site WebSocket hijacking protection for cookie-based sessions.
    const origin = req.headers.origin as string | undefined;
    if (t?.via === 'cookie' && origin && !allowedOrigins().has(origin) && new URL(origin).host !== req.headers.host) {
      socket.close(4403, 'origin not allowed');
      return;
    }
    if (req.auth) {
      attach(socket, req.auth);
      return;
    }
    // Clients that cannot send cookies/headers authenticate with their first message.
    const timer = setTimeout(() => socket.close(4401, 'authentication required'), 10_000);
    socket.once('message', async (raw) => {
      clearTimeout(timer);
      try {
        const msg = JSON.parse(String(raw)) as { type?: string; token?: string };
        if (msg.type !== 'auth' || typeof msg.token !== 'string') throw new Error('no auth');
        const user = await resolveSessionToken(msg.token);
        if (!user) throw new Error('bad token');
        attach(socket, user);
      } catch {
        socket.close(4401, 'authentication failed');
      }
    });
  });
}
