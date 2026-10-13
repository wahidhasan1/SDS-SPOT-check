import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from './crypto';
import { forbidden, unauthorized } from './errors';
import { one } from '../db/pool';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userRole: string;
  }
}

export async function requireAuth(req: FastifyRequest, _reply: FastifyReply) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) throw unauthorized();
  const claims = await verifyAccessToken(h.slice(7));
  if (!claims) throw unauthorized('Your session has expired. Please sign in again.');
  req.userId = claims.userId;
  req.userRole = claims.role;
}

/** Admin check reads the role from the database, not just the token, so revocation is immediate. */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  const u = await one<{ role: string }>('SELECT role FROM users WHERE id=$1', [req.userId]);
  if (u?.role !== 'admin') throw forbidden('Administrator access required.');
}
