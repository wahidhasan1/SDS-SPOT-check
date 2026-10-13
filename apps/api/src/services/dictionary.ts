import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

/**
 * Offline English dictionary based on Princeton WordNet 3.1 (npm package "wordnet-db").
 * - lemmatises inflected forms (rules + common irregulars),
 * - returns every sense with definition, examples, synonyms and antonyms,
 * - picks the sense that best fits the sentence with a simplified Lesk algorithm
 *   (word overlap between the sentence and each sense's gloss), clearly labelled as automatic.
 *
 * WordNet licence: https://wordnet.princeton.edu/license-and-commercial-use
 */
const require = createRequire(import.meta.url);
const DICT_DIR: string = (require('wordnet-db') as { path: string }).path;

type Pos = 'noun' | 'verb' | 'adj' | 'adv';
const POS_LIST: Pos[] = ['noun', 'verb', 'adj', 'adv'];
const POS_LABEL: Record<Pos, string> = { noun: 'noun', verb: 'verb', adj: 'adjective', adv: 'adverb' };

export interface Sense {
  pos: string;
  definition: string;
  examples: string[];
  synonyms: string[];
  antonyms: string[];
  score?: number;
}
export interface LookupResult {
  query: string;
  lemma: string;
  found: boolean;
  senses: Sense[];
  bestIndex: number | null;
  method: 'wordnet-lesk';
}

let index: Record<Pos, Map<string, number[]>> | null = null;
const fds: Partial<Record<Pos, number>> = {};

function loadIndex() {
  if (index) return index;
  const out = {} as Record<Pos, Map<string, number[]>>;
  for (const pos of POS_LIST) {
    const map = new Map<string, number[]>();
    const text = fs.readFileSync(path.join(DICT_DIR, `index.${pos}`), 'utf8');
    for (const line of text.split('\n')) {
      if (!line || line.startsWith(' ')) continue;
      const parts = line.trim().split(' ');
      const synsetCnt = Number(parts[2]);
      const offsets = parts.slice(parts.length - synsetCnt).map(Number);
      map.set(parts[0], offsets);
    }
    out[pos] = map;
  }
  index = out;
  return out;
}

function readSynset(pos: Pos, offset: number): string {
  fds[pos] ??= fs.openSync(path.join(DICT_DIR, `data.${pos}`), 'r');
  const buf = Buffer.alloc(8192);
  const n = fs.readSync(fds[pos]!, buf, 0, buf.length, offset);
  const s = buf.toString('utf8', 0, n);
  const end = s.indexOf('\n');
  return end === -1 ? s : s.slice(0, end);
}

interface Synset { words: string[]; gloss: string; antonymRefs: { pos: Pos; offset: number; target: number }[] }

const PTR_POS: Record<string, Pos> = { n: 'noun', v: 'verb', a: 'adj', s: 'adj', r: 'adv' };

function parseSynset(line: string): Synset {
  const [head, ...glossParts] = line.split(' | ');
  const t = head.split(' ');
  const wCnt = parseInt(t[3], 16);
  const words: string[] = [];
  let i = 4;
  for (let k = 0; k < wCnt; k++) {
    words.push(t[i].replace(/\(.*\)$/, '').replace(/_/g, ' '));
    i += 2;
  }
  const pCnt = Number(t[i]);
  i++;
  const antonymRefs: Synset['antonymRefs'] = [];
  for (let k = 0; k < pCnt; k++) {
    const [sym, off, p, st] = [t[i], t[i + 1], t[i + 2], t[i + 3]];
    if (sym === '!') antonymRefs.push({ pos: PTR_POS[p], offset: Number(off), target: parseInt(st.slice(2), 16) });
    i += 4;
  }
  return { words, gloss: glossParts.join(' | ').trim(), antonymRefs };
}

