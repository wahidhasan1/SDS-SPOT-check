import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowDown, ArrowUp, Bot, Camera, Check, ChevronDown, ChevronRight, CircleAlert, ListChecks, Plus, ShieldCheck, Sparkles, Trash2, Wand2, X } from "lucide-react";
import type { BugDetail, DraftResult, Sourced } from "../../core/api";
import { FREQUENCIES, FREQUENCY_LABELS, type AiMeta, type DuplicateCheck, type Frequency, type Provenance, type SimilarBug } from "../../core/types";
import { useApi, useToast, useWorkspace } from "../app/context";
import { ApiError } from "../api/client";
import { errorMessage, useMutate } from "../api/hooks";
import { FileDrop } from "../components/Attachments";
import { ProvenanceChip, StatusPill } from "../components/badges";
import { Dialog, Field, cx, useDebounced } from "../components/ui";
import { shortDate } from "../lib/format";
import { useQuery } from "@tanstack/react-query";

type TextField =
  | "title"
  | "description"
  | "expected_result"
  | "actual_result"
  | "browser"
  | "device"
  | "os"
  | "app_version"
  | "page_url"
  | "notes"
  | "tags";

interface FormState {
  project_id: string;
  module_id: string;
  feature_id: string;
  affected_module_ids: string[];
  environment_id: string;
  severity: string;
  priority: string;
  frequency: Frequency;
  steps: string[];
  title: string;
  description: string;
  expected_result: string;
  actual_result: string;
  browser: string;
  device: string;
  os: string;
  app_version: string;
  page_url: string;
  notes: string;
  tags: string;
}

const EMPTY: FormState = {
  project_id: "",
  module_id: "",
  feature_id: "",
  affected_module_ids: [],
  environment_id: "",
  severity: "",
  priority: "medium",
  frequency: "unknown",
  steps: [""],
  title: "",
  description: "",
  expected_result: "",
  actual_result: "",
  browser: "",
  device: "",
  os: "",
  app_version: "",
  page_url: "",
  notes: "",
  tags: "",
};

const EXAMPLE =
  "I found a problem in the member settings page. When I change the role and save it, it looks saved, but when I open the member again the old role is there.";

function useDraftStorage(userId: string) {
  const key = `bugloop.report-draft.${userId}`;
  const load = (): { form: FormState; text: string } | null => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as { form: FormState; text: string }) : null;
    } catch {
      return null;
    }
  };
  const save = (form: FormState, text: string) => {
    try {
      localStorage.setItem(key, JSON.stringify({ form, text }));
    } catch {
      // Drafts are a convenience; ignore storage failures.
    }
  };
  const clear = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  };
  return { load, save, clear };
}

