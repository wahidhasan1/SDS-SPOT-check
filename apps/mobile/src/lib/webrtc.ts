// Type-only fallback; Metro picks webrtc.native.ts or webrtc.web.ts at build time.
export { createWebRtcDeps, ensureMicPermission, webrtcSupported } from './webrtc.web';
