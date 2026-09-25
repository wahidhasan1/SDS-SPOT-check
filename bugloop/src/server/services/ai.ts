// AI features: drafting, summaries, regression checks and release risk. Enforces access,
// maps model output onto real ids, applies the no-invention guardrail and logs usage.

import type { DraftResult, RegressionChecksResult, ReleaseRiskResult, Sourced, SummaryResult } from "../../core/api";
import type { Bug, Page, StatusKey } from "../../core/types";
import { canViewTeamAnalytics } from "../../core/permissions";
import { describeEvent, type TimelineLookup } from "../../core/timeline";
import { waitingOn } from "../../core/statuses";
import type { AppContext } from "../context";
import { nowIso } from "../context";
import type { UserRow } from "../db/schema";
import { OfflineProvider, priorityGuess } from "../ai/heuristic";
import { AiProviderError, type AiProvider, type BugDigest, type DraftFields, type DraftImage, type DraftPage } from "../ai/provider";
import type { IncomingFile } from "./attachments";
import { actorOf, pendingRun } from "./bugs";
import { releaseFacts } from "./analytics";
import { getSettings, levelLabel, priorities, severities, statusLabel } from "./lookups";
import { HttpError, badRequest, forbidden, newId } from "./util";

const offline = new OfflineProvider();

function pickProvider(ctx: AppContext, forceOffline: boolean): AiProvider {
  return forceOffline ? offline : ctx.ai;
}

async function run<T>(ctx: AppContext, user: UserRow, feature: string, provider: AiProvider, fn: () => Promise<{ output: T; meta: { model: string | null; input_tokens?: number | null; output_tokens?: number | null } }>) {
  const started = Date.now();
  try {
    const result = await fn();
    ctx.store.insert("ai_requests", {
      id: newId("air"),
      user_id: user.id,
      feature,
      provider: provider.id,
      model: result.meta.model,
      status: "ok",
      duration_ms: Date.now() - started,
      input_tokens: result.meta.input_tokens ?? null,
      output_tokens: result.meta.output_tokens ?? null,
      error: null,
      created_at: nowIso(ctx),
    });
    return result;
  } catch (err) {
    const e = err instanceof AiProviderError ? err : new AiProviderError(err instanceof Error ? err.message : "Unknown error");
    ctx.store.insert("ai_requests", {
      id: newId("air"),
      user_id: user.id,
      feature,
      provider: provider.id,
      model: null,
      status: e.code === "refused" ? "refused" : "error",
      duration_ms: Date.now() - started,
      input_tokens: null,
      output_tokens: null,
      error: e.message.slice(0, 500),
      created_at: nowIso(ctx),
    });
    const status = e.code === "rate_limited" ? 429 : e.code === "unavailable" ? 503 : 502;
    throw new HttpError(status, `ai_${e.code}`, e.message, { provider: provider.id });
  }
}

// ---------------------------------------------------------------------------
// Drafting
// ---------------------------------------------------------------------------

export interface DraftInput {
  text: string;
  project_id?: string | null;
  module_id?: string | null;
  feature_id?: string | null;
  page_id?: string | null;
  environment_id?: string | null;
  fields?: DraftFields;
  answers?: { question: string; answer: string }[];
  images?: IncomingFile[];
  offline?: boolean;
}

const GENERIC_TOKENS = new Set(["google", "microsoft", "apple", "mozilla", "browser", "version", "the", "on", "in", "app", "latest", "desktop"]);

function tokens(v: string): string[] {
  return v
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .map((t) => t.replace(/\.+$/, ""))
    .filter((t) => t.length >= 2 && !GENERIC_TOKENS.has(t));
}

/** True when every meaningful token of the value appears in what the analyst wrote. */
export function supportedByText(value: string, corpus: string): boolean {
  const vt = tokens(value);
  if (!vt.length) return false;
  const ct = new Set(tokens(corpus));
  const flat = corpus.toLowerCase();
  return vt.every((t) => ct.has(t) || flat.includes(t));
}

