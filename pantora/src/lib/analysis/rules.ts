import type { IssueCategory, LanguageIssue } from "../types";
import {
  PAST_PARTICIPLE,
  PAST_TENSE,
  PRESENT_VERBS_FOR_AGREEMENT,
  SINGULAR_NOUN_SUBJECTS,
  baseFromThirdPerson,
  gerund,
  thirdPerson,
} from "./verbs";

// Transparent, pattern-based grammar rules for Pantora's demo analyzer.
// Each rule describes exactly what it checks so the UI can explain it. The
// rules only recognize common learner patterns; they are not a full grammar
// checker and are documented as such in the product.

export interface RuleContext {
  /** True when an earlier sentence (or this one) set a finished-past time frame. */
  pastContext: boolean;
}

export interface Rule {
  id: string;
  category: IssueCategory;
  explanation: string;
  minor?: boolean;
  /** Optional precondition evaluated on the whole sentence. */
  when?: (sentence: string, ctx: RuleContext) => boolean;
  pattern: RegExp;
  replace: (match: string, groups: string[]) => string | null;
}

const NUMBER_WORDS = "a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|a few|several|many|\\d+";
const DURATION = `(?:${NUMBER_WORDS}) (?:long )?(?:years?|months?|weeks?|days?|hours?|minutes?)`;
const DURATION_SRC = `\\b(?:for (?:${DURATION}|a long time)|since (?:\\d{4}|last \\w+|I was|childhood|school|then|january|february|march|april|may|june|july|august|september|october|november|december))\\b`;
const DURATION_RE = new RegExp(DURATION_SRC, "i");
/** The duration must appear later in the same clause as the verb. */
const DURATION_AHEAD = `(?=[^,;.!?]*${DURATION_SRC})`;

export const PAST_MARKER_RE =
  /\b(yesterday|last (?:night|week|weekend|month|year|summer|winter|spring|autumn|fall|monday|tuesday|wednesday|thursday|friday|saturday|sunday|time)|\d+ (?:days?|weeks?|months?|years?) ago|(?:a|one|two|three|four|five|few|several) (?:days?|weeks?|months?|years?) ago|in (?:19|20)\d\d|when (?:I|we) (?:was|were))\b/i;
export const PRESENT_MARKER_RE =
  /\b(now|today|these days|nowadays|usually|every|normally|currently|tomorrow|next|will|going to|in the future|in five years)\b/i;

const PAST_VERB_ALTERNATION = Object.keys(PAST_TENSE).join("|");
const THIRD_PERSON_ALTERNATION = Object.keys(PAST_TENSE).map(thirdPerson).join("|");
const PARTICIPLES =
  "been|gone|done|seen|made|found|had|got|gotten|taken|given|known|written|eaten|met|told|said|left|bought|become|come|lost|won|spent|heard|thought|brought|taught|felt|kept|sent|paid|chosen|broken|flown|driven|run|begun|read|always|never|just|already|to";
const AGREEMENT_VERBS = [...new Set(PRESENT_VERBS_FOR_AGREEMENT)].join("|");
const NOUN_SUBJECTS = SINGULAR_NOUN_SUBJECTS.join("|");
const ADVERBS = "(?:also |then |really |just |finally |first |quickly |suddenly )?";

const SUBJECT_TO_PERFECT: Record<string, string> = {
  "i am": "I have been", "i'm": "I have been", "we are": "we have been", "we're": "we have been",
  "they are": "they have been", "they're": "they have been", "you are": "you have been",
  "you're": "you have been", "he is": "he has been", "he's": "he has been", "she is": "she has been",
  "she's": "she has been",
};

function lower(s: string) {
  return s.toLowerCase();
}

