// Single-file demo: the Bugloop API runs inside the page against an in-memory store seeded with
// the sample workspace. The UI talks to it through the same HTTP client it uses in server mode.
// Inside a claude.ai artifact viewer, the AI assistant uses Claude through the `sample` capability.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../web/styles/tokens.css";
import "../web/styles/base.css";
import "../web/styles/pages.css";
import { ApiClient } from "../web/api/client";
import { BugloopApp } from "../web/app/App";
import { initTheme } from "../web/lib/theme";
import { createApp } from "../server/app";
import { SystemClock, type AppContext } from "../server/context";
import { MemoryStore } from "../server/db/memory";
import { MemoryFileStore } from "../server/files/memory";
import { OfflineProvider } from "../server/ai/heuristic";
import { SampleProvider, type SampleFn } from "../server/ai/sample";
import { ensureBaseConfig } from "../server/seed/base";
import { seedDemo } from "../server/seed/demo";
import { demoLogin, resolveSession } from "../server/services/auth";
import { DemoPersistence } from "./persist";

/** Bump when the schema or the sample data changes, so saved sandboxes start fresh. */
const DATA_VERSION = "2026-09-24.1";
const TOKEN_KEY = "bugloop.demo.session";
const BASE = "http://bugloop.local";

declare global {
  interface Window {
    claude?: { use?: (name: string) => Promise<unknown> };
  }
}

initTheme();
const root = createRoot(document.getElementById("root")!);

function Splash({ text }: { text: string }) {
  return (
    <div className="splash">
      <span className="spinner" /> {text}
    </div>
  );
}

root.render(<Splash text="Preparing the demo workspace…" />);

async function start() {
  const store = new MemoryStore();
  const files = new MemoryFileStore();
  const ctx: AppContext = {
    store,
    files,
    ai: new OfflineProvider(),
    clock: new SystemClock(),
    config: { mode: "demo", demoLogin: true, maxUploadBytes: 20 * 1_048_576, sessionDays: 30 },
  };

  // Restore this viewer's sandbox, or seed a fresh one.
  const persistence = await DemoPersistence.connect();
  const saved = await persistence?.load(DATA_VERSION);
  if (saved) {
    store.load(saved.snapshot);
    for (const [key, blob] of saved.files) files.preload(key, blob);
  } else {
    ensureBaseConfig(ctx);
    await seedDemo(ctx, { passwords: false });
    if (persistence) {
      await persistence.clear();
      await persistence.saveSnapshot(DATA_VERSION, store.snapshot());
      for (const key of files.keys()) {
        const blob = await files.get(key);
        if (blob) await persistence.saveFile(key, blob);
      }
    }
  }
  if (persistence) {
    let timer: number | undefined;
    store.onCommit = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void persistence.saveSnapshot(DATA_VERSION, store.snapshot()), 700);
    };
    files.onPut = (key, blob) => void persistence.saveFile(key, blob);
  }

  const app = createApp(ctx);
  const client = new ApiClient({ transport: async (req) => app.fetch(req), base: BASE, mode: "demo", tokenKey: TOKEN_KEY });

  // Start signed in as Wahid (the QA analyst from the brief), or as whoever the viewer switched to.
  const current = client.token ? await resolveSession(ctx, client.token) : null;
  if (!current) {
    const wahid = store.findOne("users", { email: "wahid.hasan@bugloop.test" }) ?? store.find("users", { where: { active: true } })[0];
    const session = await demoLogin(ctx, wahid.id);
    client.setToken(session.token);
  }

  window.addEventListener("bugloop:reset-demo", () => {
    void (async () => {
      await persistence?.clear();
      client.setToken(null);
      window.location.reload();
    })();
  });

  root.render(
    <StrictMode>
      <BugloopApp client={client} router="memory" />
    </StrictMode>,
  );

  // Light up Claude when the page runs inside a claude.ai viewer that grants `sample`.
  try {
    const sample = (await window.claude?.use?.("sample")) as SampleFn | null | undefined;
    if (sample) {
      const limits = await sample.limits().catch(() => null);
      ctx.ai = new SampleProvider(sample, limits?.images ?? null);
      window.dispatchEvent(new Event("bugloop:ai-changed"));
    }
  } catch {
    // Not in a viewer: the offline assistant stays in place.
  }
}

start().catch((err) => {
  console.error(err);
  root.render(<Splash text="The demo couldn't start. Reload the page to try again." />);
});
