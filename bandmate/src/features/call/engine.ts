import { useSyncExternalStore } from 'react'
import { socket, type WsMessage } from '../../lib/ws'
import type { CallMode } from '../../../shared/config'

export type Phase = 'idle' | 'mic' | 'matching' | 'found' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'failed'

export type Partner = { anonName: string; avatarIcon: string; avatarColor: string; level: string | null; role: string }
export type Prompts =
  | { kind: 'casual'; topic: string; questions: string[] }
  | { kind: 'part1'; sets: { title: string; questions: string[] }[] }
  | { kind: 'part2'; card: { title: string; cue: string; points: string[]; explain: string }; followUp: string[]; prepSeconds: number; speakSeconds: number }
  | { kind: 'part3'; title: string; questions: string[] }

export type CallState = {
  phase: Phase
  request: { mode: CallMode; topic: string; role: string; genderPref: string | null } | null
  searchingSince: number | null
  waitingOthers: number
  sessionId: string | null
  partner: Partner | null
  role: string | null
  topic: string | null
  mode: CallMode | null
  prompts: Prompts | null
  maxSeconds: number
  startedAt: number | null
  elapsedMs: number
  muted: boolean
  partnerMuted: boolean
  partnerReconnecting: boolean
  selfReconnecting: boolean
  warning: string | null
  error: { code: string; message: string } | null
  ended: { sessionId: string; reason: string; endedBy: string; durationS: number } | null
  shared: { promptIndex: number; timer: { phase: 'prep' | 'speak'; endsAt: number } | null; swapped: boolean }
  micLevel: number
  partnerLevel: number
}

const initial = (): CallState => ({
  phase: 'idle',
  request: null,
  searchingSince: null,
  waitingOthers: 0,
  sessionId: null,
  partner: null,
  role: null,
  topic: null,
  mode: null,
  prompts: null,
  maxSeconds: 0,
  startedAt: null,
  elapsedMs: 0,
  muted: false,
  partnerMuted: false,
  partnerReconnecting: false,
  selfReconnecting: false,
  warning: null,
  error: null,
  ended: null,
  shared: { promptIndex: 0, timer: null, swapped: false },
  micLevel: 0,
  partnerLevel: 0,
})

const MIC_ERRORS: Record<string, string> = {
  NotAllowedError: 'Microphone access was blocked. Allow the microphone in your browser’s site settings, then try again.',
  SecurityError: 'Microphone access was blocked. Allow the microphone in your browser’s site settings, then try again.',
  NotFoundError: 'No microphone was found. Connect a microphone or headset and try again.',
  NotReadableError: 'Your microphone is being used by another app. Close that app and try again.',
  OverconstrainedError: 'Your microphone could not be started with the required settings.',
}

class CallEngine {
  state: CallState = initial()
  private subs = new Set<() => void>()
  private mic: MediaStream | null = null
  private pc: RTCPeerConnection | null = null
  private iceServers: RTCIceServer[] = []
  private initiator = false
  private pendingIce: RTCIceCandidateInit[] = []
  private audioEl: HTMLAudioElement | null = null
  private remoteStream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private meters: { stop: () => void }[] = []
  private ticker: number | undefined
  private iceTimer: number | undefined
  private reportedConnected = false
  private offs: (() => void)[] = []
  private retriedStale = false

