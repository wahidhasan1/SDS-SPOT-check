import { dictionary as CMU } from 'cmu-pronouncing-dictionary'
import { db } from '../db/index.ts'
import { env } from '../env.ts'
import { wordsOf } from '../lib/util.ts'
import { languageToolUp } from './features.ts'
import { lemmas, lookup } from './dictionary.ts'

/**
 * Automatic writing checks. These are transparent rules (word count, structure, linking, range,
 * repetition, spelling and grammar via LanguageTool) grouped under the four IELTS criteria.
 * They give actionable pointers; they do NOT produce a band score.
 */

export type Note = { level: 'good' | 'warn' | 'tip'; text: string }
export type Issue = { offset: number; length: number; message: string; replacements: string[]; type: 'grammar' | 'spelling' | 'style'; source: 'languagetool' | 'dictionary' }
export type Prompt = { id: string; task: 1 | 2; testType: string; kind: string; essayType?: string; keywords?: string[]; bullets?: string[]; formality?: string; greeting?: string; minWords: number }

const LINKERS: Record<string, string[]> = {
  addition: ['moreover', 'furthermore', 'in addition', 'additionally', 'also', 'besides', 'what is more'],
  contrast: ['however', 'nevertheless', 'nonetheless', 'whereas', 'while', 'although', 'though', 'on the other hand', 'in contrast', 'despite', 'in spite of', 'yet', 'conversely'],
  cause: ['therefore', 'consequently', 'as a result', 'thus', 'hence', 'because', 'since', 'due to', 'owing to', 'this means that', 'leads to', 'result in'],
  example: ['for example', 'for instance', 'such as', 'in particular', 'to illustrate', 'namely'],
  sequence: ['firstly', 'secondly', 'thirdly', 'finally', 'first of all', 'next', 'then', 'after that', 'subsequently', 'afterwards', 'lastly'],
  conclusion: ['in conclusion', 'to conclude', 'to sum up', 'overall', 'in summary', 'all things considered'],
}
const SUBORDINATORS = ['because', 'although', 'though', 'which', 'who', 'whose', 'whom', 'where', 'when', 'while', 'whereas', 'if', 'unless', 'since', 'so that', 'that', 'whether', 'until', 'as long as', 'provided that']
const STOP = new Set('the a an and or but of to in on at for with by from as is are was were be been being it its this that these those there their they them he she his her i we you our your my me us which who what when where how than then so such not no do does did have has had will would can could should may might must also very more most some many much other into about over after before between because while if only just even all any each both few'.split(' '))
const OPINION = ['i believe', 'i think', 'in my opinion', 'in my view', 'i agree', 'i disagree', 'i strongly', 'i would argue', 'it seems to me', 'from my perspective', 'i am convinced', 'i feel']
const OVERVIEW = ['overall', 'in general', 'it is clear that', 'it is evident', 'generally', 'the most noticeable', 'the most striking', 'it can be seen that']

const known = (w: string) => {
  const l = w.toLowerCase().replace(/’/g, "'")
  if ((CMU as Record<string, string>)[l]) return true
  return (['noun', 'verb', 'adj', 'adv'] as const).some((p) => lemmas(l, p).length > 0)
}

/** Norvig-style spelling suggestions restricted to dictionary words. */
function suggest(word: string) {
  const w = word.toLowerCase()
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  const edits1 = (s: string) => {
    const out = new Set<string>()
    for (let i = 0; i <= s.length; i++) {
      const [a, b] = [s.slice(0, i), s.slice(i)]
      if (b) out.add(a + b.slice(1))
      if (b.length > 1) out.add(a + b[1] + b[0] + b.slice(2))
      for (const c of letters) {
        if (b) out.add(a + c + b.slice(1))
        out.add(a + c + b)
      }
    }
    return out
  }
  const bank = new Set(db().all<{ word: string }>('SELECT word FROM vocab_words').map((r) => r.word))
  const one = [...edits1(w)].filter((x) => (CMU as Record<string, string>)[x] && x.length > 1)
  const ranked = one.sort((a, b) => Number(bank.has(b)) - Number(bank.has(a)) || Math.abs(a.length - w.length) - Math.abs(b.length - w.length))
  if (ranked.length) return ranked.slice(0, 3)
  const two = new Set<string>()
  for (const e of edits1(w)) for (const e2 of edits1(e)) if ((CMU as Record<string, string>)[e2]) two.add(e2)
  return [...two].slice(0, 3)
}

