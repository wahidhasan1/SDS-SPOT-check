// Browser replacement for src/server/config.ts in the hosted demo.
import { readEngine } from "@/features/hosted/engine-toggle";

function claudeReady() {
  return typeof window !== "undefined" && window.__PANTORA_SAMPLE_READY__ === true;
}

export const config = {
  demoMode: true,
  adminToken: null as string | null,
  openAdmin: true,
  ai: {
    /** Non-null when feedback should come from Claude (through the page's Claude access). */
    get anthropicKey(): string | null {
      return claudeReady() && readEngine() === "claude" ? "hosted-sample" : null;
    },
    model: "Claude",
    effort: "low" as "low" | "medium" | "high",
    timeoutMs: 120_000,
  },
  stt: { apiKey: null as string | null, baseUrl: "https://example.invalid", model: "", maxBytes: 0 },
  live: { enabled: false, iceServers: [] as { urls: string | string[] }[] },
};

export type IntegrationState = "configured" | "demo" | "disabled";

export interface IntegrationStatus {
  id: "ai" | "stt" | "voice" | "matching" | "auth" | "storage" | "moderation";
  name: string;
  state: IntegrationState;
  detail: string;
}

export function integrationStatus(): IntegrationStatus[] {
  const claude = claudeReady();
  return [
    {
      id: "ai",
      name: "AI feedback",
      state: claude ? "configured" : "demo",
      detail: claude
        ? "Claude analyzes your answers through your own Claude account (it asks for permission the first time). You can switch to the rule-based demo analyzer in the Coach or Battles setup."
        : "Claude isn't available in this view, so the transparent rule-based demo analyzer is used and labeled.",
    },
    {
      id: "stt",
      name: "Speech-to-text",
      state: "disabled",
      detail: "Not available in the hosted preview, which can't use your microphone. Type your answers instead.",
    },
    {
      id: "matching",
      name: "Partner matching",
      state: "demo",
      detail: "Matching is simulated with fictional demo partners, using the same rules a live matcher would use.",
    },
    {
      id: "voice",
      name: "Voice calls",
      state: "demo",
      detail: "Calls with demo partners are simulated: partner lines are scripted text and you type your answers.",
    },
    {
      id: "auth",
      name: "Authentication",
      state: "demo",
      detail: "This preview keeps your profiles in this browser. There is no password or email account.",
    },
    {
      id: "storage",
      name: "Database",
      state: "configured",
      detail: "The same SQLite database the full app uses, running in your browser. Your data is saved in this browser only; Reset demo data in Demo admin starts over.",
    },
    {
      id: "moderation",
      name: "Moderation",
      state: "demo",
      detail: "Reports and blocks are recorded and visible in Demo admin. There is no automated content moderation.",
    },
  ];
}
