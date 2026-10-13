// IELTS flows through the real UI against a real server:
// reading practice → review, listening audio playback, writing autosave/reload/submit/checks,
// speaking practice with a real voice fed into the microphone (on-server speech recognition),
// microphone released afterwards, and a complete mock test.
//
// Usage: npx tsx scripts/e2e/ielts.e2e.ts [screenshot-dir]   (needs ./download-models.sh and `npx vite build`)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import type { Page } from 'playwright'
import { createUser, launch, startServer, step, until } from './harness.ts'
import { encodeMp3, synth } from '../../server/services/tts.ts'

const OUT = process.argv[2]
const shot = async (page: Page, name: string, fullPage = false) => {
  if (!OUT) return
  fs.mkdirSync(OUT, { recursive: true })
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage })
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-ielts-'))
const SPEECH = 'My hometown is a small city near the mountains. I like it because the air is clean and people are very friendly.'

// A spoken answer, looped by Chrome as the fake microphone input.
const a = synth(SPEECH, 'gb_female', 0.95)
const padded = new Float32Array(a.samples.length + a.sampleRate * 2)
padded.set(a.samples)
await encodeMp3(padded, a.sampleRate, path.join(tmp, 'answer.mp3'))
spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(tmp, 'answer.mp3'), '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', path.join(tmp, 'answer.wav')])

