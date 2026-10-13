import { openSync, readSync, readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * Offline English dictionary backed by Princeton WordNet 3.1 (npm: wordnet-db, WordNet licence).
 * Provides definitions, examples and synonyms, a simplified Lesk algorithm to choose the
 * sense that best fits a sentence, and a known-word check for spelling feedback.
 */
const require = createRequire(import.meta.url);
const dictDir: string = (() => {
  try {
    return require('wordnet-db').path as string;
  } catch {
    return '';
  }
})();

type Pos = 'noun' | 'verb' | 'adj' | 'adv';
const POS_FILES: Pos[] = ['noun', 'verb', 'adj', 'adv'];
const POS_LABEL: Record<Pos, string> = { noun: 'noun', verb: 'verb', adj: 'adjective', adv: 'adverb' };

let index: Map<string, { pos: Pos; offsets: number[] }[]> | null = null;
const fds: Partial<Record<Pos, number>> = {};

function loadIndex() {
  if (index) return index;
  index = new Map();
  if (!dictDir) return index;
  for (const pos of POS_FILES) {
    const file = join(dictDir, `index.${pos}`);
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, 'latin1').split('\n');
    for (const line of lines) {
      if (!line || line.startsWith(' ')) continue;
      const parts = line.trim().split(' ');
      const lemma = parts[0];
      const pCnt = Number(parts[3]);
      const senseCnt = Number(parts[2]);
      const offsets = parts.slice(4 + pCnt + 2, 4 + pCnt + 2 + senseCnt).map(Number);
      const arr = index.get(lemma) ?? [];
      arr.push({ pos, offsets });
      index.set(lemma, arr);
    }
  }
  return index;
}

export function dictionaryAvailable(): boolean {
  return loadIndex().size > 0;
}

interface Synset {
  pos: Pos;
  words: string[];
  definition: string;
  examples: string[];
}

function readSynset(pos: Pos, offset: number): Synset | null {
  if (fds[pos] === undefined) fds[pos] = openSync(join(dictDir, `data.${pos}`), 'r');
  const buf = Buffer.alloc(4096);
  const n = readSync(fds[pos]!, buf, 0, 4096, offset);
  const line = buf.subarray(0, n).toString('latin1').split('\n')[0];
  const [head, gloss = ''] = line.split(' | ');
  const parts = head.split(' ');
  const wCnt = parseInt(parts[3], 16);
  const words: string[] = [];
  for (let i = 0; i < wCnt; i++) words.push(parts[4 + i * 2].replace(/_/g, ' ').replace(/\(.*\)$/, ''));
  const segs = gloss.split(';').map((s) => s.trim()).filter(Boolean);
  const definition = segs.filter((s) => !s.startsWith('"')).join('; ');
  const examples = segs.filter((s) => s.startsWith('"')).map((s) => s.replace(/^"|"$/g, ''));
  return { pos, words, definition, examples };
}

const IRREGULAR: Record<string, string> = {
  went: 'go', gone: 'go', was: 'be', were: 'be', been: 'be', is: 'be', are: 'be', am: 'be', had: 'have', has: 'have',
  did: 'do', done: 'do', saw: 'see', seen: 'see', took: 'take', taken: 'take', gave: 'give', given: 'give', made: 'make',
  came: 'come', knew: 'know', known: 'know', thought: 'think', brought: 'bring', bought: 'buy', caught: 'catch', taught: 'teach',
  felt: 'feel', left: 'leave', kept: 'keep', slept: 'sleep', met: 'meet', ran: 'run', began: 'begin', begun: 'begin', wrote: 'write',
  written: 'write', spoke: 'speak', spoken: 'speak', broke: 'break', broken: 'break', chose: 'choose', chosen: 'choose', drove: 'drive',
  driven: 'drive', ate: 'eat', eaten: 'eat', fell: 'fall', fallen: 'fall', found: 'find', got: 'get', gotten: 'get', grew: 'grow',
  grown: 'grow', held: 'hold', heard: 'hear', lost: 'lose', meant: 'mean', paid: 'pay', said: 'say', sold: 'sell', sent: 'send',
  stood: 'stand', told: 'tell', understood: 'understand', won: 'win', wore: 'wear', worn: 'wear', children: 'child', men: 'man',
  women: 'woman', people: 'person', feet: 'foot', teeth: 'tooth', mice: 'mouse', better: 'good', best: 'good', worse: 'bad', worst: 'bad',
  lay: 'lie', lain: 'lie', rose: 'rise', risen: 'rise', shook: 'shake', drew: 'draw', drawn: 'draw', flew: 'fly', flown: 'fly',
  threw: 'throw', thrown: 'throw', swam: 'swim', sang: 'sing', sung: 'sing', hid: 'hide', hidden: 'hide', forgot: 'forget', forgotten: 'forget',
  led: 'lead', fed: 'feed', fought: 'fight', sought: 'seek', struck: 'strike', bore: 'bear', borne: 'bear', dealt: 'deal', lent: 'lend',
  spent: 'spend', built: 'build', bent: 'bend', shot: 'shoot', stuck: 'stick', hung: 'hang', dug: 'dig', wove: 'weave', woven: 'weave',
  crises: 'crisis', analyses: 'analysis', phenomena: 'phenomenon', criteria: 'criterion', data: 'datum', lives: 'life', wives: 'wife',
  knives: 'knife', leaves: 'leaf', halves: 'half', selves: 'self', shelves: 'shelf', thieves: 'thief', wolves: 'wolf',
};