  constructor() {
    const on = (t: string, fn: (m: WsMessage) => void) => this.offs.push(socket.on(t, fn))
    on('match.searching', (m) => this.set({ phase: 'matching', waitingOthers: Number(m.waiting ?? 0), searchingSince: this.state.searchingSince ?? Date.now() }))
    on('match.cancelled', () => this.state.phase === 'matching' && this.reset())
    on('match.error', (m) => this.fail(String(m.code), String(m.message)))
    on('error', (m) => {
      // A call left over from a page reload is still closing on the server: end it and retry once.
      if (m.for === 'match.start' && m.code === 'in_call' && m.sessionId && !this.retriedStale && this.state.request) {
        this.retriedStale = true
        socket.send({ t: 'call.end', sessionId: m.sessionId })
        window.setTimeout(() => socket.send({ t: 'match.start', ...this.state.request }), 500)
        return
      }
      if (m.for === 'match.start') this.fail(String(m.code), String(m.message))
      else if (String(m.for ?? '').startsWith('call.') && m.code === 'no_session' && this.inCall()) this.finish({ sessionId: this.state.sessionId!, reason: 'connection_failed', endedBy: 'system', durationS: Math.round(this.state.elapsedMs / 1000) })
    })
    on('match.found', (m) => void this.onFound(m))
    on('call.signal', (m) => m.sessionId === this.state.sessionId && void this.onSignal(m.data as Signal))
    on('call.active', (m) => m.sessionId === this.state.sessionId && this.onActive(Number(m.elapsedMs ?? 0)))
    on('call.resumed', (m) => {
      if (m.sessionId !== this.state.sessionId) return
      this.iceServers = (m.iceServers as RTCIceServer[]) ?? this.iceServers
      this.set({ selfReconnecting: false })
    })
    on('call.restart', (m) => m.sessionId === this.state.sessionId && void this.restartPeer(!!m.initiator))
    on('call.partner_media', (m) => m.sessionId === this.state.sessionId && this.set({ partnerMuted: !!m.muted }))
    on('call.partner_connection', (m) => m.sessionId === this.state.sessionId && this.set({ partnerReconnecting: m.status === 'reconnecting' }))
    on('call.sync', (m) => m.sessionId === this.state.sessionId && this.onSync(m.payload as SyncPayload))
    on('call.warning', (m) => m.sessionId === this.state.sessionId && this.set({ warning: `About ${Math.round(Number(m.secondsLeft) / 60) || 1} minute left in this call.` }))
    on('call.ended', (m) => m.sessionId === this.state.sessionId && this.finish({ sessionId: String(m.sessionId), reason: String(m.reason), endedBy: String(m.endedBy), durationS: Number(m.durationS) }))
    // Our own socket dropped mid-call: show "reconnecting" and rejoin the session when it comes back.
    socket.onStatus((s) => {
      if (!this.inCall()) return
      if (s === 'closed') this.set({ selfReconnecting: true })
      if (s === 'open') socket.send({ t: 'call.resume', sessionId: this.state.sessionId })
    })
  }

  // -------------------------------------------------------------- public API
  subscribe = (fn: () => void) => {
    this.subs.add(fn)
    return () => void this.subs.delete(fn)
  }

  inCall = () => ['found', 'connecting', 'connected', 'reconnecting'].includes(this.state.phase)

