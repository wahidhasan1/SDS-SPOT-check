// Node entry point: SQLite + disk uploads + the Hono app + the built web UI.

import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
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

/** "1", "true", "yes", "on" → true; "0", "false", "no", "off" → false; anything else → undefined. */
function flag(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  const s = v.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return undefined;
}

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
    demoLogin: false, // decided below, once we know whether this database holds sample data
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
// Password-less "sign in as anyone" is for sample data only, unless explicitly configured.
ctx.config.demoLogin = flag(env.BUGLOOP_DEMO_LOGIN) ?? !!store.get("settings", "demo_data");

const root = new Hono();
root.route("/", createApp(ctx));

// Serve the built UI when present (npm run build). In development Vite serves it instead.
const webDir = [resolve(here, "../web"), resolve(here, "../../dist/web")].find((d) => existsSync(join(d, "index.html")));
if (webDir) {
  const indexPath = join(webDir, "index.html");
  let cached = { mtime: 0, html: "" };
  const indexHtml = () => {
    const mtime = statSync(indexPath).mtimeMs;
    if (mtime !== cached.mtime) cached = { mtime, html: readFileSync(indexPath, "utf8") };
    return cached.html;
  };
  root.use(
    "/assets/*",
    serveStatic({
      root: webDir.replace(process.cwd(), ".") || ".",
      onFound: (_path, c) => c.header("Cache-Control", "public, max-age=31536000, immutable"),
    }),
  );
  root.get("/assets/*", (c) => c.notFound());
  root.get("*", (c) => (c.req.path.startsWith("/api/") ? c.notFound() : c.html(indexHtml())));
}

serve({ fetch: root.fetch, port }, (info) => {
  console.log(`[bugloop] API ${webDir ? "and web app " : ""}listening on http://localhost:${info.port}`);
  console.log(`[bugloop] AI: ${ai.status().label}${env.ANTHROPIC_API_KEY ? "" : " — set ANTHROPIC_API_KEY to enable Claude"}`);
  if (ctx.config.demoLogin) console.log("[bugloop] Demo sign-in is on (sample data). Set BUGLOOP_DEMO_LOGIN=false to require passwords.");
  if (!webDir) console.log("[bugloop] Web UI: run `npm run dev` (Vite on :5173) or `npm run build` first.");
});
