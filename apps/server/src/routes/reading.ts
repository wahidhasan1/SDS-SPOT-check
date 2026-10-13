import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lookupSchema, ocrCorrectionSchema, translateSchema } from '@app/shared';
import { one, q } from '../db/pool';
import { requireAuth } from '../lib/auth';
import { badRequest, notFound } from '../lib/errors';
import { parse } from '../lib/validate';
import { aiAvailable, aiContextMeaning } from '../services/ai';
import { lookupWord } from '../services/dictionary';
import { consumeDaily, refundDaily } from '../services/entitlements';
import { ocrImage } from '../services/ocr';
import { translate, translationAvailable } from '../services/translation';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/tiff', 'image/bmp']);

function sessionDto(r: any) {
  return {
    id: r.id,
    title: r.title,
    text: r.corrected_text ?? r.ocr_text,
    ocrText: r.ocr_text,
    corrected: r.corrected_text !== null,
    confidence: r.ocr_confidence,
    lowConfidenceWords: r.low_confidence_words,
    imageMeta: r.image_meta,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function readingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/reading/capabilities', async () => ({
    ocr: true,
    aiMeanings: aiAvailable(),
    dictionary: true,
    translation: translationAvailable(),
  }));

  app.post('/reading/scan', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const file = await (req as any).file();
    if (!file) throw badRequest('Choose a photo of an English page to scan.');
    if (!IMAGE_TYPES.has(file.mimetype)) throw badRequest('Unsupported file type. Upload a JPG, PNG, WEBP or HEIC image.');
    const buf: Buffer = await file.toBuffer();
    if (buf.length === 0) throw badRequest('The uploaded file is empty.');
    await consumeDaily(req.userId, 'aiReadingScans');
    try {
      const r = await ocrImage(buf);
      const title = r.text.split(/\s+/).slice(0, 8).join(' ').slice(0, 80) || 'Untitled scan';
      const row = await one<any>(
        `INSERT INTO ai_reading_sessions (user_id, title, ocr_text, ocr_confidence, low_confidence_words, image_meta) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.userId, title, r.text, r.confidence, JSON.stringify(r.lowConfidenceWords), r.imageMeta],
      );
      return { ...sessionDto(row), warnings: r.warnings, wordCount: r.wordCount };
    } catch (e) {
      await refundDaily(req.userId, 'aiReadingScans');
      throw e;
    }
  });

  app.post('/reading/sessions', async (req) => {
    // Paste text directly (e.g. from an e-book you own) instead of scanning a photo.
    const { text, title } = parse(z.object({ text: z.string().trim().min(1).max(20000), title: z.string().max(80).optional() }), req.body);
    const row = await one<any>(
      `INSERT INTO ai_reading_sessions (user_id, title, ocr_text, ocr_confidence) VALUES ($1,$2,$3,NULL) RETURNING *`,
      [req.userId, title || text.split(/\s+/).slice(0, 8).join(' ').slice(0, 80), text],
    );
    return sessionDto(row);
  });

  app.get('/reading/sessions', async (req) => {
    const rows = await q('SELECT * FROM ai_reading_sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.userId]);
    return rows.map(sessionDto);
  });

  app.get('/reading/sessions/:id', async (req) => {
    const { id } = req.params as { id: string };
    const row = await one('SELECT * FROM ai_reading_sessions WHERE id=$1 AND user_id=$2', [id, req.userId]);
    if (!row) throw notFound('Reading session not found.');
    const lookups = await q('SELECT id, word, sentence, result, source, created_at FROM word_lookups WHERE session_id=$1 ORDER BY created_at DESC LIMIT 100', [id]);
    return { ...sessionDto(row), lookups };
  });

  app.put('/reading/sessions/:id', async (req) => {
    const { id } = req.params as { id: string };
    const { text } = parse(ocrCorrectionSchema, req.body);
    const row = await one('UPDATE ai_reading_sessions SET corrected_text=$3, updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *', [id, req.userId, text]);
    if (!row) throw notFound('Reading session not found.');
    return sessionDto(row);
  });

  app.delete('/reading/sessions/:id', async (req) => {
    const { id } = req.params as { id: string };
    await q('DELETE FROM ai_reading_sessions WHERE id=$1 AND user_id=$2', [id, req.userId]);
    return { ok: true };
  });

  app.post('/reading/lookup', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const input = parse(lookupSchema, req.body);
    if (input.sessionId) {
      const s = await one('SELECT 1 FROM ai_reading_sessions WHERE id=$1 AND user_id=$2', [input.sessionId, req.userId]);
      if (!s) throw notFound('Reading session not found.');
    }
    await consumeDaily(req.userId, 'wordLookups');
    const word = input.word.replace(/^[^A-Za-z]+|[^A-Za-z'’-]+$/g, '');
    if (!word) {
      await refundDaily(req.userId, 'wordLookups');
      throw badRequest('Select a word.');
    }
    const p = await one<any>('SELECT translation_language FROM user_profiles WHERE user_id=$1', [req.userId]);
    const curated = await one<any>(`SELECT id, word, ipa, part_of_speech, meaning, examples, synonyms, cefr FROM vocabulary WHERE lower(word)=lower($1) AND status='published' LIMIT 1`, [word]);
    const dictionary = lookupWord(word, input.sentence);
    let ai: any = null;
    let aiError: string | null = null;
    if (aiAvailable()) {
      try {
        ai = await aiContextMeaning(word, input.sentence ?? word, p?.translation_language ?? null);
      } catch (e) {
        aiError = (e as Error).message;
      }
    }
    if (!ai && !dictionary && !curated) {
      await refundDaily(req.userId, 'wordLookups');
      return {
        word,
        source: 'none',
        found: false,
        message: 'This word is not in the dictionary. It may be a name, a very new word, or an OCR mistake — check the spelling in the text.',
        aiError,
      };
    }
    const result = { word, found: true, ai, dictionary, curated, aiError };
    const source = ai ? 'ai' : 'dictionary';
    await q('INSERT INTO word_lookups (user_id, session_id, word, sentence, result, source) VALUES ($1,$2,$3,$4,$5,$6)', [
      req.userId, input.sessionId ?? null, word, input.sentence ?? null, result, source,
    ]);
    return { ...result, source };
  });

  app.post('/reading/translate', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const input = parse(translateSchema, req.body);
    if (!translationAvailable()) {
      return { available: false, message: 'Translation is not configured on this server yet (requires an AI or translation provider key).' };
    }
    await consumeDaily(req.userId, 'translations');
    try {
      return { available: true, ...(await translate(input.text, input.targetLanguage, input.context)) };
    } catch (e) {
      await refundDaily(req.userId, 'translations');
      throw e;
    }
  });
}
