import pg from 'pg';
import { config } from '../config';

// Return numeric columns as JS numbers (our numerics are small: bands, thetas, ease factors).
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// Keep DATE columns as 'YYYY-MM-DD' strings to avoid timezone shifts.
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 20 });

export type Queryable = pg.Pool | pg.PoolClient;

export async function q<T = any>(text: string, params: unknown[] = [], db: Queryable = pool): Promise<T[]> {
  const res = await db.query(text, params as any[]);
  return res.rows as T[];
}

export async function one<T = any>(text: string, params: unknown[] = [], db: Queryable = pool): Promise<T | null> {
  const rows = await q<T>(text, params, db);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
