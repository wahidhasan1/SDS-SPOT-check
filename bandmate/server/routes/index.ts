import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../db/index.ts'
import { env } from '../env.ts'
import { requireUser } from '../lib/auth.ts'
import { notConfigured } from '../lib/util.ts'
import { features } from '../services/features.ts'
import { callRoutes } from './calls.ts'
import { assessmentRoutes } from './assessment.ts'
import { vocabRoutes } from './vocab.ts'
import { grammarRoutes } from './grammar.ts'
import { objectiveRoutes } from '../ielts/objective-routes.ts'
import { writingRoutes } from '../ielts/writing-routes.ts'
import { speakingRoutes } from '../ielts/speaking-routes.ts'
import { mockRoutes } from '../ielts/mock-routes.ts'
import { billingRoutes, webhookRoutes } from './billing.ts'
import { battleRoutes } from './battles.ts'
import { readRoutes } from './read.ts'
import { adminRoutes } from './admin.ts'
import { pushReady } from '../services/push.ts'
import { overviewRoutes } from '../ielts/overview.ts'

export const registerRoutes: FastifyPluginAsync = async (app) => {
  /** Public, non-secret configuration: app name and which optional services are available. */
  app.get('/config', async () => ({ appName: env.appName, features: await features() }))

  app.get('/notifications', async (req) => {
    const user = requireUser(req)
    return {
      items: db().all('SELECT id, kind, title, body, link, read_at AS readAt, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', user.id),
      unread: db().one<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', user.id)!.n,
    }
  })

  app.post('/notifications/read', async (req) => {
    const user = requireUser(req)
    const body = z.object({ ids: z.array(z.number().int()).max(100).optional() }).parse(req.body ?? {})
    if (body.ids?.length) db().run(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND id IN (${body.ids.map(() => '?').join(',')})`, Date.now(), user.id, ...body.ids)
    else db().run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', Date.now(), user.id)
    return { ok: true }
  })

  /** Saves this browser's Web Push subscription (only when VAPID keys are configured). */
  app.post('/notifications/push', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const user = requireUser(req)
    if (!pushReady()) throw notConfigured('Push notifications', 'Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (generate with `npx web-push generate-vapid-keys`).')
    const sub = z.object({ endpoint: z.string().url().max(1000).refine((u) => u.startsWith('https://'), 'must be https'), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }).parse(req.body)
    db().run('INSERT INTO push_subscriptions (endpoint, user_id, keys, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, keys = excluded.keys', sub.endpoint, user.id, JSON.stringify(sub.keys), Date.now())
    return { ok: true }
  })

  app.delete('/notifications/push', async (req) => {
    const user = requireUser(req)
    const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(req.body)
    db().run('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', endpoint, user.id)
    return { ok: true }
  })

  await app.register(callRoutes, { prefix: '/calls' })
  await app.register(assessmentRoutes, { prefix: '/assessment' })
  await app.register(vocabRoutes, { prefix: '/vocab' })
  await app.register(grammarRoutes, { prefix: '/grammar' })
  await app.register(objectiveRoutes, { prefix: '/ielts' })
  await app.register(overviewRoutes, { prefix: '/ielts' })
  await app.register(writingRoutes, { prefix: '/writing' })
  await app.register(speakingRoutes, { prefix: '/speaking' })
  await app.register(mockRoutes, { prefix: '/mock' })
  await app.register(billingRoutes, { prefix: '/billing' })
  await app.register(webhookRoutes, { prefix: '/webhooks' })
  await app.register(battleRoutes, { prefix: '/battles' })
  await app.register(readRoutes, { prefix: '/read' })
  await app.register(adminRoutes, { prefix: '/admin' })
}
