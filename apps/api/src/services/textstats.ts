import { countWords, type ChartSpec } from '@fluentpath/shared';

const LINKERS = [
  'however', 'moreover', 'furthermore', 'in addition', 'therefore', 'consequently', 'as a result', 'nevertheless', 'on the other hand',
  'for example', 'for instance', 'such as', 'in contrast', 'whereas', 'while', 'although', 'despite', 'in conclusion', 'overall',
  'firstly', 'secondly', 'finally', 'in summary', 'thus', 'meanwhile', 'similarly', 'likewise', 'because', 'since', 'due to',
];
const FILLERS = ['um', 'uh', 'er', 'erm', 'hmm', 'like', 'you know', 'i mean', 'kind of', 'sort of', 'basically', 'actually'];
const STOP = new Set('the a an and or but of to in on at for with by from is are was were be been it this that these those as i you he she we they my your our their his her its not do does did have has had will would can could should there here what which who when where why how so if than then very also just more most some any all no'.split(' '));

function tokens(text: string) {
  return (text.toLowerCase().match(/[a-z]+(?:['’-][a-z]+)*/g) ?? []);
}

/** Objective statistics computed from the text itself. These are NOT AI feedback. */
export function writingStats(text: string, minWords: number, academicWords: Set<string>) {
  const words = tokens(text);
  const wordCount = countWords(text);
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).length;
  const sentences = text.split(/[.!?]+(?:\s|$)/).map((s) => s.trim()).filter((s) => countWords(s) > 0).length;
  const lower = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  const linkersUsed = LINKERS.filter((l) => lower.includes(` ${l} `) || lower.includes(` ${l},`));
  const content = words.filter((w) => !STOP.has(w) && w.length > 2);
  const freq = new Map<string, number>();
  for (const w of content) freq.set(w, (freq.get(w) ?? 0) + 1);
  const repeated = [...freq.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([word, count]) => ({ word, count }));
  const contractions = (text.match(/\b\w+['’](?:t|s|re|ve|ll|d|m)\b/gi) ?? []).length;
  const academicUsed = [...new Set(words.filter((w) => academicWords.has(w)))];
  const unique = new Set(words);
  return {
    wordCount,
    minWords,
    underLength: wordCount < minWords,
    paragraphs,
    sentences,
    avgSentenceLength: sentences ? Math.round((wordCount / sentences) * 10) / 10 : 0,
    lexicalDiversity: words.length ? Math.round((unique.size / words.length) * 100) / 100 : 0,
    linkersUsed,
    repeatedWords: repeated,
    contractions,
    academicWordsUsed: academicUsed.slice(0, 20),
  };
}

/** Objective speaking metrics from a transcript and duration. Pronunciation is not measured. */
export function speakingMetrics(transcript: string, durationSec: number, levelWords: Set<string>) {
  const words = tokens(transcript);
  const wordCount = words.length;
  const minutes = durationSec > 0 ? durationSec / 60 : 0;
  const lower = ` ${transcript.toLowerCase()} `;
  let fillerCount = 0;
  for (const f of FILLERS) {
    const re = new RegExp(`\\b${f.replace(/ /g, '\\s+')}\\b`, 'g');
    fillerCount += (lower.match(re) ?? []).length;
  }
  const unique = new Set(words);
  const advanced = [...new Set(words.filter((w) => levelWords.has(w)))];
  return {
    wordCount,
    durationSec: Math.round(durationSec * 10) / 10,
    wordsPerMinute: minutes > 0 ? Math.round(wordCount / minutes) : 0,
    uniqueWords: unique.size,
    lexicalDiversity: wordCount ? Math.round((unique.size / wordCount) * 100) / 100 : 0,
    fillerCount,
    advancedWordsUsed: advanced.slice(0, 20),
    linkersUsed: LINKERS.filter((l) => lower.includes(` ${l} `) || lower.includes(` ${l},`)),
  };
}

/** Plain-text description of a Task 1 visual, so the AI evaluator knows the data. */
export function describeVisual(v: ChartSpec | null | undefined): string | null {
  if (!v) return null;
  const lines = [`${v.kind.toUpperCase()}: ${v.title}${v.unit ? ` (unit: ${v.unit})` : ''}`];
  if (v.categories && v.series) for (const s of v.series) lines.push(`${s.name}: ${v.categories.map((c, i) => `${c}=${s.values[i]}`).join(', ')}`);
  if (v.rows) for (const r of v.rows) lines.push(r.join(' | '));
  if (v.steps) v.steps.forEach((s, i) => lines.push(`Step ${i + 1}: ${s}`));
  if (v.mapBefore) lines.push(`Before: ${v.mapBefore.map((f) => f.label).join(', ')}`);
  if (v.mapAfter) lines.push(`After: ${v.mapAfter.map((f) => f.label).join(', ')}`);
  return lines.join('\n');
}
