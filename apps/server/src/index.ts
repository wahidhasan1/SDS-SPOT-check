import { config } from './config';
import { buildApp } from './app';
import { migrate } from './db/migrate';
import { pool } from './db/pool';
import { startPubSub, stopPubSub } from './realtime/hub';
import { startJobs, stopJobs } from './jobs';
import './routes/register';

async function main() {
  await migrate(true);
  const app = await buildApp({ logger: true });
  await startPubSub();
  startJobs();
  await app.listen({ port: config.port, host: config.host });
  console.log(`${config.appName} API listening on http://${config.host}:${config.port}`);
  const shutdown = async () => {
    stopJobs();
    await app.close();
    await stopPubSub();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
