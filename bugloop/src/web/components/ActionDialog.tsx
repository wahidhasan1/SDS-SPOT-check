// Renders any lifecycle action's inputs from the workflow engine's definition, so the form
// always matches what the server will require.

import { useMemo, useState } from "react";
import type { BugDetail } from "../../core/api";
import { ACTION_DEFS, type ActionField, type ActionKey } from "../../core/workflow";
import { useWorkspace } from "../app/context";
import { useMutate, useSimilarForBug } from "../api/hooks";
import { FileDrop } from "./Attachments";
import { BugPicker } from "./BugPicker";
import { Dialog, Field } from "./ui";

export function buttonClass(key: ActionKey, primary = false): string {
  const tone = ACTION_DEFS[key].tone;
  if (primary) return tone === "positive" ? "btn btn-positive" : tone === "danger" ? "btn btn-danger solid" : "btn btn-primary";
  if (tone === "danger") return "btn btn-danger";
  if (tone === "warning") return "btn btn-warning";
  if (tone === "positive") return "btn btn-positive";
  return "btn";
}

export function useRunAction(detail: BugDetail) {
  return useMutate(
    (api, args: { action: ActionKey; input: Record<string, unknown>; files: File[] }) =>
      api.postWithFiles<BugDetail>(`/bugs/${detail.bug.key}/actions/${args.action}`, args.input, args.files),
    { success: (_r, args) => ACTION_DEFS[args.action].done },
  );
}

export function ActionDialog({ detail, action, onClose }: { detail: BugDetail; action: ActionKey; onClose: () => void }) {
  const def = ACTION_DEFS[action];
  const { ws, lookup } = useWorkspace();
  const run = useRunAction(detail);
  const bug = detail.bug;
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const f of def.fields) {
      if (f.defaultValue !== undefined) init[f.name] = f.defaultValue;
      if (f.kind === "user" && action === "request_info") init[f.name] = bug.reporter_id;
      if (f.kind === "environment" && (action === "pass_regression" || action === "fail_regression")) {
        const run = detail.regression_runs.find((r) => r.result === "pending");
        if (run?.environment_id) init[f.name] = run.environment_id;
      }
      if (f.name === "build" && (action === "pass_regression" || action === "fail_regression")) {
        init[f.name] = bug.fix_version ?? "";
      }
    }
    return init;
  });
  const [files, setFiles] = useState<File[]>([]);
  const [touched, setTouched] = useState(false);
  const similar = useSimilarForBug(action === "mark_duplicate" ? bug.key : undefined);

  const missing = def.fields.filter((f) => f.required && f.kind !== "files" && f.kind !== "checkbox" && !String(values[f.name] ?? "").trim());

  const submit = () => {
    setTouched(true);
    if (missing.length) return;
    const input: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) if (v !== "" && v !== undefined) input[k] = v;
    run.mutate({ action, input, files }, { onSuccess: onClose });
  };

  const set = (name: string, v: string | boolean) => setValues((s) => ({ ...s, [name]: v }));

  const userOptions = (f: ActionField) => {
    const roles = f.roles ?? ["qa_analyst", "qa_lead"];
    const people = lookup.peopleWithRoles(roles);
    const reporter = lookup.user(bug.reporter_id);
    if (reporter && reporter.active && !people.some((p) => p.id === reporter.id)) people.unshift(reporter);
    return people;
  };

  const renderField = (f: ActionField) => {
    const id = `act-${action}-${f.name}`;
    const invalid = touched && missing.includes(f);
    switch (f.kind) {
      case "textarea":
        return (
          <Field key={f.name} label={f.label} required={f.required} help={f.help} error={invalid ? `${f.label} is required.` : null} htmlFor={id}>
            <textarea id={id} className={`textarea ${invalid ? "invalid" : ""}`} rows={4} placeholder={f.placeholder} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} />
          </Field>
        );
      case "text":
        return (
          <Field key={f.name} label={f.label} required={f.required} help={f.help} htmlFor={id}>
            <input id={id} className="input" placeholder={f.placeholder} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} />
          </Field>
        );
      case "date":
        return (
          <Field key={f.name} label={f.label} help={f.help} htmlFor={id}>
            <input id={id} type="date" className="input" value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} />
          </Field>
        );
      case "select":
        return (
          <Field key={f.name} label={f.label} required={f.required} help={f.help} htmlFor={id}>
            <select id={id} className="select" value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)}>
              <option value="">{f.required ? "Choose…" : "Not specified"}</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        );
      case "environment":
        return (
          <Field key={f.name} label={f.label} help={f.help} htmlFor={id}>
            <select id={id} className="select" value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)}>
              <option value="">Not specified</option>
              {ws.environments.filter((e) => e.active).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
        );
      case "user":
        return (
          <Field key={f.name} label={f.label} help={f.help} htmlFor={id}>
            <select id={id} className="select" value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)}>
              {userOptions(f).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.id === bug.reporter_id ? " (reporter)" : ""}
                </option>
              ))}
            </select>
          </Field>
        );
      case "checkbox":
        return (
          <label key={f.name} className="checkbox">
            <input id={id} type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />
            <span>
              {f.label}
              {f.help && <span className="help block">{f.help}</span>}
            </span>
          </label>
        );
      case "bug":
        return (
          <Field key={f.name} label={f.label} required={f.required} error={invalid ? "Choose the original bug." : null}>
            <BugPicker value={String(values[f.name] ?? "")} onPick={(k) => set(f.name, k)} excludeId={bug.id} placeholder={f.placeholder} invalid={invalid} />
            {similar.data && similar.data.items.length > 0 && (
              <div className="stack-sm" style={{ marginTop: 6 }}>
                <span className="tiny muted">Similar bugs</span>
                <div className="row-wrap">
                  {similar.data.items.slice(0, 4).map((s) => (
                    <button key={s.bug.id} type="button" className="chip" onClick={() => set(f.name, s.bug.key)} title={s.bug.title}>
                      <span className="mono">{s.bug.key}</span> {s.level}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Field>
        );
      case "files":
        return <FileDrop key={f.name} files={files} onChange={setFiles} compact label="Attach evidence" />;
    }
  };

  const title = useMemo(() => `${def.label} · ${bug.key}`, [def.label, bug.key]);

  return (
    <Dialog
      title={title}
      description={def.description}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className={buttonClass(action, true)} onClick={submit} disabled={run.isPending}>
            {run.isPending ? <span className="spinner" /> : null}
            {def.submitLabel}
          </button>
        </>
      }
    >
      {action === "mark_not_a_bug" && (
        <div className="callout info">
          <span>The reporter sees your explanation and can dispute it. Point to the documentation or behaviour that makes this expected.</span>
        </div>
      )}
      {action === "fail_regression" && (
        <div className="callout warning">
          <span>The bug goes back to {lookup.userName(bug.assignee_id ?? bug.fixed_by_id)} with your notes. Be specific about what still fails.</span>
        </div>
      )}
      {action === "pass_regression" && bug.duplicate_of_id === null && detail.duplicates.length > 0 && (
        <div className="callout info">
          <span>
            {detail.duplicates.length} duplicate report{detail.duplicates.length === 1 ? "" : "s"} will be told the original is verified.
          </span>
        </div>
      )}
      {def.fields.map(renderField)}
    </Dialog>
  );
}