async function languageTool(text: string): Promise<Issue[] | null> {
  if (!(await languageToolUp())) return null
  try {
    const r = await fetch(`${env.languageToolUrl}/v2/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text, language: 'en-GB', level: 'default' }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) return null
    const data = (await r.json()) as { matches: { offset: number; length: number; message: string; replacements: { value: string }[]; rule: { issueType: string; category: { id: string } } }[] }
    return data.matches
      .filter((m) => m.rule.category.id !== 'TYPOGRAPHY' && m.rule.category.id !== 'CASING')
      .map((m) => ({
        offset: m.offset,
        length: m.length,
        message: m.message,
        replacements: m.replacements.slice(0, 3).map((x) => x.value),
        type: m.rule.issueType === 'misspelling' ? 'spelling' : m.rule.issueType === 'style' || m.rule.issueType === 'locale-violation' ? 'style' : 'grammar',
        source: 'languagetool' as const,
      }))
  } catch {
    return null
  }
}

function dictionarySpelling(text: string): Issue[] {
  const issues: Issue[] = []
  const re = /[A-Za-z]+(?:['’][A-Za-z]+)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) && issues.length < 30) {
    const w = m[0]
    const sentenceStart = /(^|[.!?]\s+)$/.test(text.slice(Math.max(0, m.index - 3), m.index))
    if (w.length < 3 || (/^[A-Z]/.test(w) && !sentenceStart) || known(w)) continue
    issues.push({ offset: m.index, length: w.length, message: 'Possible spelling mistake.', replacements: suggest(w), type: 'spelling', source: 'dictionary' })
  }
  return issues
}

const count = (text: string, phrase: string) => (text.match(new RegExp(`\\b${phrase.replace(/ /g, '\\s+')}\\b`, 'gi')) ?? []).length

export async function analyseWriting(text: string, prompt: Prompt) {
  const clean = text.replace(/\r/g, '').trim()
  const lower = clean.toLowerCase()
  const words = wordsOf(clean)
  const wordCount = words.length
  const paragraphs = clean.split(/\n\s*\n|\n(?=\s*[A-Z])/).map((p) => p.trim()).filter((p) => wordsOf(p).length >= 3)
  const sentences = clean.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => wordsOf(s).length >= 2)
  const lengths = sentences.map((s) => wordsOf(s).length)
  const avgLen = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0
  const sd = lengths.length ? Math.sqrt(lengths.reduce((a, b) => a + (b - avgLen) ** 2, 0) / lengths.length) : 0

  // Lexical: diversity over 50-word windows (fair for any length), repetition, topic and academic words.
  const content = words.map((w) => w.toLowerCase()).filter((w) => !STOP.has(w) && w.length > 2)
  let mattr = 0
  if (content.length >= 20) {
    const win = Math.min(50, content.length)
    let total = 0
    let n = 0
    for (let i = 0; i + win <= content.length; i += 5, n++) total += new Set(content.slice(i, i + win)).size / win
    mattr = total / Math.max(1, n)
  }
  const freq = new Map<string, number>()
  for (const w of content) {
    const base = lemmas(w, 'noun')[0] ?? lemmas(w, 'verb')[0] ?? w
    freq.set(base, (freq.get(base) ?? 0) + 1)
  }
  const promptWords = new Set((prompt.keywords ?? []).flatMap((k) => k.split(' ')))
  const repeated = [...freq.entries()].filter(([w, c]) => c >= Math.max(4, wordCount / 60) && !promptWords.has(w)).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([w, c]) => ({ word: w, count: c, alternatives: (lookup(w)?.senses[0]?.synonyms ?? []).filter((s) => !s.includes(' ')).slice(0, 3) }))
  const bankRows = db().all<{ word: string; level: string }>("SELECT word, level FROM vocab_words WHERE level IN ('B2','C1','C2')")
  const advanced = bankRows.filter((r) => new RegExp(`\\b${r.word}`, 'i').test(clean)).map((r) => r.word)

  // Cohesion: linking words by function.
  const linkers: Record<string, string[]> = {}
  let linkerTotal = 0
  const overused: string[] = []
  for (const [fn, list] of Object.entries(LINKERS))
    for (const l of list) {
      const c = count(lower, l)
      if (c) {
        ;(linkers[fn] ??= []).push(l)
        linkerTotal += c
        if (c >= 3 && !['also', 'because', 'then', 'while', 'since'].includes(l)) overused.push(l)
      }
    }

  // Grammatical range.
  const complex = sentences.filter((s) => SUBORDINATORS.some((x) => new RegExp(`\\b${x}\\b`, 'i').test(s))).length
  const passive = (clean.match(/\b(is|are|was|were|been|being|be)\s+(\w+ly\s+)?\w+(ed|en)\b/gi) ?? []).length

  // Errors: LanguageTool if running, otherwise our dictionary spelling check.
  const lt = await languageTool(clean)
  const issues = lt ?? dictionarySpelling(clean)
  const grammarIssues = issues.filter((i) => i.type === 'grammar')
  const spellingIssues = issues.filter((i) => i.type === 'spelling')

  const task: Note[] = []
  const coherence: Note[] = []
  const lexical: Note[] = []
  const grammar: Note[] = []

  // ---- Task achievement / response
  if (wordCount < prompt.minWords) task.push({ level: 'warn', text: `Your answer has ${wordCount} words. The minimum is ${prompt.minWords}; in the exam, short answers lose marks for task ${prompt.task === 1 ? 'achievement' : 'response'}.` })
  else task.push({ level: 'good', text: `Length is fine: ${wordCount} words (minimum ${prompt.minWords}).` })
  const kw = prompt.keywords ?? []
  const covered = kw.filter((k) => lower.includes(k.toLowerCase()))
  if (kw.length && covered.length / kw.length < 0.35) task.push({ level: 'warn', text: 'Your answer uses few of the key ideas from the question. Make sure you answer exactly what is asked.' })
  if (prompt.task === 1 && prompt.testType === 'academic') {
    if (!OVERVIEW.some((o) => lower.includes(o))) task.push({ level: 'warn', text: 'Add a clear overview (e.g. “Overall, …”) that summarises the main trends. This is essential for Task 1.' })
    else task.push({ level: 'good', text: 'You included an overview of the main features.' })
    const numbers = (clean.match(/\d[\d,.]*\s?(%|per cent|percent|hours|thousand|million)?/g) ?? []).length
    if (prompt.kind !== 'process' && numbers < 4) task.push({ level: 'warn', text: 'Support your description with specific figures from the chart (at least 4–6 data points).' })
    if (OPINION.some((o) => lower.includes(o))) task.push({ level: 'warn', text: 'Task 1 should describe the information only. Remove personal opinions such as “I think”.' })
    if (prompt.kind !== 'process' && !/(than|compared|whereas|while|highest|lowest|the most|the least|similar|in contrast)/i.test(clean)) task.push({ level: 'tip', text: 'Make comparisons (higher than, whereas, the highest…). The task asks you to compare where relevant.' })
  }
  if (prompt.task === 1 && prompt.testType === 'general_training') {
    const firstLine = clean.split('\n')[0].toLowerCase()
    if (!firstLine.startsWith('dear')) task.push({ level: 'warn', text: `Start the letter with the greeting given in the question (${prompt.greeting ?? 'Dear …'}).` })
    const ending = lower.slice(-140)
    if (prompt.formality === 'formal' && !/yours faithfully/.test(ending)) task.push({ level: 'warn', text: 'After “Dear Sir or Madam”, end with “Yours faithfully,” followed by your full name.' })
    if (prompt.formality === 'semi-formal' && !/yours sincerely|kind regards|best regards/.test(ending)) task.push({ level: 'warn', text: 'When you use the person’s name, end with “Yours sincerely,” or “Kind regards,”.' })
    if (prompt.formality === 'informal' && /yours faithfully|yours sincerely/.test(ending)) task.push({ level: 'warn', text: 'This is a letter to a friend: use a friendly ending such as “Best wishes,” or “Take care,”.' })
    if (prompt.formality === 'informal' && /\b(i am writing to|i would like to inform you)\b/.test(lower)) task.push({ level: 'tip', text: 'Your tone is quite formal for a friend. Try a warmer opening, e.g. “It was great to hear from you!”' })
    for (const b of prompt.bullets ?? []) {
      const keyWords = b.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOP.has(w) && !['describe', 'explain', 'suggest', 'what', 'would', 'like'].includes(w))
      const hit = keyWords.some((w) => lower.includes(w.slice(0, Math.max(4, w.length - 2))))
      if (!hit) task.push({ level: 'warn', text: `Check that you covered this point: “${b}”.` })
    }
  }
  if (prompt.task === 2) {
    if (['opinion', 'advantages-disadvantages', 'discussion'].includes(prompt.essayType ?? '') && !OPINION.some((o) => lower.includes(o)) && !/\bthis essay (will )?(argue|agree)/.test(lower)) task.push({ level: 'warn', text: 'State your position clearly (e.g. “I strongly believe that…”) in the introduction and conclusion.' })
    if (!/(for example|for instance|such as|to illustrate)/.test(lower)) task.push({ level: 'tip', text: 'Support your main ideas with specific examples.' })
    if (!/(in conclusion|to conclude|to sum up|in summary|overall)/.test(lower.slice(Math.floor(lower.length * 0.7)))) task.push({ level: 'warn', text: 'Finish with a clear conclusion paragraph that answers the question.' })
  }

  // ---- Coherence and cohesion
  const minParas = prompt.task === 2 ? 4 : prompt.testType === 'general_training' ? 3 : 3
  if (paragraphs.length < minParas) coherence.push({ level: 'warn', text: `Use clear paragraphs (about ${minParas}–${minParas + 1}). Leave an empty line between paragraphs.` })
  else coherence.push({ level: 'good', text: `Clear paragraphing: ${paragraphs.length} paragraphs.` })
  const fnCount = Object.keys(linkers).length
  if (linkerTotal === 0) coherence.push({ level: 'warn', text: 'Add linking words to connect your ideas (however, therefore, for example…).' })
  else if (fnCount <= 2) coherence.push({ level: 'tip', text: `You link ideas mainly with ${Object.values(linkers).flat().slice(0, 3).join(', ')}. Use a wider range: contrast (however, whereas), result (therefore, as a result), examples (for instance).` })
  else coherence.push({ level: 'good', text: `Good range of linking words (${Object.values(linkers).flat().slice(0, 5).join(', ')}).` })
  if (overused.length) coherence.push({ level: 'tip', text: `Avoid repeating the same linker: “${overused.join('”, “')}” appear 3+ times.` })
  if (linkerTotal > sentences.length * 1.2 && sentences.length > 4) coherence.push({ level: 'tip', text: 'Many sentences start with a linking word. Mechanical overuse can lower your coherence score.' })

  // ---- Lexical resource
  if (mattr && mattr < 0.72) lexical.push({ level: 'warn', text: 'Your vocabulary is quite repetitive. Try paraphrasing and using synonyms.' })
  else if (mattr) lexical.push({ level: 'good', text: 'Good variety of vocabulary for this length.' })
  for (const r of repeated) lexical.push({ level: 'tip', text: `“${r.word}” is used ${r.count} times.${r.alternatives.length ? ` Alternatives: ${r.alternatives.join(', ')}.` : ' Try to paraphrase some of them.'}` })
  if (advanced.length) lexical.push({ level: 'good', text: `Less common vocabulary used well can raise your score: ${advanced.slice(0, 6).join(', ')}.` })
  else lexical.push({ level: 'tip', text: 'Include some less common, topic-specific words (see the Vocabulary topics for ideas).' })
  if (spellingIssues.length) lexical.push({ level: 'warn', text: `${spellingIssues.length} possible spelling ${spellingIssues.length === 1 ? 'mistake' : 'mistakes'} (highlighted below).` })
  if (/\b(gonna|wanna|kids|stuff|a lot of)\b/i.test(clean) && !(prompt.task === 1 && prompt.formality === 'informal')) lexical.push({ level: 'tip', text: 'Some words are informal (e.g. “a lot of”, “kids”, “stuff”). Prefer “many/much”, “children”, “things/issues” in formal writing.' })

  // ---- Grammatical range and accuracy
  if (sentences.length >= 3) {
    if (complex / sentences.length < 0.3) grammar.push({ level: 'warn', text: 'Most sentences are simple. Add complex sentences with because, although, which, if, when.' })
    else grammar.push({ level: 'good', text: `${Math.round((complex / sentences.length) * 100)}% of your sentences are complex — good range.` })
    if (sd < 4 && sentences.length > 5) grammar.push({ level: 'tip', text: 'Your sentences are all a similar length. Mix short and long sentences.' })
    if (avgLen > 32) grammar.push({ level: 'tip', text: 'Some sentences are very long. Split them to keep your meaning clear.' })
  }
  if (prompt.kind === 'process' && passive < 3) grammar.push({ level: 'tip', text: 'Process descriptions usually use the passive voice (“the paper is collected”).' })
  if (grammarIssues.length) grammar.push({ level: 'warn', text: `${grammarIssues.length} possible grammar ${grammarIssues.length === 1 ? 'error' : 'errors'} (highlighted below).` })
  else if (lt) grammar.push({ level: 'good', text: 'No grammar errors were detected automatically.' })

  return {
    stats: { wordCount, paragraphs: paragraphs.length, sentences: sentences.length, avgSentenceLength: +avgLen.toFixed(1), complexSentences: complex, lexicalVariety: +mattr.toFixed(2), linkingWords: linkers },
    criteria: { task, coherence, lexical, grammar },
    issues,
    grammarChecker: lt ? 'languagetool' : 'dictionary-only',
  }
}
