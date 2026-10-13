import { mediaDevices, MediaStream, RTCIceCandidate, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';
import type { IceServer } from '@fluentpath/shared';

export type PeerState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';
type Signal = { sdp: { type: string; sdp: string } } | { candidate: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } } | { type: 'restart' };

/** One-to-one audio call using react-native-webrtc; compatible with the web client's protocol. */
export class AudioPeer {
  pc: RTCPeerConnection;
  private pending: Signal[] = [];
  private closed = false;

  constructor(iceServers: IceServer[], private local: MediaStream, private role: 'offerer' | 'answerer', private sendSignal: (s: Signal) => void, onState: (s: PeerState) => void) {
    this.pc = new RTCPeerConnection({ iceServers: iceServers as never });
    local.getTracks().forEach((t) => this.pc.addTrack(t, local));
    const pc = this.pc as unknown as { addEventListener: (ev: string, fn: (e: unknown) => void) => void };
    pc.addEventListener('icecandidate', (e) => {
      const c = (e as { candidate: { toJSON?: () => unknown } | null }).candidate;
      if (c) this.sendSignal({ candidate: (c.toJSON ? c.toJSON() : c) as never });
    });
    pc.addEventListener('connectionstatechange', () => onState(this.pc.connectionState as PeerState));
    // Remote audio plays automatically through the device speaker/earpiece in react-native-webrtc.
    if (role === 'offerer') void this.offer();
  }

  private async offer(iceRestart = false) {
    const o = await this.pc.createOffer({ offerToReceiveAudio: true, iceRestart } as never);
    await this.pc.setLocalDescription(o);
    const d = this.pc.localDescription!;
    this.sendSignal({ sdp: { type: d.type ?? 'offer', sdp: d.sdp ?? '' } });
  }

  async handleSignal(data: Signal) {
    if (this.closed) return;
    if ('sdp' in data) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp as never));
      for (const c of this.pending.splice(0)) await this.handleSignal(c);
      if (data.sdp.type === 'offer') {
        const a = await this.pc.createAnswer();
        await this.pc.setLocalDescription(a);
        const d = this.pc.localDescription!;
        this.sendSignal({ sdp: { type: d.type ?? 'answer', sdp: d.sdp ?? '' } });
      }
    } else if ('candidate' in data) {
      if (!this.pc.remoteDescription) this.pending.push(data);
      else await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate as never)).catch(() => {});
    } else if (data.type === 'restart' && this.role === 'offerer') await this.offer(true);
  }

  restart() {
    if (this.role === 'offerer') void this.offer(true);
    else this.sendSignal({ type: 'restart' });
  }
  setMuted(m: boolean) {
    this.local.getAudioTracks().forEach((t) => (t.enabled = !m));
  }
  close() {
    this.closed = true;
    this.pc.close();
  }
}

export async function getMicrophone() {
  return (await mediaDevices.getUserMedia({ audio: true, video: false })) as MediaStream;
}
