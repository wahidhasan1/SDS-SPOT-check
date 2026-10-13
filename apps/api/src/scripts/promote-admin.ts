/** Usage: npm run admin:promote -- someone@example.com   (the account must already exist) */
import { sql } from 'drizzle-orm';
import { db, pool, schema } from '../db';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run admin:promote -- <email>');
  process.exit(1);
}
const res = await db.update(schema.users).set({ role: 'admin' }).where(sql`lower(${schema.users.email}) = ${email}`).returning({ id: schema.users.id });
if (!res.length) {
  console.error(`No account found for ${email}. Register in the app first, then run this again.`);
  process.exitCode = 1;
} else {
  await db.insert(schema.auditLog).values({ actorId: null, action: 'promote:admin (cli)', target: res[0].id });
  console.log(`${email} is now an administrator.`);
}
await pool.end();
