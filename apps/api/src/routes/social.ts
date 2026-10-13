import type { FastifyInstance } from 'fastify';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { REPORT_REASONS } from '@fluentpath/shared';
import { db, schema } from '../db';
import { badRequest, notFound } from '../lib/errors';
import { parse, uuidParam } from '../lib/validate';
import { requireUser } from '../plugins/auth';
import { battleStats } from '../realtime/battles';
import { activeCallOf, callPartner, endCall, queueStats } from '../realtime/calls';
import { iceServersFor } from '../realtime/ice';
import { notify } from '../services/notifications';

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS.map((r) => r.id) as [string, ...string[]]),
  details: z.string().trim().max(1000).default(''),
  block: z.boolean().default(true),
});

async function block(blockerId: string, blockedId: string, alias: string, callSessionId: string | null) {
  if (blockerId === blockedId) throw badRequest('You cannot block yourself.');
  await db.insert(schema.blocks).values({ blockerId, blockedId, alias, callSessionId }).onConflictDoNothing();
}

export async function socialRoutes(app: FastifyInstance) {
  app.get('/api/realtime/status', async (req) => {
    requireUser(req);
    return { calls: queueStats(), battles: battleStats() };
  });

  app.get('/api/calls/ice', async (req) => {
    const u = requireUser(req);
    return { iceServers: iceServersFor(u.id) };
  });

  app.get('/api/calls/history', async (req) => {
    const u = requireUser(req);
    const rows = await db
      .select()
      .from(schema.callSessions)
      .where(or(eq(schema.callSessions.userA, u.id), eq(schema.callSessions.userB, u.id)))
      .orderBy(desc(schema.callSessions.matchedAt))
      .limit(100);
    const blocked = new Set((await db.select({ id: schema.blocks.blockedId }).from(schema.blocks).where(eq(schema.blocks.blockerId, u.id))).map((r) => r.id));
    // Only aliases are returned — never the partner's account id, email or name.
    return {
      activeCallId: activeCallOf(u.id),
      calls: rows.map((c) => {
        const mine = c.userA === u.id;
        return {
          id: c.id,
          myAlias: mine ? c.aliasA : c.aliasB,
          partnerAlias: mine ? c.aliasB : c.aliasA,
          partnerBlocked: blocked.has(mine ? c.userB : c.userA),
          mode: c.mode,
          topic: c.topic,
          status: c.status,
          endReason: c.endReason,
          durationSec: c.durationSec,
          matchedAt: c.matchedAt,
          endedAt: c.endedAt,
        };
      }),
    };
  });

  app.post('/api/calls/:id/block', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const p = await callPartner(id, u.id);
    if (!p) throw notFound('Call not found.');
    await block(u.id, p.partnerId, p.partnerAlias, id);
    if (activeCallOf(u.id) === id) await endCall(id, 'blocked', u.id);
    return { ok: true };
  });

  app.post('/api/calls/:id/report', async (req, reply) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(reportSchema, req.body);
    const p = await callPartner(id, u.id);
    if (!p) throw notFound('Call not found.');
    const [existing] = await db.select({ id: schema.reports.id }).from(schema.reports).where(and(eq(schema.reports.reporterId, u.id), eq(schema.reports.callSessionId, id)));
    if (existing) throw badRequest('You have already reported this call. Our moderators will review it.');
    await db.insert(schema.reports).values({ reporterId: u.id, reportedUserId: p.partnerId, callSessionId: id, reportedAlias: p.partnerAlias, reason: body.reason, details: body.details });
    if (body.block) await block(u.id, p.partnerId, p.partnerAlias, id);
    if (activeCallOf(u.id) === id) await endCall(id, 'reported', u.id);
    await notify(u.id, { type: 'safety', title: 'Report received', body: `Thank you. Moderators will review your report about ${p.partnerAlias}.${body.block ? ' You will not be matched with this person again.' : ''}` });
    reply.code(201);
    return { ok: true };
  });

  app.get('/api/blocks', async (req) => {
    const u = requireUser(req);
    const rows = await db.select({ id: schema.blocks.id, alias: schema.blocks.alias, createdAt: schema.blocks.createdAt }).from(schema.blocks).where(eq(schema.blocks.blockerId, u.id)).orderBy(desc(schema.blocks.createdAt));
    return { blocks: rows };
  });

  app.delete('/api/blocks/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const res = await db.delete(schema.blocks).where(and(eq(schema.blocks.id, id), eq(schema.blocks.blockerId, u.id))).returning({ id: schema.blocks.id });
    if (!res.length) throw notFound('Block not found.');
    return { ok: true };
  });

  app.get('/api/battles/history', async (req) => {
    const u = requireUser(req);
    const rows = await db
      .select()
      .from(schema.battles)
      .where(sql`(user_a = ${u.id} or user_b = ${u.id}) and status <> 'active'`)
      .orderBy(desc(schema.battles.createdAt))
      .limit(50);
    return {
      battles: rows.map((b) => {
        const mine = b.userA === u.id;
        return {
          id: b.id,
          kind: b.kind,
          opponentAlias: mine ? b.aliasB : b.aliasA,
          myScore: mine ? b.scoreA : b.scoreB,
          opponentScore: mine ? b.scoreB : b.scoreA,
          myCorrect: mine ? b.correctA : b.correctB,
          outcome: b.winnerId == null ? 'draw' : b.winnerId === u.id ? 'win' : 'loss',
          endReason: b.endReason,
          createdAt: b.createdAt,
        };
      }),
    };
  });

  app.post('/api/battles/:id/report', async (req, reply) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(reportSchema, req.body);
    const [b] = await db.select().from(schema.battles).where(and(eq(schema.battles.id, id), or(eq(schema.battles.userA, u.id), eq(schema.battles.userB, u.id))));
    if (!b) throw notFound('Battle not found.');
    const mine = b.userA === u.id;
    const partnerId = mine ? b.userB : b.userA;
    const alias = mine ? b.aliasB : b.aliasA;
    await db.insert(schema.reports).values({ reporterId: u.id, reportedUserId: partnerId, battleId: id, reportedAlias: alias, reason: body.reason, details: body.details });
    if (body.block) await block(u.id, partnerId, alias, null);
    reply.code(201);
    return { ok: true };
  });
}
