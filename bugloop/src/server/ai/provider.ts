// The one interface every AI feature goes through. Prompts and schemas are shared
// (prompts.ts); providers only differ in transport.

import type { Sourced } from "../../core/api";
import type { AiStatus, Frequency, ScreenshotObservation } from "../../core/types";

export interface DraftImage {
  name: string;
  mediaType: string;
  blob: Blob;
}

export interface DraftFields {
  title?: string;
  description?: string;
  steps?: string[];
  expected_result?: string;
  actual_result?: string;
  browser?: string;
  device?: string;
  os?: string;
  app_version?: string;
  page_url?: string;
  frequency?: Frequency;
  severity?: string;
}

export interface DraftContext {
  project: { id: string; name: string } | null;
  module: { id: string; name: string } | null;
  feature: { id: string; name: string } | null;
  environment: { id: string; name: string } | null;
  modules: { id: string; name: string; features: { id: string; name: string }[] }[];
  environments: { id: string; name: string }[];
  severities: { key: string; label: string; description: string | null }[];
  today: string;
}

export interface DraftRequest {
  text: string;
  images: DraftImage[];
  fields: DraftFields;
  answers: { question: string; answer: string }[];
  context: DraftContext;
}

/** What a provider returns: names rather than ids; the AI service maps and checks them. */
export interface DraftModelOutput {
  title: Sourced | null;
  summary: Sourced | null;
  steps: Sourced[];
  expected_result: Sourced | null;
  actual_result: Sourced | null;
  module: Sourced | null;
  feature: Sourced | null;
  environment: Sourced | null;
  browser: Sourced | null;
  device: Sourced | null;
  os: Sourced | null;
  app_version: Sourced | null;
  page_url: Sourced | null;
  frequency: Sourced<Frequency> | null;
  severity_suggestion: { key: string; rationale: string } | null;
  screenshot_observations: ScreenshotObservation[];
  missing_information: { field: string; question: string }[];
  notes: string[];
}

export interface BugDigest {
  key: string;
  title: string;
  status: string;
  severity: string;
  priority: string;
  project: string;
  module: string;
  reporter: string;
  assignee: string | null;
  description: string;
  steps: string[];
  expected_result: string;
  actual_result: string;
  environment: string | null;
  resolution_summary: string | null;
  fix_version: string | null;
  waiting_on: string;
  reopen_count: number;
  timeline: { at: string; who: string; what: string }[];
}

export interface SummaryOutput {
  summary: string;
  current_state: string;
  open_questions: string[];
  next_step: string;
}

export interface RegressionChecksOutput {
  checks: { title: string; steps: string[]; why: string }[];
}

export interface ReleaseRiskRequest {
  project: string;
  today: string;
  facts: { open: number; critical_open: number; reopened_open: number; overdue: number; unassigned: number };
  bugs: { key: string; title: string; status: string; severity: string; module: string; reopen_count: number; days_open: number; overdue: boolean; assignee: string | null }[];
}

export interface ReleaseRiskOutput {
  headline: string;
  risks: { bug_key: string; risk: string }[];
  recommendation: string;
}

export interface AiCallMeta {
  model: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
}

export interface AiResult<T> {
  output: T;
  meta: AiCallMeta;
}

export interface AiProvider {
  readonly id: "anthropic" | "artifact" | "offline";
  status(): AiStatus;
  draftReport(req: DraftRequest): Promise<AiResult<DraftModelOutput>>;
  summarize(bug: BugDigest): Promise<AiResult<SummaryOutput>>;
  regressionChecks(bug: BugDigest): Promise<AiResult<RegressionChecksOutput>>;
  releaseRisk(req: ReleaseRiskRequest): Promise<AiResult<ReleaseRiskOutput>>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly code: "unavailable" | "refused" | "invalid_output" | "rate_limited" | "failed" = "failed",
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
