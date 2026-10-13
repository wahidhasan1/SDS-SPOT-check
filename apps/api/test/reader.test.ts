import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/db';
import { call, getApp, registerUser, type TestUser } from './helpers';

afterAll(async () => {
  await (await getApp()).close();
  await pool.end();
});

async function upload(u: TestUser, file: string, mime: string) {
  const a = await getApp();
  const boundary = 'FPBOUNDARY';
  const data = fs.readFileSync(path.join(__dirname, 'fixtures', file));
  const payload = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${file}"\r\nContent-Type: ${mime}\r\n\r\n`), data, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  return a.inject({ method: 'POST', url: '/api/reader/scan', headers: { cookie: u.cookie, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload });
}

describe('book reader (real OCR with tesseract.js)', () => {
  it('recognises text from a photo of a page, then looks up words in context and saves them', async () => {
    const u = await registerUser();
    const res = await upload(u, 'book-page.jpg', 'image/jpeg');
    expect(res.statusCode).toBe(201);
    const doc = res.json().document;
    expect(doc.recognizedText).toContain('The river was quiet that morning');
    expect(res.json().ocr.confidence).toBeGreaterThan(80);
    const look = await call(u, 'POST', '/api/reader/lookup', { word: 'bank', sentence: 'Anna walked along the bank, watching the mist rise slowly from the water.' });
    expect(look.json.senses[look.json.bestIndex].definition).toMatch(/slop|water|river/i);
    const save = await call(u, 'POST', '/api/vocab/my', { word: look.json.lemma, definition: look.json.senses[look.json.bestIndex].definition, context: 'Anna walked along the bank', source: 'reader' });
    expect(save.status).toBe(201);
    const fix = await call(u, 'PATCH', `/api/reader/docs/${doc.id}`, { correctedText: 'Corrected text.' });
    expect(fix.json.document.correctedText).toBe('Corrected text.');
    expect((await call(u, 'GET', `/api/media/${doc.imageFileId}`)).status).toBe(200);
  }, 60000);

  it('rejects unreadable images and non-image files with clear errors (and does not use up a scan)', async () => {
    const u = await registerUser();
    const blank = await upload(u, 'blank.png', 'image/png');
    expect(blank.statusCode).toBe(422);
    expect(blank.json().error.message).toMatch(/could not find readable English text/);
    fs.writeFileSync(path.join(__dirname, 'fixtures', 'not-image.jpg'), 'hello this is text');
    const bad = await upload(u, 'not-image.jpg', 'image/jpeg');
    expect(bad.statusCode).toBe(400);
    const me = await call(u, 'GET', '/api/auth/me');
    expect(me.json.me.usage.ocr_scan ?? 0).toBe(0);
  }, 60000);
});
