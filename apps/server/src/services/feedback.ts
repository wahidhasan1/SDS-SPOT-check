import { analyseText, countWords, splitParagraphs, splitSentences, tokenize, type TextMetrics } from '@app/shared';
import { q } from '../db/pool';
import { isKnownWord, spellingSuggestions } from './dictionary';

export interface Check {
  id: string;
  status: 'good' | 'warn' | 'info';
  title: string;
  detail: string;
}

let vocabLevels: Map<string, string> | null = null;
let vocabLoadedAt = 0;
async function levelMap() {
  if (!vocabLevels || Date.now() - vocabLoadedAt > 10 * 60_000) {
    const rows = await q<{ word: string; cefr: string }>(`SELECT lower(word) AS word, cefr FROM vocabulary WHERE status='published'`);
    vocabLevels = new Map(rows.map((r) => [r.word, r.cefr]));
    vocabLoadedAt = Date.now();
  }
  return vocabLevels;
}

const INFORMAL: Record<string, string> = {
  kids: 'children', stuff: 'things / items / belongings', gonna: 'going to', wanna: 'want to', 'a lot of': 'many / much / a large number of',
  really: '(often unnecessary) — try “particularly”, “extremely”', pretty: 'fairly / quite', guy: 'man / person', guys: 'people',
  okay: 'acceptable', ok: 'acceptable', 'get rid of': 'eliminate / remove', 'find out': 'discover', thing: 'factor / aspect / issue',
  things: 'factors / aspects / issues', nowadays: '(acceptable, but often overused) — try “today” or “in recent years”', huge: 'substantial / considerable',
};

export interface WritingAnalysis {
  metrics: TextMetrics;
  checks: Check[];
  spelling: { word: string; suggestions: string[] }[];
  advancedWords: { word: string; level: string }[];
  informal: { phrase: string; suggestion: string }[];
}

