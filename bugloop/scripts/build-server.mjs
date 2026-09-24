// Bundles the Node server into dist/server/index.mjs (dependencies stay in node_modules).
import { build } from "esbuild";

await build({
  entryPoints: ["src/server/node.ts"],
  outfile: "dist/server/index.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  sourcemap: true,
  define: { __BUGLOOP_MODE__: JSON.stringify("server") },
  logLevel: "info",
});
