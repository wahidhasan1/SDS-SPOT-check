import { RTCPeerConnection, mediaDevices } from 'react-native-webrtc';
import type { WebRtcDeps } from '@app/shared';

/** Native WebRTC (react-native-webrtc). Remote audio is played automatically by the native audio session. */
export function createWebRtcDeps(onActive?: (active: boolean) => void): WebRtcDeps {
  return {
    createPeerConnection: (cfg) => new RTCPeerConnection({ iceServers: cfg.iceServers as any }),
    getUserMedia: () => mediaDevices.getUserMedia({ audio: true, video: false }),
    onRemoteStream: () => undefined,
    onCallActive: onActive,
  };
}

export const webrtcSupported = true;

import { PermissionsAndroid, Platform } from 'react-native';

/** Returns null when the microphone can be used, otherwise a user-facing explanation. */
export async function ensureMicPermission(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: 'Microphone access',
        message: 'The microphone is needed for live speaking practice. Calls are not recorded.',
        buttonPositive: 'Allow',
      });
      if (r !== PermissionsAndroid.RESULTS.GRANTED) return 'Microphone permission was denied. Enable it in Settings › Apps › FluentPath › Permissions.';
    }
    const s = await mediaDevices.getUserMedia({ audio: true, video: false });
    s.getTracks().forEach((t) => t.stop());
    return null;
  } catch {
    return 'Microphone access is blocked. Enable it in your device settings to join calls.';
  }
}