const IRREGULAR: Record<string, string> = {
  went: 'go', gone: 'go', was: 'be', were: 'be', been: 'be', is: 'be', are: 'be', am: 'be', had: 'have', has: 'have', did: 'do', done: 'do', does: 'do',
  saw: 'see', seen: 'see', took: 'take', taken: 'take', made: 'make', came: 'come', gave: 'give', given: 'give', got: 'get', gotten: 'get', knew: 'know', known: 'know',
  thought: 'think', told: 'tell', said: 'say', found: 'find', left: 'leave', felt: 'feel', kept: 'keep', began: 'begin', begun: 'begin', brought: 'bring', bought: 'buy',
  wrote: 'write', written: 'write', ran: 'run', stood: 'stand', heard: 'hear', meant: 'mean', met: 'meet', paid: 'pay', sat: 'sit', spoke: 'speak', spoken: 'speak',
  led: 'lead', grew: 'grow', grown: 'grow', lost: 'lose', fell: 'fall', fallen: 'fall', sent: 'send', built: 'build', understood: 'understand', drew: 'draw', drawn: 'draw',
  broke: 'break', broken: 'break', spent: 'spend', rose: 'rise', risen: 'rise', drove: 'drive', driven: 'drive', ate: 'eat', eaten: 'eat', chose: 'choose', chosen: 'choose',
  forgot: 'forget', forgotten: 'forget', taught: 'teach', caught: 'catch', fought: 'fight', sold: 'sell', held: 'hold', wore: 'wear', worn: 'wear', won: 'win', threw: 'throw',
  thrown: 'throw', flew: 'fly', flown: 'fly', hid: 'hide', hidden: 'hide', shook: 'shake', shaken: 'shake', slept: 'sleep', swam: 'swim', sang: 'sing', sung: 'sing',
  children: 'child', men: 'man', women: 'woman', people: 'person', feet: 'foot', teeth: 'tooth', mice: 'mouse', geese: 'goose', phenomena: 'phenomenon', criteria: 'criterion',
  analyses: 'analysis', hypotheses: 'hypothesis', data: 'datum', better: 'good', best: 'good', worse: 'bad', worst: 'bad', further: 'far', farther: 'far', less: 'little', least: 'little',
};

const RULES: Record<Pos, [string, string][]> = {
  noun: [['ies', 'y'], ['ses', 's'], ['xes', 'x'], ['zes', 'z'], ['ches', 'ch'], ['shes', 'sh'], ['men', 'man'], ['s', '']],
  verb: [['ies', 'y'], ['es', 'e'], ['es', ''], ['ed', 'e'], ['ed', ''], ['ing', 'e'], ['ing', ''], ['s', '']],
  adj: [['est', ''], ['est', 'e'], ['er', ''], ['er', 'e'], ['iest', 'y'], ['ier', 'y']],
  adv: [],
};

/** Candidate base forms for each part of speech. */
function lemmas(word: string): { pos: Pos; lemma: string }[] {
  const idx = loadIndex();
  const w = word.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, '_');
  const out: { pos: Pos; lemma: string }[] = [];
  const add = (pos: Pos, lemma: string) => {
    if (idx[pos].has(lemma) && !out.some((o) => o.pos === pos && o.lemma === lemma)) out.push({ pos, lemma });
  };
  for (const pos of POS_LIST) add(pos, w);
  if (IRREGULAR[w]) for (const pos of POS_LIST) add(pos, IRREGULAR[w]);
  for (const pos of POS_LIST) {
    for (const [suf, rep] of RULES[pos]) {
      if (w.endsWith(suf) && w.length > suf.length + 1) {
        const base = w.slice(0, -suf.length) + rep;
        add(pos, base);
        // doubled consonant: stopped -> stop, running -> run
        if ((suf === 'ed' || suf === 'ing' || suf === 'er' || suf === 'est') && /([b-df-hj-np-tv-z])\1$/.test(base)) add(pos, base.slice(0, -1));
      }
    }
  }
  return out;
}

const STOP = new Set('a an the and or but if of to in on at for with by from as is are was were be been being it its this that these those he she they we you i me him her them us my your his their our not no so than then there here what which who whom when where why how do does did have has had can could will would shall should may might must just also very more most some any all each every one two into out up down over under about after before between through during without within such only own same other too few both'.split(' '));

function stem(w: string) {
  return w.toLowerCase().replace(/(ing|ed|es|s|ly|er|est)$/, '');
}

