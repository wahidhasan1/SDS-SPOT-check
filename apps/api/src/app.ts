import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { HttpError } from './lib/errors';
import { allowedOrigins, authPlugin } from './plugins/auth';
import { registerRoutes } from './routes';

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? (!config.isTest ? { level: config.isProd ? 'info' : 'warn' } : false),
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: (origin, cb) => {
      // Non-browser clients (mobile apps) send no Origin header.
      if (!origin) return cb(null, true);
      cb(null, allowedOrigins().has(origin));
    },
    credentials: true,
  });
  await app.register(rateLimit, {
    global: false,
    max: config.rateLimitEnabled ? 120 : 1_000_000,
    timeWindow: '1 minute',
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
  await app.register(websocket, { options: { maxPayload: 256 * 1024 } });
  await app.register(authPlugin);

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown; code?: string }, req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.statusCode === 429) {
      return reply.code(429).send({ error: { code: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' } });
    }
    if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.code(413).send({ error: { code: 'file_too_large', message: 'That file is too large (maximum 10 MB).' } });
    }
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: { code: 'bad_request', message: err.message } });
    }
    req.log.error({ err }, 'unhandled error');
    // Never leak internal details to clients.
    return reply.code(500).send({ error: { code: 'internal', message: 'Something went wrong on our side. Please try again.' } });
  });

  fs.mkdirSync(config.uploadDir, { recursive: true });
  await registerRoutes(app);

  // Serve the built web app (production) with SPA fallback.
  if (fs.existsSync(path.join(config.webDist, 'index.html'))) {
    await app.register(fastifyStatic, { root: config.webDist, prefix: '/', wildcard: false, decorateReply: true });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/') || req.url.startsWith('/ws')) {
        return reply.code(404).send({ error: { code: 'not_found', message: 'Not found.' } });
      }
      return reply.sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: { code: 'not_found', message: 'Not found.' } }));
  }

  return app;
}
