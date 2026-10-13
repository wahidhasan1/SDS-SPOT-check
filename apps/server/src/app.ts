import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { existsSync, mkdirSync } from 'node:fs';
import { config } from './config';
import { HttpError } from './lib/errors';
import { wsRoutes } from './realtime/ws';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { callRoutes } from './routes/calls';

export type RouteModule = (app: FastifyInstance) => Promise<void>;
const extraRoutes: RouteModule[] = [];
export function addRoutes(m: RouteModule) {
  extraRoutes.push(m);
}

export function integrationStatus() {
  return {
    ai: !!config.anthropicApiKey,
    translation: !!config.anthropicApiKey || !!config.libreTranslateUrl,
    serverSpeechToText: !!config.sttApiUrl,
    turn: !!config.turnSecret && config.turnUrls.length > 0,
    email: !!config.resendApiKey,
    stripe: !!config.stripeSecretKey && !!config.stripePremiumPriceId,
    revenueCat: !!config.revenueCatWebhookAuth,
    push: true,
    ocr: true,
  };
}

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: opts.logger
      ? {
          level: config.isProd ? 'info' : 'warn',
          // Never log credentials or tokens.
          redact: ['req.headers.authorization', 'req.body.password', 'req.body.refreshToken', 'req.body.token'],
        }
      : false,
    bodyLimit: 1_000_000,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) cb(null, true);
      else cb(null, false);
    },
    credentials: false,
  });
  await app.register(rateLimit, {
    max: config.isTest ? 100000 : 400,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({ statusCode: 429, error: { code: 'rate_limited', message: 'Too many requests. Please slow down.' } }),
  });
  await app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024, files: 1 } });
  await app.register(websocket, { options: { maxPayload: 64 * 1024 } });

  if (!existsSync(config.mediaDir)) mkdirSync(config.mediaDir, { recursive: true });
  await app.register(fastifyStatic, { root: config.mediaDir, prefix: '/media/', maxAge: '7d' });

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.statusCode === 429) {
      return reply.status(429).send({ error: { code: 'rate_limited', message: 'Too many requests. Please slow down.' } });
    }
    if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
      return reply.status(413).send({ error: { code: 'file_too_large', message: 'That file is too large (maximum 8 MB).' } });
    }
    if (err.validation || err.statusCode === 400) {
      return reply.status(400).send({ error: { code: 'bad_request', message: err.message } });
    }
    req.log.error(err);
    return reply.status(500).send({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } });
  });

  app.get('/health', async () => ({ ok: true }));
  app.get('/config', async () => ({ appName: config.appName, integrations: integrationStatus() }));

  await app.register(wsRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(callRoutes);
  for (const m of extraRoutes) await app.register(m);
  return app;
}
