// Report a problem in two steps: say what went wrong (and add screenshots), then check what the
// assistant prepared. Every value shows where it came from and must be verified or edited by the
// analyst; nothing the assistant suggests is submitted unchecked.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, CircleAlert, ImagePlus, MapPin, PenLine, Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
import type { BugDetail, DraftResult, Sourced } from "../../core/api";
import { FREQUENCIES, FREQUENCY_LABELS, type AiMeta, type Box, type DuplicateCheck, type Frequency, type Provenance, type SimilarBug } from "../../core/types";
import { useApi, useToast, useWorkspace } from "../app/context";
import { ApiError } from "../api/client";
import { errorMessage, useMutate } from "../api/hooks";
import { FileDrop } from "../components/Attachments";
import { ProvenanceChip, StatusPill } from "../components/badges";
import { ScreenshotMarker } from "../components/ScreenshotMarker";
import { Dialog, cx, useDebounced } from "../components/ui";
import { shortDate } from "../lib/format";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type Key = "title" | "where" | "location" | "steps" | "expected_result" | "actual_result" | "severity" | "priority" | "environment" | "setup" | "frequency" | "description";

const ORDER: Key[] = ["title", "where", "location", "steps", "actual_result", "expected_result", "severity", "priority", "environment", "setup", "frequency", "description"];

const LABELS: Record<Key, string> = {
  title: "Title",
  where: "Where",
  location: "Location on screen",
  steps: "Steps to reproduce",
  expected_result: "Expected result",
  actual_result: "Actual result",
  severity: "Severity",
  priority: "Priority",
  environment: "Environment",
  setup: "Browser, device & build",
  frequency: "How often",
  description: "Description",
};

interface Report {
  title: string;
  description: string;
  steps: string[];
  expected_result: string;
  actual_result: string;
  module_id: string;
  feature_id: string;
  page_id: string;
  element: string;
  image: number | null;
  box: Box | null;
  severity: string;
  priority: string;
  environment_id: string;
  browser: string;
  device: string;
  os: string;
  app_version: string;
  page_url: string;
  frequency: Frequency;
}

interface Input {
  project_id: string;
  module_id: string;
  page_id: string;
  environment_id: string;
  text: string;
}

const EMPTY_REPORT: Report = {
  title: "",
  description: "",
  steps: [],
  expected_result: "",
  actual_result: "",
  module_id: "",
  feature_id: "",
  page_id: "",
  element: "",
  image: null,
  box: null,
  severity: "",
  priority: "medium",
  environment_id: "",
  browser: "",
  device: "",
  os: "",
  app_version: "",
  page_url: "",
  frequency: "unknown",
};

const EXAMPLE = "Changed a member's role and saved, it said Saved, but when I open the member again the old role is back.";

/** A comparable snapshot of one row's value, to tell whether the analyst changed it. */
function snapshot(r: Report, k: Key): string {
  switch (k) {
    case "where":
      return [r.module_id, r.feature_id, r.page_id].join("|");
    case "location":
      return JSON.stringify([r.element, r.image, r.box]);
    case "steps":
      return r.steps.join("\n");
    case "environment":
      return r.environment_id;
    case "setup":
      return [r.browser, r.device, r.os, r.app_version, r.page_url].join("|");
    default:
      return String(r[k]);
  }
}

function missing(r: Report, k: Key): string | null {
  if (k === "title" && !r.title.trim()) return "Add a title.";
  if (k === "where" && !r.module_id) return "Choose the module.";
  if (k === "steps" && !r.steps.some((s) => s.trim())) return "Add at least one step.";
  if (k === "expected_result" && !r.expected_result.trim()) return "Say what should happen.";
  if (k === "actual_result" && !r.actual_result.trim()) return "Say what actually happens.";
  if (k === "severity" && !r.severity) return "Choose a severity.";
  return null;
}