const server = await startServer()
const browser = await launch({ audioFile: path.join(tmp, 'answer.wav') })
let failed = false
try {
  const U = await createUser(browser, server, { name: 'Ielts', viewport: { width: 1280, height: 860 } })
  const p = U.page
  // Track every microphone stream the page opens so we can prove they are all released.
  await p.addInitScript(() => {
    const w = window as unknown as { __streams: MediaStream[] }
    w.__streams = []
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await orig(c)
      w.__streams.push(s)
      return s
    }
  })
  const confirm = (name: string) => p.getByRole('dialog').getByRole('button', { name, exact: true }).click()

  // ---------------------------------------------------------------- dashboard
  await p.goto('/ielts')
  await p.getByText('Recommended next').waitFor()
  await p.getByText('Not enough data yet').waitFor()
  await shot(p, 'i1-dashboard', true)
  step('dashboard shows real (empty) progress, no invented scores')

  // ---------------------------------------------------------------- reading practice → review
  await p.goto('/ielts/reading')
  await p.getByRole('button', { name: /Passage 1|Urban|bee/i }).first().click()
  await p.waitForURL(/\/ielts\/test\//)
  await p.getByRole('radio').first().waitFor()
  await shot(p, 'i2-reading-player')
  const radios = p.getByRole('radio')
  for (let i = 0; i < Math.min(await radios.count(), 12); i += 3) await radios.nth(i).click()
  const gaps = p.locator('input[id^="q-"]')
  for (let i = 0; i < (await gaps.count()); i++) await gaps.nth(i).fill('honey')
  await p.getByText('Saved', { exact: false }).first().waitFor({ timeout: 8000 }).catch(() => undefined)
  await p.getByRole('button', { name: 'Submit', exact: true }).click()
  await confirm('Submit')
  await p.waitForURL(/\/ielts\/review\//)
  await p.getByText('Your results').waitFor()
  await p.getByText('Bands are estimated for full 40-question tests only').waitFor()
  await shot(p, 'i3-reading-review', true)
  step('reading practice: answer, submit, review with explanations (no band for a single passage)')

  // ---------------------------------------------------------------- listening audio
  await p.goto('/ielts/listening')
  await p.getByRole('button', { name: /Part 1/ }).first().click()
  await p.waitForURL(/\/ielts\/test\//)
  const dur = await until(() => p.evaluate(() => document.querySelector('audio')?.duration || 0), 'audio metadata')
  await p.getByRole('button', { name: 'Play', exact: true }).click()
  await until(() => p.evaluate(() => (document.querySelector('audio')?.currentTime ?? 0) > 0.5), 'audio playing')
  await shot(p, 'i4-listening-player')
  await p.getByRole('button', { name: 'Pause', exact: true }).click()
  step(`listening part audio loads (${dur.toFixed(0)} s) and plays`)

  // ---------------------------------------------------------------- writing: autosave, reload, submit, checks
  await p.goto('/ielts/writing')
  await p.getByRole('button', { name: 'Start' }).nth(4).click() // first Task 2 essay
  await p.waitForURL(/\/ielts\/writing\/ws_/)
  const essay =
    'Many people believe that technology has made our lives easier, while others think it has created new problems. In my opinion, the benefits are greater than the drawbacks, although we must use it carefully.\n\n' +
    'Firstly, technology saves time. For example, online banking allows people to pay bills in minutes instead of waiting in long queues. Moreover, video calls help families stay in touch when they live in different countries. As a result, people can maintain close relationships despite the distance.\n\n' +
    'On the other hand, technology can cause stress. Many workers receive emails late at night, which means that they never fully relax. In addition, young people may spend too much time on social media and less time on exercise or reading. This could have a negative effect on their health and concentration.\n\n' +
    'In conclusion, although technology brings some problems, I believe it has improved our lives overall. Governments and schools should teach people how to use it in a balanced way so that everyone can enjoy its advantages.'
  const box = p.getByRole('textbox', { name: 'Your answer' })
  await box.fill(essay)
  await p.getByText(/^Saved \d/).waitFor({ timeout: 8000 })
  await p.reload()
  await until(async () => (await p.getByRole('textbox', { name: 'Your answer' }).inputValue()) === essay, 'essay restored after reload')
  await shot(p, 'i5-writing-editor')
  step('writing autosaves and survives a reload')
  await p.getByRole('button', { name: 'Submit for feedback' }).click()
  await confirm('Submit')
  await p.getByRole('heading', { name: 'Automatic checks' }).waitFor({ timeout: 30000 })
  await p.getByText(/AI feedback isn’t available on this server yet/).waitFor()
  await shot(p, 'i6-writing-feedback', true)
  step('writing submitted: automatic checks shown; AI feedback honestly reported as not configured')

  // ---------------------------------------------------------------- speaking practice with a real voice
  await p.goto('/speak/practice/part1/p1-hometown')
  await p.getByRole('button', { name: 'I agree, allow speech analysis' }).click()
  await p.getByRole('button', { name: 'Start recording' }).click()
  await p.getByText(/Recording ·/).waitFor()
  await p.waitForTimeout(9000)
  await shot(p, 'i7-speaking-recording')
  await p.getByRole('button', { name: 'Stop & analyse' }).click()
  await p.getByText('Transcript (automatic)').waitFor({ timeout: 60000 })
  const transcript = (await p.locator('text=Transcript (automatic)').locator('xpath=following-sibling::p[1]').textContent()) ?? ''
  if (!/hometown|mountains|friendly/i.test(transcript)) throw new Error(`unexpected transcript: ${transcript}`)
  await shot(p, 'i8-speaking-result', true)
  const live = await p.evaluate(() => (window as unknown as { __streams: MediaStream[] }).__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length)
  if (live) throw new Error(`${live} microphone track(s) still live after recording`)
  step(`speaking answer transcribed on the server ("${transcript.slice(0, 60)}…"); microphone released`)

  // ---------------------------------------------------------------- full mock test
  await p.goto('/ielts/mock')
  await p.getByRole('button', { name: 'Start mock test' }).first().click()
  await confirm('Start mock test')
  await p.waitForURL(/\/ielts\/mock\/mk_/)
  for (const s of ['Listening', 'Reading']) {
    await p.getByRole('button', { name: `Begin ${s}` }).click()
    await p.getByRole('button', { name: 'Submit', exact: true }).waitFor()
    if (s === 'Listening') await shot(p, 'i9-mock-listening')
    await p.getByRole('button', { name: 'Submit', exact: true }).click()
    await confirm('Submit')
  }
  await p.getByRole('button', { name: 'Begin Writing' }).click()
  await p.getByRole('textbox', { name: 'Your answer' }).first().fill('The graph shows internet access in three countries between 2000 and 2020. Overall, access rose everywhere.')
  await shot(p, 'i10-mock-writing')
  await p.getByRole('button', { name: 'Finish writing' }).click()
  await confirm('Finish writing')
  await p.getByRole('button', { name: 'Begin Speaking' }).click()
  await p.getByRole('button', { name: 'Start recording' }).click()
  await p.waitForTimeout(7000)
  await p.getByRole('button', { name: 'Stop & analyse' }).click()
  await p.getByText('question 2 of', { exact: false }).waitFor({ timeout: 60000 })
  step('mock speaking: first answer recorded and saved against the mock')
  await p.getByRole('button', { name: 'Finish speaking early' }).click()
  await confirm('Finish')
  await p.getByText('Mock test results').waitFor()
  await p.getByText('An overall band needs an estimate for all four skills').waitFor()
  await shot(p, 'i11-mock-results', true)
  step('mock test runs all four sections in order and reports honest results')

  if (U.errors.length) throw new Error(`page errors: ${U.errors.join(' | ')}`)
  step('no page errors')
} catch (e) {
  failed = true
  console.error('✗', e)
  console.error(server.logs.slice(-30).join(''))
} finally {
  await browser.close()
  await server.stop()
  fs.rmSync(tmp, { recursive: true, force: true })
}
process.exit(failed ? 1 : 0)