export const RULES: Rule[] = [
  {
    id: "lowercase-i",
    category: "punctuation",
    minor: true,
    explanation: 'The pronoun "I" is always written with a capital letter.',
    pattern: /\bi\b(?=(?:'|\s|[,.!?]|$))/g,
    replace: () => "I",
  },
  {
    id: "since-duration",
    category: "prepositions",
    explanation: 'Use "for" with a length of time (for two years) and "since" with a starting point (since 2022).',
    pattern: new RegExp(`\\bsince (${NUMBER_WORDS}) (years?|months?|weeks?|days?|hours?|minutes?)\\b`, "gi"),
    replace: (_m, [n, unit]) => `for ${n} ${unit}`,
  },
  {
    id: "since-long-time",
    category: "prepositions",
    explanation: 'Say "for a long time" to describe a length of time.',
    pattern: /\bsince (?:a )?long time\b/gi,
    replace: () => "for a long time",
  },
  {
    id: "continuous-with-duration",
    category: "tense",
    explanation:
      'Use the present perfect continuous ("have been working") for an activity that began in the past and continues now.',
    when: (s) => DURATION_RE.test(s) && !PAST_MARKER_RE.test(s) && !/\b(?:will|next|tomorrow)\b/i.test(s),
    pattern: new RegExp(`\\b(I am|I'm|we are|we're|they are|they're|you are|you're|he is|he's|she is|she's) (?!going\\b|leaving\\b|staying\\b|coming\\b|visiting\\b|travel(?:l)?ing\\b|flying\\b)(\\w+ing)\\b${DURATION_AHEAD}`, "gi"),
    replace: (_m, [subject, verb]) => `${SUBJECT_TO_PERFECT[lower(subject)] ?? subject} ${verb}`,
  },
  {
    id: "simple-with-duration",
    category: "tense",
    explanation:
      'For a situation that started in the past and is still true, use the present perfect ("I have lived here for five years").',
    when: (s) => DURATION_RE.test(s) && !PAST_MARKER_RE.test(s) && !/\b(?:will|next|tomorrow|usually|every)\b/i.test(s),
    pattern: new RegExp(`\\b(I|we|they|you|he|she) (live|lives|work|works|know|knows|study|studies|teach|teaches)\\b(?= (?:here|there|in|at|as|for|since|with|him|her|them|each|this|my|english))${DURATION_AHEAD}`, "gi"),
    replace: (_m, [subject, verb]) => {
      const base = PAST_PARTICIPLE[lower(verb)] ? lower(verb) : baseFromThirdPerson(verb) ?? lower(verb);
      const participle = PAST_PARTICIPLE[base];
      if (!participle) return null;
      const aux = /^(he|she)$/i.test(subject) ? "has" : "have";
      return `${subject} ${aux} ${participle}`;
    },
  },
  {
    id: "past-time-present-verb",
    category: "tense",
    explanation: "Use the past simple for a completed action at a finished time in the past (yesterday, last week, two years ago).",
    when: (_s, ctx) => ctx.pastContext,
    pattern: new RegExp(
      `(?<!\\b(?:did|didn't|do|does|don't|doesn't|can|could|will|would|should|must|might|may|to|let|not)\\s)\\b(I|we|they|you|he|she|it|my \\w+) ${ADVERBS}((?:have|has)(?! (?:${PARTICIPLES}|\\w+ed)\\b)|${PAST_VERB_ALTERNATION.replace(/\bhave\|/, "")}|${THIRD_PERSON_ALTERNATION.replace(/\bhas\|/, "")})\\b`,
      "gi",
    ),
    replace: (match, [subject, verb]) => {
      const v = lower(verb);
      const base = PAST_TENSE[v] ? v : baseFromThirdPerson(v);
      if (!base || !PAST_TENSE[base]) return null;
      // Keep any adverb between the subject and the verb.
      const middle = match.slice(subject.length, match.length - verb.length);
      return `${subject}${middle}${PAST_TENSE[base]}`;
    },
  },
  {
    id: "past-negative",
    category: "tense",
    explanation: 'In the past, make negatives with "didn\'t" + the base verb.',
    when: (_s, ctx) => ctx.pastContext,
    pattern: /\b(I|we|they|you|he|she|it) (don't|doesn't|do not|does not) (\w+)/gi,
    replace: (_m, [subject, neg, verb]) => `${subject} ${/not/i.test(neg) ? "did not" : "didn't"} ${verb}`,
  },
  {
    id: "didnt-past",
    category: "tense",
    explanation: 'After "did" or "didn\'t", use the base form of the verb ("I didn\'t go").',
    pattern: new RegExp(`\\b(didn't|did not|did you|did he|did she|did they|did we) (${Object.values(PAST_TENSE).filter((p) => p !== "read").join("|")})\\b`, "gi"),
    replace: (_m, [aux, past]) => {
      const base = Object.entries(PAST_TENSE).find(([, p]) => p === lower(past))?.[0];
      return base ? `${aux} ${base}` : null;
    },
  },
  {
    id: "have-went",
    category: "tense",
    explanation: 'The present perfect uses the past participle: "have gone", not "have went".',
    pattern: /\b(have|has|had) went\b/gi,
    replace: (_m, [aux]) => `${aux} gone`,
  },
  {
    id: "be-agree",
    category: "sentence-structure",
    explanation: '"Agree" is a verb, so you don\'t need "am" or "is": say "I agree".',
    pattern: /\b(I|we|they|you|he|she) (?:am|'m|are|'re|is|'s) agree\b/gi,
    replace: (_m, [subject]) => `${subject} ${/^(he|she)$/i.test(subject) ? "agrees" : "agree"}`,
  },
  {
    id: "third-person-dont",
    category: "agreement",
    explanation: 'With he, she, it, or a singular noun, use "doesn\'t" instead of "don\'t".',
    pattern: new RegExp(`\\b(he|she|it|everyone|everybody|someone|(?:my|his|her|our|their|the) (?:${NOUN_SUBJECTS})) don't\\b`, "gi"),
    replace: (_m, [subject]) => `${subject} doesn't`,
  },
  {
    id: "third-person-s",
    category: "agreement",
    explanation: "In the present simple, add -s or -es to the verb after he, she, it, or a singular noun (she speaks, it helps).",
    when: (_s, ctx) => !ctx.pastContext,
    pattern: new RegExp(
      `(?<!\\b(?:did|does|do|can|could|will|would|should|must|might|may|shall|let|make|made|makes|help|helps|see|saw|watch|hear|heard|to)\\s)\\b(he|she|it|everyone|everybody|someone|nobody|(?:my|his|her|our|their|the|a|an) (?:(?:good|best|new|old|little|big|younger|older|whole) )?(?:${NOUN_SUBJECTS})) ${ADVERBS}(${AGREEMENT_VERBS})\\b`,
      "gi",
    ),
    replace: (match, [subject, verb]) => {
      const middle = match.slice(subject.length, match.length - verb.length);
      return `${subject}${middle}${thirdPerson(verb)}`;
    },
  },
  {
    id: "plural-be",
    category: "agreement",
    explanation: 'Use "are" / "were" with plural subjects (people are, people were) and "is" with singular ones (he is, everyone is).',
    pattern: /\b(people|they|we|you|children|my friends|my parents) (is|was)\b|\b(he|she|it|everyone|everybody) are\b/gi,
    replace: (match) => {
      const parts = match.split(" ");
      const verb = parts.pop()!.toLowerCase();
      const subject = parts.join(" ");
      if (/^(he|she|it|everyone|everybody)$/i.test(subject)) return `${subject} is`;
      return `${subject} ${verb === "was" ? "were" : "are"}`;
    },
  },
  {
    id: "there-is-plural",
    category: "agreement",
    explanation: 'Use "there are" before plural nouns ("there are a lot of restaurants").',
    pattern: /\bthere is (a lot of|lots of|many|several|some|so many|too many) (\w+s)\b/gi,
    replace: (match, [quantity, noun]) => {
      if (/(?:ss|us|is)$/i.test(noun)) return null;
      return `${match.slice(0, 5)} are ${quantity} ${noun}`;
    },
  },
  {
    id: "double-comparative",
    category: "word-form",
    explanation: 'Don\'t use "more" with a comparative that already ends in -er ("better", not "more better").',
    pattern: /\bmore (better|worse|easier|bigger|cheaper|faster|harder|smaller|happier|older|younger|longer|shorter|higher|lower)\b/gi,
    replace: (_m, [adj]) => adj,
  },
  {
    id: "if-will",
    category: "tense",
    explanation: 'After "if" or "when" talking about the future, use the present simple: "If I have time, I will…".',
    pattern: /\b(if|when) (I|you|we|they|he|she|it) will (\w+)\b/gi,
    replace: (_m, [conj, subject, verb]) => {
      const v = /^(he|she|it)$/i.test(subject) ? thirdPerson(verb) : verb;
      return `${conj} ${subject} ${v}`;
    },
  },
  {
    id: "modal-to",
    category: "sentence-structure",
    explanation: 'Modal verbs (can, must, should) are followed directly by the base verb, without "to".',
    pattern: /\b(can|must|should|could|might|will|would) to (\w+)\b/gi,
    replace: (_m, [modal, verb]) => `${modal} ${verb}`,
  },
  {
    id: "suggest-to",
    category: "sentence-structure",
    explanation: '"Suggest" is followed by a verb ending in -ing ("I suggest moving…") or by "that" + a clause.',
    pattern: /\b(suggest|suggested|recommend|recommended) to (\w+)\b/gi,
    replace: (_m, [verb, next]) => `${verb} ${gerund(next)}`,
  },
  {
    id: "very-like",
    category: "word-choice",
    explanation: '"Very" cannot go before a verb. Use "really" ("I really like…") or "very much" after the object.',
    pattern: /\b(I|we|they|you|he|she) very (like|likes|love|loves|enjoy|enjoys|want|wants)\b/gi,
    replace: (_m, [subject, verb]) => `${subject} really ${verb}`,
  },
  {
    id: "discuss-about",
    category: "prepositions",
    explanation: '"Discuss" does not need "about": you discuss something.',
    pattern: /\b(discuss|discussed|discussing|discusses) about\b/gi,
    replace: (_m, [verb]) => verb,
  },
  {
    id: "explain-me",
    category: "prepositions",
    explanation: 'Say "explain something to someone" or "explain to me".',
    pattern: /\b(explain|explained|explaining|explains) (me|him|her|us|them)\b/gi,
    replace: (_m, [verb, obj]) => `${verb} to ${obj}`,
  },
  {
    id: "say-me",
    category: "word-choice",
    explanation: 'Use "tell" when you mention the listener: "tell me", not "say me".',
    pattern: /\b(say|said|says) (me|him|her|us|them)\b/gi,
    replace: (_m, [verb, obj]) => `${{ say: "tell", said: "told", says: "tells" }[lower(verb)]} ${obj}`,
  },
  {
    id: "listen-music",
    category: "prepositions",
    explanation: '"Listen" needs "to" before its object: "listen to music".',
    pattern: /\b(listen|listened|listening|listens) (music|the radio|podcasts?|songs?|him|her|me|them|my)\b/gi,
    replace: (_m, [verb, obj]) => `${verb} to ${obj}`,
  },
  {
    id: "fixed-prepositions",
    category: "prepositions",
    explanation: "Some words always take a particular preposition: married to, depend on, interested in, afraid of.",
    pattern: /\b(married with|depends? of|depending of|interested (?:about|for|of)|afraid (?:from|about))\b/gi,
    replace: (match) => {
      const [word] = match.split(" ");
      const w = lower(word);
      const correct = w === "married" ? "to" : w.startsWith("depend") ? "on" : w === "interested" ? "in" : "of";
      return `${word} ${correct}`;
    },
  },
  {
    id: "go-to-home",
    category: "prepositions",
    explanation: 'Say "go home" without "to".',
    pattern: /\b(go|went|going|goes|come|came|coming|get|got) to home\b/gi,
    replace: (_m, [verb]) => `${verb} home`,
  },
  {
    id: "make-do-collocation",
    category: "word-choice",
    explanation: 'English says "take a photo" and "make a mistake".',
    pattern: /\b(make|made|making|makes) (a photo|photos|pictures|a picture)\b|\b(do|did|doing|does) (a mistake|mistakes)\b/gi,
    replace: (match) => {
      const map: Record<string, string> = { make: "take", made: "took", making: "taking", makes: "takes", do: "make", did: "made", doing: "making", does: "makes" };
      const [verb, ...rest] = match.split(" ");
      return `${map[lower(verb)] ?? verb} ${rest.join(" ")}`;
    },
  },
  {
    id: "uncountable-plural",
    category: "word-form",
    explanation: "Some nouns are uncountable in English and have no plural form (information, advice, homework, furniture, equipment).",
    pattern: /\b(informations|advices|homeworks|furnitures|equipments|knowledges|luggages|researches|feedbacks)\b/gi,
    replace: (match) => match.slice(0, /researches$/i.test(match) ? -2 : -1),
  },
  {
    id: "a-an",
    category: "articles",
    explanation: 'Use "an" before a vowel sound (an apple, an idea) and "a" before a consonant sound (a book, a university).',
    pattern: /\b(a|an) ([a-z]+)\b/gi,
    replace: (match, [article, word]) => {
      const w = lower(word);
      const isA = lower(article) === "a";
      const vowelSound = /^[aeio]/.test(w) && !/^(one|once|euro|eu)/.test(w);
      const consonantSound = /^[bcdfgjklmnpqrstvwxyz]/.test(w) && !/^h/.test(w);
      if (isA && vowelSound) return `${article === "A" ? "An" : "an"} ${word}`;
      if (!isA && consonantSound) return `${article === "An" ? "A" : "a"} ${word}`;
      return null;
    },
  },
  {
    id: "missing-the-place",
    category: "articles",
    explanation: 'Use "the" with familiar places in a town, like "the market", "the cinema", or "the station".',
    pattern: /\b(to|at|from) (market|cinema|beach|airport|station|supermarket|gym|park|mall|library|theater|theatre|zoo|museum)\b/gi,
    replace: (_m, [prep, place]) => `${prep} the ${place}`,
  },
  {
    id: "intro-comma",
    category: "punctuation",
    minor: true,
    explanation: "A comma after an introductory word or phrase makes the sentence easier to read.",
    pattern:
      /^(Yesterday|Last (?:week|night|year|month|weekend|summer)|In my opinion|However|Actually|Then|First|Finally|After that|For example|Of course|In the evening|In the morning|In the afternoon|In the end|Two years ago|Today|Sometimes|Personally)(?= (?:I|we|they|he|she|it|my|the|you|there)\b)/,
    replace: (match) => `${match},`,
  },
  {
    id: "capitalize-days",
    category: "punctuation",
    minor: true,
    explanation: "Days of the week and months start with a capital letter.",
    pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|april|june|july|august|september|october|november|december)\b/g,
    replace: (match) => match[0].toUpperCase() + match.slice(1),
  },
];

function matchCase(original: string, replacement: string) {
  if (original[0] && original[0] === original[0].toUpperCase() && /[a-z]/i.test(original[0])) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** Applies every rule to a sentence and returns the corrected sentence plus the issues found. */
export function applyRules(sentence: string, ctx: RuleContext): { corrected: string; issues: LanguageIssue[] } {
  let text = sentence;
  const issues: LanguageIssue[] = [];
  for (const rule of RULES) {
    if (rule.when && !rule.when(text, ctx)) continue;
    rule.pattern.lastIndex = 0;
    text = text.replace(rule.pattern, (...args) => {
      const match = args[0] as string;
      // Capture groups sit between the match and the offset argument.
      const offsetIndex = args.findIndex((a, i) => i > 0 && typeof a === "number");
      const groups = (args.slice(1, offsetIndex) as (string | undefined)[]).filter((g): g is string => g !== undefined);
      const replacement = rule.replace(match, groups);
      if (!replacement || replacement === match) return match;
      const fixed = matchCase(match, replacement);
      issues.push({
        original: match,
        corrected: fixed,
        explanation: rule.explanation,
        category: rule.category,
        ruleId: rule.id,
        minor: rule.minor,
      });
      return fixed;
    });
  }
  return { corrected: text, issues };
}
