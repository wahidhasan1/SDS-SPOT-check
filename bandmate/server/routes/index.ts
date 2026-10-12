import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { db } from '../db/index.ts'
import { env } from '../env.ts'
import { requireUser } from '../lib/auth.ts'
import { features } from '../services/features.ts'
import { callRoutes } from './calls.ts'
import { assessmentRoutes } from './assessment.ts'

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

  await app.register(callRoutes, { prefix: '/calls' })
  await app.register(assessmentRoutes, { prefix: '/assessment' })
}