/** Measurable, rule-based writing analysis. No band score is produced from these metrics. */
export async function analyseWriting(text: string, opts: { task: number; kind: string; testType: string; minWords: number }): Promise<WritingAnalysis> {
  const metrics = analyseText(text);
  const checks: Check[] = [];
  const lower = text.toLowerCase();
  const paragraphs = splitParagraphs(text);
  const sentences = splitSentences(text);
  const isLetter = opts.kind.startsWith('letter');
  const formal = opts.testType !== 'general' || opts.kind === 'letter_formal' || opts.task === 2;

  if (metrics.words < opts.minWords) {
    checks.push({ id: 'length', status: 'warn', title: `Under the minimum length (${metrics.words}/${opts.minWords} words)`, detail: 'IELTS examiners reduce the Task Achievement/Response score for under-length answers. Develop your points further.' });
  } else if (metrics.words > opts.minWords * 1.8) {
    checks.push({ id: 'length', status: 'info', title: `Long response (${metrics.words} words)`, detail: 'Longer is not automatically better. In the real test, very long answers leave less time to check for mistakes.' });
  } else {
    checks.push({ id: 'length', status: 'good', title: `Good length (${metrics.words} words)`, detail: `Meets the ${opts.minWords}-word minimum.` });
  }

  const idealParas = opts.task === 2 ? [4, 5] : isLetter ? [3, 5] : [3, 4];
  if (paragraphs.length < idealParas[0]) {
    checks.push({ id: 'paragraphs', status: 'warn', title: `Only ${paragraphs.length} paragraph${paragraphs.length === 1 ? '' : 's'}`, detail: `Clear paragraphing supports Coherence and Cohesion. Aim for about ${idealParas[0]}–${idealParas[1]} paragraphs, separated by a blank line.` });
  } else {
    checks.push({ id: 'paragraphs', status: 'good', title: `${paragraphs.length} paragraphs`, detail: 'Your response is divided into paragraphs.' });
  }

  if (opts.task === 1 && !isLetter) {
    const hasOverview = /\b(overall|in general|it is clear|it can be seen|generally|in summary)\b/.test(lower);
    checks.push(hasOverview
      ? { id: 'overview', status: 'good', title: 'Overview included', detail: 'You signposted an overview of the main trends — essential for Task 1.' }
      : { id: 'overview', status: 'warn', title: 'No clear overview', detail: 'Add a sentence starting “Overall, …” that summarises the main trends or differences without detailed numbers.' });
    const numbers = (text.match(/\d+(\.\d+)?/g) ?? []).length;
    checks.push(numbers >= 4
      ? { id: 'data', status: 'good', title: `Data supported (${numbers} figures)`, detail: 'You referred to specific figures from the visual.' }
      : { id: 'data', status: 'warn', title: 'Few figures quoted', detail: 'Support your comparisons with key numbers from the chart, table or diagram.' });
    if (/\b(i think|i believe|in my opinion)\b/.test(lower)) {
      checks.push({ id: 'opinion', status: 'warn', title: 'Personal opinion in Task 1', detail: 'Academic Task 1 is a factual report. Remove personal opinions.' });
    }
  }
  if (opts.task === 2) {
    const intro = paragraphs[0]?.toLowerCase() ?? '';
    const concl = paragraphs[paragraphs.length - 1]?.toLowerCase() ?? '';
    const position = /\b(i (strongly )?(believe|agree|disagree|think|feel)|in my (view|opinion)|this essay (will )?(argue|discuss)|i would argue)\b/;
    checks.push(position.test(intro) || position.test(concl)
      ? { id: 'position', status: 'good', title: 'Clear position', detail: 'You stated your view, which supports Task Response.' }
      : { id: 'position', status: 'warn', title: 'Position not clearly stated', detail: 'State your opinion clearly in the introduction and repeat it in the conclusion.' });
    checks.push(/\b(in conclusion|to conclude|to sum up|overall|in summary)\b/.test(concl)
      ? { id: 'conclusion', status: 'good', title: 'Conclusion signposted', detail: 'Your final paragraph is clearly a conclusion.' }
      : { id: 'conclusion', status: 'warn', title: 'No clear conclusion', detail: 'End with a short paragraph beginning “In conclusion, …” that sums up your position.' });
  }
  if (isLetter) {
    const opening = /^\s*dear\b/i.test(text);
    const closings: Record<string, RegExp> = {
      letter_formal: /\byours faithfully\b|\byours sincerely\b/,
      letter_semi: /\byours sincerely\b|\bkind regards\b|\bbest regards\b/,
      letter_informal: /\b(best wishes|love|take care|all the best|see you soon|cheers)\b/,
    };
    checks.push(opening
      ? { id: 'greeting', status: 'good', title: 'Letter opening present', detail: 'You began with an appropriate salutation.' }
      : { id: 'greeting', status: 'warn', title: 'Missing salutation', detail: 'Begin with the salutation given in the task (e.g. “Dear Sir or Madam,”).' });
    checks.push(closings[opts.kind]?.test(lower)
      ? { id: 'closing', status: 'good', title: 'Suitable sign-off', detail: 'Your closing matches the tone of the letter.' }
      : { id: 'closing', status: 'warn', title: 'Check your sign-off', detail: opts.kind === 'letter_formal' ? 'Formal letters to an unnamed person end with “Yours faithfully,”.' : opts.kind === 'letter_semi' ? 'Semi-formal letters to a named person usually end with “Yours sincerely,” or “Kind regards,”.' : 'Informal letters can end with “Best wishes,” or “Take care,”.' });
  }

  const linkers = metrics.linkingDevices;
  const totalLinks = linkers.reduce((a, l) => a + l.count, 0);
  const overusedLinker = linkers.find((l) => l.count >= 4);
  if (linkers.length < 3) {
    checks.push({ id: 'linking', status: 'warn', title: 'Limited linking', detail: 'Use a range of linking words (however, as a result, for example, whereas) to connect ideas.' });
  } else if (overusedLinker) {
    checks.push({ id: 'linking', status: 'warn', title: `“${overusedLinker.phrase}” used ${overusedLinker.count} times`, detail: 'Mechanical overuse of a linker can lower Coherence and Cohesion. Vary your linking or use referencing (this, these, such).' });
  } else {
    checks.push({ id: 'linking', status: 'good', title: `Varied linking (${linkers.length} different, ${totalLinks} total)`, detail: linkers.slice(0, 6).map((l) => l.phrase).join(', ') });
  }
  if (metrics.avgSentenceLength > 32) {
    checks.push({ id: 'sentences', status: 'warn', title: 'Very long sentences', detail: `Average ${metrics.avgSentenceLength} words per sentence. Long sentences increase the risk of errors; split some of them.` });
  } else if (metrics.avgSentenceLength < 11 && metrics.sentences > 4) {
    checks.push({ id: 'sentences', status: 'warn', title: 'Mostly short sentences', detail: 'Combine ideas using relative clauses (which, who), conditionals and subordinators (although, because) to show grammatical range.' });
  } else {
    checks.push({ id: 'sentences', status: 'good', title: `Sentence length varies (average ${metrics.avgSentenceLength} words)`, detail: `Longest sentence: ${metrics.longestSentence} words.` });
  }
  if (metrics.overusedWords.length) {
    checks.push({ id: 'repetition', status: 'warn', title: 'Repeated words', detail: metrics.overusedWords.map((w) => `“${w.word}” ×${w.count}`).join(', ') + '. Use synonyms or pronouns to avoid repetition.' });
  }
  const contractions = (text.match(/\b\w+'(t|s|re|ve|ll|d|m)\b/gi) ?? []).filter((c) => !/'s$/i.test(c) || /\b(it|that|there|what|he|she)'s\b/i.test(c));
  if (formal && contractions.length > 0 && opts.kind !== 'letter_informal') {
    checks.push({ id: 'contractions', status: 'warn', title: `Contractions in formal writing (${contractions.length})`, detail: `Write full forms in formal writing: ${[...new Set(contractions)].slice(0, 5).join(', ')}.` });
  }

  const spelling: WritingAnalysis['spelling'] = [];
  const seen = new Set<string>();
  for (const s of sentences) {
    const words = s.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? [];
    words.forEach((w, i) => {
      if (i > 0 && /^[A-Z]/.test(w)) return; // probably a name
      const lw = w.toLowerCase();
      if (seen.has(lw) || w.length < 3) return;
      seen.add(lw);
      if (!isKnownWord(lw)) spelling.push({ word: w, suggestions: spellingSuggestions(lw) });
    });
  }
  if (spelling.length) {
    checks.push({ id: 'spelling', status: 'warn', title: `${spelling.length} possible spelling issue${spelling.length === 1 ? '' : 's'}`, detail: 'Checked against a dictionary; names and very new words may be flagged by mistake.' });
  }
  const levels = await levelMap();
  const tokens = new Set(tokenize(text));
  const advancedWords = [...tokens]
    .map((w) => ({ word: w, level: levels.get(w) ?? '' }))
    .filter((w) => ['B2', 'C1', 'C2'].includes(w.level));
  const informal = Object.entries(INFORMAL)
    .filter(([p]) => new RegExp(`\\b${p}\\b`, 'i').test(text))
    .map(([phrase, suggestion]) => ({ phrase, suggestion }));
  if (formal && informal.length && opts.kind !== 'letter_informal') {
    checks.push({ id: 'register', status: 'warn', title: 'Informal vocabulary', detail: informal.map((i) => `“${i.phrase}” → ${i.suggestion}`).join('; ') });
  }
  return { metrics, checks, spelling: spelling.slice(0, 30), advancedWords, informal };
}

export interface SpeakingAnalysis {
  metrics: TextMetrics & { wordsPerMinute: number; durationSec: number };
  checks: Check[];
  advancedWords: { word: string; level: string }[];
}

export async function analyseSpeaking(transcript: string, durationSec: number, part: number): Promise<SpeakingAnalysis> {
  const base = analyseText(transcript);
  const words = countWords(transcript);
  const wpm = durationSec > 0 ? Math.round((words / durationSec) * 60) : 0;
  const checks: Check[] = [];
  const target = part === 2 ? 90 : part === 3 ? 30 : 15;
  if (durationSec < target) {
    checks.push({ id: 'length', status: 'warn', title: `Short answer (${Math.round(durationSec)}s)`, detail: part === 2 ? 'Aim to speak for the full 1–2 minutes. Use the cue card points to keep going.' : `Extend your answer with a reason and an example (aim for ${target}+ seconds).` });
  } else {
    checks.push({ id: 'length', status: 'good', title: `Well-developed length (${Math.round(durationSec)}s)`, detail: 'You spoke for a suitable amount of time.' });
  }
  if (wpm < 90) checks.push({ id: 'pace', status: 'warn', title: `Slow pace (${wpm} words/min)`, detail: 'Long pauses can affect fluency. Practise linking ideas with phrases such as “The main reason is…”.' });
  else if (wpm > 190) checks.push({ id: 'pace', status: 'info', title: `Very fast pace (${wpm} words/min)`, detail: 'Slow down slightly so ideas are clear.' });
  else checks.push({ id: 'pace', status: 'good', title: `Natural pace (${wpm} words/min)`, detail: 'Comfortable speaking speed.' });
  const fillers = base.fillerWords.reduce((a, f) => a + f.count, 0);
  if (fillers > Math.max(3, words / 40)) {
    checks.push({ id: 'fillers', status: 'warn', title: `Frequent fillers (${fillers})`, detail: base.fillerWords.map((f) => `“${f.phrase}” ×${f.count}`).join(', ') + '. Replace some with short pauses or phrases like “Let me think…”.' });
  }
  if (base.overusedWords.length) {
    checks.push({ id: 'repetition', status: 'info', title: 'Repeated words', detail: base.overusedWords.map((w) => `“${w.word}” ×${w.count}`).join(', ') });
  }
  const levels = await levelMap();
  const advancedWords = [...new Set(tokenize(transcript))]
    .map((w) => ({ word: w, level: levels.get(w) ?? '' }))
    .filter((w) => ['B2', 'C1', 'C2'].includes(w.level));
  checks.push(advancedWords.length >= 2
    ? { id: 'vocab', status: 'good', title: `Less common vocabulary (${advancedWords.length})`, detail: advancedWords.map((w) => w.word).join(', ') }
    : { id: 'vocab', status: 'info', title: 'Mostly everyday vocabulary', detail: 'Try to include a few precise, less common words or collocations related to the topic.' });
  checks.push({ id: 'pronunciation', status: 'info', title: 'Pronunciation not assessed', detail: 'This analysis uses a transcript only, so it cannot judge pronunciation, stress or intonation.' });
  return { metrics: { ...base, wordsPerMinute: wpm, durationSec }, checks, advancedWords };
}