function storageKey(userId: string) {
  return `bugloop.quick-report.${userId}`;
}
function loadInput(userId: string): Partial<Input> | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as Partial<Input>) : null;
  } catch {
    return null;
  }
}
function saveInput(userId: string, input: Input | null) {
  try {
    if (input) localStorage.setItem(storageKey(userId), JSON.stringify(input));
    else localStorage.removeItem(storageKey(userId));
  } catch {
    // A convenience only.
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ReportBugPage() {
  const { ws } = useWorkspace();
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const defaultProject = ws.projects.find((p) => !p.archived)?.id ?? "";
  const saved = useMemo(() => loadInput(ws.me.id), [ws.me.id]);

  const [step, setStep] = useState<"describe" | "review">("describe");
  const [input, setInput] = useState<Input>({ project_id: saved?.project_id || defaultProject, module_id: saved?.module_id ?? "", page_id: saved?.page_id ?? "", environment_id: saved?.environment_id ?? "", text: saved?.text ?? "" });
  const [shots, setShots] = useState<File[]>([]);
  const [evidence, setEvidence] = useState<File[]>([]);
  const [report, setReport] = useState<Report>(EMPTY_REPORT);
  const [sources, setSources] = useState<Partial<Record<Key, Provenance>>>({});
  const [drafted, setDrafted] = useState<Partial<Record<Key, string>>>({});
  const [verified, setVerified] = useState<Set<Key>>(new Set());
  const [rationale, setRationale] = useState<{ severity?: string; priority?: string }>({});
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answered, setAnswered] = useState<{ question: string; answer: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [dupDialog, setDupDialog] = useState<SimilarBug[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => saveInput(ws.me.id, input), 400);
    return () => window.clearTimeout(t);
  }, [input, ws.me.id]);

  // -------------------------------------------------------------------- assistant
  const reportRef = useRef(report);
  reportRef.current = report;

  /** Merge a draft into the report, keeping every row the analyst has already checked or changed. */
  const applyDraft = (d: DraftResult, chosen: Input) => {
    const cur = reportRef.current;
    const keep = (k: Key) => verified.has(k);
    const next: Report = { ...cur };
    const src: Partial<Record<Key, Provenance>> = { ...sources };
    const set = (k: Key, fn: () => void, source: Provenance | null) => {
      if (keep(k) || !source) return;
      fn();
      src[k] = source;
    };
    const text = (v: Sourced | null) => v?.value ?? "";

    set("title", () => (next.title = text(d.title)), d.title?.source ?? null);
    set("description", () => (next.description = text(d.description)), d.description?.source ?? null);
    set("expected_result", () => (next.expected_result = text(d.expected_result)), d.expected_result?.source ?? null);
    set("actual_result", () => (next.actual_result = text(d.actual_result)), d.actual_result?.source ?? null);
    if (d.steps.length) {
      set("steps", () => (next.steps = d.steps.map((s) => s.value)), d.steps.some((s) => s.source === "ai_inferred") ? "ai_inferred" : d.steps[0].source);
    }
    // Where: the analyst's own choice always wins.
    if (!keep("where")) {
      const userChose = !!(chosen.module_id || chosen.page_id);
      next.module_id = chosen.module_id || d.module_id?.value || cur.module_id;
      next.feature_id = d.feature_id?.value || (next.module_id === cur.module_id ? cur.feature_id : "");
      next.page_id = chosen.page_id || d.page_id?.value || (next.module_id === cur.module_id ? cur.page_id : "");
      if (chosen.page_id) {
        const pg = ws.pages.find((p) => p.id === chosen.page_id);
        if (pg) {
          next.module_id = pg.module_id;
          next.feature_id = pg.feature_id ?? "";
        }
      }
      const s = userChose && !d.page_id?.value ? "reporter" : d.page_id?.source ?? d.module_id?.source ?? (userChose ? "reporter" : null);
      if (next.module_id && s) src.where = userChose && chosen.page_id ? "reporter" : s;
    }
    if (d.location) {
      set(
        "location",
        () => {
          next.element = d.location!.element ?? "";
          next.image = d.location!.image;
          next.box = d.location!.box;
        },
        d.location.source,
      );
    }
    if (d.severity_suggestion) {
      set("severity", () => (next.severity = d.severity_suggestion!.key), "ai_inferred");
    }
    if (d.priority_suggestion) {
      set("priority", () => (next.priority = d.priority_suggestion!.key), "ai_inferred");
    }
    if (chosen.environment_id && !keep("environment")) {
      next.environment_id = chosen.environment_id;
      src.environment = "reporter";
    } else if (d.environment_id) set("environment", () => (next.environment_id = d.environment_id!.value), d.environment_id.source);
    const setupParts = [d.browser, d.device, d.os, d.app_version, d.page_url].filter((x): x is Sourced => !!x);
    if (setupParts.length) {
      set(
        "setup",
        () => {
          next.browser = text(d.browser) || cur.browser;
          next.device = text(d.device) || cur.device;
          next.os = text(d.os) || cur.os;
          next.app_version = text(d.app_version) || cur.app_version;
          next.page_url = text(d.page_url) || cur.page_url;
        },
        setupParts.find((x) => x.source !== "reporter")?.source ?? "reporter",
      );
    }
    if (d.frequency) set("frequency", () => (next.frequency = d.frequency!.value), d.frequency.source);

    setReport(next);
    setSources(src);
    setRationale({ severity: d.severity_suggestion?.rationale, priority: d.priority_suggestion?.rationale });
    // What the assistant produced, to tell edits apart later.
    const snap: Partial<Record<Key, string>> = { ...drafted };
    for (const k of ORDER) if (src[k] && !keep(k)) snap[k] = snapshot(next, k);
    setDrafted(snap);
    // Facts the analyst gave count as checked; anything the assistant wrote waits for a tick.
    setVerified((v) => {
      const n = new Set(v);
      for (const k of ORDER) if (src[k] === "reporter" && !n.has(k)) n.add(k);
      return n;
    });
  };

  const runDraft = async (offline = false, qa: { question: string; answer: string }[] = []) => {
    setBusy(true);
    setAiError(null);
    const r = reportRef.current;
    const checked = (k: Key) => verified.has(k);
    try {
      const result = await api.postWithFiles<DraftResult>(
        "/ai/draft",
        {
          text: input.text,
          project_id: input.project_id || null,
          module_id: (checked("where") ? r.module_id : input.module_id) || null,
          feature_id: checked("where") ? r.feature_id || null : null,
          page_id: (checked("where") ? r.page_id : input.page_id) || null,
          environment_id: (checked("environment") ? r.environment_id : input.environment_id) || null,
          answers: [...answered, ...qa],
          offline,
          fields: {
            title: checked("title") ? r.title : undefined,
            expected_result: checked("expected_result") ? r.expected_result : undefined,
            actual_result: checked("actual_result") ? r.actual_result : undefined,
            steps: checked("steps") ? r.steps : undefined,
            severity: checked("severity") ? r.severity : undefined,
            browser: r.browser || undefined,
            device: r.device || undefined,
            os: r.os || undefined,
            app_version: r.app_version || undefined,
            page_url: r.page_url || undefined,
            frequency: r.frequency !== "unknown" ? r.frequency : undefined,
          },
        },
        shots,
      );
      setDraft(result);
      applyDraft(result, input);
      if (qa.length) setAnswered((a) => [...a, ...qa]);
      setAnswers({});
      setStep("review");
    } catch (err) {
      setAiError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startManual = () => {
    const pg = ws.pages.find((p) => p.id === input.page_id);
    setReport({
      ...EMPTY_REPORT,
      module_id: pg?.module_id ?? input.module_id,
      feature_id: pg?.feature_id ?? "",
      page_id: input.page_id,
      environment_id: input.environment_id,
      actual_result: input.text,
    });
    setSources({});
    setDrafted({});
    setDraft(null);
    setVerified(new Set(ORDER));
    setStep("review");
  };

  // -------------------------------------------------------------------- similar bugs
  const simKey = useDebounced(
    JSON.stringify({
      project_id: input.project_id,
      module_id: report.module_id || input.module_id,
      feature_id: report.feature_id,
      title: report.title || input.text.slice(0, 160),
      description: report.description || input.text,
      actual_result: report.actual_result,
      steps: report.steps.filter(Boolean),
    }),
    500,
  );
  const simInput = useMemo(() => JSON.parse(simKey) as { title: string; description: string }, [simKey]);
  const similar = useQuery({
    queryKey: ["similar-live", simInput],
    queryFn: () => api.post<{ items: SimilarBug[] }>("/similar", simInput),
    enabled: (simInput.title + simInput.description).trim().length >= 12,
    staleTime: 30_000,
  });
  const matches = similar.data?.items ?? [];
  const strong = matches.filter((m) => m.level !== "low");

  // -------------------------------------------------------------------- submit
  const create = useMutate(
    (a, args: { payload: Record<string, unknown>; files: File[] }) => a.postWithFiles<BugDetail>("/bugs", args.payload, args.files),
    { success: (r) => `Reported ${r.bug.key}` },
  );
  const problems = ORDER.map((k) => [k, missing(report, k)] as const).filter(([, m]) => !!m);
  const unverified = ORDER.filter((k) => sources[k] && !verified.has(k));

  const aiMeta = (confirmedAll: boolean): AiMeta | null => {
    if (!draft) return null;
    const keys = ORDER.filter((k) => drafted[k] !== undefined);
    const confirmed = confirmedAll ? keys : keys.filter((k) => verified.has(k));
    return {
      provider: draft.provider,
      model: draft.model,
      drafted_fields: keys,
      provenance: Object.fromEntries(keys.map((k) => [k, sources[k] ?? "ai_wording"])),
      edited_fields: keys.filter((k) => snapshot(report, k) !== drafted[k]),
      confirmed_fields: confirmed,
      screenshot_observations: draft.screenshot_observations,
      drafted_at: new Date().toISOString(),
    };
  };

  const submit = (decision: DuplicateCheck["decision"], candidates: SimilarBug[]) => {
    const steps = report.steps.map((s) => s.trim()).filter(Boolean);
    const payload = {
      project_id: input.project_id,
      module_id: report.module_id,
      feature_id: report.feature_id || null,
      page_id: report.page_id || null,
      location: report.element || report.box ? { element: report.element || null, image: report.box ? report.image : null, box: report.box, source: sources.location ?? "reporter" } : null,
      title: report.title.trim(),
      description: report.description || input.text,
      steps,
      expected_result: report.expected_result,
      actual_result: report.actual_result,
      environment_id: report.environment_id || null,
      browser: report.browser || null,
      device: report.device || null,
      os: report.os || null,
      app_version: report.app_version || null,
      page_url: report.page_url || null,
      frequency: report.frequency,
      severity: report.severity,
      priority: report.priority,
      ai_meta: aiMeta(true),
      duplicate_check: {
        checked_at: new Date().toISOString(),
        decision,
        note: null,
        candidates: candidates.map((c) => ({ bug_id: c.bug.id, key: c.bug.key, score: c.score, level: c.level })),
      },
    };
    create.mutate(
      { payload, files: [...shots, ...evidence] },
      {
        onSuccess: (res) => {
          saveInput(ws.me.id, null);
          navigate(`/bugs/${res.bug.key}`);
        },
      },
    );
  };

  const onSubmit = () => {
    if (problems.length) {
      toast(`Still needed: ${problems.map(([k]) => LABELS[k].toLowerCase()).join(", ")}.`, "error");
      return;
    }
    setVerified(new Set(ORDER));
    if (strong.length) setDupDialog(strong);
    else submit("none_found", []);
  };

  const reset = () => {
    saveInput(ws.me.id, null);
    setInput({ project_id: defaultProject, module_id: "", page_id: "", environment_id: "", text: "" });
    setShots([]);
    setEvidence([]);
    setReport(EMPTY_REPORT);
    setSources({});
    setDrafted({});
    setVerified(new Set());
    setDraft(null);
    setAnswered([]);
    setStep("describe");
  };

  return (
    <div className="quick-report">
      <div className="page-head">
        <div>
          <h1>Report a problem</h1>
          <p className="sub">Say what went wrong and add a screenshot. The assistant prepares the report; you check every value before it's sent.</p>
        </div>
        <ol className="stepper" aria-label="Progress">
          <li className={cx(step === "describe" && "on", step === "review" && "done")}>
            <span>{step === "review" ? <Check size={13} /> : 1}</span> Describe
          </li>
          <li className={cx(step === "review" && "on")}>
            <span>2</span> Check &amp; submit
          </li>
        </ol>
      </div>

      {step === "describe" ? (
        <DescribeStep
          input={input}
          setInput={setInput}
          shots={shots}
          setShots={setShots}
          busy={busy}
          aiError={aiError}
          onDraft={(offline) => runDraft(offline)}
          onManual={startManual}
          matches={matches}
          onPreview={setPreview}
        />
      ) : (
        <div className="review-grid">
          <div className="stack-lg" style={{ minWidth: 0 }}>
            {draft && (draft.missing_information.length > 0 || draft.notes.length > 0 || draft.removed_by_guardrail.length > 0) && (
              <Questions draft={draft} answers={answers} setAnswers={setAnswers} busy={busy} onUpdate={(qa) => runDraft(draft.provider === "offline", qa)} />
            )}
            <section className="panel review">
              <div className="panel-head">
                <h2>Check the report</h2>
                <div className="row-wrap">
                  <span className="small muted">
                    {ORDER.filter((k) => !sources[k] || verified.has(k)).length} of {ORDER.length} checked
                  </span>
                  {unverified.length > 0 && (
                    <button className="btn btn-sm" onClick={() => setVerified(new Set(ORDER))}>
                      <Check /> Verify all
                    </button>
                  )}
                </div>
              </div>
              <div className="panel-body flush">
                <ReviewRows
                  report={report}
                  setReport={setReport}
                  sources={sources}
                  verified={verified}
                  setVerified={setVerified}
                  rationale={rationale}
                  offline={draft?.provider === "offline"}
                  vision={!!draft && draft.images_analyzed > 0}
                  projectId={input.project_id}
                  shots={shots}
                />
              </div>
            </section>
            <section className="panel">
              <div className="panel-body stack-sm">
                <span className="field-label">Evidence</span>
                {shots.length > 0 && <p className="small muted">{shots.length} screenshot{shots.length === 1 ? "" : "s"} from the first step will be attached.</p>}
                <FileDrop files={evidence} onChange={setEvidence} compact label="Add recordings, logs or more screenshots" />
              </div>
            </section>
            <div className="submit-bar">
              <div className="row-wrap" style={{ gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setStep("describe")}>
                  <ArrowLeft /> Back
                </button>
                <button className="btn btn-ghost btn-sm" onClick={reset}>
                  <Trash2 /> Discard
                </button>
                <span className="small muted">
                  {problems.length
                    ? `Still needed: ${problems.map(([k]) => LABELS[k].toLowerCase()).join(", ")}`
                    : unverified.length
                      ? `${unverified.length} value${unverified.length === 1 ? "" : "s"} from the assistant not yet checked`
                      : "Everything is checked."}
                </span>
              </div>
              <button className="btn btn-primary btn-lg" onClick={onSubmit} disabled={create.isPending || problems.length > 0}>
                {create.isPending && <span className="spinner" />}
                {unverified.length ? `Confirm ${unverified.length} and submit` : "Submit report"}
              </button>
            </div>
          </div>
          <aside className="report-rail">
            <SimilarList matches={matches} fetching={similar.isFetching} onPreview={setPreview} />
          </aside>
        </div>
      )}

      {dupDialog && (
        <DuplicateDialog
          candidates={dupDialog}
          onClose={() => setDupDialog(null)}
          onView={(key) => setPreview(key)}
          onSubmitAnyway={() => {
            setDupDialog(null);
            submit("submitted_anyway", dupDialog);
          }}
          onAddToExisting={async (key) => {
            try {
              await api.postWithFiles(`/bugs/${key}/also-seen`, { note: [input.text, report.actual_result].filter(Boolean).join("\n\n") }, [...shots, ...evidence]);
              saveInput(ws.me.id, null);
              toast(`Added your evidence to ${key}. You're credited as a co-reporter.`);
              navigate(`/bugs/${key}`);
            } catch (e) {
              toast(e instanceof ApiError ? e.message : errorMessage(e), "error");
            }
          }}
          busy={create.isPending}
        />
      )}
      {preview && <BugPreview bugKey={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: describe
// ---------------------------------------------------------------------------

function DescribeStep({
  input,
  setInput,
  shots,
  setShots,
  busy,
  aiError,
  onDraft,
  onManual,
  matches,
  onPreview,
}: {
  input: Input;
  setInput: (i: Input) => void;
  shots: File[];
  setShots: (f: File[]) => void;
  busy: boolean;
  aiError: string | null;
  onDraft: (offline: boolean) => void;
  onManual: () => void;
  matches: SimilarBug[];
  onPreview: (key: string) => void;
}) {
  const { ws, lookup } = useWorkspace();
  const modules = lookup.modulesOf(input.project_id);
  const pages = ws.pages.filter((p) => p.project_id === input.project_id && !p.archived && (!input.module_id || p.module_id === input.module_id));
  const canDraft = input.text.trim().length > 0 || shots.length > 0;
  const set = (patch: Partial<Input>) => setInput({ ...input, ...patch });
  return (
    <div className="review-grid">
      <section className="panel describe">
        <div className="panel-body stack-lg">
          <div className="where-row">
            <label className="field">
              <span className="field-label">Project</span>
              <select className="select" value={input.project_id} onChange={(e) => set({ project_id: e.target.value, module_id: "", page_id: "" })}>
                {ws.projects
                  .filter((p) => !p.archived)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Module</span>
              <select className="select" aria-label="Module" value={input.module_id} onChange={(e) => set({ module_id: e.target.value, page_id: "" })}>
                <option value="">Let the assistant work it out</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Page</span>
              <select className="select" aria-label="Page" value={input.page_id} onChange={(e) => set({ page_id: e.target.value })} disabled={!pages.length}>
                <option value="">{pages.length ? "Let the assistant work it out" : "No pages in the product map"}</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {input.module_id ? p.name : `${lookup.module(p.module_id)?.name} › ${p.name}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span className="field-label">What went wrong?</span>
            <textarea
              className="textarea big"
              rows={4}
              value={input.text}
              placeholder={EXAMPLE}
              aria-label="What went wrong?"
              onChange={(e) => set({ text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canDraft) onDraft(false);
              }}
            />
            <span className="help">
              A sentence or two is enough: what you did and what happened.{" "}
              {!input.text && (
                <button type="button" className="link-btn small" onClick={() => set({ text: EXAMPLE })}>
                  Try the example
                </button>
              )}
            </span>
          </label>

          <FileDrop
            files={shots}
            onChange={setShots}
            imagesOnly
            pasteTarget="document"
            label="Add a screenshot (or paste one)"
            hint={ws.ai.vision ? "The assistant reads it to find the page and mark where the problem is." : "Attached as evidence. You can mark the problem area on it in the next step."}
          />

          <div className="field">
            <span className="field-label">Environment (optional)</span>
            <div className="row-wrap" role="radiogroup" aria-label="Environment">
              {ws.environments
                .filter((e) => e.active)
                .map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={input.environment_id === e.id}
                    className={cx("chip choice", input.environment_id === e.id && "accent")}
                    onClick={() => set({ environment_id: input.environment_id === e.id ? "" : e.id })}
                  >
                    {input.environment_id === e.id && <Check />} {e.name}
                  </button>
                ))}
            </div>
          </div>

          {aiError && (
            <div className="callout danger">
              <CircleAlert />
              <div className="grow">
                <div className="title">The assistant couldn't prepare the report</div>
                <div>{aiError}</div>
                <div className="row-wrap" style={{ marginTop: 8 }}>
                  {ws.ai.provider !== "offline" && (
                    <button className="btn btn-sm" onClick={() => onDraft(true)}>
                      Use the offline assistant
                    </button>
                  )}
                  <button className="btn btn-sm btn-ghost" onClick={onManual}>
                    Fill it in myself
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="row-between" style={{ flexWrap: "wrap" }}>
            <button type="button" className="link-btn small" onClick={onManual}>
              <PenLine size={13} style={{ verticalAlign: "-2px" }} /> Fill it in myself
            </button>
            <button className="btn btn-accent btn-lg" onClick={() => onDraft(false)} disabled={busy || !canDraft}>
              {busy ? <span className="spinner" /> : <Wand2 />}
              {busy ? (ws.ai.provider === "offline" ? "Preparing…" : "Claude is reading…") : "Prepare report"}
            </button>
          </div>
          <p className="tiny muted">
            <Sparkles size={12} style={{ verticalAlign: "-2px" }} /> {ws.ai.label}. It uses only what you wrote, what's visible in your screenshots and your product map, and asks when something is missing.
          </p>
        </div>
      </section>
      <aside className="report-rail">
        <SimilarList matches={matches} fetching={false} onPreview={onPreview} />
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: review rows
// ---------------------------------------------------------------------------

function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

function ReviewRows({
  report,
  setReport,
  sources,
  verified,
  setVerified,
  rationale,
  offline,
  vision,
  projectId,
  shots,
}: {
  report: Report;
  setReport: (r: Report) => void;
  sources: Partial<Record<Key, Provenance>>;
  verified: Set<Key>;
  setVerified: (fn: (v: Set<Key>) => Set<Key>) => void;
  rationale: { severity?: string; priority?: string };
  offline: boolean;
  vision: boolean;
  projectId: string;
  shots: File[];
}) {
  const { ws, lookup } = useWorkspace();
  const [editing, setEditing] = useState<Key | null>(() => ORDER.find((k) => missing(report, k)) ?? null);
  const set = (patch: Partial<Report>) => setReport({ ...report, ...patch });
  const verify = (k: Key, on = true) =>
    setVerified((v) => {
      const n = new Set(v);
      if (on) n.add(k);
      else n.delete(k);
      return n;
    });
  const finish = (k: Key) => {
    verify(k);
    setEditing(null);
  };

  const mod = lookup.module(report.module_id);
  const feat = lookup.feature(report.feature_id);
  const page = ws.pages.find((p) => p.id === report.page_id) ?? null;
  const modules = lookup.modulesOf(projectId);
  const features = lookup.featuresOf(report.module_id);
  const pages = ws.pages.filter((p) => p.project_id === projectId && !p.archived && p.module_id === report.module_id);
  const shotFile = report.image && shots[report.image - 1] ? shots[report.image - 1] : shots[0] ?? null;
  const shotUrl = useObjectUrl(shotFile);
  const sev = lookup.severity(report.severity);
  const pri = lookup.priority(report.priority);
  const env = lookup.environment(report.environment_id);
  const setup = [report.browser, report.device, report.os, report.app_version && `build ${report.app_version}`].filter(Boolean).join(" · ");

  const display: Record<Key, React.ReactNode> = {
    title: report.title ? <strong>{report.title}</strong> : null,
    where: mod ? (
      <span className="stack-sm" style={{ gap: 2 }}>
        <span>
          {lookup.project(projectId)?.name} › {mod.name}
          {feat ? ` › ${feat.name}` : ""}
        </span>
        {page && (
          <span className="small secondary">
            <MapPin size={12} style={{ verticalAlign: "-1px" }} /> {page.name}
            {page.path && <span className="mono muted"> {page.path}</span>}
          </span>
        )}
      </span>
    ) : null,
    location:
      report.element || report.box ? (
        <span className="stack-sm">
          {report.element && <span>{report.element}</span>}
          {report.box && shotUrl && <ScreenshotMarker src={shotUrl} alt="Screenshot with the problem area marked" box={report.box} label={report.element || "Problem"} />}
        </span>
      ) : shots.length ? (
        <span className="small muted">Not marked yet. Edit to draw a box on your screenshot.</span>
      ) : null,
    steps: report.steps.some((s) => s.trim()) ? (
      <ol className="steps compact">
        {report.steps.filter((s) => s.trim()).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    ) : null,
    expected_result: report.expected_result || null,
    actual_result: report.actual_result || null,
    severity: sev ? (
      <span className="stack-sm" style={{ gap: 2 }}>
        <span>{sev.label}</span>
        {rationale.severity && sources.severity && <span className="small muted">{rationale.severity}</span>}
      </span>
    ) : null,
    priority: pri ? (
      <span className="stack-sm" style={{ gap: 2 }}>
        <span>{pri.label}</span>
        {rationale.priority && sources.priority && <span className="small muted">{rationale.priority}</span>}
      </span>
    ) : null,
    environment: env?.name ?? null,
    setup: setup || null,
    frequency: report.frequency !== "unknown" ? FREQUENCY_LABELS[report.frequency] : null,
    description: report.description || null,
  };

  const editor = (k: Key) => {
    switch (k) {
      case "title":
        return <input className="input" autoFocus value={report.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} aria-label="Title" />;
      case "where":
        return (
          <div className="grid-3">
            <select className="select" aria-label="Module" value={report.module_id} onChange={(e) => set({ module_id: e.target.value, feature_id: "", page_id: "" })}>
              <option value="">Choose module…</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select className="select" aria-label="Feature" value={report.feature_id} onChange={(e) => set({ feature_id: e.target.value })} disabled={!features.length}>
              <option value="">{features.length ? "Feature: not specified" : "No features"}</option>
              {features.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label="Page"
              value={report.page_id}
              onChange={(e) => {
                const pg = ws.pages.find((p) => p.id === e.target.value);
                set({ page_id: e.target.value, feature_id: pg?.feature_id ?? report.feature_id });
              }}
              disabled={!pages.length}
            >
              <option value="">{pages.length ? "Page: not specified" : "No pages mapped"}</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        );
      case "location":
        return (
          <div className="stack-sm">
            <input
              className="input"
              list="page-elements"
              placeholder="Which part of the screen? e.g. Role dropdown"
              value={report.element}
              onChange={(e) => set({ element: e.target.value })}
              aria-label="Element"
            />
            <datalist id="page-elements">
              {(page?.elements ?? []).map((el) => (
                <option key={el} value={el} />
              ))}
            </datalist>
            {shots.length > 1 && (
              <div className="row-wrap">
                {shots.map((f, i) => (
                  <button key={i} type="button" className={cx("chip choice", (report.image ?? 1) === i + 1 && "accent")} onClick={() => set({ image: i + 1, box: (report.image ?? 1) === i + 1 ? report.box : null })}>
                    Screenshot {i + 1}
                  </button>
                ))}
              </div>
            )}
            {shotUrl ? (
              <ScreenshotMarker src={shotUrl} alt="Screenshot" box={report.box} label={report.element || null} onChange={(box) => set({ box, image: box ? report.image ?? 1 : null })} />
            ) : (
              <p className="small muted">
                <ImagePlus size={13} style={{ verticalAlign: "-2px" }} /> Add a screenshot in the first step to mark the spot.
              </p>
            )}
          </div>
        );
      case "steps":
        return <StepsEditor steps={report.steps.length ? report.steps : [""]} onChange={(steps) => set({ steps })} />;
      case "expected_result":
      case "actual_result":
      case "description":
        return <textarea className="textarea" autoFocus rows={3} value={report[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<Report>)} aria-label={LABELS[k]} />;
      case "severity":
        return (
          <div className="row-wrap" role="radiogroup" aria-label="Severity">
            {ws.severities
              .filter((s) => s.active)
              .map((s) => (
                <button key={s.key} type="button" role="radio" aria-checked={report.severity === s.key} title={s.description ?? undefined} className={cx("chip choice", report.severity === s.key && "accent")} onClick={() => set({ severity: s.key })}>
                  {s.label}
                </button>
              ))}
          </div>
        );
      case "priority":
        return (
          <div className="row-wrap" role="radiogroup" aria-label="Priority">
            {ws.priorities
              .filter((s) => s.active)
              .map((s) => (
                <button key={s.key} type="button" role="radio" aria-checked={report.priority === s.key} title={s.description ?? undefined} className={cx("chip choice", report.priority === s.key && "accent")} onClick={() => set({ priority: s.key })}>
                  {s.label}
                </button>
              ))}
          </div>
        );
      case "environment":
        return (
          <div className="row-wrap" role="radiogroup" aria-label="Environment">
            {ws.environments
              .filter((e) => e.active)
              .map((e) => (
                <button key={e.id} type="button" role="radio" aria-checked={report.environment_id === e.id} className={cx("chip choice", report.environment_id === e.id && "accent")} onClick={() => set({ environment_id: report.environment_id === e.id ? "" : e.id })}>
                  {e.name}
                </button>
              ))}
          </div>
        );
      case "setup":
        return (
          <div className="grid-2">
            <input className="input" placeholder="Browser, e.g. Chrome 128" value={report.browser} onChange={(e) => set({ browser: e.target.value })} aria-label="Browser" />
            <input className="input" placeholder="Device, e.g. iPhone 15" value={report.device} onChange={(e) => set({ device: e.target.value })} aria-label="Device" />
            <input className="input" placeholder="Operating system" value={report.os} onChange={(e) => set({ os: e.target.value })} aria-label="Operating system" />
            <input className="input" placeholder="App version or build" value={report.app_version} onChange={(e) => set({ app_version: e.target.value })} aria-label="App version" />
            <input className="input" style={{ gridColumn: "1 / -1" }} placeholder="Page URL" value={report.page_url} onChange={(e) => set({ page_url: e.target.value })} aria-label="Page URL" />
          </div>
        );
      case "frequency":
        return (
          <select className="select" value={report.frequency} onChange={(e) => set({ frequency: e.target.value as Frequency })} aria-label="How often">
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        );
    }
  };

  return (
    <div className="review-rows">
      {ORDER.map((k) => {
        const src = sources[k];
        const isVerified = !src || verified.has(k);
        const need = missing(report, k);
        const open = editing === k;
        const optional = !["title", "where", "steps", "expected_result", "actual_result", "severity"].includes(k);
        return (
          <div key={k} className={cx("review-row", open && "editing", need && "needs", src && !isVerified && "unverified")} data-field={k}>
            <div className="review-label">
              <span>{LABELS[k]}</span>
              {optional && <span className="tiny muted">optional</span>}
            </div>
            <div className="review-value">
              {open ? (
                <div className="stack-sm">
                  {editor(k)}
                  <div className="row">
                    <button className="btn btn-sm btn-primary" onClick={() => finish(k)} disabled={!!need && !optional}>
                      Done
                    </button>
                    {need && <span className="small danger-text">{need}</span>}
                  </div>
                </div>
              ) : display[k] ? (
                <div className="value" onDoubleClick={() => setEditing(k)}>
                  {display[k]}
                </div>
              ) : (
                <button className={cx("link-btn small", need && "danger-text")} onClick={() => setEditing(k)}>
                  {need ?? "Add"}
                </button>
              )}
            </div>
            <div className="review-meta">
              {src && <ProvenanceChip source={src} offline={offline} label={src === "ai_inferred" ? (isVerified ? "AI-inferred, checked" : "AI-inferred") : undefined} />}
              {k === "location" && src && !report.box && shots.length > 0 && !vision && <span className="tiny muted">Mark it on the screenshot</span>}
            </div>
            <div className="review-actions">
              {!open && (
                <button className="icon-btn" onClick={() => setEditing(k)} aria-label={`Edit ${LABELS[k]}`} title="Edit">
                  <PenLine size={15} />
                </button>
              )}
              {src && !open && (
                <button
                  className={cx("verify-btn", isVerified && "on")}
                  onClick={() => verify(k, !isVerified)}
                  aria-pressed={isVerified}
                  aria-label={isVerified ? `${LABELS[k]} checked` : `Verify ${LABELS[k]}`}
                  title={isVerified ? "Checked. Click to uncheck." : "Looks right"}
                  disabled={!!need}
                >
                  <Check size={14} /> {isVerified ? "Checked" : "Verify"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepsEditor({ steps, onChange }: { steps: string[]; onChange: (s: string[]) => void }) {
  return (
    <div className="stack-sm">
      <ol className="steps-editor">
        {steps.map((s, i) => (
          <li key={i}>
            <span className="step-no">{i + 1}</span>
            <input
              className="input"
              value={s}
              autoFocus={i === steps.length - 1 && !s}
              aria-label={`Step ${i + 1}`}
              placeholder={i === 0 ? "Open Members › Edit member" : "Next action…"}
              onChange={(e) => onChange(steps.map((x, j) => (j === i ? e.target.value : x)))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onChange([...steps.slice(0, i + 1), "", ...steps.slice(i + 1)]);
                }
              }}
            />
            <button type="button" className="icon-btn" aria-label={`Remove step ${i + 1}`} onClick={() => onChange(steps.length > 1 ? steps.filter((_, j) => j !== i) : [""])}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...steps, ""])}>
        <Plus /> Add step
      </button>
    </div>
  );
}

function Questions({
  draft,
  answers,
  setAnswers,
  busy,
  onUpdate,
}: {
  draft: DraftResult;
  answers: Record<string, string>;
  setAnswers: (a: Record<string, string>) => void;
  busy: boolean;
  onUpdate: (qa: { question: string; answer: string }[]) => void;
}) {
  const qa = draft.missing_information.map((m) => ({ question: m.question, answer: answers[m.field] ?? "" })).filter((a) => a.answer.trim());
  return (
    <section className="callout info questions-callout">
      <Sparkles />
      <div className="grow stack-sm">
        {draft.missing_information.length > 0 && (
          <>
            <div className="title">The assistant needs a little more to make this sharper</div>
            {draft.missing_information.map((m) => (
              <div key={m.field} className="question">
                <label htmlFor={`q-${m.field}`}>{m.question}</label>
                <input id={`q-${m.field}`} className="input input-sm" value={answers[m.field] ?? ""} onChange={(e) => setAnswers({ ...answers, [m.field]: e.target.value })} />
              </div>
            ))}
            <div className="row-wrap">
              <button className="btn btn-sm btn-accent" onClick={() => onUpdate(qa)} disabled={busy || !qa.length}>
                {busy ? <span className="spinner" /> : <Wand2 />} Update report
              </button>
              <span className="tiny muted">Optional. Checked rows are kept as they are.</span>
            </div>
          </>
        )}
        {draft.removed_by_guardrail.length > 0 && (
          <p className="tiny muted">Left out because nothing you gave supports it: {draft.removed_by_guardrail.map((r) => `${r.field.replace(/_/g, " ")} “${r.value}”`).join(", ")}.</p>
        )}
        {draft.notes.map((n) => (
          <p key={n} className="tiny muted">
            {n}
          </p>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Duplicates
// ---------------------------------------------------------------------------

function resolvedNote(m: SimilarBug): string {
  if (m.bug.status === "not_a_bug") return "marked Not a Bug; check the reason before reporting again";
  if (m.bug.status === "duplicate") return "closed as a duplicate";
  return `closed${m.bug.closed_at ? ` ${shortDate(m.bug.closed_at)}` : ""}; if it's back, this may be a regression`;
}

function SimilarList({ matches, fetching, onPreview }: { matches: SimilarBug[]; fetching: boolean; onPreview: (key: string) => void }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Possible duplicates</h2>
        {fetching && <span className="spinner" />}
      </div>
      <div className="panel-body">
        {!matches.length ? (
          <p className="small muted">Similar bugs appear here as you describe the problem.</p>
        ) : (
          <div className="stack-sm">
            {matches.map((m) => (
              <button key={m.bug.id} className="similar-row as-button" onClick={() => onPreview(m.bug.key)}>
                <span className={`sim-level ${m.level}`}>{m.level}</span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="row-wrap" style={{ gap: 4 }}>
                    <span className="mono tiny muted nowrap">{m.bug.key}</span>
                    <StatusPill status={m.bug.status} size="sm" />
                  </span>
                  <span className="small" style={{ display: "block" }}>
                    {m.bug.title}
                  </span>
                  <span className="tiny muted">
                    Shared: {m.shared_terms.slice(0, 4).join(", ")}
                    {m.same_module ? " · same module" : ""}
                    {m.closed ? ` · ${resolvedNote(m)}` : ""}
                  </span>
                </span>
              </button>
            ))}
            <p className="tiny muted">Suggestions only. You decide whether it's the same problem.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function DuplicateDialog({
  candidates,
  onClose,
  onView,
  onSubmitAnyway,
  onAddToExisting,
  busy,
}: {
  candidates: SimilarBug[];
  onClose: () => void;
  onView: (key: string) => void;
  onSubmitAnyway: () => void;
  onAddToExisting: (key: string) => void;
  busy: boolean;
}) {
  return (
    <Dialog
      title="Possible duplicate bugs"
      description="These existing bugs look similar. Check whether one of them is the same problem. Bugloop never rejects a report on its own."
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Keep editing
          </button>
          <button className="btn btn-primary" onClick={onSubmitAnyway} disabled={busy}>
            It's a different problem. Submit
          </button>
        </>
      }
    >
      <div className="stack-sm">
        {candidates.map((c) => (
          <div key={c.bug.id} className="dup-candidate">
            <span className="row-wrap" style={{ gap: 8 }}>
              <span className={`sim-level ${c.level}`}>Similarity: {c.level}</span>
              <span className="mono small">{c.bug.key}</span>
              <StatusPill status={c.bug.status} size="sm" />
            </span>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{c.bug.title}</div>
            <div className="tiny muted">
              Shared: {c.shared_terms.join(", ")}
              {c.same_module ? " · same module" : ""}
              {c.closed ? ` · ${resolvedNote(c)}` : ""}
            </div>
            <div className="row-wrap" style={{ marginTop: 8 }}>
              <button className="btn btn-sm" onClick={() => onView(c.bug.key)}>
                View existing bug
              </button>
              {!c.closed && (
                <button className="btn btn-sm" onClick={() => onAddToExisting(c.bug.key)}>
                  Add my evidence to {c.bug.key} instead
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="small muted">If you submit anyway, your decision is recorded on the report so triage knows you checked.</p>
    </Dialog>
  );
}

function BugPreview({ bugKey, onClose }: { bugKey: string; onClose: () => void }) {
  const api = useApi();
  const { lookup } = useWorkspace();
  const q = useQuery({ queryKey: ["bug", bugKey], queryFn: () => api.get<BugDetail>(`/bugs/${bugKey}`) });
  const b = q.data?.bug;
  return (
    <Dialog
      title={b ? `${b.key} · ${b.title}` : bugKey}
      onClose={onClose}
      wide
      footer={
        <>
          <Link className="btn" to={`/bugs/${bugKey}`}>
            Open bug
          </Link>
          <button className="btn btn-primary" onClick={onClose}>
            Back to my report
          </button>
        </>
      }
    >
      {!b ? (
        <span className="spinner" />
      ) : (
        <div className="stack">
          <div className="row-wrap">
            <StatusPill status={b.status} />
            <span className="small muted">
              {lookup.module(b.module_id)?.name} · reported by {lookup.userName(b.reporter_id)} on {shortDate(b.created_at)}
            </span>
          </div>
          <ol className="steps">
            {b.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div className="expect-actual">
            <div className="ea expected">
              <span className="eyebrow">Expected</span>
              <p>{b.expected_result}</p>
            </div>
            <div className="ea actual">
              <span className="eyebrow">Actual</span>
              <p>{b.actual_result}</p>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
