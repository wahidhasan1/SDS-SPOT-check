import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { env } from '../env.ts'
import { asrModelDir, asrReady } from './features.ts'
import { HttpError } from '../lib/util.ts'

const require = createRequire(import.meta.url)
type Sherpa = typeof import('sherpa-onnx-node')

/**
 * Offline speech recognition: Whisper base.en (MIT) via sherpa-onnx, with Silero VAD to split long answers
 * into <30 s chunks. Audio never leaves our server and is discarded after transcription.
 */
let recognizer: InstanceType<Sherpa['OfflineRecognizer']> | null = null
const SAMPLE_RATE = 16000

function getRecognizer() {
  if (!asrReady()) throw new HttpError(503, 'not_configured', 'Speech recognition is not set up on this server (run ./download-models.sh).')
  if (!recognizer) {
    const sherpa = require('sherpa-onnx-node') as Sherpa
    const dir = asrModelDir()
    recognizer = new sherpa.OfflineRecognizer({
      featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
      modelConfig: {
        whisper: { encoder: path.join(dir, 'base.en-encoder.int8.onnx'), decoder: path.join(dir, 'base.en-decoder.int8.onnx'), language: 'en', task: 'transcribe', tailPaddings: -1 },
        tokens: path.join(dir, 'base.en-tokens.txt'),
        numThreads: 2,
        provider: 'cpu',
        debug: 0,
      },
    })
  }
  return recognizer
}

/** Decodes any browser recording (webm/ogg/mp4/wav) to 16 kHz mono float PCM. */
export function decodeAudio(input: Buffer, maxSeconds = 330): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-t', String(maxSeconds), '-f', 'f32le', '-ac', '1', '-ar', String(SAMPLE_RATE), 'pipe:1'])
    const chunks: Buffer[] = []
    let err = ''
    ff.stdout.on('data', (d) => chunks.push(d))
    ff.stderr.on('data', (d) => (err += d))
    ff.on('error', reject)
    ff.on('close', (code) => {
      if (code !== 0) return reject(new HttpError(400, 'bad_audio', 'We could not read that recording. Please try recording again.'))
      const buf = Buffer.concat(chunks)
      const copy = new Float32Array(buf.byteLength / 4)
      new Uint8Array(copy.buffer).set(buf)
      resolve(copy)
    })
    ff.stdin.on('error', () => undefined)
    ff.stdin.end(input)
    void err
  })
}

export type SpeechSegment = { start: number; end: number; text: string }

function vadSegments(samples: Float32Array) {
  const sherpa = require('sherpa-onnx-node') as Sherpa
  const model = path.join(env.modelsDir, 'silero_vad.onnx')
  if (!fs.existsSync(model)) return [{ start: 0, samples }]
  const vad = new sherpa.Vad(
    { sileroVad: { model, threshold: 0.45, minSilenceDuration: 0.3, minSpeechDuration: 0.2, maxSpeechDuration: 25, windowSize: 512 }, sampleRate: SAMPLE_RATE, numThreads: 1, debug: false },
    Math.ceil(samples.length / SAMPLE_RATE) + 30,
  )
  const out: { start: number; samples: Float32Array }[] = []
  const drain = () => {
    while (!vad.isEmpty()) {
      const seg = vad.front(false)
      out.push({ start: seg.start, samples: new Float32Array(seg.samples) })
      vad.pop()
    }
  }
  for (let i = 0; i + 512 <= samples.length; i += 512) {
    vad.acceptWaveform(samples.subarray(i, i + 512))
    drain()
  }
  vad.flush()
  drain()
  return out
}

let chain: Promise<unknown> = Promise.resolve()
let pending = 0

/** Transcribes audio. Requests are processed one at a time to keep the CPU responsive. */
export function transcribe(samples: Float32Array): Promise<{ text: string; segments: SpeechSegment[]; duration: number; speechSeconds: number }> {
  if (pending >= 12) return Promise.reject(new HttpError(503, 'busy', 'Speech analysis is busy right now. Please try again in a minute.'))
  pending++
  const job = chain.then(async () => {
    try {
      const rec = getRecognizer()
      const segments: SpeechSegment[] = []
      for (const seg of vadSegments(samples)) {
        const stream = rec.createStream()
        stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples: seg.samples })
        await rec.decodeAsync(stream)
        const text = String(rec.getResult(stream).text ?? '').trim()
        const start = seg.start / SAMPLE_RATE
        if (text && !/^\[.*\]$|^\(.*\)$/.test(text)) segments.push({ start, end: start + seg.samples.length / SAMPLE_RATE, text })
      }
      return {
        text: segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim(),
        segments,
        duration: samples.length / SAMPLE_RATE,
        speechSeconds: segments.reduce((n, s) => n + (s.end - s.start), 0),
      }
    } finally {
      pending--
    }
  })
  chain = job.catch(() => undefined)
  return job
}
