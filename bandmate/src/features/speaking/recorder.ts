import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'

export type RecState = 'idle' | 'requesting' | 'recording' | 'denied' | 'unsupported' | 'error'

const MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

/**
 * Microphone recording for speaking practice. The microphone is opened only while recording and
 * every track is stopped as soon as recording ends, is cancelled, or the component unmounts.
 */
export function useRecorder({ maxMs = 3 * 60_000 }: { maxMs?: number } = {}) {
  const [state, setState] = useState<RecState>(() => (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia ? 'unsupported' : 'idle'))
  const [elapsed, setElapsed] = useState(0)
  const [level, setLevel] = useState(0)
  const r = useRef<{ stream?: MediaStream; rec?: MediaRecorder; chunks: Blob[]; ctx?: AudioContext; raf?: number; timer?: number; started: number; resolve?: (b: Blob | null) => void }>({ chunks: [], started: 0 })

  const release = useCallback(() => {
    const x = r.current
    if (x.raf) cancelAnimationFrame(x.raf)
    if (x.timer) clearInterval(x.timer)
    x.stream?.getTracks().forEach((t) => t.stop())
    x.ctx?.close().catch(() => undefined)
    x.stream = undefined
    x.ctx = undefined
    x.raf = undefined
    x.timer = undefined
    setLevel(0)
  }, [])

  const stop = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const x = r.current
        if (!x.rec || x.rec.state === 'inactive') {
          release()
          return resolve(null)
        }
        x.resolve = resolve
        x.rec.stop()
      }),
    [release],
  )

  const start = useCallback(async () => {
    if (state === 'unsupported') return false
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      const x = r.current
      x.stream = stream
      x.chunks = []
      const mimeType = MIME.find((m) => MediaRecorder.isTypeSupported?.(m))
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      x.rec = rec
      rec.ondataavailable = (e) => e.data.size && x.chunks.push(e.data)
      rec.onstop = () => {
        const blob = x.chunks.length ? new Blob(x.chunks, { type: rec.mimeType || 'audio/webm' }) : null
        release()
        setState('idle')
        x.resolve?.(blob)
        x.resolve = undefined
      }
      // Input level meter so learners can see the microphone is working.
      try {
        const ctx = new AudioContext()
        const an = ctx.createAnalyser()
        an.fftSize = 512
        ctx.createMediaStreamSource(stream).connect(an)
        const buf = new Uint8Array(an.fftSize)
        const tick = () => {
          an.getByteTimeDomainData(buf)
          let sum = 0
          for (const v of buf) sum += ((v - 128) / 128) ** 2
          setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4))
          x.raf = requestAnimationFrame(tick)
        }
        x.ctx = ctx
        tick()
      } catch {
        /* the meter is optional */
      }
      x.started = Date.now()
      setElapsed(0)
      x.timer = window.setInterval(() => {
        const ms = Date.now() - x.started
        setElapsed(ms)
        if (ms >= maxMs) void stop()
      }, 200)
      rec.start(1000)
      setState('recording')
      return true
    } catch (e) {
      release()
      const name = (e as Error).name
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
      return false
    }
  }, [state, maxMs, release, stop])

  const cancel = useCallback(() => {
    const x = r.current
    x.resolve = undefined
    if (x.rec && x.rec.state !== 'inactive') {
      x.rec.onstop = () => {
        release()
        setState('idle')
      }
      x.rec.stop()
    } else release()
    x.chunks = []
  }, [release])

  useEffect(
    () => () => {
      const x = r.current
      x.resolve = undefined
      if (x.rec && x.rec.state !== 'inactive') {
        x.rec.onstop = null
        x.rec.stop()
      }
      release()
    },
    [release],
  )

  return { state, elapsed, level, start, stop, cancel, setState }
}

export type SpeakingSession = {
  id: string
  promptId: string | null
  part: number | null
  mode: 'answer' | 'read-aloud'
  question: string
  transcript: string
  durationS: number
  metrics: {
    durationS: number
    speechS: number
    words: number
    wordsPerMinute: number
    articulationRate: number
    pauses: number
    longPauses: number
    longestPauseS: number
    fillers: { word: string; count: number }[]
    uniqueWordRatio: number
    advancedWords: string[]
  }
  feedback: {
    notes?: Record<'fluency' | 'lexical' | 'grammar', { level: 'good' | 'warn' | 'tip'; text: string }[]>
    grammarIssues?: { message: string; text: string; replacements: string[] }[]
    readAloud?: { words: { word: string; heard: boolean }[]; matched: number; total: number; percent: number; extra?: string[] }
  }
  aiFeedback: {
    fluency_band: number
    lexical_band: number
    grammar_band: number
    summary: string
    strengths: string[]
    improvements: string[]
    better_phrases: { original: string; better: string; why: string }[]
  } | null
  createdAt: number
  mockAttemptId: string | null
}

/** Sends one recording for on-server transcription and analysis. The server does not keep the audio. */
export function analyseSpeech(blob: Blob, meta: { part: number; mode: 'answer' | 'read-aloud'; question: string; promptId?: string; mockAttemptId?: string }) {
  const form = new FormData()
  // Fields first: the server reads them from the multipart stream before the file.
  form.append('part', String(meta.part))
  form.append('mode', meta.mode)
  form.append('question', meta.question)
  if (meta.promptId) form.append('promptId', meta.promptId)
  if (meta.mockAttemptId) form.append('mockAttemptId', meta.mockAttemptId)
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  form.append('audio', blob, `answer.${ext}`)
  return api<SpeakingSession>('/speaking/analyse', { form })
}
