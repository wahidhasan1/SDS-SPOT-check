import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { API_ROOT } from '../config';
import { db, schema } from '../db';
import { forbidden, notFound } from '../lib/errors';
import { parse, uuidParam } from '../lib/validate';
import { requireUser } from '../plugins/auth';
import { absolutePath } from '../services/media';

export async function mediaRoutes(app: FastifyInstance) {
  // Public learning media (listening audio, word pronunciation, admin-uploaded listening audio).
  await app.register(fastifyStatic, { root: path.join(API_ROOT, 'media'), prefix: '/media/', decorateReply: false, maxAge: '7d' });

  // Private user uploads: only the owner (or an administrator) can read them.
  app.get('/api/media/:id', async (req, reply) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const [f] = await db.select().from(schema.mediaFiles).where(eq(schema.mediaFiles.id, id));
    if (!f) throw notFound('File not found.');
    if (!f.isPublic && f.ownerId !== u.id && u.role !== 'admin') throw forbidden('You cannot access this file.');
    const abs = absolutePath(f.path);
    if (!fs.existsSync(abs)) throw notFound('File not found.');
    reply.header('content-type', f.mime);
    reply.header('cache-control', 'private, max-age=3600');
    reply.header('x-content-type-options', 'nosniff');
    return reply.send(fs.createReadStream(abs));
  });
}
