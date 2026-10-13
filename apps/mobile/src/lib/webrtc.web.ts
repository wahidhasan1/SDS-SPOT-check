import type { WebRtcDeps } from '@app/shared';

/** Browser WebRTC, used when the Expo app runs on the web (react-native-web). */
let audioEl: HTMLAudioElement | null = null;

export function createWebRtcDeps(onActive?: (active: boolean) => void): WebRtcDeps {
  return {
    createPeerConnection: (cfg) => new RTCPeerConnection({ iceServers: cfg.iceServers as RTCIceServer[] }),
    getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }),
    onRemoteStream: (stream: MediaStream) => {
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.setAttribute('data-testid', 'remote-audio');
        document.body.appendChild(audioEl);
      }
      audioEl.srcObject = stream;
      void audioEl.play().catch(() => undefined);
    },
    onCallActive: onActive,
  };
}

export const webrtcSupported = typeof RTCPeerConnection !== 'undefined';

export async function ensureMicPermission(): Promise<string | null> {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return null;
  } catch {
    return 'Microphone access is blocked. Allow it in your browser settings to join calls.';
  }
}
