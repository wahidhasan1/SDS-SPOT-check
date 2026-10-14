// Runtime flags for the hosted, browser-only demo build (see demo-web/).
// In the Next.js app these are always false.

declare global {
  interface Window {
    __PANTORA_HOSTED__?: boolean;
  }
}

/** True when Pantora runs as the self-contained hosted preview page. */
export const isHostedPreview = typeof window !== "undefined" && window.__PANTORA_HOSTED__ === true;

export const HOSTED_MIC_NOTICE =
  "The hosted preview can't use your microphone, so type what you would say instead. Voice recording, live captions, and live calls work when you run Pantora locally.";
