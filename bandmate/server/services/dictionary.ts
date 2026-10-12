import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { dictionary as CMU } from 'cmu-pronouncing-dictionary'
import { env } from '../env.ts'

/**
 * Offline English dictionary built on Princeton WordNet 3.1 (WordNet licence, free for commercial use)
 * with CMU Pronouncing Dictionary IPA. Provides lemmatisation, multi-word expressions (phrasal verbs,
 * idioms) and context-sensitive sense selection (extended Lesk), so a tapped word gets the meaning
 * that fits its sentence.
 */
const require = createRequire(import.meta.url)
const DICT = path.join(path.dirname(require.resolve('wordnet-db/package.json')), 'dict')

export type Pos = 'noun' | 'verb' | 'adj' | 'adv'
const POS_FILES: Pos[] = ['noun', 'verb', 'adj', 'adv']
const POS_LABEL: Record<Pos, string> = { noun: 'noun', verb: 'verb', adj: 'adjective', adv: 'adverb' }

type IndexEntry = { offsets: number[] }
const indexes = new Map<Pos, Map<string, IndexEntry>>()
const fds = new Map<Pos, number>()

function index(pos: Pos) {
  let m = indexes.get(pos)
  if (!m) {
    m = new Map()
    for (const line of fs.readFileSync(path.join(DICT, `index.${pos === 'adj' ? 'adj' : pos}`), 'utf8').split('\n')) {
      if (!line || line.startsWith(' ')) continue
      const p = line.split(' ')
      const synsetCnt = Number(p[2])
      const pCnt = Number(p[3])
      const offsets = p.slice(4 + pCnt + 2, 4 + pCnt + 2 + synsetCnt).map(Number)
      m.set(p[0], { offsets })
    }
    indexes.set(pos, m)
  }
  return m
}

type Synset = { offset: number; pos: Pos; words: string[]; definition: string; examples: string[]; pointers: { sym: string; offset: number; pos: Pos }[] }
const synCache = new Map<string, Synset>()
const PTR_POS: Record<string, Pos> = { n: 'noun', v: 'verb', a: 'adj', s: 'adj', r: 'adv' }

