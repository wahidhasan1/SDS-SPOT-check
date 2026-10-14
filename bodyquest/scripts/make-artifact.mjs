// Turns dist-demo/index.html (single-file build) into page content for hosts that
// supply their own <!doctype>/<head>/<body> skeleton: keeps title, styles and the
// inlined module script; drops the wrapper tags and the favicon link.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../dist-demo/index.html', import.meta.url), 'utf8');
const head = src.match(/<head>([\s\S]*?)<\/head>/i)[1];
const body = src.match(/<body>([\s\S]*?)<\/body>/i)[1];
const keep = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/<link rel="icon"[^>]*>/i, '')
  .replace(/<title>[\s\S]*?<\/title>/i, '');
const out = `<title>BODYQUEST</title>\n${keep.trim()}\n${body.trim()}\n`;
writeFileSync(new URL('../dist-demo/bodyquest.html', import.meta.url), out);
console.log(`dist-demo/bodyquest.html ${(out.length / 1024).toFixed(0)} kB`);
