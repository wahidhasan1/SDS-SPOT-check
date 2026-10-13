import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { createWorker, type Worker } from 'tesseract.js';
import { badRequest } from '../lib/errors';

/**
 * Optical character recognition with tesseract.js running on the server, using the bundled English
 * model from @tesseract.js-data/eng (no external service or network access needed).
 */
const require = createRequire(import.meta.url);
const LANG_PATH = path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');

let workerPromise: Promise<Worker> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function getWorker() {
  workerPromise ??= createWorker('eng', 1, { langPath: LANG_PATH, gzip: true, cacheMethod: 'none' });
  return workerPromise;
}

export interface OcrResult {
  text: string;
  confidence: number;
  words: number;
  width: number;
  height: number;
}

/** Normalise the photo (EXIF rotation, greyscale, size) to help recognition. */
async function prepare(buffer: Buffer) {
  try {
    const img = sharp(buffer, { failOn: 'error' }).rotate();
    const meta = await img.metadata();
    if (!meta.width || !meta.height) throw new Error('no size');
    if (meta.width < 200 || meta.height < 200) throw badRequest('This image is too small to read. Please use a photo at least 200×200 pixels.');
    const long = Math.max(meta.width, meta.height);
    const scale = long > 3000 ? 3000 / long : long < 1200 ? 1200 / long : 1;
    const out = await img
      .resize(Math.round(meta.width * scale), Math.round(meta.height * scale))
      .greyscale()
      .normalise()
      .png()
      .toBuffer({ resolveWithObject: true });
    return { data: out.data, width: out.info.width, height: out.info.height };
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode) throw err;
    throw badRequest('We could not open this image. Please upload a JPEG, PNG or WebP photo.');
  }
}

/** Clean up OCR output: join hyphenated line breaks and lines within paragraphs. */
export function tidyText(raw: string) {
  return raw
    .replace(/\r/g, '')
    .replace(/-\n(?=[a-z])/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

export async function recognise(buffer: Buffer): Promise<OcrResult> {
  const img = await prepare(buffer);
  const job = queue.then(async () => {
    const worker = await getWorker();
    const { data } = await worker.recognize(img.data);
    return data;
  });
  queue = job.catch(() => undefined);
  const data = await job;
  const text = tidyText(data.text ?? '');
  const words = (text.match(/[A-Za-z]{2,}/g) ?? []).length;
  return { text, confidence: Math.round(data.confidence ?? 0), words, width: img.width, height: img.height };
}
