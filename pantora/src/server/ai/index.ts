import "server-only";
import { config } from "../config";
import { analyzeText, scoreAnalysis, type ScoreContext } from "@/lib/analysis/demo-analyzer";
import type { AnalysisResult, ScoreCard, SpeechMetrics } from "@/lib/types";
import { ProviderError, analyzeWithClaude } from "./anthropic";

export interface AnalyzeRequest {
  text: string;
  prompt?: string | null;
  inputMode: "typed" | "spoken";
  speech?: SpeechMetrics | null;
  score?: ScoreContext | null;
}

export interface AnalyzeOutcome {
  analysis: AnalysisResult;
  score: ScoreCard | null;
  /** Set when the configured provider failed and the demo analyzer was used instead. */
  providerNotice: string | null;
}

export function aiProviderName() {
  return config.ai.anthropicKey ? "anthropic" : "demo-rules";
}

function runDemo(req: AnalyzeRequest): { analysis: AnalysisResult; score: ScoreCard | null } {
  const analysis = analyzeText(req.text, { inputMode: req.inputMode, speech: req.speech ?? null });
  return { analysis, score: req.score ? scoreAnalysis(analysis, req.score) : null };
}

/**
 * Analyzes a learner response with the configured provider. If the provider is
 * unavailable, falls back to the demo analyzer and says so — it never presents
 * demo output as AI output.
 */
export async function analyzeResponse(req: AnalyzeRequest): Promise<AnalyzeOutcome> {
  if (!config.ai.anthropicKey) return { ...runDemo(req), providerNotice: null };
  try {
    const result = await analyzeWithClaude(req);
    return { ...result, providerNotice: null };
  } catch (error) {
    const reason = error instanceof ProviderError ? error.message : "The AI provider is unavailable.";
    console.warn("[pantora] AI analysis failed, using demo analyzer:", reason);
    return { ...runDemo(req), providerNotice: `${reason} Showing results from the demo analyzer instead.` };
  }
}
