// Prompts and output schemas shared by every model-backed provider, so the Anthropic API and
// the claude.ai artifact runtime behave the same way.

import { z } from "zod";
import { FREQUENCIES } from "../../core/types";
import type {
  BugDigest,
  DraftModelOutput,
  DraftRequest,
  RegressionChecksOutput,
  ReleaseRiskOutput,
  ReleaseRiskRequest,
  SummaryOutput,
} from "./provider";

const Source = z.enum(["reporter", "screenshot", "ai_wording", "ai_inferred"]);
const Sourced = z.object({ value: z.string(), source: Source });
const OBSERVATION_KINDS = ["error_message", "ui_element", "page", "value", "layout", "validation", "status", "other"] as const;

export const DraftSchema = z.object({
  title: Sourced.nullable(),
  summary: Sourced.nullable(),
  steps: z.array(Sourced),
  expected_result: Sourced.nullable(),
  actual_result: Sourced.nullable(),
  module: Sourced.nullable(),
  feature: Sourced.nullable(),
  environment: Sourced.nullable(),
  browser: Sourced.nullable(),
  device: Sourced.nullable(),
  os: Sourced.nullable(),
  app_version: Sourced.nullable(),
  page_url: Sourced.nullable(),
  frequency: z.object({ value: z.enum(FREQUENCIES), source: Source }).nullable(),
  severity_suggestion: z.object({ key: z.string(), rationale: z.string() }).nullable(),
  priority_suggestion: z.object({ key: z.string(), rationale: z.string() }).nullable(),
  page: Sourced.nullable(),
  location: z
    .object({
      element: z.string().nullable(),
      image: z.number().int().nullable(),
      box: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).nullable(),
      source: Source,
    })
    .nullable(),
  screenshot_observations: z.array(
    z.object({
      image: z.number().int(),
      kind: z.enum(OBSERVATION_KINDS),
      observation: z.string(),
      quote: z.string().nullable(),
    }),
  ),
  missing_information: z.array(z.object({ field: z.string(), question: z.string() })),
  notes: z.array(z.string()),
});

export const SummarySchema = z.object({
  summary: z.string(),
  current_state: z.string(),
  open_questions: z.array(z.string()),
  next_step: z.string(),
});

export const RegressionChecksSchema = z.object({
  checks: z.array(z.object({ title: z.string(), steps: z.array(z.string()), why: z.string() })),
});

export const ReleaseRiskSchema = z.object({
  headline: z.string(),
  risks: z.array(z.object({ bug_key: z.string(), risk: z.string() })),
  recommendation: z.string(),
});

export interface Prompt {
  system: string;
  user: string;
}

// ---------------------------------------------------------------------------
// Drafting
// ---------------------------------------------------------------------------