const SUFFIX_RULES: Record<Pos, [string, string][]> = {
  noun: [['ses', 's'], ['xes', 'x'], ['zes', 'z'], ['ches', 'ch'], ['shes', 'sh'], ['men', 'man'], ['ies', 'y'], ['s', '']],
  verb: [['ies', 'y'], ['es', 'e'], ['es', ''], ['s', ''], ['ied', 'y'], ['ed', 'e'], ['ed', ''], ['ing', 'e'], ['ing', '']],
  adj: [['ier', 'y'], ['iest', 'y'], ['er', ''], ['est', ''], ['er', 'e'], ['est', 'e']],
  adv: [],
};

/** Returns candidate base forms (lemma, pos) that exist in WordNet, most likely first. */
export function lemmatize(word: string): { lemma: string; pos: Pos }[] {
  const idx = loadIndex();
  const w = word.toLowerCase().replace(/’/g, "'").replace(/\s+/g, '_');
  const out: { lemma: string; pos: Pos }[] = [];
  const seen = new Set<string>();
  const add = (lemma: string, pos: Pos) => {
    const k = lemma + ':' + pos;
    if (seen.has(k)) return;
    const entries = idx.get(lemma);
    if (entries?.some((e) => e.pos === pos)) {
      seen.add(k);
      out.push({ lemma, pos });
    }
  };
  for (const pos of POS_FILES) add(w, pos);
  const irr = IRREGULAR[w];
  if (irr) for (const pos of POS_FILES) add(irr, pos);
  for (const pos of POS_FILES) {
    for (const [suf, rep] of SUFFIX_RULES[pos]) {
      if (w.endsWith(suf) && w.length > suf.length + 1) add(w.slice(0, -suf.length) + rep, pos);
    }
    // doubled consonant: running -> run, stopped -> stop
    const m = w.match(/^(.*([bcdfgklmnprstvz]))\2(ing|ed|er|est)$/);
    if (m) add(m[1], pos);
  }
  return out;
}

const STOP = new Set(
  'a an the and or but if of to in on at by for with from as is are was were be been being am i you he she it we they me him her us them my your his its our their this that these those there here not no do does did have has had will would can could should may might must so than then too very just also into over about up down out what which who whom whose when where why how all any some each few more most other such only own same one someone something'.split(' '),
);

function contentWords(text: string): Set<string> {
  const words = (text.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => !STOP.has(w) && w.length > 2);
  const out = new Set<string>();
  for (const w of words) {
    out.add(w);
    const l = lemmatize(w)[0];
    if (l) out.add(l.lemma);
  }
  return out;
}

const POS_BY_LABEL: Record<string, Pos> = { noun: 'noun', verb: 'verb', adjective: 'adj', adverb: 'adv' };
const DETERMINERS = new Set('a an the my your his her our their this that these those its every each some any no'.split(' '));
const VERB_BEFORE = new Set("to will would can could should must may might shall do does did don't didn't doesn't won't can't let".split(' '));
const BE = new Set('is are was were am be been being "s "re'.split(' '));

