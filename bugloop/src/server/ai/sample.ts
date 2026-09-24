// Claude through the claude.ai artifact runtime's `sample` capability (published demo).
// The viewer consents on first use and the call runs on their own Claude plan.

import type { AiStatus } from "../../core/types";
import {
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

/** The subset of the runtime's `sample` namespace this provider uses. */
export interface SampleFn {
  json<T = unknown>(input: string, options?: { images?: Blob[]; modelTier?: "default" | "complex" | "quick"; cache?: boolean }): Promise<T>;
  limits(): Promise<{ maxPromptBytes: number; images?: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } }>;
}

type SampleError = { code?: string; message?: string };

function mapError(err: unknown): AiProviderError {
  const e = (err ?? {}) as SampleError;
  switch (e.code) {
    case "not_granted":
    case "sampling_disabled":
    case "not_declared":
    case "capability_disabled":
    case "capability_removed":
      return new AiProviderError("Claude isn't available in this view. You can use the offline assistant instead.", "unavailable");
    case "rate_limited":
      return new AiProviderError("Claude is rate limited for your account right now. Try again later.", "rate_limited");
    case "refused":
      return new AiProviderError("Claude declined this request. Try rephrasing the description.", "refused");
    case "invalid_json":
    case "empty_completion":
      return new AiProviderError("Claude's answer could not be read. Try again.", "invalid_output");
    case "prompt_too_large":
      return new AiProviderError("The description is too long. Shorten it and try again.", "failed");
    case "image_rejected":
      return new AiProviderError("One of the screenshots couldn't be sent. Use PNG, JPEG, WebP or GIF under 20 MB.", "failed");
    case "session_expired":
      return new AiProviderError("Your claude.ai session expired. Sign in again.", "unavailable");
    case "cancelled":
      return new AiProviderError("Cancelled.", "failed");
    default:
      return new AiProviderError(e.message ? `Claude couldn't answer: ${e.message}` : "Claude couldn't answer. Try again.", "failed");
  }
}

export class SampleProvider implements AiProvider {
  readonly id = "artifact" as const;

  constructor(
    private readonly sample: SampleFn,
    private readonly imageLimits: { maxCount: number; maxInputBytes: number; mediaTypes: string[] } | null,
  ) {}

  status(): AiStatus {
    return { available: true, provider: "artifact", label: "Claude (claude.ai)", model: null, vision: !!this.imageLimits };
  }

  private async ask(prompt: Prompt, images: Blob[] = []): Promise<unknown> {
    try {
      return await this.sample.json(`${prompt.system}\n\n${prompt.user}`, {
        modelTier: "default",
        cache: false,
        ...(images.length ? { images } : {}),
      });
    } catch (err) {
      throw mapError(err);
    }
  }

  async draftReport(req: DraftRequest): Promise<AiResult<DraftModelOutput>> {
    const limits = this.imageLimits;
    const images = limits
      ? req.images.filter((i) => limits.mediaTypes.includes(i.mediaType) && i.blob.size <= limits.maxInputBytes).slice(0, limits.maxCount)
      : [];
    const raw = await this.ask(buildDraftPrompt({ ...req, images }, { includeShape: true }), images.map((i) => i.blob));
    return { output: normalizeDraft(raw), meta: { model: "Claude (claude.ai)" } };
  }

  async summarize(bug: BugDigest): Promise<AiResult<SummaryOutput>> {
    return { output: normalizeSummary(await this.ask(buildSummaryPrompt(bug, true))), meta: { model: "Claude (claude.ai)" } };
  }

  async regressionChecks(bug: BugDigest): Promise<AiResult<RegressionChecksOutput>> {
    return { output: normalizeChecks(await this.ask(buildRegressionPrompt(bug, true))), meta: { model: "Claude (claude.ai)" } };
  }

  async releaseRisk(req: ReleaseRiskRequest): Promise<AiResult<ReleaseRiskOutput>> {
    return { output: normalizeRisk(await this.ask(buildReleaseRiskPrompt(req, true))), meta: { model: "Claude (claude.ai)" } };
  }
}