export const DRAFT_SYSTEM = `You are the bug-report assistant inside Bugloop, a tool QA analysts use to report software bugs to engineers. A QA analyst has described a problem in their own words and may have attached screenshots. Turn their input into a clear, structured bug report that an engineer can act on.

Rules:
1. Never invent facts. Use only (a) the analyst's words, (b) the fields they already filled in, and (c) what is plainly visible in the screenshots. Do not guess environments, browsers, versions, URLs, names, data values, error codes or steps the analyst did not describe.
2. Record where each value comes from in "source":
   - "reporter": stated by the analyst or taken from the fields they filled in.
   - "screenshot": plainly visible in an attached image.
   - "ai_wording": your rewording or restructuring of facts the analyst gave. Titles and summaries are usually this.
   - "ai_inferred": a reasonable reading of something the analyst implied but did not say, for example the expected result when they only described what went wrong. The analyst must confirm these, so use this label honestly.
3. When information an engineer needs is missing, ask for it in missing_information instead of filling it in. Typical gaps: exact steps, expected result, environment, browser or device, how often it happens, which record or account was affected, the exact error text. Ask at most 5 short, specific questions and never about something already provided. Use these field names where they fit: steps, expected_result, actual_result, environment, browser, device, frequency, affected_record, error_text, app_version.
4. Screenshots are evidence, not proof. In screenshot_observations report only what is visible: quote on-screen text exactly in "quote", and describe UI elements, values, messages, validation errors, status indicators and layout problems. If text is unreadable, say so. Never claim behaviour a single image cannot show, such as that a save failed or what happened before or after it was taken. Number images from 1 in the order given.
5. Keep the analyst's meaning. Write concise, neutral, specific English (translate if the analyst wrote in another language, but keep on-screen text as quoted). No blame and no speculation about causes.
6. title: under 90 characters, describing the symptom and where it happens, for example "Member role changes are not kept after saving". No "Bug:" prefix and no IDs.
7. steps: one action per step, in order, starting from a known page. Include only steps the analyst described or clearly implied, and mark implied steps "ai_inferred". Do not number them.
8. summary: two or three sentences for the description field, restating the problem and its impact as described.
9. module and feature: choose only from the lists provided, using the exact name, and only when the analyst's text or a screenshot clearly points to it. Otherwise null.
10. environment: choose only from the listed environment names, and only when the analyst said it or it is visible. Otherwise null.
11. severity_suggestion: suggest one of the listed severity keys only when the impact is clear, with a one-sentence rationale. The analyst decides.
12. Use null for anything you cannot support, and empty arrays when there is nothing to list. Put caveats for the analyst in notes (at most 3 short sentences).
13. The product map lists the project's screens with their path, visible elements and the rules they must follow. page: choose one page name from it, exactly as written, when the analyst's words or a screenshot (title, URL, headings, fields) clearly point to it; otherwise null. When the analyst picked a page, keep it. The page decides the module and feature, so give those consistently.
14. location: where on screen the problem is. element: the UI element involved, using the product map's element name when one fits ("Role dropdown"), otherwise a short description. When a screenshot shows the problem, set image to its number and box to a rectangle around the problem area as fractions of that image's width and height (x and y of the top-left corner, then w and h, each between 0 and 1), with source "screenshot". Draw the box only around something you can actually see; otherwise box and image are null. If nothing points to an element, location is null.
15. expected_result: when one of the page's rules states the correct behaviour for this problem, base the expected result on that rule and mark it "ai_inferred" unless the analyst said it.
16. steps: when the page has a path or name, the first step may open it ("Open Members › Edit member"), marked "ai_inferred" unless the analyst said it.
17. priority_suggestion: one of the listed priority keys with a one-sentence rationale, weighing the impact, how often it happens and the page's importance. The analyst decides.`;

const DRAFT_SHAPE = `Reply with only a JSON object of this shape (no other text):
{
  "title": {"value": string, "source": Source} | null,
  "summary": {"value": string, "source": Source} | null,
  "steps": [{"value": string, "source": Source}],
  "expected_result": {"value": string, "source": Source} | null,
  "actual_result": {"value": string, "source": Source} | null,
  "module": {"value": string, "source": Source} | null,
  "feature": {"value": string, "source": Source} | null,
  "environment": {"value": string, "source": Source} | null,
  "browser": {"value": string, "source": Source} | null,
  "device": {"value": string, "source": Source} | null,
  "os": {"value": string, "source": Source} | null,
  "app_version": {"value": string, "source": Source} | null,
  "page_url": {"value": string, "source": Source} | null,
  "frequency": {"value": "always"|"often"|"sometimes"|"rarely"|"once"|"unknown", "source": Source} | null,
  "severity_suggestion": {"key": string, "rationale": string} | null,
  "priority_suggestion": {"key": string, "rationale": string} | null,
  "page": {"value": string, "source": Source} | null,
  "location": {"element": string | null, "image": number | null, "box": {"x": number, "y": number, "w": number, "h": number} | null, "source": Source} | null,
  "screenshot_observations": [{"image": number, "kind": "error_message"|"ui_element"|"page"|"value"|"layout"|"validation"|"status"|"other", "observation": string, "quote": string | null}],
  "missing_information": [{"field": string, "question": string}],
  "notes": [string]
}
where Source is one of "reporter", "screenshot", "ai_wording", "ai_inferred".`;

function fieldLines(req: DraftRequest): string[] {
  const f = req.fields;
  const lines: string[] = [];
  const add = (label: string, v: string | undefined | null) => {
    if (v && v.trim()) lines.push(`- ${label}: ${v.trim()}`);
  };
  add("Title", f.title);
  add("Description", f.description);
  if (f.steps?.length) lines.push(`- Steps:\n${f.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`);
  add("Expected result", f.expected_result);
  add("Actual result", f.actual_result);
  add("Browser", f.browser);
  add("Device", f.device);
  add("Operating system", f.os);
  add("App version or build", f.app_version);
  add("Page URL", f.page_url);
  if (f.frequency && f.frequency !== "unknown") add("Frequency", f.frequency);
  add("Severity (chosen by analyst)", f.severity);
  return lines;
}