/** Part-of-speech hints from morphology and the previous word (used alongside Lesk overlap). */
function posPrior(word: string, sentence?: string): Partial<Record<Pos, number>> {
  const w = word.toLowerCase();
  const prior: Partial<Record<Pos, number>> = {};
  const add = (p: Pos, v: number) => (prior[p] = (prior[p] ?? 0) + v);
  if (IRREGULAR[w] && !['children', 'men', 'women', 'people', 'feet', 'teeth', 'mice', 'better', 'best', 'worse', 'worst'].includes(w) && !/(es|a|on)$/.test(w)) add('verb', 1);
  if (/ed$/.test(w)) add('verb', 0.6);
  if (!sentence) return prior;
  const toks: string[] = sentence.toLowerCase().replace(/’/g, "'").match(/[a-z']+/g) ?? [];
  const i = toks.indexOf(w);
  const prev = i > 0 ? toks[i - 1] : '';
  if (VERB_BEFORE.has(prev)) add('verb', 1.2);
  if (DETERMINERS.has(prev)) {
    add('noun', 0.8);
    add('adj', 0.4);
  }
  if (/ing$/.test(w) && (BE.has(prev) || /n't$/.test(prev))) add('verb', 1.2);
  if (/ly$/.test(w)) add('adv', 0.6);
  return prior;
}

export interface DictSense {
  partOfSpeech: string;
  definition: string;
  examples: string[];
  synonyms: string[];
}

export interface DictionaryResult {
  word: string;
  lemma: string;
  senses: DictSense[];
  bestSenseIndex: number;
  method: 'lesk' | 'most_frequent';
}

/** Looks up a word (or multi-word phrase) and ranks senses by overlap with the sentence (simplified Lesk). */
export function lookupWord(word: string, sentence?: string): DictionaryResult | null {
  const cands = lemmatize(word);
  if (cands.length === 0) return null;
  const idx = loadIndex();
  const senses: (DictSense & { rank: number; overlap: number; lemma: string })[] = [];
  const lemma = cands[0].lemma;
  const ctx = sentence ? contentWords(sentence) : new Set<string>();
  ctx.delete(word.toLowerCase());
  for (const c of cands) ctx.delete(c.lemma);
  const prior = posPrior(word, sentence);
  const seenOffsets = new Set<string>();
  for (const c of cands) {
    const entry = idx.get(c.lemma)?.find((e) => e.pos === c.pos);
    if (!entry) continue;
    entry.offsets.forEach((off, rank) => {
      const key = `${c.pos}:${off}`;
      if (seenOffsets.has(key)) return;
      seenOffsets.add(key);
      const s = readSynset(c.pos, off);
      if (!s) return;
      const sig = contentWords(`${s.definition} ${s.examples.join(' ')} ${s.words.join(' ')}`);
      let overlap = 0;
      for (const w of ctx) if (sig.has(w)) overlap++;
      senses.push({
        partOfSpeech: POS_LABEL[c.pos],
        definition: s.definition,
        examples: s.examples,
        synonyms: s.words.filter((x) => x.toLowerCase() !== c.lemma.replace(/_/g, ' ')).slice(0, 6),
        rank,
        lemma: c.lemma,
        overlap: overlap + (prior[c.pos] ?? 0),
      });
    });
  }
  if (senses.length === 0) return null;
  // Frequency prior: earlier WordNet senses are more common.
  const scored = senses.map((s) => ({ s, score: s.overlap - s.rank * 0.15 })).sort((a, b) => b.score - a.score);
  const top = scored[0].s;
  const usedLesk = sentence ? top.overlap - (prior[POS_BY_LABEL[top.partOfSpeech]] ?? 0) > 0 : false;
  return {
    word,
    lemma: (top.lemma ?? lemma).replace(/_/g, ' '),
    senses: scored.slice(0, 12).map(({ s: { rank: _r, overlap: _o, lemma: _l, ...rest } }) => rest),
    bestSenseIndex: 0,
    method: usedLesk ? 'lesk' : 'most_frequent',
  };
}

const FUNCTION_WORDS = new Set(
  `a an the and or but nor so yet for of to in on at by with from as into onto upon about above below over under between among through during before after since until while although though because if unless whether than then that this these those there here who whom whose which what when where why how i me my mine myself you your yours yourself yourselves he him his himself she her hers herself it its itself we us our ours ourselves they them their theirs themselves is am are was were be been being have has had having do does did doing will would shall should can could may might must ought not no yes all any both each either neither every few many much more most other another some such own same several none nothing something anything everything someone anyone everyone somebody anybody everybody nobody one ones its it's i'm i've i'd i'll you're you've you'd you'll he's she's we're we've they're they've they'd don't doesn't didn't can't couldn't won't wouldn't shouldn't isn't aren't wasn't weren't hasn't haven't hadn't let's that's there's what's who's mustn't mightn't needn't per via etc ok okay also too very just only even still already yet ago`.split(/\s+/),
);

export function isKnownWord(word: string): boolean {
  const w = word.toLowerCase().replace(/’/g, "'");
  if (w.length <= 1 || /\d/.test(w)) return true;
  if (FUNCTION_WORDS.has(w)) return true;
  if (w.endsWith('s') && FUNCTION_WORDS.has(w.slice(0, -1))) return true; // others, ones
  if (lemmatize(w).length > 0) return true;
  if (w.includes('-')) return w.split('-').every((p) => isKnownWord(p));
  if (w.endsWith("'s")) return isKnownWord(w.slice(0, -2));
  if (w.endsWith('ly') && lemmatize(w.slice(0, -2)).length) return true;
  return false;
}

const ALPHA = 'abcdefghijklmnopqrstuvwxyz';
/** Spelling suggestions within edit distance 1 (deletes, transposes, replaces, inserts). */
export function spellingSuggestions(word: string, max = 3): string[] {
  const w = word.toLowerCase();
  const cands = new Set<string>();
  for (let i = 0; i <= w.length; i++) {
    const a = w.slice(0, i);
    const b = w.slice(i);
    if (b) cands.add(a + b.slice(1));
    if (b.length > 1) cands.add(a + b[1] + b[0] + b.slice(2));
    for (const ch of ALPHA) {
      if (b) cands.add(a + ch + b.slice(1));
      cands.add(a + ch + b);
    }
  }
  const out: string[] = [];
  for (const c of cands) {
    if (c !== w && c.length > 1 && (FUNCTION_WORDS.has(c) || loadIndex().has(c))) out.push(c);
    if (out.length >= max) break;
  }
  return out;
}
