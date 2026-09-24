// The offline assistant: a rule-based fallback when no model is available. It only
// rearranges the analyst's own words (never adds facts) and asks for everything else.

import type { Sourced } from "../../core/api";
import type { AiStatus, Frequency } from "../../core/types";
import { capitalize, ensurePeriod, normalizeWhitespace, sentences, stem, truncate } from "../../core/text";
import type {
  AiProvider,
  AiResult,
  BugDigest,
  DraftModelOutput,
  DraftRequest,
  RegressionChecksOutput,
  ReleaseRiskOutput,
  ReleaseRiskRequest,
  SummaryOutput,
} from "./provider";

const BASE_VERBS = [
  "change", "save", "click", "open", "close", "select", "edit", "enter", "type", "upload", "add", "remove", "delete",
  "create", "update", "submit", "press", "tap", "log", "sign", "navigate", "go", "try", "fill", "choose", "pick", "set",
  "reload", "refresh", "search", "filter", "sort", "export", "import", "download", "assign", "invite", "scroll", "switch",
  "move", "drag", "drop", "copy", "paste", "cancel", "confirm", "approve", "reject", "reopen", "visit", "check", "uncheck",
  "enable", "disable", "toggle", "rename", "print", "generate", "run", "start", "stop", "restart", "install", "launch",
  "load", "view", "use", "attach", "share", "archive", "restore", "link", "unlink", "expand", "collapse", "hover",
];
const IRREGULAR_PAST: Record<string, string> = { went: "go", chose: "choose", ran: "run", made: "make", got: "get", saw: "see", did: "do", put: "put", set: "set", took: "take", came: "come", left: "leave" };
const DOUBLING = new Set(["drop", "log", "tap", "stop", "run", "set", "drag", "plan", "ship", "chat", "pin", "zip", "shut", "cut", "put", "get"]);

function pastOf(b: string): string {
  if (b.endsWith("e")) return `${b}d`;
  if (b.endsWith("y") && !/[aeiou]y$/.test(b)) return `${b.slice(0, -1)}ied`;
  if (DOUBLING.has(b)) return `${b}${b.slice(-1)}ed`;
  return `${b}ed`;
}
function gerundOf(b: string): string {
  if (b.endsWith("e") && !b.endsWith("ee")) return `${b.slice(0, -1)}ing`;
  if (DOUBLING.has(b)) return `${b}${b.slice(-1)}ing`;
  return `${b}ing`;
}
const TO_BASE = new Map<string, string>();
for (const b of BASE_VERBS) {
  TO_BASE.set(b, b);
  TO_BASE.set(pastOf(b), b);
  TO_BASE.set(gerundOf(b), b);
  TO_BASE.set(`${b}s`, b);
  if (b.endsWith("ch") || b.endsWith("sh") || b.endsWith("x")) TO_BASE.set(`${b}es`, b);
}
for (const [p, b] of Object.entries(IRREGULAR_PAST)) TO_BASE.set(p, b);

const CONTRAST = /\s*(?:,\s*)?\b(but|however|instead|although|though|yet|whereas|except that)\b\s*,?\s*/i;
const EXPECT = /\b(expected|expecting|expect|supposed to|meant to|i thought it would)\b/i;
const SHOULD = /\b(should|ought to)\b/i;

/** "It should keep the new role" states an expectation; "empty boxes where the icons should be" describes a symptom. */
function isExpectation(s: string): boolean {
  if (EXPECT.test(s)) return true;
  if (!SHOULD.test(s)) return false;
  return !/\b(where|which|that|who)\b[^.]*\b(should|ought to)\b/i.test(s);
}

/** "click Save it shows Saved" → an action followed by what the analyst saw. */
const OBSERVED = /^(.+?)\s+(?:and\s+)?((?:it|this|that|the page|the app|the screen|the system)\s+(?:shows|says|displays|looks|appears|reads)\b.*)$/i;
/** A finite verb outside a relative clause means the piece describes something instead of instructing. */
const DESCRIBES = /\b(shows|displays|says|is|are|was|were|appears|becomes|returns|looks|gives|throws|keeps|stays|remains|goes)\b/i;
function describes(piece: string): boolean {
  const main = piece.split(/\b(?:that|which|who|where|when|whose)\b/i)[0];
  return DESCRIBES.test(main.replace(/^\S+\s*/, ""));
}
const SYMPTOM =
  /\b(not|n't|never|no longer|error|fail|failed|fails|broken|wrong|incorrect|missing|disappear|revert|crash|freez|stuck|blank|empty|old|previous|still|duplicate|twice|overlap|cut off|slow|timeout|denied|cannot|can't|unable)\b/i;