export async function draftReport(ctx: AppContext, user: UserRow, input: DraftInput): Promise<DraftResult> {
  const text = (input.text ?? "").trim();
  const images = (input.images ?? []).filter((f) => f.type.startsWith("image/"));
  if (!text && !images.length && !input.fields?.title) throw badRequest("Describe the problem or attach a screenshot first.");
  if (text.length > 12000) throw badRequest("The description is too long for the assistant (12,000 characters max).");

  const project = input.project_id ? ctx.store.get("projects", input.project_id) : undefined;
  const mod = input.module_id ? ctx.store.get("modules", input.module_id) : undefined;
  const feature = input.feature_id ? ctx.store.get("features", input.feature_id) : undefined;
  const env = input.environment_id ? ctx.store.get("environments", input.environment_id) : undefined;
  const modules = project
    ? ctx.store.find("modules", { where: { project_id: project.id, archived: false }, orderBy: [{ column: "sort_order" }] })
    : [];
  const features = modules.length ? ctx.store.find("features", { where: { module_id: { in: modules.map((m) => m.id) }, archived: false } }) : [];
  const environments = ctx.store.find("environments", { where: { active: true }, orderBy: [{ column: "sort_order" }] });
  const sevs = severities(ctx).filter((s) => s.active);
  const pris = priorities(ctx).filter((s) => s.active);
  const allPages = project ? ctx.store.find("pages", { where: { project_id: project.id, archived: false }, orderBy: [{ column: "name" }] }) : [];
  const toDraftPage = (pg: Page): DraftPage => ({
    id: pg.id,
    name: pg.name,
    module: modules.find((m) => m.id === pg.module_id)?.name ?? "",
    feature: pg.feature_id ? features.find((f) => f.id === pg.feature_id)?.name ?? null : null,
    path: pg.path,
    description: pg.description,
    elements: pg.elements,
    rules: pg.rules,
    keywords: pg.keywords,
    importance: pg.importance,
  });
  const chosenPage = input.page_id ? allPages.find((pg) => pg.id === input.page_id) ?? null : null;
  const mapPages = allPages.filter((pg) => (!mod || pg.module_id === mod.id) && (!feature || !pg.feature_id || pg.feature_id === feature.id));

  const draftImages: DraftImage[] = images.map((f) => ({ name: f.name, mediaType: f.type, blob: f.blob }));
  const provider = pickProvider(ctx, !!input.offline);
  const answers = (input.answers ?? []).filter((a) => a.answer?.trim()).slice(0, 10);
  const fields = input.fields ?? {};

  const { output, meta } = await run(ctx, user, "draft_report", provider, () =>
    provider.draftReport({
      text,
      images: draftImages,
      fields,
      answers,
      context: {
        project: project ? { id: project.id, name: project.name } : null,
        module: mod ? { id: mod.id, name: mod.name } : null,
        feature: feature ? { id: feature.id, name: feature.name } : null,
        environment: env ? { id: env.id, name: env.name } : null,
        page: chosenPage ? toDraftPage(chosenPage) : null,
        pages: mapPages.map(toDraftPage),
        priorities: pris.map((x) => ({ key: x.key, label: x.label, description: x.description })),
        modules: modules.map((m) => ({ id: m.id, name: m.name, features: features.filter((f) => f.module_id === m.id).map((f) => ({ id: f.id, name: f.name })) })),
        environments: environments.map((e) => ({ id: e.id, name: e.name })),
        severities: sevs.map((s) => ({ key: s.key, label: s.label, description: s.description })),
        today: nowIso(ctx).slice(0, 10),
      },
    }),
  );

  const vision = provider.status().vision;
  const imagesAnalyzed = vision ? draftImages.length : 0;
  const corpus = [text, ...answers.map((a) => a.answer), ...Object.values(fields).flat().filter((v): v is string => typeof v === "string")].join("\n");
  const removed: { field: string; value: string }[] = [];
  const missing = [...output.missing_information];
  const ask = (field: string, question: string) => {
    if (!missing.some((m) => m.field === field)) missing.push({ field, question });
  };

  // Guardrail: environment-type facts must come from the analyst or a screenshot.
  const guard = (field: string, v: Sourced | null, provided: string | undefined, question: string): Sourced | null => {
    if (!v) return null;
    if (provided && provided.trim()) return { value: provided.trim(), source: "reporter" };
    const fromShot = v.source === "screenshot" && imagesAnalyzed > 0;
    if (fromShot || supportedByText(v.value, corpus)) return v;
    removed.push({ field, value: v.value });
    ask(field, question);
    return null;
  };
  const browser = guard("browser", output.browser, fields.browser, "Which browser were you using?");
  const device = guard("device", output.device, fields.device, "Which device were you using?");
  const os = guard("os", output.os, fields.os, "Which operating system were you using?");
  const appVersion = guard("app_version", output.app_version, fields.app_version, "Which app version or build were you testing?");
  const pageUrl = guard("page_url", output.page_url, fields.page_url, "What is the URL of the page where it happened?");

  let environment: Sourced | null = null;
  if (env) environment = { value: env.id, source: "reporter" };
  else if (output.environment) {
    const match = environments.find((e) => e.name.toLowerCase() === output.environment!.value.toLowerCase());
    const supported = match && ((output.environment.source === "screenshot" && imagesAnalyzed > 0) || supportedByText(match.name, corpus));
    if (match && supported) environment = { value: match.id, source: output.environment.source };
    else {
      removed.push({ field: "environment", value: output.environment.value });
      ask("environment", `Which environment were you using (${environments.map((e) => e.name).join(", ")})?`);
    }
  }

  // The page decides the module and feature when the analyst didn't choose them.
  let pageOut: Sourced | null = chosenPage ? { value: chosenPage.id, source: "reporter" } : null;
  let pageRow: Page | null = chosenPage;
  if (!chosenPage && output.page) {
    const name = output.page.value.toLowerCase();
    const found = mapPages.find((pg) => pg.name.toLowerCase() === name) ?? allPages.find((pg) => pg.name.toLowerCase() === name && (!mod || pg.module_id === mod.id));
    if (found) {
      pageRow = found;
      pageOut = { value: found.id, source: output.page.source === "reporter" ? "ai_inferred" : output.page.source };
    }
  }

  let moduleOut: Sourced | null = null;
  if (!mod && pageRow) moduleOut = { value: pageRow.module_id, source: pageOut?.source ?? "ai_inferred" };
  else if (!mod && output.module) {
    const m = modules.find((x) => x.name.toLowerCase() === output.module!.value.toLowerCase());
    if (m) moduleOut = { value: m.id, source: output.module.source };
  }
  const moduleForFeature = mod?.id ?? moduleOut?.value ?? null;
  let featureOut: Sourced | null = null;
  if (!feature && pageRow?.feature_id && pageRow.module_id === moduleForFeature) featureOut = { value: pageRow.feature_id, source: pageOut?.source ?? "ai_inferred" };
  else if (!feature && output.feature && moduleForFeature) {
    const f = features.find((x) => x.module_id === moduleForFeature && x.name.toLowerCase() === output.feature!.value.toLowerCase());
    if (f) featureOut = { value: f.id, source: output.feature.source };
  }

  const severity =
    output.severity_suggestion && sevs.some((s) => s.key === output.severity_suggestion!.key) ? output.severity_suggestion : null;
  const frequencyOut = fields.frequency && fields.frequency !== "unknown" ? { value: fields.frequency, source: "reporter" as const } : output.frequency;
  const priority =
    output.priority_suggestion && pris.some((x) => x.key === output.priority_suggestion!.key)
      ? output.priority_suggestion
      : priorityGuess(
          fields.severity ?? severity?.key ?? null,
          pageRow ? { name: pageRow.name, importance: pageRow.importance } : null,
          frequencyOut?.value ?? null,
          pris.map((x) => x.key),
        );

  // Location: a box only when this provider actually looked at that screenshot.
  let location: DraftResult["location"] = null;
  if (output.location) {
    const l = output.location;
    const boxOk = !!l.box && l.source === "screenshot" && imagesAnalyzed > 0 && !!l.image && l.image >= 1 && l.image <= imagesAnalyzed;
    if (l.box && !boxOk) removed.push({ field: "location box", value: "a highlighted area on a screenshot the assistant couldn't see" });
    const element = l.element ? l.element.slice(0, 300) : null;
    if (element || boxOk) {
      location = { element, image: boxOk ? l.image : null, box: boxOk ? l.box : null, source: boxOk ? "screenshot" : l.source === "screenshot" ? "ai_inferred" : l.source };
    }
  }
  const observations = imagesAnalyzed ? output.screenshot_observations.filter((o) => o.image >= 1 && o.image <= imagesAnalyzed) : [];
  const notes = [...output.notes];
  if (images.length && !vision) notes.push("This assistant can't read screenshots. They're attached as evidence, and you can mark the problem area on them yourself.");

  const clamp = (v: Sourced | null, max: number): Sourced | null => (v ? { ...v, value: v.value.slice(0, max) } : null);
  return {
    provider: provider.id,
    model: meta.model,
    title: clamp(output.title, 150),
    description: clamp(output.summary, 4000),
    steps: output.steps.slice(0, 20).map((st) => ({ ...st, value: st.value.slice(0, 500) })),
    expected_result: clamp(output.expected_result, 2000),
    actual_result: clamp(output.actual_result, 2000),
    module_id: moduleOut,
    feature_id: featureOut,
    environment_id: environment,
    browser,
    device,
    os,
    app_version: appVersion,
    page_url: pageUrl,
    frequency: frequencyOut,
    severity_suggestion: severity,
    priority_suggestion: priority,
    page_id: pageOut,
    location,
    screenshot_observations: observations,
    missing_information: missing.slice(0, 6),
    notes: [...new Set(notes)].slice(0, 4),
    removed_by_guardrail: removed,
    images_analyzed: imagesAnalyzed,
  };
}

