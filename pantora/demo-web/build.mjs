// Builds the hosted demo: one self-contained HTML page (app code, styles,
// fonts, and SQLite WebAssembly inlined) at dist/pantora-demo.html.
//
//   npm run build:demo
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");
const shims = path.join(root, "demo-web", "shims");
const outDir = path.join(root, "dist");
const tmpDir = path.join(root, "demo-web", ".out");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

// Server modules that have browser replacements in the hosted demo.
const REDIRECTS = new Map([
  [path.join(src, "server/db/index"), path.join(shims, "db-index.ts")],
  [path.join(src, "server/db"), path.join(shims, "db-index.ts")],
  [path.join(src, "server/config"), path.join(shims, "config.ts")],
  [path.join(src, "server/admin"), path.join(shims, "admin.ts")],
  [path.join(src, "server/ai/anthropic"), path.join(root, "demo-web/claude-provider.ts")],
]);

const redirectPlugin = {
  name: "pantora-redirects",
  setup(b) {
    b.onResolve({ filter: /^(@\/|\.)/ }, (args) => {
      const base = args.path.startsWith("@/") ? path.join(src, args.path.slice(2)) : path.resolve(args.resolveDir, args.path);
      const key = base.replace(/\.(ts|tsx)$/, "");
      const target = REDIRECTS.get(key);
      return target ? { path: target } : undefined;
    });
  },
};

const result = await build({
  entryPoints: [path.join(root, "demo-web/entry.tsx")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  write: false,
  jsx: "automatic",
  legalComments: "none",
  tsconfig: path.join(root, "tsconfig.json"),
  loader: { ".wasm": "binary" },
  define: { "process.env.NODE_ENV": '"production"' },
  inject: [path.join(root, "demo-web/process-shim.js")],
  alias: {
    "next/link": path.join(shims, "next-link.tsx"),
    "next/navigation": path.join(shims, "next-navigation.ts"),
    "next/headers": path.join(shims, "next-headers.ts"),
    "next/server": path.join(shims, "next-server.ts"),
    "server-only": path.join(shims, "empty.ts"),
  },
  // CSS is compiled separately by Tailwind.
  external: ["*.css"],
  plugins: [redirectPlugin],
  logLevel: "warning",
});
const js = result.outputFiles[0].text;

// Tailwind CSS (scans the source for classes) plus the self-hosted font.
const cssOut = path.join(tmpDir, "app.css");
execFileSync(path.join(root, "node_modules/.bin/tailwindcss"), ["-i", path.join(src, "app/globals.css"), "-o", cssOut, "--minify"], {
  cwd: root,
  stdio: ["ignore", "ignore", "inherit"],
});
const font = fs.readFileSync(path.join(root, "node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2"));
const displayFont = fs.readFileSync(path.join(root, "node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2"));
const fontFace =
  `@font-face{font-family:"Plus Jakarta Sans Variable";font-style:normal;font-display:swap;font-weight:200 800;src:url(data:font/woff2;base64,${font.toString("base64")}) format("woff2")}` +
  `@font-face{font-family:"Bricolage Grotesque Variable";font-style:normal;font-display:swap;font-weight:200 800;src:url(data:font/woff2;base64,${displayFont.toString("base64")}) format("woff2")}`;
const css = fontFace + fs.readFileSync(cssOut, "utf8");

const html = `<title>Pantora Demo</title>
<meta name="description" content="Interactive demo of Pantora, a voice-first English speaking practice platform.">
<style>${css}
#pantora-boot{min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:#f6f4ff;color:#625c80;font:15px/1.5 "Plus Jakarta Sans Variable",system-ui,sans-serif}
#pantora-boot span{width:40px;height:40px;border-radius:12px;background:#11153a;animation:pboot 1.2s ease-in-out infinite}
@keyframes pboot{50%{opacity:.4}}
@media (prefers-reduced-motion:reduce){#pantora-boot span{animation:none}}
</style>
<div id="pantora-root"><div id="pantora-boot"><span aria-hidden="true"></span>Loading the Pantora demo…</div></div>
<script>window.__PANTORA_HOSTED__=true;</script>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>
`;
const outFile = path.join(outDir, "pantora-demo.html");
fs.writeFileSync(outFile, html);
console.log(`Built ${path.relative(root, outFile)} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
