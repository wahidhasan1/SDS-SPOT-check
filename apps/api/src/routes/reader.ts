import type { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '../config';
import { db, schema } from '../db';
import { HttpError, notFound } from '../lib/errors';
import { parse, uuidParam } from '../lib/validate';
import { requireUser } from '../plugins/auth';
import { logActivity, userTimezone } from '../services/activity';
import { aiConfigured, explainWord } from '../services/ai';
import { lookup } from '../services/dictionary';
import { consume, refund } from '../services/entitlements';
import { deleteFile, readMultipart, storeFile } from '../services/media';
import { recognise } from '../services/ocr';

const MAX_IMAGE = 8 * 1024 * 1024;

export async function readerRoutes(app: FastifyInstance) {
  app.post('/api/reader/scan', { config: { rateLimit: { max: config.rateLimitEnabled ? 20 : 100_000, timeWindow: '1 minute' } } }, async (req, reply) => {
    const u = requireUser(req);
    const { fields, file } = await readMultipart(req, MAX_IMAGE);
    if (!file) throw new HttpError(400, 'bad_request', 'Please choose a photo of a book page.');
    const tz = await userTimezone(u.id);
    await consume(u.id, 'ocr_scan', tz);
    let media: Awaited<ReturnType<typeof storeFile>> | null = null;
    try {
      media = await storeFile(u.id, 'reader', file, 'image/');
      const ocr = await recognise(file.buffer);
      if (ocr.words < 3) {
        throw new HttpError(422, 'unreadable', 'We could not find readable English text in this photo. Try better lighting, hold the camera straight above the page, and make sure the text is in focus.');
      }
      const title = (fields.title?.trim() || ocr.text.split(/\s+/).slice(0, 6).join(' ')).slice(0, 120);
      const [doc] = await db
        .insert(schema.ocrDocuments)
        .values({ userId: u.id, imageFileId: media.id, title, recognizedText: ocr.text, confidence: ocr.confidence })
        .returning();
      await logActivity(u.id, { type: 'reader_scan', title: `Scanned a book page: ${title}`, refId: doc.id, xp: 5, minutes: 2 });
      reply.code(201);
      return { document: doc, ocr: { confidence: ocr.confidence, words: ocr.words } };
    } catch (err) {
      await refund(u.id, 'ocr_scan', tz);
      if (media) await deleteFile(media.id);
      throw err;
    }
  });

  app.post('/api/reader/text', async (req, reply) => {
    const u = requireUser(req);
    const body = parse(z.object({ title: z.string().trim().min(1).max(120), text: z.string().trim().min(10, 'Please paste at least a sentence.').max(20000) }), req.body);
    const [doc] = await db.insert(schema.ocrDocuments).values({ userId: u.id, title: body.title, recognizedText: body.text, confidence: null }).returning();
    reply.code(201);
    return { document: doc };
  });

  app.get('/api/reader/docs', async (req) => {
    const u = requireUser(req);
    const rows = await db
      .select({ id: schema.ocrDocuments.id, title: schema.ocrDocuments.title, confidence: schema.ocrDocuments.confidence, createdAt: schema.ocrDocuments.createdAt, imageFileId: schema.ocrDocuments.imageFileId, preview: sql<string>`left(coalesce(${schema.ocrDocuments.correctedText}, ${schema.ocrDocuments.recognizedText}), 160)` })
      .from(schema.ocrDocuments)
      .where(eq(schema.ocrDocuments.userId, u.id))
      .orderBy(desc(schema.ocrDocuments.createdAt));
    return { documents: rows };
  });

  app.get('/api/reader/docs/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const [doc] = await db.select().from(schema.ocrDocuments).where(and(eq(schema.ocrDocuments.id, id), eq(schema.ocrDocuments.userId, u.id)));
    if (!doc) throw notFound('Document not found.');
    return { document: doc, imageUrl: doc.imageFileId ? `/api/media/${doc.imageFileId}` : null, aiConfigured: aiConfigured() };
  });

  app.patch('/api/reader/docs/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const body = parse(z.object({ title: z.string().trim().min(1).max(120).optional(), correctedText: z.string().trim().min(1).max(20000).nullable().optional() }), req.body);
    const res = await db.update(schema.ocrDocuments).set({ ...body, updatedAt: new Date() }).where(and(eq(schema.ocrDocuments.id, id), eq(schema.ocrDocuments.userId, u.id))).returning();
    if (!res.length) throw notFound('Document not found.');
    return { document: res[0] };
  });

  app.delete('/api/reader/docs/:id', async (req) => {
    const u = requireUser(req);
    const { id } = parse(uuidParam, req.params);
    const [doc] = await db.select().from(schema.ocrDocuments).where(and(eq(schema.ocrDocuments.id, id), eq(schema.ocrDocuments.userId, u.id)));
    if (!doc) throw notFound('Document not found.');
    await db.delete(schema.ocrDocuments).where(eq(schema.ocrDocuments.id, id));
    await deleteFile(doc.imageFileId);
    return { ok: true };
  });

  /** Dictionary lookup with automatic best-sense selection for the sentence (offline WordNet). */
  app.post('/api/reader/lookup', async (req) => {
    const u = requireUser(req);
    const body = parse(z.object({ word: z.string().trim().min(1).max(60), sentence: z.string().max(1000).default('') }), req.body);
    const result = lookup(body.word, body.sentence);
    const [entry] = await db
      .select({ id: schema.words.id, word: schema.words.word, definition: schema.words.definition, example: schema.words.example, cefrLevel: schema.words.cefrLevel, phonetic: schema.words.phonetic, audioUrl: schema.words.audioUrl, partOfSpeech: schema.words.partOfSpeech })
      .from(schema.words)
      .where(sql`lower(${schema.words.word}) in (${body.word.toLowerCase()}, ${result.lemma.toLowerCase()}) and ${schema.words.status} = 'published'`)
      .limit(1);
    const [saved] = await db
      .select({ id: schema.userWords.id })
      .from(schema.userWords)
      .where(and(eq(schema.userWords.userId, u.id), sql`lower(${schema.userWords.word}) in (${body.word.toLowerCase()}, ${result.lemma.toLowerCase()})`));
    return { ...result, learnerEntry: entry ?? null, savedId: saved?.id ?? null, aiConfigured: aiConfigured() };
  });

  /** AI explanation of the word in this exact sentence, with optional translation. Requires ANTHROPIC_API_KEY. */
  app.post('/api/reader/explain', async (req) => {
    const u = requireUser(req);
    const body = parse(z.object({ word: z.string().trim().min(1).max(60), sentence: z.string().trim().min(1).max(1000), language: z.string().max(40).nullable().optional() }), req.body);
    if (!aiConfigured()) throw new HttpError(503, 'not_configured', 'AI explanations are not configured on this server. The dictionary meaning above is still available.');
    const tz = await userTimezone(u.id);
    await consume(u.id, 'ai_reader_explain', tz);
    try {
      return { explanation: await explainWord(body.word, body.sentence, body.language ?? null) };
    } catch (err) {
      await refund(u.id, 'ai_reader_explain', tz);
      throw err;
    }
  });
}
