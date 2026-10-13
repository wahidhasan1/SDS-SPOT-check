// Renders all listening audio from the scripts in content/*.json with the offline voices.
// Output goes to public/audio (committed, so deployments don't need the voice models).
// Usage: npm run content:audio [-- --force] [-- --only=assessment|listening]
import fs from 'node:fs'
import path from 'node:path'
import { encodeMp3, renderDialogue, type Segment, type VoiceId } from '../server/services/tts.ts'

const root = path.resolve(import.meta.dirname, '..')
const force = process.argv.includes('--force')
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]
const outDir = path.join(root, 'public', 'audio')
const manifestFile = path.join(outDir, 'manifest.json')
const manifest: Record<string, { duration: number; chars: number }> = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {}

async function render(key: string, segments: Segment[]) {
  const file = path.join(outDir, `${key}.mp3`)
  const chars = segments.reduce((n, s) => n + s.text.length, 0)
  if (!force && fs.existsSync(file) && manifest[key]?.chars === chars) return
  const t = Date.now()
  const d = renderDialogue(segments)
  await encodeMp3(d.samples, d.sampleRate, file)
  manifest[key] = { duration: +d.duration.toFixed(2), chars }
  console.log(`✓ ${key}.mp3  ${d.duration.toFixed(1)}s  (${((Date.now() - t) / 1000).toFixed(1)}s)`)
}

const ROTATION: VoiceId[] = ['gb_female', 'us_male', 'gb_male', 'us_female', 'gb_female2', 'us_male2']

if (!only || only === 'assessment') {
  const a = JSON.parse(fs.readFileSync(path.join(root, 'content', 'assessment.json'), 'utf8')) as { items: { id: string; section: string; script?: string }[] }
  let i = 0
  for (const it of a.items.filter((x) => x.section === 'listening' && x.script)) {
    await render(`assessment/${it.id}`, [{ voice: ROTATION[i++ % ROTATION.length], text: it.script!, speed: 0.92 }])
  }
}

if (!only || only === 'listening') {
  const file = path.join(root, 'content', 'listening.json')
  if (fs.existsSync(file)) {
    const tests = JSON.parse(fs.readFileSync(file, 'utf8')) as { id: string; parts: { id: string; speakers: Record<string, VoiceId>; script: { s: string; text: string; pause?: number }[] }[] }[]
    for (const t of tests)
      for (const p of t.parts) {
        await render(`listening/${p.id}`, p.script.map((line) => ({ voice: p.speakers[line.s], text: line.text, pauseAfter: line.pause ?? 0.6, speed: 0.93 })))
      }
  }
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1))
console.log('Audio manifest written.')