const LEAD_IN = /^(?:and\s+)?(?:so\s+)?(?:then\s+)?(?:when|whenever|if|after|once|as soon as|while|before)?\s*(?:i|we|you|the user|they)?\s*(?:have\s+|had\s+|just\s+|first\s+|then\s+)*/i;

function toImperative(clause: string): string | null {
  let c = normalizeWhitespace(clause.replace(LEAD_IN, "")).replace(/[.,;:!]+$/, "");
  if (!c) return null;
  const words = c.split(" ");
  const first = words[0].toLowerCase();
  const base = TO_BASE.get(first);
  if (!base) return null;
  words[0] = base;
  c = words.join(" ");
  // "open again" reads better as "open it again".
  c = c.replace(/^(open|reopen|save|check|reload|refresh|view)\s+again\b/i, "$1 it again");
  return capitalize(c);
}

/**
 * "after opening again the old role is there" → { step: "Open it again", rest: "the old role is there" }
 * "when I open the member again the old role is there" → { step: "Open the member again", rest: "the old role is there" }
 */
function splitTrailingAction(clause: string): { step: string; rest: string } | null {
  const m = /^(after|when|once|if|on|as soon as)\s+(.+)$/i.exec(clause.trim());
  if (!m) return null;
  const body = m[2];
  let action: string | null = null;
  let rest: string | null = null;
  const again = /^(.*?\b(?:again|back))\b[,\s]+(.+)$/i.exec(body);
  const comma = /^([^,]+),\s*(.+)$/.exec(body);
  // "reloading the page the old number is back": the action keeps its object ("the page") when a
  // second noun phrase starts the consequence.
  const withObject = /^(\w+ing\s+(?:the|a|an|this|that|my|our|its|their)\s+\w+(?:\s+\w+)?)\s+((?:the|a|an|this|that|my|our|its|their|it|nothing|no)\b.+)$/i.exec(body);
  const gerund = /^(\w+ing(?:\s+(?:it|them|again|back|up))*)\s+(.+)$/i.exec(body);
  if (again) [action, rest] = [again[1], again[2]];
  else if (comma) [action, rest] = [comma[1], comma[2]];
  else if (withObject) [action, rest] = [withObject[1], withObject[2]];
  else if (gerund) [action, rest] = [gerund[1], gerund[2]];
  if (!action || !rest) return null;
  const step = toImperative(action);
  return step ? { step, rest } : null;
}

function gerundPhrase(step: string): string {
  const words = step.split(" ");
  const base = words[0].toLowerCase();
  words[0] = TO_BASE.has(base) ? gerundOf(TO_BASE.get(base)!) : base;
  return words.join(" ");
}

