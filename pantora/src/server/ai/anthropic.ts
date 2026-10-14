import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { config } from "../config";
import type { AnalysisResult, ScoreCard } from "@/lib/types";
import { OutputSchema, ProviderError, SYSTEM_PROMPT, buildUserMessage, toResult, type ClaudeAnalyzeInput, type Output } from "./shared";

export { ProviderError };

// Claude-backed analysis. Runs only on the server; the API key never reaches
// the browser. Output is constrained with structured outputs and validated
// again here before it is shown to anyone.

let client: Anthropic | null = null;
function getClient() {
  if (!config.ai.anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  client ??= new Anthropic({ apiKey: config.ai.anthropicKey, timeout: config.ai.timeoutMs, maxRetries: 1 });
  return client;
}

export async function analyzeWithClaude(input: ClaudeAnalyzeInput): Promise<{ analysis: AnalysisResult; score: ScoreCard | null }> {

  let output: Output | null;
  try {
    const response = await getClient().beta.messages.parse({
      model: config.ai.model,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(input) }],
      output_config: { effort: config.ai.effort, format: betaZodOutputFormat(OutputSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (response.stop_reason === "refusal") throw new ProviderError("The AI provider declined to analyze this response.");
    if (response.stop_reason === "max_tokens") throw new ProviderError("The AI response was cut off.");
    output = response.parsed_output;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new ProviderError("The AI provider rejected the API key.");
    if (error instanceof Anthropic.RateLimitError) throw new ProviderError("The AI provider is rate limiting requests.");
    if (error instanceof Anthropic.APIConnectionTimeoutError) throw new ProviderError("The AI provider took too long to respond.");
    if (error instanceof Anthropic.APIError) throw new ProviderError(`The AI provider returned an error (${error.status ?? "network"}).`);
    throw new ProviderError("The AI response could not be read.");
  }
  if (!output) throw new ProviderError("The AI response did not match the expected format.");
  const parsed = OutputSchema.safeParse(output);
  if (!parsed.success) throw new ProviderError("The AI response did not match the expected format.");
  return toResult(parsed.data, input, `Claude (${config.ai.model})`);
}