/** The product map as compact text, kept within a budget so prompts stay small. */
export function productMapText(pages: DraftRequest["context"]["pages"], budget = 24000): string {
  if (!pages.length) return "Product map: none for this project yet.";
  const lines: string[] = [];
  let used = 0;
  let shown = 0;
  for (const p of pages) {
    const block = [
      `- Page "${p.name}" (${p.module}${p.feature ? ` › ${p.feature}` : ""})${p.path ? ` at ${p.path}` : ""}, importance ${p.importance}`,
      p.description ? `  About: ${p.description}` : null,
      p.elements.length ? `  Elements: ${p.elements.slice(0, 25).join("; ")}` : null,
      p.rules.length ? `  Rules: ${p.rules.slice(0, 12).join(" | ")}` : null,
      p.keywords.length ? `  Also called: ${p.keywords.slice(0, 10).join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    if (used + block.length > budget) break;
    lines.push(block);
    used += block.length;
    shown++;
  }
  const more = pages.length - shown;
  return `Product map (${pages.length} page${pages.length === 1 ? "" : "s"}${more ? `, ${more} not shown for length` : ""}):\n${lines.join("\n")}`;
}

export function buildDraftPrompt(req: DraftRequest, opts: { includeShape: boolean }): Prompt {
  const c = req.context;
  const parts: string[] = [];
  parts.push(`Project: ${c.project?.name ?? "not selected"}`);
  parts.push(`Module selected by the analyst: ${c.module?.name ?? "not selected"}`);
  parts.push(`Feature selected by the analyst: ${c.feature?.name ?? "not selected"}`);
  parts.push(`Environment selected by the analyst: ${c.environment?.name ?? "not selected"}`);
  if (c.modules.length) {
    parts.push(
      `Modules and features in this project:\n${c.modules
        .map((m) => `- ${m.name}${m.features.length ? `: ${m.features.map((f) => f.name).join(", ")}` : ""}`)
        .join("\n")}`,
    );
  }
  parts.push(`Page selected by the analyst: ${c.page ? c.page.name : "not selected"}`);
  parts.push(productMapText(c.pages));
  parts.push(`Environments: ${c.environments.map((e) => e.name).join(", ") || "none configured"}`);
  parts.push(`Severity levels:\n${c.severities.map((s) => `- ${s.key}: ${s.label}${s.description ? ` (${s.description})` : ""}`).join("\n")}`);
  if (c.priorities.length) {
    parts.push(`Priority levels:\n${c.priorities.map((s) => `- ${s.key}: ${s.label}${s.description ? ` (${s.description})` : ""}`).join("\n")}`);
  }
  parts.push(`Today's date: ${c.today}`);
  const fields = fieldLines(req);
  parts.push(`Fields the analyst already filled in:\n${fields.length ? fields.join("\n") : "(none)"}`);
  parts.push(`The analyst's description:\n"""\n${req.text.trim() || "(no description given)"}\n"""`);
  if (req.answers.length) {
    parts.push(`The analyst's answers to your earlier questions:\n${req.answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")}`);
  }
  parts.push(
    req.images.length
      ? `Screenshots attached: ${req.images.length} (${req.images.map((img, i) => `image ${i + 1}: ${img.name}`).join("; ")}).`
      : "No screenshots are attached, so screenshot_observations must be empty.",
  );
  if (opts.includeShape) parts.push(DRAFT_SHAPE);
  return { system: DRAFT_SYSTEM, user: parts.join("\n\n") };
}

/** Accept slightly malformed replies (missing arrays, wrong case) and coerce them into the schema. */
export function normalizeDraft(raw: unknown): DraftModelOutput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sourced = (v: unknown) => {
    if (!v || typeof v !== "object") return null;
    const o = v as { value?: unknown; source?: unknown };
    if (typeof o.value !== "string" || !o.value.trim()) return null;
    const src = Source.safeParse(o.source);
    return { value: o.value.trim(), source: src.success ? src.data : "ai_wording" } as const;
  };
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const freq = (() => {
    const s = sourced(r.frequency);
    if (!s || !(FREQUENCIES as readonly string[]).includes(s.value)) return null;
    return { value: s.value as (typeof FREQUENCIES)[number], source: s.source };
  })();
  const sev = r.severity_suggestion as { key?: unknown; rationale?: unknown } | null | undefined;
  const pri = r.priority_suggestion as { key?: unknown; rationale?: unknown } | null | undefined;
  const loc = (r.location && typeof r.location === "object" ? r.location : null) as Record<string, unknown> | null;
  const box = (() => {
    const b = loc?.box as Record<string, unknown> | null | undefined;
    if (!b || typeof b !== "object") return null;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
    let [x, y, w, h] = [n(b.x), n(b.y), n(b.w), n(b.h)];
    if ([x, y, w, h].some(Number.isNaN)) return null;
    // Some replies use percentages; bring them back to fractions.
    if (Math.max(x, y, w, h) > 1.5) [x, y, w, h] = [x / 100, y / 100, w / 100, h / 100];
    x = Math.min(1, Math.max(0, x));
    y = Math.min(1, Math.max(0, y));
    w = Math.min(1 - x, Math.max(0, w));
    h = Math.min(1 - y, Math.max(0, h));
    return w > 0.005 && h > 0.005 ? { x, y, w, h } : null;
  })();
  const locSource = Source.safeParse(loc?.source);
  const location = loc
    ? {
        element: typeof loc.element === "string" && loc.element.trim() ? loc.element.trim().slice(0, 300) : null,
        image: box && Number.isInteger(loc.image) ? Number(loc.image) : null,
        box: box && Number.isInteger(loc.image) ? box : null,
        source: locSource.success ? locSource.data : "ai_inferred",
      }
    : null;
  return {
    title: sourced(r.title),
    summary: sourced(r.summary),
    steps: arr(r.steps).map(sourced).filter((s): s is NonNullable<typeof s> => !!s),
    expected_result: sourced(r.expected_result),
    actual_result: sourced(r.actual_result),
    module: sourced(r.module),
    feature: sourced(r.feature),
    environment: sourced(r.environment),
    browser: sourced(r.browser),
    device: sourced(r.device),
    os: sourced(r.os),
    app_version: sourced(r.app_version),
    page_url: sourced(r.page_url),
    frequency: freq,
    severity_suggestion:
      sev && typeof sev.key === "string" && typeof sev.rationale === "string" ? { key: sev.key, rationale: sev.rationale } : null,
    priority_suggestion:
      pri && typeof pri.key === "string" && typeof pri.rationale === "string" ? { key: pri.key, rationale: pri.rationale } : null,
    page: sourced(r.page),
    location: location && (location.element || location.box) ? location : null,
    screenshot_observations: arr(r.screenshot_observations)
      .map((o) => {
        const x = o as Record<string, unknown>;
        if (typeof x.observation !== "string" || !x.observation.trim()) return null;
        const kind = (OBSERVATION_KINDS as readonly string[]).includes(String(x.kind)) ? (x.kind as (typeof OBSERVATION_KINDS)[number]) : "other";
        return {
          image: Number.isInteger(x.image) ? Number(x.image) : 1,
          kind,
          observation: x.observation.trim(),
          quote: typeof x.quote === "string" && x.quote.trim() ? x.quote.trim() : null,
        };
      })
      .filter((o): o is NonNullable<typeof o> => !!o),
    missing_information: arr(r.missing_information)
      .map((m) => {
        const x = m as Record<string, unknown>;
        return typeof x.question === "string" && x.question.trim()
          ? { field: typeof x.field === "string" ? x.field : "other", question: x.question.trim() }
          : null;
      })
      .filter((m): m is NonNullable<typeof m> => !!m)
      .slice(0, 6),
    notes: arr(r.notes).filter((n): n is string => typeof n === "string" && !!n.trim()).slice(0, 4),
  };
}

// ---------------------------------------------------------------------------
// Summaries, regression checks, release risk
// ---------------------------------------------------------------------------

function digestText(bug: BugDigest): string {
  return [
    `Bug ${bug.key}: ${bug.title}`,
    `Status: ${bug.status} (waiting on: ${bug.waiting_on}). Severity: ${bug.severity}. Priority: ${bug.priority}.`,
    `Project / module: ${bug.project} / ${bug.module}. Reporter: ${bug.reporter}. Assignee: ${bug.assignee ?? "unassigned"}.`,
    bug.environment ? `Environment: ${bug.environment}.` : "",
    `Reopened ${bug.reopen_count} time(s).`,
    bug.description ? `Description: ${bug.description}` : "",
    `Steps:\n${bug.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
    `Expected: ${bug.expected_result}`,
    `Actual: ${bug.actual_result}`,
    bug.resolution_summary ? `Fix summary: ${bug.resolution_summary}${bug.fix_version ? ` (build ${bug.fix_version})` : ""}` : "",
    `Timeline (oldest first):\n${bug.timeline.map((t) => `- ${t.at} ${t.who}: ${t.what}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSummaryPrompt(bug: BugDigest, includeShape: boolean): Prompt {
  return {
    system:
      "You summarize a bug's history for a teammate who has not followed it. Use only the facts provided. Do not speculate about causes, do not add steps, and name people exactly as given. If something is unknown, say so.",
    user: `${digestText(bug)}

Write:
- summary: 2 to 4 sentences on what the problem is and what has happened so far.
- current_state: one sentence with the status and who needs to act next.
- open_questions: unanswered questions from the discussion (empty if none).
- next_step: one sentence on the next concrete step for whoever is waiting.${
      includeShape
        ? `

Reply with only a JSON object: {"summary": string, "current_state": string, "open_questions": [string], "next_step": string}`
        : ""
    }`,
  };
}

export function buildRegressionPrompt(bug: BugDigest, includeShape: boolean): Prompt {
  return {
    system:
      "You help a QA analyst re-test a fixed bug. Suggest focused regression checks. The first check must be the original reproduction exactly as reported. Add at most 3 further checks that follow directly from the report, the discussion or the fix summary (other values, roles or records mentioned; the neighbouring behaviour the fix touched). Never invent product features that are not mentioned. The analyst chooses what to run.",
    user: `${digestText(bug)}

For each check give a short title, the steps (one action each) and why it matters in one sentence.${
      includeShape
        ? `

Reply with only a JSON object: {"checks": [{"title": string, "steps": [string], "why": string}]}`
        : ""
    }`,
  };
}

export function buildReleaseRiskPrompt(req: ReleaseRiskRequest, includeShape: boolean): Prompt {
  const list = req.bugs
    .map(
      (b) =>
        `- ${b.key} [${b.severity}, ${b.status}${b.reopen_count ? `, reopened ${b.reopen_count}x` : ""}${b.overdue ? ", overdue" : ""}${
          b.assignee ? "" : ", unassigned"
        }, open ${b.days_open} days, ${b.module}]: ${b.title}`,
    )
    .join("\n");
  return {
    system:
      "You write short release-risk briefings for a project manager. The counts you are given come from the database: repeat them exactly and never change them. Point out the few open bugs that most threaten a release (high severity, reopened, overdue or unassigned) and say why in one line each. Do not decide whether to release; give the manager the facts and a recommendation on what to look at first.",
    user: `Project: ${req.project}
Date: ${req.today}
Facts: ${req.facts.open} open bugs (excluding deferred), ${req.facts.critical_open} critical, ${req.facts.reopened_open} reopened at least once, ${req.facts.overdue} waiting longer than their attention threshold, ${req.facts.unassigned} unassigned.

Open bugs:
${list || "(none)"}

Write a one-sentence headline, up to 5 risks (bug key and one line each) and a two-sentence recommendation.${
      includeShape
        ? `

Reply with only a JSON object: {"headline": string, "risks": [{"bug_key": string, "risk": string}], "recommendation": string}`
        : ""
    }`,
  };
}

export function normalizeSummary(raw: unknown): SummaryOutput {
  const p = SummarySchema.safeParse(raw);
  if (p.success) return p.data;
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    summary: String(r.summary ?? ""),
    current_state: String(r.current_state ?? ""),
    open_questions: Array.isArray(r.open_questions) ? r.open_questions.map(String) : [],
    next_step: String(r.next_step ?? ""),
  };
}

export function normalizeChecks(raw: unknown): RegressionChecksOutput {
  const p = RegressionChecksSchema.safeParse(raw);
  if (p.success) return p.data;
  const r = (raw ?? {}) as { checks?: unknown };
  return {
    checks: (Array.isArray(r.checks) ? r.checks : [])
      .map((c) => c as Record<string, unknown>)
      .filter((c) => typeof c.title === "string")
      .map((c) => ({ title: String(c.title), steps: Array.isArray(c.steps) ? c.steps.map(String) : [], why: String(c.why ?? "") })),
  };
}

export function normalizeRisk(raw: unknown): ReleaseRiskOutput {
  const p = ReleaseRiskSchema.safeParse(raw);
  if (p.success) return p.data;
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    headline: String(r.headline ?? ""),
    risks: Array.isArray(r.risks)
      ? r.risks.map((x) => x as Record<string, unknown>).map((x) => ({ bug_key: String(x.bug_key ?? ""), risk: String(x.risk ?? "") }))
      : [],
    recommendation: String(r.recommendation ?? ""),
  };
}
