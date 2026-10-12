import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'
import { env } from '../env.ts'
import { HttpError, notConfigured } from '../lib/util.ts'

/**
 * Optional AI provider (Anthropic Claude). Used only for features that need a language model:
 * essay/speaking feedback, translations and richer word explanations. The key stays on the server.
 * Every call returns schema-validated JSON (structured outputs).
 */
let client: Anthropic | null = null

export const llmConfigured = () => !!env.anthropicKey

export async function llmJson<S extends z.ZodType>(opts: { system: string; prompt: string; schema: S; maxTokens?: number; effort?: 'low' | 'medium' | 'high' }): Promise<z.infer<S>> {
  if (!env.anthropicKey) throw notConfigured('AI feedback', 'Set ANTHROPIC_API_KEY on the server to enable AI features.')
  client ??= new Anthropic({ apiKey: env.anthropicKey, timeout: 120_000, maxRetries: 2 })
  try {
    const res = await client.beta.messages.parse({
      model: env.anthropicModel,
      max_tokens: opts.maxTokens ?? 8000,
      system: opts.system,
      messages: [{ role: 'user', content: opts.prompt }],
      output_config: { effort: opts.effort ?? 'medium', format: betaZodOutputFormat(opts.schema) },
      // If the primary model declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
    if (res.stop_reason === 'refusal') throw new HttpError(422, 'ai_refused', 'The AI could not give feedback on this text.')
    if (res.stop_reason === 'max_tokens' || !res.parsed_output) throw new HttpError(502, 'ai_failed', 'The AI response was incomplete. Please try again.')
    return res.parsed_output as z.infer<S>
  } catch (e) {
    if (e instanceof HttpError) throw e
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw notConfigured('AI feedback', 'The configured ANTHROPIC_API_KEY was rejected.')
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(503, 'ai_busy', 'The AI service is busy. Please try again in a minute.')
    if (e instanceof Anthropic.BadRequestError) {
      console.error('AI request rejected:', e.message)
      throw new HttpError(502, 'ai_failed', 'The AI service could not process this request.')
    }
    if (e instanceof Anthropic.APIError) throw new HttpError(502, 'ai_failed', 'The AI service is temporarily unavailable. Please try again.')
    throw new HttpError(502, 'ai_failed', 'Could not reach the AI service. Please try again.')
  }
}
