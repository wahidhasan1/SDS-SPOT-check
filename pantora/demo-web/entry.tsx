// Hosted demo entry point: boots SQLite (WebAssembly), seeds demo data on first
// visit, routes API calls in-page, and renders the Pantora app.
import { createRoot } from "react-dom/client";
import initSqlJs from "sql.js/dist/sql-wasm-browser.js";
import wasmBinary from "../node_modules/sql.js/dist/sql-wasm-browser.wasm";
import { openBrowserDatabase, saveNow } from "./browser-db";
import { migrate } from "./shims/db-index";
import { seedIfEmpty } from "@/server/db/seed";
import { installFetchRouter } from "./api-router";
import { App } from "./app-router";
import { router } from "./router-core";
import { cookies } from "./shims/next-headers";
import { USER_COOKIE } from "@/server/auth";
import type { DatabaseSync } from "node:sqlite";

async function boot() {
  const root = document.getElementById("pantora-root")!;
  try {
    const SQL = await initSqlJs({ wasmBinary: wasmBinary as unknown as ArrayBuffer });
    const db = (await openBrowserDatabase(SQL)) as unknown as DatabaseSync;
    migrate(db);
    seedIfEmpty(db);
    await saveNow();
    installFetchRouter();
    // Returning visitors who are signed in start on their dashboard.
    if ((await cookies()).get(USER_COOKIE)) router.replace("/dashboard");
    createRoot(root).render(<App />);
  } catch (error) {
    console.error(error);
    root.innerHTML =
      '<div style="max-width:32rem;margin:4rem auto;padding:0 16px;font-family:system-ui,sans-serif"><h1 style="font-size:1.25rem">Pantora couldn\'t start</h1><p>This browser blocked something the demo needs (WebAssembly or storage). Try a current version of Chrome, Edge, Firefox, or Safari.</p></div>';
  }
}

// Claude access (for AI feedback) arrives asynchronously from the viewer.
window.claude?.use?.("sample")
  ?.then((s) => {
    window.__PANTORA_SAMPLE_READY__ = Boolean(s);
  })
  .catch(() => {
    window.__PANTORA_SAMPLE_READY__ = false;
  })
  .finally(() => window.dispatchEvent(new Event("pantora:sample")));
if (!window.claude?.use) {
  window.__PANTORA_SAMPLE_READY__ = false;
}

void boot();
