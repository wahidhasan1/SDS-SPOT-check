import type { FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db, schema } from '../db';
import { badRequest } from '../lib/errors';

export interface UploadedFile { buffer: Buffer; filename: string; mimetype: string }

/** Read a multipart request into text fields and at most one file. */
export async function readMultipart(req: FastifyRequest, maxBytes: number) {
  if (!req.isMultipart()) throw badRequest('Expected a multipart/form-data upload.');
  const fields: Record<string, string> = {};
  let file: UploadedFile | null = null;
  for await (const part of req.parts({ limits: { fileSize: maxBytes } })) {
    if (part.type === 'file') {
      const buffer = await part.toBuffer();
      if (part.file.truncated) throw badRequest(`File is too large (maximum ${Math.round(maxBytes / 1024 / 1024)} MB).`);
      file = { buffer, filename: part.filename, mimetype: part.mimetype };
    } else {
      fields[part.fieldname] = String(part.value);
    }
  }
  return { fields, file };
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/aac': 'aac', 'audio/x-m4a': 'm4a', 'audio/3gpp': '3gp',
};

/** Magic-byte sniffing so a renamed file cannot pass as an image or audio clip. */
export function sniffType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') return 'audio/wav';
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'audio/webm';
  if (buf.toString('ascii', 0, 4) === 'OggS') return 'audio/ogg';
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (/heic|heix|mif1|msf1/.test(brand)) return 'image/heic';
    if (brand.startsWith('3gp')) return 'audio/3gpp';
    return 'audio/mp4';
  }
  if (buf.toString('ascii', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  return null;
}

export async function storeFile(ownerId: string, kind: string, file: UploadedFile, allowedPrefix: 'image/' | 'audio/') {
  const sniffed = sniffType(file.buffer);
  if (!sniffed || !sniffed.startsWith(allowedPrefix)) {
    throw badRequest(allowedPrefix === 'image/' ? 'Unsupported image. Please upload a JPEG, PNG or WebP photo.' : 'Unsupported audio format.');
  }
  const id = randomUUID();
  const rel = path.join(kind, `${id}.${EXT[sniffed] ?? 'bin'}`);
  const abs = path.join(config.uploadDir, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, file.buffer);
  const [row] = await db
    .insert(schema.mediaFiles)
    .values({ id, ownerId, kind, path: rel, originalName: file.filename?.slice(0, 200), mime: sniffed, sizeBytes: file.buffer.length })
    .returning();
  return row;
}

export async function deleteFile(id: string | null | undefined) {
  if (!id) return;
  const [row] = await db.select().from(schema.mediaFiles).where(eq(schema.mediaFiles.id, id));
  if (!row) return;
  await fs.rm(path.join(config.uploadDir, row.path), { force: true });
  await db.delete(schema.mediaFiles).where(eq(schema.mediaFiles.id, id));
}

export function absolutePath(rel: string) {
  const abs = path.resolve(config.uploadDir, rel);
  if (!abs.startsWith(config.uploadDir)) throw badRequest('Invalid path');
  return abs;
}
