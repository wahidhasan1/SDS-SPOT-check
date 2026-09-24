// Node entry point: SQLite + disk uploads + the Hono app + the built web UI.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createApp } from "./app";
import { SystemClock, type AppContext } from "./context";
import { SqliteStore } from "./db/sqlite";
import { DiskFileStore } from "./files/disk";
import { AnthropicProvider, type Effort } from "./ai/anthropic";
import { OfflineProvider } from "./ai/heuristic";
import { ensureBaseConfig } from "./seed/base";
import { seedDemo } from "./seed/demo";

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;

const port = Number(env.PORT ?? 3000);
const dataDir = resolve(env.BUGLOOP_DATA_DIR ?? "data");
mkdirSync(join(dataDir, "uploads"), { recursive: true });

const store = new SqliteStore(join(dataDir, "bugloop.db"));
const efforts: Effort[] = ["low", "medium", "high", "xhigh", "max"];
const effort = efforts.includes(env.BUGLOOP_AI_EFFORT as Effort) ? (env.BUGLOOP_AI_EFFORT as Effort) : "medium";

const ai = env.ANTHROPIC_API_KEY
  ? new AnthropicProvider({
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.BUGLOOP_AI_MODEL || "claude-opus-5",
      effort,
      fallbacks: env.BUGLOOP_AI_FALLBACKS !== "off",
    })
  : new OfflineProvider();

const ctx: AppContext = {
  store,
  files: new DiskFileStore(join(dataDir, "uploads")),
  ai,
  clock: new SystemClock(),
  config: {
    mode: "server",
    demoLogin: env.BUGLOOP_DEMO_LOGIN !== "false",
    maxUploadBytes: Number(env.BUGLOOP_MAX_UPLOAD_MB ?? 50) * 1_048_576,
    sessionDays: 30,
  },
};

ensureBaseConfig(ctx);
if (store.isEmpty() && (env.BUGLOOP_SEED ?? "demo") === "demo") {
  console.log("[bugloop] Empty database: seeding demo workspace…");
  const summary = await seedDemo(ctx);
  console.log(`[bugloop] Seeded ${summary.bugs} bugs, ${summary.users} people, ${summary.projects} projects.`);
}

const root = new Hono();
root.route("/", createApp(ctx));

// Serve the built UI when present (npm run build). In development Vite serves it instead.
const webDir = [resolve(here, "../web"), resolve(here, "../../dist/web")].find((d) => existsSync(join(d, "index.html")));
if (webDir) {
  const indexHtml = readFileSync(join(webDir, "index.html"), "utf8");
  root.use("/assets/*", serveStatic({ root: webDir.replace(process.cwd(), ".") || "." }));
  root.get("*", (c) => (c.req.path.startsWith("/api/") ? c.notFound() : c.html(indexHtml)));
}

serve({ fetch: root.fetch, port }, (info) => {
  console.log(`[bugloop] API ${webDir ? "and web app " : ""}listening on http://localhost:${info.port}`);
  console.log(`[bugloop] AI: ${ai.status().label}${env.ANTHROPIC_API_KEY ? "" : " — set ANTHROPIC_API_KEY to enable Claude"}`);
  if (!webDir) console.log("[bugloop] Web UI: run `npm run dev` (Vite on :5173) or `npm run build` first.");
});
