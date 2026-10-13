import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';
import { config } from '../config';
import { HttpError, notConfigured } from '../lib/errors';

/**
 * Claude-powered feedback. All calls happen server-side; the API key never reaches clients.
 * When ANTHROPIC_API_KEY is not configured, callers fall back to deterministic analysis and
 * the UI clearly labels results as "text metrics only".
 */
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!config.anthropicApiKey) throw notConfigured('AI feedback is not configured on this server (ANTHROPIC_API_KEY).');
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey, baseURL: config.anthropicBaseUrl, maxRetries: 2, timeout: 120_000 });
  return client;
}

export function aiAvailable() {
  return !!config.anthropicApiKey;
}

async function structured<T extends z.ZodType>(schema: T, system: string, user: string, maxTokens = 8000): Promise<z.infer<T>> {
  const c = getClient();
  try {
    const res = await c.beta.messages.parse({
      model: config.anthropicModel,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { format: betaZodOutputFormat(schema), effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    } as any);
    if (res.stop_reason === 'refusal') throw new HttpError(422, 'ai_declined', 'The AI service declined to process this text.');
    if (!res.parsed_output) throw new HttpError(502, 'ai_bad_output', 'The AI service returned an unexpected response. Please try again.');
    return res.parsed_output as z.infer<T>;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(503, 'ai_busy', 'The AI service is busy. Please try again in a minute.');
    if (e instanceof Anthropic.AuthenticationError) throw notConfigured('The AI service credentials are invalid.');
    if (e instanceof Anthropic.APIError) throw new HttpError(502, 'ai_error', 'The AI service is temporarily unavailable. Please try again later.');
    throw new HttpError(502, 'ai_error', 'Could not reach the AI service. Please try again later.');
  }
}

const band = z.number().min(0).max(9).describe('Unofficial band estimate in 0.5 steps');
const issue = z.object({
  excerpt: z.string().describe('Exact short quote from the learner text'),
  issue: z.string().describe('What is wrong, in plain English'),
  correction: z.string().describe('Corrected version of only this excerpt'),
  explanation: z.string().describe('Why — a short rule the learner can reuse'),
  category: z.enum(['grammar', 'spelling', 'vocabulary', 'punctuation', 'coherence', 'task']),
});

export const WritingFeedbackSchema = z.object({
  bandEstimates: z.object({
    overall: band,
    taskAchievementOrResponse: band,
    coherenceCohesion: band,
    lexicalResource: band,
    grammaticalRangeAccuracy: band,
  }),
  summary: z.string(),
  criteria: z.object({
    taskAchievementOrResponse: z.string(),
    coherenceCohesion: z.string(),
    lexicalResource: z.string(),
    grammaticalRangeAccuracy: z.string(),
  }),
  strengths: z.array(z.string()),
  priorities: z.array(z.string()).describe('The 3 most valuable things to improve next, as actions'),
  errors: z.array(issue),
  vocabularyUpgrades: z.array(z.object({ original: z.string(), suggestion: z.string(), why: z.string() })),
  improvedSentenceExamples: z.array(z.object({ original: z.string(), improved: z.string(), whatChanged: z.string() })).describe('At most 3 sentences; never rewrite the whole response'),
});
export type WritingFeedback = z.infer<typeof WritingFeedbackSchema>;

export async function aiWritingFeedback(input: {
  testType: string;
  task: number;
  kind: string;
  prompt: string;
  visualSummary: string | null;
  minWords: number;
  text: string;
  wordCount: number;
}): Promise<WritingFeedback> {
  const system = `You are an experienced IELTS writing teacher giving feedback to a learner.
Assess against the public IELTS Writing band descriptors (Task Achievement for Task 1 / Task Response for Task 2, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy).
Your band estimates are unofficial practice estimates; be honest and calibrated, not generous. Under-length responses must be penalised as the descriptors require.
Teach rather than rewrite: quote the learner's own words in "excerpt", explain each problem briefly, and give at most three improved example sentences. Do not produce a full model answer.
Write feedback in clear, simple English suitable for the learner's level.`;
  const user = `Test: IELTS ${input.testType === 'general' ? 'General Training' : 'Academic'} Writing Task ${input.task} (${input.kind}).
Minimum words: ${input.minWords}. Learner word count: ${input.wordCount}.
Task prompt:
${input.prompt}
${input.visualSummary ? `\nData shown in the task visual:\n${input.visualSummary}\n` : ''}
Learner response:
"""
${input.text}
"""`;
  return structured(WritingFeedbackSchema, system, user, 12000);
}

export const SpeakingFeedbackSchema = z.object({
  bandEstimates: z.object({
    fluencyCoherence: band,
    lexicalResource: band,
    grammaticalRangeAccuracy: band,
  }),
  summary: z.string(),
  strengths: z.array(z.string()),
  priorities: z.array(z.string()),
  errors: z.array(issue),
  betterExpressions: z.array(z.object({ original: z.string(), suggestion: z.string(), why: z.string() })),
  answerDevelopment: z.string().describe('How well the answer addressed the question and how to extend it'),
});
export type SpeakingFeedback = z.infer<typeof SpeakingFeedbackSchema>;

export async function aiSpeakingFeedback(input: { part: number; question: string; transcript: string; durationSec: number; wordsPerMinute: number }) {
  const system = `You are an IELTS speaking teacher. You receive an automatic speech-to-text transcript of a learner's spoken answer.
Assess only what a transcript can show: fluency and coherence (organisation, development, fillers, self-correction visible in text), lexical resource and grammatical range/accuracy.
You CANNOT hear the audio: do not comment on pronunciation, accent, intonation or stress, and do not include a pronunciation score.
Transcription errors are possible; if something looks like a recognition error rather than a learner error, ignore it.
Band estimates are unofficial practice estimates.`;
  const user = `IELTS Speaking Part ${input.part}. Question: ${input.question}
Speaking time: ${Math.round(input.durationSec)} seconds (${input.wordsPerMinute} words per minute).
Transcript:
"""
${input.transcript}
"""`;
  return structured(SpeakingFeedbackSchema, system, user, 8000);
}

export const ContextMeaningSchema = z.object({
  headword: z.string().describe('Dictionary form of the selected word, or the full phrase/idiom if the word is part of one'),
  isPhraseOrIdiom: z.boolean(),
  partOfSpeech: z.string(),
  meaningInContext: z.string().describe('What the word means in THIS sentence, in simple English'),
  generalDefinition: z.string(),
  otherCommonMeanings: z.array(z.string()),
  examples: z.array(z.string()).describe('2 new example sentences using the same meaning'),
  synonymsInContext: z.array(z.string()),
  cefrEstimate: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  translation: z.string().nullable().describe('Translation of the meaning in context into the requested language, or null if none requested'),
  ocrSuspect: z.boolean().describe('True if the selected word looks like an OCR/recognition error'),
});
export type ContextMeaning = z.infer<typeof ContextMeaningSchema>;

export async function aiContextMeaning(word: string, sentence: string, translateTo: string | null) {
  const system = `You are a learner's dictionary. Explain the meaning of a selected word as it is used in the given sentence, for an English learner.
If the word is part of a phrasal verb, idiom or fixed phrase in this sentence, explain the whole phrase.
Keep language simple (B1 level). Text may come from OCR of a photographed page, so minor recognition errors are possible.`;
  const user = `Selected word: "${word}"
Sentence: "${sentence || word}"
${translateTo ? `Also translate the meaning in context into: ${translateTo}` : 'No translation requested (translation must be null).'}`;
  return structured(ContextMeaningSchema, system, user, 3000);
}

export const TranslationSchema = z.object({
  translation: z.string(),
  notes: z.string().nullable().describe('Brief note on ambiguity or idioms, if any'),
});

export async function aiTranslate(text: string, targetLanguage: string, context?: string) {
  const system = 'You are a careful translator helping an English learner. Translate faithfully and naturally. If the English is ambiguous or idiomatic, mention it briefly in notes.';
  const user = `Translate into ${targetLanguage}:\n"""${text}"""${context ? `\nSurrounding context (do not translate): """${context}"""` : ''}`;
  return structured(TranslationSchema, system, user, 3000);
}

export const GeneratedVocabSchema = z.object({
  items: z.array(
    z.object({
      word: z.string(),
      partOfSpeech: z.string(),
      cefr: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
      meaning: z.string(),
      examples: z.array(z.string()),
      synonyms: z.array(z.string()),
      antonyms: z.array(z.string()),
    }),
  ),
});

export async function aiGenerateVocabulary(topic: string, level: string, count: number) {
  const system = 'You write original learner-dictionary entries for an English learning app. Definitions must be accurate, simple and original (do not copy published dictionaries). Examples must be natural and original.';
  const user = `Create ${count} useful vocabulary entries about "${topic}" for learners at CEFR ${level}. Avoid very rare words.`;
  return structured(GeneratedVocabSchema, system, user, 6000);
}
