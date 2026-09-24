// Claude via the Anthropic API (server mode). Structured JSON output is validated with Zod.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { AiStatus } from "../../core/types";
import {
  DraftSchema,
  RegressionChecksSchema,
  ReleaseRiskSchema,
  SummarySchema,
  buildDraftPrompt,
  buildRegressionPrompt,
  buildReleaseRiskPrompt,
  buildSummaryPrompt,
  normalizeChecks,
  normalizeDraft,
  normalizeRisk,
  normalizeSummary,
  type Prompt,
} from "./prompts";
import {
  AiProviderError,
  type AiProvider,
  type AiResult,
  type BugDigest,
  type DraftModelOutput,
  type DraftRequest,
  type RegressionChecksOutput,
  type ReleaseRiskOutput,
  type ReleaseRiskRequest,
  type SummaryOutput,
} from "./provider";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AnthropicOptions {
  apiKey?: string;
  model: string;
  effort: Effort;
  /** Server-side refusal fallbacks (Claude Opus 5 / Fable family). */
  fallbacks: boolean;
}

const VISION_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_IMAGES = 6;

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic" as const;
  private readonly client: Anthropic;

  constructor(private readonly opts: AnthropicOptions) {
    this.client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
  }

  status(): AiStatus {
    return { available: true, provider: "anthropic", label: `Claude (${this.opts.model})`, model: this.opts.model, vision: true };
  }

  private supportsFallbacks(): boolean {
    return this.opts.fallbacks && /^claude-(opus-5|fable-5)/.test(this.opts.model);
  }

  private async call<S extends z.ZodType>(
    prompt: Prompt,
    schema: S,
    images: { mediaType: string; blob: Blob }[] = [],
  ): Promise<{ parsed: z.infer<S>; model: string; input: number; output: number }> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const img of images) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: await toBase64(img.blob),
        },
      });
    }
    content.push({ type: "text", text: prompt.user });

    try {
      const response = await this.client.beta.messages.parse({
        model: this.opts.model,
        max_tokens: 16000,
        system: prompt.system,
        messages: [{ role: "user", content }],
        output_config: { effort: this.opts.effort, format: betaZodOutputFormat(schema) },
        ...(this.supportsFallbacks() ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      if (response.stop_reason === "refusal") {
        throw new AiProviderError("Claude declined this request. Try rephrasing the description.", "refused");
      }
      if (response.stop_reason === "max_tokens") {
        throw new AiProviderError("The answer was cut short. Try a shorter description.", "invalid_output");
      }
      if (!response.parsed_output) throw new AiProviderError("Claude's answer could not be read.", "invalid_output");
      return {
        parsed: response.parsed_output as z.infer<S>,
        model: response.model,
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      };
    } catch (err) {
      if (err instanceof AiProviderError) throw err;
      if (err instanceof Anthropic.AuthenticationError) throw new AiProviderError("The Anthropic API key was rejected.", "unavailable");
      if (err instanceof Anthropic.PermissionDeniedError) throw new AiProviderError("This API key can't use the configured model.", "unavailable");
      if (err instanceof Anthropic.RateLimitError) throw new AiProviderError("Claude is busy right now. Try again in a minute.", "rate_limited");
      if (err instanceof Anthropic.BadRequestError) throw new AiProviderError(`Claude rejected the request: ${err.message}`, "failed");
      if (err instanceof Anthropic.APIConnectionError) throw new AiProviderError("Couldn't reach the Anthropic API.", "unavailable");
      if (err instanceof Anthropic.APIError) throw new AiProviderError(`Claude returned an error (${err.status}).`, "failed");
      throw err;
    }
  }

  async draftReport(req: DraftRequest): Promise<AiResult<DraftModelOutput>> {
    const images = req.images.filter((i) => VISION_TYPES.has(i.mediaType)).slice(0, MAX_IMAGES);
    const r = await this.call(buildDraftPrompt({ ...req, images }, { includeShape: false }), DraftSchema, images);
    return { output: normalizeDraft(r.parsed), meta: { model: r.model, input_tokens: r.input, output_tokens: r.output } };
  }

  async summarize(bug: BugDigest): Promise<AiResult<SummaryOutput>> {
    const r = await this.call(buildSummaryPrompt(bug, false), SummarySchema);
    return { output: normalizeSummary(r.parsed), meta: { model: r.model, input_tokens: r.input, output_tokens: r.output } };
  }

  async regressionChecks(bug: BugDigest): Promise<AiResult<RegressionChecksOutput>> {
    const r = await this.call(buildRegressionPrompt(bug, false), RegressionChecksSchema);
    return { output: normalizeChecks(r.parsed), meta: { model: r.model, input_tokens: r.input, output_tokens: r.output } };
  }

  async releaseRisk(req: ReleaseRiskRequest): Promise<AiResult<ReleaseRiskOutput>> {
    const r = await this.call(buildReleaseRiskPrompt(req, false), ReleaseRiskSchema);
    return { output: normalizeRisk(r.parsed), meta: { model: r.model, input_tokens: r.input, output_tokens: r.output } };
  }
}
