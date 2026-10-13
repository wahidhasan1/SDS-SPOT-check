import type { FastifyInstance } from 'fastify';
import { blockSchema, callFeedbackSchema, CONVERSATION_TOPICS, reportSchema } from '@app/shared';
import { one, q } from '../db/pool';
import { requireAuth } from '../lib/auth';
import { badRequest, conflict, notFound } from '../lib/errors';
import { parse } from '../lib/validate';
import { callHistory, endCall, queueSnapshot } from '../realtime/calls';
import { FREE_TOPIC_IDS } from '../services/entitlements';

/** Resolves the other person in a call or battle the requester actually took part in. */
async function counterpart(userId: string, callId?: string, battleId?: string): Promise<string> {
  if (callId) {
    const r = await one<{ user_id: string }>(
      `SELECT other.user_id FROM call_participants me JOIN call_participants other
         ON other.call_id=me.call_id AND other.role<>me.role WHERE me.call_id=$1 AND me.user_id=$2`,
      [callId, userId],
    );
    if (!r?.user_id) throw notFound('Call not found.');
    return r.user_id;
  }
  if (battleId) {
    const r = await one<{ user_id: string }>(
      `SELECT other.user_id FROM battle_participants me JOIN battle_participants other
         ON other.battle_id=me.battle_id AND other.seat<>me.seat WHERE me.battle_id=$1 AND me.user_id=$2`,
      [battleId, userId],
    );
    if (!r?.user_id) throw notFound('Battle not found.');
    return r.user_id;
  }
  throw badRequest('Specify the call or battle.');
}

export async function blockUser(blocker: string, blocked: string, callId?: string) {
  await q(
    `INSERT INTO user_blocks (blocker_id, blocked_id, call_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [blocker, blocked, callId ?? null],
  );
  // If they are currently in a call together, end it immediately.
  const shared = await one<{ call_id: string }>(
    `SELECT a.call_id FROM user_active_calls a JOIN user_active_calls b ON a.call_id=b.call_id WHERE a.user_id=$1 AND b.user_id=$2`,
    [blocker, blocked],
  );
  if (shared) await endCall(shared.call_id, 'blocked', blocker);
}

export async function callRoutes(app: FastifyInstance) {
  app.get('/calls/topics', async () =>
    CONVERSATION_TOPICS.map((t) => ({ id: t.id, label: t.label, mode: t.mode, premium: !FREE_TOPIC_IDS.has(t.id) })),
  );

  app.register(async (r) => {
    r.addHook('preHandler', requireAuth);

    r.get('/calls/history', async (req) => callHistory(req.userId));

    r.get('/calls/queue', async () => ({ waiting: await queueSnapshot() }));

    r.post('/calls/:id/feedback', async (req) => {
      const { id } = req.params as { id: string };
      const input = parse(callFeedbackSchema, req.body);
      const updated = await q(
        `UPDATE call_participants p SET feedback_rating=$3, feedback_comment=$4
         FROM call_sessions s WHERE s.id=p.call_id AND p.call_id=$1 AND p.user_id=$2 AND s.status='ended' AND s.connected_at IS NOT NULL
         RETURNING p.call_id`,
        [id, req.userId, input.rating, input.comment ?? null],
      );
      if (!updated.length) throw notFound('Feedback can be left only for completed calls you took part in.');
      return { ok: true };
    });

    r.post('/safety/report', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req) => {
      const input = parse(reportSchema, req.body);
      const reported = await counterpart(req.userId, input.callId, input.battleId);
      try {
        await q(
          `INSERT INTO user_reports (reporter_id, reported_id, call_id, battle_id, reason, details) VALUES ($1,$2,$3,$4,$5,$6)`,
          [req.userId, reported, input.callId ?? null, input.battleId ?? null, input.reason, input.details ?? null],
        );
      } catch (e: any) {
        if (e.code === '23505') throw conflict('You have already reported this call.');
        throw e;
      }
      if (input.alsoBlock) await blockUser(req.userId, reported, input.callId);
      await autoModerate(reported);
      return { ok: true, blocked: !!input.alsoBlock };
    });

    r.post('/safety/block', async (req) => {
      const input = parse(blockSchema, req.body);
      const other = await counterpart(req.userId, input.callId, input.battleId);
      await blockUser(req.userId, other, input.callId);
      return { ok: true };
    });

    r.get('/safety/blocks', async (req) => {
      // Blocked users are listed by the anonymous identity seen at the time; no private details.
      const rows = await q(
        `SELECT b.blocked_id AS id, b.created_at,
           COALESCE((SELECT p.anon_name FROM call_participants p WHERE p.call_id=b.call_id AND p.user_id=b.blocked_id LIMIT 1), u.anon_name) AS anon_name
         FROM user_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=$1 ORDER BY b.created_at DESC`,
        [req.userId],
      );
      return rows;
    });

    r.delete('/safety/blocks/:id', async (req) => {
      const { id } = req.params as { id: string };
      await q('DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2', [req.userId, id]);
      return { ok: true };
    });
  });
}

/**
 * Protection against repeated abuse: 3+ distinct reporters within 7 days pauses
 * the account's live calls for 24h pending moderator review.
 */
async function autoModerate(userId: string) {
  const r = await one<{ n: number }>(
    `SELECT count(DISTINCT reporter_id)::int AS n FROM user_reports
     WHERE reported_id=$1 AND status='open' AND created_at > now() - interval '7 days'`,
    [userId],
  );
  if ((r?.n ?? 0) >= 3) {
    const upd = await q(
      `UPDATE users SET suspended_until = GREATEST(COALESCE(suspended_until, now()), now() + interval '24 hours'),
         suspension_reason='Automatic pause after multiple reports (pending review)'
       WHERE id=$1 AND (suspended_until IS NULL OR suspended_until < now() + interval '1 hour') RETURNING id`,
      [userId],
    );
    if (upd.length) {
      await q(`INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES (NULL,'auto_suspend','user',$1,$2)`, [
        userId,
        { reporters: r!.n },
      ]);
      const active = await one<{ call_id: string }>('SELECT call_id FROM user_active_calls WHERE user_id=$1', [userId]);
      if (active) await endCall(active.call_id, 'moderation', null);
    }
  }
}