  async start(req: CallState['request'] & object) {
    if (this.state.phase !== 'idle' && this.state.phase !== 'ended' && this.state.phase !== 'failed') return
    this.cleanupMedia()
    this.state = { ...initial(), phase: 'mic', request: req }
    this.emit()
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'Unsupported' })
      this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
    } catch (e) {
      const name = (e as Error).name
      return this.fail('mic_' + name, MIC_ERRORS[name] ?? (name === 'Unsupported' ? 'This browser can’t use the microphone. Try the latest Chrome, Edge, Safari or Firefox.' : 'Your microphone could not be started.'))
    }
    if (this.state.phase !== 'mic') return this.cleanupMedia() // cancelled while the permission prompt was open
    this.meter(this.mic, 'micLevel')
    try {
      await socket.ready()
    } catch (e) {
      return this.fail('offline', (e as Error).message)
    }
    this.set({ phase: 'matching', searchingSince: Date.now() })
    this.retriedStale = false
    socket.send({ t: 'match.start', ...req })
  }

  cancel() {
    if (this.state.phase === 'matching' || this.state.phase === 'mic') socket.send({ t: 'match.cancel' })
    this.reset()
  }

  hangup() {
    if (!this.state.sessionId) return this.reset()
    if (socket.status === 'open') socket.send({ t: 'call.end', sessionId: this.state.sessionId })
    else this.finish({ sessionId: this.state.sessionId, reason: 'hangup', endedBy: 'you', durationS: Math.round(this.state.elapsedMs / 1000) })
  }

  toggleMute() {
    const track = this.mic?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    this.set({ muted: !track.enabled })
    if (this.state.sessionId) socket.send({ t: 'call.media', sessionId: this.state.sessionId, muted: !track.enabled })
  }

  sync(payload: SyncPayload) {
    this.onSync(payload)
    if (this.state.sessionId) socket.send({ t: 'call.sync', sessionId: this.state.sessionId, payload })
  }

  /** Back to the idle screen after the summary. */
  reset() {
    this.cleanupMedia()
    this.state = initial()
    this.emit()
  }

  // -------------------------------------------------------------- matching → WebRTC
  private async onFound(m: WsMessage) {
    if (this.state.phase !== 'matching') return
    this.iceServers = (m.iceServers as RTCIceServer[]) ?? []
    this.initiator = !!m.initiator
    this.set({
      phase: 'found',
      sessionId: String(m.sessionId),
      partner: m.partner as Partner,
      role: String(m.role),
      topic: String(m.topic),
      mode: m.mode as CallMode,
      prompts: m.prompts as Prompts,
      maxSeconds: Number(m.maxSeconds),
    })
    if ('vibrate' in navigator) navigator.vibrate?.(60)
    // Create the peer connection immediately so an early offer from the partner is never missed;
    // the "Partner found" moment is only a visual state.
    await this.restartPeer(this.initiator)
    window.setTimeout(() => {
      if (this.state.sessionId === m.sessionId && this.state.phase === 'found') this.set({ phase: 'connecting' })
    }, 900)
  }

  private async restartPeer(initiator: boolean) {
    this.initiator = initiator
    this.closePeer()
    this.reportedConnected = false
    const pc = new RTCPeerConnection({ iceServers: this.iceServers })
    this.pc = pc
    this.pendingIce = []
    for (const t of this.mic?.getTracks() ?? []) pc.addTrack(t, this.mic!)
    pc.onicecandidate = (e) => e.candidate && this.signal({ type: 'candidate', candidate: e.candidate.toJSON() })
    pc.ontrack = (e) => this.attachRemote(e.streams[0] ?? new MediaStream([e.track]))
    pc.onconnectionstatechange = () => this.onPcState(pc)
    for (const sig of this.earlySignals.splice(0)) await this.onSignal(sig)
    if (initiator) {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      this.signal({ type: 'offer', sdp: offer.sdp })
    }
  }

  private earlySignals: Signal[] = []

  private async onSignal(data: Signal) {
    const pc = this.pc
    if (!pc) {
      this.earlySignals.push(data) // arrived before our peer connection exists
      return
    }
    try {
      if (data.type === 'offer') {
        await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp })
        await this.flushIce()
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        this.signal({ type: 'answer', sdp: answer.sdp })
      } else if (data.type === 'answer') {
        if (pc.signalingState === 'have-local-offer') await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp })
        await this.flushIce()
      } else if (data.type === 'candidate' && data.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(data.candidate)
        else this.pendingIce.push(data.candidate)
      }
    } catch (e) {
      console.warn('Signalling error', e)
    }
  }

  private async flushIce() {
    for (const c of this.pendingIce.splice(0)) await this.pc?.addIceCandidate(c).catch(() => undefined)
  }

  private onPcState(pc: RTCPeerConnection) {
    if (pc !== this.pc) return
    const s = pc.connectionState
    if (s === 'connected') {
      window.clearTimeout(this.iceTimer)
      if (!this.reportedConnected) {
        this.reportedConnected = true
        socket.send({ t: 'call.connected', sessionId: this.state.sessionId })
      }
      if (this.state.phase === 'reconnecting') this.set({ phase: 'connected' })
    }
    if ((s === 'disconnected' || s === 'failed') && this.state.phase === 'connected') {
      this.set({ phase: 'reconnecting' })
      // Try an ICE restart; if the media path doesn't come back, end the call cleanly instead of hanging.
      if (s === 'failed' && this.initiator) void this.iceRestart()
      window.clearTimeout(this.iceTimer)
      this.iceTimer = window.setTimeout(() => {
        if (this.pc?.connectionState !== 'connected' && this.inCall()) this.hangup()
      }, 25_000)
    }
    if (s === 'failed' && this.state.phase === 'connecting' && this.initiator) void this.iceRestart()
  }

  private async iceRestart() {
    const pc = this.pc
    if (!pc) return
    const offer = await pc.createOffer({ iceRestart: true })
    await pc.setLocalDescription(offer)
    this.signal({ type: 'offer', sdp: offer.sdp })
  }

  private onActive(elapsedMs: number) {
    const startedAt = Date.now() - elapsedMs
    this.set({ phase: 'connected', startedAt })
    window.clearInterval(this.ticker)
    this.ticker = window.setInterval(() => this.set({ elapsedMs: Date.now() - startedAt }), 500)
  }

  private onSync(p: SyncPayload) {
    const shared = { ...this.state.shared }
    if (p.kind === 'prompt') shared.promptIndex = Math.max(0, Math.min(50, Number(p.index) || 0))
    if (p.kind === 'timer') shared.timer = p.phase ? { phase: p.phase, endsAt: Date.now() + Math.min(600, Number(p.seconds) || 0) * 1000 } : null
    if (p.kind === 'swap') shared.swapped = !shared.swapped
    this.set({ shared })
  }

  private signal(data: Signal) {
    socket.send({ t: 'call.signal', sessionId: this.state.sessionId, data })
  }

  private attachRemote(stream: MediaStream) {
    if (this.remoteStream === stream) return
    this.remoteStream = stream
    if (!this.audioEl) {
      this.audioEl = document.createElement('audio')
      this.audioEl.autoplay = true
      this.audioEl.setAttribute('playsinline', '')
      this.audioEl.dataset.role = 'remote-audio'
      document.body.appendChild(this.audioEl)
    }
    this.audioEl.srcObject = stream
    void this.audioEl.play().catch(() => this.set({ warning: 'Tap anywhere to turn on the sound.' }))
    this.meter(stream, 'partnerLevel')
  }

  /** Lightweight level meter, used for the "speaking" rings on the call screen. */
  private meter(stream: MediaStream, key: 'micLevel' | 'partnerLevel') {
    try {
      this.ctx ??= new AudioContext()
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      const src = this.ctx.createMediaStreamSource(stream)
      const an = this.ctx.createAnalyser()
      an.fftSize = 512
      src.connect(an)
      const buf = new Uint8Array(an.fftSize)
      let raf = 0
      let last = 0
      const loop = (t: number) => {
        raf = requestAnimationFrame(loop)
        if (t - last < 100) return
        last = t
        an.getByteTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += ((v - 128) / 128) ** 2
        const level = Math.min(1, Math.sqrt(sum / buf.length) * 4)
        if (Math.abs(level - this.state[key]) > 0.03) this.set({ [key]: level } as Partial<CallState>)
      }
      raf = requestAnimationFrame(loop)
      this.meters.push({ stop: () => (cancelAnimationFrame(raf), src.disconnect()) })
    } catch {
      /* meters are cosmetic */
    }
  }

  private finish(ended: NonNullable<CallState['ended']>) {
    this.earlySignals = []
    this.cleanupMedia()
    this.set({ phase: 'ended', ended, elapsedMs: ended.durationS * 1000, partnerReconnecting: false, selfReconnecting: false })
  }

  private fail(code: string, message: string) {
    this.cleanupMedia()
    this.set({ phase: 'failed', error: { code, message } })
  }

  private closePeer() {
    if (this.pc) {
      this.pc.onicecandidate = this.pc.ontrack = this.pc.onconnectionstatechange = null
      this.pc.close()
      this.pc = null
    }
  }

  /** Releases everything: peer connection, microphone (the browser's mic indicator turns off), audio, timers. */
  private cleanupMedia() {
    window.clearInterval(this.ticker)
    window.clearTimeout(this.iceTimer)
    this.closePeer()
    this.mic?.getTracks().forEach((t) => t.stop())
    this.mic = null
    this.meters.forEach((m) => m.stop())
    this.meters = []
    if (this.audioEl) {
      this.audioEl.srcObject = null
      this.audioEl.remove()
      this.audioEl = null
    }
    this.remoteStream = null
    void this.ctx?.close().catch(() => undefined)
    this.ctx = null
  }

  private set(p: Partial<CallState>) {
    this.state = { ...this.state, ...p }
    this.emit()
  }

  private emit() {
    this.subs.forEach((s) => s())
  }

  // -------------------------------------------------------------- test hooks (opt-in via localStorage)
  /** Records the partner's audio for `ms` milliseconds; returns a data URL. Used by the automated two-user test. */
  async debugRecordRemote(ms: number) {
    if (!this.remoteStream) throw new Error('no remote stream')
    const rec = new MediaRecorder(this.remoteStream, { mimeType: 'audio/webm' })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => chunks.push(e.data)
    const done = new Promise((r) => (rec.onstop = r))
    rec.start()
    await new Promise((r) => setTimeout(r, ms))
    rec.stop()
    await done
    const blob = new Blob(chunks, { type: 'audio/webm' })
    return await new Promise<string>((r) => {
      const fr = new FileReader()
      fr.onload = () => r(String(fr.result))
      fr.readAsDataURL(blob)
    })
  }

  debugInfo() {
    return { micActive: !!this.mic?.getAudioTracks().some((t) => t.readyState === 'live'), micEnabled: !!this.mic?.getAudioTracks()[0]?.enabled, pc: this.pc?.connectionState ?? null, hasRemote: !!this.remoteStream }
  }
}

type Signal = { type: 'offer' | 'answer'; sdp?: string; candidate?: undefined } | { type: 'candidate'; candidate: RTCIceCandidateInit; sdp?: undefined }
export type SyncPayload = { kind: 'prompt'; index: number } | { kind: 'timer'; phase: 'prep' | 'speak' | null; seconds: number } | { kind: 'swap' } | { kind: 'part'; part: number }

export const callEngine = new CallEngine()

try {
  if (localStorage.getItem('bm_debug_call') === '1') Object.assign(window, { __call: callEngine, __socket: socket })
} catch {
  /* storage blocked */
}

export function useCall() {
  return useSyncExternalStore(callEngine.subscribe, () => callEngine.state)
}
