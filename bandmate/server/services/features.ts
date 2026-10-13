import fs from 'node:fs'
import path from 'node:path'
import { env } from '../env.ts'

let ltCache: { ok: boolean; at: number } | null = null

/** Is the LanguageTool grammar server reachable? Cached for a minute. */
export async function languageToolUp() {
  if (ltCache && Date.now() - ltCache.at < 60_000) return ltCache.ok
  let ok = false
  try {
    const r = await fetch(`${env.languageToolUrl}/v2/languages`, { signal: AbortSignal.timeout(1500) })
    ok = r.ok
  } catch {
    ok = false
  }
  ltCache = { ok, at: Date.now() }
  return ok
}

export const asrModelDir = () => path.join(env.modelsDir, 'sherpa-onnx-whisper-base.en')
export const asrReady = () => fs.existsSync(path.join(asrModelDir(), 'base.en-encoder.int8.onnx'))
export const ttsVoiceDir = (voice: string) => path.join(env.modelsDir, voice)
export const ttsReady = () => fs.existsSync(ttsVoiceDir('vits-piper-en_GB-alba-medium'))

/** Which optional services are available. Shown in the UI so users see honest "not configured" states. */
export async function features() {
  return {
    calls: true,
    turn: !!(env.turnUrls.length && env.turnSecret),
    speechRecognition: asrReady(),
    wordAudio: ttsReady(),
    grammarCheck: await languageToolUp(),
    aiFeedback: !!env.anthropicKey,
    translation: !!env.anthropicKey,
    ocr: true,
    push: !!(env.vapidPublic && env.vapidPrivate),
    vapidPublicKey: env.vapidPublic || null,
    email: !!env.smtpUrl,
    payments: env.stripeSecret ? 'stripe' : env.testPayments ? 'test' : null,
  }
}
