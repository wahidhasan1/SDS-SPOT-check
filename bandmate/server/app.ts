import fs from 'node:fs'
import path from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import { ZodError } from 'zod'
import { env } from './env.ts'
import { SESSION_COOKIE, userFromToken } from './lib/auth.ts'
import { HttpError } from './lib/util.ts'
import { authRoutes } from './routes/auth.ts'
import { meRoutes } from './routes/me.ts'
import { registerRoutes } from './routes/index.ts'
import { realtimeRoutes } from './realtime/hub.ts'

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ? { level: env.isProd ? 'info' : 'warn', redact: ['req.headers.cookie', 'req.headers.authorization'] } : false,
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
  })

  await app.register(cookie)
  await app.register(rateLimit, {
    max: 600,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.user?.id ?? req.ip,
  })
  await app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024, files: 1 } })
  await app.register(websocket, { options: { maxPayload: 256 * 1024 } })

  app.decorateRequest('user', null)
  app.addHook('onRequest', async (req) => {
    req.user = userFromToken(req.cookies[SESSION_COOKIE])
  })
  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Permissions-Policy', 'microphone=(self), camera=(self), geolocation=()')
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store')
  })

  // State-changing API calls must come from our own origin (cookie auth + CSRF defence).
  app.addHook('preHandler', async (req) => {
    if (!req.url.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return
    if (req.url.startsWith('/api/webhooks/')) return
    const origin = req.headers.origin
    if (origin && new URL(origin).host !== req.headers.host && origin !== env.publicUrl) {
      throw new HttpError(403, 'bad_origin', 'Request blocked: unexpected origin.')
    }
  })

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const first = err.issues[0]
      return reply.status(400).send({ error: { code: 'invalid', message: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input.', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } })
    }
    if (err instanceof HttpError) return reply.status(err.status).send({ error: { code: err.code, message: err.message, ...err.extra } })
    const e = err as { statusCode?: number; message: string; code?: string }
    if (e.statusCode === 429) return reply.status(429).send({ error: { code: 'rate_limited', message: 'Too many requests. Please slow down and try again shortly.' } })
    if (e.statusCode && e.statusCode < 500) return reply.status(e.statusCode).send({ error: { code: e.code ?? 'bad_request', message: e.message } })
    req.log.error(err)
    return reply.status(500).send({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } })
  })

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(meRoutes, { prefix: '/api/me' })
  await app.register(registerRoutes, { prefix: '/api' })
  await app.register(realtimeRoutes)

  // Serve the built web app in production (SPA fallback for client-side routes).
  const web = path.join(env.root, 'dist')
  if (fs.existsSync(path.join(web, 'index.html'))) {
    await app.register(fastifyStatic, { root: web, wildcard: false, maxAge: '1h' })
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/ws')) return reply.status(404).send({ error: { code: 'not_found', message: 'Not found' } })
      return reply.sendFile('index.html', { maxAge: 0 })
    })
  }
  return app
}
