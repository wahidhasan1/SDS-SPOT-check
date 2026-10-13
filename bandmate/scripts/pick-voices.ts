// Picks clear LibriTTS-R speakers for the "American" voices: synthesises a test sentence per speaker,
// checks intelligibility with our own Whisper recogniser, and estimates pitch to tell female/male voices apart.
// Usage: npx tsx scripts/pick-voices.ts [count]
import { synth, voiceOverride } from '../server/services/tts.ts'
import { transcribe } from '../server/services/asr.ts'
import { wordsOf } from '../server/lib/util.ts'

const SENTENCE = 'The library opens at nine thirty on weekdays, and the science museum is next to the railway station.'

function pitch(samples: Float32Array, rate: number) {
  // Autocorrelation F0 estimate over voiced frames, median of frames.
  const f0s: number[] = []
  const frame = Math.round(rate * 0.04)
  for (let s = 0; s + frame < samples.length; s += frame) {
    const x = samples.subarray(s, s + frame)
    let energy = 0
    for (const v of x) energy += v * v
    if (energy / frame < 1e-4) continue
    let best = 0
    let bestLag = 0
    for (let lag = Math.round(rate / 400); lag < Math.round(rate / 70); lag++) {
      let c = 0
      for (let i = 0; i + lag < x.length; i++) c += x[i] * x[i + lag]
      if (c > best) {
        best = c
        bestLag = lag
      }
    }
    if (bestLag) f0s.push(rate / bestLag)
  }
  f0s.sort((a, b) => a - b)
  return f0s[Math.floor(f0s.length / 2)] ?? 0
}

function resample(x: Float32Array, from: number, to: number) {
  const out = new Float32Array(Math.floor((x.length * to) / from))
  for (let i = 0; i < out.length; i++) {
    const p = (i * from) / to
    const j = Math.floor(p)
    out[i] = x[j] + (x[Math.min(j + 1, x.length - 1)] - x[j]) * (p - j)
  }
  return out
}

const target = wordsOf(SENTENCE.toLowerCase())
const n = Number(process.argv[2] ?? 40)
const rows: { sid: number; f0: number; wer: number; text: string }[] = []
for (let sid = 0; sid < n; sid++) {
  voiceOverride.set('us_female', sid)
  const a = synth(SENTENCE, 'us_female', 0.95)
  const r = await transcribe(resample(a.samples, a.sampleRate, 16000))
  const got = new Set(wordsOf(r.text.toLowerCase()))
  const wer = target.filter((w) => !got.has(w)).length / target.length
  rows.push({ sid, f0: Math.round(pitch(a.samples, a.sampleRate)), wer: +wer.toFixed(2), text: r.text })
}
rows.sort((a, b) => a.wer - b.wer || a.sid - b.sid)
for (const r of rows) console.log(String(r.sid).padStart(3), `${r.f0}Hz`.padStart(6), `wer ${r.wer}`, r.f0 > 165 ? 'female?' : 'male?', '|', r.text)
