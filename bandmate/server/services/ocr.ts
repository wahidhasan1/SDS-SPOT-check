import path from 'node:path'
import { createRequire } from 'node:module'
import sharp from 'sharp'
import { createWorker, type Worker } from 'tesseract.js'

/**
 * Offline OCR: Tesseract (via tesseract.js) with the English model shipped in @tesseract.js-data/eng.
 * Images are processed in memory and never written to disk or stored.
 */
const require = createRequire(import.meta.url)
const langPath = path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int')

let worker: Promise<Worker> | null = null
let chain: Promise<unknown> = Promise.resolve()

function getWorker() {
  worker ??= createWorker('eng', 1, { langPath, gzip: true, cacheMethod: 'none' })
  return worker
}

/** Normalises a phone photo for OCR: EXIF rotation, size, greyscale, contrast, mild sharpening. */
export async function preprocess(input: Buffer, rotate = 0) {
  const img = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 }).rotate() // EXIF orientation
  const rotated = rotate ? sharp(await img.toBuffer()).rotate(rotate) : img
  return rotated.resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).grayscale().normalise().sharpen().png().toBuffer()
}

export type OcrResult = { text: string; confidence: number; lowConfidenceWords: number; words: number }

export async function ocr(input: Buffer, opts: { rotate?: number; crop?: { x: number; y: number; w: number; h: number } } = {}): Promise<OcrResult> {
  let buf = input
  if (opts.crop) {
    // Crop is given as fractions (0–1) of the displayed image after EXIF rotation.
    const oriented = await sharp(input).rotate().toBuffer()
    const meta = await sharp(oriented).metadata()
    const W = meta.width ?? 0
    const H = meta.height ?? 0
    const left = Math.round(opts.crop.x * W)
    const top = Math.round(opts.crop.y * H)
    const width = Math.max(10, Math.min(W - left, Math.round(opts.crop.w * W)))
    const height = Math.max(10, Math.min(H - top, Math.round(opts.crop.h * H)))
    buf = await sharp(oriented).extract({ left, top, width, height }).toBuffer()
  }
  const png = await preprocess(buf, opts.rotate ?? 0)
  // One recognition at a time keeps memory predictable on small servers.
  const run = chain.then(async () => {
    const w = await getWorker()
    const { data } = await w.recognize(png, {}, { text: true, blocks: true })
    const words = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)))
    const text = data.text
      .replace(/[ \t]+\n/g, '\n')
      .replace(/-\n(?=[a-z])/g, '') // join words hyphenated across lines
      .replace(/([^\n])\n(?=[^\n])/g, '$1 ') // join lines within a paragraph
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return { text, confidence: Math.round(data.confidence), words: words.length, lowConfidenceWords: words.filter((x) => x.confidence < 60).length }
  })
  chain = run.catch(() => undefined)
  return run
}

export async function stopOcr() {
  if (worker) await (await worker).terminate()
  worker = null
}
