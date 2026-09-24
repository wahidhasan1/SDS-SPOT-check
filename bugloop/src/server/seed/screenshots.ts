// Synthetic screenshots for demo evidence: simple SVG mock-ups of the product under test,
// with the kind of red markup a QA analyst adds before attaching a screenshot.

export interface ShotSpec {
  app: string;
  nav: string[];
  active: string;
  crumbs: string[];
  heading: string;
  fields?: { label: string; value: string; mark?: boolean }[];
  table?: { columns: string[]; rows: string[][]; markRow?: number };
  toast?: { tone: "success" | "error" | "info"; text: string };
  banner?: { tone: "error" | "warning"; text: string };
  note?: string;
  mobile?: boolean;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TONES = {
  success: { bg: "#e7f6ec", border: "#34a853", text: "#1e6b35" },
  error: { bg: "#fdecea", border: "#d93025", text: "#a50e0e" },
  info: { bg: "#e8f0fe", border: "#1a73e8", text: "#174ea6" },
  warning: { bg: "#fef7e0", border: "#f9ab00", text: "#8a5a00" },
} as const;

function desktop(s: ShotSpec): string {
  const W = 960;
  const H = 600;
  const out: string[] = [];
  out.push(`<rect width="${W}" height="${H}" fill="#f4f6f9"/>`);
  out.push(`<rect width="${W}" height="48" fill="#12324f"/>`);
  out.push(`<text x="20" y="30" font-size="16" font-weight="700" fill="#ffffff">${esc(s.app)}</text>`);
  out.push(`<circle cx="${W - 36}" cy="24" r="14" fill="#2c5a82"/><text x="${W - 36}" y="29" font-size="11" fill="#fff" text-anchor="middle">QA</text>`);
  out.push(`<rect y="48" width="190" height="${H - 48}" fill="#ffffff" stroke="#e1e5eb"/>`);
  s.nav.forEach((n, i) => {
    const y = 80 + i * 36;
    const on = n === s.active;
    if (on) out.push(`<rect x="10" y="${y - 20}" width="170" height="30" rx="6" fill="#e7eff8"/>`);
    out.push(`<text x="24" y="${y}" font-size="13" fill="${on ? "#12324f" : "#5b6675"}" font-weight="${on ? 600 : 400}">${esc(n)}</text>`);
  });
  const x0 = 214;
  out.push(`<text x="${x0}" y="80" font-size="12" fill="#6b7785">${esc(s.crumbs.join("  ›  "))}</text>`);
  out.push(`<text x="${x0}" y="110" font-size="20" font-weight="700" fill="#16202c">${esc(s.heading)}</text>`);
  let y = 132;
  if (s.banner) {
    const t = TONES[s.banner.tone];
    out.push(`<rect x="${x0}" y="${y}" width="${W - x0 - 24}" height="38" rx="6" fill="${t.bg}" stroke="${t.border}"/>`);
    out.push(`<text x="${x0 + 14}" y="${y + 24}" font-size="13" fill="${t.text}">${esc(s.banner.text)}</text>`);
    y += 54;
  }
  for (const f of s.fields ?? []) {
    out.push(`<text x="${x0}" y="${y + 14}" font-size="12" fill="#5b6675">${esc(f.label)}</text>`);
    out.push(`<rect x="${x0}" y="${y + 22}" width="340" height="34" rx="6" fill="#ffffff" stroke="#cfd6df"/>`);
    out.push(`<text x="${x0 + 12}" y="${y + 44}" font-size="13" fill="#16202c">${esc(f.value)}</text>`);
    if (f.mark) out.push(`<rect x="${x0 - 6}" y="${y + 16}" width="352" height="46" rx="8" fill="none" stroke="#e5352b" stroke-width="3"/>`);
    y += 70;
  }
  if (s.table) {
    const cols = s.table.columns.length;
    const tw = W - x0 - 24;
    const cw = tw / cols;
    out.push(`<rect x="${x0}" y="${y}" width="${tw}" height="${34 + s.table.rows.length * 34}" rx="6" fill="#ffffff" stroke="#e1e5eb"/>`);
    s.table.columns.forEach((c, i) => out.push(`<text x="${x0 + 12 + i * cw}" y="${y + 22}" font-size="12" font-weight="600" fill="#5b6675">${esc(c)}</text>`));
    s.table.rows.forEach((r, ri) => {
      const ry = y + 34 + ri * 34;
      out.push(`<line x1="${x0}" x2="${x0 + tw}" y1="${ry}" y2="${ry}" stroke="#eef1f5"/>`);
      r.forEach((cell, ci) => out.push(`<text x="${x0 + 12 + ci * cw}" y="${ry + 22}" font-size="12" fill="#16202c">${esc(cell)}</text>`));
      if (s.table!.markRow === ri) out.push(`<rect x="${x0 + 2}" y="${ry + 2}" width="${tw - 4}" height="30" rx="4" fill="none" stroke="#e5352b" stroke-width="3"/>`);
    });
    y += 44 + s.table.rows.length * 34;
  }
  if (s.toast) {
    const t = TONES[s.toast.tone];
    const tw = Math.max(220, s.toast.text.length * 7.2 + 40);
    out.push(`<rect x="${W - tw - 24}" y="64" width="${tw}" height="40" rx="8" fill="${t.bg}" stroke="${t.border}"/>`);
    out.push(`<text x="${W - tw - 8}" y="89" font-size="13" fill="${t.text}">${esc(s.toast.text)}</text>`);
  }
  if (s.note) {
    const nw = Math.min(360, Math.max(200, s.note.length * 7 + 24));
    out.push(`<rect x="${W - nw - 24}" y="${H - 84}" width="${nw}" height="56" rx="6" fill="#fff4f2" stroke="#e5352b" stroke-width="2"/>`);
    out.push(`<text x="${W - nw - 12}" y="${H - 51}" font-size="13" font-weight="600" fill="#c5221f">${esc(s.note)}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Helvetica, Arial, sans-serif">${out.join("")}</svg>`;
}

function mobile(s: ShotSpec): string {
  const W = 390;
  const H = 780;
  const out: string[] = [];
  out.push(`<rect width="${W}" height="${H}" rx="36" fill="#0f1720"/>`);
  out.push(`<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="28" fill="#f4f6f9"/>`);
  out.push(`<rect x="12" y="12" width="${W - 24}" height="92" rx="28" fill="#12324f"/><rect x="12" y="70" width="${W - 24}" height="34" fill="#12324f"/>`);
  out.push(`<text x="36" y="52" font-size="13" fill="#9fb4c9">9:41</text>`);
  out.push(`<text x="36" y="90" font-size="18" font-weight="700" fill="#fff">${esc(s.heading)}</text>`);
  let y = 132;
  out.push(`<text x="36" y="${y}" font-size="12" fill="#6b7785">${esc(s.crumbs.join(" › "))}</text>`);
  y += 18;
  if (s.banner) {
    const t = TONES[s.banner.tone];
    out.push(`<rect x="28" y="${y}" width="${W - 56}" height="54" rx="10" fill="${t.bg}" stroke="${t.border}"/>`);
    out.push(`<text x="42" y="${y + 32}" font-size="13" fill="${t.text}">${esc(s.banner.text)}</text>`);
    y += 70;
  }
  for (const f of s.fields ?? []) {
    out.push(`<rect x="28" y="${y}" width="${W - 56}" height="58" rx="10" fill="#fff" stroke="#dfe4ea"/>`);
    out.push(`<text x="42" y="${y + 22}" font-size="11" fill="#6b7785">${esc(f.label)}</text>`);
    out.push(`<text x="42" y="${y + 43}" font-size="15" fill="#16202c">${esc(f.value)}</text>`);
    if (f.mark) out.push(`<rect x="22" y="${y - 6}" width="${W - 44}" height="70" rx="12" fill="none" stroke="#e5352b" stroke-width="3"/>`);
    y += 70;
  }
  for (const [ri, r] of (s.table?.rows ?? []).entries()) {
    out.push(`<rect x="28" y="${y}" width="${W - 56}" height="48" rx="10" fill="#fff" stroke="#dfe4ea"/>`);
    out.push(`<text x="42" y="${y + 29}" font-size="13" fill="#16202c">${esc(r.join("  ·  "))}</text>`);
    if (s.table!.markRow === ri) out.push(`<rect x="22" y="${y - 5}" width="${W - 44}" height="58" rx="12" fill="none" stroke="#e5352b" stroke-width="3"/>`);
    y += 58;
  }
  if (s.toast) {
    const t = TONES[s.toast.tone];
    out.push(`<rect x="28" y="${H - 120}" width="${W - 56}" height="46" rx="12" fill="${t.bg}" stroke="${t.border}"/>`);
    out.push(`<text x="44" y="${H - 91}" font-size="13" fill="${t.text}">${esc(s.toast.text)}</text>`);
  }
  if (s.note) out.push(`<text x="36" y="${H - 44}" font-size="13" font-weight="600" fill="#c5221f">${esc(s.note)}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, Segoe UI, Helvetica, Arial, sans-serif">${out.join("")}</svg>`;
}

export function screenshotSvg(spec: ShotSpec): string {
  return spec.mobile ? mobile(spec) : desktop(spec);
}

export function screenshotFile(name: string, spec: ShotSpec) {
  const svg = screenshotSvg(spec);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  return { name, type: "image/svg+xml", size: blob.size, blob };
}

export function logFile(name: string, text: string) {
  const blob = new Blob([text], { type: "text/plain" });
  return { name, type: "text/plain", size: blob.size, blob };
}
