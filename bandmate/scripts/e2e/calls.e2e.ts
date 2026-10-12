// REAL two-user voice call test.
// Two separate Chromium instances (separate devices) each feed a different spoken sentence into their
// microphone. Each side records the audio it receives from the other over WebRTC, and our own speech
// recogniser transcribes it. The test passes only if each user actually hears the other.
//
// Usage: npx tsx scripts/e2e/calls.e2e.ts   (needs ./download-models.sh and `npx vite build`)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Page } from 'playwright'
import { createUser, launch, sleep, startServer, step, until, type TestUser } from './harness.ts'
import { encodeMp3, synth, type VoiceId } from '../../server/services/tts.ts'
import { decodeAudio, transcribe } from '../../server/services/asr.ts'
import { spawnSync } from 'node:child_process'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-call-'))

async function voiceWav(text: string, voice: VoiceId, file: string) {
  const a = synth(text, voice, 0.95)
  const pad = new Float32Array(a.sampleRate) // 1 s silence between loops
  const both = new Float32Array(a.samples.length + pad.length)
  both.set(a.samples)
  const mp3 = file.replace('.wav', '.mp3')
  await encodeMp3(both, a.sampleRate, mp3)
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', file])
  return file
}

const SPEECH_A = 'Hello partner, this is speaker one. I love blue mountains and quiet rivers.'
const SPEECH_B = 'Good morning, I am speaker two. I enjoy cooking pasta and playing football.'
const KEY_A = ['mountains', 'rivers', 'blue']
const KEY_B = ['pasta', 'football', 'cooking']

type CallWin = { __call: { debugRecordRemote(ms: number): Promise<string>; debugInfo(): { micActive: boolean; pc: string | null; hasRemote: boolean } }; __socket: { drop(): void } }

async function heard(page: Page, ms: number) {
  const dataUrl = await page.evaluate((m) => (window as unknown as CallWin).__call.debugRecordRemote(m), ms)
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64')
  const pcm = await decodeAudio(buf)
  let peak = 0
  for (const v of pcm) peak = Math.max(peak, Math.abs(v))
  const r = await transcribe(pcm)
  return { text: r.text.toLowerCase(), peak }
}

const hasAll = (text: string, keys: string[]) => keys.filter((k) => text.includes(k)).length >= 2

async function startCall(u: TestUser, opts: { firstTime?: boolean } = {}) {
  await u.page.goto('/speak/call')
  if (opts.firstTime) await u.page.getByText('I’ll follow the').click()
  await u.page.getByRole('button', { name: 'Start call' }).click()
}

async function connected(u: TestUser) {
  try {
    await u.page.getByText('Connected', { exact: true }).waitFor({ timeout: 30_000 })
  } catch (e) {
    const st = await u.page.evaluate(() => {
      const c = (window as unknown as { __call: { state: Record<string, unknown>; debugInfo(): unknown } }).__call
      return { phase: c.state.phase, error: c.state.error, session: c.state.sessionId, info: c.debugInfo() }
    })
    throw new Error(`not connected: ${JSON.stringify(st)}`)
  }
}

