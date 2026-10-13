import type { RealtimeClient } from './realtime';
import type { CallInfo, IeltsCallStep, ServerMessage } from './types';

/**
 * Peer-to-peer WebRTC audio call with server-relayed signalling.
 * The platform supplies WebRTC primitives (browser globals on web,
 * react-native-webrtc on Android/iOS) so the call logic is identical everywhere.
 */
export interface WebRtcDeps {
  createPeerConnection(config: { iceServers: CallInfo['iceServers'] }): any;
  getUserMedia(): Promise<any>; // MediaStream with one audio track
  onRemoteStream(stream: any): void;
  /** Optional platform hook (e.g. InCallManager on mobile). */
  onCallActive?(active: boolean): void;
}

export type CallState =
  | 'requesting_mic'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended'
  | 'failed';

export interface CallSnapshot {
  state: CallState;
  muted: boolean;
  partnerMuted: boolean;
  partnerState: 'online' | 'connected' | 'reconnecting' | 'disconnected';
  connectedAt: number | null;
  endReason: string | null;
  endStatus: 'completed' | 'short' | 'failed' | 'cancelled' | null;
  durationSec: number;
  error: string | null;
  secondsLeftWarning: number | null;
  ieltsStep: IeltsCallStep | null;
}

type Signal = { sdp?: { type: string; sdp: string }; candidate?: unknown };

export class CallSession {
  private pc: any = null;
  private local: any = null;
  private pendingSignals: Signal[] = [];
  private pendingCandidates: unknown[] = [];
  private unsub: () => void;
  private listeners = new Set<(s: CallSnapshot) => void>();
  private failTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  snapshot: CallSnapshot;

  constructor(
    public info: CallInfo,
    private rt: RealtimeClient,
    private deps: WebRtcDeps,
  ) {
    this.snapshot = {
      state: 'requesting_mic',
      muted: false,
      partnerMuted: false,
      partnerState: 'online',
      connectedAt: null,
      endReason: null,
      endStatus: null,
      durationSec: 0,
      error: null,
      secondsLeftWarning: null,
      ieltsStep: null,
    };
    this.unsub = this.rt.on((m) => this.onServer(m));
  }

  subscribe(l: (s: CallSnapshot) => void) {
    this.listeners.add(l);
    l(this.snapshot);
    return () => this.listeners.delete(l);
  }