// ---------------------------------------------------------------------------
// Bug digests for summaries and regression checks
// ---------------------------------------------------------------------------

export function timelineLookup(ctx: AppContext): TimelineLookup {
  const sevs = severities(ctx);
  const pris = priorities(ctx);
  return {
    user: (id) => (id ? ctx.store.get("users", id)?.name ?? "Unknown user" : "System"),
    status: (key: StatusKey) => statusLabel(ctx, key),
    bugKey: (id) => (id ? ctx.store.get("bugs", id)?.key ?? null : null),
    severity: (k) => levelLabel(sevs, k),
    priority: (k) => levelLabel(pris, k),
    environment: (id) => (id ? ctx.store.get("environments", id)?.name ?? null : null),
    module: (id) => (id ? ctx.store.get("modules", id)?.name ?? null : null),
  };
}

export function bugDigest(ctx: AppContext, bug: Bug): BugDigest {
  const L = timelineLookup(ctx);
  const settings = getSettings(ctx);
  const run = pendingRun(ctx, bug.id);
  const events = ctx.store.find("events", { where: { bug_id: bug.id }, orderBy: [{ column: "created_at" }, { column: "id" }] });
  const comments = new Map(ctx.store.find("comments", { where: { bug_id: bug.id } }).map((c) => [c.id, c]));
  const timeline = events
    .map((e) => {
      const d = describeEvent(e, L);
      let what = d.text + (d.detail ? `: ${d.detail}` : "");
      if (e.type === "comment.added") {
        const c = comments.get(String((e.data as { comment_id?: string }).comment_id));
        if (c) what = `commented: ${c.body}`;
      }
      return { at: e.created_at.slice(0, 16).replace("T", " "), who: d.system ? "System" : L.user(e.actor_id), what: what.slice(0, 600) };
    })
    .slice(-60);
  return {
    key: bug.key,
    title: bug.title,
    status: statusLabel(ctx, bug.status),
    severity: L.severity(bug.severity),
    priority: L.priority(bug.priority),
    project: ctx.store.get("projects", bug.project_id)?.name ?? "",
    module: L.module(bug.module_id) ?? "",
    reporter: L.user(bug.reporter_id),
    assignee: bug.assignee_id ? L.user(bug.assignee_id) : null,
    description: bug.description,
    steps: bug.steps,
    expected_result: bug.expected_result,
    actual_result: bug.actual_result,
    environment: L.environment(bug.environment_id),
    resolution_summary: bug.resolution_summary,
    fix_version: bug.fix_version,
    waiting_on: (() => {
      const w = waitingOn(bug, { regressionAssigneeId: run?.assignee_id ?? null, autoCloseOnVerify: settings.auto_close_on_verify });
      return w.user_id ? `${L.user(w.user_id)} (${w.label})` : w.label;
    })(),
    reopen_count: bug.reopen_count,
    timeline,
  };
}

