import { config } from './config';
import { buildApp } from './app';
import { runMigrations } from './db/migrate';
import { startReminderJob } from './services/reminders';

async function main() {
  await runMigrations();
  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });
  startReminderJob();
  console.log(`FluentPath API listening on http://localhost:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
