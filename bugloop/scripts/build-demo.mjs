// Builds the single-file demo and writes an artifact-ready copy.
//
//   dist/demo/index.html    a complete HTML document (open it straight from disk)
//   dist/demo/bugloop.html  the same page without <html>/<head>/<body>, for hosts that wrap the
//                           page in their own skeleton (a claude.ai artifact): title first, then
//                           the font link, styles, the root element and the script.
import { readFile, writeFile } from "node:fs/promises";
import { build } from "vite";

await build({ configFile: "vite.demo.config.ts", logLevel: "warn" });

const html = await readFile("dist/demo/index.html", "utf8");

function take(re, label) {
  const m = html.match(re);
  if (!m) throw new Error(`build-demo: could not find ${label} in dist/demo/index.html`);
  return m[0];
}

const title = take(/<title>[\s\S]*?<\/title>/, "<title>");
const fonts = take(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, "the font stylesheet");
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0].replace(/<style[^>]*>/, "<style>"));
const scriptStart = html.indexOf('<script type="module"');
const scriptEnd = html.indexOf("</script>", scriptStart);
if (scriptStart < 0 || scriptEnd < 0) throw new Error("build-demo: could not find the module script");
const script = html.slice(scriptStart, scriptEnd + "</script>".length).replace(/<script type="module"[^>]*>/, '<script type="module">');
if (!styles.length) throw new Error("build-demo: no inlined styles found");

const page = [title, fonts, ...styles, '<div id="root"></div>', script, ""].join("\n");
await writeFile("dist/demo/bugloop.html", page);
console.log(`build-demo: dist/demo/index.html and dist/demo/bugloop.html (${(page.length / 1024).toFixed(0)} KB)`);
