import pg from 'pg';

/** Reset the test database schema, then migrate and seed it once for the whole run. */
export default async function setup() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://fluent:fluent_dev_pw@localhost:5432/fluent_test';
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
  await client.end();
  const { runMigrations } = await import('../src/db/migrate');
  const { seed } = await import('../src/seed/index');
  const { pool } = await import('../src/db/index');
  await runMigrations();
  await seed(() => {});
  await pool.end();
}