export async function summarizeBug(ctx: AppContext, user: UserRow, bug: Bug, forceOffline = false): Promise<SummaryResult> {
  const provider = pickProvider(ctx, forceOffline);
  const { output, meta } = await run(ctx, user, "summarize", provider, () => provider.summarize(bugDigest(ctx, bug)));
  return { provider: provider.id, model: meta.model, ...output };
}

export async function regressionChecks(ctx: AppContext, user: UserRow, bug: Bug, forceOffline = false): Promise<RegressionChecksResult> {
  const provider = pickProvider(ctx, forceOffline);
  const { output, meta } = await run(ctx, user, "regression_checks", provider, () => provider.regressionChecks(bugDigest(ctx, bug)));
  return { provider: provider.id, model: meta.model, checks: output.checks.slice(0, 5) };
}

export async function releaseRisk(ctx: AppContext, user: UserRow, projectId: string, forceOffline = false): Promise<ReleaseRiskResult> {
  if (!canViewTeamAnalytics(actorOf(user))) throw forbidden("Release risk summaries are for QA leads, project managers and admins.");
  const project = ctx.store.get("projects", projectId);
  if (!project) throw badRequest("Choose a project.");
  const { bugs, facts } = releaseFacts(ctx, projectId);
  const L = timelineLookup(ctx);
  const now = nowIso(ctx);
  const statuses = ctx.store.find("status_config");
  const provider = pickProvider(ctx, forceOffline);
  const { output, meta } = await run(ctx, user, "release_risk", provider, () =>
    provider.releaseRisk({
      project: project.name,
      today: now.slice(0, 10),
      facts,
      bugs: bugs.slice(0, 80).map((b) => ({
        key: b.key,
        title: b.title,
        status: L.status(b.status),
        severity: b.severity,
        module: L.module(b.module_id) ?? "",
        reopen_count: b.reopen_count,
        days_open: Math.floor((Date.parse(now) - Date.parse(b.created_at)) / 86_400_000),
        overdue: (() => {
          const cfg = statuses.find((s) => s.key === b.status);
          return !!cfg?.attention_hours && (Date.parse(now) - Date.parse(b.status_changed_at)) / 3_600_000 > cfg.attention_hours;
        })(),
        assignee: b.assignee_id ? L.user(b.assignee_id) : null,
      })),
    }),
  );
  const keys = new Set(bugs.map((b) => b.key));
  return {
    provider: provider.id,
    model: meta.model,
    headline: output.headline,
    risks: output.risks.filter((r) => keys.has(r.bug_key)).slice(0, 6),
    recommendation: output.recommendation,
    facts,
  };
}
