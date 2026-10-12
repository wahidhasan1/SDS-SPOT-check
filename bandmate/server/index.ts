import { buildApp } from './app.ts'
import { env } from './env.ts'
import { bootstrap } from './bootstrap.ts'
import { startReminderScheduler } from './services/push.ts'
import { stopOcr } from './services/ocr.ts'

bootstrap()
const app = await buildApp({ logger: true })
await app.listen({ port: env.port, host: env.host })
startReminderScheduler()
console.log(`${env.appName} API listening on http://localhost:${env.port}`)

const stop = async () => {
  await app.close()
  await stopOcr()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