function contentWords(text: string): Set<string> {
  return new Set(((text.toLowerCase().match(/[a-z]+/g) ?? []) as string[]).filter((w) => w.length > 2 && !STOP.has(w)).map(stem));
}

function posHint(word: string, sentence: string): Pos | null {
  const toks: string[] = sentence.toLowerCase().match(/[a-z']+/g) ?? [];
  const i = toks.indexOf(word.toLowerCase());
  if (i < 0) return null;
  const prev = toks[i - 1];
  if (prev && ['the', 'a', 'an', 'my', 'your', 'his', 'her', 'their', 'our', 'its', 'this', 'that', 'these', 'those', 'some', 'many', 'few', 'several'].includes(prev)) return 'noun';
  if (prev && ['to', 'will', 'would', 'can', 'could', 'should', 'must', 'may', 'might', "don't", "didn't", "doesn't"].includes(prev)) return 'verb';
  if (/ly$/.test(word)) return 'adv';
  if (prev && ['very', 'too', 'so', 'quite', 'rather', 'more', 'most'].includes(prev)) return 'adj';
  return null;
}

export function lookup(word: string, sentence = ''): LookupResult {
  const clean = word.trim().replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, '');
  const cands = clean ? lemmas(clean) : [];
  const idx = loadIndex();
  const senses: (Sense & { _overlap: number; _rank: number; _pos: Pos; _lemma: string })[] = [];
  const ctx = contentWords(sentence);
  ctx.delete(stem(clean));
  const hint = sentence ? posHint(clean, sentence) : null;
  for (const { pos, lemma } of cands) {
    const offsets = idx[pos].get(lemma) ?? [];
    offsets.slice(0, 12).forEach((off, rank) => {
      const syn = parseSynset(readSynset(pos, off));
      const [defPart, ...ex] = syn.gloss.split(/;\s*(?=")/);
      const examples = ex.map((e) => e.replace(/^"|"$/g, '').replace(/"\s*$/, '').trim()).filter(Boolean);
      const antonyms = syn.antonymRefs
        .map((a) => {
          try {
            return parseSynset(readSynset(a.pos, a.offset)).words[a.target - 1];
          } catch {
            return undefined;
          }
        })
        .filter((x): x is string => Boolean(x));
      const signature = contentWords(`${defPart} ${examples.join(' ')} ${syn.words.join(' ')}`);
      let overlap = 0;
      for (const w of ctx) if (signature.has(w)) overlap++;
      senses.push({
        pos: POS_LABEL[pos],
        definition: defPart.replace(/;\s*$/, '').trim(),
        examples,
        synonyms: syn.words.filter((w) => w.toLowerCase() !== lemma.replace(/_/g, ' ')).slice(0, 8),
        antonyms: [...new Set(antonyms)],
        _overlap: overlap,
        _rank: rank,
        _pos: pos,
        _lemma: lemma.replace(/_/g, ' '),
      });
    });
  }
  // Score: Lesk overlap, plus a small preference for common senses and for the part of speech the sentence suggests.
  const verbForm = /(ed|ing)$/i.test(clean) && cands.some((c) => c.pos === 'verb' && c.lemma !== clean.toLowerCase());
  for (const s of senses) {
    s.score = s._overlap * 2 + Math.max(0, 1 - s._rank * 0.25) + (hint && s._pos === hint ? 1.5 : 0);
    // Inflected -ed/-ing forms are usually verbs unless the sentence suggests otherwise.
    if (!hint && verbForm && s._pos === 'verb') s.score += 1.2;
  }
  let bestIndex: number | null = null;
  senses.forEach((s, i) => {
    if (bestIndex === null || s.score! > senses[bestIndex].score!) bestIndex = i;
  });
  return {
    query: clean,
    lemma: bestIndex !== null ? senses[bestIndex]._lemma : clean.toLowerCase(),
    found: senses.length > 0,
    senses: senses.map(({ _overlap: _o, _rank: _r, _pos: _p, _lemma: _l, ...s }) => s),
    bestIndex,
    method: 'wordnet-lesk',
  };
}
