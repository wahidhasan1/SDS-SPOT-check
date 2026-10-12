import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { env } from '../env.ts'

const require = createRequire(import.meta.url)
type Sherpa = typeof import('sherpa-onnx-node')

/**
 * Offline neural text-to-speech (Piper voices via sherpa-onnx). Used to render listening tests,
 * placement listening items and word pronunciations. All voices are licensed for commercial use.
 */
export const VOICES = {
  // British
  gb_female: { dir: 'vits-piper-en_GB-alba-medium', file: 'en_GB-alba-medium.onnx', sid: 0, label: 'British female (Alba)' },
  gb_female2: { dir: 'vits-piper-en_GB-cori-medium', file: 'en_GB-cori-medium.onnx', sid: 0, label: 'British female (Cori)' },
  gb_male: { dir: 'vits-piper-en_GB-northern_english_male-medium', file: 'en_GB-northern_english_male-medium.onnx', sid: 0, label: 'Northern English male' },
  // North American (LibriTTS-R multi-speaker; speaker ids chosen for clarity, see scripts/pick-voices.ts)
  // Measured with scripts/pick-voices.ts: all transcribe perfectly; pitch ~214/216 Hz (female), ~106/113 Hz (male).
  us_female: { dir: 'vits-piper-en_US-libritts_r-medium', file: 'en_US-libritts_r-medium.onnx', sid: 14, label: 'American female' },
  us_female2: { dir: 'vits-piper-en_US-libritts_r-medium', file: 'en_US-libritts_r-medium.onnx', sid: 9, label: 'American female 2' },
  us_male: { dir: 'vits-piper-en_US-libritts_r-medium', file: 'en_US-libritts_r-medium.onnx', sid: 3, label: 'American male' },
  us_male2: { dir: 'vits-piper-en_US-libritts_r-medium', file: 'en_US-libritts_r-medium.onnx', sid: 21, label: 'American male 2' },
} as const
export type VoiceId = keyof typeof VOICES

const engines = new Map<string, InstanceType<Sherpa['OfflineTts']>>()

function engine(voice: VoiceId) {
  const v = VOICES[voice]
  const dir = path.join(env.modelsDir, v.dir)
  let e = engines.get(v.dir)
  if (!e) {
    if (!fs.existsSync(path.join(dir, v.file))) throw new Error(`Voice model missing: run ./download-models.sh (${v.dir})`)
    const sherpa = require('sherpa-onnx-node') as Sherpa
    e = new sherpa.OfflineTts({
      model: { vits: { model: path.join(dir, v.file), tokens: path.join(dir, 'tokens.txt'), dataDir: path.join(dir, 'espeak-ng-data') }, numThreads: 2, provider: 'cpu', debug: false },
      maxNumSentences: 2,
    })
    engines.set(v.dir, e)
  }
  return { tts: e, sid: v.sid }
}

/** Overrides speaker ids (used when re-picking LibriTTS speakers). */
export const voiceOverride = new Map<VoiceId, number>()

export function synth(text: string, voice: VoiceId, speed = 1): { samples: Float32Array; sampleRate: number } {
  const { tts, sid } = engine(voice)
  const out = tts.generate({ text, sid: voiceOverride.get(voice) ?? sid, speed })
  return { samples: out.samples, sampleRate: out.sampleRate }
}

export type Segment = { voice: VoiceId; text: string; pauseAfter?: number; speed?: number }

/** Renders several speakers into one track with natural pauses between turns. */
export function renderDialogue(segments: Segment[], opts: { leadIn?: number } = {}) {
  const parts: Float32Array[] = []
  let rate = 22050
  const silence = (sec: number) => new Float32Array(Math.round(sec * rate))
  parts.push(silence(opts.leadIn ?? 0.4))
  const marks: { start: number; end: number; voice: VoiceId; text: string }[] = []
  let cursor = opts.leadIn ?? 0.4
  for (const s of segments) {
    const a = synth(s.text, s.voice, s.speed ?? 0.95)
    rate = a.sampleRate
    parts.push(a.samples)
    const dur = a.samples.length / rate
    marks.push({ start: cursor, end: cursor + dur, voice: s.voice, text: s.text })
    cursor += dur
    const pause = s.pauseAfter ?? 0.55
    parts.push(silence(pause))
    cursor += pause
  }
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Float32Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  // Peak-normalise to -1 dBFS so all tracks play at a similar volume.
  let peak = 0
  for (const v of out) peak = Math.max(peak, Math.abs(v))
  if (peak > 0) {
    const g = 0.89 / peak
    for (let i = 0; i < out.length; i++) out[i] *= g
  }
  return { samples: out, sampleRate: rate, duration: total / rate, marks }
}

/** Encodes float samples to MP3 (mono, 64 kbps) with ffmpeg. */
export function encodeMp3(samples: Float32Array, sampleRate: number, file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  return new Promise<void>((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', String(sampleRate), '-ac', '1', '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', '64k', file])
    let errText = ''
    ff.stderr.on('data', (d) => (errText += d))
    ff.on('error', reject)
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${errText}`))))
    ff.stdin.end(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength))
  })
}

/** Pronunciation audio for a single word or phrase, cached on disk. */
export async function wordAudio(word: string, accent: 'us' | 'gb' = 'gb') {
  const safe = word.toLowerCase().replace(/[^a-z' -]/g, '').trim().slice(0, 60)
  if (!safe) throw new Error('bad word')
  const file = path.join(env.root, 'data', 'cache', 'tts', accent, `${safe.replace(/[ ']/g, '_')}.mp3`)
  if (!fs.existsSync(file)) {
    const a = synth(safe, accent === 'us' ? 'us_female' : 'gb_female', 0.9)
    await encodeMp3(a.samples, a.sampleRate, file)
  }
  return file
}
