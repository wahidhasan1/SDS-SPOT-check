// Browser replacement for src/server/ai/anthropic.ts in the hosted demo. It
// asks Claude through the page's `sample` capability (the viewer's own Claude
// account) using the same instructions, schema, and validation as the server
// provider. Any failure falls back to the demo analyzer with a visible notice.
import { CATEGORIES, OutputSchema, ProviderError, SYSTEM_PROMPT, buildUserMessage, toResult, type ClaudeAnalyzeInput } from "@/server/ai/shared";
import type { AnalysisResult, ScoreCard } from "@/lib/types";

export { ProviderError };

interface SampleError {
  code: string;
  message: string;
}

type SampleJson = (input: string, options?: Record<string, unknown>) => Promise<unknown>;

declare global {
  interface Window {
    claude?: { use?: (name: string) => Promise<unknown> };
  }
}

const FORMAT = `Reply with only one JSON object, no other text, with exactly these fields:
{
  "summary": string,
  "strengths": string[],
  "improved_version": string,
  "issues": [{"original": string, "corrected": string, "explanation": string, "category": CATEGORY}],
  "sentences": [{"original": string, "corrected": string, "changed": boolean, "explanation": string, "category": CATEGORY or null, "alternative": string or null}],
  "vocabulary": [{"phrase": string, "alternatives": string[], "note": string}],
  "fluency_notes": string[],
  "exercise": {"title": string, "instructions": string},
  "scores": null or {"fluency": DIM, "grammar": DIM, "vocabulary": DIM, "relevance": DIM, "development": DIM}
}
CATEGORY is one of: ${CATEGORIES.map((c) => `"${c}"`).join(", ")}.
DIM is {"score": integer, "explanation": string, "went_well": string, "improve": string[]}.`;

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : v == null ? fallback : String(v));
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const cat = (v: unknown) => ((CATEGORIES as readonly string[]).includes(String(v)) ? String(v) : null);

/** Coerces a loosely shaped reply into the schema before strict validation. */
function normalize(raw: unknown) {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const dim = (d: unknown) => {
    const x = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
    return { score: Number(x.score) || 0, explanation: str(x.explanation), went_well: str(x.went_well), improve: arr(x.improve).map((i) => str(i)) };
  };
  const scores = o.scores && typeof o.scores === "object" ? (o.scores as Record<string, unknown>) : null;
  const exercise = (o.exercise && typeof o.exercise === "object" ? o.exercise : {}) as Record<string, unknown>;
  return {
    summary: str(o.summary),
    strengths: arr(o.strengths).map((s) => str(s)),
    improved_version: str(o.improved_version),
    issues: arr(o.issues).map((i) => {
      const x = (i ?? {}) as Record<string, unknown>;
      return { original: str(x.original), corrected: str(x.corrected), explanation: str(x.explanation), category: cat(x.category) ?? "sentence-structure" };
    }),
    sentences: arr(o.sentences).map((i) => {
      const x = (i ?? {}) as Record<string, unknown>;
      return {
        original: str(x.original),
        corrected: str(x.corrected, str(x.original)),
        changed: Boolean(x.changed),
        explanation: str(x.explanation),
        category: cat(x.category),
        alternative: x.alternative == null || x.alternative === "" ? null : str(x.alternative),
      };
    }),
    vocabulary: arr(o.vocabulary).map((i) => {
      const x = (i ?? {}) as Record<string, unknown>;
      return { phrase: str(x.phrase), alternatives: arr(x.alternatives).map((a) => str(a)), note: str(x.note) };
    }),
    fluency_notes: arr(o.fluency_notes).map((s) => str(s)),
    exercise: { title: str(exercise.title, "Practice exercise"), instructions: str(exercise.instructions) },
    scores: scores
      ? { fluency: dim(scores.fluency), grammar: dim(scores.grammar), vocabulary: dim(scores.vocabulary), relevance: dim(scores.relevance), development: dim(scores.development) }
      : null,
  };
}

const MESSAGES: Record<string, string> = {
  not_granted: "This page isn't allowed to use Claude.",
  sampling_disabled: "Claude isn't available for this account.",
  rate_limited: "Claude is busy or your usage limit was reached.",
  session_expired: "Your Claude session expired.",
  refused: "Claude declined to analyze this answer.",
  invalid_json: "Claude's reply couldn't be read.",
  cancelled: "The request was cancelled.",
};

export async function analyzeWithClaude(input: ClaudeAnalyzeInput): Promise<{ analysis: AnalysisResult; score: ScoreCard | null }> {
  const sample = (await window.claude?.use?.("sample").catch(() => null)) as (SampleJson & { json: SampleJson }) | null | undefined;
  if (!sample) throw new ProviderError("Claude isn't available in this view.");
  const prompt = `${SYSTEM_PROMPT}\n\n${buildUserMessage(input)}\n\n${FORMAT}`;
  let raw: unknown;
  try {
    raw = await sample.json(prompt, { modelTier: "default", effort: "low", cache: { gcTime: 86_400_000 } });
  } catch (e) {
    const code = (e as SampleError)?.code ?? "upstream_error";
    throw new ProviderError(MESSAGES[code] ?? "Claude couldn't be reached.");
  }
  const parsed = OutputSchema.safeParse(normalize(raw));
  if (!parsed.success) throw new ProviderError("Claude's reply didn't match the expected format.");
  return toResult(parsed.data, input, "Claude, through your Claude account");
}