const main = async () => {
  console.log('Preparing two different voices for the two microphones…')
  const wavA = await voiceWav(SPEECH_A, 'gb_female', path.join(tmp, 'a.wav'))
  const wavB = await voiceWav(SPEECH_B, 'us_male', path.join(tmp, 'b.wav'))
  const server = await startServer()
  const db = new DatabaseSync(server.dbPath)
  // Short reconnection grace so the "partner left" path is quick to test, and a short recent-partner
  // window so that in the block test below only the block can keep these two users apart.
  db.exec(`INSERT INTO app_config (key, value) VALUES ('matching', '{"reconnectGraceSec":8,"recentAvoidSec":3}')`)
  const browserA = await launch({ audioFile: wavA })
  const browserB = await launch({ audioFile: wavB })
  let failed = false
  try {
    const A = await createUser(browserA, server, { name: 'Alice' })
    const B = await createUser(browserB, server, { name: 'Bob' })
    const meA = await (await A.context.request.get('/api/me')).json()
    const meB = await (await B.context.request.get('/api/me')).json()
    step(`Two real accounts: ${meA.profile.anonName} (${meA.profile.cefrLevel}) and ${meB.profile.anonName} (${meB.profile.cefrLevel})`)

    // ---- Match and connect
    await startCall(A, { firstTime: true })
    await A.page.getByText('Finding your speaking partner…').waitFor()
    await A.page.getByText('No one else is searching right now').waitFor()
    step('User A is searching (honest "no one else is searching" state, no fake users)')
    await startCall(B, { firstTime: true })
    await Promise.all([connected(A), connected(B)])
    const nameSeenByA = await A.page.getByTestId('partner-name').innerText()
    const nameSeenByB = await B.page.getByTestId('partner-name').innerText()
    if (nameSeenByA !== meB.profile.anonName || nameSeenByB !== meA.profile.anonName) throw new Error(`wrong partner names: ${nameSeenByA} / ${nameSeenByB}`)
    for (const [u, other] of [[A, meB], [B, meA]] as const) {
      const html = await u.page.content()
      if (html.includes(other.email) || html.includes(other.profile.displayName)) throw new Error('partner private data visible on call screen')
    }
    step('Matched each other; each sees only the other’s anonymous name and level (no email or real name)')
    const sessions = db.prepare("SELECT COUNT(*) AS n FROM call_sessions WHERE status <> 'ended'").get() as { n: number }
    if (sessions.n !== 1) throw new Error(`expected 1 live session, got ${sessions.n}`)
    step('Exactly one call session was created on the server')

    // ---- Real audio in both directions
    const [hA, hB] = await Promise.all([heard(A.page, 9000), heard(B.page, 9000)])
    console.log(`     A heard: “${hA.text}”\n     B heard: “${hB.text}”`)
    if (!hasAll(hA.text, KEY_B)) throw new Error('User A did not hear user B')
    if (!hasAll(hB.text, KEY_A)) throw new Error('User B did not hear user A')
    step('Two-way audio verified: each user’s speech was received and transcribed on the other side')

    // ---- Mute
    await A.page.getByRole('button', { name: 'Mute microphone' }).click()
    await B.page.getByLabel('Partner is muted').waitFor()
    await sleep(800) // let audio already in flight (jitter buffer) drain
    const muted = await heard(B.page, 5000)
    if (hasAll(muted.text, KEY_A) || muted.peak > 0.02) throw new Error(`B still hears A while muted (peak ${muted.peak.toFixed(3)}, “${muted.text}”)`)
    step(`Mute works: partner sees the muted icon and receives silence (peak level ${muted.peak.toFixed(4)})`)
    await A.page.getByRole('button', { name: 'Unmute microphone' }).click()
    const unmuted = await heard(B.page, 8000)
    if (!hasAll(unmuted.text, KEY_A)) throw new Error('B cannot hear A after unmute')
    step('Unmute restores audio')

    // ---- Shared prompts
    const counterB = B.page.getByText(/^\d+ \/ \d+$/)
    const before = await counterB.innerText()
    await A.page.getByRole('button', { name: /Next question/ }).click()
    await until(async () => (await counterB.innerText()) !== before, 'prompt sync')
    step(`Conversation prompts stay in sync for both users (${before} → ${await counterB.innerText()})`)

    // ---- Network drop and recovery (B's socket drops; WebRTC is renegotiated)
    await B.page.evaluate(() => (window as unknown as CallWin).__socket.drop())
    await A.page.getByText(/partner’s connection dropped|Partner reconnecting/).first().waitFor({ timeout: 8000 })
    await until(async () => (await B.page.evaluate(() => (window as unknown as CallWin).__call.debugInfo())).pc === 'connected' && !(await A.page.getByText(/partner’s connection dropped/).count()), 'call recovery', 20_000)
    await sleep(1500)
    const recovered = await heard(A.page, 8000)
    if (!hasAll(recovered.text, KEY_B)) throw new Error('No audio after reconnection: ' + recovered.text)
    step('Connection drop handled: partner saw “reconnecting”, the call recovered and audio flows again')

    // ---- End call
    await B.page.getByRole('button', { name: 'End call' }).click()
    await A.page.getByTestId('end-reason').waitFor()
    const reasonA = await A.page.getByTestId('end-reason').innerText()
    const reasonB = await B.page.getByTestId('end-reason').innerText()
    if (!reasonA.includes('Your partner ended') || !reasonB.includes('You ended')) throw new Error(`bad end reasons: ${reasonA} / ${reasonB}`)
    for (const u of [A, B]) {
      const info = await u.page.evaluate(() => (window as unknown as CallWin).__call.debugInfo())
      if (info.micActive || info.pc || info.hasRemote) throw new Error('media not released: ' + JSON.stringify(info))
      if (await u.page.locator('audio[data-role="remote-audio"]').count()) throw new Error('remote audio element left behind')
    }
    step('Either user can end: both see the right summary, microphone and connection are released')
    const histA = await (await A.context.request.get('/api/calls/history')).json()
    const histB = await (await B.context.request.get('/api/calls/history')).json()
    if (histA.length !== 1 || histB.length !== 1 || !histA[0].connected || histA[0].durationS < 20 || histA[0].id !== histB[0].id) throw new Error('history wrong: ' + JSON.stringify(histA))
    step(`Call history updated for both (duration ${histA[0].durationS}s, ended by ${histA[0].endedBy} for A)`)

    // ---- Feedback
    await A.page.getByRole('button', { name: 'Clear speaker' }).click()
    await A.page.getByRole('radio', { name: '5 stars' }).click()
    await A.page.getByRole('button', { name: 'Save feedback' }).click()
    await A.page.getByText('Feedback saved').waitFor()
    const detailB = await (await B.context.request.get(`/api/calls/${histB[0].id}`)).json()
    if (!detailB.partnerTags.includes('Clear speaker')) throw new Error('partner tags not visible to B')
    step('Post-call feedback saved; partner sees the positive tag anonymously')

    // ---- Cancel matching
    await A.page.getByRole('button', { name: 'Find another partner' }).click()
    await A.page.getByText('Finding your speaking partner…').waitFor()
    await A.page.getByRole('button', { name: 'Cancel' }).click()
    await A.page.getByRole('button', { name: 'Start call' }).waitFor()
    if (!(await until(async () => (await (await A.context.request.get('/api/calls/status')).json()).searchingNow.casual === 0, 'queue empty after cancel'))) throw new Error('still queued')
    step('Matching can be cancelled; the user leaves the queue and the microphone is released')

    // ---- Block prevents matching
    await A.page.goto(`/speak/history/${histA[0].id}`)
    const blockRes = await A.context.request.post(`/api/calls/${histA[0].id}/block`)
    if (!blockRes.ok()) throw new Error('block failed')
    await Promise.all([startCall(A), startCall(B)])
    await sleep(12_000)
    if (!(await A.page.getByText('Finding your speaking partner…').isVisible()) || !(await B.page.getByText('Finding your speaking partner…').isVisible())) throw new Error('blocked users were matched')
    await A.page.getByRole('button', { name: 'Cancel' }).click()
    await B.page.getByRole('button', { name: 'Cancel' }).click()
    step('Blocked users are never matched (both searched for 12 s; without the block they would match after 3 s)')

    // ---- Report creates a record
    const rep = await (await A.context.request.post(`/api/calls/${histA[0].id}/report`, { data: { reason: 'spam', details: 'test report', block: true } })).json()
    const row = db.prepare('SELECT reason, status FROM reports').get() as { reason: string; status: string } | undefined
    if (!row || row.reason !== 'spam' || rep.alreadyReported) throw new Error('report not stored')
    step('Reporting creates a moderation record')
    await A.context.request.delete(`/api/calls/${histA[0].id}/block`)

    // ---- Partner leaves unexpectedly (closes the app) → call ends for the other user after the grace period
    await Promise.all([startCall(A), startCall(B)])
    await Promise.all([connected(A), connected(B)])
    await B.page.close()
    await A.page.getByText(/partner’s connection dropped/).waitFor({ timeout: 10_000 })
    await A.page.getByTestId('end-reason').waitFor({ timeout: 20_000 })
    const leftReason = await A.page.getByTestId('end-reason').innerText()
    if (!leftReason.includes('lost their connection')) throw new Error('bad reason: ' + leftReason)
    step('Partner closing the app unexpectedly: the other user sees “reconnecting”, then a clear ended state (not stuck)')
    B.page = await B.context.newPage()
    await B.page.goto('/')

    // ---- Daily limit enforced on the server
    db.exec(`UPDATE plans SET limits = json_set(limits, '$.callsPerDay', 2) WHERE id = 'free'`)
    await A.page.getByRole('button', { name: 'Find another partner' }).click()
    await A.page.getByText(/used all your voice calls/).waitFor({ timeout: 10_000 })
    // Bypassing the UI doesn't help: the socket request is refused too.
    const direct = await A.page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const ws = new WebSocket(`ws://${location.host}/ws`)
          ws.onmessage = (e) => {
            const m = JSON.parse(e.data)
            if (m.t === 'hello') ws.send(JSON.stringify({ t: 'match.start', mode: 'casual', topic: 'random' }))
            if (m.t === 'error') resolve(m.code)
          }
        }),
    )
    if (direct !== 'limit_reached') throw new Error('server did not enforce limit: ' + direct)
    step('Free plan call limit is enforced by the server (UI and a hand-made socket request are both refused)')
    db.exec(`UPDATE plans SET limits = json_set(limits, '$.callsPerDay', 3) WHERE id = 'free'`)

    // ---- Microphone denied: a separate browser where the user refuses microphone access
    const browserC = await launch({ noFakeUi: true })
    const C = await createUser(browserC, server, { name: 'Cara', micPermission: false })
    await startCall(C, { firstTime: true })
    await C.page.getByText('Microphone problem').waitFor({ timeout: 10_000 })
    await C.page.getByText(/Microphone access was blocked|No microphone was found/).waitFor()
    if ((await (await C.context.request.get('/api/calls/status')).json()).searchingNow.casual !== 0) throw new Error('user without mic was queued')
    await browserC.close()
    step('Microphone permission denied: clear guidance is shown and the user is not put in the queue')

    const errs = [...A.errors, ...B.errors]
    if (errs.length) throw new Error('Page errors: ' + errs.join(' | '))
    console.log('\nREAL CALL TEST PASSED')
  } catch (e) {
    failed = true
    console.error('\nFAILED:', (e as Error).message)
    console.error(server.logs.slice(-15).join(''))
  } finally {
    await browserA.close()
    await browserB.close()
    db.close()
    await server.stop()
  }
  process.exit(failed ? 1 : 0)
}

await main()
