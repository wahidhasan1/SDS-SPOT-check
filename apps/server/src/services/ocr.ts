import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { config } from '../config';
import { HttpError } from '../lib/errors';

export interface OcrWord {
  text: string;
  conf: number;
}
export interface OcrResult {
  text: string;
  confidence: number; // mean word confidence 0-100
  lowConfidenceWords: OcrWord[];
  wordCount: number;
  imageMeta: { width: number; height: number; format: string };
  warnings: string[];
}

function run(cmd: string, args: string[], timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const t = setTimeout(() => {
      p.kill('SIGKILL');
      reject(new Error('OCR timed out'));
    }, timeoutMs);
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
    p.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) resolve(out);
      else reject(new Error(err || `exit ${code}`));
    });
  });
}

/**
 * Self-hosted OCR: images are normalised with sharp (EXIF rotation, greyscale, contrast,
 * upscaling small photos) and read by the Tesseract engine. Images are processed in a
 * temporary directory and deleted immediately; only the extracted text is stored.
 */
export async function ocrImage(buf: Buffer): Promise<OcrResult> {
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    throw new HttpError(400, 'invalid_image', 'That file is not a supported image. Upload a JPG, PNG, WEBP or HEIC photo.');
  }
  if (!meta.width || !meta.height) throw new HttpError(400, 'invalid_image', 'Could not read the image dimensions.');
  if (meta.width * meta.height > 60_000_000) throw new HttpError(400, 'image_too_large', 'The image resolution is too large.');
  const warnings: string[] = [];
  const minSide = Math.min(meta.width, meta.height);
  if (minSide < 500) warnings.push('The photo is quite small, so some words may be misread. Try moving closer to the page.');
  const targetWidth = Math.max(1600, Math.min(meta.width, 3000));
  const processed = await sharp(buf)
    .rotate()
    .resize({ width: targetWidth, withoutEnlargement: false })
    .greyscale()
    .normalise()
    .sharpen()
    .png()
    .toBuffer();
  const dir = await mkdtemp(join(tmpdir(), 'ocr-'));
  try {
    const file = join(dir, 'page.png');
    await writeFile(file, processed);
    let tsv: string;
    try {
      tsv = await run(config.tesseractPath, [file, 'stdout', '-l', 'eng', '--psm', '3', 'tsv']);
    } catch (e) {
      if ((e as any)?.code === 'ENOENT') throw new HttpError(503, 'not_configured', 'The OCR engine (tesseract) is not installed on the server.');
      throw new HttpError(502, 'ocr_failed', 'Text recognition failed for this image. Try a clearer, well-lit photo.');
    }
    return parseTsv(tsv, { width: meta.width, height: meta.height, format: meta.format ?? 'unknown' }, warnings);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function parseTsv(tsv: string, imageMeta: OcrResult['imageMeta'], warnings: string[]): OcrResult {
  const rows = tsv.split('\n').slice(1).map((l) => l.split('\t'));
  // Group words into lines, then decide paragraph breaks: a new block always breaks; a new
  // Tesseract paragraph breaks only if the previous line ended a sentence (photos often split mid-sentence).
  const lines: { key: string; block: string; par: string; words: string[] }[] = [];
  const words: OcrWord[] = [];
  for (const r of rows) {
    if (r.length < 12 || r[0] !== '5') continue;
    const text = r[11]?.trim();
    if (!text) continue;
    const key = `${r[2]}-${r[3]}-${r[4]}`;
    let line = lines[lines.length - 1];
    if (!line || line.key !== key) {
      line = { key, block: r[2], par: `${r[2]}-${r[3]}`, words: [] };
      lines.push(line);
    }
    line.words.push(text);
    words.push({ text, conf: Number(r[10]) });
  }
  let text = '';
  lines.forEach((l, i) => {
    const s = l.words.join(' ');
    if (i === 0) {
      text = s;
      return;
    }
    const prev = lines[i - 1];
    const prevText = prev.words.join(' ');
    const newPara = l.block !== prev.block || (l.par !== prev.par && /[.!?:"”’]$/.test(prevText));
    if (newPara) text += '\n\n' + s;
    else if (/[A-Za-z]-$/.test(text)) text = text.slice(0, -1) + s; // re-join hyphenated words
    else text += ' ' + s;
  });
  text = text.trim();
  const confidence = words.length ? Math.round((words.reduce((a, w) => a + w.conf, 0) / words.length) * 10) / 10 : 0;
  if (words.length === 0) warnings.push('No text was found. Make sure the page fills the photo and is in focus.');
  else if (confidence < 60) warnings.push('Recognition confidence is low. Check underlined words and correct any mistakes.');
  return {
    text,
    confidence,
    lowConfidenceWords: words.filter((w) => w.conf < 60 && /[a-z]/i.test(w.text)).slice(0, 200),
    wordCount: words.length,
    imageMeta,
    warnings,
  };
}
