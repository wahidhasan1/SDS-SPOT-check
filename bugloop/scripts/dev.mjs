// Runs the API (with reload on change) and the Vite dev server together.
import { spawn } from "node:child_process";

const procs = [
  spawn("npx", ["tsx", "watch", "--clear-screen=false", "src/server/node.ts"], {
    stdio: "inherit",
    env: { ...process.env, PORT: process.env.PORT ?? "3000", BUGLOOP_DEV: "1" },
  }),
  spawn("npx", ["vite"], { stdio: "inherit", env: process.env }),
];

function shutdown(code = 0) {
  for (const p of procs) if (!p.killed) p.kill("SIGTERM");
  process.exit(code);
}

for (const p of procs) p.on("exit", (code) => shutdown(code ?? 0));
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
