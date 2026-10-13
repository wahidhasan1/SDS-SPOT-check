/**
 * Deterministic text metrics used for writing/speaking feedback and live word counts.
 * These are measurable facts about the text, not AI judgements.
 */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+(?:['’-][a-z]+)*/g) ?? []).map((w) => w.replace(/’/g, "'"));
}

/** IELTS-style word count: hyphenated words and contractions count as one; numbers count. */
export function countWords(text: string): number {
  const m = text.trim().match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
  return m ? m.length : 0;
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export const LINKING_DEVICES = [
  'however', 'moreover', 'furthermore', 'in addition', 'therefore', 'consequently', 'as a result',
  'on the other hand', 'in contrast', 'nevertheless', 'although', 'whereas', 'despite', 'in spite of',
  'for example', 'for instance', 'such as', 'in conclusion', 'to sum up', 'overall', 'firstly',
  'secondly', 'finally', 'similarly', 'likewise', 'meanwhile', 'subsequently', 'thus', 'hence',
  'in other words', 'that is to say', 'not only', 'as well as', 'because', 'since', 'unless',
  'whilst', 'while', 'otherwise', 'accordingly', 'notably', 'in particular',
];

export const FILLER_WORDS = ['um', 'uh', 'erm', 'er', 'hmm', 'like', 'you know', 'i mean', 'kind of', 'sort of', 'basically', 'actually'];

const STOPWORDS = new Set(
  'a an the and or but if of to in on at by for with from as is are was were be been being am i you he she it we they me him her us them my your his its our their this that these those there here not no do does did have has had will would can could should may might must so than then too very just also into over about up down out what which who whom whose when where why how all any some each few more most other such only own same'.split(
    ' ',
  ),
);

export interface TextMetrics {
  words: number;
  uniqueWords: number;
  sentences: number;
  paragraphs: number;
  avgSentenceLength: number;
  longestSentence: number;
  lexicalDiversity: number; // Guiraud's root TTR on content words
  linkingDevices: { phrase: string; count: number }[];
  overusedWords: { word: string; count: number }[];
  fillerWords: { phrase: string; count: number }[];
  questionSentences: number;
}

function countPhrase(lower: string, phrase: string): number {
  const re = new RegExp(`\\b${phrase.replace(/ /g, '\\s+')}\\b`, 'g');
  return (lower.match(re) ?? []).length;
}

export function analyseText(text: string): TextMetrics {
  const tokens = tokenize(text);
  const sentences = splitSentences(text);
  const lower = text.toLowerCase();
  const sentenceLengths = sentences.map((s) => countWords(s));
  const content = tokens.filter((t) => !STOPWORDS.has(t) && t.length > 2);
  const freq = new Map<string, number>();
  for (const t of content) freq.set(t, (freq.get(t) ?? 0) + 1);
  const threshold = Math.max(3, Math.ceil(tokens.length / 60));
  const overusedWords = [...freq.entries()]
    .filter(([, c]) => c >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));
  const linkingDevices = LINKING_DEVICES.map((phrase) => ({ phrase, count: countPhrase(lower, phrase) })).filter(
    (x) => x.count > 0,
  );
  const fillerWords = FILLER_WORDS.map((phrase) => ({ phrase, count: countPhrase(lower, phrase) })).filter(
    (x) => x.count > 0,
  );
  const uniqueContent = new Set(content).size;
  return {
    words: countWords(text),
    uniqueWords: new Set(tokens).size,
    sentences: sentences.length,
    paragraphs: splitParagraphs(text).length,
    avgSentenceLength: sentences.length ? Math.round((tokens.length / sentences.length) * 10) / 10 : 0,
    longestSentence: sentenceLengths.length ? Math.max(...sentenceLengths) : 0,
    lexicalDiversity: content.length ? Math.round((uniqueContent / Math.sqrt(content.length)) * 100) / 100 : 0,
    linkingDevices,
    overusedWords,
    fillerWords,
    questionSentences: sentences.filter((s) => s.endsWith('?')).length,
  };
}
