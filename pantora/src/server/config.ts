import "server-only";

// All runtime configuration comes from environment variables (see .env.example).
// Secrets never leave the server: only the derived status flags are sent to the browser.

function bool(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const config = {
  demoMode: bool(process.env.PANTORA_DEMO_MODE, true),
  adminToken: process.env.PANTORA_ADMIN_TOKEN || null,
  ai: {
    anthropicKey: process.env.ANTHROPIC_API_KEY || null,
    model: process.env.PANTORA_AI_MODEL || "claude-opus-5-5",
    effort: (process.env.PANTORA_AI_EFFORT || "low") as "low" | "medium" | "high",
    timeoutMs: Number(process.env.PANTORA_AI_TIMEOUT_MS || 30_000),
  },
  stt: {
    apiKey: process.env.PANTORA_STT_API_KEY || null,
    baseUrl: (process.env.PANTORA_STT_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.PANTORA_STT_MODEL || "whisper-1",
    maxBytes: 8 * 1024 * 1024,
  },
  live: {
    enabled: bool(process.env.PANTORA_LIVE_MATCHING, false),
    iceServers: parseIceServers(process.env.PANTORA_ICE_SERVERS),
  },
};

function parseIceServers(raw: string | undefined): RTCIceServerLike[] {
  if (!raw) return [{ urls: "stun:stun.l.google.com:19302" }];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [{ urls: "stun:stun.l.google.com:19302" }];
  } catch {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
}

export interface RTCIceServerLike {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export type IntegrationState = "configured" | "demo" | "disabled";

export interface IntegrationStatus {
  id: "ai" | "stt" | "voice" | "matching" | "auth" | "storage" | "moderation";
  name: string;
  state: IntegrationState;
  detail: string;
}

/** Public, secret-free description of which integrations are live. */
export function integrationStatus(): IntegrationStatus[] {
  return [
    {
      id: "ai",
      name: "AI feedback",
      state: config.ai.anthropicKey ? "configured" : "demo",
      detail: config.ai.anthropicKey
        ? `Claude (${config.ai.model}) analyzes responses on the server.`
        : "No ANTHROPIC_API_KEY set. The transparent demo analyzer (pattern rules) is used and labeled in the UI.",
    },
    {
      id: "stt",
      name: "Speech-to-text",
      state: config.stt.apiKey ? "configured" : "demo",
      detail: config.stt.apiKey
        ? `Recordings can be transcribed with ${config.stt.model} via ${new URL(config.stt.baseUrl).host}.`
        : "No server transcription configured. Pantora can use your browser's built-in speech recognition (where supported) or a typed transcript.",
    },
    {
      id: "matching",
      name: "Partner matching",
      state: config.live.enabled ? "configured" : "demo",
      detail: config.live.enabled
        ? "Live matching between people signed in to this Pantora server is enabled (experimental)."
        : "Matching is simulated with fictional demo partners. Set PANTORA_LIVE_MATCHING=true to match real users on this server.",
    },
    {
      id: "voice",
      name: "Voice calls",
      state: config.live.enabled ? "configured" : "demo",
      detail: config.live.enabled
        ? "Peer-to-peer WebRTC audio with STUN servers. Add a TURN server in PANTORA_ICE_SERVERS for restrictive networks."
        : "Calls with demo partners are simulated: partner lines are scripted text, and your microphone stays on your device.",
    },
    {
      id: "auth",
      name: "Authentication",
      state: "demo",
      detail: "Demo accounts are identified by a browser cookie. Connect a real identity provider before deploying publicly.",
    },
    {
      id: "storage",
      name: "Database",
      state: "configured",
      detail: "Local SQLite database (node:sqlite). Data persists on this machine between restarts.",
    },
    {
      id: "moderation",
      name: "Moderation",
      state: "demo",
      detail: "Reports and blocks are recorded and visible to admins. There is no automated content moderation.",
    },
  ];
}