  private update(patch: Partial<CallSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l(this.snapshot));
  }

  /** Restore state after the app reconnects its WebSocket mid-call. */
  applyResume(connectedAt: string | null, partnerMuted: boolean) {
    this.update({ connectedAt: connectedAt ? Date.parse(connectedAt) : this.snapshot.connectedAt, partnerMuted });
  }

  async start() {
    try {
      this.local = await this.deps.getUserMedia();
    } catch (e: any) {
      const denied = /denied|notallowed|permission/i.test(String(e?.name ?? '') + String(e?.message ?? ''));
      const error = denied
        ? 'Microphone access was denied. Allow microphone access in your browser or device settings to join calls.'
        : 'Could not start your microphone. Check that a microphone is connected and not used by another app.';
      this.rt.send({ t: 'call.end', callId: this.info.id, reason: denied ? 'mic_denied' : 'mic_error' });
      this.finish('failed', denied ? 'mic_denied' : 'mic_error', 'failed', error);
      return;
    }
    if (this.disposed) {
      this.stopLocal();
      return;
    }
    this.update({ state: 'connecting' });
    this.deps.onCallActive?.(true);
    const pc = this.deps.createPeerConnection({ iceServers: this.info.iceServers });
    this.pc = pc;
    this.local.getTracks().forEach((t: any) => pc.addTrack(t, this.local));
    pc.ontrack = (ev: any) => {
      const stream = ev.streams?.[0];
      if (stream) this.deps.onRemoteStream(stream);
    };
    pc.onicecandidate = (ev: any) => {
      if (ev.candidate) this.signal({ candidate: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate });
    };
    pc.oniceconnectionstatechange = () => this.onIceState(pc.iceConnectionState);
    if (this.info.role === 'offerer') {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      this.signal({ sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
    }
    const queued = this.pendingSignals.splice(0);
    for (const s of queued) await this.handleSignal(s);
  }

  private signal(data: Signal) {
    this.rt.send({ t: 'call.signal', callId: this.info.id, data });
  }

  private onIceState(state: string) {
    if (this.disposed) return;
    if (state === 'connected' || state === 'completed') {
      if (this.failTimer) clearTimeout(this.failTimer);
      this.failTimer = null;
      this.rt.send({ t: 'call.media', callId: this.info.id, state: 'connected' });
      // "Connected" is shown only once the server confirms both peers have working media.
      this.update({ state: this.snapshot.connectedAt ? 'connected' : 'connecting' });
    } else if (state === 'disconnected') {
      this.update({ state: 'reconnecting' });
      this.rt.send({ t: 'call.media', callId: this.info.id, state: 'disconnected' });
      this.armFailTimer();
    } else if (state === 'failed') {
      this.update({ state: 'reconnecting' });
      this.rt.send({ t: 'call.media', callId: this.info.id, state: 'disconnected' });
      if (this.info.role === 'offerer') void this.restartIce();
      this.armFailTimer();
    }
  }

  private armFailTimer() {
    if (this.failTimer) return;
    this.failTimer = setTimeout(() => {
      this.failTimer = null;
      const s = this.pc?.iceConnectionState;
      if (s !== 'connected' && s !== 'completed' && !this.disposed) {
        this.rt.send({ t: 'call.media', callId: this.info.id, state: 'failed' });
        this.rt.send({ t: 'call.end', callId: this.info.id, reason: 'connection_failed' });
        this.finish('failed', 'connection_failed', 'failed', 'The connection was lost and could not be recovered.');
      }
    }, 15_000);
  }

  private async restartIce() {
    try {
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      this.signal({ sdp: { type: offer.type, sdp: offer.sdp } });
    } catch {
      /* fail timer will end the call */
    }
  }

  private async handleSignal(data: Signal) {
    if (!this.pc) {
      this.pendingSignals.push(data);
      return;
    }
    const pc = this.pc;
    try {
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.signal({ sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
        }
        const cands = this.pendingCandidates.splice(0);
        for (const c of cands) await pc.addIceCandidate(c).catch(() => undefined);
      } else if (data.candidate) {
        if (!pc.remoteDescription) this.pendingCandidates.push(data.candidate);
        else await pc.addIceCandidate(data.candidate).catch(() => undefined);
      }
    } catch (e) {
      this.update({ error: 'Signalling error: ' + String((e as Error)?.message ?? e) });
    }
  }

  private onServer(m: ServerMessage) {
    if (!('callId' in m) || m.callId !== this.info.id) return;
    switch (m.t) {
      case 'call.signal':
        void this.handleSignal(m.data as Signal);
        break;
      case 'call.connected':
        this.update({ connectedAt: Date.parse(m.connectedAt), state: 'connected' });
        break;
      case 'call.partner_state':
        this.update({ partnerState: m.state });
        break;
      case 'call.partner_mute':
        this.update({ partnerMuted: m.muted });
        break;
      case 'call.warning':
        this.update({ secondsLeftWarning: m.secondsLeft });
        break;
      case 'call.ielts':
        this.update({ ieltsStep: m.step });
        break;
      case 'call.ended':
        this.finish('ended', m.reason, m.status, null, m.durationSec);
        break;
    }
  }

  setMuted(muted: boolean) {
    this.local?.getAudioTracks?.().forEach((t: any) => (t.enabled = !muted));
    this.update({ muted });
    this.rt.send({ t: 'call.mute', callId: this.info.id, muted });
  }

  sendIeltsStep(step: IeltsCallStep) {
    this.update({ ieltsStep: step });
    this.rt.send({ t: 'call.ielts', callId: this.info.id, step });
  }

  /** User pressed End Call. The server confirms with call.ended (with authoritative duration). */
  hangUp() {
    if (this.disposed) return;
    this.rt.send({ t: 'call.end', callId: this.info.id, reason: 'hangup' });
    const dur = this.snapshot.connectedAt ? Math.round((Date.now() - this.snapshot.connectedAt) / 1000) : 0;
    this.finish('ended', 'hangup', this.snapshot.connectedAt ? (dur >= 60 ? 'completed' : 'short') : 'cancelled', null, dur);
  }

  /** Live media statistics, used for the "receiving audio" indicator and automated tests. */
  async getAudioStats(): Promise<{ bytesReceived: number; bytesSent: number; audioLevel: number | null }> {
    const out = { bytesReceived: 0, bytesSent: 0, audioLevel: null as number | null };
    if (!this.pc) return out;
    const stats = await this.pc.getStats();
    stats.forEach((r: any) => {
      if (r.type === 'inbound-rtp' && (r.kind === 'audio' || r.mediaType === 'audio')) {
        out.bytesReceived += r.bytesReceived ?? 0;
        if (typeof r.audioLevel === 'number') out.audioLevel = r.audioLevel;
      }
      if (r.type === 'outbound-rtp' && (r.kind === 'audio' || r.mediaType === 'audio')) out.bytesSent += r.bytesSent ?? 0;
    });
    return out;
  }

  private stopLocal() {
    try {
      this.local?.getTracks().forEach((t: any) => t.stop());
    } catch {
      /* ignore */
    }
    this.local = null;
  }

  private finish(
    state: 'ended' | 'failed',
    reason: string,
    status: CallSnapshot['endStatus'],
    error: string | null,
    durationSec?: number,
  ) {
    if (this.disposed) {
      // Server's authoritative summary may arrive after a local hang-up; accept its numbers.
      if (durationSec !== undefined) this.update({ durationSec, endStatus: status ?? this.snapshot.endStatus });
      return;
    }
    this.disposed = true;
    if (this.failTimer) clearTimeout(this.failTimer);
    this.stopLocal();
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.deps.onCallActive?.(false);
    this.update({ state, endReason: reason, endStatus: status, error, durationSec: durationSec ?? this.snapshot.durationSec });
  }

  /** Releases listeners; call when the UI leaves the call summary screen. */
  dispose() {
    if (!this.disposed) this.hangUp();
    this.unsub();
    this.listeners.clear();
  }
}
