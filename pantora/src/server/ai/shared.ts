import { z } from "zod/v4";
import { computeMetrics, splitSentences, type ScoreContext } from "@/lib/analysis/demo-analyzer";
import type { AnalysisResult, IssueCategory, ScoreCard, ScoreDimension, SpeechMetrics } from "@/lib/types";

// Prompt, output schema, and result mapping shared by every Claude-backed
// analyzer (the server SDK provider and the hosted demo's in-page provider).

export const CATEGORIES = [
  "tense",
  "agreement",
  "articles",
  "prepositions",
  "word-choice",
  "word-form",
  "sentence-structure",
  "punctuation",
] as const;

const dimension = z.object({
  score: z.number(),
  explanation: z.string(),
  went_well: z.string(),
  improve: z.array(z.string()),
});

export const OutputSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  improved_version: z.string(),
  issues: z.array(
    z.object({
      original: z.string(),
      corrected: z.string(),
      explanation: z.string(),
      category: z.enum(CATEGORIES),
    }),
  ),
  sentences: z.array(
    z.object({
      original: z.string(),
      corrected: z.string(),
      changed: z.boolean(),
      explanation: z.string(),
      category: z.enum(CATEGORIES).nullable(),
      alternative: z.string().nullable(),
    }),
  ),
  vocabulary: z.array(z.object({ phrase: z.string(), alternatives: z.array(z.string()), note: z.string() })),
  fluency_notes: z.array(z.string()),
  exercise: z.object({ title: z.string(), instructions: z.string() }),
  scores: z
    .object({
      fluency: dimension,
      grammar: dimension,
      vocabulary: dimension,
      relevance: dimension,
      development: dimension,
    })
    .nullable(),
});

export type Output = z.infer<typeof OutputSchema>;

export const SYSTEM_PROMPT = `You are the speaking coach inside Pantora, an app where adults practice spoken English.
Analyze only the learner response you are given. Be accurate, specific, and encouraging; never mock the learner.

Rules:
- Correct real grammar, word-choice, and phrasing problems. Keep the learner's meaning and voice; don't rewrite into a different answer.
- "improved_version" is the full response rewritten in natural, correct English at a similar level of formality.
- "sentences" lists every sentence of the original in order, with its corrected form. Set "changed" to false when no fix is needed. "alternative" is an optional more natural or more advanced way to say it.
- "issues" lists each individual fix with a short, learner-friendly explanation (one or two sentences).
- If the input is a speech transcript, ignore capitalization and punctuation: they come from the transcription, not the speaker.
- You only see text. Never claim to have heard pronunciation, accent, intonation, or speaking speed.
- "fluency_notes": only fill this when speech timing data is provided; otherwise return an empty array.
- Never refer to or speculate about the learner's nationality, accent, first language, or identity.
- "exercise" is one short practice task targeting the most important pattern.
- When a scoring rubric is requested, score each dimension as an integer from 0 to its maximum, explain the score in one sentence, name one thing that went well, and give one or two concrete improvements. Score the language, not the opinion expressed. When scores are not requested, return null for "scores".`;

const MAXES = { fluency: 25, grammar: 25, vocabulary: 20, relevance: 20, development: 10 } as const;
const LABELS: Record<keyof typeof MAXES, string> = {
  fluency: "Fluency and continuity",
  grammar: "Grammar and sentence construction",
  vocabulary: "Vocabulary and expression",
  relevance: "Relevance and clarity",
  development: "Response development",
};

export class ProviderError extends Error {}

export interface ClaudeAnalyzeInput {
  text: string;
  prompt?: string | null;
  inputMode: "typed" | "spoken";
  speech?: SpeechMetrics | null;
  score?: ScoreContext | null;
}

export function buildUserMessage(input: ClaudeAnalyzeInput): string {
  const lines = [
    input.prompt ? `Practice prompt: ${input.prompt}` : null,
    `Input type: ${input.inputMode === "spoken" ? "speech transcript" : "typed response"}`,
    input.speech
      ? `Speech timing data: ${input.speech.durationSeconds} seconds, about ${input.speech.wordsPerMinute} words per minute (${input.speech.source}).`
      : "Speech timing data: none.",
    input.score
      ? `Scoring rubric requested (target speaking time ${input.score.targetSeconds} seconds): fluency and continuity (max 25), grammar and sentence construction (max 25), vocabulary and expression (max 20), relevance and clarity (max 20), response development (max 10). Judge fluency from continuity and linking in the text${input.speech ? " and the timing data" : ""}.`
      : "Scoring rubric requested: no.",
    "",
    "Learner response:",
    "<response>",
    input.text,
    "</response>",
  ].filter((l) => l !== null);
  return lines.join("\n");
}

export function toResult(
  out: Output,
  input: { text: string; inputMode: "typed" | "spoken"; speech?: SpeechMetrics | null; score?: ScoreContext | null },
  modelLabel: string,
): { analysis: AnalysisResult; score: ScoreCard | null } {
  const original = input.text.trim();
  const metrics = computeMetrics(original, splitSentences(original));
  const limitations = [`Feedback generated by ${modelLabel}. AI feedback can be wrong; use it as guidance, not a verdict.`];
  limitations.push(
    input.speech
      ? "Pronunciation and accent are not assessed: the AI only receives the transcript and timing data."
      : input.inputMode === "spoken"
        ? "Fluency was not measured: no recording duration was available for this transcript."
        : "This answer was typed, so pronunciation, accent, and speaking speed were not measured.",
  );
  const analysis: AnalysisResult = {
    analyzer: "anthropic",
    model: modelLabel,
    original,
    improved: out.improved_version.trim() || original,
    summary: out.summary,
    strengths: out.strengths.slice(0, 4),
    issues: out.issues.map((i) => ({ ...i, category: i.category as IssueCategory })),
    sentences: out.sentences.map((s) => ({ ...s, category: s.category as IssueCategory | null })),
    vocabulary: out.vocabulary.slice(0, 5),
    metrics,
    speech: input.speech ?? null,
    fluencyNotes: input.speech && out.fluency_notes.length ? out.fluency_notes : null,
    exercise: out.exercise,
    limitations,
  };
  let score: ScoreCard | null = null;
  if (input.score) {
    if (!out.scores) throw new ProviderError("The AI response did not include the requested scores.");
    const dims: ScoreDimension[] = (Object.keys(MAXES) as (keyof typeof MAXES)[]).map((key) => {
      const d = out.scores![key];
      return {
        key,
        label: LABELS[key],
        max: MAXES[key],
        score: Math.max(0, Math.min(MAXES[key], Math.round(d.score))),
        explanation: d.explanation,
        wentWell: d.went_well,
        improve: d.improve.slice(0, 2),
      };
    });
    score = {
      analyzer: "anthropic",
      total: dims.reduce((s, d) => s + d.score, 0),
      dimensions: dims,
      pronunciation: {
        measured: false,
        note: "Pronunciation is not scored: the AI receives text only, and accent is never part of the score.",
      },
      basis: "text",
    };
  }
  return { analysis, score };
}
