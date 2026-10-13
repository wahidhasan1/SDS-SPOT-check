import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { config } from '../config';
import { HttpError, notConfigured } from '../lib/errors';

/**
 * AI features use Claude through the official Anthropic SDK. They are only enabled when the server
 * operator sets ANTHROPIC_API_KEY. Without it, callers receive a clear "not configured" error and the
 * UI explains this — no feedback is ever invented.
 */
let client: Anthropic | null = null;

export function aiConfigured() {
  return Boolean(config.anthropicApiKey);
}

function getClient() {
  if (!aiConfigured()) throw notConfigured('AI feedback is not configured on this server. An administrator needs to set ANTHROPIC_API_KEY.');
  client ??= new Anthropic({
    apiKey: config.anthropicApiKey,
    ...(config.anthropicBaseUrl ? { baseURL: config.anthropicBaseUrl } : {}),
    timeout: 120_000,
    maxRetries: 2,
  });
  return client;
}

const SYSTEM_EXAMINER = `You are an experienced IELTS examiner and English teacher. You assess learner work against the public IELTS band descriptors.
Be accurate, specific and encouraging. Quote the learner's own words when pointing out problems. Never inflate scores.
All band scores you give are unofficial practice estimates, in steps of 0.5 between 0 and 9.`;

async function structured<T extends z.ZodType>(schema: T, system: string, prompt: string, effort: 'low' | 'medium' | 'high'): Promise<z.infer<T>> {
  const c = getClient();
  try {
    const response = await c.messages.parse({
      model: config.anthropicModel,
      max_tokens: 16000,
      system,
      output_config: { format: zodOutputFormat(schema), effort },
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'refusal') throw new HttpError(422, 'ai_refused', 'The AI service declined to evaluate this text.');
    if (!response.parsed_output) throw new HttpError(502, 'ai_bad_output', 'The AI service returned an unexpected response. Please try again.');
    return response.parsed_output;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new HttpError(503, 'ai_auth', 'The AI service rejected the server’s API key. An administrator needs to check ANTHROPIC_API_KEY.');
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(503, 'ai_rate_limited', 'The AI service is busy right now. Please try again in a minute.');
    if (err instanceof Anthropic.APIError) throw new HttpError(502, 'ai_error', `The AI service returned an error (${err.status ?? 'network'}). Please try again.`);
    throw new HttpError(502, 'ai_error', 'Could not reach the AI service. Please try again.');
  }
}

// ---------------------------------------------------------------- writing

const band = z.number().min(0).max(9);

export const writingFeedbackSchema = z.object({
  criteria: z.array(
    z.object({
      id: z.enum(['task', 'coherence', 'lexical', 'grammar']),
      band,
      comment: z.string(),
      suggestions: z.array(z.string()),
    }),
  ),
  overallBand: band,
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  corrections: z.array(z.object({ original: z.string(), corrected: z.string(), explanation: z.string() })),
  improvedVersion: z.string().nullable(),
});
export type WritingFeedback = z.infer<typeof writingFeedbackSchema>;

export async function evaluateWriting(input: {
  variant: string;
  taskNumber: number;
  taskType: string;
  prompt: string;
  visualDescription: string | null;
  text: string;
  wordCount: number;
  minWords: number;
  detailed: boolean;
}): Promise<WritingFeedback> {
  const prompt = `Evaluate this IELTS ${input.variant === 'general' ? 'General Training' : 'Academic'} Writing Task ${input.taskNumber} response (${input.taskType}).

<task>
${input.prompt}
${input.visualDescription ? `\nData shown in the visual:\n${input.visualDescription}` : ''}
</task>

<response word_count="${input.wordCount}" minimum="${input.minWords}">
${input.text}
</response>

Assess the four criteria: "task" (Task ${input.taskNumber === 1 ? 'Achievement' : 'Response'}), "coherence" (Coherence and Cohesion), "lexical" (Lexical Resource) and "grammar" (Grammatical Range and Accuracy). Give one entry per criterion with a band, a 2–4 sentence comment and 2–3 concrete suggestions.
overallBand is the mean of the four criteria rounded down to the nearest 0.5. If the response is under the minimum word count, reflect this in the task criterion.
List up to ${input.detailed ? 10 : 4} specific corrections of real errors from the text (original phrase, corrected phrase, short explanation).
${input.detailed ? 'In improvedVersion, rewrite the response as a stronger answer (about band 8) that keeps the learner’s main ideas.' : 'Set improvedVersion to null.'}`;
  return structured(writingFeedbackSchema, SYSTEM_EXAMINER, prompt, input.detailed ? 'high' : 'medium');
}

// ---------------------------------------------------------------- speaking

export const speakingFeedbackSchema = z.object({
  fluency: z.object({ band, comment: z.string() }),
  lexical: z.object({ band, comment: z.string() }),
  grammar: z.object({ band, comment: z.string() }),
  overallBand: band,
  summary: z.string(),
  tips: z.array(z.string()),
  betterPhrases: z.array(z.object({ original: z.string(), better: z.string() })),
});
export type SpeakingFeedback = z.infer<typeof speakingFeedbackSchema>;

export async function evaluateSpeaking(input: { part: number | null; question: string; transcript: string; durationSec: number; wordsPerMinute: number; fillerCount: number }) {
  const prompt = `Evaluate this IELTS Speaking ${input.part ? `Part ${input.part} ` : ''}answer. You only have an automatic speech-to-text transcript, so you CANNOT assess pronunciation — do not comment on pronunciation or accent at all. Transcription errors are possible; do not penalise obvious recognition mistakes.

<question>${input.question}</question>
<transcript duration_seconds="${Math.round(input.durationSec)}" words_per_minute="${Math.round(input.wordsPerMinute)}" filler_words="${input.fillerCount}">
${input.transcript}
</transcript>

Give bands and short comments for fluency and coherence, lexical resource, and grammatical range and accuracy. overallBand is the mean of these three rounded to the nearest 0.5. Provide 3–5 practical tips and up to 5 "betterPhrases" that upgrade phrases the learner actually used.`;
  return structured(speakingFeedbackSchema, SYSTEM_EXAMINER, prompt, 'medium');
}

// ---------------------------------------------------------------- reader explanations

export const wordExplanationSchema = z.object({
  lemma: z.string(),
  partOfSpeech: z.string(),
  meaningInContext: z.string(),
  simpleDefinition: z.string(),
  translation: z.string().nullable(),
  exampleSentence: z.string(),
});
export type WordExplanation = z.infer<typeof wordExplanationSchema>;

export async function explainWord(word: string, sentence: string, language: string | null) {
  const prompt = `A learner of English selected the word "${word}" in this sentence:
<sentence>${sentence}</sentence>

Explain what the word means in THIS sentence, in simple English suitable for an intermediate learner.
Return the dictionary form (lemma), its part of speech here, the meaning in context (1–2 sentences), a short general definition and a new example sentence.
${language && language !== 'Other' ? `Also give a short translation of the word, as used here, into ${language}.` : 'Set translation to null.'}`;
  return structured(wordExplanationSchema, 'You are a patient English teacher who explains vocabulary clearly and accurately.', prompt, 'low');
}
