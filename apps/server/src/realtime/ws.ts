import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { matchJoinSchema, type ClientMessage } from '@app/shared';
import { verifyAccessToken } from '../lib/crypto';
import { HttpError } from '../lib/errors';
import { allowMessage, registerConn, sendTo, unregisterConn, type Conn } from './hub';
import {
  joinQueue,
  leaveQueue,
  mediaState,
  onUserConnected,
  onUserDisconnected,
  relayIeltsStep,
  relaySignal,
  setMuted,
  userEndsCall,
} from './calls';
import {
  cancelBattleQueue,
  joinBattle,
  leaveBattle,
  onBattleUserConnected,
  onBattleUserDisconnected,
  submitBattleAnswer,
} from './battles';
import { one } from '../db/pool';

const UUID = /^[0-9a-f-]{36}$/i;

export async function wsRoutes(app: FastifyInstance) {
  app.get('/ws', { websocket: true }, (socket, req) => {
    const conn: Conn = {
      id: randomUUID(),
      ws: socket as any,
      userId: null,
      platform: String(req.headers['x-client-platform'] ?? 'web').slice(0, 10),
      tokens: 30,
      lastRefill: Date.now(),
    };
    const authTimer = setTimeout(() => {
      if (!conn.userId) socket.close(4001, 'auth timeout');
    }, 10_000);

    socket.on('message', async (raw: Buffer) => {
      if (raw.length > 32_000) return socket.close(1009, 'message too large');
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!allowMessage(conn)) {
        sendTo(conn, { t: 'error', code: 'rate_limited', message: 'Too many messages.' });
        return;
      }
      try {
        if (!conn.userId) {
          if (msg.t !== 'auth') return;
          const claims = await verifyAccessToken(String(msg.token ?? ''));
          if (!claims) {
            sendTo(conn, { t: 'auth.error', message: 'Session expired. Please sign in again.' });
            return socket.close(4001, 'unauthorized');
          }
          const exists = await one('SELECT 1 FROM users WHERE id=$1', [claims.userId]);
          if (!exists) return socket.close(4001, 'unauthorized');
          conn.userId = claims.userId;
          clearTimeout(authTimer);
          registerConn(conn);
          sendTo(conn, { t: 'auth.ok', userId: conn.userId });
          onBattleUserConnected(conn.userId);
          await onUserConnected(conn.userId);
          return;
        }
        const userId = conn.userId;
        switch (msg.t) {
          case 'ping':
            sendTo(conn, { t: 'pong' });
            break;
          case 'match.join': {
            const parsed = matchJoinSchema.safeParse(msg);
            if (!parsed.success) throw new HttpError(400, 'bad_request', 'Invalid matching request.');
            await joinQueue(userId, parsed.data);
            break;
          }
          case 'match.cancel':
            await leaveQueue(userId);
            break;
          case 'call.signal':
            if (UUID.test(msg.callId)) await relaySignal(userId, msg.callId, msg.data);
            break;
          case 'call.media':
            if (UUID.test(msg.callId) && ['connected', 'disconnected', 'failed'].includes(msg.state)) await mediaState(userId, msg.callId, msg.state);
            break;
          case 'call.mute':
            if (UUID.test(msg.callId)) await setMuted(userId, msg.callId, !!msg.muted);
            break;
          case 'call.end':
            if (UUID.test(msg.callId)) await userEndsCall(userId, msg.callId, String(msg.reason ?? 'hangup'));
            break;
          case 'call.ielts':
            if (UUID.test(msg.callId)) await relayIeltsStep(userId, msg.callId, msg.step);
            break;
          case 'battle.join':
            await joinBattle(userId, msg.battleType, !!msg.ranked);
            break;
          case 'battle.cancel':
            cancelBattleQueue(userId);
            break;
          case 'battle.answer':
            if (UUID.test(msg.battleId)) await submitBattleAnswer(userId, msg.battleId, Number(msg.index), String(msg.answer ?? ''));
            break;
          case 'battle.leave':
            if (UUID.test(msg.battleId)) await leaveBattle(userId, msg.battleId);
            break;
        }
      } catch (e) {
        const err = e as HttpError;
        if (err instanceof HttpError) {
          sendTo(conn, { t: 'error', code: err.code, message: err.message });
          if (msg.t === 'match.join') sendTo(conn, { t: 'match.status', status: 'idle', message: err.message });
          if (msg.t === 'battle.join') sendTo(conn, { t: 'battle.status', status: 'cancelled', message: err.message });
        } else {
          req.log.error(e);
          sendTo(conn, { t: 'error', code: 'server_error', message: 'Something went wrong. Please try again.' });
        }
      }
    });

    socket.on('close', async () => {
      clearTimeout(authTimer);
      if (conn.userId && unregisterConn(conn)) {
        onBattleUserDisconnected(conn.userId);
        await onUserDisconnected(conn.userId).catch((e) => req.log.error(e));
      }
    });
  });
}
