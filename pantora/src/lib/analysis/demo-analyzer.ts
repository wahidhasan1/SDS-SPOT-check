import type {
  AnalysisResult,
  IssueCategory,
  LanguageIssue,
  ScoreCard,
  ScoreDimension,
  SentenceReview,
  SpeechMetrics,
  TextMetrics,
  VocabularySuggestion,
} from "../types";
import { PAST_MARKER_RE, PRESENT_MARKER_RE, applyRules } from "./rules";
import { PAST_TENSE } from "./verbs";

// Pantora's demo analyzer: deterministic, explainable heuristics. It is used
// whenever no AI provider is configured, and every result it produces is
// labeled "Demo analyzer" in the UI.

export const DEMO_ANALYZER_LIMITATION =
  "Demo analyzer: transparent pattern rules, not an AI model. It recognizes common learner patterns only, so it can miss mistakes or occasionally flag a correct sentence.";

const CONNECTORS = [
  "because", "so", "but", "however", "although", "though", "for example", "for instance", "also",
  "first", "then", "after that", "finally", "in addition", "on the other hand", "which", "while",
  "as a result", "therefore", "overall", "in the end", "especially", "such as", "even though",
  "instead", "that's why", "admittedly", "of course",
];
const DEVELOPMENT_MARKERS = [
  "because", "for example", "for instance", "such as", "which means", "that's why", "as a result",
  "so ", "in the end", "overall", "finally", "first", "second", "this means", "the reason",
];
const STOPWORDS = new Set(
  "a an the and or but if of to in on at for with from by about as is are was were be been being am i you he she it we they me him her us them my your his its our their this that these those what which who whom whose when where why how do does did have has had will would can could should may might must not no yes so very too also just than then there here into out up down over under again more most some any each every all both few many much other such only own same s t don't can't won't i'm it's you're we're they're i've".split(
    " ",
  ),
);
const SIMPLE_WORDS = new Set(
  "because something everything anything sometimes different another together usually really morning evening afternoon monday tuesday wednesday thursday friday saturday sunday january february september october november december weekend".split(" "),
);

const VOCAB_PHRASES: Record<string, string[]> = {
  "very good": ["excellent", "great", "wonderful"],
  "very bad": ["terrible", "awful"],
  "very big": ["huge", "enormous"],
  "very small": ["tiny"],
  "very happy": ["delighted", "thrilled"],
  "very sad": ["heartbroken", "miserable"],
  "very tired": ["exhausted"],
  "very interesting": ["fascinating", "captivating"],
  "very important": ["essential", "crucial"],
  "very beautiful": ["stunning", "gorgeous"],
  "very nice": ["lovely", "delightful"],
  "very difficult": ["challenging", "tough"],
  "very easy": ["effortless", "straightforward"],
  "very hot": ["boiling", "scorching"],
  "very cold": ["freezing"],
  "very busy": ["hectic", "swamped"],
  "very relaxing": ["peaceful", "soothing"],
  "very kind": ["generous", "thoughtful"],
  "very boring": ["dull", "tedious"],
  "very funny": ["hilarious"],
  "very scared": ["terrified"],
};
const VOCAB_REPEATED: { re: RegExp; label: string; min: number; alternatives: string[]; note: string }[] = [
  { re: /\bnice\b/gi, label: "nice", min: 2, alternatives: ["pleasant", "lovely", "charming"], note: '"Nice" appears several times. A more specific adjective paints a clearer picture.' },
  { re: /\bgood\b/gi, label: "good", min: 3, alternatives: ["enjoyable", "rewarding", "helpful", "impressive"], note: '"Good" is used often. Try a word that says *why* it is good.' },
  { re: /\bthings?\b/gi, label: "thing / things", min: 2, alternatives: ["activities", "details", "aspects", "ideas"], note: '"Thing" is vague. Naming the exact idea makes you sound more precise.' },
  { re: /\ba lot of\b/gi, label: "a lot of", min: 2, alternatives: ["plenty of", "many", "a wide range of"], note: 'Vary "a lot of" to keep your speech interesting.' },
  { re: /\bbig\b/gi, label: "big", min: 2, alternatives: ["large", "significant", "major"], note: 'Choose a word that fits the context, such as "a significant change".' },
  { re: /\bvery\b/gi, label: "very", min: 3, alternatives: ["really", "extremely", "incredibly"], note: '"Very" appears many times. A stronger adjective often works better than "very" + adjective.' },
];

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\s*\n+\s*/)
    .map((s) => s.trim())
    .filter((s) => /[A-Za-z]/.test(s));
}

