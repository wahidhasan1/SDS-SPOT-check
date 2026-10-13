import type { IceServer } from '@fluentpath/shared';

export type PeerState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

type Signal = { sdp: RTCSessionDescriptionInit } | { candidate: RTCIceCandidateInit } | { type: 'restart' };

/**
 * A one-to-one audio WebRTC connection. Roles are assigned by the server: the offerer creates the
 * offer, the answerer replies. ICE candidates are trickled through the signaling server.
 */
export class AudioPeer {
  pc: RTCPeerConnection;
  remoteStream = new MediaStream();
  private pending: RTCIceCandidateInit[] = [];
  private closed = false;

  constructor(
    iceServers: IceServer[],
    private local: MediaStream,
    private role: 'offerer' | 'answerer',
    private sendSignal: (s: Signal) => void,
    private onState: (s: PeerState) => void,
  ) {
    this.pc = new RTCPeerConnection({ iceServers: iceServers as RTCIceServer[] });
    for (const t of local.getAudioTracks()) this.pc.addTrack(t, local);
    this.pc.ontrack = (e) => {
      for (const t of e.streams[0]?.getTracks() ?? [e.track]) if (!this.remoteStream.getTracks().includes(t)) this.remoteStream.addTrack(t);
    };
    this.pc.onicecandidate = (e) => e.candidate && this.sendSignal({ candidate: e.candidate.toJSON() });
    this.pc.onconnectionstatechange = () => this.onState(this.pc.connectionState as PeerState);
    if (role === 'offerer') void this.makeOffer();
  }

  private async makeOffer(iceRestart = false) {
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true, iceRestart });
    await this.pc.setLocalDescription(offer);
    this.sendSignal({ sdp: this.pc.localDescription!.toJSON() });
  }

  async handleSignal(data: Signal) {
    if (this.closed) return;
    if ('sdp' in data) {
      await this.pc.setRemoteDescription(data.sdp);
      for (const c of this.pending.splice(0)) await this.pc.addIceCandidate(c).catch(() => {});
      if (data.sdp.type === 'offer') {
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.sendSignal({ sdp: this.pc.localDescription!.toJSON() });
      }
    } else if ('candidate' in data) {
      if (this.pc.remoteDescription) await this.pc.addIceCandidate(data.candidate).catch(() => {});
      else this.pending.push(data.candidate);
    } else if (data.type === 'restart' && this.role === 'offerer') {
      await this.makeOffer(true);
    }
  }

  /** Try to recover a broken connection (ICE restart). */
  restart() {
    if (this.role === 'offerer') void this.makeOffer(true);
    else this.sendSignal({ type: 'restart' });
  }

  setMuted(muted: boolean) {
    for (const t of this.local.getAudioTracks()) t.enabled = !muted;
  }

  close() {
    this.closed = true;
    try {
      this.pc.close();
    } catch {
      /* ignore */
    }
  }
}

export async function getMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not support microphone access. Please use a recent version of Chrome, Edge, Safari or Firefox.');
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  } catch (err) {
    const name = (err as DOMException).name;
    if (name === 'NotAllowedError') throw new Error('Microphone access was denied. Allow microphone access for this site in your browser settings, then try again.');
    if (name === 'NotFoundError') throw new Error('No microphone was found. Connect a microphone or headset and try again.');
    throw new Error('Could not access your microphone. Check that no other app is using it.');
  }
}
