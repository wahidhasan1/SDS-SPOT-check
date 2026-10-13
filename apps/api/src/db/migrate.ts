import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { API_ROOT } from '../config';
import { db, pool } from './index';

export async function runMigrations() {
  await migrate(db, { migrationsFolder: path.join(API_ROOT, 'drizzle') });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('Database migrations applied.');
      return pool.end();
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