export function words(text: string): string[] {
  return text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
}

function tidySentence(sentence: string): { text: string; changed: boolean } {
  let text = sentence.trim();
  let changed = false;
  if (/^[a-z]/.test(text)) {
    text = text[0].toUpperCase() + text.slice(1);
    changed = true;
  }
  if (!/[.!?]["')]?$/.test(text)) {
    text = `${text}.`;
    changed = true;
  }
  return { text, changed };
}

const PAST_FORMS = new Set([...Object.values(PAST_TENSE).filter((v) => v !== "read"), "was", "were"]);

function hasExplicitPast(sentence: string) {
  if (PAST_MARKER_RE.test(sentence)) return true;
  const ws = words(sentence).map((w) => w.toLowerCase());
  // Ignore participles in the present perfect ("we have found").
  return ws.some((w, i) => PAST_FORMS.has(w) && !/^(have|has|had|i've|we've|they've|you've)$/.test(ws[i - 1] ?? ""));
}

export function computeMetrics(text: string, sentences: string[]): TextMetrics {
  const ws = words(text);
  const lowerText = ` ${text.toLowerCase()} `;
  const connectors = CONNECTORS.filter((c) => new RegExp(`\\b${c.replace(/'/g, "'")}\\b`).test(lowerText));
  const fillerCount = (text.match(/\b(um+|uh+|erm*|hmm+|you know|i mean)\b/gi) ?? []).length;
  const repeatedWords = (text.match(/\b(\w+)\s+\1\b/gi) ?? []).length;
  const unique = new Set(ws.map((w) => w.toLowerCase()));
  return {
    words: ws.length,
    sentences: sentences.length,
    avgSentenceLength: sentences.length ? Math.round((ws.length / sentences.length) * 10) / 10 : 0,
    uniqueWordRatio: ws.length ? Math.round((unique.size / ws.length) * 100) / 100 : 0,
    connectors,
    fillerCount,
    repeatedWords,
  };
}

function findVocabulary(text: string): VocabularySuggestion[] {
  const lowerText = text.toLowerCase();
  const out: VocabularySuggestion[] = [];
  for (const [phrase, alternatives] of Object.entries(VOCAB_PHRASES)) {
    if (new RegExp(`\\b${phrase}\\b`).test(lowerText)) {
      out.push({ phrase, alternatives, note: `Instead of "${phrase}", one precise word can sound more natural.` });
    }
  }
  for (const item of VOCAB_REPEATED) {
    const count = (text.match(item.re) ?? []).length;
    if (count >= item.min && !out.some((o) => o.phrase.includes(item.label))) {
      out.push({ phrase: item.label, alternatives: item.alternatives, note: item.note });
    }
  }
  return out.slice(0, 5);
}

const EXERCISES: Record<IssueCategory | "default" | "vocabulary", { title: string; instructions: string }> = {
  tense: {
    title: "Time-frame drill",
    instructions:
      'Say three sentences about last weekend using past verbs (went, saw, ate), then three sentences about something you have been doing "for" a period of time.',
  },
  agreement: {
    title: "He / she / it practice",
    instructions: "Describe a friend's daily routine in five sentences. Check that every verb after he or she ends in -s (she works, he goes, she has).",
  },
  articles: {
    title: "Article spotlight",
    instructions: 'Describe your street out loud. Before each noun, pause and choose "a", "an", or "the". Record yourself and listen back.',
  },
  prepositions: {
    title: "Preposition pairs",
    instructions: 'Make one sentence each with: "for two years", "since 2020", "interested in", "depend on", and "listen to".',
  },
  "word-choice": {
    title: "Natural collocations",
    instructions: 'Use each phrase in a sentence: "take a photo", "make a mistake", "tell me", "really like".',
  },
  "word-form": {
    title: "Countable or not?",
    instructions: 'Make sentences with "information", "advice", and "homework" without adding -s. Then compare two things with "better" and "easier".',
  },
  "sentence-structure": {
    title: "Clean sentence patterns",
    instructions: 'Say five opinions starting with "I agree that…", "I suggest trying…", and "You should…" (no "to" after should).',
  },
  punctuation: {
    title: "Read it aloud",
    instructions: "Read your improved answer aloud twice, pausing briefly at every comma and full stop.",
  },
  vocabulary: {
    title: "Upgrade three words",
    instructions: "Retell your answer, replacing three common words (good, nice, very…) with the stronger alternatives suggested above.",
  },
  default: {
    title: "Add one more detail",
    instructions: 'Answer the same prompt again and add a reason with "because" and an example with "for example".',
  },
};

export interface AnalyzeOptions {
  speech?: SpeechMetrics | null;
  inputMode?: "typed" | "spoken";
}

export function analyzeText(text: string, options: AnalyzeOptions = {}): AnalysisResult {
  const original = text.trim();
  const rawSentences = splitSentences(original);
  const issues: LanguageIssue[] = [];
  const sentenceReviews: SentenceReview[] = [];
  let pastContext = false;
  let tidied = false;

  for (const raw of rawSentences) {
    if (hasExplicitPast(raw) && !PRESENT_MARKER_RE.test(raw)) pastContext = true;
    else if (PRESENT_MARKER_RE.test(raw) || /\b(?:is|are|am|have|has)\b/i.test(raw)) pastContext = false;

    const { corrected, issues: found } = applyRules(raw, { pastContext });
    const tidy = tidySentence(corrected);
    if (tidy.changed) tidied = true;
    issues.push(...found);
    const major = found.filter((i) => !i.minor);
    const vocab = findVocabulary(tidy.text);
    let alternative: string | null = null;
    if (vocab.length > 0 && VOCAB_PHRASES[vocab[0].phrase]) {
      alternative = tidy.text.replace(new RegExp(`\\b${vocab[0].phrase}\\b`, "i"), vocab[0].alternatives[0]);
    }
    sentenceReviews.push({
      original: raw,
      corrected: tidy.text,
      changed: major.length > 0,
      explanation: major.length
        ? major.map((i) => i.explanation).filter((v, i, a) => a.indexOf(v) === i).join(" ")
        : found.length
          ? "Only capitalization or punctuation changed."
          : "No common patterns flagged in this sentence.",
      category: major[0]?.category ?? null,
      alternative,
    });
  }

  const improved = sentenceReviews.map((s) => s.corrected).join(" ");
  const metrics = computeMetrics(original, rawSentences);
  const vocabulary = findVocabulary(original);
  const majorIssues = issues.filter((i) => !i.minor);

  const strengths: string[] = [];
  if (metrics.connectors.length >= 2) {
    strengths.push(`You linked ideas with ${metrics.connectors.slice(0, 3).map((c) => `"${c}"`).join(", ")}.`);
  }
  if (metrics.words >= 45) strengths.push(`You developed your answer with ${metrics.words} words.`);
  if (metrics.uniqueWordRatio >= 0.65 && metrics.words >= 25) strengths.push("You used a good variety of words without much repetition.");
  if (/\b(for example|for instance|such as)\b/i.test(original)) strengths.push("You supported a point with an example.");
  if (majorIssues.length === 0 && metrics.words >= 15) strengths.push("The demo rules did not flag any common grammar patterns.");
  if (strengths.length === 0) strengths.push("You answered the prompt. Every attempt builds confidence.");

  const categoryCounts = new Map<IssueCategory, number>();
  for (const issue of majorIssues) categoryCounts.set(issue.category, (categoryCounts.get(issue.category) ?? 0) + 1);
  const topCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const exercise = topCategory ? EXERCISES[topCategory] : vocabulary.length ? EXERCISES.vocabulary : EXERCISES.default;

  let fluencyNotes: string[] | null = null;
  const speech = options.speech ?? null;
  if (speech && speech.durationSeconds > 0) {
    fluencyNotes = [];
    const wpm = speech.wordsPerMinute;
    if (wpm < 70) fluencyNotes.push(`About ${wpm} words per minute: a careful pace. Try linking phrases together with fewer long pauses.`);
    else if (wpm <= 170) fluencyNotes.push(`About ${wpm} words per minute: a comfortable conversational pace.`);
    else fluencyNotes.push(`About ${wpm} words per minute: quite fast. Slowing down slightly can make you easier to follow.`);
    if (metrics.fillerCount > 2) fluencyNotes.push(`${metrics.fillerCount} filler sounds (um, uh) were transcribed. Short silent pauses often sound more confident.`);
    if (metrics.repeatedWords > 1) fluencyNotes.push(`${metrics.repeatedWords} repeated words were transcribed. Repetition is normal; aim to restart sentences less often.`);
    fluencyNotes.push("Speed is estimated from the recording length and the transcript word count. Pronunciation is not assessed.");
  }

  const limitations = [DEMO_ANALYZER_LIMITATION];
  if (!speech) {
    limitations.push(
      options.inputMode === "spoken"
        ? "Fluency was not measured: no recording duration was available for this transcript."
        : "This answer was typed, so pronunciation, accent, and speaking speed were not measured.",
    );
  } else {
    limitations.push("Pronunciation and accent are not assessed: no pronunciation-analysis service is configured.");
  }
  if (tidied) limitations.push("Capitalization and end punctuation were tidied in the improved version; these are not counted as speaking mistakes.");

  const summary =
    majorIssues.length === 0
      ? vocabulary.length
        ? `No common grammar patterns were flagged. There ${vocabulary.length === 1 ? "is one vocabulary idea" : `are ${vocabulary.length} vocabulary ideas`} to make your answer more vivid.`
        : "No common grammar patterns were flagged. Try a longer answer to get more detailed feedback."
      : `The demo analyzer found ${majorIssues.length} pattern${majorIssues.length === 1 ? "" : "s"} to fix${topCategory ? `, mostly related to ${topCategory.replace("-", " ")}` : ""}${vocabulary.length ? `, plus ${vocabulary.length} vocabulary idea${vocabulary.length === 1 ? "" : "s"}` : ""}.`;

  return {
    analyzer: "demo-rules",
    model: null,
    original,
    improved,
    summary,
    strengths: strengths.slice(0, 4),
    issues,
    sentences: sentenceReviews,
    vocabulary,
    metrics,
    speech,
    fluencyNotes,
    exercise,
    limitations,
  };
}

// ---------- Scoring ----------

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

function contentWords(text: string) {
  return words(text)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export interface ScoreContext {
  prompt: string;
  guidance?: string;
  keywords?: string[];
  targetSeconds: number;
}

export const SCORING_NOTE =
  "Pantora's scoring dimensions are a product rubric for practice and motivation. They are not a validated language assessment or certification.";

export function scoreAnalysis(analysis: AnalysisResult, ctx: ScoreContext): ScoreCard {
  const m = analysis.metrics;
  const majorIssues = analysis.issues.filter((i) => !i.minor);
  const targetWords = Math.max(20, Math.round(ctx.targetSeconds * 1.7));
  const lengthRatio = clamp(m.words / targetWords);
  const connectorFactor = clamp(m.connectors.length / 4);
  const fillerPenalty = Math.min(0.4, (m.fillerCount + m.repeatedWords) * 0.05);

  // Fluency and continuity (25)
  const fluencyScore = Math.round(25 * (0.55 * lengthRatio + 0.3 * connectorFactor + 0.15) * (1 - fillerPenalty));
  const fluency: ScoreDimension = {
    key: "fluency",
    label: "Fluency and continuity",
    max: 25,
    score: fluencyScore,
    explanation: `Estimated from the text: ${m.words} words for a ${ctx.targetSeconds}-second answer (target about ${targetWords}), ${m.connectors.length} linking word${m.connectors.length === 1 ? "" : "s"}, and ${m.fillerCount + m.repeatedWords} filler or repeated word${m.fillerCount + m.repeatedWords === 1 ? "" : "s"}. Speaking speed is not part of this score.`,
    wentWell:
      lengthRatio >= 0.8
        ? "You kept going for the whole response time."
        : m.connectors.length > 0
          ? `You connected ideas with "${m.connectors[0]}".`
          : "You started speaking and finished your thought.",
    improve: [
      ...(lengthRatio < 0.8 ? ["Aim to keep talking for the full time, even with simple sentences."] : []),
      ...(connectorFactor < 1 ? ['Link ideas with words like "because", "so", and "after that".'] : []),
      ...(fillerPenalty > 0.1 ? ["Replace filler sounds with a short, silent pause."] : []),
    ].slice(0, 2),
  };

  // Grammar and sentence construction (25)
  const per100 = m.words ? (majorIssues.length / m.words) * 100 : 0;
  let grammarScore = Math.round(25 * clamp(1 - per100 * 0.1, 0.2, 1));
  if (m.words < 20) grammarScore = Math.min(grammarScore, 18);
  const grammarCategories = [...new Set(majorIssues.map((i) => i.category))];
  const grammar: ScoreDimension = {
    key: "grammar",
    label: "Grammar and sentence construction",
    max: 25,
    score: grammarScore,
    explanation:
      majorIssues.length === 0
        ? `No common error patterns were flagged in ${m.sentences} sentence${m.sentences === 1 ? "" : "s"}.${m.words < 20 ? " Short answers are capped because there is less evidence to judge." : ""}`
        : `${majorIssues.length} flagged pattern${majorIssues.length === 1 ? "" : "s"} in ${m.words} words (${grammarCategories.join(", ")}).`,
    wentWell: majorIssues.length <= 1 ? "Most of your sentences followed standard patterns." : "Your sentences were understandable even with a few errors.",
    improve:
      majorIssues.length > 0
        ? majorIssues.slice(0, 2).map((i) => `"${i.original}" → "${i.corrected}"`)
        : ["Try one longer sentence that uses \"because\" or \"which\" to show more range."],
  };

  // Vocabulary and expression (20)
  const cws = contentWords(analysis.original);
  const uniqueContent = new Set(cws);
  const ttr = cws.length ? uniqueContent.size / cws.length : 0;
  const advanced = [...uniqueContent].filter((w) => w.length >= 8 && !SIMPLE_WORDS.has(w));
  const advFactor = clamp(advanced.length / Math.max(4, cws.length * 0.2));
  const overusePenalty = Math.min(0.3, analysis.vocabulary.length * 0.1);
  const vocabScore = Math.round(20 * clamp(0.25 + 0.3 * clamp((ttr - 0.4) / 0.4) + 0.3 * advFactor + 0.15 * lengthRatio - overusePenalty, 0.2, 1));
  const vocabulary: ScoreDimension = {
    key: "vocabulary",
    label: "Vocabulary and expression",
    max: 20,
    score: vocabScore,
    explanation: `Based on word variety (${Math.round(ttr * 100)}% unique content words), longer or less common words (${advanced.length}), overused phrases (${analysis.vocabulary.length}), and how much you said.`,
    wentWell: advanced.length ? `Words like "${advanced.slice(0, 2).join('", "')}" add precision.` : "Your word choice was clear and easy to follow.",
    improve: analysis.vocabulary.length
      ? analysis.vocabulary.slice(0, 2).map((v) => `Instead of "${v.phrase}", try "${v.alternatives[0]}".`)
      : ["Add one specific, descriptive word to each main idea."],
  };

  // Relevance and clarity (20)
  const promptWords = new Set([...contentWords(`${ctx.prompt} ${ctx.guidance ?? ""}`), ...(ctx.keywords ?? []).flatMap((k) => contentWords(k))]);
  const stems = new Set([...promptWords].map((w) => w.slice(0, 5)));
  const overlap = new Set(cws.filter((w) => stems.has(w.slice(0, 5))));
  const relevanceFactor = clamp(overlap.size / 3);
  const clarity = m.avgSentenceLength >= 6 && m.avgSentenceLength <= 24 ? 1 : 0.6;
  let relevanceScore = Math.round(20 * (0.25 + 0.4 * relevanceFactor + 0.2 * clarity + 0.15 * lengthRatio));
  if (m.words < 12) relevanceScore = Math.round(relevanceScore * 0.6);
  const relevance: ScoreDimension = {
    key: "relevance",
    label: "Relevance and clarity",
    max: 20,
    score: relevanceScore,
    explanation: `Estimated by keyword overlap with the prompt (${overlap.size} matching idea${overlap.size === 1 ? "" : "s"}) and sentence length (average ${m.avgSentenceLength} words). It cannot judge meaning the way a person can.`,
    wentWell: overlap.size >= 2 ? "You stayed on topic and referred directly to the prompt." : "Your answer was easy to follow.",
    improve: [
      ...(relevanceFactor < 1 ? ["Repeat a key idea from the question in your first sentence."] : []),
      ...(clarity < 1 ? [m.avgSentenceLength > 24 ? "Break very long sentences into two." : "Join very short sentences with linking words."] : []),
    ].slice(0, 2),
  };

  // Response development (10)
  const lowerText = analysis.original.toLowerCase();
  const markers = DEVELOPMENT_MARKERS.filter((d) => lowerText.includes(d));
  const developmentScore = Math.round(10 * (0.2 + 0.4 * clamp(markers.length / 2) + 0.4 * clamp(m.sentences / 4)));
  const development: ScoreDimension = {
    key: "development",
    label: "Response development",
    max: 10,
    score: developmentScore,
    explanation: `${m.sentences} sentence${m.sentences === 1 ? "" : "s"} and ${markers.length} reason or example marker${markers.length === 1 ? "" : "s"} (because, for example, so…).`,
    wentWell: markers.length ? "You explained your reasons instead of only giving facts." : "You gave a direct answer.",
    improve: [
      ...(markers.length < 2 ? ['Support your main point with "because…" and "for example…".'] : []),
      ...(m.sentences < 4 ? ["Finish with a short concluding sentence."] : []),
    ].slice(0, 2),
  };

  const dimensions = [fluency, grammar, vocabulary, relevance, development];
  return {
    analyzer: "demo-rules",
    total: dimensions.reduce((sum, d) => sum + d.score, 0),
    dimensions,
    pronunciation: {
      measured: false,
      note: "Pronunciation is not scored. Pantora has no reliable pronunciation-analysis service configured, and accent is never part of the score.",
    },
    basis: "text",
  };
}

export function decideResult(userTotal: number, opponentTotal: number): "win" | "loss" | "draw" {
  if (Math.abs(userTotal - opponentTotal) <= 2) return "draw";
  return userTotal > opponentTotal ? "win" : "loss";
}