function synset(pos: Pos, offset: number): Synset {
  const key = pos + offset
  const hit = synCache.get(key)
  if (hit) return hit
  let fd = fds.get(pos)
  if (fd === undefined) {
    fd = fs.openSync(path.join(DICT, `data.${pos}`), 'r')
    fds.set(pos, fd)
  }
  const buf = Buffer.alloc(8192)
  const n = fs.readSync(fd, buf, 0, buf.length, offset)
  const line = buf.subarray(0, n).toString('utf8').split('\n')[0]
  const [head, gloss = ''] = line.split(' | ')
  const p = head.split(' ')
  const wCnt = parseInt(p[3], 16)
  const words: string[] = []
  for (let i = 0; i < wCnt; i++) words.push(p[4 + i * 2].replace(/\(.*\)$/, '').replace(/_/g, ' '))
  let i = 4 + wCnt * 2
  const ptrCnt = Number(p[i++])
  const pointers: Synset['pointers'] = []
  for (let k = 0; k < ptrCnt; k++, i += 4) pointers.push({ sym: p[i], offset: Number(p[i + 1]), pos: PTR_POS[p[i + 2]] })
  const parts = gloss.trim().split(/;\s*(?=")/)
  const definition = parts[0].replace(/;\s*$/, '').trim()
  const examples = parts.slice(1).map((e) => e.replace(/^"|"$/g, '').replace(/";?$/, '').trim()).filter(Boolean)
  const s = { offset, pos, words, definition, examples, pointers }
  synCache.set(key, s)
  return s
}

// ------------------------------------------------------------------------------------------- morphology
const IRREGULAR: Record<string, string> = Object.fromEntries(
  `went:go gone:go was:be were:be been:be is:be are:be am:be had:have has:have did:do done:do said:say made:make took:take taken:take came:come got:get gotten:get saw:see seen:see knew:know known:know thought:think gave:give given:give found:find told:tell became:become left:leave felt:feel brought:bring began:begin begun:begin kept:keep held:hold wrote:write written:write stood:stand heard:hear meant:mean met:meet ran:run paid:pay sat:sit spoke:speak spoken:speak lay:lie led:lead grew:grow grown:grow lost:lose fell:fall fallen:fall sent:send built:build understood:understand drew:draw drawn:draw broke:break broken:break spent:spend rose:rise risen:rise drove:drive driven:drive bought:buy wore:wear worn:wear chose:choose chosen:choose sought:seek threw:throw thrown:throw caught:catch dealt:deal won:win forgot:forget forgotten:forget fought:fight taught:teach ate:eat eaten:eat slept:sleep sold:sell flew:fly flown:fly hid:hide hidden:hide shook:shake shaken:shake rode:ride ridden:ride sang:sing sung:sing swam:swim swum:swim drank:drink drunk:drink froze:freeze frozen:freeze stole:steal stolen:steal woke:wake woken:wake bent:bend bound:bind bit:bite bitten:bite blew:blow blown:blow bred:breed fed:feed fled:flee forbade:forbid forgave:forgive forgiven:forgive hung:hang lent:lend lit:light mistook:mistake overcame:overcome sank:sink shone:shine shot:shoot shrank:shrink sped:speed spun:spin sprang:spring stuck:stick stung:sting struck:strike swore:swear sworn:swear swept:sweep swung:swing tore:tear torn:tear undertook:undertake undertaken:undertake withdrew:withdraw withdrawn:withdraw arose:arise arisen:arise
   children:child men:man women:woman people:person feet:foot teeth:tooth mice:mouse geese:goose criteria:criterion phenomena:phenomenon data:datum analyses:analysis hypotheses:hypothesis theses:thesis crises:crisis bases:basis media:medium indices:index appendices:appendix
   better:good best:good worse:bad worst:bad further:far furthest:far farther:far less:little least:little more:much most:much elder:old eldest:old`
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.split(':') as [string, string]),
)

const RULES: Record<Pos, [string, string][]> = {
  noun: [['s', ''], ['ses', 's'], ['xes', 'x'], ['zes', 'z'], ['ches', 'ch'], ['shes', 'sh'], ['men', 'man'], ['ies', 'y']],
  verb: [['s', ''], ['ies', 'y'], ['es', 'e'], ['es', ''], ['ed', 'e'], ['ed', ''], ['ing', 'e'], ['ing', '']],
  adj: [['er', ''], ['est', ''], ['er', 'e'], ['est', 'e'], ['ier', 'y'], ['iest', 'y']],
  adv: [],
}

/** Base forms of a word for a part of speech (WordNet's "morphy" with an irregular-form list). */
export function lemmas(word: string, pos: Pos): string[] {
  const w = word.toLowerCase().replace(/’/g, "'").replace(/ /g, '_')
  const idx = index(pos)
  const out = new Set<string>()
  if (idx.has(w)) out.add(w)
  const irr = IRREGULAR[w]
  if (irr && idx.has(irr)) out.add(irr)
  for (const [suf, rep] of RULES[pos]) {
    if (w.endsWith(suf) && w.length > suf.length + 1) {
      const base = w.slice(0, -suf.length) + rep
      if (idx.has(base)) out.add(base)
      // doubled consonant: "stopped" → "stop", "running" → "run"
      if ((suf === 'ed' || suf === 'ing') && rep === '' && /([bcdfgklmnprstvz])\1$/.test(base) && idx.has(base.slice(0, -1))) out.add(base.slice(0, -1))
    }
  }
  return [...out]
}

// ------------------------------------------------------------------------------------------- pronunciation
const ARPA: Record<string, string> = {
  AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', EH: 'ɛ', ER: 'ɜr', EY: 'eɪ', F: 'f', G: 'ɡ', HH: 'h', IH: 'ɪ', IY: 'i', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', OW: 'oʊ', OY: 'ɔɪ', P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ', UH: 'ʊ', UW: 'u', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
}
const VOWELS = new Set(['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW'])
const ONSETS = new Set(['P R', 'P L', 'B R', 'B L', 'T R', 'D R', 'K R', 'K L', 'G R', 'G L', 'F R', 'F L', 'TH R', 'SH R', 'S P', 'S T', 'S K', 'S M', 'S N', 'S L', 'S W', 'T W', 'K W', 'D W', 'P Y', 'B Y', 'K Y', 'M Y', 'F Y', 'V Y', 'HH Y', 'S P R', 'S T R', 'S K R', 'S P L', 'S K W'])

/** IPA (General American, from CMUdict). Stress marks go before the stressed syllable; unstressed AH is schwa. */
export function ipa(word: string): string | null {
  const parts = word.toLowerCase().split(/[\s_]+/)
  const out: string[] = []
  for (const w of parts) {
    const arpa = (CMU as Record<string, string>)[w]
    if (!arpa) return null
    const phones = arpa.split(' ').map((ph) => /^([A-Z]+)(\d)?$/.exec(ph)!).filter(Boolean)
    const marks = new Map<number, string>()
    phones.forEach(([, base, stress], i) => {
      if (!VOWELS.has(base) || (stress !== '1' && stress !== '2') || (stress === '1' && parts.length > 1 && phones.filter((p) => p[2] === '1').length === 1 && i === 0)) return
      // Walk back over the consonants before this vowel and keep the longest legal onset.
      let start = i
      while (start > 0 && !VOWELS.has(phones[start - 1][1])) start--
      let onset = start
      if (start > 0) {
        onset = i
        for (let k = i - 1; k >= start; k--) {
          const cluster = phones.slice(k, i).map((p) => p[1]).join(' ')
          if (i - k === 1 || ONSETS.has(cluster)) onset = k
        }
      }
      marks.set(onset, stress === '1' ? 'ˈ' : 'ˌ')
    })
    let out1 = ''
    phones.forEach(([, base, stress], i) => {
      out1 += (marks.get(i) ?? '') + (base === 'AH' && stress === '0' ? 'ə' : base === 'ER' && stress === '0' ? 'ər' : ARPA[base] ?? '')
    })
    out.push(out1)
  }
  return `/${out.join(' ')}/`
}

// ------------------------------------------------------------------------------------------- lookup
export type Sense = { pos: Pos; posLabel: string; definition: string; examples: string[]; synonyms: string[]; antonyms: string[]; score?: number }
export type Entry = { word: string; lemma: string; ipa: string | null; senses: Sense[]; phrase: boolean }

function sensesFor(lemma: string, pos: Pos): Sense[] {
  const e = index(pos).get(lemma)
  if (!e) return []
  return e.offsets.map((off) => {
    const s = synset(pos, off)
    const antonyms = s.pointers.filter((p) => p.sym === '!' && p.pos).flatMap((p) => synset(p.pos, p.offset).words.slice(0, 1))
    return { pos, posLabel: POS_LABEL[pos], definition: s.definition, examples: s.examples.slice(0, 2), synonyms: s.words.filter((w) => w.toLowerCase() !== lemma.replace(/_/g, ' ')).slice(0, 6), antonyms: [...new Set(antonyms)].slice(0, 4) }
  })
}

/** All senses of a word, most frequent first within each part of speech. */
export function lookup(word: string, onlyPos?: Pos): Entry | null {
  const clean = word.trim().toLowerCase().replace(/[^a-z' -]/g, '')
  if (!clean) return null
  const senses: Sense[] = []
  let lemma = clean
  for (const pos of onlyPos ? [onlyPos] : POS_FILES) {
    for (const l of lemmas(clean, pos)) {
      if (senses.some((s) => s.pos === pos)) break
      senses.push(...sensesFor(l, pos))
      if (lemma === clean) lemma = l.replace(/_/g, ' ')
    }
  }
  if (!senses.length) return null
  return { word: clean, lemma, ipa: ipa(clean) ?? ipa(lemma), senses, phrase: clean.includes(' ') }
}

// ------------------------------------------------------------------------------------------- context
const STOP = new Set('a an the and or but if of at by for with about against between into through during before after above below to from up down in out on off over under again further then once here there when where why how all any both each few more most other some such no nor not only own same so than too very can will just should now i me my we our you your he him his she her it its they them their what which who whom this that these those am is are was were be been being have has had having do does did doing would could ought'.split(' '))
const tokens = (s: string) => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => !STOP.has(w) && w.length > 2)
const stem = (w: string) => w.replace(/(ing|ed|es|s|ly)$/, '')

/** Guesses the likely part of speech of `word` from the words just before it. */
function posHint(prev: string[]): Pos | null {
  const p1 = prev[prev.length - 1] ?? ''
  if (['to', 'will', 'would', 'can', 'could', 'should', 'must', 'may', 'might', "don't", "didn't", 'not', 'please', 'i', 'we', 'they', 'you'].includes(p1)) return 'verb'
  if (['a', 'an', 'the', 'this', 'that', 'my', 'your', 'his', 'her', 'their', 'our', 'its', 'some', 'many', 'few', 'several', 'every', 'each', 'of'].includes(p1)) return 'noun'
  if (['very', 'quite', 'so', 'too', 'more', 'most', 'less', 'really', 'extremely', 'is', 'was', 'are', 'were', 'seems', 'looks', 'feel', 'felt'].includes(p1)) return 'adj'
  return null
}

// ------------------------------------------------------------------------------------------- idioms
type Pattern = { tokens: string[]; definition: string; example: string | null; pos: Pos | null; source: 'idioms' | 'wordnet' }
let patterns: Pattern[] | null = null
const POSSESSIVE = new Set(['my', 'your', 'his', 'her', 'its', 'our', 'their', "one's"])
const PRONOUN = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they', 'one', 'someone', 'people'])

function loadPatterns() {
  if (patterns) return patterns
  const file = path.join(env.root, 'content', 'idioms.json')
  const own = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')).idioms as [string, string, string][]) : []
  patterns = own.map(([p, d, ex]) => ({ tokens: p.split(' '), definition: d, example: ex, pos: null, source: 'idioms' as const }))
  // WordNet phrases with placeholders ("break_someone's_heart") need pattern matching, not exact lookup.
  for (const pos of POS_FILES)
    for (const key of index(pos).keys())
      if (/(^|_)(one's|someone's|someone|one)(_|$)/.test(key)) {
        const sense = sensesFor(key, pos)[0]
        if (sense) patterns.push({ tokens: key.split('_'), definition: sense.definition, example: sense.examples[0] ?? null, pos, source: 'wordnet' })
      }
  return patterns
}

function tokenMatches(tok: string, word: string, first: boolean) {
  if (tok === "one's" || tok === "someone's") return POSSESSIVE.has(word) || /'s$/.test(word)
  if (tok === 'someone') return true
  if (tok === 'one') return PRONOUN.has(word)
  if (word === tok) return true
  if (first) return lemmas(word, 'verb').includes(tok)
  return tok === 'can' && word === 'could'
}

function matchPattern(lower: string[], wordIndex: number) {
  let best: { p: Pattern; start: number } | null = null
  for (const p of loadPatterns()) {
    const n = p.tokens.length
    if (n < 2 || (best && n <= best.p.tokens.length)) continue
    for (let start = Math.max(0, wordIndex - n + 1); start <= wordIndex && start + n <= lower.length; start++) {
      if (p.tokens.every((t, j) => tokenMatches(t, lower[start + j], j === 0))) {
        best = { p, start }
        break
      }
    }
  }
  return best
}

/**
 * Contextual meaning for a word at `wordIndex` within `sentence`.
 * 1. Looks for a multi-word expression around it (e.g. "gave up", "break the ice").
 * 2. Ranks senses with extended Lesk: overlap between the sentence and each sense's definition,
 *    examples and synonyms, plus a part-of-speech hint and WordNet's frequency order.
 */
export function explainInContext(sentence: string, wordIndex: number) {
  const words = sentence.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? []
  const target = words[wordIndex]
  if (!target) return null
  const lower = words.map((w) => w.toLowerCase().replace(/’/g, "'"))

  // Idioms and phrases with placeholders ("broke her heart", "break the ice").
  const pat = matchPattern(lower, wordIndex)
  if (pat && pat.p.tokens.length >= 3) {
    const sense: Sense = { pos: pat.p.pos ?? 'verb', posLabel: 'idiom', definition: pat.p.definition, examples: pat.p.example ? [pat.p.example] : [], synonyms: [], antonyms: [], score: 10 }
    return { word: target, matched: lower.slice(pat.start, pat.start + pat.p.tokens.length).join(' '), lemma: pat.p.tokens.join(' '), phrase: true, ipa: null, senses: [sense], best: sense }
  }

  // Multi-word expressions: try the longest windows containing the target first.
  for (const len of [4, 3, 2]) {
    for (let start = Math.max(0, wordIndex - len + 1); start <= wordIndex && start + len <= lower.length; start++) {
      const chunk = lower.slice(start, start + len)
      // Allow the first word (usually the verb) to be inflected: "gave up" → "give up".
      const heads = [chunk[0], ...lemmas(chunk[0], 'verb').map((l) => l.replace(/_/g, ' '))]
      for (const h of heads) {
        const phrase = [h, ...chunk.slice(1)].join(' ')
        for (const pos of POS_FILES) {
          if (index(pos).has(phrase.replace(/ /g, '_'))) {
            const senses = rank(sensesFor(phrase.replace(/ /g, '_'), pos), lower, wordIndex, pos)
            return { word: target, matched: chunk.join(' '), lemma: phrase, phrase: true, ipa: ipa(phrase), senses, best: senses[0] }
          }
        }
      }
    }
  }
  if (pat) {
    const sense: Sense = { pos: 'verb', posLabel: 'phrasal verb', definition: pat.p.definition, examples: pat.p.example ? [pat.p.example] : [], synonyms: [], antonyms: [], score: 10 }
    return { word: target, matched: lower.slice(pat.start, pat.start + pat.p.tokens.length).join(' '), lemma: pat.p.tokens.join(' '), phrase: true, ipa: null, senses: [sense], best: sense }
  }
  const entry = lookup(target)
  if (!entry) return { word: target, matched: target, lemma: target.toLowerCase(), phrase: false, ipa: ipa(target), senses: [], best: null }
  const hint = posHint(lower.slice(0, wordIndex))
  const senses = rank(entry.senses, lower, wordIndex, hint)
  return { word: target, matched: target, lemma: entry.lemma, phrase: false, ipa: ipa(target) ?? entry.ipa, senses, best: senses[0] }
}

function rank(senses: Sense[], words: string[], wordIndex: number, hint: Pos | null) {
  const ctx = new Set(tokens(words.filter((_, i) => Math.abs(i - wordIndex) <= 12 && i !== wordIndex).join(' ')).map(stem))
  const seen = new Map<Pos, number>()
  return senses
    .map((s) => {
      const order = seen.get(s.pos) ?? 0
      seen.set(s.pos, order + 1)
      const sig = new Set(tokens([s.definition, ...s.examples, ...s.synonyms].join(' ')).map(stem))
      let overlap = 0
      for (const w of sig) if (ctx.has(w)) overlap++
      const score = overlap * 2 + (hint && s.pos === hint ? 2.5 : 0) + Math.max(0, 1.5 - order * 0.4)
      return { ...s, score: +score.toFixed(2) }
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 6)
}

/** Splits text into sentences while keeping character offsets (used by the reader). */
export function sentenceAt(text: string, charIndex: number) {
  const re = /[^.!?\n]+[.!?]*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (charIndex >= m.index && charIndex < m.index + m[0].length) return { sentence: m[0].trim(), start: m.index }
  }
  return { sentence: text.slice(Math.max(0, charIndex - 120), charIndex + 120), start: Math.max(0, charIndex - 120) }
}