export function ReportBugPage() {
  const { ws, lookup } = useWorkspace();
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const storage = useDraftStorage(ws.me.id);
  const initial = useMemo(() => storage.load(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultProject = ws.projects.filter((p) => !p.archived)[0]?.id ?? "";
  const [form, setForm] = useState<FormState>(() => initial?.form ?? { ...EMPTY, project_id: defaultProject });
  const [text, setText] = useState(initial?.text ?? "");
  const [shots, setShots] = useState<File[]>([]);
  const [evidence, setEvidence] = useState<File[]>([]);
  const [more, setMore] = useState(false);
  const [touched, setTouched] = useState(false);

  // Assistant state
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answered, setAnswered] = useState<{ question: string; answer: string }[]>([]);
  const [prov, setProv] = useState<Record<string, Provenance>>({});
  const [stepProv, setStepProv] = useState<(Provenance | null)[]>([]);
  const [draftedValues, setDraftedValues] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const userEdited = useRef<Set<string>>(new Set(initial ? Object.keys(initial.form).filter((k) => (initial.form as unknown as Record<string, unknown>)[k]) : []));

  // Duplicate check state
  const [dupDialog, setDupDialog] = useState<SimilarBug[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => storage.save(form, text), 400);
    return () => window.clearTimeout(t);
  }, [form, text]); // eslint-disable-line react-hooks/exhaustive-deps

  const modules = lookup.modulesOf(form.project_id);
  const features = lookup.featuresOf(form.module_id);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    userEdited.current.add(k);
    setForm((f) => ({ ...f, [k]: v }));
  };

  // ---------------------------------------------------------------- similar bugs (live)
  // Debounce a string: an object would change identity on every render and never settle.
  const simKey = useDebounced(
    JSON.stringify({ project_id: form.project_id, module_id: form.module_id, feature_id: form.feature_id, title: form.title || (text ? text.slice(0, 160) : ""), description: form.description || text, actual_result: form.actual_result, steps: form.steps.filter(Boolean) }),
    500,
  );
  const simInput = useMemo(() => JSON.parse(simKey) as { project_id: string; module_id: string; feature_id: string; title: string; description: string; actual_result: string; steps: string[] }, [simKey]);
  const similar = useQuery({
    queryKey: ["similar-live", simInput],
    queryFn: () => api.post<{ items: SimilarBug[] }>("/similar", simInput),
    enabled: (simInput.title + simInput.description).trim().length >= 12,
    staleTime: 30_000,
  });
  const matches = similar.data?.items ?? [];
  const strong = matches.filter((m) => m.level !== "low");

  // ---------------------------------------------------------------- assistant
  // Merge a draft into the form. Computed from the latest form (the request is async and the
  // reporter may keep typing), never overwriting a field the reporter changed themselves.
  const formRef = useRef(form);
  formRef.current = form;
  const applyDraft = (d: DraftResult) => {
    const n = { ...formRef.current };
    const nextProv: Record<string, Provenance> = { ...prov };
    const nextDrafted: Record<string, string> = { ...draftedValues };
    const take = (field: TextField, v: Sourced | null) => {
      if (!v) return;
      const current = String(n[field] ?? "");
      if (userEdited.current.has(field) && current && current !== draftedValues[field]) return;
      (n as unknown as Record<string, string>)[field] = v.value;
      nextProv[field] = v.source;
      nextDrafted[field] = v.value;
    };
    take("title", d.title);
    take("description", d.description);
    take("expected_result", d.expected_result);
    take("actual_result", d.actual_result);
    take("browser", d.browser);
    take("device", d.device);
    take("os", d.os);
    take("app_version", d.app_version);
    take("page_url", d.page_url);
    const stepsEdited = userEdited.current.has("steps") && n.steps.some((x) => x.trim()) && n.steps.join("\n") !== draftedValues.steps;
    let steps: (Provenance | null)[] | null = null;
    if (d.steps.length && !stepsEdited) {
      n.steps = d.steps.map((x) => x.value);
      steps = d.steps.map((x) => x.source);
      nextDrafted.steps = n.steps.join("\n");
      nextProv.steps = d.steps.some((x) => x.source === "ai_inferred") ? "ai_inferred" : d.steps[0].source;
    }
    const pick = <K extends "module_id" | "feature_id" | "environment_id">(field: K, v: Sourced | null) => {
      if (!v || n[field]) return;
      n[field] = v.value;
      nextProv[field] = v.source;
      nextDrafted[field] = v.value;
    };
    pick("module_id", d.module_id);
    pick("feature_id", d.feature_id);
    pick("environment_id", d.environment_id);
    if (d.frequency && n.frequency === "unknown") {
      n.frequency = d.frequency.value;
      nextProv.frequency = d.frequency.source;
      nextDrafted.frequency = d.frequency.value;
    }
    setForm(n);
    if (steps) setStepProv(steps);
    setProv(nextProv);
    setDraftedValues(nextDrafted);
    if ([d.browser, d.device, d.os, d.app_version, d.page_url, d.frequency].some(Boolean)) setMore(true);
  };

  const runDraft = async (offline = false) => {
    setDrafting(true);
    setAiError(null);
    try {
      const qa = (draft?.missing_information ?? [])
        .map((m) => ({ question: m.question, answer: answers[m.field] ?? "" }))
        .filter((a) => a.answer.trim());
      const result = await api.postWithFiles<DraftResult>(
        "/ai/draft",
        {
          text,
          project_id: form.project_id || null,
          module_id: form.module_id || null,
          feature_id: form.feature_id || null,
          environment_id: form.environment_id || null,
          answers: [...answered, ...qa],
          offline,
          fields: {
            title: userEdited.current.has("title") ? form.title : undefined,
            expected_result: userEdited.current.has("expected_result") ? form.expected_result : undefined,
            actual_result: userEdited.current.has("actual_result") ? form.actual_result : undefined,
            browser: form.browser || undefined,
            device: form.device || undefined,
            os: form.os || undefined,
            app_version: form.app_version || undefined,
            page_url: form.page_url || undefined,
            frequency: form.frequency !== "unknown" ? form.frequency : undefined,
          },
        },
        shots,
      );
      setDraft(result);
      applyDraft(result);
      setAnswered((prev) => [...prev, ...qa]);
      setAnswers({});
      toast(result.provider === "offline" ? "Draft ready (offline assistant). Review every field." : "Draft ready. Review every field before submitting.");
    } catch (err) {
      setAiError(errorMessage(err));
    } finally {
      setDrafting(false);
    }
  };

  // ---------------------------------------------------------------- submission
  const create = useMutate(
    (a, args: { payload: Record<string, unknown>; files: File[] }) => a.postWithFiles<BugDetail>("/bugs", args.payload, args.files),
    { success: (r) => `Reported ${r.bug.key}` },
  );

  const steps = form.steps.map((s) => s.trim()).filter(Boolean);
  const problems: Record<string, string> = {};
  if (!form.project_id) problems.project_id = "Choose a project.";
  if (!form.module_id) problems.module_id = "Choose a module.";
  if (!form.title.trim()) problems.title = "Add a title.";
  if (!steps.length) problems.steps = "Add at least one step.";
  if (!form.expected_result.trim()) problems.expected_result = "Describe what should happen.";
  if (!form.actual_result.trim()) problems.actual_result = "Describe what actually happens.";
  if (!form.severity) problems.severity = "Choose a severity.";
  const err = (k: string) => (touched ? problems[k] ?? null : null);

  const aiMeta = (): AiMeta | null => {
    if (!draft) return null;
    const drafted = Object.keys(draftedValues);
    const current: Record<string, string> = {
      ...Object.fromEntries((Object.keys(form) as (keyof FormState)[]).map((k) => [k, String(form[k] ?? "")])),
      steps: form.steps.join("\n"),
    };
    return {
      provider: draft.provider,
      model: draft.model,
      drafted_fields: drafted,
      provenance: Object.fromEntries(drafted.map((k) => [k, prov[k] ?? "ai_wording"])),
      edited_fields: drafted.filter((k) => current[k] !== draftedValues[k]),
      confirmed_fields: [...confirmed].filter((k) => drafted.includes(k)),
      screenshot_observations: draft.screenshot_observations,
      drafted_at: new Date().toISOString(),
    };
  };

  const submit = (decision: DuplicateCheck["decision"], candidates: SimilarBug[]) => {
    const payload = {
      project_id: form.project_id,
      module_id: form.module_id,
      feature_id: form.feature_id || null,
      affected_module_ids: form.affected_module_ids,
      title: form.title.trim(),
      description: form.description,
      steps,
      expected_result: form.expected_result,
      actual_result: form.actual_result,
      environment_id: form.environment_id || null,
      browser: form.browser || null,
      device: form.device || null,
      os: form.os || null,
      app_version: form.app_version || null,
      page_url: form.page_url || null,
      frequency: form.frequency,
      severity: form.severity,
      priority: form.priority,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: form.notes || null,
      ai_meta: aiMeta(),
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
          storage.clear();
          navigate(`/bugs/${res.bug.key}`);
        },
      },
    );
  };

  const onSubmit = () => {
    setTouched(true);
    if (Object.keys(problems).length) {
      toast("Fill in the highlighted fields first.", "error");
      return;
    }
    if (strong.length) setDupDialog(strong);
    else submit("none_found", []);
  };

  const reset = () => {
    storage.clear();
    setForm({ ...EMPTY, project_id: defaultProject });
    setText("");
    setShots([]);
    setEvidence([]);
    setDraft(null);
    setAnswered([]);
    setProv({});
    setStepProv([]);
    setDraftedValues({});
    setConfirmed(new Set());
    userEdited.current = new Set();
    setTouched(false);
  };

  const offline = draft?.provider === "offline";
  const chip = (field: string) => {
    const p = prov[field];
    if (!p) return null;
    const edited = field !== "steps" && field in draftedValues && String((form as unknown as Record<string, unknown>)[field] ?? "") !== draftedValues[field];
    if (edited) return <span className="tiny muted">edited by you</span>;
    if (p === "ai_inferred" && confirmed.has(field)) return <ProvenanceChip source={p} label="AI-inferred, confirmed" />;
    if (p === "ai_inferred" && !confirmed.has(field)) {
      return (
        <span className="row" style={{ gap: 6 }}>
          <ProvenanceChip source={p} offline={offline} />
          <button className="link-btn tiny" onClick={() => setConfirmed((s) => new Set(s).add(field))}>
            Confirm
          </button>
        </span>
      );
    }
    return <ProvenanceChip source={p} offline={offline} />;
  };
  const inferred = (field: string) => {
    if (confirmed.has(field)) return false;
    if (field === "steps") return stepProv.some((p) => p === "ai_inferred");
    return prov[field] === "ai_inferred" && String((form as unknown as Record<string, unknown>)[field] ?? "") === draftedValues[field];
  };
  const unconfirmed = Object.keys(prov).filter((k) => inferred(k));
  const confirmAll = () => setConfirmed((c) => new Set([...c, ...unconfirmed]));
  const FIELD_NAMES: Record<string, string> = { steps: "steps", title: "title", description: "description", expected_result: "expected result", actual_result: "actual result", module_id: "module", feature_id: "feature", environment_id: "environment", frequency: "frequency", browser: "browser", device: "device", os: "operating system", app_version: "app version", page_url: "page URL" };

  const checklist = [
    { label: "Title that names the symptom", ok: form.title.trim().length >= 12 },
    { label: "Steps to reproduce", ok: steps.length >= 2 },
    { label: "Expected result", ok: !!form.expected_result.trim() },
    { label: "Actual result", ok: !!form.actual_result.trim() },
    { label: "Environment", ok: !!form.environment_id },
    { label: "Screenshot or recording", ok: shots.length + evidence.length > 0 },
    { label: "Severity", ok: !!form.severity },
    ...(draft ? [{ label: "AI-inferred fields confirmed", ok: unconfirmed.length === 0 }] : []),
  ];

  return (
    <div className="report-page">
      <div className="page-head">
        <div>
          <h1>Report a bug</h1>
          <p className="sub">Describe the problem in your own words. The assistant structures it; you stay in charge of every field.</p>
        </div>
        {(form.title || text) && (
          <button className="btn btn-ghost btn-sm" onClick={reset}>
            <Trash2 /> Discard draft
          </button>
        )}
      </div>

      <div className="report-grid">
        <div className="stack-lg">
          {/* ---------------------------------------------------- where */}
          <section className="panel">
            <div className="panel-head">
              <h2>Where did it happen?</h2>
            </div>
            <div className="panel-body">
              <div className="grid-3">
                <Field label="Project" required error={err("project_id")} htmlFor="r-project">
                  <select id="r-project" className={cx("select", err("project_id") && "invalid")} value={form.project_id} onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value, module_id: "", feature_id: "", affected_module_ids: [] }))}>
                    <option value="">Choose…</option>
                    {ws.projects.filter((p) => !p.archived).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Module" aside={chip("module_id")} required error={err("module_id")} htmlFor="r-module">
                  <select id="r-module" className={cx("select", err("module_id") && "invalid")} value={form.module_id} onChange={(e) => { set("module_id", e.target.value); setForm((f) => ({ ...f, feature_id: "" })); }}>
                    <option value="">Choose…</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Feature" aside={chip("feature_id")} htmlFor="r-feature">
                  <select id="r-feature" className="select" value={form.feature_id} onChange={(e) => set("feature_id", e.target.value)} disabled={!features.length}>
                    <option value="">{!form.module_id ? "Choose a module first" : features.length ? "Not specified" : "No features in this module"}</option>
                    {features.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------- assistant */}
          <section className="panel assistant">
            <div className="panel-head">
              <h2 className="row" style={{ gap: 8 }}>
                <Sparkles size={17} className="ai-icon" /> Describe what happened
              </h2>
              <span className="hint">{ws.ai.label}{ws.ai.vision ? " · reads screenshots" : ""}</span>
            </div>
            <div className="panel-body stack">
              <textarea
                className="textarea"
                rows={4}
                value={text}
                placeholder={EXAMPLE}
                onChange={(e) => setText(e.target.value)}
                aria-label="Describe the problem in your own words"
              />
              {!text && (
                <button className="link-btn small" style={{ alignSelf: "flex-start" }} onClick={() => setText(EXAMPLE)}>
                  Try the example
                </button>
              )}
              <FileDrop
                files={shots}
                onChange={setShots}
                imagesOnly
                pasteTarget="document"
                label="Add screenshots for the assistant"
                hint={ws.ai.vision ? "The assistant reads visible text, messages and values. Screenshots are also attached to the report." : "Screenshots are attached to the report. This assistant can't read images."}
              />
              <div className="row-wrap">
                <button className="btn btn-accent" onClick={() => runDraft(false)} disabled={drafting || (!text.trim() && !shots.length)}>
                  {drafting ? <span className="spinner" /> : <Wand2 />}
                  {draft ? "Draft again" : "Draft report"}
                </button>
                <span className="small muted">
                  {drafting
                    ? ws.ai.provider === "offline"
                      ? "Structuring your description…"
                      : "Claude is reading your description" + (shots.length ? " and screenshots…" : "…")
                    : "It fills in the form below. Nothing is submitted until you click Submit."}
                </span>
              </div>
              {aiError && (
                <div className="callout danger">
                  <CircleAlert />
                  <div className="grow">
                    <div className="title">The assistant couldn't draft this report</div>
                    <div>{aiError}</div>
                    {ws.ai.provider !== "offline" && (
                      <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => runDraft(true)}>
                        Use the offline assistant instead
                      </button>
                    )}
                  </div>
                </div>
              )}
              {draft && <DraftSummary draft={draft} answers={answers} setAnswers={setAnswers} onUpdate={() => runDraft(offline)} busy={drafting} onUseSeverity={(k) => set("severity", k)} currentSeverity={form.severity} onUseObservation={(t) => set("actual_result", t)} />}
            </div>
          </section>

          {/* ---------------------------------------------------- the report */}
          <section className="panel">
            <div className="panel-head">
              <h2>Report</h2>
              <span className="hint">Fields marked * are required</span>
            </div>
            <div className="panel-body stack-lg">
              <Field label="Title" aside={chip("title")} required error={err("title")} htmlFor="r-title">
                <input id="r-title" className={cx("input", err("title") && "invalid", inferred("title") && "inferred")} value={form.title} maxLength={200} placeholder="Member role changes are not kept after saving" onChange={(e) => set("title", e.target.value)} />
              </Field>
              <div className="grid-3">
                <Field label="Environment" aside={chip("environment_id")} htmlFor="r-env">
                  <select id="r-env" className="select" value={form.environment_id} onChange={(e) => set("environment_id", e.target.value)}>
                    <option value="">Not specified</option>
                    {ws.environments.filter((e) => e.active).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Severity" required error={err("severity")} htmlFor="r-sev" help={form.severity ? lookup.severity(form.severity)?.description : undefined}>
                  <select id="r-sev" className={cx("select", err("severity") && "invalid")} value={form.severity} onChange={(e) => set("severity", e.target.value)}>
                    <option value="">Choose…</option>
                    {ws.severities.filter((s) => s.active).map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority (your suggestion)" htmlFor="r-prio">
                  <select id="r-prio" className="select" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                    {ws.priorities.filter((s) => s.active).map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <StepsEditor
                steps={form.steps}
                provs={stepProv}
                offline={offline}
                error={err("steps")}
                confirmed={confirmed.has("steps")}
                onConfirm={() => setConfirmed((c) => new Set(c).add("steps"))}
                onChange={(s, p) => {
                  set("steps", s);
                  setStepProv(p);
                }}
              />

              <div className="grid-2">
                <Field label="Expected result" aside={chip("expected_result")} required error={err("expected_result")} htmlFor="r-expected">
                  <textarea id="r-expected" className={cx("textarea", err("expected_result") && "invalid", inferred("expected_result") && "inferred")} rows={3} value={form.expected_result} placeholder="The member keeps the new role." onChange={(e) => set("expected_result", e.target.value)} />
                </Field>
                <Field label="Actual result" aside={chip("actual_result")} required error={err("actual_result")} htmlFor="r-actual">
                  <textarea id="r-actual" className={cx("textarea", err("actual_result") && "invalid", inferred("actual_result") && "inferred")} rows={3} value={form.actual_result} placeholder="The old role is shown after reopening the member." onChange={(e) => set("actual_result", e.target.value)} />
                </Field>
              </div>

              <Field label="Description" aside={chip("description")} help="Optional. Context an engineer should know: impact, which records, anything unusual." htmlFor="r-desc">
                <textarea id="r-desc" className="textarea" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </Field>

              <div className="stack-sm">
                <span className="field-label">More evidence</span>
                <FileDrop files={evidence} onChange={setEvidence} label="Add recordings, logs or more screenshots" />
              </div>

              <div className="more-details">
                <button className="more-toggle" onClick={() => setMore((m) => !m)} aria-expanded={more}>
                  {more ? <ChevronDown /> : <ChevronRight />} More details
                  <span className="muted small">browser, device, build, frequency, tags, other modules</span>
                </button>
                {more && (
                  <div className="stack" style={{ marginTop: 12 }}>
                    <div className="grid-3">
                      {(["browser", "device", "os"] as const).map((k) => (
                        <Field key={k} label={k === "os" ? "Operating system" : k === "browser" ? "Browser" : "Device"} aside={chip(k)} htmlFor={`r-${k}`}>
                          <input id={`r-${k}`} className="input" value={form[k]} placeholder={k === "browser" ? "Chrome 128" : k === "device" ? "MacBook Pro, iPhone 15…" : "Windows 11"} onChange={(e) => set(k, e.target.value)} />
                        </Field>
                      ))}
                      <Field label="App version or build" aside={chip("app_version")} htmlFor="r-ver">
                        <input id="r-ver" className="input" value={form.app_version} placeholder="2.14.2" onChange={(e) => set("app_version", e.target.value)} />
                      </Field>
                      <Field label="How often" aside={chip("frequency")} htmlFor="r-freq">
                        <select id="r-freq" className="select" value={form.frequency} onChange={(e) => set("frequency", e.target.value as Frequency)}>
                          {FREQUENCIES.map((f) => (
                            <option key={f} value={f}>
                              {FREQUENCY_LABELS[f]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Tags" help="Comma separated" htmlFor="r-tags">
                        <input id="r-tags" className="input" value={form.tags} placeholder="roles, regression" onChange={(e) => set("tags", e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Page URL" aside={chip("page_url")} htmlFor="r-url">
                      <input id="r-url" className="input" value={form.page_url} placeholder="https://…" onChange={(e) => set("page_url", e.target.value)} />
                    </Field>
                    {modules.length > 1 && (
                      <Field label="Also affects" help="The same problem appears in other modules too.">
                        <div className="row-wrap">
                          {modules
                            .filter((m) => m.id !== form.module_id)
                            .map((m) => {
                              const on = form.affected_module_ids.includes(m.id);
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  className={cx("chip", on && "accent")}
                                  aria-pressed={on}
                                  onClick={() => set("affected_module_ids", on ? form.affected_module_ids.filter((x) => x !== m.id) : [...form.affected_module_ids, m.id])}
                                >
                                  {on && <Check />} {m.name}
                                </button>
                              );
                            })}
                        </div>
                      </Field>
                    )}
                    <Field label="Additional notes" htmlFor="r-notes">
                      <textarea id="r-notes" className="textarea" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="submit-bar">
            {unconfirmed.length > 0 ? (
              <span className="small row-wrap" style={{ gap: 8 }}>
                <ProvenanceChip source="ai_inferred" />
                <span className="secondary">
                  Check the {unconfirmed.map((k) => FIELD_NAMES[k] ?? k.replace(/_/g, " ")).join(", ")}: the assistant inferred {unconfirmed.length === 1 ? "it" : "them"}.
                </span>
                <button className="link-btn small" onClick={confirmAll}>
                  They're correct
                </button>
              </span>
            ) : (
              <span className="small muted">
                {strong.length ? `${strong.length} similar bug${strong.length === 1 ? "" : "s"} found. You'll review them before submitting.` : "Similar bugs are checked as you type."}
              </span>
            )}
            <button className="btn btn-primary btn-lg" onClick={onSubmit} disabled={create.isPending}>
              {create.isPending && <span className="spinner" />}Submit report
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------- rail */}
        <aside className="report-rail">
          <section className="panel">
            <div className="panel-head">
              <h2>Possible duplicates</h2>
              {similar.isFetching && <span className="spinner" />}
            </div>
            <div className="panel-body">
              {!matches.length ? (
                <p className="small muted">{(simInput.title + simInput.description).trim().length < 12 ? "Start describing the problem to check for existing bugs." : "No similar bugs found."}</p>
              ) : (
                <div className="stack-sm">
                  {matches.map((m) => (
                    <button key={m.bug.id} className="similar-row as-button" onClick={() => setPreview(m.bug.key)}>
                      <span className={`sim-level ${m.level}`}>{m.level}</span>
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="row-wrap" style={{ gap: 4 }}>
                          <span className="mono tiny muted nowrap">{m.bug.key}</span>
                          <StatusPill status={m.bug.status} size="sm" />
                        </span>
                        <span className="small" style={{ display: "block" }}>{m.bug.title}</span>
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
          <section className="panel">
            <div className="panel-head">
              <h2 className="row" style={{ gap: 6 }}>
                <ListChecks size={16} /> Report checklist
              </h2>
              <span className="hint">
                {checklist.filter((c) => c.ok).length}/{checklist.length}
              </span>
            </div>
            <div className="panel-body">
              <ul className="checklist">
                {checklist.map((c) => (
                  <li key={c.label} className={c.ok ? "ok" : ""}>
                    {c.ok ? <Check /> : <span className="ring" />}
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section className="panel soft">
            <div className="panel-body stack-sm small secondary">
              <div className="row" style={{ gap: 6, color: "var(--text)" }}>
                <ShieldCheck size={16} /> <strong>How the assistant works</strong>
              </div>
              <p>It uses only what you wrote, the fields you chose and what is visible in your screenshots. When something is missing it asks instead of guessing.</p>
              <p>Every drafted field is labelled with where it came from, and inferred fields stay highlighted until you confirm them.</p>
            </div>
          </section>
        </aside>
      </div>

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
              await api.postWithFiles(`/bugs/${key}/also-seen`, { note: [text, form.actual_result].filter(Boolean).join("\n\n") }, [...shots, ...evidence]);
              storage.clear();
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

/** How to read a match against a bug that is no longer open. */
function resolvedNote(m: SimilarBug): string {
  if (m.bug.status === "not_a_bug") return "marked Not a Bug; check the reason before reporting again";
  if (m.bug.status === "duplicate") return "closed as a duplicate";
  return `closed${m.bug.closed_at ? ` ${shortDate(m.bug.closed_at)}` : ""}; if it's back, this may be a regression`;
}

function StepsEditor({
  steps,
  provs,
  offline,
  error,
  confirmed,
  onConfirm,
  onChange,
}: {
  steps: string[];
  provs: (Provenance | null)[];
  offline: boolean;
  error: string | null;
  confirmed: boolean;
  onConfirm: () => void;
  onChange: (s: string[], p: (Provenance | null)[]) => void;
}) {
  const update = (i: number, v: string) => {
    const s = [...steps];
    s[i] = v;
    const p = [...provs];
    p[i] = null;
    onChange(s, p);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const s = [...steps];
    const p = [...provs];
    [s[i], s[j]] = [s[j], s[i]];
    [p[i], p[j]] = [p[j], p[i]];
    onChange(s, p);
  };
  return (
    <div className="field">
      <label>
        Steps to reproduce<span className="req">*</span>
      </label>
      <ol className="steps-editor">
        {steps.map((s, i) => (
          <li key={i}>
            <span className="step-no">{i + 1}</span>
            <input
              className={cx("input", provs[i] === "ai_inferred" && !confirmed && "inferred")}
              value={s}
              placeholder={i === 0 ? "Go to Members" : "Next action…"}
              aria-label={`Step ${i + 1}`}
              onChange={(e) => update(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onChange([...steps.slice(0, i + 1), "", ...steps.slice(i + 1)], [...provs.slice(0, i + 1), null, ...provs.slice(i + 1)]);
                  window.setTimeout(() => (document.querySelector(`[aria-label="Step ${i + 2}"]`) as HTMLInputElement | null)?.focus(), 0);
                }
              }}
            />
            {provs[i] && <ProvenanceChip source={provs[i]!} offline={offline} label={provs[i] === "ai_inferred" && confirmed ? "AI-inferred, confirmed" : undefined} />}
            {provs[i] === "ai_inferred" && !confirmed && (
              <button className="link-btn tiny" onClick={onConfirm}>
                Confirm
              </button>
            )}
            <span className="step-tools">
              <button className="icon-btn" onClick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}>
                <ArrowUp size={14} />
              </button>
              <button className="icon-btn" onClick={() => move(i, 1)} aria-label="Move down" disabled={i === steps.length - 1}>
                <ArrowDown size={14} />
              </button>
              <button className="icon-btn" onClick={() => onChange(steps.length > 1 ? steps.filter((_, j) => j !== i) : [""], provs.filter((_, j) => j !== i))} aria-label="Remove step">
                <X size={14} />
              </button>
            </span>
          </li>
        ))}
      </ol>
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...steps, ""], [...provs, null])}>
        <Plus /> Add step
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}

function DraftSummary({
  draft,
  answers,
  setAnswers,
  onUpdate,
  busy,
  onUseSeverity,
  currentSeverity,
  onUseObservation,
}: {
  draft: DraftResult;
  answers: Record<string, string>;
  setAnswers: (a: Record<string, string>) => void;
  onUpdate: () => void;
  busy: boolean;
  onUseSeverity: (k: string) => void;
  currentSeverity: string;
  onUseObservation: (text: string) => void;
}) {
  const { lookup } = useWorkspace();
  const filled = [draft.title, draft.description, draft.expected_result, draft.actual_result, draft.environment_id, draft.browser, draft.device, draft.os, draft.app_version, draft.frequency].filter(Boolean).length + (draft.steps.length ? 1 : 0);
  const answered = Object.values(answers).filter((a) => a.trim()).length;
  const sources = new Set(
    [draft.title, draft.description, draft.expected_result, draft.actual_result, draft.module_id, draft.feature_id, draft.environment_id, draft.browser, draft.device, draft.os, draft.app_version, draft.page_url, draft.frequency, ...draft.steps]
      .filter((x): x is NonNullable<typeof x> => !!x)
      .map((x) => x.source),
  );
  return (
    <div className="draft-summary stack">
      <div className="row" style={{ gap: 8 }}>
        <Bot size={16} className="ai-icon" />
        <strong>
          Draft ready: {filled} field{filled === 1 ? "" : "s"} filled
          {draft.images_analyzed ? ` from your description and ${draft.images_analyzed} screenshot${draft.images_analyzed === 1 ? "" : "s"}` : ""}.
        </strong>
        <span className="muted small">{draft.provider === "offline" ? "Offline assistant" : draft.model ? `Claude · ${draft.model}` : "Claude"}</span>
      </div>
      <div className="legend-row">
        {(["reporter", "screenshot", "ai_wording", "ai_inferred"] as const)
          .filter((src) => sources.has(src))
          .map((src) => (
            <ProvenanceChip key={src} source={src} offline={draft.provider === "offline"} />
          ))}
      </div>
      {draft.screenshot_observations.length > 0 && (
        <div className="stack-sm">
          <span className="field-label row" style={{ gap: 6 }}>
            <Camera size={14} /> Seen in your screenshots
          </span>
          <ul className="observations">
            {draft.screenshot_observations.map((o, i) => (
              <li key={i}>
                <span className="obs-kind">{o.kind.replace(/_/g, " ")}</span>
                <span>
                  {o.observation}
                  {o.quote && <q>{o.quote}</q>}
                </span>
                <button className="link-btn tiny" onClick={() => onUseObservation(o.quote ? `${o.observation} ("${o.quote}")` : o.observation)}>
                  Use as actual result
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {draft.severity_suggestion && draft.severity_suggestion.key !== currentSeverity && (
        <div className="callout">
          <Sparkles />
          <div className="grow">
            <div>
              Suggested severity: <strong>{lookup.severity(draft.severity_suggestion.key)?.label ?? draft.severity_suggestion.key}</strong>. {draft.severity_suggestion.rationale}
            </div>
            <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => onUseSeverity(draft.severity_suggestion!.key)}>
              Use this severity
            </button>
          </div>
        </div>
      )}
      {draft.missing_information.length > 0 && (
        <div className="questions">
          <div className="row" style={{ gap: 6 }}>
            <strong>The assistant needs a few details</strong>
            <span className="small muted">Answer what you know; skip the rest.</span>
          </div>
          {draft.missing_information.map((m) => (
            <div key={m.field} className="question">
              <label htmlFor={`q-${m.field}`}>{m.question}</label>
              <input id={`q-${m.field}`} className="input input-sm" value={answers[m.field] ?? ""} onChange={(e) => setAnswers({ ...answers, [m.field]: e.target.value })} />
            </div>
          ))}
          <button className="btn btn-sm btn-accent" style={{ alignSelf: "flex-start" }} onClick={onUpdate} disabled={busy || !answered}>
            {busy ? <span className="spinner" /> : <Wand2 />} Update draft with {answered || "your"} answer{answered === 1 ? "" : "s"}
          </button>
        </div>
      )}
      {draft.removed_by_guardrail.length > 0 && (
        <p className="tiny muted">
          Left out because you didn't mention them: {draft.removed_by_guardrail.map((r) => `${r.field.replace(/_/g, " ")} “${r.value}”`).join(", ")}.
        </p>
      )}
      {draft.notes.map((n) => (
        <p key={n} className="tiny muted">
          {n}
        </p>
      ))}
    </div>
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
            <div className="row-between">
              <span className="row" style={{ gap: 8 }}>
                <span className={`sim-level ${c.level}`}>Similarity: {c.level}</span>
                <span className="mono small">{c.bug.key}</span>
                <StatusPill status={c.bug.status} size="sm" />
              </span>
            </div>
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
          <Link className="btn" to={`/bugs/${bugKey}`} title="Your draft is saved; come back to it from Report bug.">
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
