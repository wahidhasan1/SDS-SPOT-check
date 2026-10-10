#!/usr/bin/env node
// Builds the question bank from the authored content and writes an
// idempotent SQL migration (upserts with deterministic UUIDs).
//
//   node scripts/generate-content.mjs            # writes the migration
//   node scripts/generate-content.mjs --preview  # also prints every question
//
// Question types generated per vocabulary entry:
//   meaning     — pick the definition (distractors: definitions of unrelated
//                 words with the same part of speech and a similar level)
//   synonym     — pick the closest word
//   antonym     — pick the opposite (one distractor is a synonym: a classic trap)
//   fill_blank  — complete the example sentence; distractors are wrong word
//                 forms or words of a different part of speech, so exactly one
//                 option is grammatical
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contextQuestions, grammarQuestions, relatedClusters } from '../content/questions.mjs';
import { topics } from '../content/topics.mjs';
import { vocabulary } from '../content/vocabulary.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const levelNum = (l) => LEVELS.indexOf(l) + 1;
const preview = process.argv.includes('--preview');

// ---------------------------------------------------------------- utilities
function uuid(name) {
  const h = createHash('sha1').update(`vocabattle:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function rng(seed) {
  let a = parseInt(createHash('md5').update(seed).digest('hex').slice(0, 8), 16);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, seed) {
  const r = rng(seed); const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const lc = (s) => s.toLowerCase();
const posGroup = (pos) => pos;  // adjective | noun | verb | adverb | phrasal verb | idiom
const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(q).join(',')}]::text[]`;
const jsonb = (v) => `${q(JSON.stringify(v))}::jsonb`;

const errors = [];
const fail = (msg) => errors.push(msg);

// ---------------------------------------------------------------- validation
const topicIds = new Set(topics.map((t) => t.id));
const seen = new Set();
for (const v of vocabulary) {
  const key = `${lc(v.word)}|${v.pos}`;
  if (seen.has(key)) fail(`duplicate entry ${key}`);
  seen.add(key);
  if (!LEVELS.includes(v.level)) fail(`${v.word}: bad level`);
  if (!topicIds.has(v.topic)) fail(`${v.word}: unknown topic ${v.topic}`);
  if (!new RegExp(`\\b${v.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(v.example)) fail(`${v.word}: example does not contain headword`);
  for (const s of [...v.synonyms, ...v.antonyms]) if (lc(s) === lc(v.word)) fail(`${v.word}: lists itself`);
}

// related[word] = set of words that must not be used as each other's distractor
const related = new Map();
const relate = (a, b) => { if (!related.has(a)) related.set(a, new Set()); related.get(a).add(b); };
for (const cluster of relatedClusters) for (const a of cluster) for (const b of cluster) if (a !== b) relate(lc(a), lc(b));
for (const v of vocabulary) {
  for (const s of [...v.synonyms, ...v.antonyms]) { relate(lc(v.word), lc(s)); relate(lc(s), lc(v.word)); }
}
const isRelated = (a, b) => lc(a) === lc(b) || related.get(lc(a))?.has(lc(b)) || false;
// Two entries clash when they are related or share a synonym/antonym.
function entriesClash(a, b) {
  if (isRelated(a.word, b.word)) return true;
  const aw = new Set([a.word, ...a.synonyms, ...a.antonyms].map(lc));
  return [b.word, ...b.synonyms, ...b.antonyms].map(lc).some((w) => aw.has(w));
}

function pickDistractors(candidates, count, seed, accept = () => true) {
  const out = []; const used = new Set();
  for (const c of shuffle(candidates, seed)) {
    const key = lc(typeof c === 'string' ? c : c.text);
    if (used.has(key) || !accept(c)) continue;
    used.add(key); out.push(c);
    if (out.length === count) break;
  }
  return out;
}

// Candidates ordered by level distance (closest first), shuffled within a distance.
function byLevelDistance(items, level, seed) {
  const groups = new Map();
  for (const it of items) {
    const d = Math.abs(levelNum(it.level) - levelNum(level));
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(it);
  }
  return [...groups.keys()].sort((a, b) => a - b).flatMap((d) => shuffle(groups.get(d), `${seed}:${d}`));
}

// The correct option's position rotates per question type, so every position
// (A–D) is correct equally often and "always pick A" cannot beat chance.
const positionCounter = {};
function build(type, entryOrKey, { prompt, sentence = null, correct, distractors, explanation, difficulty, topic, entry = null, skill = 'vocabulary', grammarTopic = null, inAssessment = true }) {
  const options = shuffle(distractors, `opts:${type}:${entryOrKey}`);
  positionCounter[type] = (positionCounter[type] ?? 0) + 1;
  options.splice(positionCounter[type] % (distractors.length + 1), 0, correct);
  return {
    id: uuid(`q:${type}:${entryOrKey}`), type, skill, prompt, sentence, options,
    correct_index: options.indexOf(correct), explanation, difficulty, topic_id: topic,
    grammar_topic: grammarTopic, entry_id: entry ? uuid(`entry:${lc(entry.word)}:${entry.pos}`) : null,
    use_in_assessment: inAssessment,
  };
}

// ---------------------------------------------------------------- generation
const questions = [];
const label = (v) => (v.pos === 'idiom' ? 'the expression' : v.pos === 'phrasal verb' ? 'the phrasal verb' : 'the word');

for (const v of vocabulary) {
  const sameGroup = vocabulary.filter((o) => o !== v && posGroup(o.pos) === posGroup(v.pos) && !entriesClash(v, o));
  const ordered = byLevelDistance(sameGroup, v.level, `lvl:${v.word}`);
  const diff = levelNum(v.level);

  // meaning
  const defs = []; const chosen = [];
  for (const o of ordered) {
    if (defs.length === 3) break;
    if (chosen.some((c) => entriesClash(c, o))) continue;  // no two near-identical distractors
    if (!defs.includes(o.definition) && o.definition !== v.definition) { defs.push(o.definition); chosen.push(o); }
  }
  if (defs.length === 3) {
    questions.push(build('meaning', `${v.word}:${v.pos}`, {
      prompt: `What does ${label(v)} "${v.word}" mean?`, correct: v.definition, distractors: defs,
      explanation: `"${v.word}" (${v.pos}) means ${v.definition}. Example: ${v.example}`,
      difficulty: diff, topic: v.topic, entry: v,
    }));
  } else fail(`${v.word}: not enough meaning distractors`);

  // word pool for synonym/antonym distractors (same part of speech)
  const banned = new Set([v.word, ...v.synonyms, ...v.antonyms].map(lc));
  let pool = ordered.flatMap((o) => [o.word, ...o.synonyms]);
  if (v.pos === 'adverb') {
    pool = [...pool, ...shuffle(vocabulary.filter((o) => o !== v && !entriesClash(v, o)).flatMap((o) => o.forms.filter((f) => /ly$/.test(f))), `adv:${v.word}`)];
  }
  const okWord = (w) => !banned.has(lc(w)) && !isRelated(v.word, w);

  if (v.synonyms.length) {
    const correct = v.synonyms[0];
    const ds = pickDistractors(pool.slice(0, 40), 3, `syn:${v.word}`, okWord);
    if (ds.length === 3) {
      questions.push(build('synonym', `${v.word}:${v.pos}`, {
        prompt: `Choose the option closest in meaning to "${v.word}".`, correct, distractors: ds,
        explanation: `"${v.word}" means ${v.definition}, so "${correct}" is the closest synonym.`,
        difficulty: diff, topic: v.topic, entry: v,
      }));
    } else fail(`${v.word}: not enough synonym distractors`);
  }

  if (v.antonyms.length) {
    const correct = v.antonyms[0];
    const trap = v.synonyms.length ? [v.synonyms[v.synonyms.length > 1 ? 1 : 0]] : [];
    const others = pickDistractors(pool.slice(0, 40), 3 - trap.length, `ant:${v.word}`, okWord);
    if (trap.length + others.length === 3) {
      questions.push(build('antonym', `${v.word}:${v.pos}`, {
        prompt: `Choose the option most nearly opposite in meaning to "${v.word}".`, correct, distractors: [...trap, ...others],
        explanation: `"${v.word}" means ${v.definition}; its opposite is "${correct}".${trap.length ? ` ("${trap[0]}" is a synonym, not an antonym.)` : ''}`,
        difficulty: diff, topic: v.topic, entry: v,
      }));
    } else fail(`${v.word}: not enough antonym distractors`);
  }

  // fill in the blank
  const multiword = v.pos === 'phrasal verb' || v.pos === 'idiom';
  if (v.forms.length || multiword) {
    const re = new RegExp(`\\b${v.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const sentence = v.example.replace(re, '____');
    const forms = v.forms.slice(0, 3);
    let fillers = [];
    const need = 3 - forms.length;
    if (need > 0) {
      // Single words: use a different part of speech (cannot fit grammatically).
      // Phrasal verbs/idioms: use other expressions of the same kind (meaning test).
      const wrongPos = { adjective: 'verb', noun: 'adjective', verb: 'adjective', adverb: 'verb' };
      const src = multiword
        ? ordered.map((o) => o.word)
        : byLevelDistance(vocabulary.filter((o) => o.pos === wrongPos[v.pos] && !entriesClash(v, o)), v.level, `fill:${v.word}`).map((o) => o.word);
      fillers = pickDistractors(src, need, `fill:${v.word}`, okWord);
    }
    if (forms.length + fillers.length === 3) {
      questions.push(build('fill_blank', `${v.word}:${v.pos}`, {
        prompt: 'Choose the option that best completes the sentence.', sentence, correct: v.word,
        distractors: [...forms, ...fillers],
        explanation: multiword
          ? `"${v.word}" means ${v.definition}.${v.pos === 'idiom' ? ' Idioms are fixed expressions, so the exact wording matters.' : ''}`
          : forms.length
          ? `The sentence needs the ${v.pos} "${v.word}" (${v.definition}). ${forms.map((f) => `"${f}"`).join(', ')} ${forms.length > 1 ? 'are' : 'is'} a different word form.`
          : `"${v.word}" means ${v.definition}.`,
        difficulty: diff, topic: v.topic, entry: v,
      }));
    } else fail(`${v.word}: not enough fill-in distractors`);
  }
}

for (const c of contextQuestions) {
  if (!LEVELS.includes(c.level) || c.options.length !== 4 || !c.sentence.toLowerCase().includes(c.word)) fail(`context ${c.word}: invalid`);
  const entry = vocabulary.find((v) => lc(v.word) === lc(c.word)) || null;
  questions.push(build('context', `${c.word}:${c.sentence}`, {
    prompt: `What does "${c.word}" mean in this sentence?`, sentence: c.sentence, correct: c.options[0],
    distractors: c.options.slice(1), explanation: c.explanation, difficulty: levelNum(c.level), topic: c.topic, entry,
  }));
}

for (const gq of grammarQuestions) {
  if (!gq.sentence.includes('____') || gq.options.length !== 4) fail(`grammar "${gq.sentence}": invalid`);
  questions.push(build('grammar', gq.sentence, {
    prompt: 'Choose the correct option to complete the sentence.', sentence: gq.sentence, correct: gq.options[0],
    distractors: gq.options.slice(1), explanation: gq.explanation, difficulty: levelNum(gq.level), topic: null,
    skill: 'grammar', grammarTopic: gq.topic, inAssessment: false,
  }));
}

for (const qq of questions) {
  if (new Set(qq.options.map(lc)).size !== qq.options.length) fail(`duplicate options in ${qq.type} ${qq.prompt} ${qq.sentence ?? ''}`);
  if (qq.correct_index < 0) fail(`missing correct option in ${qq.prompt}`);
}

if (errors.length) {
  console.error(`Content validation failed:\n - ${errors.join('\n - ')}`);
  process.exit(1);
}

// ---------------------------------------------------------------- output
const lines = [];
lines.push('-- =============================================================================');
lines.push('-- Vocabattle — 0006 content (GENERATED by scripts/generate-content.mjs — do not edit)');
lines.push('-- Original content. Idempotent upserts keyed by deterministic UUIDs, so');
lines.push('-- re-running after a content change updates rows in place.');
lines.push('-- =============================================================================');
lines.push('');
lines.push('insert into public.vocab_topics (id, name, description, icon, sort_order) values');
lines.push(topics.map((t, i) => `  (${q(t.id)}, ${q(t.name)}, ${q(t.description)}, ${q(t.icon)}, ${i + 1})`).join(',\n'));
lines.push('on conflict (id) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;');
lines.push('');
lines.push('insert into public.vocabulary_entries (id, word, phonetic, part_of_speech, definition, example, synonyms, antonyms, level, topic_id, ielts_note) values');
lines.push(vocabulary.map((v) => `  (${q(uuid(`entry:${lc(v.word)}:${v.pos}`))}, ${q(v.word)}, ${q(v.phonetic)}, ${q(v.pos)}, ${q(v.definition)}, ${q(v.example)}, ${arr(v.synonyms)}, ${arr(v.antonyms)}, ${q(v.level)}, ${q(v.topic)}, ${q(v.note)})`).join(',\n'));
lines.push('on conflict (id) do update set word = excluded.word, phonetic = excluded.phonetic, part_of_speech = excluded.part_of_speech, definition = excluded.definition, example = excluded.example, synonyms = excluded.synonyms, antonyms = excluded.antonyms, level = excluded.level, topic_id = excluded.topic_id, ielts_note = excluded.ielts_note;');
lines.push('');
lines.push('insert into public.questions (id, type, skill, prompt, sentence, options, correct_index, explanation, difficulty, topic_id, grammar_topic, entry_id, use_in_assessment) values');
lines.push(questions.map((x) => `  (${q(x.id)}, ${q(x.type)}, ${q(x.skill)}, ${q(x.prompt)}, ${q(x.sentence)}, ${jsonb(x.options)}, ${x.correct_index}, ${q(x.explanation)}, ${x.difficulty}, ${q(x.topic_id)}, ${q(x.grammar_topic)}, ${q(x.entry_id)}, ${x.use_in_assessment})`).join(',\n'));
lines.push('on conflict (id) do update set type = excluded.type, skill = excluded.skill, prompt = excluded.prompt, sentence = excluded.sentence, options = excluded.options, correct_index = excluded.correct_index, explanation = excluded.explanation, difficulty = excluded.difficulty, topic_id = excluded.topic_id, grammar_topic = excluded.grammar_topic, entry_id = excluded.entry_id, use_in_assessment = excluded.use_in_assessment;');
lines.push('');

const out = join(root, 'supabase/migrations/20261010000006_content.sql');
writeFileSync(out, lines.join('\n'));

const summary = {};
for (const x of questions) {
  summary[x.type] ??= { total: 0, byDifficulty: {} };
  summary[x.type].total++;
  summary[x.type].byDifficulty[LEVELS[x.difficulty - 1]] = (summary[x.type].byDifficulty[LEVELS[x.difficulty - 1]] ?? 0) + 1;
}
mkdirSync(join(root, 'content/generated'), { recursive: true });
writeFileSync(join(root, 'content/generated/summary.json'), JSON.stringify({ entries: vocabulary.length, questions: questions.length, byType: summary }, null, 2) + '\n');

if (preview) {
  for (const x of questions) {
    console.log(`[${x.type} ${LEVELS[x.difficulty - 1]}] ${x.prompt}${x.sentence ? `  — ${x.sentence}` : ''}`);
    x.options.forEach((o, i) => console.log(`   ${i === x.correct_index ? '✔' : ' '} ${o}`));
  }
}
console.log(`Wrote ${out}\n${vocabulary.length} entries, ${questions.length} questions`);
console.log(JSON.stringify(summary));
