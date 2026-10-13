import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { db, schema } from '../../db';
import { badRequest, notFound } from '../../lib/errors';
import { parse, uuidParam } from '../../lib/validate';
import { requireAdmin } from '../../plugins/auth';

export async function audit(actorId: string, action: string, target: string | null, details?: unknown) {
  await db.insert(schema.auditLog).values({ actorId, action, target, details: details ?? null });
}

interface CrudOptions<T extends PgTable> {
  path: string;
  table: T;
  idColumn: PgColumn;
  /** Columns searched by ?q= */
  searchColumns: PgColumn[];
  orderBy: PgColumn;
  orderDesc?: boolean;
  /** Validates the payload for create (full) and update (partial). */
  input: z.ZodObject<z.ZodRawShape>;
  /** Extra filters from query params, e.g. module or kind. */
  filters?: Record<string, PgColumn>;
  /** Returns a list of problems that prevent publishing (empty list = OK). */
  validatePublish?: (row: Record<string, unknown>) => Promise<string[]> | string[];
  /** Transform input before saving (e.g. compute derived fields). */
  prepare?: (data: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>;
  /** Columns to omit from list responses (large JSON). */
  listOmit?: string[];
}

/**
 * Generic admin CRUD routes. Every route checks the administrator role on the server; hiding buttons
 * in the UI is not relied upon. Publishing runs content validation first.
 */
export function registerCrud<T extends PgTable>(app: FastifyInstance, o: CrudOptions<T>) {
  const table = o.table as unknown as PgTable & Record<string, PgColumn>;
  const hasStatus = 'status' in table;
  const hasUpdatedAt = 'updatedAt' in table;

  async function checkPublish(row: Record<string, unknown>) {
    if (!hasStatus || row.status !== 'published' || !o.validatePublish) return;
    const problems = await o.validatePublish(row);
    if (problems.length) throw badRequest(`Cannot publish: ${problems[0]}`, problems.map((message) => ({ path: '', message })));
  }

  app.get(`/api/admin/${o.path}`, async (req) => {
    requireAdmin(req);
    const q = parse(z.object({ q: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), status: z.string().max(20).optional() }).passthrough(), req.query) as Record<string, string | number | undefined>;
    const pageSize = 50;
    const conds: (SQL | undefined)[] = [];
    if (q.q) conds.push(or(...o.searchColumns.map((c) => ilike(c, `%${q.q}%`))));
    if (q.status && hasStatus) conds.push(eq(table.status, q.status as string));
    for (const [param, col] of Object.entries(o.filters ?? {})) if (q[param]) conds.push(eq(col, q[param] as string));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await db
      .select()
      .from(table)
      .where(where)
      .orderBy(o.orderDesc ? desc(o.orderBy) : asc(o.orderBy))
      .limit(pageSize + 1)
      .offset(((q.page as number) - 1) * pageSize);
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(table).where(where);
    const items = (rows as Record<string, unknown>[]).slice(0, pageSize).map((r) => {
      if (!o.listOmit) return r;
      const c = { ...r };
      for (const k of o.listOmit) delete c[k];
      return c;
    });
    return { items, total, hasMore: rows.length > pageSize };
  });

  app.get(`/api/admin/${o.path}/:id`, async (req) => {
    requireAdmin(req);
    const { id } = parse(uuidParam, req.params);
    const [row] = await db.select().from(table).where(eq(o.idColumn, id));
    if (!row) throw notFound();
    return { item: row };
  });

  app.post(`/api/admin/${o.path}`, async (req, reply) => {
    const admin = requireAdmin(req);
    let data = parse(o.input, req.body) as Record<string, unknown>;
    if (o.prepare) data = await o.prepare(data);
    await checkPublish(data);
    try {
      const [row] = await db.insert(table).values(data as never).returning();
      await audit(admin.id, `create:${o.path}`, String((row as Record<string, unknown>).id ?? ''), { title: data.title ?? data.word ?? data.name ?? data.slug });
      reply.code(201);
      return { item: row };
    } catch (err) {
      if ((err as { code?: string }).code === '23505') throw badRequest('An item with this slug or name already exists.');
      throw err;
    }
  });

  app.patch(`/api/admin/${o.path}/:id`, async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(uuidParam, req.params);
    const [existing] = await db.select().from(table).where(eq(o.idColumn, id));
    if (!existing) throw notFound();
    let data = parse(o.input.partial(), req.body) as Record<string, unknown>;
    if (o.prepare) data = await o.prepare({ ...(existing as Record<string, unknown>), ...data });
    await checkPublish({ ...(existing as Record<string, unknown>), ...data });
    const { id: _id, createdAt: _c, ...rest } = data as Record<string, unknown>;
    try {
      const [row] = await db
        .update(table)
        .set({ ...rest, ...(hasUpdatedAt ? { updatedAt: new Date() } : {}) } as never)
        .where(eq(o.idColumn, id))
        .returning();
      await audit(admin.id, `update:${o.path}`, id, { fields: Object.keys(req.body as object) });
      return { item: row };
    } catch (err) {
      if ((err as { code?: string }).code === '23505') throw badRequest('An item with this slug or name already exists.');
      throw err;
    }
  });

  app.delete(`/api/admin/${o.path}/:id`, async (req) => {
    const admin = requireAdmin(req);
    const { id } = parse(uuidParam, req.params);
    const res = await db.delete(table).where(eq(o.idColumn, id)).returning();
    if (!res.length) throw notFound();
    await audit(admin.id, `delete:${o.path}`, id);
    return { ok: true };
  });
}
