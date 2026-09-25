// Small text utilities shared by similarity search, the offline assistant and the UI.

export const STOP_WORDS = new Set(
  (
    "a an and are as at be been being but by can could did do does doing done for from had has have having he her " +
    "here hers him his how i if in into is it its itself just let me my myself of off on once only or other our " +
    "ours out over own same she should so some such than that the their theirs them then there these they this " +
    "those through to too under until up very was we were what when where which while who whom why will with " +
    "would you your yours yourself also again after before above below between both each few more most any all " +
    "no nor not now very s t get got getting gets see seen shows show shown showing appear appears appeared still even " +
    "please thing things something page screen user users click clicked clicking open opened opening go goes went"
  ).split(/\s+/),
);

/** Words that carry meaning for bug similarity even though they are short or common. */
const KEEP = new Set(["ui", "id", "pdf", "csv", "api", "sso", "ios", "mac", "2fa", "sds", "ehs"]);

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Very small suffix stemmer: "saving", "saved", "saves" → "sav". */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es") && !w.endsWith("ses")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) w = w.slice(0, -1);
  if (w.length > 4 && /([bcdfgklmnprt])\1$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

export interface Token {
  stem: string;
  surface: string;
}

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const words = text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9æøåäöü]+/i);
  for (const raw of words) {
    if (!raw) continue;
    if (/^\d+$/.test(raw) && raw.length < 3) continue;
    if (raw.length < 3 && !KEEP.has(raw)) continue;
    if (STOP_WORDS.has(raw)) continue;
    out.push({ stem: stem(raw), surface: raw });
  }
  return out;
}

/**
 * Common bug "concepts": different words for the same symptom map to one token so that
 * "role does not save" and "role reverts after reopening" are recognised as related.
 */
export const CONCEPTS: { key: string; label: string; pattern: RegExp }[] = [
  {
    key: "persistence",
    label: "change not kept",
    pattern:
      /\b(not|n't|never|doesnt|isnt|wont|arent)\s+(being\s+|getting\s+|be\s+)?(sav|persist|stor|kept|retain|updat)|\brevert|\bresets?\b|\b(old|previous|original|former)\s+(value|role|setting|data|name|status|selection|one)|\b(changes?|edits?|updates?|selection)\s+(are\s+|is\s+|get\s+|gets\s+)?(lost|gone|disappear|discard|undone)|\bdisappear|\bback to (the )?(old|previous|original|default)|\bnot (stick|applied)|\bdo(es)?n'?t stick/i,
  },
  { key: "crash", label: "crash or freeze", pattern: /\bcrash|\bfreez|\bhangs?\b|unresponsive|white screen|blank (page|screen)|\bstuck\b/i },
  { key: "error", label: "error message", pattern: /\berror\b|exception|\b50[0-4]\b|internal server|something went wrong|stack ?trace|failed to\b/i },
  { key: "performance", label: "slow or timeout", pattern: /\bslow|takes? (too )?long|time(d)? ?out|\blag|loading forever|spinner (never|keeps)|performance/i },
  { key: "layout", label: "layout problem", pattern: /overlap|misalign|cut off|truncat|overflow|\blayout|alignment|off.?screen|hidden behind|z-index|squashed|clipped/i },
  { key: "missing", label: "missing content", pattern: /\bmissing\b|not (shown|visible|displayed|listed|appearing)|do(es)?n'?t (show|appear|display|load)|empty (list|table|state|dropdown)|\bno (data|results|options)\b/i },
  { key: "permission", label: "access or permissions", pattern: /permission|access denied|unauthori[sz]ed|forbidden|\b403\b|not allowed|privilege/i },
  { key: "validation", label: "validation", pattern: /validation|invalid|required field|accepts? (empty|invalid|wrong)|format(ted)? (wrong|incorrect)/i },
  { key: "duplicate_entry", label: "duplicated entries", pattern: /duplicate (entr|row|record|item)|shown twice|appears? twice|listed twice|double (entr|submit)/i },
  { key: "search", label: "search and filters", pattern: /\bsearch|\bfilter|\bsort/i },
  { key: "export", label: "export or download", pattern: /\bexport|\bdownload|\bpdf\b|excel|\bcsv\b|\bprint/i },
  { key: "upload", label: "upload", pattern: /\bupload|\battach|drag and drop/i },
  { key: "auth", label: "sign-in", pattern: /\blog ?in\b|sign ?in|log ?out|session|password|\bsso\b|2fa/i },
  { key: "notification", label: "notifications", pattern: /notification|\bemail|\balert\b|reminder/i },
  { key: "datetime", label: "dates and times", pattern: /\bdate\b|time ?zone|\butc\b|calendar|expir|deadline/i },
  { key: "translation", label: "language", pattern: /translat|language|locali[sz]|norwegian|swedish|danish|german/i },
];

export function concepts(text: string): string[] {
  return CONCEPTS.filter((c) => c.pattern.test(text)).map((c) => c.key);
}

export function conceptLabel(key: string): string {
  return CONCEPTS.find((c) => c.key === key)?.label ?? key;
}

export function trigrams(text: string): Set<string> {
  const s = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const set = new Set<string>();
  for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
  return set;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Split prose into sentences, keeping list items as separate sentences. */
export function sentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])(?<!\b(?:e\.g|i\.e|etc|vs)\.)\s+(?=[A-Za-z0-9"'(])/)
    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((s) => s.length > 0);
}

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function ensurePeriod(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return /[.!?:]$/.test(t) ? t : `${t}.`;
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/** Extract @mentions of the form @First Last or @first.last matched against a user list. */
export function findMentions(body: string, users: { id: string; name: string; email: string }[]): string[] {
  const found = new Set<string>();
  const lower = body.toLowerCase();
  for (const u of users) {
    const name = u.name.toLowerCase();
    const first = name.split(" ")[0];
    const handle = u.email.split("@")[0].toLowerCase();
    if (lower.includes(`@${name}`) || lower.includes(`@${handle}`) || new RegExp(`@${first}\\b`).test(lower)) {
      found.add(u.id);
    }
  }
  return [...found];
}