function splitActions(clause: string): string[] {
  return clause
    .split(/\s*(?:,\s*and then|,\s*then|\band then\b|\bthen\b|\band\b|,)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

const BROWSERS = /\b(chrome|chromium|firefox|safari|edge|opera|brave)(?:\s+(?:version\s+)?(\d+(?:\.\d+)*))?/i;
const OSES = /\b(windows\s*(?:10|11|7)?|mac\s?os(?:\s*x)?(?:\s+\d+(?:\.\d+)*)?|ios\s*\d*(?:\.\d+)*|android\s*\d*|ubuntu|linux)\b/i;
const DEVICES = /\b(iphone\s*\d*(?:\s*pro)?|ipad(?:\s*pro)?|pixel\s*\d+|galaxy\s*[a-z]?\d+|android phone|android tablet|desktop|laptop|tablet|mobile phone)\b/i;
const VERSION = /\b(?:v|version|build|release)\s*[:#]?\s*(\d+(?:\.\d+){1,3}(?:[-+][\w.]+)?)\b/i;
const URL = /\bhttps?:\/\/[^\s)"'<>]+/i;

function detectFrequency(text: string): Frequency | null {
  if (/\b(every ?time|always|each time|consistently|100%|all the time|reproducible)\b/i.test(text)) return "always";
  if (/\b(usually|often|most of the time|frequently)\b/i.test(text)) return "often";
  if (/\b(sometimes|intermittent|occasionally|randomly|now and then|flaky)\b/i.test(text)) return "sometimes";
  if (/\b(rarely|seldom|hardly ever)\b/i.test(text)) return "rarely";
  if (/\b(only once|happened once|one time|just once)\b/i.test(text)) return "once";
  return null;
}

function matchByName<T extends { name: string }>(text: string, items: T[]): T | null {
  const lower = ` ${text.toLowerCase()} `;
  let best: { item: T; pos: number; len: number } | null = null;
  for (const item of items) {
    const name = item.name.toLowerCase();
    const candidates = [name, stem(name), name.replace(/s$/, "")].filter((n) => n.length >= 3);
    for (const n of candidates) {
      const pos = lower.search(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      if (pos >= 0 && (!best || pos < best.pos || (pos === best.pos && n.length > best.len))) best = { item, pos, len: n.length };
    }
  }
  return best?.item ?? null;
}

const ENTITY = /\b(member|user|site|product|chemical|document|sds|report|location|supplier|record|account|project|order|invoice)\b/i;

function severityGuess(text: string, keys: string[]): { key: string; rationale: string } | null {
  const pick = (k: string) => (keys.includes(k) ? k : null);
  if (/\b(crash|data loss|lost data|security|can't log ?in|cannot log ?in|500 error|outage|all users)\b/i.test(text)) {
    const k = pick("critical");
    return k ? { key: k, rationale: "Your description mentions a crash, data loss, access or security problem." } : null;
  }
  if (/\b(not sav|isn't sav|doesn't sav|revert|wrong data|incorrect|missing data|blocked|can't|cannot|unable|error)\b/i.test(text)) {
    const k = pick("major");
    return k ? { key: k, rationale: "Your description mentions changes not being kept, wrong data or a blocked task." } : null;
  }
  if (/\b(typo|spelling|alignment|misaligned|colour|color|cosmetic|padding|font)\b/i.test(text)) {
    const k = pick("trivial") ?? pick("minor");
    return k ? { key: k, rationale: "Your description sounds cosmetic." } : null;
  }
  return null;
}

export function heuristicDraft(req: DraftRequest): DraftModelOutput {
  const answersText = req.answers.map((a) => a.answer).join("\n");
  const text = normalizeWhitespace([req.text, answersText].filter(Boolean).join("\n"));
  const f = req.fields;
  const R = <T extends string>(value: T, source: Sourced["source"] = "reporter"): Sourced<T> => ({ value, source });

  const steps: Sourced[] = [];
  let trailingAction: string | null = null;
  const actual: string[] = [];
  const expected: string[] = [];
  const context: string[] = [];

  const observed: string[] = [];
  for (const sentence of sentences(req.text)) {
    const s = sentence.replace(/\s+/g, " ").trim();
    if (isExpectation(s)) {
      expected.push(s);
      continue;
    }
    const parts = s.split(CONTRAST);
    const before = parts[0] ?? "";
    const after = parts.length > 2 ? parts.slice(2).join(" ") : "";
    const actualBefore = actual.length;
    // "After saving, the old role is there": an action and its consequence in one sentence.
    if (parts.length === 1 && /^(after|when|once|as soon as)\b/i.test(s)) {
      const split = splitTrailingAction(s.replace(/[.!]+$/, ""));
      if (split && SYMPTOM.test(split.rest)) {
        steps.push(R(split.step));
        actual.push(split.rest);
        trailingAction = split.step;
        continue;
      }
    }
    for (const piece of splitActions(before)) {
      const obs = OBSERVED.exec(piece);
      const obsStep = obs ? toImperative(obs[1]) : null;
      if (obs && obsStep) {
        steps.push(R(obsStep));
        observed.push(obs[2]);
        continue;
      }
      const step = toImperative(piece);
      if (step && !describes(piece)) steps.push(R(step));
      else if (step && SYMPTOM.test(piece)) actual.push(piece.trim());
      else if (piece.trim()) context.push(piece.trim());
    }
    if (after) {
      const split = splitTrailingAction(after);
      if (split) {
        steps.push(R(split.step));
        actual.push(split.rest);
        trailingAction = split.step;
      } else actual.push(after);
    } else if (actual.length === actualBefore && SYMPTOM.test(s) && !steps.length) {
      actual.push(s);
    } else if (actual.length === actualBefore && SYMPTOM.test(s) && parts.length === 1 && !splitActions(before).some((p) => toImperative(p))) {
      actual.push(s);
    }
  }

  // Answers mapped to the questions they answer.
  let expectedFromAnswer: string | null = null;
  let actualFromAnswer: string | null = null;
  const extraSteps: string[] = [];
  let affectedRecord: string | null = null;
  for (const a of req.answers) {
    const q = a.question.toLowerCase();
    if (/expect/.test(q)) expectedFromAnswer = a.answer;
    else if (/step|exactly what|how did you/.test(q)) extraSteps.push(...a.answer.split(/\n|(?<=\.)\s+/).map((x) => x.trim()).filter(Boolean));
    else if (/error|message|what happened|actual/.test(q)) actualFromAnswer = a.answer;
    else if (/which (member|user|record|account|site|product|document)|affected/.test(q)) affectedRecord = a.answer;
  }
  if (extraSteps.length && !steps.length) for (const s of extraSteps) steps.push(R(capitalize(s.replace(/^\d+[.)]\s*/, ""))));

  const module = req.context.module ? null : matchByName(text, req.context.modules);
  const moduleName = req.context.module?.name ?? module?.name ?? null;
  const featureList = req.context.modules.find((m) => m.name === moduleName)?.features ?? [];
  const feature = req.context.feature ? null : matchByName(text, featureList);
  const featureName = req.context.feature?.name ?? feature?.name ?? null;
  if (steps.length && moduleName && !/^(go|open|navigate|visit|log|sign)\b/i.test(steps[0].value)) {
    steps.unshift(R(`Go to ${moduleName}${featureName ? ` › ${featureName}` : ""}`, "ai_inferred"));
  }

  const clean = (x: string) => ensurePeriod(capitalize(x.trim().replace(/^(then|and|so)\s+/i, "")));
  const symptom = actual.length ? actual[actual.length - 1] : null;
  const actualSentence = actualFromAnswer
    ? clean(actualFromAnswer)
    : actual.length
      ? [...observed, ...actual].map(clean).join(" ")
      : null;
  const expectedText = expectedFromAnswer ?? (expected.length ? expected.join(" ") : null);

  let title: string | null = null;
  if (!f.title) {
    const core = actualFromAnswer ?? symptom ?? context[0] ?? sentences(req.text)[0] ?? "";
    let cleaned = core.replace(/^(then|and|so|it)\s+/i, "").replace(/^(the|a|an)\s+/i, "").replace(/[.!]+$/, "");
    if (symptom && trailingAction) cleaned = `${cleaned} after ${gerundPhrase(trailingAction).replace(/^opening it again$/i, "reopening")}`;
    if (cleaned) title = truncate(`${moduleName ? `${moduleName}: ` : ""}${capitalize(cleaned)}`, 88);
  }

  const env = req.context.environment ? null : matchByName(text, req.context.environments);
  const browser = BROWSERS.exec(text);
  const os = OSES.exec(text);
  const device = DEVICES.exec(text);
  const version = VERSION.exec(text);
  const url = URL.exec(text);
  const frequency = detectFrequency(text);

  const missing: { field: string; question: string }[] = [];
  const hasSteps = steps.some((s) => s.source === "reporter") || !!f.steps?.length;
  if (!hasSteps) missing.push({ field: "steps", question: "What exactly did you do, step by step, before the problem appeared?" });
  if (!expectedText && !f.expected_result) missing.push({ field: "expected_result", question: "What did you expect to happen instead?" });
  if (!actualSentence && !f.actual_result) missing.push({ field: "actual_result", question: "What happened instead? Include any message shown on screen." });
  if (!req.context.environment && !env) {
    missing.push({
      field: "environment",
      question: `Which environment were you using${req.context.environments.length ? ` (${req.context.environments.map((e) => e.name).join(", ")})` : ""}?`,
    });
  }
  if (!f.browser && !browser && !f.device && !device) missing.push({ field: "browser", question: "Which browser and device were you using?" });
  if ((!f.frequency || f.frequency === "unknown") && !frequency) missing.push({ field: "frequency", question: "Does it happen every time, or only sometimes?" });
  const entity = ENTITY.exec(text)?.[1];
  if (entity && !affectedRecord) missing.push({ field: "affected_record", question: `Which ${entity.toLowerCase()} did you use when this happened (name or ID)?` });

  const description = req.text.trim()
    ? ensurePeriod(normalizeWhitespace(req.text)) + (affectedRecord ? ` Affected ${entity ?? "record"}: ${affectedRecord.trim()}.` : "")
    : null;

  return {
    title: title ? R(title, "ai_wording") : null,
    summary: description ? R(description) : null,
    steps,
    expected_result: expectedText ? R(ensurePeriod(capitalize(expectedText))) : null,
    actual_result: actualSentence ? R(actualSentence) : null,
    module: module ? R(module.name) : null,
    feature: feature ? R(feature.name) : null,
    environment: env ? R(env.name) : null,
    browser: browser ? R(capitalize(browser[0])) : null,
    device: device ? R(capitalize(device[0])) : null,
    os: os ? R(os[0]) : null,
    app_version: version ? R(version[1]) : null,
    page_url: url ? R(url[0]) : null,
    frequency: frequency ? { value: frequency, source: "reporter" } : null,
    severity_suggestion: severityGuess(text, req.context.severities.map((s) => s.key)),
    screenshot_observations: [],
    missing_information: missing.slice(0, 5),
    notes: req.images.length
      ? ["Screenshots are attached as evidence. The offline assistant can't read images, so describe anything important on screen."]
      : [],
  };
}

function summaryOffline(bug: BugDigest): SummaryOutput {
  const last = bug.timeline.slice(-3).map((t) => `${t.who} ${t.what.charAt(0).toLowerCase()}${t.what.slice(1)}`);
  const questions = bug.timeline.filter((t) => /requested more information|asked/i.test(t.what)).slice(-1).map((t) => t.what);
  return {
    summary: `${bug.title}. Reported by ${bug.reporter} in ${bug.module}. ${bug.reopen_count ? `Reopened ${bug.reopen_count} time(s). ` : ""}Recent activity: ${last.join("; ") || "none"}.`,
    current_state: `${bug.status}; waiting on ${bug.waiting_on}.`,
    open_questions: bug.status.toLowerCase().includes("information") ? questions : [],
    next_step: bug.waiting_on === "Nobody" ? "No action needed." : `${bug.waiting_on} should take the next step.`,
  };
}

function checksOffline(bug: BugDigest): RegressionChecksOutput {
  const checks = [
    {
      title: "Re-run the original reproduction",
      steps: [...bug.steps, `Confirm: ${bug.expected_result}`],
      why: "Confirms the reported problem is gone.",
    },
  ];
  if (bug.environment) {
    checks.push({ title: `Check in ${bug.environment}`, steps: [`Repeat the steps in ${bug.environment}`], why: "The bug was reported in this environment." });
  }
  return { checks };
}

function riskOffline(req: ReleaseRiskRequest): ReleaseRiskOutput {
  const ranked = [...req.bugs].sort((a, b) => Number(b.severity === "critical") - Number(a.severity === "critical") || b.reopen_count - a.reopen_count || b.days_open - a.days_open);
  return {
    headline: `${req.facts.open} open bugs, ${req.facts.critical_open} critical, ${req.facts.reopened_open} reopened, ${req.facts.overdue} overdue, ${req.facts.unassigned} unassigned.`,
    risks: ranked.slice(0, 5).map((b) => ({
      bug_key: b.key,
      risk: [b.severity, b.reopen_count ? `reopened ${b.reopen_count}×` : "", b.overdue ? "overdue" : "", b.assignee ? "" : "unassigned"].filter(Boolean).join(", "),
    })),
    recommendation: "Review the critical and reopened bugs first. This summary was produced without AI from the counts above.",
  };
}

export class OfflineProvider implements AiProvider {
  readonly id = "offline" as const;

  status(): AiStatus {
    return { available: true, provider: "offline", label: "Offline assistant (rule-based)", model: null, vision: false };
  }

  async draftReport(req: DraftRequest): Promise<AiResult<DraftModelOutput>> {
    return { output: heuristicDraft(req), meta: { model: null } };
  }

  async summarize(bug: BugDigest): Promise<AiResult<SummaryOutput>> {
    return { output: summaryOffline(bug), meta: { model: null } };
  }

  async regressionChecks(bug: BugDigest): Promise<AiResult<RegressionChecksOutput>> {
    return { output: checksOffline(bug), meta: { model: null } };
  }

  async releaseRisk(req: ReleaseRiskRequest): Promise<AiResult<ReleaseRiskOutput>> {
    return { output: riskOffline(req), meta: { model: null } };
  }
}
